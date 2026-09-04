import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Calendar, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Filter,
  AlertTriangle,
  X,
  FileText
} from 'lucide-react';
import { Account, CompanyProfile, JournalEntry } from '../types';
import { formatCurrency } from '../services/accountingEngine';
import { generateGeneralLedgerPDF, generateSingleJournalEntryPDF } from '../utils/pdfExport';

interface JournalEntriesViewProps {
  company: CompanyProfile;
  accounts: Account[];
  journalEntries: JournalEntry[];
  onOpenNewJournal: () => void;
  onDeleteJournal: (entryId: string) => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

export const JournalEntriesView: React.FC<JournalEntriesViewProps> = ({
  company,
  accounts,
  journalEntries,
  onOpenNewJournal,
  onDeleteJournal,
  onSelectEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Date Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Delete Confirmation State
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);

  // Filter journal entries based on search and date range
  const filtered = useMemo(() => {
    return journalEntries.filter((entry) => {
      // Date filtering
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;

      // Text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesDesc = entry.description.toLowerCase().includes(term);
        const matchesNum = entry.entryNumber.toLowerCase().includes(term);
        const matchesRef = entry.reference ? entry.reference.toLowerCase().includes(term) : false;
        const matchesLine = entry.lines.some(
          (l) => l.accountName.toLowerCase().includes(term) || l.accountCode.includes(term)
        );
        return matchesDesc || matchesNum || matchesRef || matchesLine;
      }
      return true;
    });
  }, [journalEntries, searchTerm, startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedEntryId(expandedEntryId === id ? null : id);
  };

  const handleExportPDF = () => {
    let dateRangeText = 'All Dates';
    if (startDate && endDate) {
      dateRangeText = `${startDate} to ${endDate}`;
    } else if (startDate) {
      dateRangeText = `From ${startDate}`;
    } else if (endDate) {
      dateRangeText = `Up to ${endDate}`;
    }

    generateGeneralLedgerPDF({
      company,
      journalEntries: filtered,
      dateRangeText,
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

  const confirmDelete = () => {
    if (!entryToDelete) return;
    onDeleteJournal(entryToDelete.id);
    setEntryToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              General Ledger & Journal Entries
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Balanced double-entry journal postings for <span className="font-semibold text-slate-700">{company?.name || 'Active Entity'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export GL (PDF)</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewJournal}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post Journal Entry</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by entry #, reference, account code, or description..."
              className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Presets */}
          <div className="flex items-center space-x-1 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setFilterPreset('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
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
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setFilterPreset('quarter')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
            >
              This Quarter
            </button>
            <button
              type="button"
              onClick={() => setFilterPreset('year')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
            >
              This Year
            </button>
          </div>
        </div>

        {/* Precise Date Range Picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Filter Date Range:</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                title="Start Date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                title="End Date"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-rose-600 hover:underline font-semibold ml-1"
              >
                Reset Dates
              </button>
            )}
          </div>

          <span className="text-slate-500 font-medium">
            Showing <strong>{filtered.length}</strong> of <strong>{journalEntries.length}</strong> entries
          </span>
        </div>
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-200">
          {filtered.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const totalDebit = entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
            const totalCredit = entry.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
            const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

            return (
              <div key={entry.id} className="transition-colors">
                {/* Entry Summary Row */}
                <div
                  className={`p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 cursor-pointer ${
                    isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'
                  }`}
                  onClick={() => toggleExpand(entry.id)}
                >
                  <div className="flex items-start space-x-3">
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 hover:text-slate-600 p-1 rounded"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold font-mono-num text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {entry.entryNumber}
                        </span>
                        <span className="text-xs text-slate-500">• {entry.date}</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {entry.sourceType}
                        </span>
                        {entry.reference && (
                          <span className="text-[11px] font-mono-num text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            Ref: {entry.reference}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-1">{entry.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end space-x-4 pl-9 md:pl-0">
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono-num text-slate-900 block">
                        {formatCurrency(totalDebit, company.currencySymbol)}
                      </span>
                      <span className="text-[10px] text-slate-400">{entry.lines.length} debit/credit lines</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isBalanced
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isBalanced ? 'Balanced' : 'Out of Balance'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateSingleJournalEntryPDF({ company, entry });
                        }}
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Download Journal Voucher (PDF)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEntryToDelete(entry);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete journal entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed General Ledger Lines */}
                {isExpanded && (
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 animate-in fade-in duration-100">
                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                      <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 grid grid-cols-12 gap-2 text-xs font-bold text-slate-700">
                        <span className="col-span-2">Account Code</span>
                        <span className="col-span-4">Account Title</span>
                        <span className="col-span-3">Memo</span>
                        <span className="col-span-1 text-right">Debit ({company.currencySymbol})</span>
                        <span className="col-span-2 text-right">Credit ({company.currencySymbol})</span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {entry.lines.map((line, idx) => (
                          <div key={line.id || idx} className="px-4 py-2.5 grid grid-cols-12 gap-2 text-xs items-center">
                            <span className="col-span-2 font-mono-num font-semibold text-slate-600">
                              {line.accountCode}
                            </span>
                            <span className="col-span-4 font-semibold text-slate-900 truncate">
                              {line.accountName}
                            </span>
                            <span className="col-span-3 text-slate-500 italic text-[11px] truncate">
                              {line.memo || '—'}
                            </span>
                            <span className="col-span-1 text-right font-mono-num font-semibold text-slate-900">
                              {line.debit > 0 ? formatCurrency(line.debit, company.currencySymbol) : '—'}
                            </span>
                            <span className="col-span-2 text-right font-mono-num font-semibold text-slate-900">
                              {line.credit > 0 ? formatCurrency(line.credit, company.currencySymbol) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Line Totals */}
                      <div className="bg-slate-100/90 px-4 py-2.5 border-t border-slate-200 grid grid-cols-12 gap-2 text-xs font-bold text-slate-900">
                        <span className="col-span-9 text-right uppercase tracking-wider text-[11px] text-slate-600">
                          Total Entry Amount:
                        </span>
                        <span className="col-span-1 text-right font-mono-num">
                          {formatCurrency(totalDebit, company.currencySymbol)}
                        </span>
                        <span className="col-span-2 text-right font-mono-num">
                          {formatCurrency(totalCredit, company.currencySymbol)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No journal entries found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchTerm || startDate || endDate
                  ? 'Try adjusting your search query or date range filters.'
                  : 'Click "Post Journal Entry" to record your first transaction.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Journal Entry Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="text-base font-bold tracking-tight">Delete Journal Entry</h3>
              </div>
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                className="p-1.5 text-rose-200 hover:text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                <p className="font-mono font-bold text-sm text-rose-950">{entryToDelete.entryNumber}</p>
                <p>Date: {entryToDelete.date}</p>
                <p className="font-medium">{entryToDelete.description}</p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete this journal entry? Deleting this entry will reverse its posted debits and credits from the General Ledger and Trial Balance.
              </p>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEntryToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
                >
                  Yes, Delete Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
