import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderTree, 
  Plus, 
  Search, 
  Download, 
  Lock, 
  Unlock,
  Trash2,
  ChevronRight, 
  X, 
  Calendar,
  AlertTriangle,
  AlertCircle,
  FileText,
  Filter
} from 'lucide-react';
import { Account, AccountType, AccountSubtype, CompanyProfile, JournalEntry, NormalBalance } from '../types';
import { calculateAccountBalances, formatCurrency } from '../services/accountingEngine';
import { generateAccountLedgerPDF } from '../utils/pdfExport';

interface ChartOfAccountsViewProps {
  company: CompanyProfile;
  accounts: Account[];
  journalEntries: JournalEntry[];
  onAddAccount: (acc: Omit<Account, 'id' | 'companyId'>) => void;
  onDeleteAccount: (accountId: string) => void;
  onToggleLockAccount: (accountId: string) => void;
}

// Function to auto-calculate organized, fixed account codes based on classification
function getNextClassificationCode(
  type: AccountType,
  subtype: AccountSubtype,
  existingAccounts: Account[]
): string {
  let baseNumber = 1010;
  if (type === 'Asset') {
    if (subtype === 'Cash & Bank') baseNumber = 1010;
    else if (subtype === 'Accounts Receivable') baseNumber = 1100;
    else if (subtype === 'Inventory') baseNumber = 1200;
    else if (subtype === 'Prepaid Assets' || subtype === 'Prepaid Expenses') baseNumber = 1300;
    else if (subtype === 'Property, Plant & Equipment') baseNumber = 1500;
    else baseNumber = 1400;
  } else if (type === 'Liability') {
    if (subtype === 'Accounts Payable') baseNumber = 2010;
    else if (subtype === 'Accrued Expenses') baseNumber = 2020;
    else if (subtype === 'Unearned Revenue') baseNumber = 2030;
    else if (subtype === 'Long Term Payable') baseNumber = 2500;
    else baseNumber = 2040;
  } else if (type === 'Equity') {
    baseNumber = 3010;
  } else if (type === 'Revenue') {
    baseNumber = 4010;
  } else if (type === 'Expense') {
    if (subtype === 'Cost of Goods Sold') baseNumber = 5010;
    else if (subtype === 'Payroll Expense') baseNumber = 6010;
    else if (subtype === 'Rent & Utilities') baseNumber = 6100;
    else baseNumber = 6200;
  }

  // Find all existing codes in this primary type
  const typeCodes = existingAccounts
    .filter((a) => a.type === type)
    .map((a) => parseInt(a.code, 10))
    .filter((n) => !isNaN(n));

  if (typeCodes.length === 0) {
    return String(baseNumber);
  }

  // If baseNumber is already taken, increment by 10
  let proposed = baseNumber;
  while (typeCodes.includes(proposed)) {
    proposed += 10;
  }

  return String(proposed);
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({
  company,
  accounts,
  journalEntries,
  onAddAccount,
  onDeleteAccount,
  onToggleLockAccount,
}) => {
  const [activeCategory, setActiveCategory] = useState<'All' | AccountType>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<Account | null>(null);

  // Deletion state
  const [accountToDelete, setAccountToDelete] = useState<{ account: Account; txCount: number } | null>(null);
  const [lockedWarningModal, setLockedWarningModal] = useState<string | null>(null);

  // Account Ledger Date Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Account Form State
  const [newType, setNewType] = useState<AccountType>('Expense');
  const [newSubtype, setNewSubtype] = useState<AccountSubtype>('Operating Expense');
  const [newNormalBalance, setNewNormalBalance] = useState<NormalBalance>('Debit');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Auto calculate and fix the code whenever type or subtype changes
  useEffect(() => {
    const code = getNextClassificationCode(newType, newSubtype, accounts);
    setNewCode(code);
  }, [newType, newSubtype, accounts, isAddModalOpen]);

  const balances = calculateAccountBalances(accounts, journalEntries);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (!acc) return false;
      if (activeCategory !== 'All' && acc.type !== activeCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCode = (acc.code || '').includes(term);
        const matchName = (acc.name || '').toLowerCase().includes(term);
        const matchSubtype = (acc.subtype || '').toLowerCase().includes(term);
        return matchCode || matchName || matchSubtype;
      }
      return true;
    });
  }, [accounts, activeCategory, searchTerm]);

  const handleTypeSelect = (type: AccountType) => {
    setNewType(type);
    if (type === 'Asset') {
      setNewNormalBalance('Debit');
      setNewSubtype('Cash & Bank');
    } else if (type === 'Liability') {
      setNewNormalBalance('Credit');
      setNewSubtype('Accounts Payable');
    } else if (type === 'Equity') {
      setNewNormalBalance('Credit');
      setNewSubtype('Owner Equity');
    } else if (type === 'Revenue') {
      setNewNormalBalance('Credit');
      setNewSubtype('Operating Revenue');
    } else {
      setNewNormalBalance('Debit');
      setNewSubtype('Operating Expense');
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    onAddAccount({
      code: newCode.trim(),
      name: newName.trim(),
      type: newType,
      subtype: newSubtype,
      normalBalance: newNormalBalance,
      description: newDescription.trim() || undefined,
      isActive: true,
      isLocked: false,
    });

    setIsAddModalOpen(false);
    setNewName('');
    setNewDescription('');
  };

  const handleDeleteRequest = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    if (acc.isLocked) {
      setLockedWarningModal(`Account "${acc.code} - ${acc.name}" is currently locked. Please unlock it first using the lock button if you intend to delete it.`);
      return;
    }

    // Count transactions using this account
    let txCount = 0;
    journalEntries.forEach((je) => {
      je.lines.forEach((l) => {
        if (l.accountId === acc.id) txCount++;
      });
    });

    setAccountToDelete({ account: acc, txCount });
  };

  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;
    onDeleteAccount(accountToDelete.account.id);
    setAccountToDelete(null);
  };

  // Compute Account Ledger Activity with Date Filter
  const ledgerData = useMemo(() => {
    if (!selectedAccountForLedger) return null;

    const accId = selectedAccountForLedger.id;
    const isDebitNormal = selectedAccountForLedger.normalBalance === 'Debit';

    let openingBalance = 0;
    const matchingLines: {
      date: string;
      entryNumber: string;
      description: string;
      memo: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }[] = [];

    // Sort all entries chronologically
    const sortedEntries = [...journalEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let cumulativeBalance = 0;

    sortedEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountId === accId) {
          const deb = Number(line.debit) || 0;
          const cred = Number(line.credit) || 0;
          const netChange = isDebitNormal ? deb - cred : cred - deb;

          const isBeforeStart = startDate && entry.date < startDate;
          const isAfterEnd = endDate && entry.date > endDate;

          if (isBeforeStart) {
            openingBalance += netChange;
            cumulativeBalance += netChange;
          } else if (!isAfterEnd) {
            cumulativeBalance += netChange;
            matchingLines.push({
              date: entry.date,
              entryNumber: entry.entryNumber,
              description: entry.description,
              memo: line.memo || '',
              debit: deb,
              credit: cred,
              runningBalance: cumulativeBalance,
            });
          }
        }
      });
    });

    const totalDebits = matchingLines.reduce((acc, row) => acc + row.debit, 0);
    const totalCredits = matchingLines.reduce((acc, row) => acc + row.credit, 0);
    const endingBalance = cumulativeBalance;

    return {
      openingBalance,
      rows: matchingLines,
      totalDebits,
      totalCredits,
      endingBalance,
    };
  }, [selectedAccountForLedger, journalEntries, startDate, endDate]);

  const handleDownloadLedgerPDF = () => {
    if (!selectedAccountForLedger || !ledgerData) return;

    let dateRangeText = 'All Dates';
    if (startDate && endDate) {
      dateRangeText = `${startDate} to ${endDate}`;
    } else if (startDate) {
      dateRangeText = `From ${startDate}`;
    } else if (endDate) {
      dateRangeText = `Up to ${endDate}`;
    }

    generateAccountLedgerPDF({
      company,
      account: selectedAccountForLedger,
      dateRangeText,
      openingBalance: ledgerData.openingBalance,
      rows: ledgerData.rows,
      totalDebits: ledgerData.totalDebits,
      totalCredits: ledgerData.totalCredits,
      endingBalance: ledgerData.endingBalance,
    });
  };

  // Date filter presets
  const setFilterPreset = (preset: 'all' | 'month' | 'quarter' | 'year') => {
    const now = new Date();
    const year = now.getFullYear();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'month') {
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${monthStr}-01`);
      setEndDate(`${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const qStartMonth = String(currentQuarter * 3 + 1).padStart(2, '0');
      const qEndMonth = currentQuarter * 3 + 3;
      const lastDay = new Date(year, qEndMonth, 0).getDate();
      setStartDate(`${year}-${qStartMonth}-01`);
      setEndDate(`${year}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'year') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Chart of Accounts (COA)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hierarchical general ledger account architecture for <span className="font-semibold text-slate-700">{company?.name || 'Active Entity'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          {(['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeCategory === cat
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat === 'All' ? 'All Accounts' : `${cat}s`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search code, title, or category..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="bg-slate-100/80 px-5 py-3 border-b border-slate-200 grid grid-cols-12 gap-3 text-xs font-bold text-slate-700">
          <span className="col-span-2">Account Code</span>
          <span className="col-span-3">Account Title</span>
          <span className="col-span-2">Subtype</span>
          <span className="col-span-1">Normal</span>
          <span className="col-span-2 text-right">Net Balance ({company.currencySymbol})</span>
          <span className="col-span-2 text-center">Controls</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredAccounts.map((acc) => {
            const bal = balances.get(acc.id)?.netBalance || 0;
            const isLocked = !!acc.isLocked;

            return (
              <div
                key={acc.id}
                onClick={() => {
                  setSelectedAccountForLedger(acc);
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-5 py-3.5 grid grid-cols-12 gap-3 text-xs items-center hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="col-span-2 flex items-center space-x-2">
                  <span className="font-mono-num font-bold text-slate-900">{acc.code}</span>
                  {isLocked && (
                    <span title="Account Locked" className="text-amber-600 bg-amber-50 p-0.5 rounded">
                      <Lock className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="col-span-3">
                  <span className="font-semibold text-slate-900 block truncate">{acc.name}</span>
                  {acc.description && (
                    <span className="text-[11px] text-slate-400 truncate block">{acc.description}</span>
                  )}
                </div>

                <div className="col-span-2">
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {acc.subtype}
                  </span>
                </div>

                <div className="col-span-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      acc.normalBalance === 'Debit'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {acc.normalBalance}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <span className="font-mono-num font-bold text-slate-900 text-sm">
                    {formatCurrency(bal, company.currencySymbol)}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {/* Adjustable Lock / Unlock Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLockAccount(acc.id);
                    }}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                      isLocked
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                    }`}
                    title={isLocked ? 'Account is Locked. Click to Unlock.' : 'Account is Unlocked. Click to Lock.'}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-700" />
                        <span className="text-[10px]">Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px]">Unlock</span>
                      </>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRequest(e, acc)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors ml-1" />
                </div>
              </div>
            );
          })}

          {filteredAccounts.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400">
              No accounts match the selected criteria.
            </div>
          )}
        </div>
      </div>

      {/* Account Ledger Drilldown Modal with PDF Download & Date Filter */}
      {selectedAccountForLedger && ledgerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono-num font-bold text-emerald-400 text-base">
                    {selectedAccountForLedger.code}
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {selectedAccountForLedger.name}
                  </h3>
                  {selectedAccountForLedger.isLocked && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                      Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  General Ledger Statement • {selectedAccountForLedger.type} ({selectedAccountForLedger.subtype}) • Normal Balance: {selectedAccountForLedger.normalBalance}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadLedgerPDF}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAccountForLedger(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Date Filtering Bar */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Filter Dates:</span>

                <div className="flex items-center space-x-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    title="Start Date"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    title="End Date"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setFilterPreset('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                    !startDate && !endDate
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPreset('month')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPreset('quarter')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  This Quarter
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPreset('year')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  This Year
                </button>
              </div>
            </div>

            {/* Ledger Content Area */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 grid grid-cols-12 gap-2 text-xs font-bold text-slate-700">
                  <span className="col-span-2">Date</span>
                  <span className="col-span-2">Entry #</span>
                  <span className="col-span-4">Description / Details</span>
                  <span className="col-span-2 text-right">Debit ({company.currencySymbol})</span>
                  <span className="col-span-2 text-right">Credit ({company.currencySymbol})</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Beginning / Opening Balance Row */}
                  <div className="px-4 py-2.5 grid grid-cols-12 gap-2 text-xs items-center bg-slate-50/70 italic text-slate-600">
                    <span className="col-span-2 font-mono-num">—</span>
                    <span className="col-span-2 font-mono-num">—</span>
                    <span className="col-span-4 font-semibold text-slate-700">
                      Opening Balance {startDate ? `as of ${startDate}` : '(Period Start)'}
                    </span>
                    <span className="col-span-2 text-right font-mono-num">—</span>
                    <span className="col-span-2 text-right font-mono-num font-bold text-slate-900">
                      {formatCurrency(ledgerData.openingBalance, company.currencySymbol)}
                    </span>
                  </div>

                  {ledgerData.rows.map((row, idx) => (
                    <div key={idx} className="px-4 py-2.5 grid grid-cols-12 gap-2 text-xs items-center hover:bg-slate-50/80">
                      <span className="col-span-2 text-slate-600 font-mono-num">{row.date}</span>
                      <span className="col-span-2 font-mono-num font-semibold text-slate-800">
                        {row.entryNumber}
                      </span>
                      <span className="col-span-4 text-slate-700 truncate">
                        {row.description} {row.memo ? `• ${row.memo}` : ''}
                      </span>
                      <span className="col-span-2 text-right font-mono-num font-semibold text-slate-900">
                        {row.debit > 0 ? formatCurrency(row.debit, company.currencySymbol) : '—'}
                      </span>
                      <span className="col-span-2 text-right font-mono-num font-semibold text-slate-900">
                        {row.credit > 0 ? formatCurrency(row.credit, company.currencySymbol) : '—'}
                      </span>
                    </div>
                  ))}

                  {ledgerData.rows.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No posted activity found for this account within the selected period.
                    </div>
                  )}
                </div>

                {/* Net Ending Balance Footer */}
                <div className="bg-slate-100/90 px-4 py-3 border-t border-slate-200 grid grid-cols-12 gap-2 items-center text-xs">
                  <span className="col-span-4 font-bold text-slate-800 uppercase tracking-wider">
                    Period Activity Totals:
                  </span>
                  <div className="col-span-4 text-slate-500">
                    {ledgerData.rows.length} Transaction(s)
                  </div>
                  <span className="col-span-2 text-right font-mono-num font-bold text-slate-900">
                    {formatCurrency(ledgerData.totalDebits, company.currencySymbol)}
                  </span>
                  <span className="col-span-2 text-right font-mono-num font-bold text-slate-900">
                    {formatCurrency(ledgerData.totalCredits, company.currencySymbol)}
                  </span>
                </div>

                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Ending Running Balance:
                  </span>
                  <span className="text-base font-bold font-mono-num text-emerald-400">
                    {formatCurrency(ledgerData.endingBalance, company.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Preview matches the official PDF export format.
              </span>
              <button
                type="button"
                onClick={() => setSelectedAccountForLedger(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Warning Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="text-base font-bold tracking-tight">Delete Account from COA</h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="p-1.5 text-rose-200 hover:text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                <p className="font-bold text-sm text-rose-950">
                  {accountToDelete.account.code} - {accountToDelete.account.name}
                </p>
                <p>Classification: {accountToDelete.account.type} • {accountToDelete.account.subtype}</p>
                <p>Normal Balance: {accountToDelete.account.normalBalance}</p>
              </div>

              {accountToDelete.txCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Active Journal Entries Detected ({accountToDelete.txCount})</span>
                  </div>
                  <p className="leading-relaxed">
                    This account is referenced in <strong>{accountToDelete.txCount} recorded journal entry line(s)</strong>.
                    Deleting this account will remove it from future selections, but historical ledger postings will retain their code.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete this account? It currently has no recorded journal entries and can be removed safely.
                </p>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAccountToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAccount}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
                >
                  Confirm Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Locked Account Warning Modal */}
      {lockedWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Account is Locked</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {lockedWarningModal}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setLockedWarningModal(null)}
                  className="w-full px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal - Account Code Fixed & Read-only, Organized by Classification */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold tracking-tight">Create Chart of Accounts Record</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Classification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => handleTypeSelect(e.target.value as AccountType)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="Asset">Asset (1000s)</option>
                    <option value="Liability">Liability (2000s)</option>
                    <option value="Equity">Equity (3000s)</option>
                    <option value="Revenue">Revenue (4000s)</option>
                    <option value="Expense">Expense (5000s - 6000s)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Code (Fixed & Organized)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newCode}
                      readOnly
                      className="w-full text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 cursor-not-allowed select-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-600 uppercase bg-slate-200 px-1.5 py-0.5 rounded">
                      Fixed
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Organized sequentially by classification.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Name / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Client Travel & Hospitality"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subtype Classification
                  </label>
                  <select
                    value={newSubtype}
                    onChange={(e) => setNewSubtype(e.target.value as AccountSubtype)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {newType === 'Asset' && (
                      <>
                        <option value="Cash & Bank">Cash & Bank</option>
                        <option value="Accounts Receivable">Accounts Receivable</option>
                        <option value="Inventory">Inventory</option>
                        <option value="Prepaid Assets">Prepaid Assets</option>
                        <option value="Property, Plant & Equipment">Property, Plant & Equipment</option>
                        <option value="Other Asset">Other Asset</option>
                      </>
                    )}
                    {newType === 'Liability' && (
                      <>
                        <option value="Accounts Payable">Accounts Payable</option>
                        <option value="Long Term Payable">Long Term Payable</option>
                        <option value="Accrued Expenses">Accrued Expenses</option>
                        <option value="Unearned Revenue">Unearned Revenue</option>
                      </>
                    )}
                    {newType === 'Equity' && (
                      <>
                        <option value="Owner Equity">Owner Equity</option>
                        <option value="Retained Earnings">Retained Earnings</option>
                      </>
                    )}
                    {newType === 'Revenue' && (
                      <>
                        <option value="Operating Revenue">Operating Revenue</option>
                        <option value="Other Income">Other Income</option>
                      </>
                    )}
                    {newType === 'Expense' && (
                      <>
                        <option value="Operating Expense">Operating Expense</option>
                        <option value="Cost of Goods Sold">Cost of Goods Sold</option>
                        <option value="Payroll Expense">Payroll Expense</option>
                        <option value="Rent & Utilities">Rent & Utilities</option>
                        <option value="Professional Services">Professional Services</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Normal Balance
                  </label>
                  <select
                    value={newNormalBalance}
                    onChange={(e) => setNewNormalBalance(e.target.value as NormalBalance)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="Debit">Debit (Dr)</option>
                    <option value="Credit">Credit (Cr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Purpose (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Guidelines for posting to this account..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm transition-all"
                >
                  Save to Chart of Accounts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
