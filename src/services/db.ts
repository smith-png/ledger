import {
  AccountRecord,
  CategoryDefinition,
  FullDatabaseSnapshot,
} from '../types/finance';

export const DB_NAME = 'my_transactions_idb_v1';
export const DB_SCHEMA_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'primary_snapshot';

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'cat-food',
    name: 'Food & Dining',
    type: 'EXPENSE',
    color: '#e11d48',
    iconName: 'Utensils',
    subCategories: ['Restaurants', 'Food Delivery', 'Bakery & Snacks', 'Tea & Coffee'],
    isSystemDefault: true,
  },
  {
    id: 'cat-groceries',
    name: 'Groceries',
    type: 'EXPENSE',
    color: '#16a34a',
    iconName: 'ShoppingBag',
    subCategories: ['Supermarket', 'Fruits & Vegetables', 'Dairy & Milk', 'Daily Essentials'],
    isSystemDefault: true,
  },
  {
    id: 'cat-travel',
    name: 'Travel & Transport',
    type: 'EXPENSE',
    color: '#d97706',
    iconName: 'Car',
    subCategories: ['Fuel & Petrol', 'Metro & Bus', 'Cab & Auto', 'Train & Flight'],
    isSystemDefault: true,
  },
  {
    id: 'cat-bills',
    name: 'Bills & Utilities',
    type: 'EXPENSE',
    color: '#2563eb',
    iconName: 'Zap',
    subCategories: ['Mobile Recharge', 'Broadband & WiFi', 'Electricity', 'Water & Gas', 'ATM Cash Withdrawal'],
    isSystemDefault: true,
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    type: 'EXPENSE',
    color: '#7c3aed',
    iconName: 'ShoppingCart',
    subCategories: ['Clothing & Apparel', 'Electronics', 'Online Marketplace', 'Home & Kitchen'],
    isSystemDefault: true,
  },
  {
    id: 'cat-housing',
    name: 'Housing & Rent',
    type: 'EXPENSE',
    color: '#0891b2',
    iconName: 'Home',
    subCategories: ['House Rent', 'Society Maintenance', 'Repairs'],
    isSystemDefault: true,
  },
  {
    id: 'cat-health',
    name: 'Health & Medical',
    type: 'EXPENSE',
    color: '#dc2626',
    iconName: 'HeartPulse',
    subCategories: ['Pharmacy & Medicines', 'Doctor & Lab', 'Fitness & Gym'],
    isSystemDefault: true,
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    type: 'EXPENSE',
    color: '#9333ea',
    iconName: 'Film',
    subCategories: ['OTT Subscriptions', 'Movies & Events', 'Gaming'],
    isSystemDefault: true,
  },
  {
    id: 'cat-education',
    name: 'Education',
    type: 'EXPENSE',
    color: '#4f46e5',
    iconName: 'GraduationCap',
    subCategories: ['Courses & Books', 'Tuition & Fees', 'Stationery'],
    isSystemDefault: true,
  },
  {
    id: 'cat-personal',
    name: 'Personal Care',
    type: 'EXPENSE',
    color: '#db2777',
    iconName: 'Smile',
    subCategories: ['Salon & Grooming', 'Cosmetics'],
    isSystemDefault: true,
  },
  {
    id: 'cat-family',
    name: 'Family & Household',
    type: 'BOTH',
    color: '#0d9488',
    iconName: 'Users',
    subCategories: ['Parental Support', 'Household Help'],
    isSystemDefault: true,
  },
  {
    id: 'cat-p2p',
    name: 'Personal Transfers',
    type: 'BOTH',
    color: '#0284c7',
    iconName: 'ArrowLeftRight',
    subCategories: ['Sent to Contact', 'Received from Contact', 'Shared Split'],
    isSystemDefault: true,
  },
  {
    id: 'cat-investments',
    name: 'Investments',
    type: 'EXPENSE',
    color: '#059669',
    iconName: 'TrendingUp',
    subCategories: ['Mutual Fund SIP', 'Stocks & ETF', 'Fixed Deposit', 'PPF & NPS'],
    isSystemDefault: true,
  },
  {
    id: 'cat-insurance',
    name: 'Insurance',
    type: 'EXPENSE',
    color: '#4338ca',
    iconName: 'Shield',
    subCategories: ['Health Insurance', 'Term Life', 'Vehicle Insurance'],
    isSystemDefault: true,
  },
  {
    id: 'cat-emi',
    name: 'Loans & EMI',
    type: 'EXPENSE',
    color: '#b45309',
    iconName: 'Landmark',
    subCategories: ['Home Loan EMI', 'Personal Loan EMI', 'Credit Card Bill'],
    isSystemDefault: true,
  },
  {
    id: 'cat-taxes',
    name: 'Taxes & Government',
    type: 'EXPENSE',
    color: '#64748b',
    iconName: 'FileText',
    subCategories: ['Income Tax', 'GST', 'Municipal Fees'],
    isSystemDefault: true,
  },
  {
    id: 'cat-bank-charges',
    name: 'Bank Charges',
    type: 'EXPENSE',
    color: '#be123c',
    iconName: 'AlertCircle',
    subCategories: ['AMC Fee', 'SMS Alert Fee', 'MAB Penalty', 'Bounce / ATM Fee'],
    isSystemDefault: true,
  },
  {
    id: 'cat-salary',
    name: 'Salary',
    type: 'INCOME',
    color: '#10b981',
    iconName: 'Briefcase',
    subCategories: ['Monthly Payroll', 'Bonus & Stipend'],
    isSystemDefault: true,
  },
  {
    id: 'cat-interest',
    name: 'Interest',
    type: 'INCOME',
    color: '#047857',
    iconName: 'Percent',
    subCategories: ['Savings Bank Interest', 'FD Interest', 'Dividends'],
    isSystemDefault: true,
  },
  {
    id: 'cat-refund',
    name: 'Refund / Reversal',
    type: 'INCOME',
    color: '#14b8a6',
    iconName: 'RotateCcw',
    subCategories: ['Merchant Refund', 'UPI Reversal'],
    isSystemDefault: true,
  },
  {
    id: 'cat-self',
    name: 'Self Transfer',
    type: 'TRANSFER',
    color: '#475569',
    iconName: 'Repeat',
    subCategories: ['Internal Account Transfer'],
    isSystemDefault: true,
  },
  {
    id: 'cat-uncategorized',
    name: 'Uncategorized',
    type: 'BOTH',
    color: '#94a3b8',
    iconName: 'HelpCircle',
    subCategories: ['General Expense', 'General Credit'],
    isSystemDefault: true,
  },
];

export const DEFAULT_ACCOUNTS: AccountRecord[] = [
  {
    id: 'acc-default-primary',
    accountName: 'Primary Savings Account',
    bankName: 'Bank of India',
    accountNumberMasked: 'XXXX0000',
    accountType: 'SAVINGS',
    openingBalancePaise: 0,
    openingBalanceDate: '2026-01-01',
    lastStatementClosingBalancePaise: null,
    isPrimary: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function createEmptyDatabaseSnapshot(): FullDatabaseSnapshot {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'My Transactions — Monthly Transaction Manager',
    transactions: [],
    statements: [],
    accounts: DEFAULT_ACCOUNTS,
    people: [],
    loansAndSettlements: [],
    categories: DEFAULT_CATEGORIES,
    rules: [],
    budgets: [],
    goals: [],
    debts: [],
    commitments: [],
    milestones: [],
    auditTrail: [],
  };
}

let inMemoryFallback: FullDatabaseSnapshot | null = null;

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this runtime'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function loadDatabaseSnapshot(): Promise<FullDatabaseSnapshot> {
  try {
    const db = await openIndexedDb();
    return await new Promise<FullDatabaseSnapshot>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(SNAPSHOT_KEY);
      getReq.onsuccess = () => {
        if (getReq.result && typeof getReq.result === 'object') {
          resolve(getReq.result as FullDatabaseSnapshot);
        } else {
          resolve(createEmptyDatabaseSnapshot());
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    return inMemoryFallback || createEmptyDatabaseSnapshot();
  }
}

export async function saveDatabaseSnapshot(snapshot: FullDatabaseSnapshot): Promise<void> {
  const payload: FullDatabaseSnapshot = {
    ...snapshot,
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };
  inMemoryFallback = payload;

  try {
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(payload, SNAPSHOT_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch {
    // Fallback to in-memory snapshot in headless Node test environment
  }
}

export async function clearAllDatabaseData(): Promise<FullDatabaseSnapshot> {
  const fresh = createEmptyDatabaseSnapshot();
  await saveDatabaseSnapshot(fresh);
  return fresh;
}

export function validateBackupJson(jsonText: string): {
  valid: boolean;
  snapshot?: FullDatabaseSnapshot;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Backup file is not a valid JSON object.' };
    }
    if (!Array.isArray(parsed.transactions)) {
      return { valid: false, error: 'Backup JSON is missing the transactions array.' };
    }
    const base = createEmptyDatabaseSnapshot();
    const merged: FullDatabaseSnapshot = {
      ...base,
      ...parsed,
      schemaVersion: DB_SCHEMA_VERSION,
      accounts:
        Array.isArray(parsed.accounts) && parsed.accounts.length > 0
          ? parsed.accounts
          : base.accounts,
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : base.categories,
    };
    return { valid: true, snapshot: merged };
  } catch (err) {
    return {
      valid: false,
      error: `Malformed JSON: ${err instanceof Error ? err.message : 'Parse error'}`,
    };
  }
}

export function mergeSnapshots(
  current: FullDatabaseSnapshot,
  incoming: FullDatabaseSnapshot
): FullDatabaseSnapshot {
  const existingTxIds = new Set(current.transactions.map((t) => t.id));
  const existingStmtIds = new Set(current.statements.map((s) => s.id));

  const newTransactions = incoming.transactions.filter((t) => !existingTxIds.has(t.id));
  const newStatements = incoming.statements.filter((s) => !existingStmtIds.has(s.id));

  return {
    ...current,
    transactions: [...newTransactions, ...current.transactions],
    statements: [...newStatements, ...current.statements],
    auditTrail: [
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: 'BACKUP_RESTORE',
        summary: `Merged backup (+${newTransactions.length} new transactions, +${newStatements.length} statements)`,
      },
      ...current.auditTrail,
    ].slice(0, 200),
  };
}

export async function estimateStorageUsage(): Promise<{ usedBytes: number }> {
  try {
    const snap = await loadDatabaseSnapshot();
    const serialized = JSON.stringify(snap);
    return { usedBytes: new Blob([serialized]).size };
  } catch {
    return { usedBytes: 0 };
  }
}
