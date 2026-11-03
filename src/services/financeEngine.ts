import {
  AccountRecord,
  BudgetAllocation,
  ClassificationRule,
  DashboardMetrics,
  ExplicitLoanSettlementRecord,
  PeriodComparison,
  PersonIdentity,
  PersonProfileSummary,
  RecurringCommitment,
  ReportingPeriod,
  TransactionRecord,
} from '../types/finance';

export function toPaise(amountInr: number): number {
  if (!Number.isFinite(amountInr)) return 0;
  return Math.round(amountInr * 100);
}

export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

export function formatINRPaise(paise: number): string {
  const isNeg = paise < 0;
  const absRupees = Math.abs(Math.round(paise)) / 100;
  const formatted = absRupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? '-' : ''}₹${formatted}`;
}

export function resolveStartupReportingPeriod(
  transactions: TransactionRecord[],
  referenceDate: Date = new Date()
): ReportingPeriod {
  const currentYm = referenceDate.toISOString().slice(0, 7);
  const formatYmLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  if (transactions.length === 0) {
    return {
      mode: 'MONTH',
      month: currentYm,
      label: formatYmLabel(currentYm),
    };
  }

  const hasCurrentMonth = transactions.some((t) => t.date.startsWith(currentYm));
  if (hasCurrentMonth) {
    return {
      mode: 'MONTH',
      month: currentYm,
      label: formatYmLabel(currentYm),
    };
  }

  const sortedDates = [...transactions]
    .map((t) => t.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const latestYm = sortedDates[0] ? sortedDates[0].slice(0, 7) : currentYm;
  return {
    mode: 'MONTH',
    month: latestYm,
    label: formatYmLabel(latestYm),
  };
}

export function filterTransactionsByPeriod(
  transactions: TransactionRecord[],
  period: ReportingPeriod
): TransactionRecord[] {
  if (period.mode === 'ALL_HISTORY') {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  }
  if (period.mode === 'MONTH' && period.month) {
    return transactions
      .filter((t) => t.date.startsWith(period.month!))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  if (period.mode === 'YEAR' && period.year) {
    return transactions
      .filter((t) => t.date.startsWith(period.year!))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  if (period.mode === 'CUSTOM_RANGE') {
    return transactions
      .filter((t) => {
        if (period.startDate && t.date < period.startDate) return false;
        if (period.endDate && t.date > period.endDate) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
}

export function calculateDashboardMetrics(
  periodTransactions: TransactionRecord[],
  allTransactions: TransactionRecord[],
  accounts: AccountRecord[],
  budgets: BudgetAllocation[],
  commitments: RecurringCommitment[],
  period: ReportingPeriod
): DashboardMetrics {
  let totalCreditPaise = 0;
  let totalDebitPaise = 0;
  let creditCount = 0;
  let debitCount = 0;
  let identifiedIncomePaise = 0;
  let identifiedExpensesPaise = 0;
  let internalTransfersInPaise = 0;
  let internalTransfersOutPaise = 0;

  let largestExpense: DashboardMetrics['largestExpense'] = null;
  const categoryMap = new Map<string, number>();

  for (const tx of periodTransactions) {
    if (tx.direction === 'CREDIT') {
      totalCreditPaise += tx.amountPaise;
      creditCount += 1;
      if (tx.transactionType === 'INTERNAL_TRANSFER' || tx.category === 'Self Transfer') {
        internalTransfersInPaise += tx.amountPaise;
      } else if (tx.transactionType === 'INCOME') {
        identifiedIncomePaise += tx.amountPaise;
      }
    } else {
      totalDebitPaise += tx.amountPaise;
      debitCount += 1;
      if (tx.transactionType === 'INTERNAL_TRANSFER' || tx.category === 'Self Transfer') {
        internalTransfersOutPaise += tx.amountPaise;
      } else if (tx.transactionType === 'EXPENSE') {
        identifiedExpensesPaise += tx.amountPaise;
        categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + tx.amountPaise);
        if (!largestExpense || tx.amountPaise > largestExpense.amountPaise) {
          largestExpense = {
            amountPaise: tx.amountPaise,
            counterpartyName: tx.counterpartyName,
            date: tx.date,
            category: tx.category,
          };
        }
      }
    }
  }

  const netCashFlowPaise = totalCreditPaise - totalDebitPaise;

  // Estimated Savings Rate (Section 9.3: only available when Identified Income > 0)
  let estimatedSavingsRatePercent: number | null = null;
  let savingsRateStatus: DashboardMetrics['savingsRateStatus'] = 'NO_IDENTIFIED_INCOME';
  if (identifiedIncomePaise > 0) {
    savingsRateStatus = 'AVAILABLE';
    estimatedSavingsRatePercent =
      ((identifiedIncomePaise - identifiedExpensesPaise) / identifiedIncomePaise) * 100;
  }

  // Highest spending category
  let highestSpendingCategory: DashboardMetrics['highestSpendingCategory'] = null;
  for (const [category, amountPaise] of categoryMap.entries()) {
    if (!highestSpendingCategory || amountPaise > highestSpendingCategory.amountPaise) {
      highestSpendingCategory = {
        category,
        amountPaise,
        sharePercent:
          identifiedExpensesPaise > 0 ? (amountPaise / identifiedExpensesPaise) * 100 : 0,
      };
    }
  }

  // Current Balance Calculation
  let currentBalancePaise = 0;
  let balanceSourceNote = 'Opening balance (₹0.00)';
  const sortedAll = [...allTransactions].sort((a, b) => b.date.localeCompare(a.date));
  const latestWithRunningBal = sortedAll.find((t) => t.runningBalancePaise !== null);

  if (latestWithRunningBal && latestWithRunningBal.runningBalancePaise !== null) {
    currentBalancePaise = latestWithRunningBal.runningBalancePaise;
    balanceSourceNote = `Latest statement balance (${latestWithRunningBal.date})`;
  } else {
    const openingTotal = accounts.reduce((acc, a) => acc + a.openingBalancePaise, 0);
    const allNet = allTransactions.reduce(
      (acc, t) => acc + (t.direction === 'CREDIT' ? t.amountPaise : -t.amountPaise),
      0
    );
    currentBalancePaise = openingTotal + allNet;
    if (allTransactions.length > 0) {
      balanceSourceNote = 'Calculated from opening balance + net ledger cash flow';
    }
  }

  // Budget usage
  const totalBudgetedPaise = budgets.reduce((acc, b) => acc + b.limitPaise, 0);
  let totalSpentAgainstBudgetPaise = 0;
  for (const b of budgets) {
    totalSpentAgainstBudgetPaise += categoryMap.get(b.categoryName) || 0;
  }
  const usagePercent =
    totalBudgetedPaise > 0 ? (totalSpentAgainstBudgetPaise / totalBudgetedPaise) * 100 : null;

  // Upcoming commitments
  const activeCommitments = commitments.filter((c) => c.isActive);
  const upcomingTotalPaise = activeCommitments.reduce((acc, c) => acc + c.amountPaise, 0);

  return {
    totalCreditPaise,
    totalDebitPaise,
    netCashFlowPaise,
    transactionCount: periodTransactions.length,
    creditCount,
    debitCount,
    identifiedIncomePaise,
    identifiedExpensesPaise,
    internalTransfersInPaise,
    internalTransfersOutPaise,
    estimatedSavingsRatePercent,
    savingsRateStatus,
    currentBalancePaise,
    balanceSourceNote,
    largestExpense,
    highestSpendingCategory,
    budgetUsage: {
      totalBudgetedPaise,
      totalSpentAgainstBudgetPaise,
      usagePercent,
    },
    upcomingCommitments30d: {
      totalPaise: upcomingTotalPaise,
      count: activeCommitments.length,
    },
  };
}

export function calculatePeriodComparison(
  allTransactions: TransactionRecord[],
  period: ReportingPeriod
): PeriodComparison {
  if (period.mode !== 'MONTH' || !period.month) {
    return {
      hasPreviousData: false,
      currentPeriodLabel: period.label,
      previousPeriodLabel: 'Prior Period',
      creditDeltaPaise: 0,
      creditDeltaPercent: null,
      debitDeltaPaise: 0,
      debitDeltaPercent: null,
      netDeltaPaise: 0,
    };
  }

  const [yStr, mStr] = period.month.split('-');
  const prevDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 2, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currTxs = allTransactions.filter((t) => t.date.startsWith(period.month!));
  const prevTxs = allTransactions.filter((t) => t.date.startsWith(prevYm));

  if (prevTxs.length === 0) {
    return {
      hasPreviousData: false,
      currentPeriodLabel: period.month,
      previousPeriodLabel: prevYm,
      creditDeltaPaise: 0,
      creditDeltaPercent: null,
      debitDeltaPaise: 0,
      debitDeltaPercent: null,
      netDeltaPaise: 0,
    };
  }

  const sumDir = (list: TransactionRecord[], dir: 'CREDIT' | 'DEBIT') =>
    list.filter((t) => t.direction === dir).reduce((a, b) => a + b.amountPaise, 0);

  const currCr = sumDir(currTxs, 'CREDIT');
  const prevCr = sumDir(prevTxs, 'CREDIT');
  const currDr = sumDir(currTxs, 'DEBIT');
  const prevDr = sumDir(prevTxs, 'DEBIT');

  return {
    hasPreviousData: true,
    currentPeriodLabel: period.month,
    previousPeriodLabel: prevYm,
    creditDeltaPaise: currCr - prevCr,
    creditDeltaPercent: prevCr > 0 ? ((currCr - prevCr) / prevCr) * 100 : null,
    debitDeltaPaise: currDr - prevDr,
    debitDeltaPercent: prevDr > 0 ? ((currDr - prevDr) / prevDr) * 100 : null,
    netDeltaPaise: currCr - currDr - (prevCr - prevDr),
  };
}

export function calculatePeopleProfiles(
  transactions: TransactionRecord[],
  knownIdentities: PersonIdentity[],
  explicitLoans: ExplicitLoanSettlementRecord[]
): PersonProfileSummary[] {
  const byCanonical = new Map<
    string,
    {
      identity: PersonIdentity;
      sentPaise: number;
      receivedPaise: number;
      count: number;
      firstDate: string;
      lastDate: string;
      catCounts: Map<string, number>;
    }
  >();

  const aliasLookup = new Map<string, PersonIdentity>();
  for (const id of knownIdentities) {
    aliasLookup.set(id.canonicalName.toLowerCase(), id);
    for (const al of id.aliases) {
      aliasLookup.set(al.toLowerCase(), id);
    }
  }

  for (const tx of transactions) {
    const rawName = (tx.counterpartyName || 'Unknown Counterparty').trim();
    const matchedIdentity = aliasLookup.get(rawName.toLowerCase()) || {
      id: `person-${rawName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      canonicalName: rawName,
      aliases: [rawName],
      upiIds: tx.upiId ? [tx.upiId] : [],
      role:
        tx.category === 'Personal Transfers'
          ? ('FRIEND' as const)
          : tx.category === 'Self Transfer'
          ? ('SELF' as const)
          : ('MERCHANT' as const),
      notes: '',
      createdAt: tx.createdAt,
    };

    const key = matchedIdentity.canonicalName.toLowerCase();
    const entry = byCanonical.get(key) || {
      identity: { ...matchedIdentity, upiIds: [...matchedIdentity.upiIds] },
      sentPaise: 0,
      receivedPaise: 0,
      count: 0,
      firstDate: tx.date,
      lastDate: tx.date,
      catCounts: new Map<string, number>(),
    };

    if (tx.upiId && !entry.identity.upiIds.includes(tx.upiId)) {
      entry.identity.upiIds.push(tx.upiId);
    }
    if (tx.direction === 'DEBIT') entry.sentPaise += tx.amountPaise;
    else entry.receivedPaise += tx.amountPaise;

    entry.count += 1;
    if (tx.date < entry.firstDate) entry.firstDate = tx.date;
    if (tx.date > entry.lastDate) entry.lastDate = tx.date;
    entry.catCounts.set(tx.category, (entry.catCounts.get(tx.category) || 0) + 1);
    byCanonical.set(key, entry);
  }

  // Also include explicit loans even if no bank transactions exist for that person
  const loanMap = new Map<string, { receivablePaise: number; payablePaise: number }>();
  for (const loan of explicitLoans) {
    if (loan.status === 'SETTLED') continue;
    const key = loan.personName.toLowerCase();
    const curr = loanMap.get(key) || { receivablePaise: 0, payablePaise: 0 };
    if (loan.type === 'LENT_RECEIVABLE' || loan.type === 'SPLIT_EXPENSE') {
      curr.receivablePaise += loan.remainingAmountPaise;
    } else {
      curr.payablePaise += loan.remainingAmountPaise;
    }
    loanMap.set(key, curr);
  }

  return Array.from(byCanonical.values())
    .map((e) => {
      let mostCommonCategory = 'Uncategorized';
      let topCount = 0;
      for (const [cat, c] of e.catCounts.entries()) {
        if (c > topCount) {
          topCount = c;
          mostCommonCategory = cat;
        }
      }
      const loans = loanMap.get(e.identity.canonicalName.toLowerCase()) || {
        receivablePaise: 0,
        payablePaise: 0,
      };
      return {
        identity: e.identity,
        totalSentToPersonPaise: e.sentPaise,
        totalReceivedFromPersonPaise: e.receivedPaise,
        netExchangedPaise: e.receivedPaise - e.sentPaise,
        transactionCount: e.count,
        firstTransactionDate: e.firstDate,
        lastTransactionDate: e.lastDate,
        mostCommonCategory,
        explicitReceivablePaise: loans.receivablePaise,
        explicitPayablePaise: loans.payablePaise,
      };
    })
    .sort(
      (a, b) =>
        b.totalSentToPersonPaise +
        b.totalReceivedFromPersonPaise -
        (a.totalSentToPersonPaise + a.totalReceivedFromPersonPaise)
    );
}

export function calculateAccountReconciliations(
  accounts: AccountRecord[],
  transactions: TransactionRecord[]
) {
  return accounts.map((acc) => {
    const accTxs = transactions.filter((t) => t.accountId === acc.id);
    const totalCreditsPaise = accTxs
      .filter((t) => t.direction === 'CREDIT')
      .reduce((s, t) => s + t.amountPaise, 0);
    const totalDebitsPaise = accTxs
      .filter((t) => t.direction === 'DEBIT')
      .reduce((s, t) => s + t.amountPaise, 0);

    const calculatedBalancePaise =
      acc.openingBalancePaise + totalCreditsPaise - totalDebitsPaise;
    const diffPaise =
      acc.lastStatementClosingBalancePaise !== null
        ? acc.lastStatementClosingBalancePaise - calculatedBalancePaise
        : 0;

    return {
      account: acc,
      transactionCount: accTxs.length,
      totalCreditsPaise,
      totalDebitsPaise,
      calculatedBalancePaise,
      reconciliationDiffPaise: diffPaise,
      isReconciled: Math.abs(diffPaise) <= 100,
    };
  });
}

export function replayHistoricalBalance(
  transactions: TransactionRecord[],
  accounts: AccountRecord[],
  asOfDate: string
): number {
  const onOrBefore = transactions
    .filter((t) => t.date <= asOfDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const withBal = onOrBefore.find((t) => t.runningBalancePaise !== null);
  if (withBal && withBal.runningBalancePaise !== null) {
    return withBal.runningBalancePaise;
  }
  const opening = accounts.reduce((s, a) => s + a.openingBalancePaise, 0);
  const net = onOrBefore.reduce(
    (s, t) => s + (t.direction === 'CREDIT' ? t.amountPaise : -t.amountPaise),
    0
  );
  return opening + net;
}

export interface DataQualityIssue {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  suggestedAction: string;
}

export function runDataQualityAndAnomalyChecks(
  transactions: TransactionRecord[],
  accounts: AccountRecord[]
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (transactions.length === 0) return issues;

  const uncategorized = transactions.filter((t) => t.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    issues.push({
      id: 'dq-uncat',
      severity: 'MEDIUM',
      title: `${uncategorized.length} Uncategorized Transactions`,
      description: `${uncategorized.length} entries are currently in "Uncategorized".`,
      suggestedAction: 'Create a Local Classification Rule in the Categories tab.',
    });
  }

  // Check duplicate date + amount + counterparty
  const seen = new Map<string, number>();
  for (const t of transactions) {
    const k = `${t.date}|${t.direction}|${t.amountPaise}|${t.counterpartyName}`;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const dupCount = Array.from(seen.values()).filter((c) => c > 1).length;
  if (dupCount > 0) {
    issues.push({
      id: 'dq-dup',
      severity: 'HIGH',
      title: `${dupCount} Potential Duplicate Transaction Groups`,
      description: 'Found transactions sharing identical date, direction, amount, and payee.',
      suggestedAction: 'Review and delete any unintended duplicates in Transactions Ledger.',
    });
  }

  // Check unusually large single debit (> 3x average debit)
  const debits = transactions.filter((t) => t.direction === 'DEBIT');
  if (debits.length >= 5) {
    const avgDebit = debits.reduce((s, t) => s + t.amountPaise, 0) / debits.length;
    const spikes = debits.filter((t) => t.amountPaise > avgDebit * 4);
    if (spikes.length > 0) {
      issues.push({
        id: 'dq-spike',
        severity: 'LOW',
        title: `${spikes.length} High-Value Outflow Outliers Detected`,
        description: `Largest outlier is ${formatINRPaise(spikes[0].amountPaise)} to ${
          spikes[0].counterpartyName
        }.`,
        suggestedAction: 'Verify whether any high-value debit was an internal transfer or investment.',
      });
    }
  }

  return issues;
}

export function calculateFutureBalanceForecast(
  currentBalancePaise: number,
  transactions: TransactionRecord[],
  commitments: RecurringCommitment[],
  horizonDays: number,
  scenario: 'EXPECTED' | 'OPTIMISTIC' | 'CAUTIOUS',
  whatIfAdjustments?: {
    monthlyExpenseCutPaise: number;
    extraMonthlyIncomePaise: number;
    oneTimePurchasePaise: number;
  }
): Array<{ dayOffset: number; projectedBalancePaise: number }> {
  const debits = transactions.filter(
    (t) => t.direction === 'DEBIT' && t.transactionType === 'EXPENSE'
  );
  const credits = transactions.filter(
    (t) => t.direction === 'CREDIT' && t.transactionType === 'INCOME'
  );

  const distinctDays = Math.max(
    30,
    new Set(transactions.map((t) => t.date)).size || 30
  );
  let avgDailyBurn =
    debits.reduce((s, t) => s + t.amountPaise, 0) / distinctDays;
  let avgDailyInflow =
    credits.reduce((s, t) => s + t.amountPaise, 0) / distinctDays;

  if (scenario === 'OPTIMISTIC') {
    avgDailyInflow *= 1.1;
    avgDailyBurn *= 0.85;
  } else if (scenario === 'CAUTIOUS') {
    avgDailyInflow *= 0.9;
    avgDailyBurn *= 1.2;
  }

  const dailySaveAdj = (whatIfAdjustments?.monthlyExpenseCutPaise || 0) / 30;
  const dailyIncomeAdj = (whatIfAdjustments?.extraMonthlyIncomePaise || 0) / 30;
  let running = currentBalancePaise - (whatIfAdjustments?.oneTimePurchasePaise || 0);

  const points: Array<{ dayOffset: number; projectedBalancePaise: number }> = [];
  for (let d = 1; d <= horizonDays; d++) {
    running += avgDailyInflow + dailyIncomeAdj - Math.max(0, avgDailyBurn - dailySaveAdj);
    points.push({
      dayOffset: d,
      projectedBalancePaise: Math.round(running),
    });
  }
  return points;
}

export function calculateFinancialHealthScore(
  metrics: DashboardMetrics,
  transactions: TransactionRecord[]
): { score: number; breakdown: string[] } {
  if (transactions.length === 0) {
    return { score: 0, breakdown: ['Import a statement to compute your Financial Health Score.'] };
  }
  let score = 60;
  const breakdown: string[] = [];
  if (metrics.netCashFlowPaise >= 0) {
    score += 20;
    breakdown.push('+20 pts: Positive net cash flow in period');
  } else {
    score -= 10;
    breakdown.push('-10 pts: Negative net cash flow in period');
  }
  const uncatRatio =
    transactions.filter((t) => t.category === 'Uncategorized').length / transactions.length;
  if (uncatRatio < 0.1) {
    score += 20;
    breakdown.push('+20 pts: Over 90% of transactions cleanly categorized');
  }
  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

export function previewClassificationRule(
  rule: ClassificationRule,
  transactions: TransactionRecord[]
): TransactionRecord[] {
  if (!rule.conditions || rule.conditions.length === 0) return [];
  return transactions.filter((tx) =>
    rule.conditions.every((cond) => {
      const val = cond.value.toLowerCase();
      const target =
        cond.field === 'COUNTERPARTY'
          ? tx.counterpartyName.toLowerCase()
          : cond.field === 'UPI_ID'
          ? tx.upiId.toLowerCase()
          : tx.rawDescription.toLowerCase();
      if (cond.operator === 'EQUALS') return target === val;
      if (cond.operator === 'STARTS_WITH') return target.startsWith(val);
      return target.includes(val);
    })
  );
}

export function queryLocalFinancialAssistant(
  query: string,
  transactions: TransactionRecord[],
  people: PersonIdentity[]
): {
  answerText: string;
  matchedTransactions: TransactionRecord[];
  computedSumPaise: number;
} {
  const q = query.trim().toLowerCase();
  if (transactions.length === 0) {
    return {
      answerText:
        'Your local database currently has 0 transactions (₹0.00). Import a bank statement first to query your finances.',
      matchedTransactions: [],
      computedSumPaise: 0,
    };
  }

  if (q.includes('where did my money go') || q.includes('top category')) {
    const catMap = new Map<string, number>();
    const debits = transactions.filter(
      (t) => t.direction === 'DEBIT' && t.transactionType === 'EXPENSE'
    );
    for (const t of debits) {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amountPaise);
    }
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    const topStr = sorted
      .slice(0, 3)
      .map(([c, amt]) => `${c} (${formatINRPaise(amt)})`)
      .join(', ');
    const totalSpend = debits.reduce((s, t) => s + t.amountPaise, 0);
    return {
      answerText: `Your top expense categories are: ${
        topStr || 'None'
      }. Total identified expenses: ${formatINRPaise(totalSpend)}.`,
      matchedTransactions: debits.slice(0, 10),
      computedSumPaise: totalSpend,
    };
  }

  if (q.includes('largest expense') || q.includes('biggest expense')) {
    const debits = transactions
      .filter((t) => t.direction === 'DEBIT')
      .sort((a, b) => b.amountPaise - a.amountPaise);
    const top = debits[0];
    if (!top) {
      return {
        answerText: 'No debit transactions found.',
        matchedTransactions: [],
        computedSumPaise: 0,
      };
    }
    return {
      answerText: `Your largest single debit is ${formatINRPaise(top.amountPaise)} paid to ${
        top.counterpartyName
      } on ${top.date} (${top.category}).`,
      matchedTransactions: [top],
      computedSumPaise: top.amountPaise,
    };
  }

  if (q.includes('total credit') || q.includes('total income')) {
    const credits = transactions.filter((t) => t.direction === 'CREDIT');
    const sum = credits.reduce((s, t) => s + t.amountPaise, 0);
    return {
      answerText: `You have ${credits.length} credit transactions totaling ${formatINRPaise(
        sum
      )}.`,
      matchedTransactions: credits,
      computedSumPaise: sum,
    };
  }

  if (q.includes('uncategorized')) {
    const uncat = transactions.filter((t) => t.category === 'Uncategorized');
    const sum = uncat.reduce((s, t) => s + t.amountPaise, 0);
    return {
      answerText: `Found ${uncat.length} uncategorized transactions totaling ${formatINRPaise(
        sum
      )}.`,
      matchedTransactions: uncat,
      computedSumPaise: sum,
    };
  }

  // Fallback keyword search across counterparty & category
  const matches = transactions.filter(
    (t) =>
      q.includes(t.counterpartyName.toLowerCase()) ||
      t.counterpartyName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.rawDescription.toLowerCase().includes(q)
  );
  const sum = matches.reduce((s, t) => s + t.amountPaise, 0);
  return {
    answerText: `Found ${matches.length} matching transactions with combined volume ${formatINRPaise(
      sum
    )}.`,
    matchedTransactions: matches,
    computedSumPaise: sum,
  };
}
