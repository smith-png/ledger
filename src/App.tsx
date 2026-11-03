import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  FileUp,
  LayoutDashboard,
  MoreHorizontal,
  Moon,
  Receipt,
  Search,
  Sun,
  Users,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryDefinition,
  CounterpartyRole,
  ExplicitLoanSettlementRecord,
  FullDatabaseSnapshot,
  ReportingPeriod,
  StatementColumnMapping,
  StatementImportPreview,
  TransactionLinkType,
  TransactionRecord,
  TransactionSplitItem,
  TransactionType,
} from './types/finance';
import {
  clearAllDatabaseData,
  createEmptyDatabaseSnapshot,
  estimateStorageUsage,
  loadDatabaseSnapshot,
  mergeSnapshots,
  saveDatabaseSnapshot,
  validateBackupJson,
} from './services/db';
import {
  calculateDashboardMetrics,
  calculatePeopleProfiles,
  calculatePeriodComparison,
  filterTransactionsByPeriod,
  resolveStartupReportingPeriod,
} from './services/financeEngine';
import {
  buildPrintableReportHtml,
  commitImportPreviewToSnapshot,
  exportComprehensiveExcelWorkbook,
  exportTransactionsToCsv,
  prepareStatementImportPreview,
  rollbackStatementImport,
} from './services/importEngine';
import { OverviewDashboardView } from './components/OverviewDashboardView';
import { AnalyticsAndCalendarView } from './components/AnalyticsAndCalendarView';
import { PeopleAndLoansView } from './components/PeopleAndLoansView';
import { CategoriesAndRulesView } from './components/CategoriesAndRulesView';
import {
  AccountsAndPlanningView,
  CommandQualityAndSettingsView,
  StatementManagerView,
  TransactionsManagerView,
} from './components/WorkspaceSubviews';
import {
  AndroidApkModal,
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallModal';

export type ActiveWorkspaceTab =
  | 'overview'
  | 'analytics'
  | 'people'
  | 'categories'
  | 'transactions'
  | 'statements'
  | 'planning'
  | 'settings';

export default function App() {
  const [snapshot, setSnapshot] = useState<FullDatabaseSnapshot>(() =>
    createEmptyDatabaseSnapshot()
  );
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('mt_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Reporting period state
  const [period, setPeriod] = useState<ReportingPeriod>(() =>
    resolveStartupReportingPeriod([])
  );

  // Import Preview state
  const [activeImportPreview, setActiveImportPreview] =
    useState<StatementImportPreview | null>(null);
  const [isParsingStatement, setIsParsingStatement] = useState(false);
  const [lastUploadFileRef, setLastUploadFileRef] = useState<File | null>(null);

  // Cross-view drilldown filters
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('ALL');
  const [ledgerPersonFilter, setLedgerPersonFilter] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Storage usage bytes
  const [storageBytes, setStorageBytes] = useState<number>(0);

  // Toast / Status message banner
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  // Load IndexedDB on startup (starts clean with 0 transactions)
  useEffect(() => {
    let mounted = true;
    loadDatabaseSnapshot()
      .then((loaded) => {
        if (!mounted) return;
        setSnapshot(loaded);
        setPeriod(resolveStartupReportingPeriod(loaded.transactions));
        setIsDbLoaded(true);
      })
      .catch(() => {
        if (mounted) setIsDbLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persistSnapshot = async (nextSnapshot: FullDatabaseSnapshot) => {
    setSnapshot(nextSnapshot);
    await saveDatabaseSnapshot(nextSnapshot);
    const usage = await estimateStorageUsage();
    setStorageBytes(usage.usedBytes);
  };

  useEffect(() => {
    estimateStorageUsage().then((u) => setStorageBytes(u.usedBytes));
  }, [snapshot.transactions.length, snapshot.statements.length]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('mt_theme', theme);
    } catch {
      // Ignore storage quota
    }
  }, [theme]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const nowYm = new Date().toISOString().slice(0, 7);
    set.add(nowYm);
    for (const tx of snapshot.transactions) {
      if (tx.date && tx.date.length >= 7) {
        set.add(tx.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [snapshot.transactions]);

  const periodTransactions = useMemo(
    () => filterTransactionsByPeriod(snapshot.transactions, period),
    [snapshot.transactions, period]
  );

  const dashboardMetrics = useMemo(
    () =>
      calculateDashboardMetrics(
        periodTransactions,
        snapshot.transactions,
        snapshot.accounts,
        snapshot.budgets,
        snapshot.commitments,
        period
      ),
    [
      periodTransactions,
      snapshot.transactions,
      snapshot.accounts,
      snapshot.budgets,
      snapshot.commitments,
      period,
    ]
  );

  const periodComparison = useMemo(
    () => calculatePeriodComparison(snapshot.transactions, period),
    [snapshot.transactions, period]
  );

  const peopleProfiles = useMemo(
    () =>
      calculatePeopleProfiles(
        snapshot.transactions,
        snapshot.people,
        snapshot.loansAndSettlements
      ),
    [snapshot.transactions, snapshot.people, snapshot.loansAndSettlements]
  );

  const handleSelectFileForPreview = async (file: File) => {
    setIsParsingStatement(true);
    setLastUploadFileRef(file);
    try {
      const arrayBuf = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      const preview = await prepareStatementImportPreview(
        {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileBuffer: uint8,
        },
        snapshot.transactions,
        snapshot.statements,
        snapshot.accounts[0]?.accountName || 'Primary Savings Account'
      );
      setActiveImportPreview(preview);
      setActiveTab('statements');
    } catch (err) {
      showToast(
        `Could not parse statement: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsParsingStatement(false);
    }
  };

  const handleRemapColumns = async (newMapping: StatementColumnMapping) => {
    if (!lastUploadFileRef) return;
    const arrayBuf = await lastUploadFileRef.arrayBuffer();
    const preview = await prepareStatementImportPreview(
      {
        fileName: lastUploadFileRef.name,
        fileSizeBytes: lastUploadFileRef.size,
        fileBuffer: new Uint8Array(arrayBuf),
      },
      snapshot.transactions,
      snapshot.statements,
      snapshot.accounts[0]?.accountName || 'Primary Savings Account',
      newMapping
    );
    setActiveImportPreview(preview);
  };

  const handleConfirmImportPreview = async (targetAccountId: string) => {
    if (!activeImportPreview) return;
    const { updatedSnapshot, importedTransactions } = commitImportPreviewToSnapshot(
      snapshot,
      activeImportPreview,
      targetAccountId
    );
    await persistSnapshot(updatedSnapshot);
    setPeriod(resolveStartupReportingPeriod(updatedSnapshot.transactions));
    setActiveImportPreview(null);
    setActiveTab('overview');
    showToast(
      `Imported ${importedTransactions.length} verified transactions into your local IndexedDB vault.`
    );
  };

  const handleSaveTransaction = async (tx: TransactionRecord, isNew: boolean) => {
    const nextTransactions = isNew
      ? [tx, ...snapshot.transactions]
      : snapshot.transactions.map((item) => (item.id === tx.id ? tx : item));
    const nextSnapshot: FullDatabaseSnapshot = {
      ...snapshot,
      transactions: nextTransactions,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actionType: isNew ? 'TRANSACTION_CREATE' : 'TRANSACTION_EDIT',
          summary: `${isNew ? 'Created' : 'Edited'} transaction: ${tx.counterpartyName} (${
            tx.date
          })`,
        },
        ...snapshot.auditTrail,
      ].slice(0, 200),
    };
    await persistSnapshot(nextSnapshot);
    if (isNew && snapshot.transactions.length === 0) {
      setPeriod(resolveStartupReportingPeriod(nextTransactions));
    }
    showToast(isNew ? 'Added manual transaction.' : 'Updated transaction details.');
  };

  const handleDeleteTransactions = async (ids: string[]) => {
    const idSet = new Set(ids);
    const nextTransactions = snapshot.transactions.filter((t) => !idSet.has(t.id));
    await persistSnapshot({
      ...snapshot,
      transactions: nextTransactions,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actionType: 'TRANSACTION_DELETE',
          summary: `Deleted ${ids.length} transaction(s)`,
        },
        ...snapshot.auditTrail,
      ].slice(0, 200),
    });
    showToast(`Deleted ${ids.length} transaction(s).`);
  };

  const handleBulkUpdateTransactions = async (
    ids: string[],
    updates: { category?: string; addTag?: string; transactionType?: TransactionType }
  ) => {
    const idSet = new Set(ids);
    const nextTransactions = snapshot.transactions.map((tx) => {
      if (!idSet.has(tx.id)) return tx;
      return {
        ...tx,
        category: updates.category || tx.category,
        transactionType: updates.transactionType || tx.transactionType,
        tags: updates.addTag
          ? Array.from(new Set([...tx.tags, updates.addTag]))
          : tx.tags,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      };
    });
    await persistSnapshot({
      ...snapshot,
      transactions: nextTransactions,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actionType: 'BULK_EDIT',
          summary: `Bulk updated ${ids.length} transactions`,
        },
        ...snapshot.auditTrail,
      ].slice(0, 200),
    });
    showToast(`Updated ${ids.length} transactions.`);
  };

  const handleSplitTransaction = async (txId: string, splits: TransactionSplitItem[]) => {
    const nextTransactions = snapshot.transactions.map((tx) =>
      tx.id === txId
        ? {
            ...tx,
            isSplitParent: true,
            splits,
            category: splits[0]?.category || tx.category,
            updatedAt: new Date().toISOString(),
          }
        : tx
    );
    await persistSnapshot({ ...snapshot, transactions: nextTransactions });
    showToast('Saved multi-category split breakdown.');
  };

  const handleLinkTransactions = async (
    primaryId: string,
    secondaryId: string,
    linkType: TransactionLinkType
  ) => {
    const nextTransactions = snapshot.transactions.map((tx) => {
      if (tx.id === primaryId) {
        return { ...tx, linkedTransactionId: secondaryId, linkType };
      }
      if (tx.id === secondaryId) {
        return { ...tx, linkedTransactionId: primaryId, linkType };
      }
      return tx;
    });
    await persistSnapshot({ ...snapshot, transactions: nextTransactions });
    showToast(`Linked transaction pair (${linkType}).`);
  };

  const handleRenameOrMergeCounterparty = async (
    oldNames: string[],
    newCanonicalName: string,
    role: CounterpartyRole
  ) => {
    const lowerSet = new Set(oldNames.map((n) => n.toLowerCase()));
    const nextTransactions = snapshot.transactions.map((tx) =>
      lowerSet.has(tx.counterpartyName.toLowerCase())
        ? { ...tx, counterpartyName: newCanonicalName, isEdited: true }
        : tx
    );
    const existingPerson = snapshot.people.find(
      (p) => p.canonicalName.toLowerCase() === newCanonicalName.toLowerCase()
    );
    const nextPeople = existingPerson
      ? snapshot.people.map((p) =>
          p.id === existingPerson.id
            ? {
                ...p,
                role,
                aliases: Array.from(new Set([...p.aliases, ...oldNames])),
              }
            : p
        )
      : [
          ...snapshot.people,
          {
            id: `person-${Date.now()}`,
            canonicalName: newCanonicalName,
            aliases: oldNames,
            upiIds: [],
            role,
            notes: '',
            createdAt: new Date().toISOString(),
          },
        ];

    await persistSnapshot({
      ...snapshot,
      transactions: nextTransactions,
      people: nextPeople,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actionType: 'PERSON_MERGE',
          summary: `Merged [${oldNames.join(', ')}] into "${newCanonicalName}"`,
        },
        ...snapshot.auditTrail,
      ].slice(0, 200),
    });
    showToast(`Unified counterparty identity under "${newCanonicalName}".`);
  };

  const triggerBrowserDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Navigation: 5 groups, each with 1-2 sub-pages
  const navGroups: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tabs: { id: ActiveWorkspaceTab; label: string }[];
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: LayoutDashboard,
      tabs: [{ id: 'overview', label: 'Dashboard' }],
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: Receipt,
      tabs: [
        { id: 'transactions', label: `Ledger (${snapshot.transactions.length})` },
        { id: 'statements', label: `Statements (${snapshot.statements.length})` },
      ],
    },
    {
      id: 'insights',
      label: 'Insights',
      icon: BarChart3,
      tabs: [
        { id: 'analytics', label: 'Analytics' },
        { id: 'categories', label: 'Categories' },
      ],
    },
    {
      id: 'people',
      label: 'People',
      icon: Users,
      tabs: [{ id: 'people', label: 'People & Loans' }],
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      tabs: [
        { id: 'planning', label: 'Accounts & Planning' },
        { id: 'settings', label: 'Backup & Assistant' },
      ],
    },
  ];
  const activeGroup =
    navGroups.find((g) => g.tabs.some((t) => t.id === activeTab)) ?? navGroups[0];
  const goToGroup = (g: (typeof navGroups)[number]) => {
    if (!g.tabs.some((t) => t.id === activeTab)) setActiveTab(g.tabs[0].id);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 1-Row, 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#0B192C] text-white border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ArthaLedger
          </button>

          {/* Zone 2: 5 grouped navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navGroups.map((g) => {
              const isActive = activeGroup.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  data-testid={`nav-tab-${g.id}`}
                  onClick={() => goToGroup(g)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-blue-400 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle Light / Dark Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <PWAInstallButton onOpenApkModal={() => setIsApkModalOpen(true)} />

            <button
              type="button"
              data-testid="header-import-statement-btn"
              onClick={() => setActiveTab('statements')}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import Statement</span>
              <span className="sm:hidden">Import</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contextual Workspace Toolbar (Below Header) */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Sub-pages of the active group */}
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
            {activeGroup.tabs.length > 1 ? (
              activeGroup.tabs.map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`nav-subtab-${t.id}`}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })
            ) : (
              <span className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {activeGroup.tabs[0].label}
              </span>
            )}
          </div>

          {/* Period Filter & Quick Search */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Reporting Period Mode"
                value={period.mode}
                onChange={(e) => {
                  const mode = e.target.value as ReportingPeriod['mode'];
                  if (mode === 'ALL_HISTORY') {
                    setPeriod({ mode: 'ALL_HISTORY', label: 'All History' });
                  } else if (mode === 'YEAR') {
                    const yr = (availableMonths[0] || '2026-04').slice(0, 4);
                    setPeriod({ mode: 'YEAR', year: yr, label: `Year ${yr}` });
                  } else {
                    const m = availableMonths[0] || new Date().toISOString().slice(0, 7);
                    setPeriod({ mode: 'MONTH', month: m, label: m });
                  }
                }}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
                <option value="ALL_HISTORY">All History</option>
              </select>

              {period.mode === 'MONTH' && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <select
                    aria-label="Select Active Month"
                    value={period.month || availableMonths[0]}
                    onChange={(e) => {
                      const ym = e.target.value;
                      const [y, m] = ym.split('-');
                      const dt = new Date(Number(y), Number(m) - 1, 1);
                      const label = dt.toLocaleDateString('en-IN', {
                        month: 'long',
                        year: 'numeric',
                      });
                      setPeriod({ mode: 'MONTH', month: ym, label });
                    }}
                    className="bg-transparent text-slate-900 dark:text-white font-mono tabular-nums font-semibold focus:outline-none cursor-pointer"
                  >
                    {availableMonths.map((ym) => (
                      <option key={ym} value={ym} className="text-slate-900">
                        {ym}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="relative hidden sm:block w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  if (e.target.value.trim() && activeTab !== 'transactions') {
                    setActiveTab('transactions');
                  }
                }}
                className="w-full pl-8 pr-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status Toast Notification */}
      {statusBanner && (
        <div className="bg-slate-900 dark:bg-blue-950 text-white text-xs font-medium py-2 px-4 text-center border-b border-slate-800">
          {statusBanner}
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 overflow-x-hidden">
        {!isDbLoaded ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Loading local database...
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewDashboardView
                snapshot={snapshot}
                period={period}
                periodTransactions={periodTransactions}
                metrics={dashboardMetrics}
                comparison={periodComparison}
                onOpenImportModal={() => setActiveTab('statements')}
                isLoadingSample={isParsingStatement}
                onNavigateTab={(t) => setActiveTab(t as ActiveWorkspaceTab)}
                onSelectCategoryFilter={(cat) => {
                  setLedgerCategoryFilter(cat);
                  setActiveTab('transactions');
                }}
                onInspectTransaction={() => setActiveTab('transactions')}
                onOpenAddTransaction={() => setActiveTab('transactions')}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsAndCalendarView
                snapshot={snapshot}
                period={period}
                periodTransactions={periodTransactions}
                onSelectCategoryFilter={(cat) => {
                  setLedgerCategoryFilter(cat);
                  setActiveTab('transactions');
                }}
                onSelectPersonFilter={(person) => {
                  setLedgerPersonFilter(person);
                  setActiveTab('transactions');
                }}
                onInspectTransaction={() => setActiveTab('transactions')}
              />
            )}

            {activeTab === 'people' && (
              <PeopleAndLoansView
                snapshot={snapshot}
                period={period}
                peopleProfiles={peopleProfiles}
                onRenameOrMergeCounterparty={handleRenameOrMergeCounterparty}
                onAddLoanSettlement={async (rec) => {
                  const newLoan: ExplicitLoanSettlementRecord = {
                    ...rec,
                    id: `loan-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                  };
                  await persistSnapshot({
                    ...snapshot,
                    loansAndSettlements: [newLoan, ...snapshot.loansAndSettlements],
                  });
                  showToast(`Recorded explicit loan/receivable for ${rec.personName}.`);
                }}
                onUpdateLoanStatus={async (id, settledAmountPaise, status) => {
                  const nextLoans = snapshot.loansAndSettlements.map((l) =>
                    l.id === id
                      ? {
                          ...l,
                          settledAmountPaise,
                          remainingAmountPaise: Math.max(
                            0,
                            l.principalAmountPaise - settledAmountPaise
                          ),
                          status,
                        }
                      : l
                  );
                  await persistSnapshot({ ...snapshot, loansAndSettlements: nextLoans });
                  showToast('Updated loan settlement status.');
                }}
                onDeleteLoanRecord={async (id) => {
                  await persistSnapshot({
                    ...snapshot,
                    loansAndSettlements: snapshot.loansAndSettlements.filter(
                      (l) => l.id !== id
                    ),
                  });
                }}
                onInspectTransaction={() => setActiveTab('transactions')}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesAndRulesView
                snapshot={snapshot}
                period={period}
                periodTransactions={periodTransactions}
                onAddCategory={async (cat) => {
                  const newCat: CategoryDefinition = {
                    ...cat,
                    id: `cat-${Date.now()}`,
                  };
                  await persistSnapshot({
                    ...snapshot,
                    categories: [...snapshot.categories, newCat],
                  });
                  showToast(`Added custom category "${cat.name}".`);
                }}
                onMergeOrDeleteCategory={async (src, target) => {
                  const nextTx = snapshot.transactions.map((t) =>
                    t.category === src ? { ...t, category: target } : t
                  );
                  const nextCats = snapshot.categories.filter((c) => c.name !== src);
                  await persistSnapshot({
                    ...snapshot,
                    transactions: nextTx,
                    categories: nextCats,
                  });
                  showToast(`Merged category "${src}" into "${target}".`);
                }}
                onSaveRuleAndApply={async (rule, applyExisting) => {
                  let nextTx = snapshot.transactions;
                  if (applyExisting) {
                    const matched = new Set(
                      snapshot.transactions
                        .filter((tx) =>
                          rule.conditions.every((c) => {
                            const val = c.value.toLowerCase();
                            const fieldStr =
                              c.field === 'COUNTERPARTY'
                                ? tx.counterpartyName.toLowerCase()
                                : c.field === 'UPI_ID'
                                ? tx.upiId.toLowerCase()
                                : tx.rawDescription.toLowerCase();
                            if (c.operator === 'EQUALS') return fieldStr === val;
                            if (c.operator === 'STARTS_WITH') return fieldStr.startsWith(val);
                            return fieldStr.includes(val);
                          })
                        )
                        .map((t) => t.id)
                    );
                    nextTx = snapshot.transactions.map((t) =>
                      matched.has(t.id)
                        ? {
                            ...t,
                            category: rule.actions.setCategory || t.category,
                            counterpartyName:
                              rule.actions.normalizeCounterparty || t.counterpartyName,
                            tags: rule.actions.addTags
                              ? Array.from(new Set([...t.tags, ...rule.actions.addTags]))
                              : t.tags,
                          }
                        : t
                    );
                  }
                  await persistSnapshot({
                    ...snapshot,
                    rules: [rule, ...snapshot.rules],
                    transactions: nextTx,
                  });
                  showToast(`Saved rule "${rule.name}".`);
                }}
                onDeleteRule={async (ruleId) => {
                  await persistSnapshot({
                    ...snapshot,
                    rules: snapshot.rules.filter((r) => r.id !== ruleId),
                  });
                }}
                onSelectCategoryFilter={(cat) => {
                  setLedgerCategoryFilter(cat);
                  setActiveTab('transactions');
                }}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsManagerView
                snapshot={snapshot}
                initialCategoryFilter={ledgerCategoryFilter}
                initialPersonFilter={ledgerPersonFilter}
                initialSearchQuery={globalSearchQuery}
                onSaveTransaction={handleSaveTransaction}
                onDeleteTransactions={handleDeleteTransactions}
                onBulkUpdateTransactions={handleBulkUpdateTransactions}
                onSplitTransaction={handleSplitTransaction}
                onLinkTransactions={handleLinkTransactions}
              />
            )}

            {activeTab === 'statements' && (
              <StatementManagerView
                snapshot={snapshot}
                activePreview={activeImportPreview}
                isParsing={isParsingStatement}
                onSelectFileForPreview={handleSelectFileForPreview}
                onRemapColumns={handleRemapColumns}
                onToggleCandidateRow={(rowIndex, selected) => {
                  if (!activeImportPreview) return;
                  setActiveImportPreview({
                    ...activeImportPreview,
                    candidates: activeImportPreview.candidates.map((c) =>
                      c.rowIndex === rowIndex ? { ...c, selectedForImport: selected } : c
                    ),
                  });
                }}
                onConfirmImportPreview={handleConfirmImportPreview}
                onCancelPreview={() => setActiveImportPreview(null)}
                onRollbackStatement={async (stmtId) => {
                  const next = rollbackStatementImport(snapshot, stmtId, true);
                  await persistSnapshot(next);
                  setPeriod(resolveStartupReportingPeriod(next.transactions));
                  showToast('Rolled back statement import and removed its transactions.');
                }}
              />
            )}

            {activeTab === 'planning' && (
              <AccountsAndPlanningView
                snapshot={snapshot}
                onAddAccount={async (acc) => {
                  const newAcc: AccountRecord = {
                    ...acc,
                    id: `acc-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                  };
                  await persistSnapshot({
                    ...snapshot,
                    accounts: [...snapshot.accounts, newAcc],
                  });
                }}
                onAddOrUpdateBudget={async (b) => {
                  const existing = snapshot.budgets.find(
                    (x) => x.categoryName === b.categoryName
                  );
                  const nextBudgets = existing
                    ? snapshot.budgets.map((x) =>
                        x.id === existing.id ? { ...b, id: existing.id } : x
                      )
                    : [...snapshot.budgets, { ...b, id: `budget-${Date.now()}` }];
                  await persistSnapshot({ ...snapshot, budgets: nextBudgets });
                  showToast(`Saved monthly budget for ${b.categoryName}.`);
                }}
                onAddSavingsGoal={async (g) => {
                  await persistSnapshot({
                    ...snapshot,
                    goals: [...snapshot.goals, { ...g, id: `goal-${Date.now()}` }],
                  });
                  showToast(`Added savings goal "${g.name}".`);
                }}
                onAddRecurringCommitment={async (c) => {
                  await persistSnapshot({
                    ...snapshot,
                    commitments: [
                      ...snapshot.commitments,
                      { ...c, id: `commit-${Date.now()}` },
                    ],
                  });
                }}
              />
            )}

            {activeTab === 'settings' && (
              <CommandQualityAndSettingsView
                snapshot={snapshot}
                storageUsageBytes={storageBytes}
                onExportCsv={() => {
                  const csv = exportTransactionsToCsv(snapshot.transactions);
                  triggerBrowserDownload(
                    csv,
                    `my-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
                    'text/csv;charset=utf-8'
                  );
                  showToast('Exported transactions to CSV.');
                }}
                onExportExcel={() => {
                  const xls = exportComprehensiveExcelWorkbook(snapshot);
                  triggerBrowserDownload(
                    xls,
                    `my-transactions-workbook-${new Date().toISOString().slice(0, 10)}.xls`,
                    'application/vnd.ms-excel'
                  );
                  showToast('Exported multi-column Excel workbook.');
                }}
                onPrintReport={() => {
                  const html = buildPrintableReportHtml(
                    snapshot,
                    period.label,
                    dashboardMetrics.totalCreditPaise,
                    dashboardMetrics.totalDebitPaise,
                    dashboardMetrics.identifiedIncomePaise,
                    dashboardMetrics.identifiedExpensesPaise
                  );
                  triggerBrowserDownload(
                    html,
                    `financial-report-${period.label.replace(/\s+/g, '-')}.html`,
                    'text/html;charset=utf-8'
                  );
                  showToast('Downloaded printable HTML/PDF Financial Report.');
                }}
                onDownloadJsonBackup={() => {
                  const json = JSON.stringify(snapshot, null, 2);
                  triggerBrowserDownload(
                    json,
                    `my-transactions-backup-v${snapshot.schemaVersion}-${new Date()
                      .toISOString()
                      .slice(0, 10)}.json`,
                    'application/json'
                  );
                  showToast('Downloaded full versioned JSON backup.');
                }}
                onRestoreBackupFile={async (file, mode) => {
                  const text = await file.text();
                  const validation = validateBackupJson(text);
                  if (!validation.valid || !validation.snapshot) {
                    showToast(`Backup validation failed: ${validation.error}`);
                    return;
                  }
                  const next =
                    mode === 'REPLACE'
                      ? validation.snapshot
                      : mergeSnapshots(snapshot, validation.snapshot);
                  await persistSnapshot(next);
                  setPeriod(resolveStartupReportingPeriod(next.transactions));
                  showToast(
                    `Restored backup (${mode} mode): ${next.transactions.length} total transactions.`
                  );
                }}
                onClearAllDatabase={async () => {
                  const fresh = await clearAllDatabaseData();
                  setSnapshot(fresh);
                  setPeriod(resolveStartupReportingPeriod([]));
                  setActiveTab('overview');
                  showToast('Cleared all local data. Returned to initial ₹0.00 state.');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B192C] text-white border-t border-slate-800 grid grid-cols-5 pt-1.5 px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[11px]"
      >
        {navGroups.map((g) => {
          const Icon = g.icon;
          const active = activeGroup.id === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => goToGroup(g)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg min-w-0 ${
                active ? 'text-blue-400 font-semibold' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="truncate">{g.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Offline Status Banner & Android APK Modal */}
      <OfflineIndicator />
      <AndroidApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        onDownloadFile={triggerBrowserDownload}
        onShowToast={showToast}
      />
    </div>
  );
}
