import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Info, 
  BookOpen 
} from 'lucide-react';
import { Account, BalanceSheetReport, CompanyProfile, IncomeStatementReport } from '../types';
import { formatCurrency, buildNotesToFSData } from '../services/accountingEngine';

interface NotesToFSViewProps {
  company: CompanyProfile;
  accounts: Account[];
  balanceSheet: BalanceSheetReport;
  incomeStatement: IncomeStatementReport;
  dateRangeText: string;
}

export const NotesToFSView: React.FC<NotesToFSViewProps> = ({
  company,
  accounts,
  balanceSheet,
  incomeStatement,
  dateRangeText,
}) => {
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>({});

  const toggleNote = (id: string) => {
    setCollapsedNotes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const currencySymbol = company.currencySymbol || '$';

  // Build the Notes to Financial Statements using centralized engine
  const notes = buildNotesToFSData(company, accounts, balanceSheet, incomeStatement);

  return (
    <div className="space-y-6">
      {/* Intro Header Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Notes to the Financial Statements (Notes to FS)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Detailed breakdown of significant accounting policies, account balances, composition breakdown, and specific disclosures supporting the Statement of Financial Position and Statement of Comprehensive Income.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs self-start sm:self-auto">
          Period: {dateRangeText}
        </div>
      </div>

      {/* Notes Accordion / Cards List */}
      <div className="space-y-4">
        {notes.map((note) => {
          const isCollapsed = !!collapsedNotes[note.id];

          return (
            <div
              key={note.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-shadow hover:shadow-sm"
            >
              {/* Note Header Banner */}
              <div
                onClick={() => toggleNote(note.id)}
                className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer bg-slate-50/70 hover:bg-slate-100/60 transition-colors border-b border-slate-100"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {note.noteNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {note.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {note.policySummary}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  {note.total !== 0 && (
                    <span className="text-xs font-bold font-mono-num text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                      {formatCurrency(note.total, currencySymbol)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 p-1 rounded"
                    aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Note Body Content */}
              {!isCollapsed && (
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Accounting Policy / Explanation Box */}
                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-900 mb-1">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      <span>Accounting Policy & Narrative Disclosure:</span>
                    </div>
                    {note.description}
                  </div>

                  {/* Composition Breakdown Table (if accounts exist) */}
                  {note.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 grid grid-cols-12 gap-2 text-xs font-bold text-slate-700">
                        <span className="col-span-2">Account Code</span>
                        <span className="col-span-3">Account Title</span>
                        <span className="col-span-2">Classification</span>
                        <span className="col-span-3">Description / Accounting Role</span>
                        <span className="col-span-2 text-right">Balance ({currencySymbol})</span>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white text-xs">
                        {note.items.map((acc) => {
                          const percentOfNote = note.total > 0 && acc.balance > 0
                            ? ((acc.balance / note.total) * 100).toFixed(1) 
                            : null;

                          return (
                            <div
                              key={acc.code}
                              className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/60 transition-colors"
                            >
                              <span className="col-span-2 font-mono-num font-bold text-slate-900">
                                {acc.code}
                              </span>
                              <span className="col-span-3 font-semibold text-slate-800">
                                {acc.name}
                              </span>
                              <span className="col-span-2 text-slate-500">
                                {acc.subtype}
                              </span>
                              <span className="col-span-3 text-slate-600 text-[11px] leading-tight">
                                {acc.detail}
                              </span>
                              <div className="col-span-2 text-right">
                                <span className="font-mono-num font-bold text-slate-900 block">
                                  {formatCurrency(acc.balance, currencySymbol)}
                                </span>
                                {percentOfNote && Number(percentOfNote) > 0 && (
                                  <span className="text-[10px] text-slate-400">
                                    {percentOfNote}% of group
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Footer Row */}
                      {note.totalLabel && (
                        <div className="bg-slate-100/90 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-950">
                          <span>{note.totalLabel}</span>
                          <span className="font-mono-num text-sm border-b-2 border-slate-950 pb-0.5">
                            {formatCurrency(note.total, currencySymbol)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
