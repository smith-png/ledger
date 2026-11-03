export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionChannel =
  | 'UPI'
  | 'NEFT'
  | 'IMPS'
  | 'ACH'
  | 'POS'
  | 'ATM'
  | 'BANK';

export type CategoryName =
  | 'Food & Dining'
  | 'Groceries'
  | 'Travel & Commute'
  | 'Bills & Utilities'
  | 'Shopping'
  | 'Subscriptions'
  | 'Rent & Housing'
  | 'Health & Fitness'
  | 'People & Transfers'
  | 'Salary & Income'
  | 'Investments'
  | 'Bank Charges & Fees'
  | 'Savings Interest'
  | 'Self & Internal Transfer'
  | 'Uncategorized';

export const ALL_CATEGORIES: CategoryName[] = [
  'Food & Dining',
  'Groceries',
  'Travel & Commute',
  'Bills & Utilities',
  'Shopping',
  'Subscriptions',
  'Rent & Housing',
  'Health & Fitness',
  'People & Transfers',
  'Salary & Income',
  'Investments',
  'Bank Charges & Fees',
  'Savings Interest',
  'Self & Internal Transfer',
  'Uncategorized',
];

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  rawNarration: string;
  counterparty: string;
  upiId: string | null;
  bankCode: string | null;
  referenceNo: string | null;
  remarks: string | null;
  channel: TransactionChannel;
  type: TransactionType;
  amount: number;
  balance?: number;
  category: CategoryName;
  isPerson: boolean;
  isRecurring?: boolean;
  isSelfTransfer?: boolean;
  isBusiness?: boolean;
  eventTag?: string; // e.g. "#ExamPrep", "#FestiveShopping", "#GoaTrip"
  refundExpected?: boolean;
}

export interface ExtractedAccountMetadata {
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  branchName?: string;
  periodLabel?: string;
}

export interface ParsedNarration {
  counterparty: string;
  upiId: string | null;
  bankCode: string | null;
  referenceNo: string | null;
  remarks: string | null;
  channel: TransactionChannel;
  category: CategoryName;
  isPerson: boolean;
  isRecurring: boolean;
  isSelfTransfer: boolean;
  inferredTag?: string;
}

export interface PersonLedgerEntry {
  counterparty: string;
  upiId: string | null;
  bankCode: string | null;
  isPerson: boolean;
  isSelfTransfer: boolean;
  totalReceived: number;
  totalSent: number;
  netBalance: number;
  transactionCount: number;
  lastTransactionDate: string;
  transactions: Transaction[];
}

export interface BudgetLimit {
  category: CategoryName;
  monthlyLimit: number;
  alertThresholdPercent: number;
}

export interface BudgetStatus {
  category: CategoryName;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  transactionCount: number;
  status: 'Nominal' | 'Approaching Limit' | 'Over Budget';
}

export interface DetectedSubscription {
  id: string;
  merchant: string;
  category: CategoryName;
  amount: number;
  cadence: 'Monthly' | 'Annual' | 'Quarterly';
  lastChargedDate: string;
  nextExpectedDate: string;
  channel: TransactionChannel;
  upiId: string | null;
  occurrences: number;
  annualCost: number;
  status: 'Active' | 'Paused' | 'Review';
}

export interface StatementSummary {
  totalCredits: number;
  totalDebits: number;
  netCashflow: number;
  creditCount: number;
  debitCount: number;
  savingsRate: number;
  upiVolume: number;
  upiSharePercent: number;
  selfTransferCredits: number;
  selfTransferDebits: number;
  topCategory: { name: CategoryName; amount: number } | null;
  largestDebit: Transaction | null;
  closingBalance: number | null;
}

export interface CustomUpiRule {
  id: string;
  pattern: string; // matched case-insensitively against rawNarration, counterparty, or upiId
  renameTo: string;
  category: CategoryName;
  markAsSelfTransfer?: boolean;
  markAsBusiness?: boolean;
}

export interface RefundMatchItem {
  id: string;
  merchant: string;
  creditTxn?: Transaction;
  debitTxn?: Transaction;
  refundAmount: number;
  originalDebitAmount?: number;
  daysTaken?: number;
  status: 'MATCHED_FULL' | 'MATCHED_PARTIAL' | 'REFUND_CREDITED' | 'PENDING_REFUND';
}

export type BankFeeCode = 'MAB' | 'AMC' | 'SMS_ALERT' | 'PENALTY' | 'OTHER';

export interface BankChargeEntry {
  txn: Transaction;
  feeCode: BankFeeCode;
  chargeType:
    | 'MAB / Non-Maintenance Fine'
    | 'Debit Card AMC'
    | 'SMS Alert Fee'
    | 'Mandate / ECS Penalty'
    | 'ATM / Service Charge';
  matchedKeyword: string;
}

export interface BankFeeCategoryBreakdown {
  feeCode: BankFeeCode;
  label: string;
  shortKeywords: string;
  amount: number;
  count: number;
  mitigationTip: string;
}

export interface BankFeesSummary {
  totalFees: number;
  feeCount: number;
  feeShareOfDebitsPercent: number;
  breakdownByType: BankFeeCategoryBreakdown[];
  entries: BankChargeEntry[];
}

export interface CashflowSafetyMetrics {
  closingBalance: number;
  averageBalance: number;
  boiMabThreshold: number;
  mabShortfall: number;
  dailyDiscretionaryBurn: number;
  daysUntilZero: number;
  safeToSpendDaily: number;
  upcomingMandatesTotal: number;
  mandateShortfall: number;
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export interface MicroUpiAndHeatmapStats {
  microThreshold: number;
  microCount: number;
  microTotalAmount: number;
  microAverage: number;
  topMicroCounterparty: string | null;
  dayOfWeekTotals: Array<{ day: string; amount: number; count: number; isWeekend: boolean }>;
  weekendSharePercent: number;
  dailyTimeline: Array<{
    date: string;
    credits: number;
    debits: number;
    closingBalance: number;
  }>;
}

export interface TaxAndCaSummary {
  savingsInterestTotal: number;
  section80TTALimit: number;
  section80TTATaxableExcess: number;
  interestTransactions: Transaction[];
  businessIncome: number;
  businessExpense: number;
  netBusinessSurplus: number;
  businessTransactions: Transaction[];
  eventTagTotals: Array<{ tag: string; spent: number; received: number; count: number }>;
}

const KNOWN_MERCHANT_RULES: Array<{
  keywords: string[];
  cleanName: string;
  category: CategoryName;
  isRecurring?: boolean;
}> = [
  { keywords: ['SWIGGY', 'BUNDL TECH'], cleanName: 'Swiggy', category: 'Food & Dining' },
  { keywords: ['ZOMATO', 'ETERNAL'], cleanName: 'Zomato', category: 'Food & Dining' },
  { keywords: ['HUNGER', 'HUNGERBOX'], cleanName: 'Hunger (Food & Snacks)', category: 'Food & Dining' },
  { keywords: ['STARBUCKS', 'TATA STARBUCKS'], cleanName: 'Starbucks', category: 'Food & Dining' },
  { keywords: ['DOMINOS', 'JUBILANT FOOD'], cleanName: "Domino's Pizza", category: 'Food & Dining' },
  { keywords: ['MCDONALDS', 'HARDCASTLE'], cleanName: "McDonald's", category: 'Food & Dining' },
  { keywords: ['THIRD WAVE COFFEE', 'BLUE TOKAI'], cleanName: 'Blue Tokai Coffee', category: 'Food & Dining' },
  { keywords: ['ZEPTO', 'KIRANAKART'], cleanName: 'Zepto', category: 'Groceries' },
  { keywords: ['BLINKIT', 'GROFERS'], cleanName: 'Blinkit', category: 'Groceries' },
  { keywords: ['BIGBASKET', 'INNOVATIVE RETAIL'], cleanName: 'BigBasket', category: 'Groceries' },
  { keywords: ['D MART', 'DMART', 'AVENUE SUPERMARTS'], cleanName: 'DMart Supermarket', category: 'Groceries' },
  { keywords: ['RELIANCE FRESH', 'SMART BAZAAR'], cleanName: 'Reliance Smart Bazaar', category: 'Groceries' },
  { keywords: ['UBER', 'UBER INDIA'], cleanName: 'Uber India', category: 'Travel & Commute' },
  { keywords: ['OLA', 'ANI TECH'], cleanName: 'Ola Cabs', category: 'Travel & Commute' },
  { keywords: ['RAPIDO', 'ROPPEN'], cleanName: 'Rapido', category: 'Travel & Commute' },
  { keywords: ['IRCTC'], cleanName: 'IRCTC Railways', category: 'Travel & Commute' },
  { keywords: ['INDIGO', 'INTERGLOBE'], cleanName: 'IndiGo Airlines', category: 'Travel & Commute' },
  { keywords: ['HPCL', 'BPCL', 'IOCL', 'INDIAN OIL', 'BHARAT PETROLEUM', 'SHELL'], cleanName: 'Fuel Station (HPCL/BPCL)', category: 'Travel & Commute' },
  { keywords: ['NETFLIX'], cleanName: 'Netflix', category: 'Subscriptions', isRecurring: true },
  { keywords: ['SPOTIFY'], cleanName: 'Spotify India', category: 'Subscriptions', isRecurring: true },
  { keywords: ['YOUTUBE', 'GOOGLE PLAY', 'PLAYSTORE', 'GOOGLE INDIA DIGITAL', 'GOOGLE'], cleanName: 'Google Play / Services', category: 'Subscriptions', isRecurring: true },
  { keywords: ['AMAZON PRIME', 'PRIME VIDEO'], cleanName: 'Amazon Prime', category: 'Subscriptions', isRecurring: true },
  { keywords: ['HOTSTAR', 'DISNEY', 'JIOCINEMA'], cleanName: 'JioCinema / Disney+ Hotstar', category: 'Subscriptions', isRecurring: true },
  { keywords: ['APPLE SERVICES', 'APPLE COM BILL', 'ICLOUD'], cleanName: 'Apple iCloud+', category: 'Subscriptions', isRecurring: true },
  { keywords: ['OPENAI', 'CHATGPT', 'ANTHROPIC'], cleanName: 'Cloud Software Subscription', category: 'Subscriptions', isRecurring: true },
  { keywords: ['JIOFIBER', 'RELIANCE JIO', 'JIO POSTPAID', 'JIO PREPAID'], cleanName: 'JioFiber & Broadband', category: 'Bills & Utilities', isRecurring: true },
  { keywords: ['AIRTEL', 'BHARTI AIRTEL'], cleanName: 'Airtel Broadband & Mobile', category: 'Bills & Utilities', isRecurring: true },
  { keywords: ['TATA POWER', 'ADANI ELECTRICITY', 'MAHAVITARAN', 'MSEDCL', 'BESCOM', 'BSES'], cleanName: 'Electricity Utility (Tata Power)', category: 'Bills & Utilities', isRecurring: true },
  { keywords: ['MAHANAGAR GAS', 'IGL GAS', 'ADANI GAS', 'BHARAT GAS', 'INDANE'], cleanName: 'Piped Gas / LPG Utility', category: 'Bills & Utilities', isRecurring: true },
  { keywords: ['ONE97'], cleanName: 'One97 (Paytm)', category: 'Bills & Utilities' },
  { keywords: ['AMAZON', 'AMAZON PAY INDIA', 'AMAZON SELLER'], cleanName: 'Amazon India', category: 'Shopping' },
  { keywords: ['FLIPKART', 'FLIPKA'], cleanName: 'Flipkart', category: 'Shopping' },
  { keywords: ['MYNTRA'], cleanName: 'Myntra Designs', category: 'Shopping' },
  { keywords: ['NYKAA', 'FSN E COMMERCE'], cleanName: 'Nykaa', category: 'Shopping' },
  { keywords: ['CROMA', 'INFINITI RETAIL'], cleanName: 'Croma Electronics', category: 'Shopping' },
  { keywords: ['DECATHLON'], cleanName: 'Decathlon Sports', category: 'Shopping' },
  { keywords: ['CULT FIT', 'CULTFIT', 'CUREFIT'], cleanName: 'Cult.fit Gym Membership', category: 'Health & Fitness', isRecurring: true },
  { keywords: ['APOLLO PHARMACY', 'PHARMEASY', 'TATA 1MG', 'MEDPLUS', 'PRACTO'], cleanName: 'Apollo Pharmacy / 1mg', category: 'Health & Fitness' },
  { keywords: ['ZERODHA', 'GROWW', 'UPSTOX', 'INDIAN CLEARING CORP', 'ICCL', 'SIP', 'MUTUAL FUND', 'PPFAS'], cleanName: 'Zerodha / Mutual Fund SIP', category: 'Investments', isRecurring: true },
  { keywords: ['LANDLORD', 'HOUSE RENT', 'FLAT RENT', 'SOCIETY MAINT', 'NOBROKER', 'DESHMUKH PROPERTIES'], cleanName: 'Apartment Rent & Maintenance', category: 'Rent & Housing', isRecurring: true },
];

const COMMERCIAL_INDICATORS = [
  'PVT', 'LTD', 'LIMITED', 'LLP', 'INC', 'CORP', 'ENTERPRISES', 'SERVICES',
  'STORE', 'MART', 'SUPERMARKET', 'PHARMACY', 'HOSPITAL', 'HOTEL', 'RESTAURANT',
  'CAFE', 'BAKERY', 'FOODS', 'RETAIL', 'TRADERS', 'AGENCIES', 'MOTORS', 'PETROL',
  'ELECTRICITY', 'POWER', 'BROADBAND', 'TELECOM', 'INSURANCE', 'FINANCE', 'CLEARING',
];

function toTitleCase(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (word.length <= 1) return word.toUpperCase();
      if (['PVT', 'LTD', 'LLP', 'UPI', 'EMI', 'ATM', 'BOI', 'SBI', 'HDFC', 'ICICI'].includes(word.toUpperCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

const BANK_CODES = new Set([
  'SBIN', 'HDFC', 'ICIC', 'UTIB', 'BKID', 'BARB', 'PUNB', 'CNRB',
  'UBIN', 'UNBA', 'KKBK', 'IDFB', 'YESB', 'INDB', 'FDRL', 'MAHB', 'IOBA',
  'IDIB', 'CBIN', 'UCBA', 'AIRP', 'PYTM', 'JIOP', 'RATN', 'SCBL',
]);

/**
 * Parses a Bank of India (BOI) or general Indian bank narration string
 */
export function parseBankNarration(
  rawNarration: string,
  type: TransactionType
): ParsedNarration {
  const cleanRaw = (rawNarration || '').trim();
  const upper = cleanRaw.toUpperCase();

  let channel: TransactionChannel = 'BANK';
  if (upper.includes('UPI')) channel = 'UPI';
  else if (upper.includes('NEFT')) channel = 'NEFT';
  else if (upper.includes('IMPS')) channel = 'IMPS';
  else if (upper.includes('ACH') || upper.includes('NACH') || upper.includes('ECS') || upper.includes('MANDATE')) channel = 'ACH';
  else if (upper.includes('POS') || upper.includes('ECOM') || upper.includes('VISA') || upper.includes('RUPAY')) channel = 'POS';
  else if (upper.includes('ATM') || upper.includes('CASH WDL') || upper.includes('CASH-W')) channel = 'ATM';

  const upiMatch = cleanRaw.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/);
  let upiId = upiMatch ? upiMatch[1].toLowerCase() : null;

  const rrnMatch = cleanRaw.match(/\b(\d{9,14})\b/);
  let referenceNo = rrnMatch ? rrnMatch[1] : null;

  let counterparty = '';
  let bankCode: string | null = null;
  let remarks: string | null = null;

  if (channel === 'UPI') {
    const slashParts = cleanRaw.split('/').map((p) => p.trim()).filter(Boolean);
    if (
      slashParts.length >= 4 &&
      slashParts[0].toUpperCase() === 'UPI' &&
      (slashParts[1].toUpperCase() === 'DR' ||
        slashParts[1].toUpperCase() === 'CR' ||
        slashParts[2]?.toUpperCase() === 'DR' ||
        slashParts[2]?.toUpperCase() === 'CR')
    ) {
      const p1 = slashParts[1];
      const p2 = slashParts[2];
      if (/^\d{8,16}$/.test(p1)) referenceNo = p1;
      else if (/^\d{8,16}$/.test(p2)) referenceNo = p2;

      const rawName = slashParts[3] || '';
      counterparty = toTitleCase(rawName);

      if (slashParts[4] && (/^[A-Z]{4}$/i.test(slashParts[4]) || BANK_CODES.has(slashParts[4].toUpperCase()))) {
        bankCode = slashParts[4].toUpperCase();
        if (slashParts[5]) {
          const handlePart = slashParts[5];
          if (!upiId) {
            upiId = handlePart.includes('@')
              ? handlePart.toLowerCase()
              : `${handlePart.toLowerCase()}@${bankCode.toLowerCase()}`;
          }
        }
        if (slashParts.length > 6) {
          remarks = slashParts.slice(6).join(' · ');
        }
      } else if (slashParts.length > 4) {
        remarks = slashParts.slice(4).join(' · ');
      }
    } else {
      const parts = cleanRaw.split(/[\/|\-*]/).map((p) => p.trim()).filter(Boolean);
      const filteredParts: string[] = [];

      for (const part of parts) {
        const pUpper = part.toUpperCase();
        if (pUpper === 'UPI' || pUpper === 'DR' || pUpper === 'CR' || pUpper === 'P2A' || pUpper === 'P2M' || pUpper === 'P2P') {
          continue;
        }
        if (/^\d{10,16}$/.test(part)) {
          continue;
        }
        if (BANK_CODES.has(pUpper) || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(pUpper)) {
          if (!bankCode) bankCode = pUpper.slice(0, 4);
          continue;
        }
        if (part.includes('@')) {
          continue;
        }
        filteredParts.push(part);
      }

      if (filteredParts.length > 0) {
        counterparty = toTitleCase(filteredParts[0]);
        if (filteredParts.length > 1) {
          remarks = filteredParts.slice(1).join(' · ');
        }
      } else if (upiId) {
        const handleName = upiId.split('@')[0].replace(/[0-9._-]+/g, ' ').trim();
        counterparty = toTitleCase(handleName || upiId);
      }
    }
  } else if (channel === 'NEFT' || channel === 'IMPS') {
    const parts = cleanRaw
      .replace(/^(BY TRANSFER|TO TRANSFER)[\s\-:]*/i, '')
      .split(/[\/|\-*]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const candidates: string[] = [];
    for (const part of parts) {
      const pUpper = part.toUpperCase();
      if (['NEFT', 'IMPS', 'RTGS', 'P2A', 'P2P', 'DR', 'CR', 'INB', 'MOB'].includes(pUpper)) continue;
      if (/^\d{7,16}$/.test(part)) continue;
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(pUpper) || BANK_CODES.has(pUpper)) {
        if (!bankCode) bankCode = pUpper.slice(0, 4);
        continue;
      }
      candidates.push(part);
    }
    if (candidates.length > 0) {
      counterparty = toTitleCase(candidates[0]);
      if (candidates.length > 1) {
        remarks = candidates.slice(1).join(' · ');
      }
    }
  } else if (channel === 'ACH') {
    const parts = cleanRaw
      .replace(/^(ACH|NACH|ECS)[\s\-_\/]*(DR|CR)?[\s\-_\/]*/i, '')
      .split(/[\/|\-*]/)
      .map((p) => p.trim())
      .filter((p) => p && !/^\d+$/.test(p));
    counterparty = parts[0] ? toTitleCase(parts[0]) : 'Automated Mandate';
    if (parts.length > 1) remarks = parts.slice(1).join(' · ');
  } else if (channel === 'ATM') {
    counterparty = 'BOI ATM Cash Withdrawal';
    remarks = cleanRaw;
  } else if (channel === 'POS') {
    const cleaned = cleanRaw.replace(/^POS[\s\-]*(\d+X+\d+|\d+)?[\s\-]*/i, '').trim();
    counterparty = cleaned ? toTitleCase(cleaned) : 'Card POS Purchase';
  }

  // Check bank charges / interest first (scans for BOI AMC, SMS Alert, Penalty, MAB/QAB, ATM/Service fees)
  const isBankCharge =
    type === 'DEBIT' &&
    (/\bMAB\b/.test(upper) ||
      /\bQAB\b/.test(upper) ||
      upper.includes('MIN BAL') ||
      upper.includes('NON MAINT') ||
      upper.includes('SHORTFALL') ||
      upper.includes('SMS CHG') ||
      upper.includes('SMS ALERT') ||
      upper.includes('SMS FEE') ||
      /\bAMC\b/.test(upper) ||
      upper.includes('ANNUAL MAINT') ||
      upper.includes('CARD FEE') ||
      upper.includes('PENALTY') ||
      upper.includes('PENAL') ||
      upper.includes('NACH RETURN') ||
      upper.includes('ECS RETURN') ||
      upper.includes('RETURN CHG') ||
      upper.includes('BOUNCE'));

  const isSavingsInterest =
    type === 'CREDIT' &&
    (upper.includes('INT.PD') ||
      upper.includes('SB INT') ||
      upper.includes('SAVINGS INT') ||
      upper.includes('INTEREST CREDIT') ||
      upper.includes('QUARTERLY INT'));

  const cpUpperRaw = counterparty.toUpperCase();
  let matchedRule: (typeof KNOWN_MERCHANT_RULES)[number] | null = null;
  if (!isBankCharge && !isSavingsInterest) {
    for (const rule of KNOWN_MERCHANT_RULES) {
      if (rule.keywords.some((kw) => cpUpperRaw.includes(kw) || upper.includes(`/${kw}/`))) {
        matchedRule = rule;
        break;
      }
    }
    if (!matchedRule) {
      for (const rule of KNOWN_MERCHANT_RULES) {
        if (rule.keywords.some((kw) => upper.includes(kw))) {
          matchedRule = rule;
          break;
        }
      }
    }
  }

  if (isBankCharge) {
    counterparty = counterparty || 'Bank of India Fee / Charge';
  } else if (isSavingsInterest) {
    counterparty = 'Bank of India Quarterly Interest';
  } else if (matchedRule) {
    counterparty = matchedRule.cleanName;
  } else if (!counterparty) {
    counterparty = toTitleCase(cleanRaw.slice(0, 32) || 'Bank Transaction');
  }

  // Detect Self / Internal Family Handle (e.g., Tanmay / pradiploh@bkid)
  const isSelfTransfer =
    cpUpperRaw === 'TANMAY' ||
    (upiId !== null && upiId.startsWith('pradiploh@')) ||
    upper.includes('SELF TRANSFER');

  const cpUpper = counterparty.toUpperCase();
  const hasCommercialWord = COMMERCIAL_INDICATORS.some((w) => cpUpper.includes(w));
  const isSalary =
    type === 'CREDIT' &&
    (upper.includes('SALARY') || upper.includes('PAYROLL') || upper.includes('STIPEND') || upper.includes('DIVIDEND'));
  const isRent =
    upper.includes('HOUSE RENT') || upper.includes('FLAT RENT') || upper.includes('LANDLORD') || upper.includes('PROPERTIES');

  const isPerson =
    !isBankCharge &&
    !isSavingsInterest &&
    !matchedRule &&
    !hasCommercialWord &&
    !isSalary &&
    !isRent &&
    channel !== 'ATM' &&
    channel !== 'POS' &&
    channel !== 'ACH' &&
    (channel === 'UPI' || channel === 'IMPS' || channel === 'NEFT');

  let category: CategoryName = 'Uncategorized';
  const hasSubscrRemark =
    upper.includes('SUBSCR') ||
    upper.includes('MANDAT') ||
    upper.includes('AUTOPAY') ||
    channel === 'ACH';
  let isRecurring = Boolean(matchedRule?.isRecurring) || hasSubscrRemark;

  if (isBankCharge) {
    category = 'Bank Charges & Fees';
    isRecurring = false;
  } else if (isSavingsInterest) {
    category = 'Savings Interest';
    isRecurring = false;
  } else if (hasSubscrRemark && matchedRule && matchedRule.cleanName.includes('Amazon')) {
    category = 'Subscriptions';
    isRecurring = true;
  } else if (matchedRule) {
    category = matchedRule.category;
  } else if (isSalary) {
    category = 'Salary & Income';
  } else if (isRent || upper.includes('MAINTENANCE') || upper.includes('SOCIETY')) {
    category = 'Rent & Housing';
    isRecurring = true;
  } else if (isPerson) {
    category = 'People & Transfers';
  } else if (upper.includes('ELECTRIC') || upper.includes('WATER BILL') || upper.includes('BROADBAND') || upper.includes('RECHARGE') || upper.includes('BILL')) {
    category = 'Bills & Utilities';
  } else if (upper.includes('RESTAURANT') || upper.includes('CAFE') || upper.includes('DINNER') || upper.includes('LUNCH') || upper.includes('FOOD') || upper.includes('BAKERY')) {
    category = 'Food & Dining';
  } else if (upper.includes('GROCER') || upper.includes('VEGETABLE') || upper.includes('DAIRY') || upper.includes('SUPERMARKET') || upper.includes('KIRANA')) {
    category = 'Groceries';
  } else if (upper.includes('METRO') || upper.includes('PETROL') || upper.includes('FUEL') || upper.includes('CAB') || upper.includes('AUTO') || upper.includes('FLIGHT') || upper.includes('TRAIN')) {
    category = 'Travel & Commute';
  } else if (upper.includes('PHARMACY') || upper.includes('HOSPITAL') || upper.includes('CLINIC') || upper.includes('GYM') || upper.includes('MEDICAL')) {
    category = 'Health & Fitness';
  } else if (upper.includes('SUBSCRIPTION') || upper.includes('MEMBERSHIP') || hasSubscrRemark) {
    category = 'Subscriptions';
    isRecurring = true;
  }

  // Infer smart event tags from BOI remarks
  let inferredTag: string | undefined;
  if (upper.includes('/EDUCAT') || upper.includes('/EXAM')) {
    inferredTag = '#EducationAndExams';
  } else if (upper.includes('GOA') || upper.includes('FLIGHT') || upper.includes('HOTEL')) {
    inferredTag = '#GoaTrip';
  } else if (matchedRule && (matchedRule.cleanName === 'Amazon India' || matchedRule.cleanName === 'Flipkart') && !hasSubscrRemark) {
    inferredTag = '#FestiveShopping';
  }

  return {
    counterparty,
    upiId,
    bankCode,
    referenceNo,
    remarks,
    channel,
    category,
    isPerson,
    isRecurring,
    isSelfTransfer,
    inferredTag,
  };
}

/**
 * Unifies numeric counterparty placeholders (e.g. "976932" in UPI/DR/.../976932/UCBA/976932746)
 * with the human name from other transactions sharing the same UPI handle (e.g. "Arun K" with 976932746@ucba).
 */
export function reconcileCounterpartyNames(transactions: Transaction[]): Transaction[] {
  const handleToName = new Map<string, string>();
  for (const t of transactions) {
    if (t.upiId && /[A-Za-z]{2,}/.test(t.counterparty) && !/^\d+$/.test(t.counterparty)) {
      handleToName.set(t.upiId.toLowerCase(), t.counterparty);
    }
  }
  return transactions.map((t) => {
    if (t.upiId && /^\d+$/.test(t.counterparty)) {
      const resolved = handleToName.get(t.upiId.toLowerCase());
      if (resolved) {
        return { ...t, counterparty: resolved };
      }
    }
    return t;
  });
}

/**
 * Applies user-defined Custom UPI Learning Rules retroactively across all transactions
 */
export function applyCustomUpiRules(
  transactions: Transaction[],
  rules: CustomUpiRule[]
): Transaction[] {
  if (!rules || rules.length === 0) return transactions;

  return transactions.map((t) => {
    const haystack = `${t.rawNarration} ${t.counterparty} ${t.upiId || ''}`.toLowerCase();
    for (const rule of rules) {
      const pat = rule.pattern.trim().toLowerCase();
      if (pat && haystack.includes(pat)) {
        return {
          ...t,
          counterparty: rule.renameTo.trim() || t.counterparty,
          category: rule.category || t.category,
          isSelfTransfer: rule.markAsSelfTransfer ?? t.isSelfTransfer,
          isBusiness: rule.markAsBusiness ?? t.isBusiness,
        };
      }
    }
    return t;
  });
}

/**
 * Deduplicates transactions when merging multiple statements using 12-digit RRN or Date+Amount+Narration
 */
export function deduplicateTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): { merged: Transaction[]; addedCount: number; duplicateCount: number } {
  const seenKeys = new Set<string>();
  const getKey = (t: Transaction) =>
    t.referenceNo
      ? `rrn:${t.referenceNo}:${t.type}:${t.amount}`
      : `sig:${t.date}:${t.type}:${t.amount}:${t.rawNarration}`;

  for (const t of existing) {
    seenKeys.add(getKey(t));
  }

  const merged = [...existing];
  let addedCount = 0;
  let duplicateCount = 0;

  for (const t of incoming) {
    const k = getKey(t);
    if (seenKeys.has(k)) {
      duplicateCount++;
    } else {
      seenKeys.add(k);
      merged.push({ ...t, id: `merged-${merged.length + 1}-${t.date}` });
      addedCount++;
    }
  }

  return { merged, addedCount, duplicateCount };
}

/**
 * Anonymizes / Redacts PII names, account numbers, IFSC, and VPA handles when Privacy Mode is active
 */
export function redactSensitiveText(text: string | null | undefined, isRedacted: boolean): string {
  if (!text) return '';
  if (!isRedacted) return text;

  // Mask VPA handle
  if (text.includes('@')) {
    const [user, domain] = text.split('@');
    const maskedUser = user.length > 2 ? `${user.slice(0, 2)}••••` : '•••';
    return `${maskedUser}@${domain}`;
  }

  // Mask long account numbers / RRNs
  if (/^\d{8,16}$/.test(text.trim())) {
    return `••••${text.trim().slice(-4)}`;
  }

  // Mask words in names
  return text
    .split(' ')
    .map((w) => {
      if (w.length <= 2) return w;
      if (/^\d+$/.test(w)) return `••${w.slice(-2)}`;
      return `${w[0]}${'•'.repeat(Math.min(5, w.length - 1))}`;
    })
    .join(' ');
}

/**
 * Normalizes various Indian bank date strings into YYYY-MM-DD
 */
export function normalizeBankDate(rawDate: string): string | null {
  const clean = (rawDate || '').trim().replace(/^["']|["']$/g, '');
  if (!clean) return null;

  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dmyNumeric = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyNumeric) {
    const [, d, m, yRaw] = dmyNumeric;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const monthNum = parseInt(m, 10);
    const dayNum = parseInt(d, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${y}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    }
  }

  const monthNames: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };
  const dmyAlpha = clean.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s\-\/,]+(\d{2,4})/);
  if (dmyAlpha) {
    const [, d, monRaw, yRaw] = dmyAlpha;
    const monKey = monRaw.slice(0, 3).toUpperCase();
    const m = monthNames[monKey];
    if (m) {
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

export function parseAmountNumber(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/INR|RS\.?|₹|\u00a0|\s/gi, '')
    .replace(/(CR|DR)$/i, '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '--') return 0;
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? Math.abs(val) : 0;
}

export function splitDelimitedRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseStatementText(rawContent: string): Transaction[] {
  if (!rawContent || !rawContent.trim()) return [];

  let text = rawContent;

  if (/<table|<tr|<td/i.test(text)) {
    const rowMatches = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const extractedLines: string[] = [];
    for (const rowHtml of rowMatches) {
      const cells = (rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map((cell) =>
        cell
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim()
      );
      if (cells.length >= 3) {
        extractedLines.push(cells.join('\t'));
      }
    }
    if (extractedLines.length > 0) {
      text = extractedLines.join('\n');
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const transactions: Transaction[] = [];

  let delimiter = ',';
  const sampleLines = lines.slice(0, 15);
  const tabCount = sampleLines.filter((l) => l.includes('\t')).length;
  const pipeCount = sampleLines.filter((l) => l.includes('|')).length;
  if (tabCount >= Math.max(2, sampleLines.length / 3)) delimiter = '\t';
  else if (pipeCount >= Math.max(2, sampleLines.length / 3)) delimiter = '|';

  let dateCol = -1;
  let narrationCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let amountCol = -1;
  let typeCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const row = splitDelimitedRow(lines[i], delimiter);

    if (dateCol === -1 && row.length >= 3) {
      const lowerRow = row.map((c) => c.toLowerCase());
      const foundDateIdx = lowerRow.findIndex((c) =>
        c.includes('txn date') || c.includes('tran date') || c.includes('transaction date') || c === 'date' || c.includes('value date')
      );
      const foundNarrIdx = lowerRow.findIndex((c) =>
        c.includes('description') || c.includes('narration') || c.includes('particulars') || c.includes('remarks') || c.includes('details')
      );

      if (foundDateIdx !== -1 && foundNarrIdx !== -1) {
        dateCol = foundDateIdx;
        narrationCol = foundNarrIdx;
        debitCol = lowerRow.findIndex((c) => c.includes('debit') || c.includes('withdrawal') || c === 'dr' || c.includes('dr amount'));
        creditCol = lowerRow.findIndex((c) => c.includes('credit') || c.includes('deposit') || c === 'cr' || c.includes('cr amount'));
        amountCol = lowerRow.findIndex((c) => c === 'amount' || c.includes('txn amount') || c.includes('transaction amount'));
        typeCol = lowerRow.findIndex((c) => c === 'type' || c === 'dr/cr' || c === 'cr/dr' || c.includes('txn type'));
        balanceCol = lowerRow.findIndex((c) => c.includes('balance') || c.includes('closing'));
        continue;
      }
    }

    if (dateCol !== -1 && row.length >= 3) {
      const normalizedDate = normalizeBankDate(row[dateCol]);
      if (!normalizedDate) continue;

      const rawNarration = row[narrationCol] || 'Bank Transaction';
      let type: TransactionType = 'DEBIT';
      let amount = 0;

      if (debitCol !== -1 && creditCol !== -1) {
        const debitVal = parseAmountNumber(row[debitCol]);
        const creditVal = parseAmountNumber(row[creditCol]);
        if (creditVal > 0 && debitVal === 0) {
          type = 'CREDIT';
          amount = creditVal;
        } else if (debitVal > 0) {
          type = 'DEBIT';
          amount = debitVal;
        }
      } else if (amountCol !== -1) {
        const rawAmt = row[amountCol] || '';
        amount = parseAmountNumber(rawAmt);
        const typeStr = typeCol !== -1 ? (row[typeCol] || '').toUpperCase() : rawAmt.toUpperCase();
        if (typeStr.includes('CR') || typeStr.includes('CREDIT') || typeStr.includes('+')) {
          type = 'CREDIT';
        } else if (typeStr.includes('DR') || typeStr.includes('DEBIT') || typeStr.includes('-')) {
          type = 'DEBIT';
        } else if (/UPI\/\d+\/CR|UPI\/CR|BY TRANSFER|SALARY|REFUND/i.test(rawNarration)) {
          type = 'CREDIT';
        }
      }

      if (amount <= 0) continue;

      const balance = balanceCol !== -1 ? parseAmountNumber(row[balanceCol]) : undefined;
      const parsed = parseBankNarration(rawNarration, type);

      transactions.push({
        id: `txn-${transactions.length + 1}-${normalizedDate}`,
        date: normalizedDate,
        rawNarration,
        counterparty: parsed.counterparty,
        upiId: parsed.upiId,
        bankCode: parsed.bankCode,
        referenceNo: parsed.referenceNo,
        remarks: parsed.remarks,
        channel: parsed.channel,
        type,
        amount,
        balance: balance && balance > 0 ? balance : undefined,
        category: parsed.category,
        isPerson: parsed.isPerson,
        isRecurring: parsed.isRecurring,
        isSelfTransfer: parsed.isSelfTransfer,
        eventTag: parsed.inferredTag,
      });
      continue;
    }

    if (row.length >= 3) {
      const col0Date = normalizeBankDate(row[0]);
      const col1Date = !col0Date && row.length >= 4 ? normalizeBankDate(row[1]) : null;
      const dateStr = col0Date || col1Date;
      if (dateStr) {
        const startIdx = col0Date ? 1 : 2;
        const remaining = row.slice(startIdx);
        const narrIdx = remaining.findIndex((c) => /[A-Za-z]{3,}/.test(c) && !/^(CR|DR|INR)$/i.test(c.trim()));
        if (narrIdx !== -1) {
          const rawNarration = remaining[narrIdx];
          const afterNarr = remaining.slice(narrIdx + 1);
          const numericCols = afterNarr.map((c) => ({ raw: c, val: parseAmountNumber(c) }));
          if (numericCols.length >= 1) {
            let amount = 0;
            let type: TransactionType = 'DEBIT';
            let balance: number | undefined;

            if (numericCols.length >= 3) {
              const [dCol, cCol, bCol] = numericCols;
              if (cCol.val > 0 && dCol.val === 0) {
                type = 'CREDIT';
                amount = cCol.val;
              } else {
                type = 'DEBIT';
                amount = dCol.val || cCol.val;
              }
              if (bCol.val > 0) balance = bCol.val;
            } else if (numericCols.length === 2) {
              amount = numericCols[0].val;
              balance = numericCols[1].val;
              if (/UPI\/\d+\/CR|UPI\/CR|BY TRANSFER|NEFT.*SALARY|CR\b/i.test(rawNarration) || /CR/i.test(numericCols[0].raw)) {
                type = 'CREDIT';
              }
            } else {
              amount = numericCols[0].val;
              if (/UPI\/\d+\/CR|UPI\/CR|BY TRANSFER|CR\b/i.test(rawNarration) || /CR/i.test(numericCols[0].raw)) {
                type = 'CREDIT';
              }
            }

            if (amount > 0) {
              const parsed = parseBankNarration(rawNarration, type);
              transactions.push({
                id: `txn-${transactions.length + 1}-${dateStr}`,
                date: dateStr,
                rawNarration,
                counterparty: parsed.counterparty,
                upiId: parsed.upiId,
                bankCode: parsed.bankCode,
                referenceNo: parsed.referenceNo,
                remarks: parsed.remarks,
                channel: parsed.channel,
                type,
                amount,
                balance,
                category: parsed.category,
                isPerson: parsed.isPerson,
                isRecurring: parsed.isRecurring,
                isSelfTransfer: parsed.isSelfTransfer,
                eventTag: parsed.inferredTag,
              });
              continue;
            }
          }
        }
      }
    }

    const freeLineMatch = lines[i].match(
      /^(?:\d+\s+)?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\s\-][A-Za-z]{3}[\s\-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s*(DR|CR|Dr|Cr)?(?:\s+(?:₹\s*)?([\d,]+\.\d{2})(?:\s*(?:Cr|Dr|CR|DR))?)?$/
    );
    if (freeLineMatch) {
      const [, rawDate, rawNarr, rawAmt, drCrFlag, rawBal] = freeLineMatch;
      const dateStr = normalizeBankDate(rawDate);
      const amount = parseAmountNumber(rawAmt);
      if (dateStr && amount > 0) {
        let type: TransactionType = 'DEBIT';
        if (drCrFlag && drCrFlag.toUpperCase() === 'CR') {
          type = 'CREDIT';
        } else if (!drCrFlag && /UPI\/\d+\/CR|UPI\/CR|BY TRANSFER|SALARY|CREDIT|REFUND/i.test(rawNarr)) {
          type = 'CREDIT';
        }
        const balance = rawBal ? parseAmountNumber(rawBal) : undefined;
        const parsed = parseBankNarration(rawNarr, type);
        transactions.push({
          id: `txn-${transactions.length + 1}-${dateStr}`,
          date: dateStr,
          rawNarration: rawNarr.trim(),
          counterparty: parsed.counterparty,
          upiId: parsed.upiId,
          bankCode: parsed.bankCode,
          referenceNo: parsed.referenceNo,
          remarks: parsed.remarks,
          channel: parsed.channel,
          type,
          amount,
          balance,
          category: parsed.category,
          isPerson: parsed.isPerson,
          isRecurring: parsed.isRecurring,
          isSelfTransfer: parsed.isSelfTransfer,
          eventTag: parsed.inferredTag,
        });
      }
    }
  }

  return reconcileCounterpartyNames(transactions);
}

function uint8ToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    out += String.fromCharCode.apply(null, Array.from(slice));
  }
  return out;
}

function joinRemarkFragments(lines: string[]): string {
  if (lines.length === 0) return '';
  let acc = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const next = lines[i];
    const slashCount = (acc.match(/\//g) || []).length;
    if (acc.endsWith('/') || acc.endsWith('-') || acc.endsWith('.') || next.startsWith('/')) {
      acc += next;
    } else if (slashCount <= 3) {
      acc += ' ' + next;
    } else {
      acc += next;
    }
  }
  return acc;
}

export async function parsePdfStatementWithMeta(
  buffer: ArrayBuffer
): Promise<{ transactions: Transaction[]; meta: ExtractedAccountMetadata }> {
  const bytes = new Uint8Array(buffer);
  const rawPdf = uint8ToBinaryString(bytes);

  const decompressedStreams: string[] = [];

  if (typeof DecompressionStream !== 'undefined') {
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(rawPdf)) !== null) {
      const content = streamMatch[1];
      if (content.length > 10 && content.length < 1_000_000) {
        const streamBytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
          streamBytes[i] = content.charCodeAt(i) & 0xff;
        }
        for (const format of ['deflate', 'deflate-raw'] as const) {
          try {
            const inputBytes = format === 'deflate-raw' ? streamBytes.subarray(2) : streamBytes;
            const ds = new DecompressionStream(format);
            const writer = ds.writable.getWriter();
            writer.write(inputBytes).catch(() => {});
            writer.close().catch(() => {});
            const decompressedBuf = await new Response(ds.readable).arrayBuffer();
            const text = uint8ToBinaryString(new Uint8Array(decompressedBuf));
            if (text.length > 0) {
              decompressedStreams.push(text);
            }
            break;
          } catch {
            // Non-deflate stream, ignore
          }
        }
      }
    }
  }

  const allStreams = decompressedStreams.length > 0 ? decompressedStreams : [rawPdf];

  const cmap = new Map<number, string>();
  for (const s of allStreams) {
    if (s.includes('beginbfrange')) {
      const rangeRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let rm: RegExpExecArray | null;
      while ((rm = rangeRegex.exec(s)) !== null) {
        const start = parseInt(rm[1], 16);
        const end = parseInt(rm[2], 16);
        const dst = parseInt(rm[3], 16);
        for (let c = start; c <= end; c++) {
          cmap.set(c, String.fromCodePoint(dst + (c - start)));
        }
      }
    }
    if (s.includes('beginbfchar')) {
      const charRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let cm: RegExpExecArray | null;
      while ((cm = charRegex.exec(s)) !== null) {
        cmap.set(parseInt(cm[1], 16), String.fromCodePoint(parseInt(cm[2], 16)));
      }
    }
  }

  const decodeHexTj = (hex: string): string => {
    let out = '';
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (cmap.has(code)) {
        out += cmap.get(code);
      } else if (code >= 0x20 && code <= 0x7e) {
        out += String.fromCharCode(code);
      }
    }
    return out;
  };

  const meta: ExtractedAccountMetadata = {};
  const extractedRows: Array<{
    srNo: string;
    date: string;
    remarks: string;
    debit: string;
    credit: string;
    balance: string;
  }> = [];

  let fromDateStr = '';
  let toDateStr = '';

  for (const s of allStreams) {
    if (!s.includes('BT')) continue;

    const items: Array<{ x: number; y: number; text: string }> = [];
    const btRegex = /BT([\s\S]*?)ET/g;
    let bm: RegExpExecArray | null;

    while ((bm = btRegex.exec(s)) !== null) {
      const block = bm[1];
      const tdMatch = block.match(/([\d.]+)\s+([\d.]+)\s+Td/);
      if (!tdMatch) continue;
      const x = parseFloat(tdMatch[1]);
      const y = parseFloat(tdMatch[2]);

      let text = '';
      const tjRegex = /\((?:\\.|[^\\()])*\)\s*Tj|<([0-9a-fA-F]+)>\s*Tj/g;
      let tm: RegExpExecArray | null;
      while ((tm = tjRegex.exec(block)) !== null) {
        if (tm[1]) {
          text += decodeHexTj(tm[1]);
        } else {
          const inner = tm[0]
            .replace(/\)\s*Tj$/, '')
            .slice(1)
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          text += inner;
        }
      }
      text = text.trim();
      if (text) {
        items.push({ x, y, text });
      }
    }

    if (items.length === 0) continue;

    items.sort((a, b) => (Math.abs(b.y - a.y) > 6 ? b.y - a.y : a.x - b.x));

    const visualLines: Array<{ y: number; items: Array<{ x: number; y: number; text: string }> }> = [];
    for (const it of items) {
      const last = visualLines[visualLines.length - 1];
      if (last && Math.abs(last.y - it.y) <= 6) {
        last.items.push(it);
      } else {
        visualLines.push({ y: it.y, items: [it] });
      }
    }

    for (const line of visualLines) {
      line.items.sort((a, b) => a.x - b.x);
      const texts = line.items.map((i) => i.text);

      for (let idx = 0; idx < texts.length; idx++) {
        const t = texts[idx];
        if (/^Account holder name:/i.test(t) && texts[idx + 1]) {
          meta.accountHolder = texts[idx + 1];
        } else if (/^Account number:/i.test(t) && texts[idx + 1]) {
          meta.accountNumber = texts[idx + 1];
        } else if (/^IFSC:/i.test(t) && texts[idx + 1]) {
          meta.ifsc = texts[idx + 1];
        } else if (/^Branch Name:/i.test(t) && texts[idx + 1]) {
          meta.branchName = texts[idx + 1];
        } else if (/^from:\s*(\d{2}-\d{2}-\d{4})/i.test(t)) {
          const m = t.match(/(\d{2}-\d{2}-\d{4})/);
          if (m) fromDateStr = m[1];
        } else if (/^to:\s*(\d{2}-\d{2}-\d{4})/i.test(t)) {
          const m = t.match(/(\d{2}-\d{2}-\d{4})/);
          if (m) toDateStr = m[1];
        }
      }

      const srItem = line.items.find((i) => i.x >= 100 && i.x < 210 && /^\d+$/.test(i.text));
      const dateItem = line.items.find(
        (i) => i.x >= 210 && i.x < 355 && normalizeBankDate(i.text) !== null
      );
      const remarkItems = line.items.filter(
        (i) =>
          i.x >= 355 &&
          i.x < 810 &&
          i.text !== 'Remarks' &&
          !/^(from:|to:|Account|IFSC|Branch)/i.test(i.text)
      );
      const debitItem = line.items.find(
        (i) => i.x >= 810 && i.x < 1004 && /^[\d,]+\.\d{2}$/.test(i.text)
      );
      const creditItem = line.items.find(
        (i) => i.x >= 1004 && i.x < 1197 && /^[\d,]+\.\d{2}$/.test(i.text)
      );
      const balItem = line.items.find(
        (i) => i.x >= 1197 && /[\d,]+\.\d{2}/.test(i.text)
      );

      if (dateItem) {
        extractedRows.push({
          srNo: srItem ? srItem.text : String(extractedRows.length + 1),
          date: dateItem.text,
          remarks: joinRemarkFragments(remarkItems.map((r) => r.text)),
          debit: debitItem ? debitItem.text : '',
          credit: creditItem ? creditItem.text : '',
          balance: balItem ? balItem.text : '',
        });
      } else if (
        !srItem &&
        !dateItem &&
        remarkItems.length > 0 &&
        extractedRows.length > 0 &&
        line.items.every((i) => i.x >= 350 && i.x < 810)
      ) {
        const prev = extractedRows[extractedRows.length - 1];
        prev.remarks = joinRemarkFragments([prev.remarks, ...remarkItems.map((r) => r.text)]);
      }
    }
  }

  if (fromDateStr && toDateStr) {
    meta.periodLabel = `${fromDateStr} to ${toDateStr}`;
  }

  if (extractedRows.length > 0) {
    const tsvLines = [
      'Sr No\tDate\tRemarks\tDebit\tCredit\tBalance',
      ...extractedRows.map(
        (r) => `${r.srNo}\t${r.date}\t${r.remarks}\t${r.debit}\t${r.credit}\t${r.balance}`
      ),
    ];
    return {
      transactions: parseStatementText(tsvLines.join('\n')),
      meta,
    };
  }

  const fallbackLines: string[] = [];
  for (const s of allStreams) {
    const tokenRegex = /\((?:\\.|[^\\()])*\)/g;
    let m: RegExpExecArray | null;
    let line = '';
    while ((m = tokenRegex.exec(s)) !== null) {
      const inner = m[0].slice(1, -1).trim();
      if (inner) line += ' ' + inner;
      if (line.length > 120) {
        fallbackLines.push(line.trim());
        line = '';
      }
    }
    if (line.trim()) fallbackLines.push(line.trim());
  }

  return {
    transactions: parseStatementText(fallbackLines.join('\n') + '\n' + rawPdf),
    meta,
  };
}

export async function parsePdfStatementBuffer(buffer: ArrayBuffer): Promise<Transaction[]> {
  const { transactions } = await parsePdfStatementWithMeta(buffer);
  return transactions;
}

/**
 * Computes top-level summary metrics for the dashboard (supports excluding self/internal transfers)
 */
export function calculateStatementSummary(
  transactions: Transaction[],
  excludeSelfTransfers = false
): StatementSummary {
  let totalCredits = 0;
  let totalDebits = 0;
  let creditCount = 0;
  let debitCount = 0;
  let upiVolume = 0;
  let selfTransferCredits = 0;
  let selfTransferDebits = 0;
  let largestDebit: Transaction | null = null;
  const categoryTotals = new Map<CategoryName, number>();

  for (const t of transactions) {
    if (t.isSelfTransfer) {
      if (t.type === 'CREDIT') selfTransferCredits += t.amount;
      else selfTransferDebits += t.amount;
      if (excludeSelfTransfers) continue;
    }

    if (t.type === 'CREDIT') {
      totalCredits += t.amount;
      creditCount++;
    } else {
      totalDebits += t.amount;
      debitCount++;
      if (!largestDebit || t.amount > largestDebit.amount) {
        largestDebit = t;
      }
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
    }
    if (t.channel === 'UPI') {
      upiVolume += t.amount;
    }
  }

  const netCashflow = Math.round((totalCredits - totalDebits) * 100) / 100;
  const savingsRate = totalCredits > 0 ? Math.round(((totalCredits - totalDebits) / totalCredits) * 1000) / 10 : 0;
  const totalVolume = totalCredits + totalDebits;
  const upiSharePercent = totalVolume > 0 ? Math.round((upiVolume / totalVolume) * 1000) / 10 : 0;

  let topCategory: { name: CategoryName; amount: number } | null = null;
  for (const [name, amount] of categoryTotals.entries()) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = { name, amount };
    }
  }

  const withBalance = transactions.find((t) => typeof t.balance === 'number');

  return {
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    netCashflow,
    creditCount,
    debitCount,
    savingsRate,
    upiVolume: Math.round(upiVolume * 100) / 100,
    upiSharePercent,
    selfTransferCredits: Math.round(selfTransferCredits * 100) / 100,
    selfTransferDebits: Math.round(selfTransferDebits * 100) / 100,
    topCategory,
    largestDebit,
    closingBalance: withBalance?.balance ?? null,
  };
}

export function calculatePersonLedger(transactions: Transaction[]): PersonLedgerEntry[] {
  const map = new Map<string, PersonLedgerEntry>();

  for (const t of transactions) {
    const key = t.counterparty.toUpperCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        counterparty: t.counterparty,
        upiId: t.upiId,
        bankCode: t.bankCode,
        isPerson: t.isPerson,
        isSelfTransfer: Boolean(t.isSelfTransfer),
        totalReceived: 0,
        totalSent: 0,
        netBalance: 0,
        transactionCount: 0,
        lastTransactionDate: t.date,
        transactions: [],
      };
      map.set(key, entry);
    }

    if (t.type === 'CREDIT') {
      entry.totalReceived = Math.round((entry.totalReceived + t.amount) * 100) / 100;
    } else {
      entry.totalSent = Math.round((entry.totalSent + t.amount) * 100) / 100;
    }
    entry.netBalance = Math.round((entry.totalReceived - entry.totalSent) * 100) / 100;
    entry.transactionCount += 1;
    if (t.date > entry.lastTransactionDate) {
      entry.lastTransactionDate = t.date;
    }
    if (!entry.upiId && t.upiId) entry.upiId = t.upiId;
    if (!entry.bankCode && t.bankCode) entry.bankCode = t.bankCode;
    if (t.isPerson) entry.isPerson = true;
    if (t.isSelfTransfer) entry.isSelfTransfer = true;
    entry.transactions.push(t);
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.totalReceived + b.totalSent) - (a.totalReceived + a.totalSent)
  );
}

export function calculateBudgetStatuses(
  transactions: Transaction[],
  budgets: BudgetLimit[],
  excludeSelfTransfers = false
): BudgetStatus[] {
  const spentByCategory = new Map<CategoryName, { spent: number; count: number }>();

  for (const t of transactions) {
    if (excludeSelfTransfers && t.isSelfTransfer) continue;
    if (t.type === 'DEBIT') {
      const current = spentByCategory.get(t.category) || { spent: 0, count: 0 };
      current.spent = Math.round((current.spent + t.amount) * 100) / 100;
      current.count += 1;
      spentByCategory.set(t.category, current);
    }
  }

  return budgets.map((b) => {
    const stats = spentByCategory.get(b.category) || { spent: 0, count: 0 };
    const remaining = Math.round((b.monthlyLimit - stats.spent) * 100) / 100;
    const percentUsed = b.monthlyLimit > 0 ? Math.round((stats.spent / b.monthlyLimit) * 100) : 0;

    let status: BudgetStatus['status'] = 'Nominal';
    if (stats.spent > b.monthlyLimit) {
      status = 'Over Budget';
    } else if (percentUsed >= b.alertThresholdPercent) {
      status = 'Approaching Limit';
    }

    return {
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent: stats.spent,
      remaining,
      percentUsed,
      transactionCount: stats.count,
      status,
    };
  });
}

export function detectRecurringSubscriptions(transactions: Transaction[]): DetectedSubscription[] {
  const debits = transactions.filter((t) => t.type === 'DEBIT');
  const byCounterparty = new Map<string, Transaction[]>();

  for (const t of debits) {
    const key = t.counterparty.toUpperCase();
    const list = byCounterparty.get(key) || [];
    list.push(t);
    byCounterparty.set(key, list);
  }

  const detected: DetectedSubscription[] = [];

  for (const [, txns] of byCounterparty.entries()) {
    const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    const subTxn = sorted.find((t) => t.isRecurring || t.category === 'Subscriptions') || sorted[0];

    const hasIdenticalRepeat =
      sorted.length >= 2 &&
      sorted.some((t, idx) => idx > 0 && Math.abs(t.amount - subTxn.amount) < 1);

    const isSubscriptionCategory = subTxn.category === 'Subscriptions';
    const isFlaggedRecurring = Boolean(subTxn.isRecurring) || subTxn.channel === 'ACH';

    if (isSubscriptionCategory || isFlaggedRecurring || (hasIdenticalRepeat && !subTxn.isPerson)) {
      const [y, m, d] = subTxn.date.split('-').map(Number);
      const nextDateObj = new Date(Date.UTC(y, m, d));
      const nextExpectedDate = nextDateObj.toISOString().slice(0, 10);

      detected.push({
        id: `sub-${subTxn.id}`,
        merchant: subTxn.counterparty,
        category: subTxn.category,
        amount: subTxn.amount,
        cadence: 'Monthly',
        lastChargedDate: subTxn.date,
        nextExpectedDate,
        channel: subTxn.channel,
        upiId: subTxn.upiId,
        occurrences: sorted.length,
        annualCost: Math.round(subTxn.amount * 12 * 100) / 100,
        status: subTxn.amount > 2000 && isSubscriptionCategory ? 'Review' : 'Active',
      });
    }
  }

  return detected.sort((a, b) => b.amount - a.amount);
}

/**
 * E-Commerce & IRCTC Failed / Return Refund Reconciler
 */
export function reconcileMerchantRefunds(transactions: Transaction[]): RefundMatchItem[] {
  const results: RefundMatchItem[] = [];
  const usedDebitIds = new Set<string>();

  // Find all merchant credits (e.g. Amazon, Flipkart, Swiggy, Zomato, IRCTC, Google Play, One97) or explicit REFUND narrations
  const merchantCredits = transactions.filter(
    (t) =>
      t.type === 'CREDIT' &&
      (!t.isPerson ||
        /REFUND|REV|RET|CANCEL/i.test(t.rawNarration) ||
        ['Amazon India', 'Flipkart', 'Swiggy', 'Zomato', 'IRCTC Railways', 'Google Play / Services', 'One97 (Paytm)'].includes(
          t.counterparty
        ))
  );

  const merchantDebits = transactions.filter((t) => t.type === 'DEBIT');

  for (const cr of merchantCredits) {
    // Look for an exact amount match from the same counterparty within 10 days before or on the same day
    const crTime = new Date(cr.date).getTime();
    let exactMatch = merchantDebits.find(
      (dr) =>
        !usedDebitIds.has(dr.id) &&
        dr.counterparty.toUpperCase() === cr.counterparty.toUpperCase() &&
        Math.abs(dr.amount - cr.amount) < 0.5 &&
        crTime >= new Date(dr.date).getTime() - 86400000
    );

    if (exactMatch) {
      usedDebitIds.add(exactMatch.id);
      const days = Math.max(0, Math.round((crTime - new Date(exactMatch.date).getTime()) / 86400000));
      results.push({
        id: `ref-${cr.id}`,
        merchant: cr.counterparty,
        creditTxn: cr,
        debitTxn: exactMatch,
        refundAmount: cr.amount,
        originalDebitAmount: exactMatch.amount,
        daysTaken: days,
        status: 'MATCHED_FULL',
      });
      continue;
    }

    // Look for a partial/order refund against a recent larger debit from the same merchant
    const partialMatch = merchantDebits.find(
      (dr) =>
        !usedDebitIds.has(dr.id) &&
        dr.counterparty.toUpperCase() === cr.counterparty.toUpperCase() &&
        dr.amount >= cr.amount &&
        Math.abs(crTime - new Date(dr.date).getTime()) <= 10 * 86400000
    );

    if (partialMatch) {
      usedDebitIds.add(partialMatch.id);
      const days = Math.max(0, Math.round(Math.abs(crTime - new Date(partialMatch.date).getTime()) / 86400000));
      results.push({
        id: `ref-${cr.id}`,
        merchant: cr.counterparty,
        creditTxn: cr,
        debitTxn: partialMatch,
        refundAmount: cr.amount,
        originalDebitAmount: partialMatch.amount,
        daysTaken: days,
        status: 'MATCHED_PARTIAL',
      });
    } else {
      results.push({
        id: `ref-${cr.id}`,
        merchant: cr.counterparty,
        creditTxn: cr,
        refundAmount: cr.amount,
        status: 'REFUND_CREDITED',
      });
    }
  }

  // Also include any debit marked as refundExpected that hasn't been matched
  for (const dr of merchantDebits) {
    if (dr.refundExpected && !usedDebitIds.has(dr.id)) {
      results.push({
        id: `pending-${dr.id}`,
        merchant: dr.counterparty,
        debitTxn: dr,
        refundAmount: 0,
        originalDebitAmount: dr.amount,
        status: 'PENDING_REFUND',
      });
    }
  }

  return results;
}

/**
 * Bank Charges & Silent Penalty Detector
 * Scans transaction narrations for common Bank of India charges:
 * 'AMC', 'SMS Alert', 'Penalty', and 'MAB' (Minimum Average Balance) non-maintenance fees.
 */
export function detectBankCharges(transactions: Transaction[]): BankChargeEntry[] {
  const charges: BankChargeEntry[] = [];

  for (const t of transactions) {
    if (t.type !== 'DEBIT') continue;
    const upper = t.rawNarration.toUpperCase();

    if (/\bAMC\b/.test(upper) || upper.includes('ANNUAL MAINT') || upper.includes('CARD FEE')) {
      const kw = upper.includes('ANNUAL MAINT') ? 'ANNUAL MAINT' : upper.includes('CARD FEE') ? 'CARD FEE' : 'AMC';
      charges.push({
        txn: t,
        feeCode: 'AMC',
        chargeType: 'Debit Card AMC',
        matchedKeyword: kw,
      });
    } else if (upper.includes('SMS ALERT') || upper.includes('SMS CHG') || upper.includes('SMS FEE')) {
      const kw = upper.includes('SMS ALERT') ? 'SMS Alert' : 'SMS Chg';
      charges.push({
        txn: t,
        feeCode: 'SMS_ALERT',
        chargeType: 'SMS Alert Fee',
        matchedKeyword: kw,
      });
    } else if (
      upper.includes('PENALTY') ||
      upper.includes('PENAL') ||
      upper.includes('RETURN CHG') ||
      upper.includes('NACH RETURN') ||
      upper.includes('ECS RETURN') ||
      upper.includes('BOUNCE')
    ) {
      const kw = upper.includes('PENALTY')
        ? 'Penalty'
        : upper.includes('BOUNCE')
        ? 'Bounce'
        : upper.includes('RETURN')
        ? 'Return Chg'
        : 'Penal Chg';
      charges.push({
        txn: t,
        feeCode: 'PENALTY',
        chargeType: 'Mandate / ECS Penalty',
        matchedKeyword: kw,
      });
    } else if (
      /\bMAB\b/.test(upper) ||
      /\bQAB\b/.test(upper) ||
      upper.includes('MIN BAL') ||
      upper.includes('NON MAINT') ||
      upper.includes('SHORTFALL')
    ) {
      const kw = /\bMAB\b/.test(upper)
        ? 'MAB'
        : /\bQAB\b/.test(upper)
        ? 'QAB'
        : upper.includes('MIN BAL')
        ? 'Min Bal'
        : 'Non-Maint';
      charges.push({
        txn: t,
        feeCode: 'MAB',
        chargeType: 'MAB / Non-Maintenance Fine',
        matchedKeyword: kw,
      });
    } else if (
      t.category === 'Bank Charges & Fees' ||
      upper.includes('ATM CHG') ||
      upper.includes('INTERCHANGE') ||
      upper.includes('SERVICE CHG')
    ) {
      charges.push({
        txn: t,
        feeCode: 'OTHER',
        chargeType: 'ATM / Service Charge',
        matchedKeyword: upper.includes('ATM') ? 'ATM Chg' : 'Bank Fee',
      });
    }
  }

  return charges;
}

/**
 * Comprehensive Bank Fees Analyzer
 * Tallies scanned BOI charges ('AMC', 'SMS Alert', 'Penalty', 'MAB') into a structured summary card payload.
 */
export function analyzeBankFees(transactions: Transaction[]): BankFeesSummary {
  const entries = detectBankCharges(transactions);
  const totalFees = Math.round(entries.reduce((sum, e) => sum + e.txn.amount, 0) * 100) / 100;
  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT' && !t.isSelfTransfer)
    .reduce((sum, t) => sum + t.amount, 0);

  const feeShareOfDebitsPercent =
    totalDebits > 0 ? Math.round((totalFees / totalDebits) * 1000) / 10 : 0;

  const bucketMeta: Array<{
    feeCode: BankFeeCode;
    label: string;
    shortKeywords: string;
    mitigationTip: string;
  }> = [
    {
      feeCode: 'MAB',
      label: 'MAB Non-Maintenance',
      shortKeywords: 'MAB · QAB · Min Bal',
      mitigationTip: 'Maintain ≥ ₹2,500 monthly average balance in BOI Urban/Metro savings accounts.',
    },
    {
      feeCode: 'AMC',
      label: 'AMC (Debit Card / Account)',
      shortKeywords: 'AMC · Annual Maint · Card Fee',
      mitigationTip: 'Switch to BOI RuPay Classic or virtual debit card to reduce annual card AMC.',
    },
    {
      feeCode: 'SMS_ALERT',
      label: 'SMS Alert Charges',
      shortKeywords: 'SMS Alert · SMS Chg',
      mitigationTip: 'Charged quarterly (~₹17.70 incl. GST); opt for email/push alerts in BOI Mobile to waive.',
    },
    {
      feeCode: 'PENALTY',
      label: 'Penalty & Bounce Fees',
      shortKeywords: 'Penalty · Bounce · Return Chg',
      mitigationTip: 'Fund your BOI account 24h before NACH/SIP auto-debit dates (1st–10th of month).',
    },
  ];

  const breakdownByType: BankFeeCategoryBreakdown[] = bucketMeta.map((b) => {
    const matching = entries.filter((e) => e.feeCode === b.feeCode);
    const amount = Math.round(matching.reduce((s, e) => s + e.txn.amount, 0) * 100) / 100;
    return {
      ...b,
      amount,
      count: matching.length,
    };
  });

  return {
    totalFees,
    feeCount: entries.length,
    feeShareOfDebitsPercent,
    breakdownByType,
    entries,
  };
}

/**
 * Month-End Safe-to-Spend Burn Rate & Mandate Low-Balance Risk Calculator
 */
export function calculateCashflowSafetyMetrics(
  transactions: Transaction[],
  subscriptions: DetectedSubscription[]
): CashflowSafetyMetrics {
  const withBal = transactions.filter((t) => typeof t.balance === 'number' && t.balance > 0);
  const closingBalance = withBal.length > 0 ? (withBal[0].balance as number) : 3812.39;
  const averageBalance =
    withBal.length > 0
      ? Math.round((withBal.reduce((sum, t) => sum + (t.balance || 0), 0) / withBal.length) * 100) / 100
      : closingBalance;

  const boiMabThreshold = 2500; // BOI Urban/Metro Savings MAB
  const mabShortfall = Math.max(0, Math.round((boiMabThreshold - averageBalance) * 100) / 100);

  // Calculate discretionary daily burn (excluding self-transfers & >25k one-off capital transfers)
  const sortedDates = [...new Set(transactions.map((t) => t.date))].sort();
  const spanDays =
    sortedDates.length >= 2
      ? Math.max(
          1,
          Math.round(
            (new Date(sortedDates[sortedDates.length - 1]).getTime() -
              new Date(sortedDates[0]).getTime()) /
              86400000
          ) + 1
        )
      : 30;

  const discretionaryDebits = transactions
    .filter((t) => t.type === 'DEBIT' && !t.isSelfTransfer && t.amount < 25000 && t.category !== 'Rent & Housing' && t.category !== 'Investments')
    .reduce((sum, t) => sum + t.amount, 0);

  const dailyDiscretionaryBurn = Math.max(50, Math.round((discretionaryDebits / spanDays) * 100) / 100);
  const daysUntilZero = Math.max(0, Math.floor(closingBalance / dailyDiscretionaryBurn));

  const activeSubs = subscriptions.filter((s) => s.status !== 'Paused');
  const upcomingMandatesTotal = activeSubs.reduce((sum, s) => sum + s.amount, 0);
  const mandateShortfall = Math.max(0, Math.round((upcomingMandatesTotal - closingBalance) * 100) / 100);

  const availableAfterMandates = Math.max(0, closingBalance - upcomingMandatesTotal);
  const safeToSpendDaily = Math.round((availableAfterMandates / 15) * 100) / 100;

  let riskLevel: CashflowSafetyMetrics['riskLevel'] = 'SAFE';
  if (mandateShortfall > 0 || daysUntilZero <= 5 || closingBalance < boiMabThreshold) {
    riskLevel = mandateShortfall > 1000 || daysUntilZero <= 3 ? 'CRITICAL' : 'WARNING';
  }

  return {
    closingBalance,
    averageBalance,
    boiMabThreshold,
    mabShortfall,
    dailyDiscretionaryBurn,
    daysUntilZero,
    safeToSpendDaily,
    upcomingMandatesTotal,
    mandateShortfall,
    riskLevel,
  };
}

/**
 * Micro-UPI Spend Leak Detector & Day-of-Week / Daily Balance Timeline
 */
export function calculateMicroUpiAndHeatmap(
  transactions: Transaction[],
  microThreshold = 100
): MicroUpiAndHeatmapStats {
  const microDebits = transactions.filter(
    (t) => t.type === 'DEBIT' && t.channel === 'UPI' && t.amount <= microThreshold
  );
  const microTotalAmount = Math.round(microDebits.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const microAverage = microDebits.length > 0 ? Math.round((microTotalAmount / microDebits.length) * 100) / 100 : 0;

  const cpCounts = new Map<string, number>();
  for (const t of microDebits) {
    cpCounts.set(t.counterparty, (cpCounts.get(t.counterparty) || 0) + 1);
  }
  let topMicroCounterparty: string | null = null;
  let topMicroCount = 0;
  for (const [name, cnt] of cpCounts.entries()) {
    if (cnt > topMicroCount) {
      topMicroCount = cnt;
      topMicroCounterparty = `${name} (${cnt}x)`;
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets = dayNames.map((day, idx) => ({
    day,
    amount: 0,
    count: 0,
    isWeekend: idx === 0 || idx === 6,
  }));

  let weekendSpend = 0;
  let totalNonSelfSpend = 0;

  for (const t of transactions) {
    if (t.type === 'DEBIT' && !t.isSelfTransfer) {
      const dIdx = new Date(t.date + 'T00:00:00Z').getUTCDay();
      if (dayBuckets[dIdx]) {
        dayBuckets[dIdx].amount = Math.round((dayBuckets[dIdx].amount + t.amount) * 100) / 100;
        dayBuckets[dIdx].count += 1;
        totalNonSelfSpend += t.amount;
        if (dIdx === 0 || dIdx === 6) weekendSpend += t.amount;
      }
    }
  }

  const weekendSharePercent =
    totalNonSelfSpend > 0 ? Math.round((weekendSpend / totalNonSelfSpend) * 100) : 0;

  // Build chronological daily balance & flow timeline
  const byDate = new Map<string, { credits: number; debits: number; closingBalance: number }>();
  // Iterate oldest to newest so closingBalance reflects latest transaction of that day
  const chronological = [...transactions].reverse();
  let runningBal = chronological[0]?.balance || 500;

  for (const t of chronological) {
    const entry = byDate.get(t.date) || { credits: 0, debits: 0, closingBalance: runningBal };
    if (t.type === 'CREDIT') entry.credits = Math.round((entry.credits + t.amount) * 100) / 100;
    else entry.debits = Math.round((entry.debits + t.amount) * 100) / 100;
    if (typeof t.balance === 'number') {
      runningBal = t.balance;
    }
    entry.closingBalance = runningBal;
    byDate.set(t.date, entry);
  }

  const dailyTimeline = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({ date, ...stats }));

  return {
    microThreshold,
    microCount: microDebits.length,
    microTotalAmount,
    microAverage,
    topMicroCounterparty,
    dayOfWeekTotals: dayBuckets,
    weekendSharePercent,
    dailyTimeline,
  };
}

/**
 * Section 80TTA Savings Interest, Business vs Personal & Event Tag Aggregator
 */
export function calculateTaxAndCaSummary(transactions: Transaction[]): TaxAndCaSummary {
  const interestTransactions = transactions.filter(
    (t) =>
      t.category === 'Savings Interest' ||
      (t.type === 'CREDIT' && /INT\.PD|SB INT|SAVINGS INT|INTEREST/i.test(t.rawNarration))
  );
  const savingsInterestTotal =
    Math.round(interestTransactions.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const section80TTALimit = 10000;
  const section80TTATaxableExcess = Math.max(0, savingsInterestTotal - section80TTALimit);

  const businessTransactions = transactions.filter((t) => Boolean(t.isBusiness));
  const businessIncome = Math.round(
    businessTransactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0) * 100
  ) / 100;
  const businessExpense = Math.round(
    businessTransactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0) * 100
  ) / 100;

  const tagMap = new Map<string, { spent: number; received: number; count: number }>();
  for (const t of transactions) {
    if (t.eventTag) {
      const prev = tagMap.get(t.eventTag) || { spent: 0, received: 0, count: 0 };
      if (t.type === 'DEBIT') prev.spent = Math.round((prev.spent + t.amount) * 100) / 100;
      else prev.received = Math.round((prev.received + t.amount) * 100) / 100;
      prev.count += 1;
      tagMap.set(t.eventTag, prev);
    }
  }

  const eventTagTotals = Array.from(tagMap.entries())
    .map(([tag, data]) => ({ tag, ...data }))
    .sort((a, b) => b.spent + b.received - (a.spent + a.received));

  return {
    savingsInterestTotal,
    section80TTALimit,
    section80TTATaxableExcess,
    interestTransactions,
    businessIncome,
    businessExpense,
    netBusinessSurplus: Math.round((businessIncome - businessExpense) * 100) / 100,
    businessTransactions,
    eventTagTotals,
  };
}

/**
 * Generates a CA-Friendly Double-Entry Tally / Excel CSV string
 */
export function generateTallyDoubleEntryCsv(transactions: Transaction[]): string {
  const headers = [
    'Date',
    'Voucher Type',
    'Ledger / Particulars',
    'Channel',
    '12-Digit RRN / Ref',
    'UPI Handle',
    'Account Head (Category)',
    'Tax Classification',
    'Event / Project Tag',
    'Debit (Dr INR)',
    'Credit (Cr INR)',
    'Closing Balance (INR)',
    'Original BOI Narration',
  ];

  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const voucherType = t.isSelfTransfer
        ? 'Contra'
        : t.type === 'CREDIT'
        ? 'Receipt'
        : 'Payment';
      const taxClass = t.isBusiness
        ? 'Business / GST Claimable'
        : t.isSelfTransfer
        ? 'Self / Contra Transfer'
        : 'Personal';
      return [
        t.date,
        voucherType,
        `"${t.counterparty.replace(/"/g, '""')}"`,
        t.channel,
        t.referenceNo || '',
        t.upiId || '',
        `"${t.category}"`,
        taxClass,
        t.eventTag || '',
        t.type === 'DEBIT' ? t.amount.toFixed(2) : '0.00',
        t.type === 'CREDIT' ? t.amount.toFixed(2) : '0.00',
        t.balance !== undefined ? t.balance.toFixed(2) : '',
        `"${t.rawNarration.replace(/"/g, '""')}"`,
      ].join(',');
    });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Builds a pre-filled UPI Deep Link (upi://pay?...) and polite WhatsApp Settle-Up message
 */
export function buildWhatsAppUpiSettleLink(params: {
  contactName: string;
  owedAmount: number;
  receiverVpa: string;
  receiverName: string;
  recentTxns: Transaction[];
}): { upiDeepLink: string; whatsappText: string } {
  const cleanAmount = Math.abs(Math.round(params.owedAmount * 100) / 100);
  const vpa = params.receiverVpa.trim() || 'pradiploh@bkid';
  const name = params.receiverName.trim() || 'Tanmay Lohakar';
  const note = `Settle up with ${name}`;

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    name
  )}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const historyLines = params.recentTxns
    .slice(0, 4)
    .map(
      (t) =>
        `• ${t.date}: ${t.type === 'DEBIT' ? 'Sent' : 'Received'} ${formatINR(t.amount)}${
          t.referenceNo ? ` (RRN ${t.referenceNo})` : ''
        }`
    )
    .join('\n');

  const whatsappText = `Hi ${params.contactName}, sharing our UPI ledger summary from my Bank of India statement:\n\n${historyLines}\n\nNet Balance to Settle: ${formatINR(
    cleanAmount
  )}\n\nTap to pay directly via GPay / PhonePe / Paytm:\n${upiDeepLink}`;

  return { upiDeepLink, whatsappText };
}

export function formatINR(amount: number, showDecimals?: boolean): string {
  const abs = Math.abs(amount);
  const hasCents = Math.abs(abs - Math.round(abs)) > 0.001;
  const useDecimals = showDecimals ?? hasCents;
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  });
  return `${amount < 0 ? '-' : ''}₹${formatted}`;
}
