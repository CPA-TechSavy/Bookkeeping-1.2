import {
  Account,
  AccountBalance,
  BalanceSheetReport,
  CompanyProfile,
  DateFilter,
  IncomeStatementReport,
  JournalEntry,
  TrialBalanceReport,
} from '../types';

export function filterEntriesByDate(entries: JournalEntry[], filter?: DateFilter): JournalEntry[] {
  if (!filter || filter.type === 'all') return entries;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (filter.type) {
    case 'this_month':
      startDate = new Date(currentYear, currentMonth, 1);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      break;
    case 'last_month':
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
      break;
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      startDate = new Date(currentYear, quarterStartMonth, 1);
      endDate = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59);
      break;
    }
    case 'ytd':
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59);
      break;
    case 'custom':
      if (filter.startDate) startDate = new Date(filter.startDate);
      if (filter.endDate) endDate = new Date(`${filter.endDate}T23:59:59`);
      break;
  }

  return entries.filter((entry) => {
    if (entry.status !== 'Posted') return false;
    const entryDate = new Date(entry.date);
    if (startDate && entryDate < startDate) return false;
    if (endDate && entryDate > endDate) return false;
    return true;
  });
}

export function calculateAccountBalances(
  accounts: Account[],
  journalEntries: JournalEntry[],
  dateFilter?: DateFilter
): Map<string, AccountBalance> {
  const filteredEntries = filterEntriesByDate(journalEntries, dateFilter);
  const balanceMap = new Map<string, AccountBalance>();

  // Initialize map
  accounts.forEach((acc) => {
    balanceMap.set(acc.id, {
      account: acc,
      totalDebits: 0,
      totalCredits: 0,
      netBalance: 0,
    });
  });

  // Accumulate debits & credits
  filteredEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      const record = balanceMap.get(line.accountId);
      if (record) {
        record.totalDebits += Number(line.debit) || 0;
        record.totalCredits += Number(line.credit) || 0;
      }
    });
  });

  // Calculate net balances based on Normal Balance conventions
  balanceMap.forEach((bal) => {
    if (bal.account.normalBalance === 'Debit') {
      bal.netBalance = bal.totalDebits - bal.totalCredits;
    } else {
      bal.netBalance = bal.totalCredits - bal.totalDebits;
    }
  });

  return balanceMap;
}

export function generateTrialBalance(
  accounts: Account[],
  journalEntries: JournalEntry[],
  dateFilter?: DateFilter
): TrialBalanceReport {
  const balances = calculateAccountBalances(accounts, journalEntries, dateFilter);
  let totalDebits = 0;
  let totalCredits = 0;

  const rows: TrialBalanceReport['rows'] = [];

  accounts.forEach((acc) => {
    const bal = balances.get(acc.id);
    if (!bal) return;

    let debitBalance = 0;
    let creditBalance = 0;

    // Normal debit accounts (Asset, Expense)
    if (bal.account.normalBalance === 'Debit') {
      const net = bal.totalDebits - bal.totalCredits;
      if (net >= 0) {
        debitBalance = net;
      } else {
        creditBalance = Math.abs(net);
      }
    } else {
      // Normal credit accounts (Liability, Equity, Revenue)
      const net = bal.totalCredits - bal.totalDebits;
      if (net >= 0) {
        creditBalance = net;
      } else {
        debitBalance = Math.abs(net);
      }
    }

    if (debitBalance !== 0 || creditBalance !== 0 || bal.totalDebits > 0 || bal.totalCredits > 0) {
      rows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debitBalance,
        creditBalance,
      });

      totalDebits += debitBalance;
      totalCredits += creditBalance;
    }
  });

  // Sort by code
  rows.sort((a, b) => a.code.localeCompare(b.code));

  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.01;

  let periodDesc = 'All Posted Periods';
  if (dateFilter?.type === 'this_month') periodDesc = 'Current Month';
  else if (dateFilter?.type === 'last_month') periodDesc = 'Prior Month';
  else if (dateFilter?.type === 'this_quarter') periodDesc = 'Current Quarter';
  else if (dateFilter?.type === 'ytd') periodDesc = 'Year to Date';
  else if (dateFilter?.type === 'custom' && dateFilter.startDate && dateFilter.endDate) {
    periodDesc = `${dateFilter.startDate} to ${dateFilter.endDate}`;
  }

  return {
    dateGenerated: new Date().toLocaleDateString(),
    period: periodDesc,
    rows,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    isBalanced,
    difference: Math.round(difference * 100) / 100,
  };
}

export function generateIncomeStatement(
  accounts: Account[],
  journalEntries: JournalEntry[],
  dateFilter?: DateFilter
): IncomeStatementReport {
  const balances = calculateAccountBalances(accounts, journalEntries, dateFilter);

  const revenues: { code: string; name: string; amount: number }[] = [];
  const cogs: { code: string; name: string; amount: number }[] = [];
  const expenses: { code: string; name: string; amount: number; subtype: string }[] = [];

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalExpenses = 0;

  accounts.forEach((acc) => {
    const bal = balances.get(acc.id);
    if (!bal) return;

    if (acc.type === 'Revenue') {
      const amount = bal.netBalance; // Normal credit
      if (amount !== 0) {
        revenues.push({ code: acc.code, name: acc.name, amount });
        totalRevenue += amount;
      }
    } else if (acc.type === 'Expense') {
      const amount = bal.netBalance; // Normal debit
      if (acc.subtype === 'Cost of Goods Sold') {
        if (amount !== 0) {
          cogs.push({ code: acc.code, name: acc.name, amount });
          totalCOGS += amount;
        }
      } else {
        if (amount !== 0) {
          expenses.push({ code: acc.code, name: acc.name, amount, subtype: acc.subtype });
          totalExpenses += amount;
        }
      }
    }
  });

  revenues.sort((a, b) => a.code.localeCompare(b.code));
  cogs.sort((a, b) => a.code.localeCompare(b.code));
  expenses.sort((a, b) => a.code.localeCompare(b.code));

  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netOperatingIncome = grossProfit - totalExpenses;
  const netMarginPercentage = totalRevenue > 0 ? (netOperatingIncome / totalRevenue) * 100 : 0;

  let periodDesc = 'All Posted Periods';
  if (dateFilter?.type === 'this_month') periodDesc = 'Current Month';
  else if (dateFilter?.type === 'last_month') periodDesc = 'Prior Month';
  else if (dateFilter?.type === 'this_quarter') periodDesc = 'Current Quarter';
  else if (dateFilter?.type === 'ytd') periodDesc = 'Year to Date';
  else if (dateFilter?.type === 'custom' && dateFilter.startDate && dateFilter.endDate) {
    periodDesc = `${dateFilter.startDate} to ${dateFilter.endDate}`;
  }

  return {
    dateGenerated: new Date().toLocaleDateString(),
    period: periodDesc,
    revenues,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    cogs,
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPercentage: Math.round(grossMarginPercentage * 10) / 10,
    expenses,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netOperatingIncome: Math.round(netOperatingIncome * 100) / 100,
    netMarginPercentage: Math.round(netMarginPercentage * 10) / 10,
  };
}

export function generateBalanceSheet(
  accounts: Account[],
  journalEntries: JournalEntry[],
  asOfDate?: string,
  company?: CompanyProfile
): BalanceSheetReport {
  // Balance sheet is cumulative as of a specific date
  const dateFilter: DateFilter = asOfDate
    ? { type: 'custom', endDate: asOfDate }
    : { type: 'all' };

  const balances = calculateAccountBalances(accounts, journalEntries, dateFilter);

  const currentAssets: { code: string; name: string; amount: number }[] = [];
  const nonCurrentAssets: { code: string; name: string; amount: number }[] = [];
  let totalCurrentAssets = 0;
  let totalNonCurrentAssets = 0;

  const currentLiabilities: { code: string; name: string; amount: number }[] = [];
  const longTermLiabilities: { code: string; name: string; amount: number }[] = [];
  let totalCurrentLiabilities = 0;
  let totalLongTermLiabilities = 0;

  const equityItems: { code: string; name: string; amount: number }[] = [];
  let retainedEarnings = 0;

  // Track Net Income from revenue & expenses
  let totalRevenue = 0;
  let totalExpenses = 0;

  accounts.forEach((acc) => {
    const bal = balances.get(acc.id);
    if (!bal) return;

    if (acc.type === 'Asset') {
      const isCurrent =
        acc.subtype === 'Cash & Bank' ||
        acc.subtype === 'Accounts Receivable' ||
        acc.subtype === 'Inventory' ||
        acc.subtype === 'Prepaid Assets' ||
        acc.subtype === 'Prepaid Expenses';

      if (bal.netBalance !== 0) {
        if (isCurrent) {
          currentAssets.push({ code: acc.code, name: acc.name, amount: bal.netBalance });
          totalCurrentAssets += bal.netBalance;
        } else {
          nonCurrentAssets.push({ code: acc.code, name: acc.name, amount: bal.netBalance });
          totalNonCurrentAssets += bal.netBalance;
        }
      }
    } else if (acc.type === 'Liability') {
      const isCurrent =
        acc.subtype === 'Accounts Payable' ||
        acc.subtype === 'Accrued Expenses' ||
        acc.subtype === 'Unearned Revenue' ||
        acc.subtype === 'Sales Tax Payable' ||
        acc.subtype === 'Credit Card' ||
        acc.subtype === 'Accrued Liabilities';

      if (bal.netBalance !== 0) {
        if (isCurrent) {
          currentLiabilities.push({ code: acc.code, name: acc.name, amount: bal.netBalance });
          totalCurrentLiabilities += bal.netBalance;
        } else {
          longTermLiabilities.push({ code: acc.code, name: acc.name, amount: bal.netBalance });
          totalLongTermLiabilities += bal.netBalance;
        }
      }
    } else if (acc.type === 'Equity') {
      if (acc.subtype === 'Retained Earnings') {
        retainedEarnings += bal.netBalance;
      } else {
        if (bal.netBalance !== 0) {
          equityItems.push({ code: acc.code, name: acc.name, amount: bal.netBalance });
        }
      }
    } else if (acc.type === 'Revenue') {
      totalRevenue += bal.netBalance;
    } else if (acc.type === 'Expense') {
      totalExpenses += bal.netBalance;
    }
  });

  const currentPeriodNetIncome = totalRevenue - totalExpenses;
  const baseEquitySum = equityItems.reduce((acc, item) => acc + item.amount, 0);
  const totalEquity = baseEquitySum + retainedEarnings + currentPeriodNetIncome;

  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const variance = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = variance < 0.01;

  currentAssets.sort((a, b) => a.code.localeCompare(b.code));
  nonCurrentAssets.sort((a, b) => a.code.localeCompare(b.code));
  currentLiabilities.sort((a, b) => a.code.localeCompare(b.code));
  longTermLiabilities.sort((a, b) => a.code.localeCompare(b.code));

  // Dynamic Entity-Specific Equity Modeling
  const entityType = company?.entityType || 'Corporation';
  let soleProprietorEquity: BalanceSheetReport['soleProprietorEquity'];
  let partnershipEquity: BalanceSheetReport['partnershipEquity'];
  let corporationEquity: BalanceSheetReport['corporationEquity'];

  // Check drawings from ledger
  let ledgerDrawings = 0;
  accounts.forEach((acc) => {
    if (acc.name.toLowerCase().includes('drawing') || acc.code === '3020') {
      const bal = balances.get(acc.id);
      if (bal) {
        ledgerDrawings += Math.abs(bal.netBalance);
      }
    }
  });

  if (entityType === 'Single Proprietorship' || entityType === 'Sole Proprietorship') {
    const info = company?.soleProprietorInfo;
    const beginningCapital = info?.beginningCapital ?? (baseEquitySum > 0 ? baseEquitySum : 50000);
    const additionalInvestments = info?.additionalInvestment ?? 0;
    const drawings = info?.drawings !== undefined && info.drawings > 0 ? info.drawings : ledgerDrawings;
    const netIncome = currentPeriodNetIncome;
    const endingCapital = beginningCapital + additionalInvestments + netIncome - drawings;

    soleProprietorEquity = {
      ownerName: info?.ownerName || (company?.name ? `${company.name} Owner` : 'Sole Proprietor Owner'),
      beginningCapital: Math.round(beginningCapital * 100) / 100,
      additionalInvestments: Math.round(additionalInvestments * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      drawings: Math.round(drawings * 100) / 100,
      endingCapital: Math.round(endingCapital * 100) / 100,
    };
  } else if (entityType === 'Partnership') {
    const rawPartners =
      company?.partnershipInfo?.partners && company.partnershipInfo.partners.length > 0
        ? company.partnershipInfo.partners
        : [
            { id: 'part-1', name: 'General Partner 1', profitSharePercentage: 50, beginningCapital: 50000, additionalInvestment: 0, drawings: 0 },
            { id: 'part-2', name: 'General Partner 2', profitSharePercentage: 50, beginningCapital: 50000, additionalInvestment: 0, drawings: 0 },
          ];

    let totalPartnersCapital = 0;
    const partners = rawPartners.map((p) => {
      const shareOfNetIncome = Math.round(currentPeriodNetIncome * (p.profitSharePercentage / 100) * 100) / 100;
      const endingCapital = Math.round(
        (p.beginningCapital + (p.additionalInvestment || 0) + shareOfNetIncome - (p.drawings || 0)) * 100
      ) / 100;
      totalPartnersCapital += endingCapital;
      return {
        id: p.id,
        name: p.name,
        profitSharePercentage: p.profitSharePercentage,
        beginningCapital: Math.round(p.beginningCapital * 100) / 100,
        additionalInvestments: Math.round((p.additionalInvestment || 0) * 100) / 100,
        shareOfNetIncome,
        drawings: Math.round((p.drawings || 0) * 100) / 100,
        endingCapital,
      };
    });

    partnershipEquity = {
      partners,
      totalPartnersCapital: Math.round(totalPartnersCapital * 100) / 100,
    };
  } else {
    // Corporation / Cooperative
    const corp = company?.corporationInfo;
    const authorizedCapitalStock = corp?.authorizedCapitalStock ?? 1000000;
    const parValuePerShare = corp?.parValuePerShare ?? 10;
    const authorizedShares = corp?.authorizedShares ?? Math.round(authorizedCapitalStock / (parValuePerShare || 1));
    const paidUpCapital = corp?.paidUpCapital ?? (baseEquitySum > 0 ? baseEquitySum : 250000);
    const appropriatedRetainedEarnings = corp?.appropriatedRetainedEarnings ?? 0;
    const priorUnappropriated = corp?.unappropriatedRetainedEarnings ?? retainedEarnings;
    const dividendsDistributed = corp?.dividendsDeclared ?? 0;
    const unappropriatedRetainedEarnings = priorUnappropriated + currentPeriodNetIncome - dividendsDistributed;
    const totalRetainedEarnings = appropriatedRetainedEarnings + unappropriatedRetainedEarnings;
    const totalShareholdersEquity = paidUpCapital + totalRetainedEarnings;

    corporationEquity = {
      authorizedCapitalStock: Math.round(authorizedCapitalStock * 100) / 100,
      parValuePerShare: Math.round(parValuePerShare * 100) / 100,
      authorizedShares,
      paidUpCapital: Math.round(paidUpCapital * 100) / 100,
      subscribedCapital: Math.round(paidUpCapital * 100) / 100,
      appropriatedRetainedEarnings: Math.round(appropriatedRetainedEarnings * 100) / 100,
      unappropriatedRetainedEarnings: Math.round(unappropriatedRetainedEarnings * 100) / 100,
      currentPeriodNetIncome: Math.round(currentPeriodNetIncome * 100) / 100,
      dividendsDistributed: Math.round(dividendsDistributed * 100) / 100,
      totalRetainedEarnings: Math.round(totalRetainedEarnings * 100) / 100,
      totalShareholdersEquity: Math.round(totalShareholdersEquity * 100) / 100,
    };
  }

  return {
    dateGenerated: new Date().toLocaleDateString(),
    asOfDate: asOfDate || new Date().toISOString().split('T')[0],
    currentAssets,
    totalCurrentAssets: Math.round(totalCurrentAssets * 100) / 100,
    nonCurrentAssets,
    totalNonCurrentAssets: Math.round(totalNonCurrentAssets * 100) / 100,
    totalAssets: Math.round(totalAssets * 100) / 100,

    currentLiabilities,
    totalCurrentLiabilities: Math.round(totalCurrentLiabilities * 100) / 100,
    longTermLiabilities,
    totalLongTermLiabilities: Math.round(totalLongTermLiabilities * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,

    equityItems,
    retainedEarnings: Math.round(retainedEarnings * 100) / 100,
    currentPeriodNetIncome: Math.round(currentPeriodNetIncome * 100) / 100,
    totalEquity: Math.round(totalEquity * 100) / 100,

    totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
    isBalanced,
    variance: Math.round(variance * 100) / 100,

    soleProprietorEquity,
    partnershipEquity,
    corporationEquity,
  };
}

export function validateJournalEntry(lines: { accountId: string; debit: number; credit: number }[]): {
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  discrepancy: number;
  errorMessage?: string;
} {
  if (!lines || lines.length < 2) {
    return {
      isValid: false,
      totalDebits: 0,
      totalCredits: 0,
      discrepancy: 0,
      errorMessage: 'A journal entry requires at least 2 lines (Debit and Credit).',
    };
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of lines) {
    if (!line.accountId) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        discrepancy: 0,
        errorMessage: 'All lines must specify a valid Chart of Accounts entry.',
      };
    }
    const deb = Number(line.debit) || 0;
    const cred = Number(line.credit) || 0;

    if (deb < 0 || cred < 0) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        discrepancy: 0,
        errorMessage: 'Debit and Credit amounts must be non-negative numbers.',
      };
    }

    if (deb > 0 && cred > 0) {
      return {
        isValid: false,
        totalDebits,
        totalCredits,
        discrepancy: 0,
        errorMessage: 'A single line item cannot have both a Debit and a Credit.',
      };
    }

    totalDebits += deb;
    totalCredits += cred;
  }

  if (totalDebits === 0 && totalCredits === 0) {
    return {
      isValid: false,
      totalDebits: 0,
      totalCredits: 0,
      discrepancy: 0,
      errorMessage: 'Total journal entry amount cannot be zero.',
    };
  }

  const discrepancy = Math.abs(totalDebits - totalCredits);
  const isValid = discrepancy < 0.005;

  return {
    isValid,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    discrepancy: Math.round(discrepancy * 100) / 100,
    errorMessage: isValid
      ? undefined
      : `Journal entry is out of balance by $${discrepancy.toFixed(2)}. Debits must equal Credits.`,
  };
}

export function formatCurrency(amount: number, symbol = '$'): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  if (isNegative) {
    return `(${symbol}${formatted})`;
  }
  return `${symbol}${formatted}`;
}

// -------------------------------------------------------------
// Transaction to Journal Entry Automatic Double-Entry Mappings
// -------------------------------------------------------------

export function createInvoiceJournalEntry(tx: any, accounts: Account[]): JournalEntry | null {
  const isBillingReceipt = tx.type === 'Billing_Receipt' || tx.type === 'Invoice';
  if (!isBillingReceipt) return null;

  const arAccount =
    accounts.find((a) => a.subtype === 'Accounts Receivable') ||
    accounts.find((a) => a.code === '1030') ||
    accounts.find((a) => a.type === 'Asset');

  const revenueAccount =
    accounts.find((a) => a.id === tx.categoryAccountId) ||
    accounts.find((a) => a.type === 'Revenue') ||
    accounts.find((a) => a.code === '4010');

  const salesTaxAccount =
    accounts.find((a) => a.code === '2030') ||
    accounts.find((a) => a.subtype === 'Other Liability' && a.name.toLowerCase().includes('tax')) ||
    accounts.find((a) => a.type === 'Liability');

  if (!arAccount || !revenueAccount) return null;

  const lines: any[] = [];

  // Line 1: Debit Accounts Receivable (Full Invoice Total)
  lines.push({
    id: `jel-${Date.now()}-1`,
    accountId: arAccount.id,
    accountCode: arAccount.code,
    accountName: arAccount.name,
    debit: Number(tx.amount.toFixed(2)),
    credit: 0,
    memo: `Billing Receipt #${tx.number} - ${tx.contactName}`,
  });

  const subtotal = tx.subtotal ? Number(tx.subtotal.toFixed(2)) : Number(tx.amount.toFixed(2));
  const tax = tx.taxAmount ? Number(tx.taxAmount.toFixed(2)) : 0;

  // Line 2: Credit Sales Revenue
  lines.push({
    id: `jel-${Date.now()}-2`,
    accountId: revenueAccount.id,
    accountCode: revenueAccount.code,
    accountName: revenueAccount.name,
    debit: 0,
    credit: subtotal,
    memo: `Revenue recognized for Billing Receipt #${tx.number}`,
  });

  // Line 3: Credit Sales Tax Payable (if applicable)
  if (tax > 0 && salesTaxAccount) {
    lines.push({
      id: `jel-${Date.now()}-3`,
      accountId: salesTaxAccount.id,
      accountCode: salesTaxAccount.code,
      accountName: salesTaxAccount.name,
      debit: 0,
      credit: tax,
      memo: `Sales tax collected for Billing Receipt #${tx.number}`,
    });
  }

  return {
    id: `je-auto-${tx.id}`,
    companyId: tx.companyId,
    entryNumber: `JE-BR-${tx.number}`,
    date: tx.date,
    description: `Billing Receipt ${tx.number}: ${tx.contactName}`,
    reference: tx.number,
    sourceType: 'Billing_Receipt',
    sourceId: tx.id,
    lines,
    status: 'Posted',
    createdAt: new Date().toISOString(),
  };
}

export function createBillJournalEntry(tx: any, accounts: Account[]): JournalEntry | null {
  const isPurchaseReceipt = tx.type === 'Purchase_Receipt' || tx.type === 'Bill';
  if (!isPurchaseReceipt) return null;

  const apAccount =
    accounts.find((a) => a.subtype === 'Accounts Payable') ||
    accounts.find((a) => a.code === '2010') ||
    accounts.find((a) => a.type === 'Liability');

  const expenseAccount =
    accounts.find((a) => a.id === tx.categoryAccountId) ||
    accounts.find((a) => a.type === 'Expense') ||
    accounts.find((a) => a.code === '6010');

  if (!apAccount || !expenseAccount) return null;

  const lines: any[] = [
    {
      id: `jel-${Date.now()}-1`,
      accountId: expenseAccount.id,
      accountCode: expenseAccount.code,
      accountName: expenseAccount.name,
      debit: Number(tx.amount.toFixed(2)),
      credit: 0,
      memo: `Purchases/Services Receipt #${tx.number} - ${tx.contactName}`,
    },
    {
      id: `jel-${Date.now()}-2`,
      accountId: apAccount.id,
      accountCode: apAccount.code,
      accountName: apAccount.name,
      debit: 0,
      credit: Number(tx.amount.toFixed(2)),
      memo: `Accounts payable for Purchases/Services Receipt #${tx.number}`,
    },
  ];

  return {
    id: `je-auto-${tx.id}`,
    companyId: tx.companyId,
    entryNumber: `JE-PSR-${tx.number}`,
    date: tx.date,
    description: `Purchases/Services Receipt ${tx.number}: ${tx.contactName}`,
    reference: tx.number,
    sourceType: 'Purchase_Receipt',
    sourceId: tx.id,
    lines,
    status: 'Posted',
    createdAt: new Date().toISOString(),
  };
}

export function createExpenseJournalEntry(tx: any, accounts: Account[]): JournalEntry | null {
  const cashAccount =
    accounts.find((a) => a.id === tx.bankAccountId) ||
    accounts.find((a) => a.subtype === 'Cash & Bank') ||
    accounts.find((a) => a.code === '1010');

  const expenseAccount =
    accounts.find((a) => a.id === tx.categoryAccountId) ||
    accounts.find((a) => a.type === 'Expense') ||
    accounts.find((a) => a.code === '6010');

  if (!cashAccount || !expenseAccount) return null;

  const lines: any[] = [
    {
      id: `jel-${Date.now()}-1`,
      accountId: expenseAccount.id,
      accountCode: expenseAccount.code,
      accountName: expenseAccount.name,
      debit: Number(tx.amount.toFixed(2)),
      credit: 0,
      memo: `Purchases/Services Direct Expense: ${tx.contactName}`,
    },
    {
      id: `jel-${Date.now()}-2`,
      accountId: cashAccount.id,
      accountCode: cashAccount.code,
      accountName: cashAccount.name,
      debit: 0,
      credit: Number(tx.amount.toFixed(2)),
      memo: `Payment via ${cashAccount.name}`,
    },
  ];

  return {
    id: `je-auto-${tx.id}`,
    companyId: tx.companyId,
    entryNumber: `JE-EXP-${tx.number}`,
    date: tx.date,
    description: `Purchases/Services Receipt (Cash/Bank) ${tx.number}: ${tx.contactName}`,
    reference: tx.number,
    sourceType: 'Purchase_Receipt',
    sourceId: tx.id,
    lines,
    status: 'Posted',
    createdAt: new Date().toISOString(),
  };
}

export function createPaymentJournalEntry(
  tx: any,
  accounts: Account[],
  cashAccountId: string
): JournalEntry | null {
  const cashAccount = accounts.find((a) => a.id === cashAccountId);
  if (!cashAccount) return null;

  const isBillingReceipt = tx.type === 'Billing_Receipt' || tx.type === 'Invoice';
  const isPurchaseReceipt = tx.type === 'Purchase_Receipt' || tx.type === 'Bill';

  if (isBillingReceipt) {
    // Client paid us -> Debit Cash, Credit Accounts Receivable
    const arAccount =
      accounts.find((a) => a.subtype === 'Accounts Receivable') ||
      accounts.find((a) => a.code === '1030');
    if (!arAccount) return null;

    let methodMemo = 'Paid via Cash';
    if (tx.paymentMethod === 'Check') {
      methodMemo = `Paid via Check (Ref/Acct: ${tx.paymentReference || 'N/A'})`;
    } else if (tx.paymentMethod === 'E-Wallet') {
      methodMemo = `Paid via E-Wallet (Ref/Acct: ${tx.paymentReference || 'N/A'})`;
    } else if (tx.paymentMethod === 'Cash') {
      methodMemo = 'Paid via Cash';
    }

    return {
      id: `je-pay-${Date.now()}`,
      companyId: tx.companyId,
      entryNumber: `JE-PMT-${tx.number}`,
      date: new Date().toISOString().split('T')[0],
      description: `Payment Received for Billing Receipt ${tx.number} (${tx.contactName}) [${methodMemo}]`,
      reference: tx.paymentReference || tx.number,
      sourceType: 'Payment',
      sourceId: tx.id,
      status: 'Posted',
      createdAt: new Date().toISOString(),
      lines: [
        {
          id: `jel-${Date.now()}-1`,
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          accountName: cashAccount.name,
          debit: Number(tx.amount.toFixed(2)),
          credit: 0,
          memo: `${methodMemo} - Deposit to ${cashAccount.name} for #${tx.number}`,
        },
        {
          id: `jel-${Date.now()}-2`,
          accountId: arAccount.id,
          accountCode: arAccount.code,
          accountName: arAccount.name,
          debit: 0,
          credit: Number(tx.amount.toFixed(2)),
          memo: `Clear Accounts Receivable for Billing Receipt #${tx.number}`,
        },
      ],
    };
  } else if (isPurchaseReceipt) {
    // We paid vendor -> Debit Accounts Payable, Credit Cash
    const apAccount =
      accounts.find((a) => a.subtype === 'Accounts Payable') ||
      accounts.find((a) => a.code === '2010');
    if (!apAccount) return null;

    return {
      id: `je-pay-${Date.now()}`,
      companyId: tx.companyId,
      entryNumber: `JE-PSRPMT-${tx.number}`,
      date: new Date().toISOString().split('T')[0],
      description: `Payment to ${tx.contactName} for Purchases/Services Receipt ${tx.number}`,
      reference: tx.number,
      sourceType: 'Payment',
      sourceId: tx.id,
      status: 'Posted',
      createdAt: new Date().toISOString(),
      lines: [
        {
          id: `jel-${Date.now()}-1`,
          accountId: apAccount.id,
          accountCode: apAccount.code,
          accountName: apAccount.name,
          debit: Number(tx.amount.toFixed(2)),
          credit: 0,
          memo: `Clear Accounts Payable for Receipt #${tx.number}`,
        },
        {
          id: `jel-${Date.now()}-2`,
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          accountName: cashAccount.name,
          debit: 0,
          credit: Number(tx.amount.toFixed(2)),
          memo: `Disbursement via ${cashAccount.name}`,
        },
      ],
    };
  }

  return null;
}

export function formatTaxId(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '').slice(0, 14);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  if (digits.length > 9) parts.push(digits.slice(9, 14));
  return parts.join('-');
}

export interface FormattedNoteSection {
  id: string;
  noteNumber: string;
  title: string;
  policySummary: string;
  description: string;
  items: Array<{
    code: string;
    name: string;
    subtype: string;
    balance: number;
    detail: string;
  }>;
  total: number;
  totalLabel: string;
}

export function buildNotesToFSData(
  company: CompanyProfile,
  accounts: Account[],
  balanceSheet: BalanceSheetReport,
  incomeStatement: IncomeStatementReport
): FormattedNoteSection[] {
  const getAccountBalance = (code: string): number => {
    const fromBSAsset =
      balanceSheet.currentAssets.find((a) => a.code === code)?.amount ||
      balanceSheet.nonCurrentAssets.find((a) => a.code === code)?.amount;
    if (fromBSAsset !== undefined) return fromBSAsset;

    const fromBSLiab =
      balanceSheet.currentLiabilities.find((l) => l.code === code)?.amount ||
      balanceSheet.longTermLiabilities.find((l) => l.code === code)?.amount;
    if (fromBSLiab !== undefined) return fromBSLiab;

    const fromBSEquity = balanceSheet.equityItems.find((e) => e.code === code)?.amount;
    if (fromBSEquity !== undefined) return fromBSEquity;

    const fromISRev = incomeStatement.revenues.find((r) => r.code === code)?.amount;
    if (fromISRev !== undefined) return fromISRev;

    const fromISCOGS = incomeStatement.cogs.find((c) => c.code === code)?.amount;
    if (fromISCOGS !== undefined) return fromISCOGS;

    const fromISExp = incomeStatement.expenses.find((e) => e.code === code)?.amount;
    if (fromISExp !== undefined) return fromISExp;

    return 0;
  };

  const notes: FormattedNoteSection[] = [
    {
      id: 'note-1',
      noteNumber: 'Note 1',
      title: 'Corporate Information & Entity Profile',
      policySummary: 'Entity organization, legal charter, and reporting jurisdiction.',
      description: `${company.name} is a duly organized ${company.entityType} operating under Tax Identification Number ${formatTaxId(company.taxId) || company.taxId || 'N/A'}. The registered entity maintains its corporate books and financial statements denominated in ${company.currency} (${company.currencySymbol}) under the ${company.accountingMethod} accounting method. Fiscal year conclusion is designated on ${company.fiscalYearEnd}.`,
      items: [],
      total: 0,
      totalLabel: '',
    },
    {
      id: 'note-2',
      noteNumber: 'Note 2',
      title: 'Summary of Significant Accounting Policies',
      policySummary: 'Core GAAP / IFRS accounting standards, valuation rules, and recognition criteria.',
      description: `(a) Basis of Preparation: Financial statements are compiled in accordance with standard accounting principles using the ${company.accountingMethod} basis of accounting.
(b) Revenue Recognition: Revenue is recognized upon delivery of goods or completion of contracted services, when performance obligations are satisfied and collection is reasonably assured.
(c) Merchandise Inventories: Stored inventory assets are stated at the lower of cost or net realizable value using the FIFO (first-in, first-out) or weighted average cost method.
(d) Property, Plant & Equipment: Fixed assets are recorded at acquisition historical cost less accumulated depreciation.
(e) Cash Equivalents: Highly liquid balances with original maturities of three months or less are classified as cash equivalents.`,
      items: [],
      total: 0,
      totalLabel: '',
    },
    {
      id: 'note-3',
      noteNumber: 'Note 3',
      title: 'Cash and Cash Equivalents',
      policySummary: 'Unrestricted depository accounts, operational checking, payroll reserve, and petty cash.',
      description: 'Cash and cash equivalents comprise operating bank checking accounts, interest-bearing business savings, and petty cash funds held for day-to-day administrative disbursements. All balances are unrestricted and available for general operational requirements.',
      items: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Cash & Bank' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'Depository account maintained with accredited commercial banking partner.',
        })),
      total: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Cash & Bank' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
        .reduce((sum, a) => sum + getAccountBalance(a.code), 0),
      totalLabel: 'Total Cash and Cash Equivalents',
    },
    {
      id: 'note-4',
      noteNumber: 'Note 4',
      title: 'Trade and Other Receivables',
      policySummary: 'Unbilled services, client trade billings, and allowance for credit losses.',
      description: 'Trade receivables reflect invoiced amounts due from commercial customers for goods supplied and professional services rendered in the ordinary course of business. Balances are typically due within 30 to 60 days.',
      items: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Accounts Receivable' || a.name.toLowerCase().includes('receivable')))
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'Open customer invoices with standard commercial trade terms.',
        })),
      total: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Accounts Receivable' || a.name.toLowerCase().includes('receivable')))
        .reduce((sum, a) => sum + getAccountBalance(a.code), 0),
      totalLabel: 'Total Trade Receivables (Net)',
    },
    {
      id: 'note-5',
      noteNumber: 'Note 5',
      title: 'Merchandise Inventories & Prepaid Assets',
      policySummary: 'Physical stock held for resale, warehouse merchandise, and advance payments.',
      description: 'Merchandise inventories represent finished retail goods and technology stock ready for customer fulfillment. Prepaid assets represent payments made in advance for insurance coverage, software licenses, or commercial leases benefiting future accounting periods.',
      items: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Inventory' || a.subtype === 'Prepaid Assets' || a.subtype === 'Prepaid Expenses'))
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'Current asset inventory stock or prepaid operational expense.',
        })),
      total: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Inventory' || a.subtype === 'Prepaid Assets' || a.subtype === 'Prepaid Expenses'))
        .reduce((sum, a) => sum + getAccountBalance(a.code), 0),
      totalLabel: 'Total Merchandise Inventories & Prepaid Assets',
    },
    {
      id: 'note-6',
      noteNumber: 'Note 6',
      title: 'Property, Plant & Equipment (Net)',
      policySummary: 'Capital equipment, IT hardware, vehicles, and accumulated depreciation.',
      description: 'Fixed assets are recorded at original acquisition cost and depreciated over their estimated useful operational life using straight-line amortization. Assets undergo periodic impairment reviews.',
      items: accounts
        .filter((a) => a.type === 'Asset' && (a.subtype === 'Property, Plant & Equipment' || a.code.startsWith('15') || a.code.startsWith('16')))
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'Capital equipment utilized in primary business operations.',
        })),
      total: balanceSheet.totalNonCurrentAssets,
      totalLabel: 'Total Property, Plant & Equipment (Net Carrying Value)',
    },
    {
      id: 'note-7',
      noteNumber: 'Note 7',
      title: 'Trade Payables & Accrued Liabilities',
      policySummary: 'Vendor trade payables, accrued operating expenses, and unearned revenue.',
      description: 'Trade accounts payable represent outstanding obligations to vendors and suppliers for inventory deliveries and services received. Accrued expenses include incurred utility, payroll, and government tax obligations payable within the subsequent operating cycle.',
      items: accounts
        .filter((a) => a.type === 'Liability' && (a.subtype === 'Accounts Payable' || a.subtype === 'Accrued Expenses' || a.subtype === 'Unearned Revenue' || a.subtype === 'Sales Tax Payable' || a.subtype === 'Credit Card' || a.subtype === 'Accrued Liabilities'))
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'Short-term trade obligation payable within 30 to 60 days.',
        })),
      total: balanceSheet.totalCurrentLiabilities,
      totalLabel: 'Total Current Liabilities & Payables',
    },
  ];

  // Note 8: Entity-Specific Equity Disclosure
  if (company.entityType === 'Single Proprietorship' || company.entityType === 'Sole Proprietorship') {
    const sp = balanceSheet.soleProprietorEquity;
    const items = [
      {
        code: '3010',
        name: `${sp?.ownerName || 'Owner'}, Beginning Capital`,
        subtype: 'Owner Equity',
        balance: sp?.beginningCapital || 0,
        detail: 'Initial owner capital investment carried forward from prior periods.',
      },
      {
        code: '3015',
        name: 'Additional Investments Contributed',
        subtype: 'Owner Equity',
        balance: sp?.additionalInvestments || 0,
        detail: 'Additional capital contributed by the proprietor during the period.',
      },
      {
        code: 'INC',
        name: 'Net Operating Income for the Period',
        subtype: 'Profit Transfer',
        balance: sp?.netIncome || 0,
        detail: 'Net operating earnings transfer added directly to the proprietor capital account.',
      },
    ];

    if ((sp?.drawings || 0) > 0) {
      items.push({
        code: '3020',
        name: "Less: Owner's Personal Drawings",
        subtype: 'Drawings Contra-Equity',
        balance: -(sp?.drawings || 0),
        detail: "Proprietor's personal withdrawals deducted from the capital balance.",
      });
    }

    notes.push({
      id: 'note-8',
      noteNumber: 'Note 8',
      title: "Owner's Capital Structure (Sole Proprietorship)",
      policySummary: 'Proprietor initial capital, net profit transfer, additional investments, and personal drawings.',
      description: `The business operates as a Sole Proprietorship owned by ${sp?.ownerName || company.name}. Unlike corporate structures, there are no capital shares or retained earnings; net earnings of ${company.currencySymbol}${(sp?.netIncome || 0).toLocaleString()} flow directly into the owner's capital account alongside additional contributions of ${company.currencySymbol}${(sp?.additionalInvestments || 0).toLocaleString()} and less personal drawings of ${company.currencySymbol}${(sp?.drawings || 0).toLocaleString()}.`,
      items,
      total: sp?.endingCapital || balanceSheet.totalEquity,
      totalLabel: "Total Owner's Ending Capital",
    });
  } else if (company.entityType === 'Partnership') {
    const pe = balanceSheet.partnershipEquity;
    const items: Array<{ code: string; name: string; subtype: string; balance: number; detail: string }> = [];

    pe?.partners.forEach((p, idx) => {
      items.push({
        code: `P-${idx + 1}-CAP`,
        name: `${p.name} - Capital Balance (Share: ${p.profitSharePercentage}%)`,
        subtype: 'Partner Capital',
        balance: p.endingCapital,
        detail: `Beg: ${company.currencySymbol}${p.beginningCapital.toLocaleString()} + Add: ${company.currencySymbol}${p.additionalInvestments.toLocaleString()} + Profit: ${company.currencySymbol}${p.shareOfNetIncome.toLocaleString()} - Draw: ${company.currencySymbol}${p.drawings.toLocaleString()}`,
      });
    });

    notes.push({
      id: 'note-8',
      noteNumber: 'Note 8',
      title: "Partners' Capital & Profit Sharing Structure (Partnership)",
      policySummary: 'Partner equity accounts, profit-sharing distribution ratios, and drawing deductions.',
      description: `The partnership operates pursuant to a legal partnership agreement with profits and losses allocated strictly according to agreed percentage interests (${pe?.partners.map((p) => `${p.name}: ${p.profitSharePercentage}%`).join(', ')}). Net Income for the period is divided among partners accordingly, with additional investments credited and personal drawings debited to respective partner capital balances.`,
      items,
      total: pe?.totalPartnersCapital || balanceSheet.totalEquity,
      totalLabel: "Total Partners' Ending Capital",
    });
  } else {
    // Corporation / Cooperative
    const corp = balanceSheet.corporationEquity;
    const items = [
      {
        code: '3010',
        name: `Authorized Capital Stock (${(corp?.authorizedShares || 0).toLocaleString()} shares @ ${company.currencySymbol}${corp?.parValuePerShare || 10} par)`,
        subtype: 'Share Capital Memo',
        balance: corp?.authorizedCapitalStock || 0,
        detail: `Charter authorized capital stock totaling ${company.currencySymbol}${(corp?.authorizedCapitalStock || 0).toLocaleString()}.`,
      },
      {
        code: '3011',
        name: 'Paid-Up Share Capital (Subscribed & Paid)',
        subtype: 'Share Capital',
        balance: corp?.paidUpCapital || 0,
        detail: "Represents the Paid-up Capital contributed by shareholders in exchange for corporate stock.",
      },
      {
        code: '3025',
        name: 'Appropriated Retained Earnings',
        subtype: 'Retained Earnings Reserve',
        balance: corp?.appropriatedRetainedEarnings || 0,
        detail: 'Earnings restricted and appropriated for plant expansion, capital projects, or statutory reserves.',
      },
      {
        code: '3020',
        name: 'Unappropriated Retained Earnings (Cumulative)',
        subtype: 'Unappropriated Retained Earnings',
        balance: corp?.unappropriatedRetainedEarnings || 0,
        detail: 'Cumulative net profits retained since corporate inception, less dividends distributed to shareholders.',
      },
    ];

    notes.push({
      id: 'note-8',
      noteNumber: 'Note 8',
      title: "Stockholders' Equity & Retained Earnings (Corporation)",
      policySummary: 'Authorized capital stock, paid-up capital, unappropriated and appropriated retained earnings.',
      description: `The Corporation's charter authorizes ${company.currencySymbol}${(corp?.authorizedCapitalStock || 0).toLocaleString()} in capital stock with par value ${company.currencySymbol}${corp?.parValuePerShare || 10} per share. Paid-Up Capital of ${company.currencySymbol}${(corp?.paidUpCapital || 0).toLocaleString()} represents the permanent equity contribution of shareholders. Retained earnings reflect cumulative net income earned since inception minus dividends, divided into appropriated reserves of ${company.currencySymbol}${(corp?.appropriatedRetainedEarnings || 0).toLocaleString()} and unappropriated earnings of ${company.currencySymbol}${(corp?.unappropriatedRetainedEarnings || 0).toLocaleString()}.`,
      items,
      total: corp?.totalShareholdersEquity || balanceSheet.totalEquity,
      totalLabel: "Total Stockholders' Equity",
    });
  }

  // Note 9 & 10
  notes.push(
    {
      id: 'note-9',
      noteNumber: 'Note 9',
      title: 'Operating Revenue & Cost of Goods Sold',
      policySummary: 'Sales breakdown by service and merchandise stream, and direct costs incurred.',
      description: 'Revenues are derived from sales of enterprise inventory, technical software solutions, and maintenance contracts. Cost of Goods Sold encompasses direct material procurement and freight required to fulfill client orders.',
      items: [
        ...accounts
          .filter((a) => a.type === 'Revenue')
          .map((a) => ({
            code: a.code,
            name: a.name,
            subtype: a.subtype,
            balance: getAccountBalance(a.code),
            detail: a.description || 'Operating revenue delivery stream.',
          })),
        ...accounts
          .filter((a) => a.subtype === 'Cost of Goods Sold')
          .map((a) => ({
            code: a.code,
            name: a.name,
            subtype: a.subtype,
            balance: getAccountBalance(a.code),
            detail: a.description || 'Direct material cost and inventory sold.',
          })),
      ],
      total: incomeStatement.grossProfit,
      totalLabel: 'Gross Operating Margin (Revenues less COGS)',
    },
    {
      id: 'note-10',
      noteNumber: 'Note 10',
      title: 'Operating Expenses Disclosures',
      policySummary: 'Administrative overhead, rent, payroll, software licensing, and professional fees.',
      description: 'Operating expenses reflect indirect disbursements incurred to manage day-to-day corporate operations. Key expenditure categories include commercial facility rent, team payroll compensation, software infrastructure, and professional accounting services.',
      items: accounts
        .filter((a) => a.type === 'Expense' && a.subtype !== 'Cost of Goods Sold')
        .map((a) => ({
          code: a.code,
          name: a.name,
          subtype: a.subtype,
          balance: getAccountBalance(a.code),
          detail: a.description || 'General operational and administrative overhead disbursement.',
        })),
      total: incomeStatement.totalExpenses,
      totalLabel: 'Total Operating & Administrative Expenses',
    }
  );

  return notes;
}

export interface FormattedRatioItem {
  category: string;
  name: string;
  formula: string;
  value: string;
  status: string;
  interpretation: string;
}

export function buildFinancialRatiosData(
  company: CompanyProfile,
  balanceSheet: BalanceSheetReport,
  incomeStatement: IncomeStatementReport
): FormattedRatioItem[] {
  const currentAssets = balanceSheet.totalCurrentAssets;
  const currentLiabilities = balanceSheet.totalCurrentLiabilities;
  const totalAssets = balanceSheet.totalAssets;
  const totalLiabilities = balanceSheet.totalLiabilities;
  const totalEquity = balanceSheet.totalEquity;
  const totalRevenue = incomeStatement.totalRevenue;
  const grossProfit = incomeStatement.grossProfit;
  const netIncome = incomeStatement.netOperatingIncome;

  const cashTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('101') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
    .reduce((s, a) => s + a.amount, 0);

  const arTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('103') || a.name.toLowerCase().includes('receivable'))
    .reduce((s, a) => s + a.amount, 0);

  const inventoryTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('105') || a.name.toLowerCase().includes('inventory'))
    .reduce((s, a) => s + a.amount, 0);

  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const quickRatio = currentLiabilities > 0 ? (cashTotal + arTotal) / currentLiabilities : 0;
  const cashRatio = currentLiabilities > 0 ? cashTotal / currentLiabilities : 0;

  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
  const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
  const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;

  const debtToAssets = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const debtToEquity = totalEquity > 0 ? (totalLiabilities / totalEquity) * 100 : 0;
  const equityMultiplier = totalEquity > 0 ? totalAssets / totalEquity : 0;

  const assetTurnover = totalAssets > 0 ? totalRevenue / totalAssets : 0;
  const inventoryTurnover = inventoryTotal > 0 ? incomeStatement.totalCOGS / inventoryTotal : 0;

  return [
    {
      category: 'Liquidity',
      name: 'Current Ratio',
      formula: 'Current Assets ÷ Current Liabilities',
      value: `${currentRatio.toFixed(2)}x`,
      status: currentRatio >= 1.5 ? 'Strong' : currentRatio >= 1.0 ? 'Adequate' : 'Caution',
      interpretation: currentRatio >= 1.5 ? 'Excellent operational safety buffer.' : 'Working capital is tight.',
    },
    {
      category: 'Liquidity',
      name: 'Quick Ratio (Acid-Test)',
      formula: '(Cash + Trade Receivables) ÷ Current Liabilities',
      value: `${quickRatio.toFixed(2)}x`,
      status: quickRatio >= 1.0 ? 'Strong' : quickRatio >= 0.7 ? 'Adequate' : 'Caution',
      interpretation: 'Immediate liquid assets to extinguish short-term obligations without liquidating inventory.',
    },
    {
      category: 'Liquidity',
      name: 'Cash Ratio',
      formula: 'Cash & Equivalents ÷ Current Liabilities',
      value: `${cashRatio.toFixed(2)}x`,
      status: cashRatio >= 0.5 ? 'Strong' : 'Adequate',
      interpretation: 'Pure cash availability against immediate current liabilities.',
    },
    {
      category: 'Profitability',
      name: 'Gross Profit Margin',
      formula: 'Gross Profit ÷ Total Revenues',
      value: `${grossMargin.toFixed(1)}%`,
      status: grossMargin >= 40 ? 'Strong' : 'Adequate',
      interpretation: 'Percentage of revenue retained after deducting cost of goods sold.',
    },
    {
      category: 'Profitability',
      name: 'Net Profit Margin',
      formula: 'Net Operating Income ÷ Total Revenues',
      value: `${netMargin.toFixed(1)}%`,
      status: netMargin >= 15 ? 'Strong' : netMargin >= 5 ? 'Adequate' : 'Caution',
      interpretation: 'Bottom-line percentage converted into profit from every dollar earned.',
    },
    {
      category: 'Profitability',
      name: 'Return on Assets (ROA)',
      formula: 'Net Income ÷ Total Assets',
      value: `${roa.toFixed(1)}%`,
      status: roa >= 10 ? 'Strong' : 'Adequate',
      interpretation: 'Productivity of total asset base in generating operational earnings.',
    },
    {
      category: 'Profitability',
      name: 'Return on Equity (ROE)',
      formula: 'Net Income ÷ Total Equity',
      value: `${roe.toFixed(1)}%`,
      status: roe >= 15 ? 'Strong' : 'Adequate',
      interpretation: 'Yield generated on contributed owner / shareholder capital.',
    },
    {
      category: 'Solvency',
      name: 'Debt to Equity Ratio',
      formula: 'Total Liabilities ÷ Total Equity',
      value: `${debtToEquity.toFixed(1)}%`,
      status: debtToEquity <= 150 ? 'Strong' : 'Caution',
      interpretation: 'Proportion of debt financing relative to equity capital.',
    },
    {
      category: 'Solvency',
      name: 'Debt to Total Assets',
      formula: 'Total Liabilities ÷ Total Assets',
      value: `${debtToAssets.toFixed(1)}%`,
      status: debtToAssets <= 50 ? 'Strong' : 'Caution',
      interpretation: 'Percentage of company assets funded through creditor liabilities.',
    },
    {
      category: 'Solvency',
      name: 'Equity Multiplier',
      formula: 'Total Assets ÷ Total Equity',
      value: `${equityMultiplier.toFixed(2)}x`,
      status: 'Adequate',
      interpretation: 'Financial leverage multiplier measuring asset backing per unit of equity.',
    },
    {
      category: 'Efficiency',
      name: 'Asset Turnover Ratio',
      formula: 'Total Revenues ÷ Total Assets',
      value: `${assetTurnover.toFixed(2)}x`,
      status: assetTurnover >= 1.0 ? 'Strong' : 'Adequate',
      interpretation: 'Revenue generated per dollar invested in total assets.',
    },
    {
      category: 'Efficiency',
      name: 'Inventory Turnover',
      formula: 'COGS ÷ Inventory Balance',
      value: `${inventoryTurnover.toFixed(2)}x`,
      status: 'Adequate',
      interpretation: 'Rate at which inventory is sold and replenished over the cycle.',
    },
  ];
}

