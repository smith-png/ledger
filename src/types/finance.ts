export type TransactionDirection = 'CREDIT' | 'DEBIT';

export type TransactionType =
  | 'EXPENSE'
  | 'INCOME'
  | 'INTERNAL_TRANSFER'
  | 'REFUND'
  | 'LOAN_SETTLEMENT';

export type PaymentMode =
  | 'UPI'
  | 'IMPS'
  | 'NEFT'
  | 'RTGS'
  | 'ATM'
  | 'POS'
  | 'NACH'
  | 'CHEQUE'
  | 'INTEREST'
  | 'CHARGE'
  | 'OTHER';

export type CounterpartyRole =
  | 'FRIEND'
  | 'FAMILY'
  | 'MERCHANT'
  | 'EMPLOYER'
  | 'UTILITY_BILLER'
  | 'SELF'
  | 'BANK';

export type TransactionLinkType =
  | 'PAYMENT_REFUND'
  | 'EXPENSE_REIMBURSEMENT'
  | 'TRANSFER_PAIR'
  | 'LOAN_REPAYMENT';

export interface TransactionSplitItem {
  id: string;
  category: string;
  subCategory: string;
  amountPaise: number;
  notes: string;
  tags: string[];
}

export interface TransactionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amountPaise: number; // Integer paise
  direction: TransactionDirection;
  transactionType: TransactionType;
  category: string;
  subCategory: string;
  counterpartyName: string;
  upiId: string;
  referenceNumber: string;
  paymentMode: PaymentMode;
  accountId: string;
  statementId?: string;
  rawDescription: string;
  userNotes: string;
  tags: string[];
  runningBalancePaise: number | null;
  confidenceScore: number;
  isEdited: boolean;
  isSplitParent: boolean;
  splits?: TransactionSplitItem[];
  linkedTransactionId?: string;
  linkType?: TransactionLinkType;
  isFlaggedAnomaly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StatementColumnMapping {
  dateColumnIndex: number;
  valueDateColumnIndex?: number;
  descriptionColumnIndex: number;
  referenceColumnIndex?: number;
  debitColumnIndex?: number;
  creditColumnIndex?: number;
  amountColumnIndex?: number;
  directionColumnIndex?: number;
  balanceColumnIndex?: number;
}

export interface StatementImportRowCandidate {
  rowIndex: number;
  rawCells: string[];
  isValid: boolean;
  validationErrors: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateOfTransactionId?: string;
  selectedForImport: boolean;
  date: string;
  amountPaise: number;
  direction: TransactionDirection;
  transactionType: TransactionType;
  category: string;
  subCategory: string;
  counterpartyName: string;
  upiId: string;
  referenceNumber: string;
  paymentMode: PaymentMode;
  rawDescription: string;
  runningBalancePaise: number | null;
  confidenceScore: number;
}

export interface StatementImportPreview {
  fileName: string;
  fileSizeBytes: number;
  format: 'PDF' | 'CSV' | 'XLS' | 'XLSX';
  fileSignature: string;
  bankName: string;
  accountNumberMasked: string;
  accountHolderName: string;
  ifscCode?: string;
  branchName?: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  openingBalancePaise: number;
  closingBalancePaise: number;
  debitTotalPaise: number;
  creditTotalPaise: number;
  reconciliationDiffPaise: number;
  requiresColumnMapping: boolean;
  detectedHeaders: string[];
  sampleRawRows: string[][];
  columnMapping: StatementColumnMapping;
  candidates: StatementImportRowCandidate[];
  isPasswordProtected: boolean;
  isScannedPdfWithoutText: boolean;
  errorMessage?: string;
}

export interface StatementImportRecord {
  id: string;
  fileName: string;
  fileFormat: 'PDF' | 'CSV' | 'XLS' | 'XLSX';
  fileSizeBytes: number;
  fileSignature: string;
  accountId: string;
  bankName: string;
  accountNumberMasked: string;
  accountHolderName: string;
  ifscCode?: string;
  branchName?: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  importedAt: string;
  totalRowsParsed: number;
  validRowsImported: number;
  duplicateRowsSkipped: number;
  invalidRowsRejected: number;
  openingBalancePaise: number;
  closingBalancePaise: number;
  debitTotalPaise: number;
  creditTotalPaise: number;
  reconciliationStatus: 'RECONCILED' | 'MISMATCH' | 'UNVERIFIED';
  reconciliationDifferencePaise: number;
  transactionIds: string[];
}

export interface AccountRecord {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'WALLET' | 'CASH';
  ifscCode?: string;
  branchName?: string;
  openingBalancePaise: number;
  openingBalanceDate: string;
  lastStatementClosingBalancePaise: number | null;
  lastStatementClosingDate?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface PersonIdentity {
  id: string;
  canonicalName: string;
  aliases: string[];
  upiIds: string[];
  role: CounterpartyRole;
  notes: string;
  createdAt: string;
}

export interface ExplicitLoanSettlementRecord {
  id: string;
  personId: string;
  personName: string;
  type: 'LENT_RECEIVABLE' | 'BORROWED_PAYABLE' | 'SPLIT_EXPENSE';
  principalAmountPaise: number;
  settledAmountPaise: number;
  remainingAmountPaise: number;
  status: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED';
  issueDate: string;
  dueDate?: string;
  linkedTransactionIds: string[];
  notes: string;
  createdAt: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BOTH';
  color: string;
  iconName: string;
  subCategories: string[];
  isSystemDefault: boolean;
}

export interface ClassificationRuleCondition {
  field: 'DESCRIPTION' | 'COUNTERPARTY' | 'UPI_ID';
  operator: 'CONTAINS' | 'EQUALS' | 'STARTS_WITH';
  value: string;
}

export interface ClassificationRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditions: ClassificationRuleCondition[];
  actions: {
    setCategory?: string;
    setSubCategory?: string;
    setTransactionType?: TransactionType;
    normalizeCounterparty?: string;
    addTags?: string[];
  };
  createdAt: string;
}

export interface BudgetAllocation {
  id: string;
  categoryName: string;
  periodMonth: string; // YYYY-MM or ALL_MONTHS
  limitPaise: number;
  rolloverUnused: boolean;
  alertThresholdsPercent: number[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountPaise: number;
  currentSavedPaise: number;
  targetDate: string;
  color: string;
  notes: string;
}

export interface DebtLiability {
  id: string;
  name: string;
  lenderName: string;
  principalBalancePaise: number;
  annualInterestRatePercent: number;
  minimumMonthlyPaymentPaise: number;
  dueDayOfMonth: number;
}

export interface RecurringCommitment {
  id: string;
  name: string;
  counterpartyName: string;
  category: string;
  amountPaise: number;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  nextDueDate: string;
  isAutoDebitMandate: boolean;
  isActive: boolean;
}

export interface FinancialMilestone {
  id: string;
  title: string;
  description: string;
  achievedAt?: string;
  isUnlocked: boolean;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  actionType:
    | 'STATEMENT_IMPORT'
    | 'STATEMENT_ROLLBACK'
    | 'TRANSACTION_CREATE'
    | 'TRANSACTION_EDIT'
    | 'TRANSACTION_DELETE'
    | 'BULK_EDIT'
    | 'PERSON_MERGE'
    | 'BACKUP_RESTORE'
    | 'DATA_CLEAR';
  summary: string;
  UndoPayloadJson?: string;
}

export interface ReportingPeriod {
  mode: 'MONTH' | 'YEAR' | 'CUSTOM_RANGE' | 'ALL_HISTORY';
  month?: string; // YYYY-MM
  year?: string; // YYYY
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  label: string;
}

export interface DashboardMetrics {
  totalCreditPaise: number;
  totalDebitPaise: number;
  netCashFlowPaise: number;
  transactionCount: number;
  creditCount: number;
  debitCount: number;
  identifiedIncomePaise: number;
  identifiedExpensesPaise: number;
  internalTransfersInPaise: number;
  internalTransfersOutPaise: number;
  estimatedSavingsRatePercent: number | null;
  savingsRateStatus: 'AVAILABLE' | 'NO_IDENTIFIED_INCOME';
  currentBalancePaise: number;
  balanceSourceNote: string;
  largestExpense: {
    amountPaise: number;
    counterpartyName: string;
    date: string;
    category: string;
  } | null;
  highestSpendingCategory: {
    category: string;
    amountPaise: number;
    sharePercent: number;
  } | null;
  budgetUsage: {
    totalBudgetedPaise: number;
    totalSpentAgainstBudgetPaise: number;
    usagePercent: number | null;
  };
  upcomingCommitments30d: {
    totalPaise: number;
    count: number;
  };
}

export interface PeriodComparison {
  hasPreviousData: boolean;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  creditDeltaPaise: number;
  creditDeltaPercent: number | null;
  debitDeltaPaise: number;
  debitDeltaPercent: number | null;
  netDeltaPaise: number;
}

export interface PersonProfileSummary {
  identity: PersonIdentity;
  totalSentToPersonPaise: number;
  totalReceivedFromPersonPaise: number;
  netExchangedPaise: number; // Received - Sent (historical cash flow, not automatic debt)
  transactionCount: number;
  firstTransactionDate: string;
  lastTransactionDate: string;
  mostCommonCategory: string;
  explicitReceivablePaise: number; // Money owed to user from ExplicitLoanSettlementRecord
  explicitPayablePaise: number; // Money user owes from ExplicitLoanSettlementRecord
}

export interface FullDatabaseSnapshot {
  schemaVersion: number;
  exportedAt: string;
  appName: string;
  transactions: TransactionRecord[];
  statements: StatementImportRecord[];
  accounts: AccountRecord[];
  people: PersonIdentity[];
  loansAndSettlements: ExplicitLoanSettlementRecord[];
  categories: CategoryDefinition[];
  rules: ClassificationRule[];
  budgets: BudgetAllocation[];
  goals: SavingsGoal[];
  debts: DebtLiability[];
  commitments: RecurringCommitment[];
  milestones: FinancialMilestone[];
  auditTrail: AuditTrailEntry[];
}
