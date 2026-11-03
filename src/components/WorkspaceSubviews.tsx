import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Bot,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  History,
  Link2,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccountRecord,
  BudgetAllocation,
  DebtLiability,
  FullDatabaseSnapshot,
  PaymentMode,
  RecurringCommitment,
  SavingsGoal,
  StatementColumnMapping,
  StatementImportPreview,
  TransactionDirection,
  TransactionLinkType,
  TransactionRecord,
  TransactionSplitItem,
  TransactionType,
} from '../types/finance';
import {
  calculateAccountReconciliations,
  calculateFinancialHealthScore,
  calculateFutureBalanceForecast,
  formatINRPaise,
  fromPaise,
  queryLocalFinancialAssistant,
  replayHistoricalBalance,
  runDataQualityAndAnomalyChecks,
  toPaise,
} from '../services/financeEngine';

// ============================================================================
// 1. TRANSACTIONS LEDGER & CRUD / SPLIT / LINK / BULK EDIT VIEW (Section 6)
// ============================================================================
interface TransactionsManagerViewProps {
  snapshot: FullDatabaseSnapshot;
  initialCategoryFilter?: string;
  initialPersonFilter?: string;
  initialSearchQuery?: string;
  onSaveTransaction: (tx: TransactionRecord, isNew: boolean) => void;
  onDeleteTransactions: (ids: string[]) => void;
  onBulkUpdateTransactions: (
    ids: string[],
    updates: { category?: string; addTag?: string; transactionType?: TransactionType }
  ) => void;
  onSplitTransaction: (txId: string, splits: TransactionSplitItem[]) => void;
  onLinkTransactions: (primaryId: string, secondaryId: string, linkType: TransactionLinkType) => void;
}

export const TransactionsManagerView: React.FC<TransactionsManagerViewProps> = ({
  snapshot,
  initialCategoryFilter = 'ALL',
  initialPersonFilter = '',
  initialSearchQuery = '',
  onSaveTransaction,
  onDeleteTransactions,
  onBulkUpdateTransactions,
  onSplitTransaction,
  onLinkTransactions,
}) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryFilter || 'ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [personFilter, setPersonFilter] = useState<string>(initialPersonFilter);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmountInr, setMinAmountInr] = useState('');
  const [maxAmountInr, setMaxAmountInr] = useState('');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>(
    'DATE_DESC'
  );
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Sync external filters
  React.useEffect(() => {
    if (initialCategoryFilter) setCategoryFilter(initialCategoryFilter);
  }, [initialCategoryFilter]);
  React.useEffect(() => {
    if (initialPersonFilter !== undefined) setPersonFilter(initialPersonFilter);
  }, [initialPersonFilter]);
  React.useEffect(() => {
    if (initialSearchQuery !== undefined) setSearch(initialSearchQuery);
  }, [initialSearchQuery]);

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkTag, setBulkTag] = useState('');

  // Edit / Create Modal
  const [editingTx, setEditingTx] = useState<TransactionRecord | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Split Modal
  const [splittingTx, setSplittingTx] = useState<TransactionRecord | null>(null);
  const [splitRows, setSplitRows] = useState<
    Array<{ category: string; amountInr: string; notes: string }>
  >([]);

  // Link Modal
  const [linkingTx, setLinkingTx] = useState<TransactionRecord | null>(null);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkType, setLinkType] = useState<TransactionLinkType>('PAYMENT_REFUND');

  // Delete Confirmation
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const p = personFilter.trim().toLowerCase();
    const minPaise = minAmountInr ? toPaise(parseFloat(minAmountInr)) : null;
    const maxPaise = maxAmountInr ? toPaise(parseFloat(maxAmountInr)) : null;

    const list = snapshot.transactions.filter((tx) => {
      if (directionFilter !== 'ALL' && tx.direction !== directionFilter) return false;
      if (typeFilter !== 'ALL' && tx.transactionType !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
      if (modeFilter !== 'ALL' && tx.paymentMode !== modeFilter) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      if (minPaise !== null && tx.amountPaise < minPaise) return false;
      if (maxPaise !== null && tx.amountPaise > maxPaise) return false;
      if (p && !tx.counterpartyName.toLowerCase().includes(p)) return false;
      if (q) {
        const hay = `${tx.counterpartyName} ${tx.rawDescription} ${tx.category} ${
          tx.referenceNumber
        } ${tx.upiId} ${tx.userNotes} ${tx.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'DATE_DESC') return b.date.localeCompare(a.date);
      if (sortBy === 'DATE_ASC') return a.date.localeCompare(b.date);
      if (sortBy === 'AMOUNT_DESC') return b.amountPaise - a.amountPaise;
      return a.amountPaise - b.amountPaise;
    });
  }, [
    snapshot.transactions,
    search,
    directionFilter,
    typeFilter,
    categoryFilter,
    modeFilter,
    personFilter,
    dateFrom,
    dateTo,
    minAmountInr,
    maxAmountInr,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const openNewTxModal = () => {
    const nowIso = new Date().toISOString();
    setIsCreatingNew(true);
    setEditingTx({
      id: `tx-manual-${Date.now()}`,
      date: nowIso.slice(0, 10),
      amountPaise: 0,
      direction: 'DEBIT',
      transactionType: 'EXPENSE',
      category: 'Food & Dining',
      subCategory: 'General',
      counterpartyName: '',
      upiId: '',
      referenceNumber: '',
      paymentMode: 'UPI',
      accountId: snapshot.accounts[0]?.id || 'acc-default-primary',
      rawDescription: '',
      userNotes: '',
      tags: [],
      runningBalancePaise: null,
      confidenceScore: 100,
      isEdited: true,
      isSplitParent: false,
      isFlaggedAnomaly: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Ledger ({filteredTransactions.length} matching)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNewTxModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Manual Transaction
          </button>
        </div>
      </div>

      {/* Combined Filters Bar (Section 6.2) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, counterparty, UTR, UPI ID, notes, #tags..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <select
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value as typeof directionFilter);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Directions (Credit & Debit)</option>
            <option value="CREDIT">Credit Only (Inflow)</option>
            <option value="DEBIT">Debit Only (Outflow)</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Categories</option>
            {snapshot.categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="DATE_DESC">Sort: Newest Date First</option>
            <option value="DATE_ASC">Sort: Oldest Date First</option>
            <option value="AMOUNT_DESC">Sort: Largest Amount First</option>
            <option value="AMOUNT_ASC">Sort: Smallest Amount First</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Txn Types</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="INTERNAL_TRANSFER">Internal Transfer</option>
            <option value="REFUND">Refund / Reversal</option>
            <option value="LOAN_SETTLEMENT">Loan / Settlement</option>
          </select>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="UPI">UPI</option>
            <option value="IMPS">IMPS</option>
            <option value="NEFT">NEFT</option>
            <option value="ATM">ATM</option>
            <option value="POS">POS</option>
            <option value="NACH">NACH</option>
            <option value="CHARGE">Bank Charge</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            title="Start Date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            title="End Date"
          />
          <input
            type="number"
            placeholder="Min ₹"
            value={minAmountInr}
            onChange={(e) => setMinAmountInr(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDirectionFilter('ALL');
              setTypeFilter('ALL');
              setCategoryFilter('ALL');
              setModeFilter('ALL');
              setPersonFilter('');
              setDateFrom('');
              setDateTo('');
              setMinAmountInr('');
              setMaxAmountInr('');
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-blue-900 dark:text-blue-200">
            {selectedIds.length} transactions selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="px-2.5 py-1 rounded border border-blue-300 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="">Set Category...</option>
              {snapshot.categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Add #Tag"
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              className="px-2.5 py-1 rounded border border-blue-300 bg-white dark:bg-slate-900 text-xs w-28"
            />
            <button
              type="button"
              onClick={() => {
                onBulkUpdateTransactions(selectedIds, {
                  category: bulkCategory || undefined,
                  addTag: bulkTag.trim() || undefined,
                });
                setSelectedIds([]);
                setBulkCategory('');
                setBulkTag('');
              }}
              className="px-3 py-1 rounded bg-blue-600 text-white font-semibold cursor-pointer"
            >
              Apply Bulk Update
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteIds(selectedIds)}
              className="px-3 py-1 rounded bg-rose-600 text-white font-semibold cursor-pointer"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase text-slate-500">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      paginatedTransactions.length > 0 &&
                      paginatedTransactions.every((t) => selectedIds.includes(t.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(paginatedTransactions.map((t) => t.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Counterparty & Narration</th>
                <th className="py-2.5 px-3">Category / Type</th>
                <th className="py-2.5 px-3">Mode / UTR</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions match the active filters.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tx.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, tx.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== tx.id));
                          }
                        }}
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">{tx.date}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{tx.counterpartyName}</span>
                        {tx.isSplitParent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            Split ({tx.splits?.length})
                          </span>
                        )}
                        {tx.linkedTransactionId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            Linked ({tx.linkType})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md">
                        {tx.rawDescription}
                      </div>
                      {tx.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tx.tags.map((tg) => (
                            <span
                              key={tg}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400"
                            >
                              {tg}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {tx.category}
                      </div>
                      <div className="text-[10px] text-slate-400">{tx.transactionType}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      <div>{tx.paymentMode}</div>
                      {tx.referenceNumber && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                          Ref: {tx.referenceNumber}
                        </div>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        tx.direction === 'CREDIT'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.direction === 'CREDIT' ? '+' : '-'}
                      {formatINRPaise(tx.amountPaise)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {tx.runningBalancePaise !== null
                        ? formatINRPaise(tx.runningBalancePaise)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNew(false);
                          setEditingTx({ ...tx });
                        }}
                        className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                        title="Edit Transaction"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSplittingTx(tx);
                          setSplitRows([
                            {
                              category: tx.category,
                              amountInr: (fromPaise(tx.amountPaise) / 2).toFixed(2),
                              notes: 'Part 1',
                            },
                            {
                              category: 'Shopping',
                              amountInr: (fromPaise(tx.amountPaise) / 2).toFixed(2),
                              notes: 'Part 2',
                            },
                          ]);
                        }}
                        className="p-1 text-slate-500 hover:text-purple-600 cursor-pointer"
                        title="Split Transaction Across Categories"
                      >
                        <Scissors className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkingTx(tx);
                          setLinkTargetId('');
                        }}
                        className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                        title="Link Refund / Transfer / Settlement"
                      >
                        <Link2 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIds([tx.id])}
                        className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Page {page} of {totalPages} ({filteredTransactions.length} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveTransaction(editingTx, isCreatingNew);
              setEditingTx(null);
            }}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isCreatingNew ? 'Add Manual Transaction' : 'Edit Transaction Details'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editingTx.date}
                  onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fromPaise(editingTx.amountPaise) || ''}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      amountPaise: toPaise(parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Direction</label>
                <select
                  value={editingTx.direction}
                  onChange={(e) => {
                    const dir = e.target.value as TransactionDirection;
                    setEditingTx({
                      ...editingTx,
                      direction: dir,
                      transactionType: dir === 'CREDIT' ? 'INCOME' : 'EXPENSE',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="DEBIT">Debit (Money Out)</option>
                  <option value="CREDIT">Credit (Money In)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Transaction Type</label>
                <select
                  value={editingTx.transactionType}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      transactionType: e.target.value as TransactionType,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                  <option value="INTERNAL_TRANSFER">Internal / Self Transfer</option>
                  <option value="REFUND">Refund / Reversal</option>
                  <option value="LOAN_SETTLEMENT">Loan / Settlement</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={editingTx.category}
                  onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {snapshot.categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Mode</label>
                <select
                  value={editingTx.paymentMode}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, paymentMode: e.target.value as PaymentMode })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="UPI">UPI</option>
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="ATM">ATM / Cash</option>
                  <option value="POS">POS / Card</option>
                  <option value="NACH">NACH</option>
                  <option value="CHARGE">Bank Charge</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block font-semibold mb-1">Counterparty / Person / Merchant</label>
                <input
                  type="text"
                  required
                  value={editingTx.counterpartyName}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, counterpartyName: e.target.value })
                  }
                  placeholder="e.g., Swiggy, Aryan, Reliance Jio"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold mb-1">Description / Narration</label>
                <input
                  type="text"
                  value={editingTx.rawDescription}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, rawDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editingTx.tags.join(', ')}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      tags: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="#GoaTrip, #Reimbursable, #Tax80C"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save Transaction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Split Transaction Modal (Section 6.4) */}
      {splittingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Split Transaction ({formatINRPaise(splittingTx.amountPaise)})
              </h3>
              <button
                type="button"
                onClick={() => setSplittingTx(null)}
                className="p-1 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">
              Divide this payment to <strong>{splittingTx.counterpartyName}</strong> across multiple
              categories.
            </p>
            <div className="space-y-2">
              {splitRows.map((r, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <select
                    value={r.category}
                    onChange={(e) => {
                      const next = [...splitRows];
                      next[i].category = e.target.value;
                      setSplitRows(next);
                    }}
                    className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {snapshot.categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={r.amountInr}
                    onChange={(e) => {
                      const next = [...splitRows];
                      next[i].amountInr = e.target.value;
                      setSplitRows(next);
                    }}
                    className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={r.notes}
                    onChange={(e) => {
                      const next = [...splitRows];
                      next[i].notes = e.target.value;
                      setSplitRows(next);
                    }}
                    className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSplittingTx(null)}
                className="px-3 py-1.5 rounded border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const items: TransactionSplitItem[] = splitRows.map((r, idx) => ({
                    id: `split-${Date.now()}-${idx}`,
                    category: r.category,
                    subCategory: 'Split Item',
                    amountPaise: toPaise(parseFloat(r.amountInr) || 0),
                    notes: r.notes,
                    tags: [],
                  }));
                  onSplitTransaction(splittingTx.id, items);
                  setSplittingTx(null);
                }}
                className="px-4 py-1.5 rounded bg-purple-600 text-white font-semibold cursor-pointer"
              >
                Save Split Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Transaction Relationship Modal (Section 6.5) */}
      {linkingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Link Related Transaction
              </h3>
              <button
                type="button"
                onClick={() => setLinkingTx(null)}
                className="p-1 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">
              Link <strong>{linkingTx.counterpartyName}</strong> ({formatINRPaise(linkingTx.amountPaise)})
              with a corresponding refund, reimbursement, or internal transfer pair.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Relationship Type</label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as TransactionLinkType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="PAYMENT_REFUND">Payment ↔ Refund Pair</option>
                  <option value="EXPENSE_REIMBURSEMENT">Expense ↔ Reimbursement</option>
                  <option value="TRANSFER_PAIR">Outgoing ↔ Incoming Account Transfer</option>
                  <option value="LOAN_REPAYMENT">Loan Given ↔ Repayment</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Select Counterpart Transaction</label>
                <select
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Choose a transaction...</option>
                  {snapshot.transactions
                    .filter((t) => t.id !== linkingTx.id)
                    .slice(0, 60)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.date} — {t.counterpartyName} ({t.direction}{' '}
                        {formatINRPaise(t.amountPaise)})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkingTx(null)}
                className="px-3 py-1.5 rounded border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!linkTargetId}
                onClick={() => {
                  onLinkTransactions(linkingTx.id, linkTargetId, linkType);
                  setLinkingTx(null);
                }}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white font-semibold disabled:opacity-40 cursor-pointer"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Section 6.1) */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-rose-600">
              Confirm Deletion ({confirmDeleteIds.length} transaction
              {confirmDeleteIds.length > 1 ? 's' : ''})
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to remove the selected transaction(s) from your local IndexedDB
              ledger? This action is logged in the Audit Trail and can be undone from Backup/Audit.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransactions(confirmDeleteIds);
                  setSelectedIds((prev) =>
                    prev.filter((id) => !confirmDeleteIds.includes(id))
                  );
                  setConfirmDeleteIds(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. STATEMENT IMPORT WIZARD & STATEMENT REGISTRY VIEW (Section 7)
// ============================================================================
interface StatementManagerViewProps {
  snapshot: FullDatabaseSnapshot;
  activePreview: StatementImportPreview | null;
  isParsing: boolean;
  onSelectFileForPreview: (file: File) => Promise<void>;
  onRemapColumns: (newMapping: StatementColumnMapping) => void;
  onToggleCandidateRow: (rowIndex: number, selected: boolean) => void;
  onConfirmImportPreview: (targetAccountId: string) => void;
  onCancelPreview: () => void;
  onRollbackStatement: (statementId: string) => void;
}

export const StatementManagerView: React.FC<StatementManagerViewProps> = ({
  snapshot,
  activePreview,
  isParsing,
  onSelectFileForPreview,
  onRemapColumns,
  onToggleCandidateRow,
  onConfirmImportPreview,
  onCancelPreview,
  onRollbackStatement,
}) => {
  const [targetAccountId, setTargetAccountId] = useState(
    snapshot.accounts[0]?.id || 'acc-default-primary'
  );
  const [previewTab, setPreviewTab] = useState<'VALID' | 'DUPLICATES' | 'INVALID' | 'MAPPING'>(
    'VALID'
  );

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await onSelectFileForPreview(f);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileUp className="w-5 h-5 text-blue-600" />
            <span>Import & Statements</span>
          </h2>
          <p className="text-xs text-slate-500">
            PDF, CSV, XLS, XLSX · duplicate-safe · one-tap rollback
          </p>
        </div>
      </div>

      {/* Upload Dropzone */}
      {!activePreview && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20 p-8 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Drop a statement here or browse
            </h3>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              PDF, CSV, XLS or XLSX. Nothing is saved until you confirm the preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold cursor-pointer shadow-xs">
              <FileUp className="w-4 h-4" />
              <span>{isParsing ? 'Analyzing Statement...' : 'Choose Statement File'}</span>
              <input
                type="file"
                accept=".pdf,.csv,.xls,.xlsx,.txt,.tsv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onSelectFileForPreview(f);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Active Import Preview & Verification Step (Section 7.2 & 7.3) */}
      {activePreview && (
        <div
          data-testid="statement-import-preview-card"
          className="rounded-2xl border-2 border-blue-500/80 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold">
                STEP 2 OF 2: VERIFY STATEMENT PREVIEW BEFORE SAVING
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {activePreview.fileName} ({activePreview.format})
              </h3>
              <p className="text-xs text-slate-500">
                Bank: <strong>{activePreview.bankName}</strong> • Account:{' '}
                <strong>{activePreview.accountNumberMasked}</strong> • Period:{' '}
                <strong>
                  {activePreview.statementPeriodStart || 'N/A'} to{' '}
                  {activePreview.statementPeriodEnd || 'N/A'}
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                {snapshot.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Import into: {acc.accountName} ({acc.accountNumberMasked})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onCancelPreview}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Discard Preview
              </button>

              <button
                type="button"
                data-testid="confirm-import-statement-btn"
                disabled={
                  activePreview.candidates.filter((c) => c.selectedForImport && c.isValid)
                    .length === 0
                }
                onClick={() => onConfirmImportPreview(targetAccountId)}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Save{' '}
                {
                  activePreview.candidates.filter((c) => c.selectedForImport && c.isValid)
                    .length
                }{' '}
                Transactions
              </button>
            </div>
          </div>

          {/* Error Banner if Password Protected or Scanned PDF */}
          {activePreview.errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Statement Import Diagnostic Alert</div>
                <p className="mt-0.5">{activePreview.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Summary Reconciliation Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] uppercase text-slate-500">Total Parsed Rows</div>
              <div className="text-base font-bold font-mono mt-0.5">
                {activePreview.candidates.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <div className="text-[10px] uppercase text-slate-500">Selected to Import</div>
              <div className="text-base font-bold font-mono text-emerald-600 mt-0.5">
                {
                  activePreview.candidates.filter((c) => c.selectedForImport && c.isValid)
                    .length
                }
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <div className="text-[10px] uppercase text-slate-500">Duplicates Flagged</div>
              <div className="text-base font-bold font-mono text-amber-600 mt-0.5">
                {activePreview.candidates.filter((c) => c.isDuplicate).length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
              <div className="text-[10px] uppercase text-slate-500">Invalid / Rejected</div>
              <div className="text-base font-bold font-mono text-rose-600 mt-0.5">
                {activePreview.candidates.filter((c) => !c.isValid).length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] uppercase text-slate-500">Preview Total Credit</div>
              <div className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                {formatINRPaise(activePreview.creditTotalPaise)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] uppercase text-slate-500">Preview Total Debit</div>
              <div className="text-sm font-bold font-mono text-rose-600 mt-0.5">
                {formatINRPaise(activePreview.debitTotalPaise)}
              </div>
            </div>
          </div>

          {/* Preview Sub-tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
            <button
              type="button"
              onClick={() => setPreviewTab('VALID')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewTab === 'VALID'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Valid Rows ({activePreview.candidates.filter((c) => c.isValid).length})
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('DUPLICATES')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewTab === 'DUPLICATES'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Duplicates ({activePreview.candidates.filter((c) => c.isDuplicate).length})
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('INVALID')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                previewTab === 'INVALID'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Invalid / Rejected ({activePreview.candidates.filter((c) => !c.isValid).length})
            </button>
            {activePreview.format !== 'PDF' && (
              <button
                type="button"
                onClick={() => setPreviewTab('MAPPING')}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  previewTab === 'MAPPING'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Manual Column Mapping
              </button>
            )}
          </div>

          {previewTab === 'MAPPING' && activePreview.detectedHeaders.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Date Column</label>
                <select
                  value={activePreview.columnMapping.dateColumnIndex}
                  onChange={(e) =>
                    onRemapColumns({
                      ...activePreview.columnMapping,
                      dateColumnIndex: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white dark:bg-slate-900"
                >
                  {activePreview.detectedHeaders.map((h, idx) => (
                    <option key={idx} value={idx}>
                      Col {idx + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description Column</label>
                <select
                  value={activePreview.columnMapping.descriptionColumnIndex}
                  onChange={(e) =>
                    onRemapColumns({
                      ...activePreview.columnMapping,
                      descriptionColumnIndex: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white dark:bg-slate-900"
                >
                  {activePreview.detectedHeaders.map((h, idx) => (
                    <option key={idx} value={idx}>
                      Col {idx + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Candidate Rows Table */}
          {previewTab !== 'MAPPING' && (
            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                    <th className="py-2 px-3">Import</th>
                    <th className="py-2 px-3">Row #</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Counterparty & Narration</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Status / Diagnostic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activePreview.candidates
                    .filter((c) => {
                      if (previewTab === 'VALID') return c.isValid;
                      if (previewTab === 'DUPLICATES') return c.isDuplicate;
                      return !c.isValid;
                    })
                    .map((row) => (
                      <tr key={row.rowIndex}>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            disabled={!row.isValid}
                            checked={row.selectedForImport}
                            onChange={(e) =>
                              onToggleCandidateRow(row.rowIndex, e.target.checked)
                            }
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">#{row.rowIndex}</td>
                        <td className="py-2 px-3 font-mono">{row.date}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {row.counterpartyName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-sm">
                            {row.rawDescription}
                          </div>
                        </td>
                        <td className="py-2 px-3">{row.category}</td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            row.direction === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {row.direction === 'CREDIT' ? '+' : '-'}
                          {formatINRPaise(row.amountPaise)}
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          {!row.isValid ? (
                            <span className="text-rose-600 font-semibold">
                              Invalid: {row.validationErrors.join(', ')}
                            </span>
                          ) : row.isDuplicate ? (
                            <span className="text-amber-600 font-semibold">
                              Duplicate: {row.duplicateReason}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Imported Statement History Registry (Section 7.5) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Imported Statements Registry ({snapshot.statements.length})
        </h3>
        {snapshot.statements.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No statements have been imported yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                  <th className="py-2 pr-3">File Name</th>
                  <th className="py-2 px-3">Format</th>
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">Imported Txns</th>
                  <th className="py-2 px-3">Credits / Debits</th>
                  <th className="py-2 px-3">Reconciliation</th>
                  <th className="py-2 pl-3 text-right">Rollback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {snapshot.statements.map((st) => (
                  <tr key={st.id}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                      {st.fileName}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{st.fileFormat}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {st.statementPeriodStart} → {st.statementPeriodEnd}
                    </td>
                    <td className="py-2.5 px-3">
                      {st.validRowsImported} imported ({st.duplicateRowsSkipped} dup skipped)
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="text-emerald-600">+{formatINRPaise(st.creditTotalPaise)}</span>{' '}
                      / <span className="text-rose-600">-{formatINRPaise(st.debitTotalPaise)}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.reconciliationStatus === 'RECONCILED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {st.reconciliationStatus}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRollbackStatement(st.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback Import
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ACCOUNTS, BUDGETS, GOALS, FORECASTING & FINANCIAL PLANNING VIEW (Sections 14-18)
// ============================================================================
interface AccountsAndPlanningViewProps {
  snapshot: FullDatabaseSnapshot;
  onAddAccount: (acc: Omit<AccountRecord, 'id' | 'createdAt'>) => void;
  onAddOrUpdateBudget: (budget: Omit<BudgetAllocation, 'id'>) => void;
  onAddSavingsGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  onAddRecurringCommitment: (commitment: Omit<RecurringCommitment, 'id'>) => void;
}

export const AccountsAndPlanningView: React.FC<AccountsAndPlanningViewProps> = ({
  snapshot,
  onAddAccount,
  onAddOrUpdateBudget,
  onAddSavingsGoal,
  onAddRecurringCommitment,
}) => {
  const reconciliations = useMemo(
    () => calculateAccountReconciliations(snapshot.accounts, snapshot.transactions),
    [snapshot.accounts, snapshot.transactions]
  );

  // Historical Balance Replay date
  const [replayDate, setReplayDate] = useState(new Date().toISOString().slice(0, 10));
  const replayedBalancePaise = useMemo(
    () => replayHistoricalBalance(snapshot.transactions, snapshot.accounts, replayDate),
    [snapshot.transactions, snapshot.accounts, replayDate]
  );

  // Budget Form
  const [budgetCategory, setBudgetCategory] = useState('Food & Dining');
  const [budgetLimitInr, setBudgetLimitInr] = useState('');

  // Savings Goal Form
  const [goalName, setGoalName] = useState('');
  const [goalTargetInr, setGoalTargetInr] = useState('');
  const [goalSavedInr, setGoalSavedInr] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('2026-12-31');

  // What-If Simulator & Future Balance Predictor (Section 17)
  const [whatIfScenario, setWhatIfScenario] = useState<'EXPECTED' | 'OPTIMISTIC' | 'CAUTIOUS'>(
    'EXPECTED'
  );
  const [whatIfExtraSaveInr, setWhatIfExtraSaveInr] = useState('0');
  const [whatIfOneTimeExpenseInr, setWhatIfOneTimeExpenseInr] = useState('0');

  // Inflation Calculator
  const [inflationPresentInr, setInflationPresentInr] = useState('100000');
  const [inflationRatePct, setInflationRatePct] = useState('6.5');
  const [inflationYears, setInflationYears] = useState('10');

  const currentTotalBalancePaise = reconciliations.reduce(
    (acc, r) => acc + r.calculatedBalancePaise,
    0
  );

  const forecastPoints = useMemo(
    () =>
      calculateFutureBalanceForecast(
        currentTotalBalancePaise,
        snapshot.transactions,
        snapshot.commitments,
        90,
        whatIfScenario,
        {
          monthlyExpenseCutPaise: toPaise(parseFloat(whatIfExtraSaveInr) || 0),
          extraMonthlyIncomePaise: 0,
          oneTimePurchasePaise: toPaise(parseFloat(whatIfOneTimeExpenseInr) || 0),
        }
      ),
    [
      currentTotalBalancePaise,
      snapshot.transactions,
      snapshot.commitments,
      whatIfScenario,
      whatIfExtraSaveInr,
      whatIfOneTimeExpenseInr,
    ]
  );

  const futureInflationValue = useMemo(() => {
    const pv = parseFloat(inflationPresentInr) || 0;
    const r = (parseFloat(inflationRatePct) || 0) / 100;
    const n = parseFloat(inflationYears) || 0;
    return pv * Math.pow(1 + r, n);
  }, [inflationPresentInr, inflationRatePct, inflationYears]);

  return (
    <div className="space-y-6">
      {/* Multi-Account Reconciliation & Historical Balance Replay (Section 14 & 25) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Bank Accounts</span>
            </h3>
            <p className="text-xs text-slate-500">
              Opening + credits − debits vs. statement closing balance
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
            <History className="w-4 h-4 text-blue-600" />
            <span className="font-semibold">Balance Replay on Date:</span>
            <input
              type="date"
              value={replayDate}
              onChange={(e) => setReplayDate(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
            />
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {formatINRPaise(replayedBalancePaise)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reconciliations.map((rec) => (
            <div
              key={rec.account.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {rec.account.accountName} ({rec.account.bankName})
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    A/c: {rec.account.accountNumberMasked}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    rec.isReconciled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {rec.isReconciled ? 'RECONCILED' : 'DIFF DETECTED'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                <div>
                  <div className="text-[10px] text-slate-400">Opening</div>
                  <div className="font-mono font-semibold">
                    {formatINRPaise(rec.account.openingBalancePaise)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Net Credits - Debits</div>
                  <div className="font-mono font-semibold">
                    {formatINRPaise(rec.totalCreditsPaise - rec.totalDebitsPaise)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Current Balance</div>
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatINRPaise(rec.calculatedBalancePaise)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Budgets & Savings Goals (Section 15 & 16) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Budgets */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Monthly Category Budgets (with 75% / 90% / 100% Alerts)
          </h3>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const limitPaise = toPaise(parseFloat(budgetLimitInr) || 0);
              if (limitPaise <= 0) return;
              onAddOrUpdateBudget({
                categoryName: budgetCategory,
                periodMonth: 'ALL_MONTHS',
                limitPaise,
                rolloverUnused: true,
                alertThresholdsPercent: [75, 90, 100],
              });
              setBudgetLimitInr('');
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"
          >
            <select
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              {snapshot.categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              required
              placeholder="Monthly Limit (₹)"
              value={budgetLimitInr}
              onChange={(e) => setBudgetLimitInr(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
            >
              Set Budget
            </button>
          </form>

          {snapshot.budgets.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No monthly budgets configured yet. Set a category limit above.
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.budgets.map((b) => {
                const spentPaise = snapshot.transactions
                  .filter((t) => t.direction === 'DEBIT' && t.category === b.categoryName)
                  .reduce((acc, t) => acc + t.amountPaise, 0);
                const pct = b.limitPaise > 0 ? (spentPaise / b.limitPaise) * 100 : 0;
                return (
                  <div key={b.id} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">{b.categoryName}</span>
                      <span className="font-mono">
                        {formatINRPaise(spentPaise)} / {formatINRPaise(b.limitPaise)} (
                        {pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 100
                            ? 'bg-rose-600'
                            : pct >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Savings Goals */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Savings Goals & Emergency Fund Tracker
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!goalName.trim()) return;
              onAddSavingsGoal({
                name: goalName.trim(),
                targetAmountPaise: toPaise(parseFloat(goalTargetInr) || 0),
                currentSavedPaise: toPaise(parseFloat(goalSavedInr) || 0),
                targetDate: goalTargetDate,
                color: '#10b981',
                notes: '',
              });
              setGoalName('');
              setGoalTargetInr('');
              setGoalSavedInr('');
            }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
          >
            <input
              type="text"
              required
              placeholder="Goal Name"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <input
              type="number"
              required
              placeholder="Target ₹"
              value={goalTargetInr}
              onChange={(e) => setGoalTargetInr(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
            <input
              type="number"
              placeholder="Saved ₹"
              value={goalSavedInr}
              onChange={(e) => setGoalSavedInr(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
            >
              Add Goal
            </button>
          </form>

          {snapshot.goals.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No savings goals added yet.
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.goals.map((g) => {
                const pct =
                  g.targetAmountPaise > 0
                    ? (g.currentSavedPaise / g.targetAmountPaise) * 100
                    : 0;
                return (
                  <div key={g.id} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">{g.name}</span>
                      <span className="font-mono">
                        {formatINRPaise(g.currentSavedPaise)} /{' '}
                        {formatINRPaise(g.targetAmountPaise)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Future Balance Predictor, What-If Simulator & Inflation Calculator (Section 16 & 17) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              90-Day Future Balance Predictor & What-If Simulator
            </h3>
            <select
              value={whatIfScenario}
              onChange={(e) => setWhatIfScenario(e.target.value as typeof whatIfScenario)}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value="EXPECTED">Expected Scenario</option>
              <option value="OPTIMISTIC">Optimistic (+10% Inflow / -15% Spend)</option>
              <option value="CAUTIOUS">Cautious (-10% Inflow / +20% Spend)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">
                What-If Monthly Expense Reduction (₹)
              </label>
              <input
                type="number"
                value={whatIfExtraSaveInr}
                onChange={(e) => setWhatIfExtraSaveInr(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">What-If One-Time Purchase (₹)</label>
              <input
                type="number"
                value={whatIfOneTimeExpenseInr}
                onChange={(e) => setWhatIfOneTimeExpenseInr(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            {[29, 59, 89].map((dayIdx) => {
              const pt = forecastPoints[dayIdx];
              if (!pt) return null;
              return (
                <div
                  key={dayIdx}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="text-[10px] uppercase text-slate-500">+{dayIdx + 1} Days</div>
                  <div
                    className={`font-mono font-bold text-sm mt-1 ${
                      pt.projectedBalancePaise >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatINRPaise(pt.projectedBalancePaise)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inflation & Purchasing Power Calculator */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>Inflation & Future Purchasing Power Calculator</span>
          </h3>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Current Cost (₹)</label>
              <input
                type="number"
                value={inflationPresentInr}
                onChange={(e) => setInflationPresentInr(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Inflation (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                value={inflationRatePct}
                onChange={(e) => setInflationRatePct(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Horizon (Years)</label>
              <input
                type="number"
                value={inflationYears}
                onChange={(e) => setInflationYears(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
            <span>
              Future corpus required in <strong>{inflationYears} years</strong> to match today's
              value:
            </span>
            <span className="font-mono font-bold text-base text-blue-700 dark:text-blue-300">
              {formatINRPaise(toPaise(futureInflationValue))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. COMMAND CENTER, DATA QUALITY, LOCAL AI ASSISTANT, BACKUP & AUDIT VIEW (Sections 19-35)
// ============================================================================
interface CommandQualityAndSettingsViewProps {
  snapshot: FullDatabaseSnapshot;
  storageUsageBytes: number;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrintReport: () => void;
  onDownloadJsonBackup: () => void;
  onRestoreBackupFile: (file: File, mode: 'REPLACE' | 'MERGE') => Promise<void>;
  onClearAllDatabase: () => void;
}

export const CommandQualityAndSettingsView: React.FC<CommandQualityAndSettingsViewProps> = ({
  snapshot,
  storageUsageBytes,
  onExportCsv,
  onExportExcel,
  onPrintReport,
  onDownloadJsonBackup,
  onRestoreBackupFile,
  onClearAllDatabase,
}) => {
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantHistory, setAssistantHistory] = useState<
    Array<{ q: string; answer: string; sumPaise?: number; count?: number }>
  >([]);
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const qualityIssues = useMemo(
    () => runDataQualityAndAnomalyChecks(snapshot.transactions, snapshot.accounts),
    [snapshot.transactions, snapshot.accounts]
  );

  const handleAskLocalAssistant = (qText: string) => {
    if (!qText.trim()) return;
    const res = queryLocalFinancialAssistant(qText, snapshot.transactions, snapshot.people);
    setAssistantHistory((prev) => [
      {
        q: qText,
        answer: res.answerText,
        sumPaise: res.computedSumPaise,
        count: res.matchedTransactions.length,
      },
      ...prev,
    ]);
    setAssistantQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Section 24: 100% Local AI Financial Assistant */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <span>Ask your ledger</span>
            </h3>
            <p className="text-xs text-slate-500">
              Runs on this device. Your data never leaves it.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskLocalAssistant(assistantQuery);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={assistantQuery}
            onChange={(e) => setAssistantQuery(e.target.value)}
            placeholder='Ask e.g. "Where did my money go?", "Largest expense", "Total credits", "How much did I send to Aryan?"'
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Ask Local Assistant
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            'Where did my money go?',
            'Show largest expense',
            'Show total credits',
            'Show uncategorized transactions',
            'Show duplicate candidates',
          ].map((sampleQ) => (
            <button
              key={sampleQ}
              type="button"
              onClick={() => handleAskLocalAssistant(sampleQ)}
              className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              "{sampleQ}"
            </button>
          ))}
        </div>

        {assistantHistory.length > 0 && (
          <div className="space-y-2 pt-2">
            {assistantHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
              >
                <div className="font-semibold text-blue-600 dark:text-blue-400">Q: {item.q}</div>
                <div className="text-slate-800 dark:text-slate-200">{item.answer}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 20 & 22: Data Quality & Anomaly Detection Center */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Data Quality, Reconciliation & Anomaly Diagnostics ({qualityIssues.length})</span>
        </h3>
        {qualityIssues.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">
            Zero data quality issues or anomalies detected in your current ledger.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {qualityIssues.map((iss) => (
              <div
                key={iss.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{iss.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      iss.severity === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {iss.severity}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{iss.description}</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">
                  Action: {iss.suggestedAction}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 26 & 28: Reports, Exports & Versioned JSON Backup / Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export Financial Reports (CSV, Excel, Printable PDF)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Generate clean spreadsheets or formatted printable reports directly from your browser.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Transactions (.CSV)
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Workbook (.XLS)
            </button>
            <button
              type="button"
              onClick={onPrintReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Printable / PDF Financial Report
            </button>
          </div>
        </div>

        {/* Versioned JSON Backup, Restore & Storage Reset */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              IndexedDB Vault Backup, Restore & Reset
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Local Storage: {(storageUsageBytes / 1024).toFixed(1)} KB • Schema v
              {snapshot.schemaVersion}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={onDownloadJsonBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full JSON Backup
            </button>

            <select
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value as 'MERGE' | 'REPLACE')}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="MERGE">Restore Mode: Merge Safely</option>
              <option value="REPLACE">Restore Mode: Replace All</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore JSON Backup</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onRestoreBackupFile(f, restoreMode);
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => setConfirmClearModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Local Data
            </button>
          </div>
        </div>
      </div>

      {/* Audit Trail Log */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
          Local Audit Trail ({snapshot.auditTrail.length} recent actions)
        </h3>
        {snapshot.auditTrail.length === 0 ? (
          <p className="text-xs text-slate-400">No actions recorded in audit log yet.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {snapshot.auditTrail.slice(0, 20).map((entry) => (
              <div key={entry.id} className="py-1.5 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 mr-2">
                    {entry.actionType}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">{entry.summary}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(entry.timestamp).toLocaleTimeString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Clear All Database Modal */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-rose-600">
              Clear All Local Financial Data?
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              This will permanently wipe all transactions, statements, rules, and budgets from your
              browser's IndexedDB vault and return the app to its initial ₹0.00 launch state.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllDatabase();
                  setConfirmClearModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
              >
                Yes, Reset Database to ₹0.00
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
