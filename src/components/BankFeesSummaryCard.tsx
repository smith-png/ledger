import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Transaction,
  analyzeBankFees,
  formatINR,
  redactSensitiveText,
} from '../utils/statementParser';

interface BankFeesSummaryCardProps {
  transactions: Transaction[];
  privacyMode?: boolean;
  onSimulateBankFee?: (feeType: 'AMC' | 'SMS_ALERT' | 'MAB' | 'PENALTY') => void;
}

export const BankFeesSummaryCard: React.FC<BankFeesSummaryCardProps> = ({
  transactions,
  privacyMode = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => analyzeBankFees(transactions), [transactions]);

  return (
    <section
      data-testid="bank-fees-summary-card"
      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>Bank Fees & Charges Audit</span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {summary.feeCount === 0
                  ? 'Zero AMC, SMS Alert, Penalty, or MAB charges detected'
                  : `${summary.feeCount} charge${summary.feeCount > 1 ? 's' : ''} detected`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically scans narrations for AMC, SMS Alert, Penalty, and Minimum Average Balance (MAB) deductions.
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
            <div className=" sm:text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Total Bank Fees ({summary.feeCount})
              </div>
              <div
                data-testid="bank-fees-total-amount"
                className={`text-lg font-mono tabular-nums font-bold mt-0.5 whitespace-nowrap ${
                  summary.totalFees > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatINR(summary.totalFees)}
              </div>
            </div>

            {summary.feeCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{expanded ? 'Hide Details' : 'Inspect Charges'}</span>
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Responsive Fee Category Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          {summary.breakdownByType.map((cat) => (
            <div key={cat.feeCode} className="space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {cat.feeCode === 'MAB'
                  ? 'MAB / QAB Fine'
                  : cat.feeCode === 'AMC'
                  ? 'Debit Card AMC'
                  : cat.feeCode === 'SMS_ALERT'
                  ? 'SMS Alert Fee'
                  : 'Bounce / Penalty'}
              </div>
              <div
                data-testid={`bank-fee-box-${cat.feeCode}`}
                className={`text-sm font-mono tabular-nums font-semibold whitespace-nowrap ${
                  cat.amount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {formatINR(cat.amount)}
              </div>
              <div className="text-[11px] text-slate-400">
                {cat.count} {cat.count === 1 ? 'deduction' : 'deductions'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {expanded && summary.entries.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 divide-y divide-slate-200/60 dark:divide-slate-800">
          {summary.entries.map((entry) => (
            <div
              key={entry.txn.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-slate-900 dark:text-white font-medium">
                  <span>{entry.chargeType}</span>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-slate-500">{entry.txn.date}</span>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-500">Matched "{entry.matchedKeyword}"</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {redactSensitiveText(entry.txn.rawNarration, privacyMode)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                  -{formatINR(entry.txn.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
