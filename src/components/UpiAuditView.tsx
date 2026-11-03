import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Transaction,
  CategoryName,
  ALL_CATEGORIES,
  CustomUpiRule,
  reconcileMerchantRefunds,
  detectBankCharges,
  formatINR,
  redactSensitiveText,
} from '../utils/statementParser';
import { BankFeesSummaryCard } from './BankFeesSummaryCard';

interface UpiAuditViewProps {
  transactions: Transaction[];
  customRules: CustomUpiRule[];
  isRedacted: boolean;
  onToggleRefundExpected: (txnId: string) => void;
  onAddTransaction: (txn: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onAddCustomRule: (rule: CustomUpiRule) => void;
  onDeleteCustomRule: (ruleId: string) => void;
}

export const UpiAuditView: React.FC<UpiAuditViewProps> = ({
  transactions,
  customRules,
  isRedacted,
  onToggleRefundExpected,
  onAddTransaction,
  onDeleteTransaction,
  onAddCustomRule,
  onDeleteCustomRule,
}) => {
  const refundItems = useMemo(() => reconcileMerchantRefunds(transactions), [transactions]);
  const bankCharges = useMemo(() => detectBankCharges(transactions), [transactions]);

  const matchedRefunds = refundItems.filter(
    (r) => r.status === 'MATCHED_FULL' || r.status === 'MATCHED_PARTIAL' || r.status === 'REFUND_CREDITED'
  );
  const pendingRefunds = refundItems.filter((r) => r.status === 'PENDING_REFUND');
  const totalRefundedAmount = matchedRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
  const totalPendingAmount = pendingRefunds.reduce(
    (sum, r) => sum + (r.originalDebitAmount || 0),
    0
  );
  const totalBankCharges = bankCharges.reduce((sum, c) => sum + c.txn.amount, 0);

  // Also list recent e-commerce/travel debits so user can flag any debit as "Refund Expected"
  const auditableDebits = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === 'DEBIT' &&
          (['Shopping', 'Food & Dining', 'Travel & Commute', 'Bills & Utilities'].includes(
            t.category
          ) ||
            Boolean(t.refundExpected))
      ),
    [transactions]
  );

  // Rule Engine form state
  const [keyword, setKeyword] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [ruleCategory, setRuleCategory] = useState<CategoryName>('Food & Dining');
  const [markBusiness, setMarkBusiness] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError(null);
    const trimmedKey = keyword.trim();
    const trimmedName = renameTo.trim();
    if (!trimmedKey || !trimmedName) {
      setRuleError('Enter both a narration/VPA keyword and a clean counterparty name.');
      return;
    }

    const newRule: CustomUpiRule = {
      id: `rule-${Date.now()}`,
      pattern: trimmedKey,
      renameTo: trimmedName,
      category: ruleCategory,
      markAsBusiness: markBusiness,
    };
    onAddCustomRule(newRule);
    setKeyword('');
    setRenameTo('');
    setMarkBusiness(false);
  };

  const handleSimulateBankFee = () => {
    const feeTxn: Transaction = {
      id: `boi-fee-${Date.now()}`,
      date: '2026-10-15',
      rawNarration: 'BOI/SMS ALERT CHGS Q2 FY26-27/INCL GST',
      counterparty: 'Bank of India Charges',
      upiId: null,
      bankCode: 'BKID',
      referenceNo: 'BOISMS2026Q2',
      remarks: 'Quarterly SMS Alert Fee',
      channel: 'BANK',
      type: 'DEBIT',
      amount: 17.7,
      category: 'Bank Charges & Fees',
      isPerson: false,
    };
    onAddTransaction(feeTxn);
  };

  return (
    <div className="space-y-6">
      {/* Top 4-Card Audit KPI Strip */}
      <section aria-label="UPI Audit Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Verified Refunds Credited</span>
            <RotateCcw className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            +{formatINR(totalRefundedAmount)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {matchedRefunds.length} matched reversal {matchedRefunds.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending / Expected Refunds</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatINR(totalPendingAmount)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {pendingRefunds.length} flagged {pendingRefunds.length === 1 ? 'debit' : 'debits'} awaiting credit
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Silent Bank Charges & Fines</span>
            <ShieldAlert className="h-4 w-4 text-slate-700" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(totalBankCharges)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {bankCharges.length} BOI fee {bankCharges.length === 1 ? 'deduction' : 'deductions'} detected
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Custom UPI Mapping Rules</span>
            <Sliders className="h-4 w-4 text-slate-700" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {customRules.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Retroactive VPA & merchant auto-rules
          </div>
        </div>
      </section>

      {/* Section 1: Failed / Return Refund Tracker */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Failed / Return Refund Tracker (E-Commerce, Food & IRCTC)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Matches merchant credits against earlier debits (e.g., Amazon, Flipkart, Google Play, One97, IRCTC). Flag any failed order below as "Refund Expected" to track uncredited money.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {refundItems.length} reconciled reversals · {auditableDebits.length} merchant debits
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Merchant & UPI RRN</th>
                <th className="py-3 px-4 text-right">Original Debit</th>
                <th className="py-3 px-4 text-right">Refund Credited</th>
                <th className="py-3 px-4">Reconciliation Status</th>
                <th className="py-3 px-6 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {refundItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-6 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {item.creditTxn?.date || item.debitTxn?.date}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">
                      {redactSensitiveText(item.merchant, isRedacted)}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {item.creditTxn?.referenceNo
                        ? `Credit RRN ${item.creditTxn.referenceNo}`
                        : item.debitTxn?.referenceNo
                        ? `Debit RRN ${item.debitTxn.referenceNo}`
                        : 'UPI Reversal'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                    {item.originalDebitAmount ? `-${formatINR(item.originalDebitAmount)}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                    {item.refundAmount > 0 ? `+${formatINR(item.refundAmount)}` : '₹0'}
                  </td>
                  <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                    {item.status === 'MATCHED_FULL' && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 100% Refunded ({item.daysTaken}d)
                      </span>
                    )}
                    {item.status === 'MATCHED_PARTIAL' && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Partial / Item Refund ({item.daysTaken}d)
                      </span>
                    )}
                    {item.status === 'REFUND_CREDITED' && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Merchant Reversal Credited
                      </span>
                    )}
                    {item.status === 'PENDING_REFUND' && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> Refund Expected (Uncredited)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    {item.debitTxn ? (
                      <button
                        type="button"
                        onClick={() => onToggleRefundExpected(item.debitTxn!.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {item.debitTxn.refundExpected ? 'Clear Flag' : 'Flag Issue'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Verified</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Additional Merchant Debits that can be flagged as Refund Expected */}
              {auditableDebits.slice(0, 6).map((debit) => (
                <tr key={`audit-${debit.id}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-6 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {debit.date}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">
                      {redactSensitiveText(debit.counterparty, isRedacted)}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {debit.referenceNo ? `Debit RRN ${debit.referenceNo}` : debit.channel}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    -{formatINR(debit.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    —
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {debit.refundExpected ? (
                      <span className="font-semibold text-amber-700">Awaiting Merchant Refund</span>
                    ) : (
                      <span>Completed Debit</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onToggleRefundExpected(debit.id)}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        debit.refundExpected
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {debit.refundExpected ? 'Clear Expected Flag' : 'Mark Refund Expected'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dedicated Bank Fees & Silent Charges Analyzer Summary Card */}
      <BankFeesSummaryCard
        transactions={transactions}
        isRedacted={isRedacted}
        onAddTransaction={onAddTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />

      {/* Custom UPI Rule Engine */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Custom UPI Rule Engine (Smart Narration & Handle Mapper)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically rename cryptic merchant handles (like <span className="font-mono">Q06684434@axl</span> or truncated BOI 6-character names) and assign categories across all past and future uploads.
            </p>
          </div>

          <form onSubmit={handleCreateRule} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800">
              Create New Auto-Categorization & Rename Rule
            </div>

            {ruleError && (
              <div role="alert" className="text-xs font-medium text-red-600">
                {ruleError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="rule-keyword" className="block text-xs text-slate-600 mb-1">
                  If Narration / VPA Contains
                </label>
                <input
                  id="rule-keyword"
                  type="text"
                  placeholder="e.g. Swapni or Q06684434"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rule-rename" className="block text-xs text-slate-600 mb-1">
                  Rename Counterparty To
                </label>
                <input
                  id="rule-rename"
                  type="text"
                  placeholder="e.g. Swapnil Tea & Snacks"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rule-category" className="block text-xs text-slate-600 mb-1">
                  Assign Category
                </label>
                <select
                  id="rule-category"
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value as CategoryName)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markBusiness}
                  onChange={(e) => setMarkBusiness(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Also flag matching transactions as Business / GST Expense</span>
              </label>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Apply Rule to Statement
              </button>
            </div>
          </form>

          {/* Active Rules List */}
          <div className="divide-y divide-slate-100">
            {customRules.map((rule) => {
              const matchCount = transactions.filter(
                (t) =>
                  t.rawNarration.toLowerCase().includes(rule.pattern.toLowerCase()) ||
                  t.counterparty.toLowerCase().includes(rule.pattern.toLowerCase()) ||
                  (t.upiId || '').toLowerCase().includes(rule.pattern.toLowerCase())
              ).length;

              return (
                <div
                  key={rule.id}
                  className="py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-800">
                        "{rule.pattern}"
                      </span>
                      <span aria-hidden="true" className="text-slate-400">→</span>
                      <span className="font-semibold text-slate-900">
                        {rule.renameTo}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-600">{rule.category}</span>
                    </div>
                    <div className="text-slate-500 font-mono tabular-nums">
                      Matched {matchCount} statement {matchCount === 1 ? 'entry' : 'entries'}
                      {rule.markAsBusiness ? ' · Tagged as Business/GST' : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteCustomRule(rule.id)}
                    aria-label={`Delete custom rule ${rule.pattern}`}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
      </section>
    </div>
  );
};
