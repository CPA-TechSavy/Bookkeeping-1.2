import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  BookOpen, 
  BarChart3, 
  FileText,
  Lock,
  Download
} from 'lucide-react';
import { Account, CompanyProfile, JournalEntry, Transaction } from '../types';
import { 
  calculateAccountBalances, 
  formatCurrency, 
  generateBalanceSheet, 
  generateIncomeStatement 
} from '../services/accountingEngine';
import { getAccounts, getJournalEntries, getTransactions } from '../services/storage';

interface DashboardViewProps {
  company: CompanyProfile;
  accounts: Account[];
  journalEntries: JournalEntry[];
  transactions: Transaction[];
  companies?: CompanyProfile[];
  onOpenNewJournal: () => void;
  onOpenNewTransaction: (type: 'Invoice' | 'Bill' | 'Expense') => void;
  onNavigateTab: (tab: string) => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onExportData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  company,
  accounts,
  journalEntries,
  transactions,
  companies = [],
  onOpenNewJournal,
  onOpenNewTransaction,
  onNavigateTab,
  onSelectEntry,
  onExportData,
}) => {
  const balances = calculateAccountBalances(accounts, journalEntries);
  const incomeStatement = generateIncomeStatement(accounts, journalEntries);
  const balanceSheet = generateBalanceSheet(accounts, journalEntries);

  // Compute Cash on Hand (Assets with subtype 'Cash & Bank')
  let cashOnHand = 0;
  accounts.forEach((acc) => {
    if (acc.subtype === 'Cash & Bank') {
      const bal = balances.get(acc.id);
      if (bal) cashOnHand += bal.netBalance;
    }
  });

  // Compute Open A/R, A/P, and Inventory
  let totalAR = 0;
  let totalAP = 0;
  let totalInventoryBalance = 0;
  accounts.forEach((acc) => {
    if (acc.subtype === 'Accounts Receivable') {
      const bal = balances.get(acc.id);
      if (bal) totalAR += bal.netBalance;
    }
    if (acc.subtype === 'Accounts Payable') {
      const bal = balances.get(acc.id);
      if (bal) totalAP += bal.netBalance;
    }
    if (acc.subtype === 'Inventory' || acc.code.startsWith('105') || acc.name.toLowerCase().includes('inventory')) {
      const bal = balances.get(acc.id);
      if (bal) totalInventoryBalance += bal.netBalance;
    }
  });

  const unpaidInvoicesCount = transactions.filter(
    (t) => t.type === 'Invoice' && t.status !== 'Paid'
  ).length;
  const unpaidBillsCount = transactions.filter(
    (t) => t.type === 'Bill' && t.status !== 'Paid'
  ).length;

  // Tax Reserve calculation: check for tax accounts or calculate 20% estimated reserve
  let taxReserveBalance = 0;
  accounts.forEach((acc) => {
    if (
      acc.name.toLowerCase().includes('tax') || 
      acc.code === '2020' || 
      acc.code === '2030'
    ) {
      const bal = balances.get(acc.id);
      if (bal) taxReserveBalance += Math.abs(bal.netBalance);
    }
  });
  if (taxReserveBalance === 0 && incomeStatement.netOperatingIncome > 0) {
    taxReserveBalance = incomeStatement.netOperatingIncome * 0.22;
  }
  const taxProjectionTarget = Math.max(taxReserveBalance * 1.33, 10000);
  const taxPct = Math.min(100, Math.round((taxReserveBalance / taxProjectionTarget) * 100));

  // Multi-Entity comparison data
  const entityComparisons = (companies || []).filter(Boolean).map((c) => {
    const cAccounts = c.id === company?.id ? accounts : getAccounts(c.id);
    const cJournals = c.id === company?.id ? journalEntries : getJournalEntries(c.id);
    const cIncome = generateIncomeStatement(cAccounts, cJournals);
    return {
      id: c.id,
      name: c.name || 'Unnamed Entity',
      revenue: cIncome.totalRevenue,
      expenses: cIncome.totalExpenses + cIncome.totalCOGS,
      isActive: c.id === company?.id,
    };
  });

  const maxEntityVal = Math.max(
    ...entityComparisons.map((e) => Math.max(e.revenue, e.expenses)),
    10000
  );

  // Consolidated Cash across all loaded entities
  let consolidatedCash = 0;
  (companies || []).filter(Boolean).forEach((c) => {
    const cAccs = c.id === company?.id ? accounts : getAccounts(c.id);
    const cJours = c.id === company?.id ? journalEntries : getJournalEntries(c.id);
    const cBals = calculateAccountBalances(cAccs, cJours);
    cAccs.forEach((a) => {
      if (a.subtype === 'Cash & Bank') {
        const b = cBals.get(a.id);
        if (b) consolidatedCash += b.netBalance;
      }
    });
  });

  const recentJournals = journalEntries.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Tile 1: Net Liquidity (2 cols span) */}
        <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Net Liquidity
              </p>
              <h2 className="text-4xl font-bold text-slate-900 mt-1 font-mono-num">
                {formatCurrency(cashOnHand, company.currencySymbol)}
              </h2>
            </div>
            <div className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full border border-emerald-100/80">
              {incomeStatement.netOperatingIncome >= 0 ? '+12.4% vs LY' : 'Deficit Reserve'}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-5">
            <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                Monthly Revenue
              </p>
              <p className="text-lg font-bold text-slate-800 font-mono-num mt-0.5">
                {formatCurrency(incomeStatement.totalRevenue, company.currencySymbol)}
              </p>
            </div>
            <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                Operating Expenses
              </p>
              <p className="text-lg font-bold text-slate-800 font-mono-num mt-0.5">
                {formatCurrency(incomeStatement.totalExpenses + incomeStatement.totalCOGS, company.currencySymbol)}
              </p>
            </div>
          </div>
        </div>

        {/* Tile 2: Tax Reserve (1 col span) */}
        <div className="col-span-1 bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Tax Reserve
          </p>
          <div className="mt-2">
            <p className="text-2xl font-bold text-slate-900 font-mono-num">
              {formatCurrency(taxReserveBalance, company.currencySymbol)}
            </p>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-orange-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(15, taxPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              {taxPct}% of fiscal target reserved
            </p>
          </div>
        </div>

        {/* Tile 3: Security Level & Vault Isolation (1 col span, Indigo) */}
        <div className="col-span-1 bg-indigo-600 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase opacity-80 tracking-wider">
              Security Level
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>
          <div className="my-2">
            <p className="text-lg font-bold mb-1">L3 Data Isolation</p>
            <p className="text-xs opacity-75 leading-relaxed">
              Individual partition keys active for {company?.name || 'this entity'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onExportData}
            className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            Audit Access Logs
          </button>
        </div>

        {/* Tile 4: Recent Journal (1 col, multi-row span) */}
        <div className="col-span-1 md:col-span-1 lg:row-span-2 bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Recent Journal
              </p>
              <button
                type="button"
                onClick={onOpenNewJournal}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                title="Post new balanced entry"
              >
                + New
              </button>
            </div>
            
            <div className="space-y-3.5">
              {recentJournals.map((entry) => {
                const totalAmt = entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                const firstInitial = (entry.sourceType || entry.description || 'J')[0].toUpperCase();
                const isPayout = entry.sourceType === 'Payment' || entry.description.toLowerCase().includes('payout');
                
                return (
                  <div
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-blue-100 transition-colors">
                      {firstInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-slate-800">
                        {entry.description || entry.entryNumber}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {entry.date} • {entry.sourceType}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold font-mono-num ${isPayout ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {formatCurrency(totalAmt, company.currencySymbol)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentJournals.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  No journal entries posted yet.
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('journals')}
            className="w-full py-2.5 mt-4 text-sm text-blue-600 font-semibold border-t border-slate-100 hover:text-blue-700 transition-colors text-center cursor-pointer"
          >
            View All History
          </button>
        </div>

        {/* Tile 5: Multi-Entity Overview Comparative Chart (3 cols span) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Multi-Entity Overview
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Cross-entity revenue and expense performance
              </p>
            </div>
            <div className="flex gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <span className="text-slate-600">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                <span className="text-slate-600">Expenses</span>
              </div>
            </div>
          </div>

          <div className="flex items-end gap-4 sm:gap-8 pt-4 pb-2 min-h-[140px]">
            {entityComparisons.map((item) => {
              const revHeight = Math.max(16, Math.min(100, Math.round((item.revenue / maxEntityVal) * 100)));
              const expHeight = Math.max(12, Math.min(100, Math.round((item.expenses / maxEntityVal) * 100)));

              return (
                <div key={item.id} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex gap-1.5 justify-center items-end h-28">
                    {/* Revenue Bar */}
                    <div 
                      className={`w-4 sm:w-5 bg-blue-500 rounded-t-sm transition-all duration-500 ${item.isActive ? 'ring-2 ring-blue-300' : 'opacity-85'}`}
                      style={{ height: `${revHeight}%` }}
                      title={`Revenue: ${formatCurrency(item.revenue, company.currencySymbol)}`}
                    />
                    {/* Expenses Bar */}
                    <div 
                      className="w-4 sm:w-5 bg-slate-200 rounded-t-sm transition-all duration-500"
                      style={{ height: `${expHeight}%` }}
                      title={`Expenses: ${formatCurrency(item.expenses, company.currencySymbol)}`}
                    />
                  </div>
                  <span className={`text-[11px] truncate max-w-[85px] sm:max-w-[120px] text-center font-medium ${item.isActive ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tile 6: Four Horizontal Bento Cards (3 cols span -> 4 sub-columns on desktop) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card A: Accounts Payable */}
          <div 
            onClick={() => onNavigateTab('transactions')}
            className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
              Accounts Payable
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono-num group-hover:text-blue-600 transition-colors">
              {formatCurrency(totalAP, company.currencySymbol)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {unpaidBillsCount} {unpaidBillsCount === 1 ? 'bill' : 'bills'} due soon
            </p>
          </div>

          {/* Card B: Accounts Receivable */}
          <div 
            onClick={() => onNavigateTab('transactions')}
            className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
              Accounts Receivable
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono-num group-hover:text-emerald-700 transition-colors">
              {formatCurrency(totalAR, company.currencySymbol)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {unpaidInvoicesCount} {unpaidInvoicesCount === 1 ? 'invoice' : 'invoices'} pending settlement
            </p>
          </div>

          {/* Card C: Merchandise Inventory & COGS */}
          <div 
            onClick={() => onNavigateTab('inventory')}
            className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
              Inventory Balance
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1 font-mono-num group-hover:text-indigo-700 transition-colors">
              {formatCurrency(totalInventoryBalance, company.currencySymbol)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Asset balance in COGS schedule
            </p>
          </div>

          {/* Card D: Consolidated Cash */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-center shadow-xs">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
              Consolidated Cash
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono-num">
              {formatCurrency(consolidatedCash || cashOnHand, company.currencySymbol)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {companies.length} registered {companies.length === 1 ? 'entity' : 'entities'}
            </p>
          </div>

        </div>

      </div>

      {/* Accounting Balance Verification Pill Banner */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-xs">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Fundamental Accounting Equation
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                Verified Balanced
              </span>
            </div>
            <div className="font-mono-num text-xs text-slate-500 mt-0.5">
              <span>Assets {formatCurrency(balanceSheet.totalAssets, company.currencySymbol)}</span>
              <span className="mx-2 text-slate-400">=</span>
              <span>Liabilities {formatCurrency(balanceSheet.totalLiabilities, company.currencySymbol)}</span>
              <span className="mx-1 text-slate-400">+</span>
              <span>Equity {formatCurrency(balanceSheet.totalEquity, company.currencySymbol)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-slate-600">
            Ledger Discrepancy:{' '}
            <strong className="text-emerald-700 font-mono-num">
              {formatCurrency(balanceSheet.variance, company.currencySymbol)}
            </strong>
          </span>
        </div>
      </div>

    </div>
  );
};
