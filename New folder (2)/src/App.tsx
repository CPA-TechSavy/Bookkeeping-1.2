/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CompanyProfile, 
  Account, 
  JournalEntry, 
  Transaction, 
  TransactionType 
} from './types';
import { 
  initStorage, 
  getCompanies, 
  saveCompany, 
  deleteCompany, 
  getAccounts, 
  saveAccount, 
  updateAccount,
  deleteAccount,
  getJournalEntries, 
  saveJournalEntry, 
  deleteJournalEntry, 
  getTransactions, 
  saveTransaction, 
  deleteTransaction, 
  exportCompanyData, 
  importCompanyData, 
  resetToDefaultData 
} from './services/storage';
import { initialCompanies } from './services/defaultData';
import { 
  createInvoiceJournalEntry, 
  createBillJournalEntry, 
  createExpenseJournalEntry, 
  createPaymentJournalEntry 
} from './services/accountingEngine';
import { Header } from './components/Header';
import { CompanyModal } from './components/CompanyModal';
import { JournalModal } from './components/JournalModal';
import { TransactionModal } from './components/TransactionModal';
import { DashboardView } from './components/DashboardView';
import { JournalEntriesView } from './components/JournalEntriesView';
import { TransactionsView } from './components/TransactionsView';
import { ChartOfAccountsView } from './components/ChartOfAccountsView';
import { FinancialReportsView } from './components/FinancialReportsView';
import { InventoryView } from './components/InventoryView';
import { CompanyProfileView } from './components/CompanyProfileView';
import { ShieldCheck, CheckCircle2, DollarSign, X, Plus } from 'lucide-react';

export default function App() {
  // State with lazy initialization to prevent undefined company on first render tick
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    const loaded = getCompanies();
    return loaded.length > 0 ? loaded : initialCompanies;
  });
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const loaded = getCompanies();
    return loaded[0]?.id || initialCompanies[0]?.id || '';
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Modals
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyProfile | null>(null);

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [viewingJournalEntry, setViewingJournalEntry] = useState<JournalEntry | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>('Invoice');

  // Payment Recording State
  const [paymentTx, setPaymentTx] = useState<Transaction | null>(null);
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>('');

  // 1. Initialize data on startup
  useEffect(() => {
    initStorage();
    const loadedCompanies = getCompanies();
    setCompanies(loadedCompanies.length > 0 ? loadedCompanies : initialCompanies);
    if (loadedCompanies.length > 0) {
      setActiveCompanyId((prev) => (prev && loadedCompanies.some((c) => c.id === prev) ? prev : loadedCompanies[0].id));
    }
  }, []);

  // 2. Load isolated records whenever activeCompanyId changes
  useEffect(() => {
    if (!activeCompanyId) return;
    const loadedAccounts = getAccounts(activeCompanyId);
    const loadedJournals = getJournalEntries(activeCompanyId);
    const loadedTx = getTransactions(activeCompanyId);

    setAccounts(loadedAccounts);
    setJournalEntries(loadedJournals);
    setTransactions(loadedTx);
  }, [activeCompanyId]);

  const activeCompany: CompanyProfile =
    companies.find((c) => c && c.id === activeCompanyId) || companies[0] || initialCompanies[0];

  // Refresh current company's data
  const refreshCompanyData = (compId: string = activeCompanyId) => {
    setAccounts(getAccounts(compId));
    setJournalEntries(getJournalEntries(compId));
    setTransactions(getTransactions(compId));
  };

  // Switch Entity
  const handleSelectCompany = (compId: string) => {
    setActiveCompanyId(compId);
  };

  // Save / Update Company
  const handleSaveCompany = (companyData: Omit<CompanyProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCompany) {
      const updated: CompanyProfile = {
        ...editingCompany,
        ...companyData,
        updatedAt: new Date().toISOString(),
      };
      saveCompany(updated);
      const updatedCompanies = getCompanies();
      setCompanies(updatedCompanies);
      setEditingCompany(null);
    } else {
      const newId = `comp-${Date.now()}`;
      const newCompany: CompanyProfile = {
        ...companyData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveCompany(newCompany);
      const updatedCompanies = getCompanies();
      setCompanies(updatedCompanies);
      setActiveCompanyId(newId);
    }
    setIsCompanyModalOpen(false);
  };

  // Delete Company
  const handleDeleteCompany = (compId: string) => {
    if (companies.length <= 1) {
      return;
    }
    const nextId = deleteCompany(compId);
    const updatedCompanies = getCompanies();
    setCompanies(updatedCompanies);
    if (activeCompanyId === compId) {
      setActiveCompanyId(nextId);
      refreshCompanyData(nextId);
    }
  };

  // Post Journal Entry
  const handleSaveJournalEntry = (entryData: Omit<JournalEntry, 'id' | 'companyId' | 'createdAt'>) => {
    if (!activeCompanyId) return;
    const newEntry: JournalEntry = {
      ...entryData,
      id: `je-${Date.now()}`,
      companyId: activeCompanyId,
      createdAt: new Date().toISOString(),
    };
    saveJournalEntry(newEntry);
    setJournalEntries(getJournalEntries(activeCompanyId));
    setIsJournalModalOpen(false);
  };

  // Delete Journal Entry
  const handleDeleteJournalEntry = (entryId: string) => {
    if (!activeCompanyId) return;
    deleteJournalEntry(activeCompanyId, entryId);
    setJournalEntries(getJournalEntries(activeCompanyId));
  };

  // Create Operational Transaction (Invoice / Bill / Expense)
  const handleSaveTransaction = (
    txData: Omit<Transaction, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
    autoPostToGL: boolean
  ) => {
    if (!activeCompanyId) return;
    const newTxId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      ...txData,
      id: newTxId,
      companyId: activeCompanyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveTransaction(newTx);

    // Auto-generate double-entry journal posting if requested
    if (autoPostToGL) {
      let journal: JournalEntry | null = null;
      if (newTx.type === 'Invoice') {
        journal = createInvoiceJournalEntry(newTx, accounts);
      } else if (newTx.type === 'Bill') {
        journal = createBillJournalEntry(newTx, accounts);
      } else if (newTx.type === 'Expense') {
        journal = createExpenseJournalEntry(newTx, accounts);
      }

      if (journal) {
        saveJournalEntry(journal);
        newTx.linkedJournalEntryId = journal.id;
        saveTransaction(newTx);
      }
    }

    refreshCompanyData();
    setIsTransactionModalOpen(false);
  };

  // Prompt Mark as Paid / Receive Payment
  const handleOpenPaymentPrompt = (tx: Transaction) => {
    const cashAccounts = accounts.filter((a) => a.subtype === 'Cash & Bank');
    if (cashAccounts.length > 0) {
      setSelectedCashAccountId(cashAccounts[0].id);
    }
    setPaymentTx(tx);
  };

  // Confirm Payment & Post Double-Entry to GL
  const handleConfirmPayment = () => {
    if (!paymentTx || !selectedCashAccountId || !activeCompanyId) return;

    // Update Transaction Status
    const updatedTx: Transaction = {
      ...paymentTx,
      status: 'Paid',
      updatedAt: new Date().toISOString(),
    };
    saveTransaction(updatedTx);

    // Auto post Payment / Receipt Journal Entry
    const paymentJournal = createPaymentJournalEntry(updatedTx, accounts, selectedCashAccountId);
    if (paymentJournal) {
      saveJournalEntry(paymentJournal);
    }

    refreshCompanyData();
    setPaymentTx(null);
  };

  // Add Account to Chart of Accounts
  const handleAddAccount = (accData: Omit<Account, 'id' | 'companyId'>) => {
    if (!activeCompanyId) return;
    const newAcc: Account = {
      ...accData,
      id: `acc-${Date.now()}`,
      companyId: activeCompanyId,
    };
    saveAccount(newAcc);
    setAccounts(getAccounts(activeCompanyId));
  };

  // Delete Account from Chart of Accounts
  const handleDeleteAccount = (accountId: string) => {
    if (!activeCompanyId) return;
    deleteAccount(activeCompanyId, accountId);
    setAccounts(getAccounts(activeCompanyId));
  };

  // Toggle Lock on Account
  const handleToggleLockAccount = (accountId: string) => {
    if (!activeCompanyId) return;
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    const updatedAcc: Account = {
      ...acc,
      isLocked: !acc.isLocked,
    };
    updateAccount(activeCompanyId, updatedAcc);
    setAccounts(getAccounts(activeCompanyId));
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    resetToDefaultData();
    const loadedCompanies = getCompanies();
    setCompanies(loadedCompanies);
    if (loadedCompanies.length > 0) {
      setActiveCompanyId(loadedCompanies[0].id);
      refreshCompanyData(loadedCompanies[0].id);
    }
  };

  if (!activeCompany) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-900">Loading Bookkeeping Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Left Sidebar Navigation */}
      <Header
        activeCompany={activeCompany}
        companies={companies}
        currentTab={currentTab}
        onSelectCompany={handleSelectCompany}
        onOpenNewCompanyModal={() => {
          setEditingCompany(null);
          setIsCompanyModalOpen(true);
        }}
        onSelectTab={setCurrentTab}
        onOpenQuickJournal={() => setIsJournalModalOpen(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header matching Design HTML */}
        <header className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {activeCompany?.name || 'Active Entity'}
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {activeCompany?.entityType || 'Corporate'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Entity ID: #{activeCompany?.taxId || activeCompany?.id?.substring(0, 8).toUpperCase() || 'ENT-01'} • Isolated Vault Active • {activeCompany?.accountingMethod || 'Accrual'} Basis
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingCompany(null);
                setIsCompanyModalOpen(true);
              }}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium shadow-xs text-slate-800 transition-colors"
            >
              Add Entity
            </button>
            <button
              type="button"
              onClick={() => setIsJournalModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium shadow-md transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          </div>
        </header>

        {/* Views Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              company={activeCompany}
              accounts={accounts}
              journalEntries={journalEntries}
              transactions={transactions}
              companies={companies}
              onOpenNewJournal={() => setIsJournalModalOpen(true)}
              onOpenNewTransaction={(type) => {
                setTransactionModalType(type);
                setIsTransactionModalOpen(true);
              }}
              onNavigateTab={setCurrentTab}
              onSelectEntry={(entry) => {
                setViewingJournalEntry(entry);
                setIsJournalModalOpen(true);
              }}
            />
          )}

          {currentTab === 'journals' && (
            <JournalEntriesView
              company={activeCompany}
              accounts={accounts}
              journalEntries={journalEntries}
              onOpenNewJournal={() => {
                setViewingJournalEntry(null);
                setIsJournalModalOpen(true);
              }}
              onDeleteJournal={handleDeleteJournalEntry}
              onSelectEntry={(entry) => {
                setViewingJournalEntry(entry);
                setIsJournalModalOpen(true);
              }}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsView
              company={activeCompany}
              accounts={accounts}
              transactions={transactions}
              onOpenNewTransaction={(type) => {
                setTransactionModalType(type);
                setIsTransactionModalOpen(true);
              }}
              onMarkAsPaid={handleOpenPaymentPrompt}
            />
          )}

          {currentTab === 'accounts' && (
            <ChartOfAccountsView
              company={activeCompany}
              accounts={accounts}
              journalEntries={journalEntries}
              onAddAccount={handleAddAccount}
              onDeleteAccount={handleDeleteAccount}
              onToggleLockAccount={handleToggleLockAccount}
            />
          )}

          {currentTab === 'reports' && (
            <FinancialReportsView
              company={activeCompany}
              accounts={accounts}
              journalEntries={journalEntries}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              company={activeCompany}
              accounts={accounts}
              journalEntries={journalEntries}
              transactions={transactions}
              onSaveJournalEntry={handleSaveJournalEntry}
              onRefreshData={() => {
                if (activeCompany) {
                  setJournalEntries(getJournalEntries(activeCompany.id));
                  setAccounts(getAccounts(activeCompany.id));
                }
              }}
            />
          )}

          {currentTab === 'company' && (
            <CompanyProfileView
              activeCompany={activeCompany}
              companies={companies}
              onSelectCompany={handleSelectCompany}
              onEditCompany={(comp) => {
                setEditingCompany(comp);
                setIsCompanyModalOpen(true);
              }}
              onOpenNewCompanyModal={() => {
                setEditingCompany(null);
                setIsCompanyModalOpen(true);
              }}
              onDeleteCompany={handleDeleteCompany}
              onResetDefaults={handleResetDefaults}
            />
          )}
        </main>

        {/* Persistent Data Isolation Notice Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-3 px-6 text-xs text-slate-500 no-print">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">
                Active Entity: {activeCompany?.name || 'Active Entity'} ({activeCompany?.taxId || 'N/A'})
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-700 font-medium">
                Data Isolation: Namespace #{activeCompany?.id || 'default'}
              </span>
            </div>

            <div className="text-[11px] text-slate-400">
              Double-Entry Accounting Verified • {activeCompany?.accountingMethod || 'Accrual'} Basis
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {isCompanyModalOpen && (
        <CompanyModal
          isOpen={isCompanyModalOpen}
          initialData={editingCompany || undefined}
          onClose={() => {
            setIsCompanyModalOpen(false);
            setEditingCompany(null);
          }}
          onSave={handleSaveCompany}
        />
      )}

      {isJournalModalOpen && (
        <JournalModal
          isOpen={isJournalModalOpen}
          accounts={accounts}
          company={activeCompany}
          initialEntry={viewingJournalEntry}
          currencySymbol={activeCompany.currencySymbol}
          onClose={() => {
            setIsJournalModalOpen(false);
            setViewingJournalEntry(null);
          }}
          onSave={handleSaveJournalEntry}
        />
      )}

      {isTransactionModalOpen && (
        <TransactionModal
          isOpen={isTransactionModalOpen}
          company={activeCompany}
          defaultType={transactionModalType}
          accounts={accounts}
          companyCurrency={activeCompany.currencySymbol}
          defaultTaxRate={activeCompany.defaultTaxRate}
          onClose={() => setIsTransactionModalOpen(false)}
          onSave={handleSaveTransaction}
        />
      )}

      {/* Payment Confirmation Modal */}
      {paymentTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold tracking-tight">
                  {paymentTx.type === 'Invoice' ? 'Receive Invoice Payment' : 'Pay Vendor Bill'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentTx(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-700 block">
                  {paymentTx.number} • {paymentTx.contactName}
                </span>
                <span className="text-lg font-bold font-mono-num text-slate-900 block">
                  {activeCompany.currencySymbol}{paymentTx.amount.toFixed(2)}
                </span>
                <p className="text-[11px] text-slate-500">{paymentTx.description}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Deposit / Payment Bank Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCashAccountId}
                  onChange={(e) => setSelectedCashAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium text-slate-800"
                >
                  {accounts
                    .filter((a) => a.subtype === 'Cash & Bank')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} • {a.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  A balanced journal entry will be automatically posted to your general ledger reconciling cash and {paymentTx.type === 'Invoice' ? 'Accounts Receivable' : 'Accounts Payable'}.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentTx(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm transition-all"
                >
                  Confirm & Post to Ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
