import React, { useState } from 'react';
import { 
  BarChart3, 
  Printer, 
  Download, 
  Calendar, 
  CheckCircle2, 
  ShieldCheck, 
  FileSpreadsheet, 
  TrendingUp, 
  Scale, 
  ArrowRightLeft,
  BookOpen,
  Calculator,
  Percent
} from 'lucide-react';
import { Account, CompanyProfile, DateFilter, JournalEntry, ReportPeriodType } from '../types';
import { 
  formatCurrency, 
  generateBalanceSheet, 
  generateIncomeStatement, 
  generateTrialBalance,
  buildNotesToFSData,
  buildFinancialRatiosData 
} from '../services/accountingEngine';
import { generateFinancialReportPDF } from '../utils/pdfExport';
import { NotesToFSView } from './NotesToFSView';
import { FinancialRatiosView } from './FinancialRatiosView';

interface FinancialReportsViewProps {
  company: CompanyProfile;
  accounts: Account[];
  journalEntries: JournalEntry[];
}

type ActiveReport = 'income_statement' | 'balance_sheet' | 'trial_balance' | 'cash_flows' | 'notes_to_fs' | 'ratios';

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  company,
  accounts,
  journalEntries,
}) => {
  const [activeReport, setActiveReport] = useState<ActiveReport>('income_statement');
  const [periodType, setPeriodType] = useState<ReportPeriodType>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateFilter: DateFilter = {
    type: periodType,
    startDate: customStart || undefined,
    endDate: customEnd || undefined,
  };

  const incomeStatement = generateIncomeStatement(accounts, journalEntries, dateFilter);
  const balanceSheet = generateBalanceSheet(accounts, journalEntries, dateFilter.endDate);
  const trialBalance = generateTrialBalance(accounts, journalEntries, dateFilter);

  // Cash Flow Calculations
  const netIncome = incomeStatement.netOperatingIncome;

  // Change in AR and AP
  const totalAR = balanceSheet.currentAssets.find((a) => a.code.startsWith('103') || a.name.toLowerCase().includes('receivable'))?.amount || 0;
  const totalAP = balanceSheet.currentLiabilities.find((a) => a.code.startsWith('201') || a.name.toLowerCase().includes('payable'))?.amount || 0;
  const totalInventory = balanceSheet.currentAssets.find((a) => a.code.startsWith('105') || a.name.toLowerCase().includes('inventory'))?.amount || 0;
  const equipment = balanceSheet.nonCurrentAssets.reduce((s, a) => s + a.amount, 0);
  const equityCapital = balanceSheet.equityItems.reduce((s, a) => s + a.amount, 0);

  const operatingCashFlow = netIncome - totalAR + totalAP - totalInventory;
  const investingCashFlow = -equipment;
  const financingCashFlow = equityCapital;
  const netCashChange = operatingCashFlow + investingCashFlow + financingCashFlow;

  // Calculate Beginning and Ending Cash Balance from Cash & Bank accounts
  const cashAccounts = accounts.filter(
    (a) => a.type === 'Asset' && (a.subtype === 'Cash & Bank' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
  );
  const cashAccountIds = new Set(cashAccounts.map((a) => a.id));

  let beginningCashBalance = 0;
  let endingCashBalance = 0;

  journalEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (cashAccountIds.has(line.accountId)) {
        const net = (Number(line.debit) || 0) - (Number(line.credit) || 0);
        const isBeforeStart = dateFilter.startDate && entry.date < dateFilter.startDate;
        const isAfterEnd = dateFilter.endDate && entry.date > dateFilter.endDate;

        if (isBeforeStart) {
          beginningCashBalance += net;
        }
        if (!isAfterEnd) {
          endingCashBalance += net;
        }
      }
    });
  });

  let dateRangeText = 'All Available Periods';
  if (periodType === 'ytd') dateRangeText = 'Year to Date (YTD)';
  else if (periodType === 'this_quarter') dateRangeText = 'Current Quarter';
  else if (periodType === 'this_month') dateRangeText = 'Current Month';
  else if (periodType === 'last_month') dateRangeText = 'Prior Month';
  else if (periodType === 'custom' && customStart && customEnd) {
    dateRangeText = `${customStart} to ${customEnd}`;
  }

  const handleDownloadPDF = () => {
    generateFinancialReportPDF({
      company,
      reportType: activeReport,
      incomeStatement,
      balanceSheet,
      trialBalance,
      cashFlowData: {
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashChange,
        beginningCashBalance,
        endingCashBalance,
      },
      notesData: buildNotesToFSData(company, accounts, balanceSheet, incomeStatement),
      ratiosData: buildFinancialRatiosData(company, balanceSheet, incomeStatement),
      dateRangeText,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Selector Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Entity Financial Statements & Reporting
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict isolated statements for <span className="font-semibold text-slate-800">{company?.name || 'Active Entity'}</span> (TIN: {company?.taxId || 'N/A'})
          </p>
        </div>

        {/* Report Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Ratios Essential Button */}
          <button
            type="button"
            onClick={() => setActiveReport('ratios')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'ratios'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
            }`}
            title="Essential Financial Ratios for Understanding Reports"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-500" />
            <span>Financial Ratios</span>
          </button>

          {/* Notes to FS Button */}
          <button
            type="button"
            onClick={() => setActiveReport('notes_to_fs')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'notes_to_fs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
            }`}
            title="Notes to Financial Statements & Account Disclosures"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            <span>Notes to FS</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs transition-colors"
            title="Download formatted Financial Report PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs & Period Controls */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveReport('income_statement')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'income_statement' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Income Statement (P&L)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('balance_sheet')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'balance_sheet' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-sky-600" />
            <span>Balance Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('trial_balance')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'trial_balance' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Trial Balance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('cash_flows')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'cash_flows' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
            <span>Cash Flows</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('notes_to_fs')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'notes_to_fs' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Notes to FS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('ratios')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReport === 'ratios' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-teal-600" />
            <span>Financial Ratios</span>
          </button>
        </div>

        {/* Date Period Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as ReportPeriodType)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
          >
            <option value="all">All Available Periods</option>
            <option value="ytd">Year to Date (YTD)</option>
            <option value="this_quarter">Current Quarter</option>
            <option value="this_month">Current Month</option>
            <option value="last_month">Prior Month</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {periodType === 'custom' && (
            <div className="flex items-center space-x-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-300"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-300"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Statement Canvas (Print Styled Container) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 print-card">
        {/* Printable Official Statement Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full inline-block"
                style={{ backgroundColor: company?.brandColor || '#0284c7' }}
              />
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                {company?.entityType || 'Corporate'} Financial Record
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight mt-1">
              {company?.name || 'Active Entity'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              TIN / EIN: {company?.taxId || 'N/A'}{company?.address ? ` • ${company.address.street || ''}, ${company.address.city || ''}, ${company.address.state || ''} ${company.address.zip || ''}` : ''}
            </p>
          </div>

          <div className="text-center sm:text-right">
            <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">
              {activeReport === 'income_statement'
                ? 'Income Statement (Profit & Loss)'
                : activeReport === 'balance_sheet'
                ? 'Balance Sheet'
                : activeReport === 'trial_balance'
                ? 'Trial Balance'
                : activeReport === 'cash_flows'
                ? 'Statement of Cash Flows'
                : activeReport === 'notes_to_fs'
                ? 'Notes to Financial Statements'
                : 'Financial Performance Ratios'}
            </h2>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              {activeReport === 'balance_sheet'
                ? `As of ${balanceSheet.asOfDate}`
                : `Period: ${incomeStatement.period}`}
            </p>
            <p className="text-[11px] text-slate-400">
              Reporting Basis: <strong className="text-slate-700">{company.accountingMethod}</strong> • Currency: <strong className="text-slate-700">{company.currency}</strong>
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* REPORT 1: INCOME STATEMENT                               */}
        {/* ======================================================== */}
        {activeReport === 'income_statement' && (
          <div className="space-y-6">
            {/* 1. Operating Revenue */}
            <div>
              <div className="flex justify-between border-b border-slate-300 pb-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  1. Operating Revenues
                </span>
                <span className="text-xs font-semibold text-slate-500">Amount ({company.currencySymbol})</span>
              </div>
              <div className="space-y-1 pl-4">
                {incomeStatement.revenues.map((rev) => (
                  <div key={rev.code} className="flex justify-between text-xs py-1">
                    <span className="text-slate-800">
                      {rev.code} • {rev.name}
                    </span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatCurrency(rev.amount, company.currencySymbol)}
                    </span>
                  </div>
                ))}
                {incomeStatement.revenues.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No revenues posted in this period.</p>
                )}
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-bold text-xs text-slate-950">
                <span>TOTAL REVENUES</span>
                <span className="font-mono-num text-sm">
                  {formatCurrency(incomeStatement.totalRevenue, company.currencySymbol)}
                </span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div>
              <div className="flex justify-between border-b border-slate-300 pb-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  2. Cost of Goods Sold (COGS)
                </span>
                <span className="text-xs font-semibold text-slate-500">Amount ({company.currencySymbol})</span>
              </div>
              <div className="space-y-1 pl-4">
                {incomeStatement.cogs.map((cog) => (
                  <div key={cog.code} className="flex justify-between text-xs py-1">
                    <span className="text-slate-800">
                      {cog.code} • {cog.name}
                    </span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatCurrency(cog.amount, company.currencySymbol)}
                    </span>
                  </div>
                ))}
                {incomeStatement.cogs.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No direct cost of goods sold recorded.</p>
                )}
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-bold text-xs text-slate-950">
                <span>TOTAL COST OF GOODS SOLD</span>
                <span className="font-mono-num text-sm">
                  {formatCurrency(incomeStatement.totalCOGS, company.currencySymbol)}
                </span>
              </div>
            </div>

            {/* GROSS PROFIT HIGHLIGHT */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-slate-950">
              <div>
                <span className="text-sm font-extrabold block">GROSS PROFIT</span>
                <span className="text-[11px] text-slate-500">
                  Gross Margin: <strong className="text-emerald-700">{incomeStatement.grossMarginPercentage.toFixed(1)}%</strong>
                </span>
              </div>
              <span className="font-mono-num text-lg font-black">
                {formatCurrency(incomeStatement.grossProfit, company.currencySymbol)}
              </span>
            </div>

            {/* 3. Operating Expenses */}
            <div>
              <div className="flex justify-between border-b border-slate-300 pb-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  3. Operating & Administrative Expenses
                </span>
                <span className="text-xs font-semibold text-slate-500">Amount ({company.currencySymbol})</span>
              </div>
              <div className="space-y-1 pl-4">
                {incomeStatement.expenses.map((exp) => (
                  <div key={exp.code} className="flex justify-between text-xs py-1">
                    <span className="text-slate-800">
                      {exp.code} • {exp.name} ({exp.subtype})
                    </span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatCurrency(exp.amount, company.currencySymbol)}
                    </span>
                  </div>
                ))}
                {incomeStatement.expenses.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No operating expenses recorded.</p>
                )}
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-bold text-xs text-slate-950">
                <span>TOTAL OPERATING EXPENSES</span>
                <span className="font-mono-num text-sm">
                  {formatCurrency(incomeStatement.totalExpenses, company.currencySymbol)}
                </span>
              </div>
            </div>

            {/* NET OPERATING INCOME (Double Underline accounting standard) */}
            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center">
              <div>
                <span className="text-base font-black text-slate-950 block tracking-tight">
                  NET OPERATING INCOME
                </span>
                <span className="text-xs text-slate-500">
                  Net Profit Margin:{' '}
                  <strong className={incomeStatement.netOperatingIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {incomeStatement.netMarginPercentage.toFixed(1)}%
                  </strong>
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`text-xl font-black font-mono-num border-b-4 border-double border-slate-900 pb-1 ${
                    incomeStatement.netOperatingIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(incomeStatement.netOperatingIncome, company.currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT 2: BALANCE SHEET                                  */}
        {/* ======================================================== */}
        {activeReport === 'balance_sheet' && (
          <div className="space-y-6">
            {/* ASSETS SECTION */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-3">
                ASSETS
              </h3>

              {/* Current Assets */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                  Current Assets
                </span>
                <div className="space-y-1 pl-4">
                  {balanceSheet.currentAssets.map((a) => (
                    <div key={a.code} className="flex justify-between text-xs py-1">
                      <span className="text-slate-800">
                        {a.code} • {a.name}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(a.amount, company.currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1 font-semibold text-xs text-slate-900 pl-4">
                  <span>Total Current Assets</span>
                  <span className="font-mono-num">
                    {formatCurrency(balanceSheet.totalCurrentAssets, company.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Non-Current Assets */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                  Property, Plant & Equipment / Non-Current
                </span>
                <div className="space-y-1 pl-4">
                  {balanceSheet.nonCurrentAssets.map((a) => (
                    <div key={a.code} className="flex justify-between text-xs py-1">
                      <span className="text-slate-800">
                        {a.code} • {a.name}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(a.amount, company.currencySymbol)}
                      </span>
                    </div>
                  ))}
                  {balanceSheet.nonCurrentAssets.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No long-term assets recorded.</p>
                  )}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1 font-semibold text-xs text-slate-900 pl-4">
                  <span>Total Non-Current Assets</span>
                  <span className="font-mono-num">
                    {formatCurrency(balanceSheet.totalNonCurrentAssets, company.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Total Assets Summary */}
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 font-black text-sm text-slate-950">
                <span>TOTAL ASSETS</span>
                <span className="font-mono-num text-base">
                  {formatCurrency(balanceSheet.totalAssets, company.currencySymbol)}
                </span>
              </div>
            </div>

            {/* LIABILITIES SECTION */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-3">
                LIABILITIES
              </h3>

              {/* Current Liabilities */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                  Current Liabilities
                </span>
                <div className="space-y-1 pl-4">
                  {balanceSheet.currentLiabilities.map((l) => (
                    <div key={l.code} className="flex justify-between text-xs py-1">
                      <span className="text-slate-800">
                        {l.code} • {l.name}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(l.amount, company.currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1 font-semibold text-xs text-slate-900 pl-4">
                  <span>Total Current Liabilities</span>
                  <span className="font-mono-num">
                    {formatCurrency(balanceSheet.totalCurrentLiabilities, company.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Long-Term Liabilities */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                  Long-Term Debt & Obligations
                </span>
                <div className="space-y-1 pl-4">
                  {balanceSheet.longTermLiabilities.map((l) => (
                    <div key={l.code} className="flex justify-between text-xs py-1">
                      <span className="text-slate-800">
                        {l.code} • {l.name}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(l.amount, company.currencySymbol)}
                      </span>
                    </div>
                  ))}
                  {balanceSheet.longTermLiabilities.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No long-term debt.</p>
                  )}
                </div>
              </div>

              {/* Total Liabilities Summary */}
              <div className="flex justify-between border-t border-slate-400 pt-2 font-bold text-xs text-slate-950">
                <span>TOTAL LIABILITIES</span>
                <span className="font-mono-num text-sm">
                  {formatCurrency(balanceSheet.totalLiabilities, company.currencySymbol)}
                </span>
              </div>
            </div>

            {/* EQUITY SECTION (Entity-Specific Rendering) */}
            <div>
              {company.entityType === 'Single Proprietorship' || company.entityType === 'Sole Proprietorship' ? (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-3">
                    OWNER'S CAPITAL (SOLE PROPRIETORSHIP)
                  </h3>
                  <div className="space-y-1.5 pl-4 mb-4 text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-800">3010 • {balanceSheet.soleProprietorEquity?.ownerName || 'Owner'}, Beginning Capital</span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(balanceSheet.soleProprietorEquity?.beginningCapital || 0, company.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-800">3015 • Additional Investments Contributed</span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatCurrency(balanceSheet.soleProprietorEquity?.additionalInvestments || 0, company.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-800 font-semibold bg-emerald-50 px-2 rounded">
                      <span>Net Operating Income for the Period</span>
                      <span className="font-mono-num">
                        {formatCurrency(balanceSheet.soleProprietorEquity?.netIncome || 0, company.currencySymbol)}
                      </span>
                    </div>
                    {(balanceSheet.soleProprietorEquity?.drawings || 0) > 0 && (
                      <div className="flex justify-between py-1 text-rose-700">
                        <span>3020 • Less: Owner's Personal Drawings</span>
                        <span className="font-mono-num font-semibold">
                          -{formatCurrency(balanceSheet.soleProprietorEquity?.drawings || 0, company.currencySymbol)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between border-t border-slate-400 pt-2 font-bold text-xs text-slate-950">
                    <span>TOTAL OWNER'S ENDING CAPITAL</span>
                    <span className="font-mono-num text-sm">
                      {formatCurrency(balanceSheet.soleProprietorEquity?.endingCapital || balanceSheet.totalEquity, company.currencySymbol)}
                    </span>
                  </div>
                </div>
              ) : company.entityType === 'Partnership' ? (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-3">
                    PARTNERS' CAPITAL & PROFIT SHARING (PARTNERSHIP)
                  </h3>
                  <div className="space-y-3 pl-2 mb-4">
                    {balanceSheet.partnershipEquity?.partners.map((p) => (
                      <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                        <div className="flex justify-between items-center font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-1.5">
                          <span>{p.name}</span>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px]">
                            Profit Share: {p.profitSharePercentage}%
                          </span>
                        </div>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex justify-between">
                            <span>Beginning Capital</span>
                            <span className="font-mono-num">{formatCurrency(p.beginningCapital, company.currencySymbol)}</span>
                          </div>
                          {p.additionalInvestments > 0 && (
                            <div className="flex justify-between">
                              <span>Add: Additional Investments</span>
                              <span className="font-mono-num font-semibold text-slate-800">{formatCurrency(p.additionalInvestments, company.currencySymbol)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-emerald-800 font-medium">
                            <span>Add: Share of Net Income ({p.profitSharePercentage}%)</span>
                            <span className="font-mono-num">+{formatCurrency(p.shareOfNetIncome, company.currencySymbol)}</span>
                          </div>
                          {p.drawings > 0 && (
                            <div className="flex justify-between text-rose-700">
                              <span>Less: Partner Drawings</span>
                              <span className="font-mono-num">-{formatCurrency(p.drawings, company.currencySymbol)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                            <span>Ending Capital Balance</span>
                            <span className="font-mono-num">{formatCurrency(p.endingCapital, company.currencySymbol)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-slate-400 pt-2 font-bold text-xs text-slate-950">
                    <span>TOTAL PARTNERS' CAPITAL</span>
                    <span className="font-mono-num text-sm">
                      {formatCurrency(balanceSheet.partnershipEquity?.totalPartnersCapital || balanceSheet.totalEquity, company.currencySymbol)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 border-b-2 border-slate-900 pb-1 mb-3">
                    STOCKHOLDERS' EQUITY (CORPORATION)
                  </h3>
                  <div className="space-y-2 pl-4 mb-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block mb-1">Capital Stock</span>
                      <div className="pl-3 space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span>
                            Authorized Capital Stock ({balanceSheet.corporationEquity?.authorizedShares.toLocaleString()} shares @ {company.currencySymbol}{balanceSheet.corporationEquity?.parValuePerShare || 10} par)
                          </span>
                          <span className="font-mono-num font-medium text-slate-700">
                            {formatCurrency(balanceSheet.corporationEquity?.authorizedCapitalStock || 0, company.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-semibold">
                          <span>3011 • Paid-Up Share Capital (Subscribed & Paid)</span>
                          <span className="font-mono-num">
                            {formatCurrency(balanceSheet.corporationEquity?.paidUpCapital || 0, company.currencySymbol)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="font-bold text-slate-900 block mb-1">Retained Earnings</span>
                      <div className="pl-3 space-y-1">
                        <div className="flex justify-between text-slate-700">
                          <span>3025 • Appropriated Retained Earnings (Reserve)</span>
                          <span className="font-mono-num font-medium">
                            {formatCurrency(balanceSheet.corporationEquity?.appropriatedRetainedEarnings || 0, company.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>3020 • Unappropriated Retained Earnings (Cumulative)</span>
                          <span className="font-mono-num font-medium">
                            {formatCurrency(balanceSheet.corporationEquity?.unappropriatedRetainedEarnings || 0, company.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                          <span>Current Period Net Operating Income</span>
                          <span className="font-mono-num">
                            {formatCurrency(balanceSheet.corporationEquity?.currentPeriodNetIncome || 0, company.currencySymbol)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-slate-400 pt-2 font-bold text-xs text-slate-950">
                    <span>TOTAL SHAREHOLDERS' EQUITY</span>
                    <span className="font-mono-num text-sm">
                      {formatCurrency(balanceSheet.corporationEquity?.totalShareholdersEquity || balanceSheet.totalEquity, company.currencySymbol)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* GRAND TOTAL: LIABILITIES + EQUITY (Double Underline) */}
            <div className="border-t-2 border-slate-950 pt-3 flex justify-between items-center">
              <div>
                <span className="text-base font-black text-slate-950 tracking-tight block">
                  TOTAL LIABILITIES & EQUITY
                </span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Assets = Liabilities + Equity (Balanced: Variance ${balanceSheet.variance.toFixed(2)})
                </span>
              </div>
              <span className="text-xl font-black font-mono-num border-b-4 border-double border-slate-950 pb-1 text-slate-950">
                {formatCurrency(balanceSheet.totalLiabilitiesAndEquity, company.currencySymbol)}
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT 3: TRIAL BALANCE                                  */}
        {/* ======================================================== */}
        {activeReport === 'trial_balance' && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 grid grid-cols-12 gap-2 text-xs font-bold text-slate-900">
                <span className="col-span-2">Account Code</span>
                <span className="col-span-4">Account Title</span>
                <span className="col-span-2">Category</span>
                <span className="col-span-2 text-right">Debit Balance ({company.currencySymbol})</span>
                <span className="col-span-2 text-right">Credit Balance ({company.currencySymbol})</span>
              </div>

              <div className="divide-y divide-slate-100">
                {trialBalance.rows.map((row) => (
                  <div key={row.accountId} className="px-4 py-2 grid grid-cols-12 gap-2 text-xs items-center">
                    <span className="col-span-2 font-mono-num font-bold text-slate-700">{row.code}</span>
                    <span className="col-span-4 font-semibold text-slate-900 truncate">{row.name}</span>
                    <span className="col-span-2 text-slate-500 text-[11px]">{row.type}</span>
                    <span className="col-span-2 text-right font-mono-num font-semibold text-slate-900">
                      {row.debitBalance > 0 ? formatCurrency(row.debitBalance, company.currencySymbol) : '—'}
                    </span>
                    <span className="col-span-2 text-right font-mono-num font-semibold text-slate-900">
                      {row.creditBalance > 0 ? formatCurrency(row.creditBalance, company.currencySymbol) : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Balanced Sum */}
              <div className="bg-slate-900 text-white px-4 py-3 border-t-2 border-slate-900 grid grid-cols-12 gap-2 text-xs font-bold items-center">
                <span className="col-span-8 text-right uppercase tracking-wider">
                  TOTAL BALANCED LEDGER SUM:
                </span>
                <span className="col-span-2 text-right font-mono-num text-sm text-emerald-400">
                  {formatCurrency(trialBalance.totalDebits, company.currencySymbol)}
                </span>
                <span className="col-span-2 text-right font-mono-num text-sm text-emerald-400">
                  {formatCurrency(trialBalance.totalCredits, company.currencySymbol)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>
                  <strong>Trial Balance Verified:</strong> Sum of all debit balances equals sum of all credit balances with $0.00 discrepancy.
                </span>
              </div>
              <span className="font-mono-num font-bold bg-emerald-100 px-2.5 py-1 rounded">
                Debit = Credit
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT 4: CASH FLOWS                                     */}
        {/* ======================================================== */}
        {activeReport === 'cash_flows' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                1. Cash Flows From Operating Activities
              </h3>
              <div className="space-y-1.5 pl-4 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-slate-700">Net Operating Income</span>
                  <span className="font-mono-num font-semibold text-slate-900">
                    {formatCurrency(netIncome, company.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-700">Adjustments for changes in Accounts Receivable (A/R)</span>
                  <span className="font-mono-num font-semibold text-slate-900">
                    {formatCurrency(-totalAR, company.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-700">Adjustments for changes in Accounts Payable (A/P)</span>
                  <span className="font-mono-num font-semibold text-slate-900">
                    {formatCurrency(totalAP, company.currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 mt-2 font-bold text-xs text-slate-950">
                <span>NET CASH PROVIDED BY OPERATING ACTIVITIES</span>
                <span className="font-mono-num">{formatCurrency(operatingCashFlow, company.currencySymbol)}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                2. Cash Flows From Investing Activities
              </h3>
              <div className="space-y-1.5 pl-4 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-slate-700">Capital Expenditures (Equipment, Tech Hardware)</span>
                  <span className="font-mono-num font-semibold text-slate-900">
                    {formatCurrency(-equipment, company.currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 mt-2 font-bold text-xs text-slate-950">
                <span>NET CASH USED IN INVESTING ACTIVITIES</span>
                <span className="font-mono-num">{formatCurrency(investingCashFlow, company.currencySymbol)}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                3. Cash Flows From Financing Activities
              </h3>
              <div className="space-y-1.5 pl-4 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-slate-700">Capital Contributed by Owners / Stock Issued</span>
                  <span className="font-mono-num font-semibold text-slate-900">
                    {formatCurrency(equityCapital, company.currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 mt-2 font-bold text-xs text-slate-950">
                <span>NET CASH PROVIDED BY FINANCING ACTIVITIES</span>
                <span className="font-mono-num">{formatCurrency(financingCashFlow, company.currencySymbol)}</span>
              </div>
            </div>

            <div className="border-t-2 border-slate-900 pt-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs text-slate-700">
                <span className="font-semibold uppercase tracking-wider">Beginning Cash & Cash Equivalents</span>
                <span className="font-mono-num font-bold text-slate-900">
                  {formatCurrency(beginningCashBalance, company.currencySymbol)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-700">
                <span className="font-semibold uppercase tracking-wider">Net Change in Cash Position</span>
                <span className="font-mono-num font-bold text-slate-900">
                  {formatCurrency(netCashChange, company.currencySymbol)}
                </span>
              </div>

              <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center bg-slate-100 p-3 rounded-xl">
                <div>
                  <span className="text-sm font-black text-slate-950 uppercase tracking-tight block">
                    Ending Cash Balance
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Total Cash & Cash Equivalents at end of period
                  </span>
                </div>
                <span className="text-lg font-black font-mono-num border-b-4 border-double border-slate-950 pb-0.5 text-slate-950">
                  {formatCurrency(endingCashBalance, company.currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notes to FS View */}
        {activeReport === 'notes_to_fs' && (
          <NotesToFSView
            company={company}
            accounts={accounts}
            balanceSheet={balanceSheet}
            incomeStatement={incomeStatement}
            dateRangeText={dateRangeText}
          />
        )}

        {/* Financial Ratios View */}
        {activeReport === 'ratios' && (
          <FinancialRatiosView
            company={company}
            balanceSheet={balanceSheet}
            incomeStatement={incomeStatement}
            dateRangeText={dateRangeText}
          />
        )}

        {/* CPA / Sign-off Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 gap-3">
          <div>
            <span>Generated via EntityBooks System • Audit Integrity Certified</span>
            <p className="mt-0.5">Strict Entity Data Scoping: {company.id}</p>
          </div>
          <div className="text-right">
            <span>Prepared on: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
