import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import {
  BudgetStatus,
  CategoryName,
  formatINR,
} from '../utils/statementParser';

interface BudgetsViewProps {
  budgetStatuses: BudgetStatus[];
  onUpdateBudgetLimit: (category: CategoryName, newLimit: number) => void;
  onSelectCategoryTransactions: (category: CategoryName) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgetStatuses,
  onUpdateBudgetLimit,
  onSelectCategoryTransactions,
}) => {
  const [editingCategory, setEditingCategory] = useState<CategoryName | null>(null);
  const [draftLimit, setDraftLimit] = useState('');

  const totalBudgeted = budgetStatuses.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgetStatuses.reduce((sum, b) => sum + b.spent, 0);
  const overBudgetCount = budgetStatuses.filter((b) => b.status === 'Over Budget').length;
  const approachingCount = budgetStatuses.filter((b) => b.status === 'Approaching Limit').length;

  const handleSaveEdit = (category: CategoryName) => {
    const val = parseFloat(draftLimit);
    if (Number.isFinite(val) && val > 0) {
      onUpdateBudgetLimit(category, val);
    }
    setEditingCategory(null);
  };

  return (
    <div className="space-y-6">
      {/* Budget Summary Strip */}
      <section aria-label="Monthly Budget Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Total Monthly Budget Cap</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(totalBudgeted)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Across {budgetStatuses.length} tracked categories
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Total Budgeted Spend</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(totalSpent)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0}% of monthly cap utilized
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Remaining Headroom</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              totalBudgeted - totalSpent >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatINR(totalBudgeted - totalSpent)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Net unspent across active caps
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Active Threshold Alerts</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {overBudgetCount + approachingCount}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{overBudgetCount} Exceeded</span>
            <span aria-hidden="true">·</span>
            <span>{approachingCount} Approaching</span>
          </div>
        </div>
      </section>

      {/* Category Budget List */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Category Monthly Budget Limits & Alerts
            </h2>
            <p className="text-xs text-slate-500">
              Edit any category cap to recalibrate real-time statement alerts
            </p>
          </div>
          <span className="text-xs text-slate-500">
            Alert threshold set at 80% utilization
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {budgetStatuses.map((b) => {
            const isEditing = editingCategory === b.category;
            const barWidth = Math.min(100, Math.max(2, b.percentUsed));
            const barColor =
              b.status === 'Over Budget'
                ? 'bg-red-600'
                : b.status === 'Approaching Limit'
                ? 'bg-amber-500'
                : 'bg-slate-800';

            return (
              <div key={b.category} className="p-6 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectCategoryTransactions(b.category)}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors"
                      >
                        {b.category}
                      </button>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      {b.status === 'Over Budget' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Over Budget (Exceeded by {formatINR(Math.abs(b.remaining))})
                        </span>
                      )}
                      {b.status === 'Approaching Limit' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Clock className="h-3.5 w-3.5" /> Approaching Limit ({b.percentUsed}%)
                        </span>
                      )}
                      {b.status === 'Nominal' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Nominal ({formatINR(b.remaining)} left)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span>{b.transactionCount} statement debits</span>
                      <span aria-hidden="true">·</span>
                      <span>{b.percentUsed}% of monthly limit</span>
                    </div>
                  </div>

                  {/* Right: Spent / Limit + Inline Edit Control */}
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <label htmlFor={`limit-input-${b.category}`} className="sr-only">
                          New monthly limit for {b.category}
                        </label>
                        <input
                          id={`limit-input-${b.category}`}
                          type="number"
                          value={draftLimit}
                          onChange={(e) => setDraftLimit(e.target.value)}
                          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(b.category)}
                          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                        >
                          Save Limit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 whitespace-nowrap shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatINR(b.spent)}
                          </span>
                          <span className="text-xs text-slate-500"> / {formatINR(b.monthlyLimit)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(b.category);
                            setDraftLimit(String(b.monthlyLimit));
                          }}
                          aria-label={`Edit budget limit for ${b.category}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                        >
                          Edit Limit
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-transform duration-200 origin-left ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
