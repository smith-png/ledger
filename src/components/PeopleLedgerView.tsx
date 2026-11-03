import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Plus,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';
import {
  PersonLedgerEntry,
  Transaction,
  TransactionType,
  buildWhatsAppUpiSettleLink,
  redactSensitiveText,
  formatINR,
} from '../utils/statementParser';

interface PeopleLedgerViewProps {
  personLedger: PersonLedgerEntry[];
  initialSelectedPerson: string | null;
  isRedacted: boolean;
  onAddSettlementTransaction: (txn: Transaction) => void;
}

export const PeopleLedgerView: React.FC<PeopleLedgerViewProps> = ({
  personLedger,
  initialSelectedPerson,
  isRedacted,
  onAddSettlementTransaction,
}) => {
  const [scopeFilter, setScopeFilter] = useState<'PEOPLE' | 'ALL'>('PEOPLE');
  const [netFilter, setNetFilter] = useState<'ALL' | 'RECEIVED_NET' | 'SENT_NET'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(initialSelectedPerson);

  // User's own VPA for receiving WhatsApp UPI settlements
  const [myVpa, setMyVpa] = useState('pradiploh@bkid');
  const [myPayeeName, setMyPayeeName] = useState('Tanmay Lohakar');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedUpiUri, setCopiedUpiUri] = useState(false);

  // Quick settlement form state
  const [settleType, setSettleType] = useState<TransactionType>('CREDIT');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedPerson) {
      setSelectedName(initialSelectedPerson);
    }
  }, [initialSelectedPerson]);

  const filteredEntries = personLedger.filter((entry) => {
    if (scopeFilter === 'PEOPLE' && !entry.isPerson) return false;
    if (netFilter === 'RECEIVED_NET' && entry.netBalance <= 0) return false;
    if (netFilter === 'SENT_NET' && entry.netBalance >= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        entry.counterparty.toLowerCase().includes(q) ||
        (entry.upiId || '').toLowerCase().includes(q) ||
        (entry.bankCode || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activePerson =
    filteredEntries.find((e) => e.counterparty === selectedName) ||
    filteredEntries[0] ||
    null;

  const peopleOnlyList = personLedger.filter((e) => e.isPerson);
  const totalReceivedFromPeople = peopleOnlyList.reduce((acc, e) => acc + e.totalReceived, 0);
  const totalSentToPeople = peopleOnlyList.reduce((acc, e) => acc + e.totalSent, 0);
  const netP2PBalance = totalReceivedFromPeople - totalSentToPeople;

  const settlePayload = activePerson
    ? buildWhatsAppUpiSettleLink({
        contactName: activePerson.counterparty,
        owedAmount: Math.abs(activePerson.netBalance) || 500,
        receiverVpa: myVpa,
        receiverName: myPayeeName,
        recentTxns: activePerson.transactions,
      })
    : null;

  const handleCopyText = async (text: string, type: 'wa' | 'upi') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback if clipboard permission denied
    }
    if (type === 'wa') {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2000);
    } else {
      setCopiedUpiUri(true);
      setTimeout(() => setCopiedUpiUri(false), 2000);
    }
  };

  const handleRecordSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError(null);
    if (!activePerson) return;

    const amt = parseFloat(settleAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setSettleError('Enter a valid positive settlement amount.');
      return;
    }

    const upiHandle =
      activePerson.upiId ||
      `${activePerson.counterparty.toLowerCase().replace(/\s+/g, '.')}@oksbi`;
    const bank = activePerson.bankCode || 'SBIN';
    const note = settleNote.trim() || 'P2P Split Settlement';
    const dirCode = settleType === 'CREDIT' ? 'CR' : 'DR';
    const rrn = String(Math.floor(630000000000 + Math.random() * 9000000000));

    const newTxn: Transaction = {
      id: `p2p-${Date.now()}`,
      date: '2026-10-25',
      rawNarration: `UPI/${dirCode}/${rrn}/${activePerson.counterparty.toUpperCase()}/${bank}/${upiHandle}/${note}`,
      counterparty: activePerson.counterparty,
      upiId: upiHandle,
      bankCode: bank,
      referenceNo: rrn,
      remarks: note,
      channel: 'UPI',
      type: settleType,
      amount: amt,
      category: 'People & Transfers',
      isPerson: true,
    };

    onAddSettlementTransaction(newTxn);
    setSettleAmount('');
    setSettleNote('');
  };

  return (
    <div className="space-y-6">
      {/* P2P Summary KPI Strip */}
      <section aria-label="Person to Person Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Received From People (In)</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            +{formatINR(totalReceivedFromPeople)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Direct UPI & IMPS credits from individuals
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sent To People (Out)</span>
            <ArrowUpRight className="h-4 w-4 text-slate-700" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            -{formatINR(totalSentToPeople)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Direct transfers, advances & shared splits
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Net P2P Flow Balance</span>
            <span className="font-mono">In minus Out</span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              netP2PBalance >= 0 ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {netP2PBalance >= 0 ? '+' : ''}
            {formatINR(netP2PBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {netP2PBalance < 0
              ? `Net ${formatINR(Math.abs(netP2PBalance))} sent to contacts`
              : `Net ${formatINR(netP2PBalance)} received from contacts`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Extracted P2P Contacts</span>
            <span className="font-mono">BOI UPI Parser</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {peopleOnlyList.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Plus {personLedger.length - peopleOnlyList.length} merchants & billers
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScopeFilter('PEOPLE')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === 'PEOPLE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              People Only ({peopleOnlyList.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Counterparties ({personLedger.length})
            </button>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setNetFilter('ALL')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                netFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Balances
            </button>
            <button
              type="button"
              onClick={() => setNetFilter('RECEIVED_NET')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                netFilter === 'RECEIVED_NET'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Net Received (+₹)
            </button>
            <button
              type="button"
              onClick={() => setNetFilter('SENT_NET')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                netFilter === 'SENT_NET'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Net Sent (-₹)
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search counterparty or UPI ID"
            placeholder="Search name or @upi handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* 2-Column Split: Counterparty Ledger Table & Selected Person History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Table (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Counterparty Flow Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Select any row to generate a 1-click WhatsApp UPI settle-up link or log a split
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {filteredEntries.length} rows
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Person / Merchant</th>
                  <th className="py-3 px-3 text-right">Received (Cr)</th>
                  <th className="py-3 px-3 text-right">Sent (Dr)</th>
                  <th className="py-3 px-5 text-right">Net Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEntries.map((entry) => {
                  const isSelected = activePerson?.counterparty === entry.counterparty;
                  return (
                    <tr
                      key={entry.counterparty}
                      onClick={() => setSelectedName(entry.counterparty)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          onClick={() => setSelectedName(entry.counterparty)}
                          className="font-semibold text-slate-900 text-left hover:text-blue-700"
                        >
                          {redactSensitiveText(entry.counterparty, isRedacted)}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-mono">
                            {redactSensitiveText(
                              entry.upiId || entry.bankCode || 'Bank Transfer',
                              isRedacted
                            )}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{entry.transactionCount} txns</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs text-emerald-700 font-medium tabular-nums whitespace-nowrap">
                        {entry.totalReceived > 0 ? `+${formatINR(entry.totalReceived)}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-800 font-medium tabular-nums whitespace-nowrap">
                        {entry.totalSent > 0 ? `-${formatINR(entry.totalSent)}` : '—'}
                      </td>
                      <td
                        className={`py-3.5 px-5 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                          entry.netBalance > 0
                            ? 'text-emerald-700'
                            : entry.netBalance < 0
                            ? 'text-slate-900'
                            : 'text-slate-500'
                        }`}
                      >
                        {entry.netBalance > 0 ? '+' : ''}
                        {formatINR(entry.netBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Detail Panel (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          {activePerson ? (
            <>
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {redactSensitiveText(activePerson.counterparty, isRedacted)}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">
                        {redactSensitiveText(activePerson.upiId || 'No VPA handle', isRedacted)}
                      </span>
                      {activePerson.bankCode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Bank: {activePerson.bankCode}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="text-xs text-slate-500 block">Net Position</span>
                    <span
                      className={`text-base font-semibold ${
                        activePerson.netBalance >= 0 ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {activePerson.netBalance > 0 ? '+' : ''}
                      {formatINR(activePerson.netBalance)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-slate-500 font-sans block">Total Received From Them</span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {activePerson.totalReceived > 0 ? `+${formatINR(activePerson.totalReceived)}` : formatINR(0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block">Total Sent To Them</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {activePerson.totalSent > 0 ? `-${formatINR(activePerson.totalSent)}` : formatINR(0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1-Click WhatsApp Settle-Up with Pre-Filled UPI Deep Link */}
              {settlePayload && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                      1-Click WhatsApp Settle-Up & UPI Deep Link
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {activePerson.netBalance < 0
                        ? `Owes you ${formatINR(Math.abs(activePerson.netBalance))}`
                        : `Net +${formatINR(activePerson.netBalance)}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="my-vpa-input" className="block text-[11px] text-slate-500 mb-0.5">
                        Your Receiving BOI VPA
                      </label>
                      <input
                        id="my-vpa-input"
                        type="text"
                        value={myVpa}
                        onChange={(e) => setMyVpa(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="my-name-input" className="block text-[11px] text-slate-500 mb-0.5">
                        Payee Display Name
                      </label>
                      <input
                        id="my-name-input"
                        type="text"
                        value={myPayeeName}
                        onChange={(e) => setMyPayeeName(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 font-mono break-all">
                    {settlePayload.upiDeepLink}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(settlePayload.whatsappText, 'wa')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                    >
                      {copiedWhatsApp ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied Reminder!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy WhatsApp Reminder
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(settlePayload.upiDeepLink, 'upi')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      {copiedUpiUri ? 'Copied URI!' : 'Copy upi:// Link'}
                    </button>
                  </div>
                </div>
              )}

              {/* Chronological Transactions with this Person */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2.5">
                  Statement Transaction History ({activePerson.transactions.length})
                </h4>
                <div className="divide-y divide-slate-100 border-y border-slate-100 max-h-60 overflow-y-auto">
                  {activePerson.transactions.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {redactSensitiveText(t.remarks || t.rawNarration, isRedacted)}
                        </div>
                        <div className="text-slate-500 font-mono tabular-nums">
                          {t.date} · {t.channel} {t.referenceNo ? `· Ref ${t.referenceNo}` : ''}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-semibold tabular-nums shrink-0 ${
                          t.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {t.type === 'CREDIT' ? '+' : '-'}
                        {formatINR(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Log Settlement Form */}
              <form onSubmit={handleRecordSettlement} className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Record Split / Settlement with {redactSensitiveText(activePerson.counterparty, isRedacted)}
                  </span>
                  {activePerson.netBalance < 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettleType('CREDIT');
                        setSettleAmount(String(Math.abs(activePerson.netBalance)));
                        setSettleNote('Full balance settlement');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Fill Owed ({formatINR(Math.abs(activePerson.netBalance))})
                    </button>
                  )}
                </div>

                {settleError && (
                  <p role="alert" className="text-xs text-red-600">
                    {settleError}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="settle-direction" className="block text-xs text-slate-600 mb-1">
                      Direction
                    </label>
                    <select
                      id="settle-direction"
                      value={settleType}
                      onChange={(e) => setSettleType(e.target.value as TransactionType)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="CREDIT">Received from them (+)</option>
                      <option value="DEBIT">Sent to them (-)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="settle-amount" className="block text-xs text-slate-600 mb-1">
                      Amount (INR)
                    </label>
                    <input
                      id="settle-amount"
                      type="number"
                      placeholder="1500"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="settle-note" className="block text-xs text-slate-600 mb-1">
                    UPI Remarks / Split Note
                  </label>
                  <input
                    id="settle-note"
                    type="text"
                    placeholder="e.g. Goa trip balance settled"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Record UPI Entry
                </button>
              </form>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a person or merchant on the left to inspect their ledger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
