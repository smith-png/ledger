import React, { useState, useMemo } from 'react';
import {
  Download,
  Briefcase,
  Landmark,
  Hash,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Transaction,
  CategoryName,
  BudgetStatus,
  DetectedSubscription,
  calculateTaxAndCaSummary,
  generateTallyDoubleEntryCsv,
  formatINR,
} from '../utils/statementParser';
import { BudgetsView } from './BudgetsView';
import { SubscriptionsView } from './SubscriptionsView';

interface TaxAndCaViewProps {
  transactions: Transaction[];
  budgetStatuses: BudgetStatus[];
  subscriptions: DetectedSubscription[];
  onUpdateBudgetLimit: (category: CategoryName, newLimit: number) => void;
  onSelectCategoryTransactions: (cat: CategoryName) => void;
  onToggleBusinessFlag: (txnId: string) => void;
  onUpdateEventTag: (txnId: string, eventTag: string | undefined) => void;
  onAddTransaction: (txn: Transaction) => void;
}

export const TaxAndCaView: React.FC<TaxAndCaViewProps> = ({
  transactions,
  budgetStatuses,
  subscriptions,
  onUpdateBudgetLimit,
  onSelectCategoryTransactions,
  onToggleBusinessFlag,
  onUpdateEventTag,
  onAddTransaction,
}) => {
  const [subTab, setSubTab] = useState<'ca-tax' | 'budgets' | 'subscriptions'>('ca-tax');
  const [selectedEventTagFilter, setSelectedEventTagFilter] = useState<string>('ALL');

  const taxSummary = useMemo(() => calculateTaxAndCaSummary(transactions), [transactions]);

  const personalExpenseTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'DEBIT' && !t.isBusiness && !t.isSelfTransfer)
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const handleExportTallyCsv = () => {
    const csv = generateTallyDoubleEntryCsv(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ArthaLedger_CA_Tally_DoubleEntry_Export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateSavingsInterest = () => {
    const interestTxn: Transaction = {
      id: `boi-int-${Date.now()}`,
      date: '2026-09-30',
      rawNarration: 'BOI/SB INT.PD:01-07-2026 TO 30-09-2026/875510110008696',
      counterparty: 'BOI Quarterly Savings Interest',
      upiId: null,
      bankCode: 'BKID',
      referenceNo: 'INT2026Q2',
      remarks: 'Section 80TTA Savings Interest',
      channel: 'BANK',
      type: 'CREDIT',
      amount: 1425,
      category: 'Savings Interest',
      isPerson: false,
    };
    onAddTransaction(interestTxn);
  };

  const eventTagTransactions = useMemo(() => {
    if (selectedEventTagFilter === 'ALL') {
      return transactions.filter((t) => Boolean(t.eventTag));
    }
    return transactions.filter((t) => t.eventTag === selectedEventTagFilter);
  }, [transactions, selectedEventTagFilter]);

  const remaining80TTA = Math.max(0, taxSummary.section80TTALimit - taxSummary.savingsInterestTotal);

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar switching between CA/Tax & Tally Export, Monthly Budgets, and Recurring Mandates */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('ca-tax')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'ca-tax'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            CA, Tax (80TTA), Event Tags & Tally Export
          </button>
          <button
            type="button"
            onClick={() => setSubTab('budgets')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'budgets'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Category Budgets ({budgetStatuses.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('subscriptions')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'subscriptions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Subscriptions & Mandates ({subscriptions.length})
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportTallyCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> 1-Click CA / Tally Double-Entry CSV
        </button>
      </div>

      {subTab === 'budgets' && (
        <BudgetsView
          budgetStatuses={budgetStatuses}
          onUpdateBudgetLimit={onUpdateBudgetLimit}
          onSelectCategoryTransactions={onSelectCategoryTransactions}
        />
      )}

      {subTab === 'subscriptions' && <SubscriptionsView subscriptions={subscriptions} />}

      {subTab === 'ca-tax' && (
        <div className="space-y-6">
          {/* 4-Card Tax, Business & Event Tag KPI Strip */}
          <section aria-label="Tax and CA Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sec 80TTA Savings Interest</span>
                <Landmark className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {formatINR(taxSummary.savingsInterestTotal)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                {formatINR(remaining80TTA)} tax-free limit remaining (of ₹10,000)
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Business / GST Outflows</span>
                <Briefcase className="h-4 w-4 text-slate-700" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatINR(taxSummary.businessExpense)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                {taxSummary.businessTransactions.length} business ledger entries
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Personal Outflows</span>
                <span className="font-mono">Non-GST</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatINR(personalExpenseTotal)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                Separated from freelance/business ledger
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Active Event / Trip Tags</span>
                <Hash className="h-4 w-4 text-slate-700" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {taxSummary.eventTagTotals.length}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                Cross-category project & trip cost centers
              </div>
            </div>
          </section>

          {/* 2-Column Split: Section 80TTA Tracker & Event/Trip Cost Centers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Section 80TTA Savings Interest Tracker (5 cols) */}
            <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Section 80TTA Savings Interest Tracker
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tracks quarterly interest credited by Bank of India against the ₹10,000 annual ITR deduction threshold.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateSavingsInterest}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Log Q2 BOI Interest
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-600">Interest Credited FY 2026-27</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(taxSummary.savingsInterestTotal)} / {formatINR(10000)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      taxSummary.section80TTATaxableExcess > 0 ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(2, Math.round((taxSummary.savingsInterestTotal / 10000) * 100)))}%`,
                    }}
                  />
                </div>
              </div>

              {taxSummary.section80TTATaxableExcess > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Annual savings interest exceeds ₹10,000. The excess{' '}
                    <strong className="font-mono">{formatINR(taxSummary.section80TTATaxableExcess)}</strong> is taxable under "Income from Other Sources" in your ITR.
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    100% of your detected BOI savings interest ({formatINR(taxSummary.savingsInterestTotal)}) is tax-exempt under Section 80TTA.
                  </span>
                </div>
              )}
            </section>

            {/* Event / Trip Tag Cost Tracker (7 cols) */}
            <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Event, Trip & Project Tagging (#GoaTrip, #FestiveShopping, #ExamPrep)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregates cross-category transactions tagged with a shared hashtag
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedEventTagFilter('ALL')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedEventTagFilter === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Tagged ({eventTagTransactions.length})
                  </button>
                  {taxSummary.eventTagTotals.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => setSelectedEventTagFilter(item.tag)}
                      className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                        selectedEventTagFilter === item.tag
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item.tag} ({formatINR(item.spent > 0 ? item.spent : item.received)})
                    </button>
                  ))}
                </div>
              </div>

              {taxSummary.eventTagTotals.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No transactions have event tags yet. Assign tags like #GoaTrip or #Diwali in the table below.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {taxSummary.eventTagTotals.map((item) => (
                    <div
                      key={item.tag}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1"
                    >
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {item.tag}
                      </div>
                      <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                        {item.spent > 0
                          ? formatINR(item.spent)
                          : `+${formatINR(item.received)}`}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Business vs. Personal Expense Separator & Tally Ledger Preview */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Business vs. Personal Expense Separator & Event Tag Editor
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle any debit/credit as "Business / GST" or assign an Event Tag before exporting to your Chartered Accountant's Tally CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportTallyCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> Export Tally Voucher CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-4">Counterparty & RRN</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Event / Trip Tag</th>
                    <th className="py-3 px-4">Tax Classification</th>
                    <th className="py-3 px-6 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {transactions.slice(0, 20).map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {txn.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{txn.counterparty}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {txn.referenceNo ? `RRN ${txn.referenceNo}` : txn.channel}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {txn.category}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Event tag for ${txn.counterparty}`}
                          value={txn.eventTag || ''}
                          onChange={(e) =>
                            onUpdateEventTag(txn.id, e.target.value ? e.target.value : undefined)
                          }
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-slate-900 focus:outline-none"
                        >
                          <option value="">No Tag</option>
                          <option value="#ExamPrep">#ExamPrep</option>
                          <option value="#FestiveShopping">#FestiveShopping</option>
                          <option value="#GoaTrip">#GoaTrip</option>
                          <option value="#Diwali">#Diwali</option>
                          <option value="#HouseShifting">#HouseShifting</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onToggleBusinessFlag(txn.id)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            txn.isBusiness
                              ? 'border-blue-300 bg-blue-50 text-blue-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {txn.isBusiness ? 'Business / GST' : 'Personal'}
                        </button>
                      </td>
                      <td
                        className={`py-3 px-6 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                          txn.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {txn.type === 'CREDIT' ? '+' : '-'}
                        {formatINR(txn.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
