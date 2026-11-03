import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseBankNarration,
  normalizeBankDate,
  parseStatementText,
  parsePdfStatementWithMeta,
  calculatePersonLedger,
  calculateBudgetStatuses,
  detectRecurringSubscriptions,
  reconcileMerchantRefunds,
  analyzeBankFees,
  calculateCashflowSafetyMetrics,
  calculateMicroUpiAndHeatmap,
  calculateTaxAndCaSummary,
  generateTallyDoubleEntryCsv,
  buildWhatsAppUpiSettleLink,
  applyCustomUpiRules,
  deduplicateTransactions,
  redactSensitiveText,
} from './statementParser';
import { BOI_OCT_2026_CSV, TANMAY_BOI_STATEMENT_CSV } from './sampleStatements';

test('parseBankNarration extracts UPI sender/receiver name, UPI ID, bank code, and remarks from BOI format', () => {
  const debitNarration = 'UPI/DR/627719283746/RAHUL SHARMA/SBIN/rahul.sharma@oksbi/Weekend Goa Flight Advance';
  const parsedDebit = parseBankNarration(debitNarration, 'DEBIT');

  assert.equal(parsedDebit.channel, 'UPI');
  assert.equal(parsedDebit.counterparty, 'Rahul Sharma');
  assert.equal(parsedDebit.upiId, 'rahul.sharma@oksbi');
  assert.equal(parsedDebit.bankCode, 'SBIN');
  assert.equal(parsedDebit.referenceNo, '627719283746');
  assert.equal(parsedDebit.isPerson, true);
  assert.equal(parsedDebit.inferredTag, '#GoaTrip');

  const positionalNarration = 'UPI/110920995972/DR/Swapni/SBIN/swapnilkh/na';
  const parsedPositional = parseBankNarration(positionalNarration, 'DEBIT');
  assert.equal(parsedPositional.counterparty, 'Swapni');
  assert.equal(parsedPositional.bankCode, 'SBIN');
  assert.equal(parsedPositional.upiId, 'swapnilkh@sbin');
  assert.equal(parsedPositional.referenceNo, '110920995972');
  assert.equal(parsedPositional.isPerson, true);
});

test('parseBankNarration auto-categorizes merchants, self-transfers, and recurring subscriptions accurately', () => {
  const swiggy = parseBankNarration('UPI/DR/627912345678/SWIGGY INDIA/YESB/swiggy@yespay/Dinner Order', 'DEBIT');
  assert.equal(swiggy.counterparty, 'Swiggy');
  assert.equal(swiggy.category, 'Food & Dining');
  assert.equal(swiggy.isPerson, false);

  const flipkart = parseBankNarration('UPI/192255012798/DR/FLIPKA/HDFC/flipkart./UPIInt', 'DEBIT');
  assert.equal(flipkart.counterparty, 'Flipkart');
  assert.equal(flipkart.category, 'Shopping');
  assert.equal(flipkart.isPerson, false);

  const amazonSub = parseBankNarration('UPI/628470597676/DR/Amazon/RATN/amazonpay/Subscr', 'DEBIT');
  assert.equal(amazonSub.counterparty, 'Amazon India');
  assert.equal(amazonSub.category, 'Subscriptions');
  assert.equal(amazonSub.isRecurring, true);

  const selfTransfer = parseBankNarration('UPI/227598761588/CR/TANMAY/BKID/pradiploh/NO REM', 'CREDIT');
  assert.equal(selfTransfer.isSelfTransfer, true);
});

test('normalizeBankDate handles DD-MM-YYYY, DD-MMM-YYYY, and YYYY-MM-DD', () => {
  assert.equal(normalizeBankDate('04-10-2026'), '2026-10-04');
  assert.equal(normalizeBankDate('15/Oct/2026'), '2026-10-15');
  assert.equal(normalizeBankDate('2026-09-22'), '2026-09-22');
});

test('parsePdfStatementWithMeta extracts all 62 rows and account metadata from user BOI PDF statement', async () => {
  const fileBuf = fs.readFileSync('public/assets/aistudio/unlocked_b9c97e4d.pdf');
  const arrayBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);

  const { transactions, meta } = await parsePdfStatementWithMeta(arrayBuffer);

  assert.equal(transactions.length, 62);
  assert.equal(meta.accountHolder, 'TANMAY PRADIP LOHAKAR');
  assert.equal(meta.accountNumber, '875510110008696');
  assert.equal(meta.ifsc, 'BKID0008755');
  assert.equal(meta.branchName, 'BESA');
  assert.equal(meta.periodLabel, '15-09-2026 to 15-10-2026');

  // Row 1: Swapni 35.00 Debit, closing balance 3812.39
  assert.equal(transactions[0].counterparty, 'Swapni');
  assert.equal(transactions[0].type, 'DEBIT');
  assert.equal(transactions[0].amount, 35);
  assert.equal(transactions[0].balance, 3812.39);

  // Row 30: 976932 reconciled with Arun K via shared handle 976932746@ucba
  assert.equal(transactions[29].counterparty, 'Arun K');
  assert.equal(transactions[29].amount, 2950);

  // Row 62: Mrs Va 15.00 Debit, balance 609.28
  assert.equal(transactions[61].counterparty, 'Mrs Va');
  assert.equal(transactions[61].amount, 15);
  assert.equal(transactions[61].balance, 609.28);
});

test('reconcileMerchantRefunds, calculateCashflowSafetyMetrics, and calculateMicroUpiAndHeatmap work on Tanmay BOI statement', () => {
  const txns = parseStatementText(TANMAY_BOI_STATEMENT_CSV);
  const refunds = reconcileMerchantRefunds(txns);
  assert.ok(refunds.length >= 2);
  assert.ok(refunds.some((r) => r.merchant === 'Amazon India' && r.refundAmount === 329));

  const subs = detectRecurringSubscriptions(txns);
  const safety = calculateCashflowSafetyMetrics(txns, subs);
  assert.equal(safety.closingBalance, 3812.39);
  assert.ok(safety.dailyDiscretionaryBurn > 0);
  assert.ok(safety.daysUntilZero > 0);

  const micro = calculateMicroUpiAndHeatmap(txns);
  assert.ok(micro.microCount > 10);
  assert.equal(micro.dayOfWeekTotals.length, 7);
});

test('WhatsApp UPI deep link, Tally CSV export, RRN deduplication, custom rules, and PII redaction work', () => {
  const txns = parseStatementText(TANMAY_BOI_STATEMENT_CSV);

  // Deduplication by 12-digit RRN prevents duplicates when merging same statement
  const { merged, duplicateCount } = deduplicateTransactions(txns, txns);
  assert.equal(merged.length, txns.length);
  assert.equal(duplicateCount, txns.length);

  // Custom UPI rule renames paytm-513
  const ruled = applyCustomUpiRules(txns, [
    {
      id: 'r1',
      pattern: 'paytm-513',
      renameTo: 'Verified Canteen',
      category: 'Food & Dining',
    },
  ]);
  assert.ok(ruled.some((t) => t.counterparty === 'Verified Canteen'));

  // WhatsApp UPI link
  const wa = buildWhatsAppUpiSettleLink({
    contactName: 'Kastur',
    owedAmount: 1650,
    receiverVpa: 'pradiploh@bkid',
    receiverName: 'Tanmay Lohakar',
    recentTxns: txns.slice(0, 2),
  });
  assert.ok(wa.upiDeepLink.startsWith('upi://pay?pa=pradiploh%40bkid'));
  assert.ok(wa.upiDeepLink.includes('am=1650'));

  // Tally CSV export
  const tallyCsv = generateTallyDoubleEntryCsv(txns);
  assert.ok(tallyCsv.includes('Voucher Type'));
  assert.ok(tallyCsv.includes('Contra'));

  // Tax & 80TTA summary
  const tax = calculateTaxAndCaSummary(txns);
  assert.equal(tax.section80TTALimit, 10000);

  // PII Redaction
  assert.equal(redactSensitiveText('swapnilkh@sbin', true), 'sw••••@sbin');
  assert.equal(redactSensitiveText('875510110008696', true), '••••8696');
});

test('calculatePersonLedger and calculateBudgetStatuses compute accurate totals', () => {
  const txns = parseStatementText(BOI_OCT_2026_CSV);
  const ledger = calculatePersonLedger(txns);

  const rahul = ledger.find((p) => p.counterparty === 'Rahul Sharma');
  assert.ok(rahul);
  assert.equal(rahul.totalSent, 6400);
  assert.equal(rahul.totalReceived, 3900);
  assert.equal(rahul.netBalance, -2500);

  const budgets = calculateBudgetStatuses(txns, [
    { category: 'Shopping', monthlyLimit: 5000, alertThresholdPercent: 80 },
    { category: 'Food & Dining', monthlyLimit: 3200, alertThresholdPercent: 80 },
  ]);
  assert.equal(budgets[0].status, 'Over Budget');
  assert.equal(budgets[1].status, 'Over Budget');

  const subs = detectRecurringSubscriptions(txns);
  assert.ok(subs.some((s) => s.merchant === 'Netflix' && s.amount === 649));
});

test('analyzeBankFees accurately scans narrations for AMC, SMS Alert, Penalty, and MAB fees', () => {
  const feeSampleCsv = `Date,Narration,Debit,Credit,Balance
15-10-2026,BOI/MAB NON MAINT CHGS SEP26/INCL GST,147.50,0.00,3664.89
14-10-2026,BOI/DEBIT CARD AMC FY26-27/RUPAY PLATINUM,236.00,0.00,3812.39
12-10-2026,BOI/SMS ALERT CHGS Q2 FY26-27/INCL GST,17.70,0.00,4048.39
10-10-2026,BOI/NACH MANDATE RETURN PENALTY CHG,295.00,0.00,4066.09`;

  const parsedFeeTxns = parseStatementText(feeSampleCsv);
  assert.equal(parsedFeeTxns.length, 4);
  assert.ok(parsedFeeTxns.every((t) => t.category === 'Bank Charges & Fees'));

  const analysis = analyzeBankFees(parsedFeeTxns);
  assert.equal(analysis.feeCount, 4);
  assert.equal(analysis.totalFees, 696.2);

  const mabBucket = analysis.breakdownByType.find((b) => b.feeCode === 'MAB');
  const amcBucket = analysis.breakdownByType.find((b) => b.feeCode === 'AMC');
  const smsBucket = analysis.breakdownByType.find((b) => b.feeCode === 'SMS_ALERT');
  const penaltyBucket = analysis.breakdownByType.find((b) => b.feeCode === 'PENALTY');

  assert.equal(mabBucket?.amount, 147.5);
  assert.equal(amcBucket?.amount, 236);
  assert.equal(smsBucket?.amount, 17.7);
  assert.equal(penaltyBucket?.amount, 295);
});

