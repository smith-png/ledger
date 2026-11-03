import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardMetrics,
  calculatePeopleProfiles,
  calculatePeriodComparison,
  filterTransactionsByPeriod,
  formatINRPaise,
  fromPaise,
  previewClassificationRule,
  queryLocalFinancialAssistant,
  resolveStartupReportingPeriod,
  runDataQualityAndAnomalyChecks,
  toPaise,
} from './financeEngine';
import {
  createEmptyDatabaseSnapshot,
  mergeSnapshots,
  validateBackupJson,
} from './db';
import {
  commitImportPreviewToSnapshot,
  prepareStatementImportPreview,
  rollbackStatementImport,
} from './importEngine';
import { TransactionRecord } from '../types/finance';

function makeTx(overrides: Partial<TransactionRecord>): TransactionRecord {
  const now = '2026-04-15T10:00:00.000Z';
  return {
    id: overrides.id || 'tx-1',
    date: overrides.date || '2026-04-15',
    amountPaise: overrides.amountPaise ?? 10000,
    direction: overrides.direction || 'DEBIT',
    transactionType: overrides.transactionType || 'EXPENSE',
    category: overrides.category || 'Food & Dining',
    subCategory: overrides.subCategory || 'General',
    counterpartyName: overrides.counterpartyName || 'Swiggy',
    upiId: overrides.upiId || 'swiggy@icici',
    referenceNumber: overrides.referenceNumber || '610512345678',
    paymentMode: overrides.paymentMode || 'UPI',
    accountId: overrides.accountId || 'acc-default-primary',
    rawDescription: overrides.rawDescription || 'UPI/DR/610512345678/SWIGGY/ICIC/swiggy@icici/UPI',
    userNotes: overrides.userNotes || '',
    tags: overrides.tags || [],
    runningBalancePaise:
      overrides.runningBalancePaise !== undefined ? overrides.runningBalancePaise : 500000,
    confidenceScore: overrides.confidenceScore ?? 95,
    isEdited: overrides.isEdited ?? false,
    isSplitParent: overrides.isSplitParent ?? false,
    isFlaggedAnomaly: overrides.isFlaggedAnomaly ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('My Transactions — Financial Calculation & Import Engine Unit Tests', () => {
  it('1. starts with an empty database snapshot with 0 transactions and ₹0.00 opening balance', () => {
    const empty = createEmptyDatabaseSnapshot();
    assert.equal(empty.transactions.length, 0);
    assert.equal(empty.statements.length, 0);
    assert.equal(empty.accounts[0].openingBalancePaise, 0);

    const period = resolveStartupReportingPeriod(empty.transactions);
    const metrics = calculateDashboardMetrics(
      empty.transactions,
      empty.transactions,
      empty.accounts,
      empty.budgets,
      empty.commitments,
      period
    );
    assert.equal(metrics.totalCreditPaise, 0);
    assert.equal(metrics.totalDebitPaise, 0);
    assert.equal(metrics.netCashFlowPaise, 0);
    assert.equal(metrics.transactionCount, 0);
    assert.equal(metrics.savingsRateStatus, 'NO_IDENTIFIED_INCOME');
    assert.equal(metrics.estimatedSavingsRatePercent, null);
  });

  it('2. converts rupees to integer paise without floating-point precision drift', () => {
    // Classic IEEE 754 float trap: 19.99 * 100 or 0.1 + 0.2
    const p1 = toPaise(19.99);
    const p2 = toPaise(0.1) + toPaise(0.2);
    assert.equal(p1, 1999);
    assert.equal(p2, 30);
    assert.equal(fromPaise(p2), 0.3);
    assert.equal(formatINRPaise(12500000), '₹1,25,000.00');
  });

  it('3. excludes internal transfers from Identified Income and Identified Expenses', () => {
    const empty = createEmptyDatabaseSnapshot();
    const txs: TransactionRecord[] = [
      makeTx({
        id: 't1',
        date: '2026-04-05',
        direction: 'CREDIT',
        transactionType: 'INCOME',
        category: 'Salary',
        amountPaise: 5000000, // ₹50,000.00
      }),
      makeTx({
        id: 't2',
        date: '2026-04-06',
        direction: 'DEBIT',
        transactionType: 'EXPENSE',
        category: 'Food & Dining',
        amountPaise: 1500000, // ₹15,000.00
      }),
      makeTx({
        id: 't3',
        date: '2026-04-07',
        direction: 'DEBIT',
        transactionType: 'INTERNAL_TRANSFER',
        category: 'Self Transfer',
        amountPaise: 1000000, // ₹10,000.00 internal transfer out
      }),
      makeTx({
        id: 't4',
        date: '2026-04-07',
        direction: 'CREDIT',
        transactionType: 'INTERNAL_TRANSFER',
        category: 'Self Transfer',
        amountPaise: 1000000, // ₹10,000.00 internal transfer in
      }),
    ];

    const period = resolveStartupReportingPeriod(txs);
    const metrics = calculateDashboardMetrics(
      txs,
      txs,
      empty.accounts,
      empty.budgets,
      empty.commitments,
      period
    );

    // Total raw credits/debits include everything
    assert.equal(metrics.totalCreditPaise, 6000000);
    assert.equal(metrics.totalDebitPaise, 2500000);
    // Identified Income & Expenses strictly exclude INTERNAL_TRANSFER
    assert.equal(metrics.identifiedIncomePaise, 5000000);
    assert.equal(metrics.identifiedExpensesPaise, 1500000);
    assert.equal(metrics.internalTransfersInPaise, 1000000);
    assert.equal(metrics.internalTransfersOutPaise, 1000000);
    // Savings Rate = (50,000 - 15,000) / 50,000 = 70%
    assert.equal(metrics.savingsRateStatus, 'AVAILABLE');
    assert.equal(metrics.estimatedSavingsRatePercent, 70);
  });

  it('4. does not falsely infer debt from netExchangedPaise unless an ExplicitLoanSettlementRecord exists', () => {
    const txs: TransactionRecord[] = [
      makeTx({
        id: 'p1',
        counterpartyName: 'Aryan',
        direction: 'DEBIT',
        amountPaise: 85000, // Sent ₹850 to Aryan
      }),
    ];
    const profilesWithoutLoan = calculatePeopleProfiles(txs, [], []);
    assert.equal(profilesWithoutLoan.length, 1);
    assert.equal(profilesWithoutLoan[0].totalSentToPersonPaise, 85000);
    assert.equal(profilesWithoutLoan[0].netExchangedPaise, -85000);
    // Explicit receivable must remain 0 unless an explicit loan record exists
    assert.equal(profilesWithoutLoan[0].explicitReceivablePaise, 0);

    const profilesWithLoan = calculatePeopleProfiles(
      txs,
      [],
      [
        {
          id: 'loan-1',
          personId: 'Aryan',
          personName: 'Aryan',
          type: 'LENT_RECEIVABLE',
          principalAmountPaise: 85000,
          settledAmountPaise: 0,
          remainingAmountPaise: 85000,
          status: 'OPEN',
          issueDate: '2026-04-15',
          linkedTransactionIds: ['p1'],
          notes: 'Dinner split',
          createdAt: '2026-04-15T00:00:00Z',
        },
      ]
    );
    assert.equal(profilesWithLoan[0].explicitReceivablePaise, 85000);
  });

  it('5. prepares CSV import preview keeping valid, duplicate, and invalid rows transparent, then commits and rolls back', async () => {
    const empty = createEmptyDatabaseSnapshot();
    const csvText = [
      'Txn Date,Narration,Debit,Credit,Balance',
      '2026-04-10,UPI/DR/610011/SWIGGY/ICIC/swiggy@icici/UPI,250.00,,4750.00',
      '2026-04-10,UPI/DR/610011/SWIGGY/ICIC/swiggy@icici/UPI,250.00,,4750.00', // Duplicate in file
      'INVALID_DATE,Broken Row,0,,4750.00', // Invalid row
      '2026-04-12,UPI/CR/610099/ARYAN/BKID/aryan@okaxis/UPI,,1000.00,5750.00',
    ].join('\n');

    const preview = await prepareStatementImportPreview(
      {
        fileName: 'april_boi.csv',
        fileSizeBytes: csvText.length,
        rawText: csvText,
      },
      empty.transactions,
      empty.statements
    );

    assert.equal(preview.candidates.length, 4);
    const validSelected = preview.candidates.filter((c) => c.isValid && c.selectedForImport);
    const duplicates = preview.candidates.filter((c) => c.isDuplicate);
    const invalid = preview.candidates.filter((c) => !c.isValid);

    assert.equal(validSelected.length, 2);
    assert.equal(duplicates.length, 1);
    assert.equal(invalid.length, 1);

    // Commit preview
    const { updatedSnapshot, importedStatement } = commitImportPreviewToSnapshot(
      empty,
      preview,
      empty.accounts[0].id
    );
    assert.equal(updatedSnapshot.transactions.length, 2);
    assert.equal(updatedSnapshot.statements.length, 1);

    // Rollback import
    const rolledBack = rollbackStatementImport(updatedSnapshot, importedStatement.id, true);
    assert.equal(rolledBack.transactions.length, 0);
    assert.equal(rolledBack.statements.length, 0);
  });

  it('6. validates JSON backups and safely merges without duplicating existing IDs', () => {
    const snapA = createEmptyDatabaseSnapshot();
    snapA.transactions.push(makeTx({ id: 'tx-shared', amountPaise: 50000 }));

    const snapB = createEmptyDatabaseSnapshot();
    snapB.transactions.push(makeTx({ id: 'tx-shared', amountPaise: 50000 }));
    snapB.transactions.push(makeTx({ id: 'tx-new', amountPaise: 90000 }));

    const check = validateBackupJson(JSON.stringify(snapB));
    assert.equal(check.valid, true);

    const merged = mergeSnapshots(snapA, snapB);
    assert.equal(merged.transactions.length, 2);
  });

  it('7. answers natural-language queries locally via queryLocalFinancialAssistant', () => {
    const txs: TransactionRecord[] = [
      makeTx({
        id: 'a1',
        counterpartyName: 'Swiggy',
        category: 'Food & Dining',
        direction: 'DEBIT',
        amountPaise: 45000,
      }),
      makeTx({
        id: 'a2',
        counterpartyName: 'Aryan',
        category: 'Personal Transfers',
        direction: 'CREDIT',
        transactionType: 'INCOME',
        amountPaise: 120000,
      }),
    ];

    const resWhere = queryLocalFinancialAssistant('Where did my money go?', txs, []);
    assert.ok(resWhere.answerText.includes('Food & Dining'));

    const resLargest = queryLocalFinancialAssistant('Show largest expense', txs, []);
    assert.equal(resLargest.computedSumPaise, 45000);
  });
});
