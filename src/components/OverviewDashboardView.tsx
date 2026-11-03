import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileUp,
  Plus,
} from 'lucide-react';
import {
  DashboardMetrics,
  FullDatabaseSnapshot,
  PeriodComparison,
  ReportingPeriod,
  TransactionRecord,
} from '../types/finance';
import { formatINRPaise, fromPaise } from '../services/financeEngine';
import { BankFeesSummaryCard } from './BankFeesSummaryCard';
import { Transaction } from '../utils/statementParser';

interface OverviewDashboardViewProps {
  snapshot: FullDatabaseSnapshot;
  period: ReportingPeriod;
  periodTransactions: TransactionRecord[];
  metrics: DashboardMetrics;
  comparison: PeriodComparison;
  onOpenImportModal: () => void;
  isLoadingSample: boolean;
  onNavigateTab: (tab: string) => void;
  onSelectCategoryFilter: (category: string) => void;
  onInspectTransaction: (tx: TransactionRecord) => void;
  onOpenAddTransaction: () => void;
}

export const OverviewDashboardView: React.FC<OverviewDashboardViewProps> = ({
  snapshot,
  period,
  periodTransactions,
  metrics,
  comparison,
  onOpenImportModal,
  isLoadingSample,
  onNavigateTab,
  onSelectCategoryFilter,
  onInspectTransaction,
  onOpenAddTransaction,
}) => {
  const isEmptyDatabase = snapshot.transactions.length === 0;
  const [showExtendedMetrics, setShowExtendedMetrics] = useState(!isEmptyDatabase);

  // Sync extended metrics visibility when database transitions from empty to populated
  React.useEffect(() => {
    if (!isEmptyDatabase) {
      setShowExtendedMetrics(true);
    }
  }, [isEmptyDatabase]);

  // Map TransactionRecord[] to legacy Transaction[] for BankFeesSummaryCard compatibility
  const legacyMappedTransactions: Transaction[] = periodTransactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    rawNarration: tx.rawDescription,
    counterparty: tx.counterpartyName,
    upiId: tx.upiId || null,
    bankCode: null,
    referenceNo: tx.referenceNumber || null,
    remarks: tx.userNotes || null,
    channel: (tx.paymentMode === 'CHARGE'
      ? 'BANK'
      : tx.paymentMode === 'NACH'
      ? 'ACH'
      : 'UPI') as Transaction['channel'],
    type: tx.direction,
    amount: fromPaise(tx.amountPaise),
    balance: tx.runningBalancePaise !== null ? fromPaise(tx.runningBalancePaise) : undefined,
    category: (tx.category === 'Bank Charges'
      ? 'Bank Charges & Fees'
      : tx.category) as Transaction['category'],
    isPerson: tx.category === 'Personal Transfers',
    isRecurring: false,
  }));

  const categoryTotals = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of periodTransactions) {
      if (tx.direction === 'DEBIT' && tx.transactionType === 'EXPENSE') {
        map.set(tx.category, (map.get(tx.category) || 0) + tx.amountPaise);
      }
    }
    return Array.from(map.entries())
      .map(([name, amountPaise]) => ({ name, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, 6);
  }, [periodTransactions]);

  return (
    <div className="space-y-8">
      {/* Initial Launch Welcome & Empty State (Single-level container, zero nested cards) */}
      {isEmptyDatabase && (
        <section
          data-testid="empty-launch-banner"
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-sm"
        >
          <div className="max-w-3xl space-y-4">
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
              style={{ textWrap: 'balance' }}
            >
              Welcome to ArthaLedger
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Import a bank statement to get started. Everything stays on this device.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="empty-state-import-btn"
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileUp className="w-4 h-4" />
                <span>Import Bank Statement</span>
              </button>

              <button
                type="button"
                data-testid="empty-state-manual-tx-btn"
                onClick={onOpenAddTransaction}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium text-sm shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Transaction</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Section Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Financial Summary
            </h2>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {period.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.transactionCount} transactions · self-transfers excluded
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExtendedMetrics((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{showExtendedMetrics ? 'Compact View' : 'Show All 13 Metrics'}</span>
            {showExtendedMetrics ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {!isEmptyDatabase && (
            <button
              type="button"
              onClick={onOpenAddTransaction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-2xs hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary 4 Core KPIs in a Modern Card-Based Grid */}
      <section
        aria-label="Primary Financial KPIs"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
      >
        {/* KPI 1: Total Credit */}
        <div
          data-testid="card-total-credit"
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Credit (Inflow)</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {metrics.creditCount} {metrics.creditCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-3 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            {formatINRPaise(metrics.totalCreditPaise)}
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400">
            Gross deposits & credits in period
          </div>
        </div>

        {/* KPI 2: Total Debit */}
        <div
          data-testid="card-total-debit"
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Debit (Outflow)</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {metrics.debitCount} {metrics.debitCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-3 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-rose-600 dark:text-rose-400 whitespace-nowrap">
            {formatINRPaise(metrics.totalDebitPaise)}
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400">
            Gross withdrawals & payments
          </div>
        </div>

        {/* KPI 3: Net Cash Flow */}
        <div
          data-testid="card-net-cashflow"
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Net Cash Flow</span>
            <span className="text-[11px] text-slate-400">Inflow − Outflow</span>
          </div>
          <div
            className={`mt-3 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight whitespace-nowrap ${
              metrics.netCashFlowPaise >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {metrics.netCashFlowPaise > 0 ? '+' : ''}
            {formatINRPaise(metrics.netCashFlowPaise)}
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400">
            Period net balance movement
          </div>
        </div>

        {/* KPI 4: Current Balance & Transaction Count */}
        <div
          data-testid="card-tx-count"
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Current Account Balance</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {metrics.transactionCount} txns
            </span>
          </div>
          <div className="mt-3 text-2xl sm:text-[26px] font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            {formatINRPaise(metrics.currentBalancePaise)}
          </div>
          <div
            className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400 truncate"
            title={metrics.balanceSourceNote}
          >
            {metrics.balanceSourceNote}
          </div>
        </div>
      </section>

      {/* Secondary Accounting & Intelligence Metrics in a Clean Card Grid */}
      {showExtendedMetrics && (
        <section
          aria-label="Extended Accounting Metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Identified Income */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Identified Income
            </div>
            <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              {formatINRPaise(metrics.identifiedIncomePaise)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">Excludes self-transfers</div>
          </div>

          {/* Identified Expenses */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Identified Expenses
            </div>
            <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
              {formatINRPaise(metrics.identifiedExpensesPaise)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">Excludes self-transfers</div>
          </div>

          {/* Internal Transfers */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Internal Transfers
            </div>
            <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
              {formatINRPaise(metrics.internalTransfersInPaise + metrics.internalTransfersOutPaise)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1.5 truncate">
              In {formatINRPaise(metrics.internalTransfersInPaise)} · Out{' '}
              {formatINRPaise(metrics.internalTransfersOutPaise)}
            </div>
          </div>

          {/* Estimated Savings Rate */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Est. Savings Rate
            </div>
            <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              {metrics.savingsRateStatus === 'AVAILABLE' &&
              metrics.estimatedSavingsRatePercent !== null
                ? `${metrics.estimatedSavingsRatePercent.toFixed(1)}%`
                : 'Not Available'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              {metrics.savingsRateStatus === 'AVAILABLE'
                ? '(Income − Expenses) / Income'
                : 'Requires identified income'}
            </div>
          </div>

          {/* Largest Single Expense */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Largest Single Expense
            </div>
            {metrics.largestExpense ? (
              <>
                <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {formatINRPaise(metrics.largestExpense.amountPaise)}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-1.5">
                  {metrics.largestExpense.counterpartyName} · {metrics.largestExpense.date}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-400">None in period</div>
            )}
          </div>

          {/* Highest Spending Category */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Top Expense Category
            </div>
            {metrics.highestSpendingCategory ? (
              <>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {metrics.highestSpendingCategory.category}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
                  {formatINRPaise(metrics.highestSpendingCategory.amountPaise)} (
                  {metrics.highestSpendingCategory.sharePercent.toFixed(1)}%)
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-400">None in period</div>
            )}
          </div>

          {/* Monthly Budget Usage */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Budget Usage
            </div>
            {metrics.budgetUsage.totalBudgetedPaise > 0 ? (
              <>
                <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                  {metrics.budgetUsage.usagePercent?.toFixed(1)}% Used
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
                  {formatINRPaise(metrics.budgetUsage.totalSpentAgainstBudgetPaise)} of{' '}
                  {formatINRPaise(metrics.budgetUsage.totalBudgetedPaise)}
                </div>
              </>
            ) : (
              <div className="mt-2 text-xs text-slate-400">
                Not configured ·{' '}
                <button
                  type="button"
                  onClick={() => onNavigateTab('planning')}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  Set budget
                </button>
              </div>
            )}
          </div>

          {/* Period-over-Period or Upcoming Commitments */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-sm transition-shadow">
            {comparison.hasPreviousData ? (
              <>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  vs {comparison.previousPeriodLabel}
                </div>
                <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                  {comparison.netDeltaPaise > 0 ? '+' : ''}
                  {formatINRPaise(comparison.netDeltaPaise)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 truncate">
                  Net cash-flow delta
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Upcoming Commitments (30d)
                </div>
                <div className="mt-2 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                  {formatINRPaise(metrics.upcomingCommitments30d.totalPaise)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  {metrics.upcomingCommitments30d.count} recurring items
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Bank of India Fees & Silent Charges Audit Summary */}
      {periodTransactions.length > 0 && (
        <BankFeesSummaryCard transactions={legacyMappedTransactions} />
      )}

      {/* Populated Content Split: Top Categories + Recent Transactions Table */}
      {!isEmptyDatabase && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Category Breakdown (4 columns) */}
          <section className="lg:col-span-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Expense Categories
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('categories')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All Categories
              </button>
            </div>

            {categoryTotals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No expenses recorded in {period.label}.
              </div>
            ) : (
              <div className="space-y-4">
                {categoryTotals.map((cat) => {
                  const share =
                    metrics.identifiedExpensesPaise > 0
                      ? (cat.amountPaise / metrics.identifiedExpensesPaise) * 100
                      : 0;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => onSelectCategoryFilter(cat.name)}
                      className="w-full text-left group cursor-pointer"
                    >
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                          {cat.name}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatINRPaise(cat.amountPaise)}{' '}
                          <span className="text-slate-400 font-normal">
                            · {share.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                          style={{ width: `${Math.min(100, Math.max(3, share))}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Transactions Ledger (8 columns) */}
          <section className="lg:col-span-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Recent Transactions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest activity in {period.label} · Click any row to edit or split
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('transactions')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                View All ({periodTransactions.length})
              </button>
            </div>

            {periodTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No transactions recorded in {period.label}. Select another month from the toolbar
                above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                      <th className="py-3 pl-6 pr-3">Date</th>
                      <th className="py-3 px-3">Counterparty & Narration</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 pl-3 pr-6 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {periodTransactions.slice(0, 10).map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => onInspectTransaction(tx)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {tx.counterpartyName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">
                            {tx.rawDescription}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span>{tx.category}</span>
                          <span className="text-slate-300 dark:text-slate-700 mx-1.5">·</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {tx.paymentMode}
                          </span>
                        </td>
                        <td
                          className={`py-3 pl-3 pr-6 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            tx.direction === 'CREDIT'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {tx.direction === 'CREDIT' ? '+' : '-'}
                          {formatINRPaise(tx.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
