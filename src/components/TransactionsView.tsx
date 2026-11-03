import React, { useState } from 'react';
import { Search, Download, Plus, X, Trash2 } from 'lucide-react';
import {
  Transaction,
  TransactionType,
  CategoryName,
  ALL_CATEGORIES,
  parseBankNarration,
  redactSensitiveText,
  formatINR,
} from '../utils/statementParser';

interface TransactionsViewProps {
  transactions: Transaction[];
  initialCategoryFilter: CategoryName | 'ALL';
  isRedacted: boolean;
  onClearCategoryFilter: () => void;
  onUpdateCategory: (id: string, category: CategoryName) => void;
  onToggleBusinessFlag: (id: string) => void;
  onUpdateEventTag: (id: string, eventTag: string | undefined) => void;
  onAddTransaction: (txn: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  initialCategoryFilter,
  isRedacted,
  onClearCategoryFilter,
  onUpdateCategory,
  onToggleBusinessFlag,
  onUpdateEventTag,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'UPI' | 'TRANSFER' | 'OTHER'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryName | 'ALL'>(initialCategoryFilter);

  // Sync when parent sets a category filter from Overview
  React.useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
  }, [initialCategoryFilter]);

  // Add manual transaction form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState('2026-10-25');
  const [newNarration, setNewNarration] = useState('');
  const [newType, setNewType] = useState<TransactionType>('DEBIT');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryName | 'AUTO'>('AUTO');
  const [newEventTag, setNewEventTag] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTransactions = transactions
    .filter((t) => {
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (channelFilter === 'UPI' && t.channel !== 'UPI') return false;
      if (channelFilter === 'TRANSFER' && t.channel !== 'NEFT' && t.channel !== 'IMPS') return false;
      if (channelFilter === 'OTHER' && ['UPI', 'NEFT', 'IMPS'].includes(t.channel)) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = t.counterparty.toLowerCase().includes(q);
        const matchNarr = t.rawNarration.toLowerCase().includes(q);
        const matchUpi = (t.upiId || '').toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        const matchTag = (t.eventTag || '').toLowerCase().includes(q);
        return matchName || matchNarr || matchUpi || matchCat || matchTag;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredCredits = filteredTransactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  const filteredDebits = filteredTransactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedNarr = newNarration.trim();
    const numericAmt = parseFloat(newAmount);

    if (!trimmedNarr) {
      setFormError('Please enter a BOI narration or counterparty name.');
      return;
    }
    if (!Number.isFinite(numericAmt) || numericAmt <= 0) {
      setFormError('Please enter a valid positive amount in INR.');
      return;
    }

    const parsed = parseBankNarration(trimmedNarr, newType);
    const chosenCat = newCategory === 'AUTO' ? parsed.category : newCategory;

    const newTxn: Transaction = {
      id: `manual-${Date.now()}`,
      date: newDate || '2026-10-25',
      rawNarration: trimmedNarr,
      counterparty: parsed.counterparty,
      upiId: parsed.upiId,
      bankCode: parsed.bankCode,
      referenceNo: parsed.referenceNo,
      remarks: parsed.remarks,
      channel: parsed.channel,
      type: newType,
      amount: numericAmt,
      category: chosenCat,
      isPerson: parsed.isPerson,
      isRecurring: parsed.isRecurring,
      eventTag: newEventTag.trim() ? newEventTag.trim() : parsed.eventTag,
    };

    onAddTransaction(newTxn);
    setNewNarration('');
    setNewAmount('');
    setNewEventTag('');
    setShowAddForm(false);
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Type',
      'Counterparty',
      'UPI ID',
      'Channel',
      'Category',
      'Event Tag',
      'Tax Type',
      'Amount (INR)',
      'Raw BOI Narration',
    ];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type,
      `"${t.counterparty.replace(/"/g, '""')}"`,
      t.upiId || '',
      t.channel,
      t.category,
      t.eventTag || '',
      t.isBusinessExpense ? 'Business/GST' : 'Personal',
      t.amount.toFixed(2),
      `"${t.rawNarration.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ArthaLedger_Normalized_BOI_Statement.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search transactions by UPI name, handle, hashtag, or narration"
              placeholder="Search UPI sender/receiver, @handle, #tag, or narration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Segmented Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Direction Segmented Control */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['ALL', 'CREDIT', 'DEBIT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? 'All Flows' : t === 'CREDIT' ? 'Credits (+)' : 'Debits (-)'}
                </button>
              ))}
            </div>

            {/* Channel Segmented Control */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['ALL', 'UPI', 'TRANSFER', 'OTHER'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    channelFilter === ch
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ch === 'ALL' ? 'All Channels' : ch === 'UPI' ? 'UPI Only' : ch === 'TRANSFER' ? 'NEFT / IMPS' : 'ACH / ATM'}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                const val = e.target.value as CategoryName | 'ALL';
                setCategoryFilter(val);
                if (val === 'ALL') onClearCategoryFilter();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </button>
          </div>
        </div>

        {/* Summary Sub-bar for Filtered Results */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <span>Showing {filteredTransactions.length} of {transactions.length} entries</span>
            {categoryFilter !== 'ALL' && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('ALL');
                    onClearCategoryFilter();
                  }}
                  className="font-sans font-medium text-blue-700 hover:underline"
                >
                  Clear "{categoryFilter}" filter
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 font-medium">Credits: +{formatINR(filteredCredits)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-900 font-medium">Debits: -{formatINR(filteredDebits)}</span>
            <span aria-hidden="true">·</span>
            <span>
              Net: {filteredCredits - filteredDebits >= 0 ? '+' : ''}
              {formatINR(filteredCredits - filteredDebits)}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Add Manual / UPI Transaction Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTransaction}
          className="rounded-xl border border-slate-300 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Log New Statement or UPI Transaction
              </h3>
              <p className="text-xs text-slate-500">
                Enter a BOI UPI narration (e.g., UPI/123456789012/DR/ROHIT SHARMA/SBIN/rohit@oksbi/Lunch) or plain name
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              aria-label="Close add transaction form"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div role="alert" className="text-xs font-medium text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label htmlFor="new-txn-date" className="block text-xs font-medium text-slate-700 mb-1">
                Date
              </label>
              <input
                id="new-txn-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="new-txn-narration" className="block text-xs font-medium text-slate-700 mb-1">
                BOI Narration or Counterparty
              </label>
              <input
                id="new-txn-narration"
                type="text"
                placeholder="UPI/629988112233/DR/KARAN MEHTA/HDFC/karan@okhdfc/Dinner"
                value={newNarration}
                onChange={(e) => setNewNarration(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-txn-type" className="block text-xs font-medium text-slate-700 mb-1">
                Flow Type
              </label>
              <select
                id="new-txn-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value as TransactionType)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="DEBIT">Debit (Sent / Spent)</option>
                <option value="CREDIT">Credit (Received)</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-txn-amount" className="block text-xs font-medium text-slate-700 mb-1">
                Amount (INR)
              </label>
              <input
                id="new-txn-amount"
                type="number"
                step="0.01"
                placeholder="1250"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-txn-cat" className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                id="new-txn-cat"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CategoryName | 'AUTO')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="AUTO">Auto-Detect</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Save Transaction
            </button>
          </div>
        </form>
      )}

      {/* Main High-Density Statement Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No transactions match your current filter criteria
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try clearing your search query or switching the category filter back to All Categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setChannelFilter('ALL');
                setCategoryFilter('ALL');
                onClearCategoryFilter();
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Extracted Counterparty & Raw BOI Narration</th>
                  <th className="py-3 px-4">Channel & Handle</th>
                  <th className="py-3 px-4">Category & Event Tag</th>
                  <th className="py-3 px-4">Tax Mode</th>
                  <th className="py-3 px-4 text-right">Credit / Debit</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {txn.date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {txn.type === 'CREDIT' ? 'From: ' : 'To: '}
                          {redactSensitiveText(txn.counterparty, isRedacted)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">
                          {txn.isSelfTransfer
                            ? 'Self / Family Transfer'
                            : txn.isPerson
                            ? 'Person (P2P)'
                            : 'Merchant'}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500 break-all max-w-xl">
                        {redactSensitiveText(txn.rawNarration, isRedacted)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {txn.channel}
                        {txn.bankCode ? ` · ${txn.bankCode}` : ''}
                      </div>
                      <div className="font-mono text-slate-500">
                        {redactSensitiveText(
                          txn.upiId || (txn.referenceNo ? `Ref ${txn.referenceNo}` : '—'),
                          isRedacted
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Category for ${txn.counterparty} on ${txn.date}`}
                          value={txn.category}
                          onChange={(e) => onUpdateCategory(txn.id, e.target.value as CategoryName)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:border-slate-300 focus:border-slate-900 focus:outline-none"
                        >
                          {ALL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label={`Event tag for ${txn.counterparty} on ${txn.date}`}
                          value={txn.eventTag || ''}
                          onChange={(e) =>
                            onUpdateEventTag(txn.id, e.target.value ? e.target.value : undefined)
                          }
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-700 hover:border-slate-300 focus:border-slate-900 focus:outline-none"
                        >
                          <option value="">+#Tag</option>
                          <option value="#EducationAndExams">#EducationAndExams</option>
                          <option value="#FestiveShopping">#FestiveShopping</option>
                          <option value="#GoaTrip">#GoaTrip</option>
                          <option value="#Diwali">#Diwali</option>
                          <option value="#HouseShifting">#HouseShifting</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onToggleBusinessFlag(txn.id)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                          txn.isBusiness
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {txn.isBusiness ? 'Business/GST' : 'Personal'}
                      </button>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                        txn.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {txn.type === 'CREDIT' ? '+' : '-'}
                      {formatINR(txn.amount)}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(txn.id)}
                        aria-label={`Delete transaction ${txn.counterparty} ${formatINR(txn.amount)}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
