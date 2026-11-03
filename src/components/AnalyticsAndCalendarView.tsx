import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PieChart,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  FullDatabaseSnapshot,
  ReportingPeriod,
  TransactionRecord,
} from '../types/finance';
import { formatINRPaise } from '../services/financeEngine';

interface AnalyticsAndCalendarViewProps {
  snapshot: FullDatabaseSnapshot;
  period: ReportingPeriod;
  periodTransactions: TransactionRecord[];
  onSelectCategoryFilter: (category: string) => void;
  onSelectPersonFilter: (personName: string) => void;
  onInspectTransaction: (tx: TransactionRecord) => void;
}

export const AnalyticsAndCalendarView: React.FC<AnalyticsAndCalendarViewProps> = ({
  snapshot,
  period,
  periodTransactions,
  onSelectCategoryFilter,
  onSelectPersonFilter,
  onInspectTransaction,
}) => {
  // Determine default calendar month from period or latest transaction
  const defaultYearMonth = useMemo(() => {
    if (period.month) return period.month;
    const sorted = [...snapshot.transactions].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] ? sorted[0].date.slice(0, 7) : new Date().toISOString().slice(0, 7);
  }, [period.month, snapshot.transactions]);

  const [calendarYearMonth, setCalendarYearMonth] = useState<string>(defaultYearMonth);
  const [calendarMode, setCalendarMode] = useState<'SPENDING' | 'INCOME' | 'BOTH'>('BOTH');
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  // Sync calendarYearMonth when period.month changes
  React.useEffect(() => {
    if (period.month) {
      setCalendarYearMonth(period.month);
    }
  }, [period.month]);

  // 1. Monthly Credit vs Debit Aggregation (across all history or selected period)
  const monthlySeries = useMemo(() => {
    const source = snapshot.transactions.length > 0 ? snapshot.transactions : periodTransactions;
    const map = new Map<string, { creditPaise: number; debitPaise: number; count: number }>();
    for (const tx of source) {
      const ym = tx.date.slice(0, 7);
      const curr = map.get(ym) || { creditPaise: 0, debitPaise: 0, count: 0 };
      if (tx.direction === 'CREDIT') curr.creditPaise += tx.amountPaise;
      else curr.debitPaise += tx.amountPaise;
      curr.count += 1;
      map.set(ym, curr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([ym, vals]) => ({
        ym,
        ...vals,
        netPaise: vals.creditPaise - vals.debitPaise,
      }));
  }, [snapshot.transactions, periodTransactions]);

  // 2. Daily Cash Flow Series inside active period
  const dailySeries = useMemo(() => {
    const map = new Map<string, { creditPaise: number; debitPaise: number; count: number }>();
    for (const tx of periodTransactions) {
      const curr = map.get(tx.date) || { creditPaise: 0, debitPaise: 0, count: 0 };
      if (tx.direction === 'CREDIT') curr.creditPaise += tx.amountPaise;
      else curr.debitPaise += tx.amountPaise;
      curr.count += 1;
      map.set(tx.date, curr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [periodTransactions]);

  // 3. Category Breakdown (Expenses)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { amountPaise: number; count: number }>();
    let totalExpensePaise = 0;
    for (const tx of periodTransactions) {
      if (tx.direction === 'DEBIT' && tx.transactionType === 'EXPENSE') {
        const curr = map.get(tx.category) || { amountPaise: 0, count: 0 };
        curr.amountPaise += tx.amountPaise;
        curr.count += 1;
        map.set(tx.category, curr);
        totalExpensePaise += tx.amountPaise;
      }
    }
    const colors = [
      '#2563eb',
      '#e11d48',
      '#d97706',
      '#059669',
      '#7c3aed',
      '#0891b2',
      '#db2777',
      '#4f46e5',
      '#65a30d',
      '#475569',
    ];
    return Array.from(map.entries())
      .map(([category, data], idx) => ({
        category,
        amountPaise: data.amountPaise,
        count: data.count,
        sharePercent: totalExpensePaise > 0 ? (data.amountPaise / totalExpensePaise) * 100 : 0,
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.amountPaise - a.amountPaise);
  }, [periodTransactions]);

  // 4. Top People / Merchants Breakdown
  const counterpartyBreakdown = useMemo(() => {
    const map = new Map<string, { sentPaise: number; receivedPaise: number; count: number }>();
    for (const tx of periodTransactions) {
      const name = tx.counterpartyName || 'Unknown Counterparty';
      const curr = map.get(name) || { sentPaise: 0, receivedPaise: 0, count: 0 };
      if (tx.direction === 'DEBIT') curr.sentPaise += tx.amountPaise;
      else curr.receivedPaise += tx.amountPaise;
      curr.count += 1;
      map.set(name, curr);
    }
    const list = Array.from(map.entries()).map(([name, d]) => ({
      name,
      ...d,
      totalVolumePaise: d.sentPaise + d.receivedPaise,
    }));
    return {
      topRecipients: [...list].sort((a, b) => b.sentPaise - a.sentPaise).filter((x) => x.sentPaise > 0).slice(0, 6),
      topSenders: [...list]
        .sort((a, b) => b.receivedPaise - a.receivedPaise)
        .filter((x) => x.receivedPaise > 0)
        .slice(0, 6),
    };
  }, [periodTransactions]);

  // 5. Spending Calendar Grid & Weekday vs Weekend Metrics
  const calendarData = useMemo(() => {
    const [yStr, mStr] = calendarYearMonth.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const month = parseInt(mStr, 10) || new Date().getMonth() + 1;

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sun

    const txByDate = new Map<
      string,
      { debitPaise: number; creditPaise: number; txs: TransactionRecord[] }
    >();
    let maxDailyDebit = 0;
    let weekdaySpendPaise = 0;
    let weekendSpendPaise = 0;
    let weekdayTxCount = 0;
    let weekendTxCount = 0;

    for (const tx of snapshot.transactions) {
      if (!tx.date.startsWith(calendarYearMonth)) continue;
      const entry = txByDate.get(tx.date) || { debitPaise: 0, creditPaise: 0, txs: [] };
      if (tx.direction === 'DEBIT') {
        entry.debitPaise += tx.amountPaise;
        const dow = new Date(`${tx.date}T00:00:00`).getDay();
        if (dow === 0 || dow === 6) {
          weekendSpendPaise += tx.amountPaise;
          weekendTxCount += 1;
        } else {
          weekdaySpendPaise += tx.amountPaise;
          weekdayTxCount += 1;
        }
      } else {
        entry.creditPaise += tx.amountPaise;
      }
      entry.txs.push(tx);
      txByDate.set(tx.date, entry);
      if (entry.debitPaise > maxDailyDebit) maxDailyDebit = entry.debitPaise;
    }

    const cells: Array<{
      dayNum: number | null;
      dateIso: string | null;
      debitPaise: number;
      creditPaise: number;
      txs: TransactionRecord[];
    }> = [];

    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ dayNum: null, dateIso: null, debitPaise: 0, creditPaise: 0, txs: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = `${calendarYearMonth}-${String(d).padStart(2, '0')}`;
      const info = txByDate.get(dateIso) || { debitPaise: 0, creditPaise: 0, txs: [] };
      cells.push({
        dayNum: d,
        dateIso,
        debitPaise: info.debitPaise,
        creditPaise: info.creditPaise,
        txs: info.txs,
      });
    }

    return {
      year,
      month,
      cells,
      maxDailyDebit,
      weekdaySpendPaise,
      weekendSpendPaise,
      weekdayTxCount,
      weekendTxCount,
    };
  }, [calendarYearMonth, snapshot.transactions]);

  const shiftCalendarMonth = (delta: number) => {
    const [yStr, mStr] = calendarYearMonth.split('-');
    const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCalendarYearMonth(nextYm);
    setSelectedDayIso(null);
  };

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDayIso) return [];
    return snapshot.transactions.filter((tx) => tx.date === selectedDayIso);
  }, [selectedDayIso, snapshot.transactions]);

  // SVG Donut Helper
  const donutSegments = useMemo(() => {
    let cumulativePercent = 0;
    return categoryBreakdown.map((item) => {
      const start = cumulativePercent;
      cumulativePercent += item.sharePercent;
      return {
        ...item,
        strokeDasharray: `${item.sharePercent} ${100 - item.sharePercent}`,
        strokeDashoffset: 100 - start,
      };
    });
  }, [categoryBreakdown]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {period.label} · tap a category or person to drill down
          </p>
        </div>
      </div>

      {/* Top Row: Monthly Credit vs Debit Bar Chart + Category Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Credit vs Debit Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Credits vs Debits
              </h3>
              <p className="text-xs text-slate-500">
                Green = Inflow (Credits) • Red = Outflow (Debits)
              </p>
            </div>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No monthly transaction history available yet. Import a statement to view monthly trends.
            </div>
          ) : (
            <div className="space-y-4">
              {monthlySeries.map((m) => {
                const maxVal = Math.max(
                  ...monthlySeries.map((x) => Math.max(x.creditPaise, x.debitPaise, 1))
                );
                const creditPct = (m.creditPaise / maxVal) * 100;
                const debitPct = (m.debitPaise / maxVal) * 100;

                return (
                  <div key={m.ym} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                        {m.ym} ({m.count} txns)
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0 whitespace-nowrap">
                        Net:{' '}
                        <strong
                          className={
                            m.netPaise >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }
                        >
                          {m.netPaise >= 0 ? '+' : ''}
                          {formatINRPaise(m.netPaise)}
                        </strong>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-11 sm:w-12 text-[10px] font-semibold text-emerald-600 uppercase shrink-0">
                          Credit
                        </span>
                        <div className="flex-1 min-w-0 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.max(creditPct > 0 ? 3 : 0, creditPct)}%` }}
                          />
                        </div>
                        <span className="w-20 sm:w-24 text-right font-mono tabular-nums text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                          {formatINRPaise(m.creditPaise)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-11 sm:w-12 text-[10px] font-semibold text-rose-600 uppercase shrink-0">
                          Debit
                        </span>
                        <div className="flex-1 min-w-0 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${Math.max(debitPct > 0 ? 3 : 0, debitPct)}%` }}
                          />
                        </div>
                        <span className="w-20 sm:w-24 text-right font-mono tabular-nums text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 shrink-0 whitespace-nowrap">
                          {formatINRPaise(m.debitPaise)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Spending Donut & Interactive Legend */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Category Spending Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500">
                Click any category slice or row to filter transactions
              </p>
            </div>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No expense transactions recorded in {period.label}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
              <div className="sm:col-span-2 flex justify-center">
                <svg viewBox="0 0 42 42" className="w-40 h-40 -rotate-90">
                  <circle
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="#e2e8f0"
                    strokeWidth="6"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.category}
                      cx="21"
                      cy="21"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="6"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => onSelectCategoryFilter(seg.category)}
                    >
                      <title>
                        {seg.category}: {formatINRPaise(seg.amountPaise)} (
                        {seg.sharePercent.toFixed(1)}%)
                      </title>
                    </circle>
                  ))}
                </svg>
              </div>

              <div className="sm:col-span-3 space-y-2 max-h-60 overflow-y-auto pr-1 min-w-0">
                {categoryBreakdown.map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => onSelectCategoryFilter(item.category)}
                    className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.category}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">({item.count})</span>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
                      {formatINRPaise(item.amountPaise)}{' '}
                      <span className="text-[11px] font-normal text-slate-400">
                        {item.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Cash Flow Bar Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Daily Cash-Flow Timeline ({period.label})
            </h3>
            <p className="text-xs text-slate-500">
              Daily credit and debit activity across {dailySeries.length} active days
            </p>
          </div>
        </div>

        {dailySeries.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No daily transactions in the selected period.
          </div>
        ) : (
          <div className="flex items-end gap-1.5 h-36 overflow-x-auto pb-2 pt-4 px-1">
            {dailySeries.map((d) => {
              const maxDay = Math.max(
                ...dailySeries.map((x) => Math.max(x.debitPaise, x.creditPaise, 1))
              );
              const debitH = Math.round((d.debitPaise / maxDay) * 90);
              const creditH = Math.round((d.creditPaise / maxDay) * 90);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDayIso(d.date)}
                  className="flex flex-col items-center gap-1 group min-w-[28px] shrink-0 cursor-pointer"
                  title={`${d.date}: Out ${formatINRPaise(d.debitPaise)} | In ${formatINRPaise(
                    d.creditPaise
                  )}`}
                >
                  <div className="flex items-end gap-0.5 h-24">
                    {d.creditPaise > 0 && (
                      <div
                        className="w-2.5 bg-emerald-500 rounded-t-sm"
                        style={{ height: `${Math.max(4, creditH)}px` }}
                      />
                    )}
                    {d.debitPaise > 0 && (
                      <div
                        className="w-2.5 bg-rose-500 rounded-t-sm"
                        style={{ height: `${Math.max(4, debitH)}px` }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-blue-600">
                    {d.date.slice(8, 10)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Top People & Merchants Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Top Payees / Merchants (Money Sent)</span>
          </h3>
          {counterpartyBreakdown.topRecipients.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No outgoing payments in period.</div>
          ) : (
            <div className="space-y-2.5">
              {counterpartyBreakdown.topRecipients.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onSelectPersonFilter(p.name)}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer min-w-0"
                >
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{p.count} transactions</div>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0 whitespace-nowrap">
                    -{formatINRPaise(p.sentPaise)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Top Senders (Money Received)</span>
          </h3>
          {counterpartyBreakdown.topSenders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No incoming credits in period.</div>
          ) : (
            <div className="space-y-2.5">
              {counterpartyBreakdown.topSenders.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onSelectPersonFilter(p.name)}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer min-w-0"
                >
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{p.count} transactions</div>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                    +{formatINRPaise(p.receivedPaise)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 13: Interactive Spending Calendar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Interactive Spending & Cash-Flow Calendar</span>
            </h3>
            <p className="text-xs text-slate-500">
              Click any date cell to inspect all transactions for that day • Includes Weekday vs Weekend comparison
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
              {(['BOTH', 'SPENDING', 'INCOME'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCalendarMode(m)}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    calendarMode === m
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  {m === 'BOTH' ? 'Both' : m === 'SPENDING' ? 'Spending' : 'Income'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftCalendarMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={calendarYearMonth}
                onChange={(e) => {
                  if (e.target.value) setCalendarYearMonth(e.target.value);
                }}
                className="px-2 sm:px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold"
              />
              <button
                type="button"
                onClick={() => shiftCalendarMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Weekday vs Weekend Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2 text-xs min-w-0">
            <div className="min-w-0">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Weekday Spending (Mon–Fri)
              </span>
              <div className="text-[11px] text-slate-500">{calendarData.weekdayTxCount} debit txns</div>
            </div>
            <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0 whitespace-nowrap">
              {formatINRPaise(calendarData.weekdaySpendPaise)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2 text-xs min-w-0">
            <div className="min-w-0">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Weekend Spending (Sat–Sun)
              </span>
              <div className="text-[11px] text-slate-500">{calendarData.weekendTxCount} debit txns</div>
            </div>
            <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0 whitespace-nowrap">
              {formatINRPaise(calendarData.weekendSpendPaise)}
            </div>
          </div>
        </div>

        {/* Calendar 7-Column Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1 min-w-0 truncate">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full">
          {calendarData.cells.map((cell, idx) => {
            if (!cell.dayNum || !cell.dateIso) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-16 sm:h-20 min-w-0 rounded-lg bg-slate-50/40 dark:bg-slate-900/20 border border-transparent"
                />
              );
            }
            const hasActivity = cell.txs.length > 0;
            const isSelected = selectedDayIso === cell.dateIso;
            const intensity =
              calendarData.maxDailyDebit > 0 ? cell.debitPaise / calendarData.maxDailyDebit : 0;

            return (
              <button
                key={cell.dateIso}
                type="button"
                onClick={() => setSelectedDayIso(cell.dateIso)}
                className={`h-16 sm:h-20 min-w-0 overflow-hidden p-1 sm:p-1.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/40'
                    : hasActivity
                    ? intensity > 0.5
                      ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-blue-400'
                    : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-0.5 w-full min-w-0">
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-700 dark:text-slate-200 leading-none">
                    {cell.dayNum}
                  </span>
                  {cell.txs.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono leading-tight shrink-0">
                      {cell.txs.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 w-full min-w-0 overflow-hidden">
                  {(calendarMode === 'BOTH' || calendarMode === 'SPENDING') &&
                    cell.debitPaise > 0 && (
                      <div
                        className="text-[9px] sm:text-[10px] font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400 truncate"
                        title={`Outflow: -${formatINRPaise(cell.debitPaise)}`}
                      >
                        <span className="sm:hidden">
                          -₹
                          {cell.debitPaise >= 10000000
                            ? `${(cell.debitPaise / 10000000).toFixed(1)}L`
                            : cell.debitPaise >= 100000
                            ? `${(cell.debitPaise / 100000).toFixed(
                                cell.debitPaise % 100000 === 0 ? 0 : 1
                              )}k`
                            : Math.round(cell.debitPaise / 100)}
                        </span>
                        <span className="hidden sm:inline">
                          -{formatINRPaise(cell.debitPaise)}
                        </span>
                      </div>
                    )}
                  {(calendarMode === 'BOTH' || calendarMode === 'INCOME') &&
                    cell.creditPaise > 0 && (
                      <div
                        className="text-[9px] sm:text-[10px] font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 truncate"
                        title={`Inflow: +${formatINRPaise(cell.creditPaise)}`}
                      >
                        <span className="sm:hidden">
                          +₹
                          {cell.creditPaise >= 10000000
                            ? `${(cell.creditPaise / 10000000).toFixed(1)}L`
                            : cell.creditPaise >= 100000
                            ? `${(cell.creditPaise / 100000).toFixed(
                                cell.creditPaise % 100000 === 0 ? 0 : 1
                              )}k`
                            : Math.round(cell.creditPaise / 100)}
                        </span>
                        <span className="hidden sm:inline">
                          +{formatINRPaise(cell.creditPaise)}
                        </span>
                      </div>
                    )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Drilldown Panel */}
        {selectedDayIso && (
          <div className="mt-4 p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
                Transactions on {selectedDayIso} ({selectedDayTransactions.length})
              </h4>
              <button
                type="button"
                onClick={() => setSelectedDayIso(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shrink-0 cursor-pointer"
              >
                Close
              </button>
            </div>
            {selectedDayTransactions.length === 0 ? (
              <p className="text-xs text-slate-500">No transactions recorded on {selectedDayIso}.</p>
            ) : (
              <div className="space-y-1.5 w-full">
                {selectedDayTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => onInspectTransaction(tx)}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs cursor-pointer hover:border-blue-500 w-full min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {tx.counterpartyName}
                        </span>{' '}
                        <span className="text-slate-400">({tx.category})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate w-full mt-0.5">
                        {tx.rawDescription}
                      </div>
                    </div>
                    <div
                      className={`font-mono tabular-nums font-bold shrink-0 whitespace-nowrap text-right ${
                        tx.direction === 'CREDIT'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.direction === 'CREDIT' ? '+' : '-'}
                      {formatINRPaise(tx.amountPaise)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
