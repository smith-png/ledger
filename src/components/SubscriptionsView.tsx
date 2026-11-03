import React, { useState } from 'react';
import { Repeat, CheckCircle2, PauseCircle, AlertCircle } from 'lucide-react';
import {
  DetectedSubscription,
  formatINR,
} from '../utils/statementParser';

interface SubscriptionsViewProps {
  subscriptions: DetectedSubscription[];
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  subscriptions,
}) => {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, 'Active' | 'Paused' | 'Review'>
  >({});

  const mergedSubs = subscriptions.map((s) => ({
    ...s,
    status: statusOverrides[s.id] || s.status,
  }));

  const activeSubs = mergedSubs.filter((s) => s.status !== 'Paused');
  const monthlyRecurringBurn = activeSubs.reduce((sum, s) => sum + s.amount, 0);
  const annualProjectedBurn = activeSubs.reduce((sum, s) => sum + s.annualCost, 0);
  const pausedSavings = mergedSubs
    .filter((s) => s.status === 'Paused')
    .reduce((sum, s) => sum + s.annualCost, 0);

  const toggleStatus = (id: string, current: 'Active' | 'Paused' | 'Review') => {
    const next = current === 'Paused' ? 'Active' : 'Paused';
    setStatusOverrides((prev) => ({ ...prev, [id]: next }));
  };

  return (
    <div className="space-y-6">
      {/* Subscription KPI Strip */}
      <section aria-label="Recurring Subscriptions Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Monthly Mandates</span>
            <Repeat className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(monthlyRecurringBurn)}
            <span className="text-xs font-normal text-slate-500">/mo</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {activeSubs.length} active recurring charges
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">12-Month Projected Burn</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(annualProjectedBurn)}
            <span className="text-xs font-normal text-slate-500">/yr</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Includes UPI AutoPay, ACH & fixed rent/SIPs
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Digital & Media Subscriptions</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(
              activeSubs
                .filter((s) => s.category === 'Subscriptions')
                .reduce((sum, s) => sum + s.amount, 0)
            )}
            <span className="text-xs font-normal text-slate-500">/mo</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            OTT, music & cloud storage plans
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Annual Savings From Paused</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatINR(pausedSavings)}
            <span className="text-xs font-normal text-slate-500">/yr</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Toggle any mandate below to simulate cancellation
          </div>
        </div>
      </section>

      {/* Subscriptions & Mandates Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detected Recurring Subscriptions & Standing Instructions
            </h2>
            <p className="text-xs text-slate-500">
              Automatically identified from BOI ACH debits, UPI AutoPay handles (`@axisbank`, `@icici`), and repeated monthly bills
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {mergedSubs.length} recurring items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Merchant / Mandate</th>
                <th className="py-3 px-4">Category & Channel</th>
                <th className="py-3 px-4">Last Charged</th>
                <th className="py-3 px-4">Next Expected</th>
                <th className="py-3 px-4 text-right">Monthly Debit</th>
                <th className="py-3 px-4 text-right">Annual Cost</th>
                <th className="py-3 px-6 text-right">Mandate Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {mergedSubs.map((sub) => (
                <tr
                  key={sub.id}
                  className={`transition-colors ${
                    sub.status === 'Paused' ? 'bg-slate-50/80 opacity-65' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-3.5 px-6">
                    <div className="font-semibold text-slate-900">{sub.merchant}</div>
                    <div className="mt-0.5 text-xs font-mono text-slate-500">
                      {sub.upiId || `${sub.channel} Standing Instruction`}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    <span>{sub.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono">{sub.channel}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {sub.lastChargedDate}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                    {sub.status === 'Paused' ? 'Cancelled / Paused' : sub.nextExpectedDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatINR(sub.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatINR(sub.annualCost)}
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        {sub.status === 'Active' && (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active
                          </>
                        )}
                        {sub.status === 'Review' && (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Review
                          </>
                        )}
                        {sub.status === 'Paused' && (
                          <>
                            <PauseCircle className="h-3.5 w-3.5 text-slate-500" /> Paused
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStatus(sub.id, sub.status)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                      >
                        {sub.status === 'Paused' ? 'Resume' : 'Mark Paused'}
                      </button>
                    </div>
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
