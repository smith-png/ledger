import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
  GitMerge,
  Handshake,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  CounterpartyRole,
  ExplicitLoanSettlementRecord,
  FullDatabaseSnapshot,
  PersonIdentity,
  PersonProfileSummary,
  ReportingPeriod,
  TransactionRecord,
} from '../types/finance';
import { formatINRPaise, fromPaise, toPaise } from '../services/financeEngine';

interface PeopleAndLoansViewProps {
  snapshot: FullDatabaseSnapshot;
  period: ReportingPeriod;
  peopleProfiles: PersonProfileSummary[];
  onRenameOrMergeCounterparty: (
    oldNames: string[],
    newCanonicalName: string,
    role: CounterpartyRole
  ) => void;
  onAddLoanSettlement: (record: Omit<ExplicitLoanSettlementRecord, 'id' | 'createdAt'>) => void;
  onUpdateLoanStatus: (
    id: string,
    settledAmountPaise: number,
    status: ExplicitLoanSettlementRecord['status']
  ) => void;
  onDeleteLoanRecord: (id: string) => void;
  onInspectTransaction: (tx: TransactionRecord) => void;
}

export const PeopleAndLoansView: React.FC<PeopleAndLoansViewProps> = ({
  snapshot,
  period,
  peopleProfiles,
  onRenameOrMergeCounterparty,
  onAddLoanSettlement,
  onUpdateLoanStatus,
  onDeleteLoanRecord,
  onInspectTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedPersonName, setSelectedPersonName] = useState<string | null>(null);
  const [personDateFrom, setPersonDateFrom] = useState('');
  const [personDateTo, setPersonDateTo] = useState('');

  // Merge / Rename modal state
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [mergeSelectedNames, setMergeSelectedNames] = useState<string[]>([]);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [mergeTargetRole, setMergeTargetRole] = useState<CounterpartyRole>('FRIEND');

  // Explicit Loan / Receivable form state
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanPersonName, setLoanPersonName] = useState('');
  const [loanType, setLoanType] = useState<ExplicitLoanSettlementRecord['type']>('LENT_RECEIVABLE');
  const [loanAmountInr, setLoanAmountInr] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().slice(0, 10));
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return peopleProfiles.filter((p) => {
      if (roleFilter !== 'ALL' && p.identity.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.identity.canonicalName.toLowerCase().includes(q) ||
        p.identity.upiIds.some((u) => u.toLowerCase().includes(q)) ||
        p.identity.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [peopleProfiles, searchQuery, roleFilter]);

  const activeProfile = useMemo(() => {
    if (!selectedPersonName) return filteredProfiles[0] || null;
    return (
      peopleProfiles.find(
        (p) => p.identity.canonicalName.toLowerCase() === selectedPersonName.toLowerCase()
      ) ||
      filteredProfiles[0] ||
      null
    );
  }, [selectedPersonName, peopleProfiles, filteredProfiles]);

  const activePersonTransactions = useMemo(() => {
    if (!activeProfile) return [];
    const targetNames = new Set(
      [activeProfile.identity.canonicalName, ...activeProfile.identity.aliases].map((s) =>
        s.toLowerCase()
      )
    );
    return snapshot.transactions
      .filter((tx) => {
        if (!targetNames.has((tx.counterpartyName || '').toLowerCase())) return false;
        if (personDateFrom && tx.date < personDateFrom) return false;
        if (personDateTo && tx.date > personDateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeProfile, snapshot.transactions, personDateFrom, personDateTo]);

  const handleSubmitMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeTargetName.trim() || mergeSelectedNames.length === 0) return;
    onRenameOrMergeCounterparty(mergeSelectedNames, mergeTargetName.trim(), mergeTargetRole);
    setSelectedPersonName(mergeTargetName.trim());
    setMergeSelectedNames([]);
    setMergeTargetName('');
    setShowMergePanel(false);
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principalPaise = toPaise(parseFloat(loanAmountInr) || 0);
    if (!loanPersonName.trim() || principalPaise <= 0) return;

    onAddLoanSettlement({
      personId: loanPersonName.trim(),
      personName: loanPersonName.trim(),
      type: loanType,
      principalAmountPaise: principalPaise,
      settledAmountPaise: 0,
      remainingAmountPaise: principalPaise,
      status: 'OPEN',
      issueDate: loanDate,
      dueDate: loanDueDate || undefined,
      linkedTransactionIds: [],
      notes: loanNotes.trim() || 'Explicitly recorded loan / split settlement',
    });
    setLoanPersonName('');
    setLoanAmountInr('');
    setLoanNotes('');
    setShowLoanForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>People & Loans</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sent, received, net flow, aliases and loans
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeProfile) {
                setMergeSelectedNames([activeProfile.identity.canonicalName]);
                setMergeTargetName(activeProfile.identity.canonicalName);
                setMergeTargetRole(activeProfile.identity.role);
              }
              setShowMergePanel((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Rename / Merge Identities
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeProfile) setLoanPersonName(activeProfile.identity.canonicalName);
              setShowLoanForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Handshake className="w-3.5 h-3.5" />
            Record Loan / Receivable
          </button>
        </div>
      </div>

      {/* Identity Rename / Merge Panel */}
      {showMergePanel && (
        <form
          onSubmit={handleSubmitMerge}
          className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-blue-600" />
              <span>Normalize, Rename, or Merge Duplicate Counterparty Names</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowMergePanel(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Select one or more extracted bank counterparty names below and assign a single canonical
            display name and relationship role. All matching transactions will be unified.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Select Extracted Names to Merge ({mergeSelectedNames.length})
              </label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-1 text-xs">
                {peopleProfiles.map((p) => {
                  const name = p.identity.canonicalName;
                  const checked = mergeSelectedNames.includes(name);
                  return (
                    <label key={name} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMergeSelectedNames((prev) => [...prev, name]);
                            if (!mergeTargetName) setMergeTargetName(name);
                          } else {
                            setMergeSelectedNames((prev) => prev.filter((x) => x !== name));
                          }
                        }}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                New Canonical Name
              </label>
              <input
                type="text"
                required
                value={mergeTargetName}
                onChange={(e) => setMergeTargetName(e.target.value)}
                placeholder="e.g., Rahul Sharma"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Counterparty Role
              </label>
              <select
                value={mergeTargetRole}
                onChange={(e) => setMergeTargetRole(e.target.value as CounterpartyRole)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="FRIEND">Friend / Contact</option>
                <option value="FAMILY">Family</option>
                <option value="MERCHANT">Merchant / Business</option>
                <option value="EMPLOYER">Employer / Client</option>
                <option value="UTILITY_BILLER">Utility / Biller</option>
                <option value="SELF">Self Account</option>
                <option value="BANK">Bank</option>
              </select>
              <button
                type="submit"
                className="mt-3 w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Apply Identity Merge
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Explicit Loan / Receivable Form (Section 10) */}
      {showLoanForm && (
        <form
          onSubmit={handleCreateLoan}
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Handshake className="w-4 h-4 text-emerald-600" />
              <span>Record Explicit Loan, Split Expense, or Receivable</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowLoanForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Per financial accounting rules, ordinary bank transfers do not automatically imply a debt.
            Record explicit receivables (money owed to you) or borrowings (money you owe) here.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              placeholder="Person Name (e.g., Aryan)"
              value={loanPersonName}
              onChange={(e) => setLoanPersonName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as ExplicitLoanSettlementRecord['type'])}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="LENT_RECEIVABLE">Money Lent (Owed to You)</option>
              <option value="BORROWED_PAYABLE">Money Borrowed (You Owe)</option>
              <option value="SPLIT_EXPENSE">Shared / Split Bill (Owed to You)</option>
            </select>
            <input
              type="number"
              step="0.01"
              required
              placeholder="Amount (₹)"
              value={loanAmountInr}
              onChange={(e) => setLoanAmountInr(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
            <input
              type="date"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Save Loan Entry
            </button>
          </div>
        </form>
      )}

      {/* Main Two-Column Directory & Person Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Directory (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col h-[560px]">
          <div className="space-y-2.5 mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search person, merchant, or UPI ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {['ALL', 'FRIEND', 'MERCHANT', 'FAMILY', 'UTILITY_BILLER', 'SELF'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                    roleFilter === r
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {r === 'ALL' ? `All (${peopleProfiles.length})` : r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
            {filteredProfiles.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No counterparties match your search filter.
              </div>
            ) : (
              filteredProfiles.map((p) => {
                const isSelected =
                  activeProfile?.identity.canonicalName === p.identity.canonicalName;
                return (
                  <button
                    key={p.identity.id}
                    type="button"
                    onClick={() => setSelectedPersonName(p.identity.canonicalName)}
                    className={`w-full text-left p-3 rounded-lg transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {p.identity.canonicalName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.identity.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.transactionCount} txns • Last: {p.lastTransactionDate || 'N/A'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        In: +{formatINRPaise(p.totalReceivedFromPersonPaise)}
                      </div>
                      <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                        Out: -{formatINRPaise(p.totalSentToPersonPaise)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Person Detail Profile (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between min-w-0 overflow-hidden">
          {!activeProfile ? (
            <div className="py-24 text-center text-xs text-slate-400">
              Select a person or merchant on the left to inspect transaction history, UPI IDs, and
              settlement status.
            </div>
          ) : (
            <div className="space-y-5 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {activeProfile.identity.canonicalName}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold shrink-0">
                      {activeProfile.identity.role}
                    </span>
                  </div>
                  {activeProfile.identity.upiIds.length > 0 && (
                    <div className="text-xs font-mono text-slate-500 mt-1 break-all">
                      UPI IDs: {activeProfile.identity.upiIds.join(', ')}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Active from {activeProfile.firstTransactionDate} to{' '}
                    {activeProfile.lastTransactionDate} • Most frequent:{' '}
                    {activeProfile.mostCommonCategory}
                  </div>
                </div>

                {/* WhatsApp UPI Settle-Up Reminder (only if explicit receivable > 0 or user clicks) */}
                {activeProfile.explicitReceivablePaise > 0 && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hi ${activeProfile.identity.canonicalName}, friendly reminder regarding our pending balance of ${formatINRPaise(
                        activeProfile.explicitReceivablePaise
                      )}. You can settle via UPI: upi://pay?pa=yourvpa@boi&pn=AccountHolder&am=${fromPaise(
                        activeProfile.explicitReceivablePaise
                      ).toFixed(2)}&cu=INR`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Send WhatsApp UPI Settle-Up
                  </a>
                )}
              </div>

              {/* 4 Summary Metrics for Selected Person */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Received From Person
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    +{formatINRPaise(activeProfile.totalReceivedFromPersonPaise)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Sent To Person
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1 truncate">
                    -{formatINRPaise(activeProfile.totalSentToPersonPaise)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Historical Net Exchanged
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1 truncate">
                    {activeProfile.netExchangedPaise > 0 ? '+' : ''}
                    {formatINRPaise(activeProfile.netExchangedPaise)}
                  </div>
                  <div className="text-[10px] text-slate-400">Cash-flow difference</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Explicit Owed / Payable
                  </div>
                  <div className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1 truncate">
                    Owed to you: {formatINRPaise(activeProfile.explicitReceivablePaise)}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 truncate">
                    You owe: {formatINRPaise(activeProfile.explicitPayablePaise)}
                  </div>
                </div>
              </div>

              {/* Date Range Filter inside Person Profile */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Transaction History ({activePersonTransactions.length})
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={personDateFrom}
                    onChange={(e) => setPersonDateFrom(e.target.value)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={personDateTo}
                    onChange={(e) => setPersonDateTo(e.target.value)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 w-full">
                {activePersonTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => onInspectTransaction(tx)}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs cursor-pointer w-full min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {tx.date} • <span className="text-slate-500">{tx.category}</span>
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
            </div>
          )}
        </div>
      </div>

      {/* Section 10: Explicit Loans, Receivables & Settlements Ledger */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Explicit Loans, Receivables, Borrowings & Shared Splits Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Separates verified debt/receivable agreements from ordinary historical payments
            </p>
          </div>
        </div>

        {snapshot.loansAndSettlements.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No explicit loans or receivables recorded yet. Click "Record Loan / Receivable" above to
            track money lent, borrowed, or split.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 px-3">Person</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Principal</th>
                  <th className="py-2 px-3">Remaining</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {snapshot.loansAndSettlements.map((loan) => (
                  <tr key={loan.id}>
                    <td className="py-2.5 pr-3 font-mono">{loan.issueDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {loan.personName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          loan.type === 'BORROWED_PAYABLE'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {loan.type === 'LENT_RECEIVABLE'
                          ? 'Lent (Receivable)'
                          : loan.type === 'SPLIT_EXPENSE'
                          ? 'Split Bill (Receivable)'
                          : 'Borrowed (Payable)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {formatINRPaise(loan.principalAmountPaise)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {formatINRPaise(loan.remainingAmountPaise)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-[11px]">
                        {loan.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right space-x-2">
                      {loan.status !== 'SETTLED' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateLoanStatus(loan.id, loan.principalAmountPaise, 'SETTLED')
                          }
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                        >
                          Mark Settled
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteLoanRecord(loan.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
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
