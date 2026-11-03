import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  ChevronRight,
  Plus,
  Repeat,
  ShieldCheck,
  Flame,
  Coffee,
  Calendar,
} from 'lucide-react';
import {
  Transaction,
  StatementSummary,
  PersonLedgerEntry,
  BudgetStatus,
  DetectedSubscription,
  CategoryName,
  calculateCashflowSafetyMetrics,
  calculateMicroUpiAndHeatmap,
  redactSensitiveText,
  formatINR,
} from '../utils/statementParser';
import { BankFeesSummaryCard } from './BankFeesSummaryCard';

interface OverviewViewProps {
  transactions: Transaction[];
  summary: StatementSummary;
  personLedger: PersonLedgerEntry[];
  budgetStatuses: BudgetStatus[];
  subscriptions: DetectedSubscription[];
  isRedacted: boolean;
  onNavigateTab: (
    tab: 'overview' | 'transactions' | 'people' | 'audit' | 'tax-budgets'
  ) => void;
  onSelectCategoryFilter: (cat: CategoryName) => void;
  onSelectPersonFilter: (personName: string) => void;
  onOpenQuickAdd: () => void;
  onAddTransaction: (txn: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  transactions,
  summary,
  personLedger,
  budgetStatuses,
  subscriptions,
  isRedacted,
  onNavigateTab,
  onSelectCategoryFilter,
  onSelectPersonFilter,
  onOpenQuickAdd,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  // Compute category breakdown sorted by spend
  const categoryMap = new Map<CategoryName, { amount: number; count: number }>();
  for (const t of transactions) {
    if (t.type === 'DEBIT') {
      const prev = categoryMap.get(t.category) || { amount: 0, count: 0 };
      prev.amount += t.amount;
      prev.count += 1;
      categoryMap.set(t.category, prev);
    }
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percent: summary.totalDebits > 0 ? Math.round((data.amount / summary.totalDebits) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const p2pOnly = personLedger.filter((p) => p.isPerson);
  const alertBudgets = budgetStatuses.filter((b) => b.status !== 'Nominal');
  const monthlySubBurn = subscriptions
    .filter((s) => s.status !== 'Paused')
    .reduce((acc, s) => acc + s.amount, 0);

  const safetyMetrics = useMemo(
    () => calculateCashflowSafetyMetrics(transactions, subscriptions),
    [transactions, subscriptions]
  );

  const microAndHeatmap = useMemo(
    () => calculateMicroUpiAndHeatmap(transactions),
    [transactions]
  );

  const maxDaySpend = Math.max(
    1,
    ...microAndHeatmap.dayOfWeekTotals.map((d) => d.amount)
  );

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section aria-label="Statement Key Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Credited (Inflow)</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
          </div>
          <div
            data-testid="kpi-total-credits"
            className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums"
          >
            +{formatINR(summary.totalCredits)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{summary.creditCount} credit entries</span>
            <span aria-hidden="true">·</span>
            <span>UPI & Refunds</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Debited (Outflow)</span>
            <ArrowUpRight className="h-4 w-4 text-slate-700" />
          </div>
          <div
            data-testid="kpi-total-debits"
            className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums"
          >
            -{formatINR(summary.totalDebits)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{summary.debitCount} debit entries</span>
            <span aria-hidden="true">·</span>
            <span>UPI Share {summary.upiSharePercent}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Net Cashflow & Closing Bal</span>
            <span className="font-mono text-slate-600 tabular-nums">{summary.savingsRate}% saved</span>
          </div>
          <div
            data-testid="kpi-net-cashflow"
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              summary.netCashflow >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {summary.netCashflow >= 0 ? '+' : ''}
            {formatINR(summary.netCashflow)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>
              Closing Bal:{' '}
              {summary.closingBalance !== null ? formatINR(summary.closingBalance) : 'N/A'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Recurring & Mandates</span>
            <Repeat className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(monthlySubBurn)}
            <span className="text-xs font-normal text-slate-500">/mo</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums">{subscriptions.length} detected mandates</span>
            <button
              type="button"
              onClick={() => onNavigateTab('tax-budgets')}
              className="font-medium text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Inspect
            </button>
          </div>
        </div>
      </section>

      {/* Financial Safety Net & Cash-Flow Forecasting Strip */}
      <section
        aria-label="Financial Safety Net and Burn Forecast"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* 1. Month-End Safe-to-Spend Burn Rate */}
          <div className="space-y-1.5 md:pr-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">Month-End "Safe-to-Spend" Allowance</span>
              <Flame className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {formatINR(safetyMetrics.safeToSpendDaily)}
                <span className="text-xs font-normal text-slate-500">/day</span>
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                (Current pace: {formatINR(safetyMetrics.dailyDiscretionaryBurn)}/day)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Recommended daily discretionary limit after reserving upcoming mandates ({formatINR(safetyMetrics.upcomingMandatesTotal)}).
            </p>
          </div>

          {/* 2. Balance Runway Forecast */}
          <div className="pt-4 md:pt-0 md:px-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">Zero-Balance Runway Forecast</span>
              <span className="font-mono tabular-nums text-slate-600">
                Bal: {formatINR(safetyMetrics.closingBalance)}
              </span>
            </div>
            <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {safetyMetrics.daysUntilZero} Days Remaining
            </div>
            <p className="text-xs text-slate-500">
              At your current pace of {formatINR(safetyMetrics.dailyDiscretionaryBurn)}/day, your balance will hit ₹0 in{' '}
              <strong className="font-mono text-slate-800">{safetyMetrics.daysUntilZero} days</strong>.
            </p>
          </div>

          {/* 3. Mandate / EMI Low Balance & BOI MAB Risk Alert */}
          <div className="pt-4 md:pt-0 md:pl-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">Mandate & BOI MAB Safety Status</span>
              <ShieldCheck
                className={`h-4 w-4 ${
                  safetyMetrics.riskLevel === 'SAFE' ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
            </div>
            <div
              className={`text-sm font-semibold ${
                safetyMetrics.riskLevel === 'SAFE' ? 'text-emerald-700' : 'text-amber-800'
              }`}
            >
              {safetyMetrics.riskLevel} · Avg Bal:{' '}
              <span className="font-mono">{formatINR(safetyMetrics.averageBalance)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {safetyMetrics.mandateShortfall > 0
                ? `Low balance risk: Top up ${formatINR(safetyMetrics.mandateShortfall)} before recurring mandates hit.`
                : `Closing balance (${formatINR(safetyMetrics.closingBalance)}) covers upcoming mandates (${formatINR(safetyMetrics.upcomingMandatesTotal)}) and BOI ₹2,500 MAB.`}
            </p>
          </div>
        </div>
      </section>

      {/* Dedicated Bank Fees & Silent Charges Analyzer Summary Card */}
      <BankFeesSummaryCard
        transactions={transactions}
        isRedacted={isRedacted}
        onAddTransaction={onAddTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />

      {/* Budget Alert Banner if any category is Over Budget or Approaching Limit */}
      {alertBudgets.length > 0 && (
        <section
          aria-label="Active Budget Alerts"
          className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {alertBudgets.length} Monthly Category {alertBudgets.length === 1 ? 'Budget' : 'Budgets'} Require Attention
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 font-mono tabular-nums">
                {alertBudgets.map((b, i) => (
                  <React.Fragment key={b.category}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span>
                      <strong className="font-sans font-medium text-slate-900">{b.category}</strong>:{' '}
                      {formatINR(b.spent)} / {formatINR(b.monthlyLimit)} ({b.percentUsed}% — {b.status})
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('tax-budgets')}
            className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 hover:bg-amber-100/50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Adjust Budget Limits
          </button>
        </section>
      )}

      {/* 2-Column Split: Category Spend Breakdown & Person-to-Person UPI Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Auto-Categorized Spend Breakdown (7 cols) */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Auto-Categorized Outflow Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any category to filter statement transactions
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Total: {formatINR(summary.totalDebits)}
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {categoryBreakdown.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => onSelectCategoryFilter(item.category)}
                  className="w-full py-3 text-left group hover:bg-slate-50/80 transition-colors rounded-lg px-2 -mx-2"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {item.category}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        {item.count} {item.count === 1 ? 'txn' : 'txns'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{formatINR(item.amount)}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500 w-9 text-right">{item.percent}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800 transition-transform duration-200 origin-left"
                      style={{ width: `${Math.max(3, item.percent)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Categories inferred from NPCI UPI handles & merchant codes</span>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="inline-flex items-center gap-1 font-medium text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              View All Transactions <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Right: Person-to-Person (P2P) UPI Counterparty Summary (5 cols) */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Person-to-Person (P2P) UPI Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extracted sender & receiver names from BOI narrations
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('people')}
                className="text-xs font-medium text-slate-900 hover:underline whitespace-nowrap shrink-0"
              >
                Full Ledger
              </button>
            </div>

            <div className="mt-2 divide-y divide-slate-100">
              {p2pOnly.slice(0, 6).map((person) => (
                <div
                  key={person.counterparty}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectPersonFilter(person.counterparty)}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors text-left truncate block"
                    >
                      {redactSensitiveText(person.counterparty, isRedacted)}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <span className="font-mono truncate">
                        {redactSensitiveText(
                          person.upiId || person.bankCode || 'IMPS/NEFT',
                          isRedacted
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">{person.transactionCount} txns</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div
                      className={`text-sm font-semibold ${
                        person.netBalance > 0
                          ? 'text-emerald-700'
                          : person.netBalance < 0
                          ? 'text-slate-900'
                          : 'text-slate-500'
                      }`}
                    >
                      {person.netBalance > 0 ? '+' : ''}
                      {formatINR(person.netBalance)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {person.totalReceived > 0 && `In ${formatINR(person.totalReceived)}`}
                      {person.totalReceived > 0 && person.totalSent > 0 && ' · '}
                      {person.totalSent > 0 && `Out ${formatINR(person.totalSent)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {p2pOnly.length} individual contacts identified
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('people')}
              className="inline-flex items-center gap-1 font-medium text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              WhatsApp Settle-Up & Ledger <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* Micro-UPI ("Chai/Snacks" <= ₹100) Leak Detector & Day-of-Week Spending Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Micro-UPI Leak Detector (5 cols) */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Micro-UPI Leak Detector (≤ ₹100)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracks frequent small-ticket tea, snack, recharge & local QR scans
                </p>
              </div>
              <Coffee className="h-4 w-4 text-slate-600 shrink-0 mt-1" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-xs text-slate-500 block">Micro-UPI Outflow</span>
                <span className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums block">
                  {formatINR(microAndHeatmap.microTotalAmount)}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  across {microAndHeatmap.microCount} small scans
                </span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-xs text-slate-500 block">Average Micro Ticket</span>
                <span className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums block">
                  {formatINR(microAndHeatmap.microAverage)}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Top: {redactSensitiveText(microAndHeatmap.topMicroCounterparty || '—', isRedacted)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Threshold: UPI debits ≤ ₹{microAndHeatmap.microThreshold}</span>
            <button
              type="button"
              onClick={() => onNavigateTab('audit')}
              className="font-medium text-slate-900 hover:underline"
            >
              Open UPI Audit →
            </button>
          </div>
        </section>

        {/* Weekend & Day-of-Week Spending Heatmap + Balance Timeline (7 cols) */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Day-of-Week Spending Heatmap & Closing Balance Trajectory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identifies peak spending days and daily closing balance highs/lows
                </p>
              </div>
              <Calendar className="h-4 w-4 text-slate-600 shrink-0 mt-1" />
            </div>

            {/* 7-Day Bar Chart */}
            <div className="mt-4 grid grid-cols-7 gap-2 items-end h-28 pt-4">
              {microAndHeatmap.dayOfWeekTotals.map((dayObj) => {
                const heightPct = Math.max(
                  8,
                  Math.round((dayObj.amount / maxDaySpend) * 100)
                );
                return (
                  <div key={dayObj.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                      {dayObj.amount > 0 ? formatINR(dayObj.amount) : '₹0'}
                    </span>
                    <div className="w-full bg-slate-100 rounded-t-md h-16 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          dayObj.isWeekend ? 'bg-slate-900' : 'bg-slate-500'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{dayObj.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Closing Balance Strip */}
          {microAndHeatmap.dailyTimeline.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Statement Daily Closing Balance Checkpoints</span>
                <span className="font-mono tabular-nums">
                  Weekend Share: {microAndHeatmap.weekendSharePercent}% of total spend
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {microAndHeatmap.dailyTimeline.slice(-7).map((pt) => (
                  <div
                    key={pt.date}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-mono tabular-nums shrink-0"
                  >
                    <div className="text-slate-500">{pt.date.slice(5)}</div>
                    <div className="font-semibold text-slate-900">
                      {formatINR(pt.closingBalance)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Recent Statement Entries Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Extracted Statement Entries
            </h2>
            <p className="text-xs text-slate-500">
              Decoded Bank of India UPI & NEFT narrations with counterparty and category mapping
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Log Transaction
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Explore All ({transactions.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Extracted Counterparty (To / From)</th>
                <th className="py-3 px-4">Channel & UPI ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-6 text-right">Closing Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {[...transactions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 8)
                .map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {txn.date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {txn.type === 'CREDIT' ? 'From: ' : 'To: '}
                        {redactSensitiveText(txn.counterparty, isRedacted)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate max-w-md">
                        {redactSensitiveText(txn.rawNarration, isRedacted)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{txn.channel}</span>
                      {txn.upiId && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono text-slate-500">
                            {redactSensitiveText(txn.upiId, isRedacted)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {txn.category}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                        txn.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {txn.type === 'CREDIT' ? '+' : '-'}
                      {formatINR(txn.amount)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {txn.balance !== undefined ? formatINR(txn.balance) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
