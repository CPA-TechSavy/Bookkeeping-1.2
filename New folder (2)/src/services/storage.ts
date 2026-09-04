import { Account, CompanyProfile, InventoryItem, JournalEntry, Transaction } from '../types';
import { 
  generateStandardChartOfAccounts, 
  getInitialSeedInventoryItems, 
  getInitialSeedJournalEntries, 
  getInitialSeedTransactions, 
  initialCompanies 
} from './defaultData';

const STORAGE_KEYS = {
  COMPANIES: 'entitybooks_companies_v1',
  ACTIVE_COMPANY_ID: 'entitybooks_active_company_id_v1',
  ACCOUNTS_PREFIX: 'entitybooks_accounts_',
  JOURNALS_PREFIX: 'entitybooks_journals_',
  TRANSACTIONS_PREFIX: 'entitybooks_transactions_',
  INVENTORY_PREFIX: 'entitybooks_inventory_',
};

// Initialize default storage if empty
export function initStorage(): {
  companies: CompanyProfile[];
  activeCompanyId: string;
} {
  const existingCompaniesJson = localStorage.getItem(STORAGE_KEYS.COMPANIES);
  let companies: CompanyProfile[] = [];

  if (!existingCompaniesJson) {
    companies = [...initialCompanies];
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));

    // Seed data for each initial company
    companies.forEach((comp) => {
      const coa = generateStandardChartOfAccounts(comp.id, comp.entityType);
      localStorage.setItem(`${STORAGE_KEYS.ACCOUNTS_PREFIX}${comp.id}`, JSON.stringify(coa));

      const jes = getInitialSeedJournalEntries(comp.id);
      localStorage.setItem(`${STORAGE_KEYS.JOURNALS_PREFIX}${comp.id}`, JSON.stringify(jes));

      const txs = getInitialSeedTransactions(comp.id);
      localStorage.setItem(`${STORAGE_KEYS.TRANSACTIONS_PREFIX}${comp.id}`, JSON.stringify(txs));

      const inv = getInitialSeedInventoryItems(comp.id);
      localStorage.setItem(`${STORAGE_KEYS.INVENTORY_PREFIX}${comp.id}`, JSON.stringify(inv));
    });
  } else {
    try {
      const parsed = JSON.parse(existingCompaniesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        companies = parsed.filter(Boolean);
      } else {
        companies = [...initialCompanies];
        localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
      }
    } catch {
      companies = [...initialCompanies];
      localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
    }
  }

  let activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY_ID);
  if (!activeId || !companies.some((c) => c && c.id === activeId)) {
    activeId = companies[0]?.id || initialCompanies[0].id;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY_ID, activeId);
  }

  return { companies, activeCompanyId: activeId };
}

// Company Management
export function getCompanies(): CompanyProfile[] {
  const json = localStorage.getItem(STORAGE_KEYS.COMPANIES);
  if (!json) return initStorage().companies;
  try {
    const list = JSON.parse(json);
    if (!Array.isArray(list) || list.length === 0) {
      return initStorage().companies;
    }
    return list.filter((c) => c && c.id && c.name);
  } catch {
    return initStorage().companies;
  }
}

export function saveCompanies(companies: CompanyProfile[]): void {
  localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
}

export function getActiveCompanyId(): string {
  const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY_ID);
  if (!id) return initStorage().activeCompanyId;
  return id;
}

export function setActiveCompanyId(companyId: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY_ID, companyId);
}

export function createCompany(newProfile: Omit<CompanyProfile, 'id' | 'createdAt'>): CompanyProfile {
  const companies = getCompanies();
  const id = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullProfile: CompanyProfile = {
    ...newProfile,
    id,
    createdAt: new Date().toISOString(),
  };

  const updatedCompanies = [...companies, fullProfile];
  saveCompanies(updatedCompanies);

  // Initialize isolated Chart of Accounts for the new company
  const coa = generateStandardChartOfAccounts(id, fullProfile.entityType);
  saveAccounts(id, coa);
  saveJournalEntries(id, []);
  saveTransactions(id, []);

  // Make the new company the active company
  setActiveCompanyId(id);
  return fullProfile;
}

export function updateCompany(updatedProfile: CompanyProfile): void {
  const companies = getCompanies();
  const idx = companies.findIndex((c) => c.id === updatedProfile.id);
  if (idx !== -1) {
    companies[idx] = updatedProfile;
    saveCompanies(companies);
  }
}

export function deleteCompany(companyId: string): string {
  const companies = getCompanies();
  const filtered = companies.filter((c) => c.id !== companyId);
  saveCompanies(filtered);

  // Clean up isolated records
  localStorage.removeItem(`${STORAGE_KEYS.ACCOUNTS_PREFIX}${companyId}`);
  localStorage.removeItem(`${STORAGE_KEYS.JOURNALS_PREFIX}${companyId}`);
  localStorage.removeItem(`${STORAGE_KEYS.TRANSACTIONS_PREFIX}${companyId}`);

  let newActiveId = getActiveCompanyId();
  if (newActiveId === companyId) {
    newActiveId = filtered[0]?.id || '';
    setActiveCompanyId(newActiveId);
  }
  return newActiveId;
}

// Chart of Accounts (Per Company Isolation)
export function getAccounts(companyId: string): Account[] {
  if (!companyId) return [];
  const key = `${STORAGE_KEYS.ACCOUNTS_PREFIX}${companyId}`;
  const json = localStorage.getItem(key);
  if (!json) {
    const comp = getCompanies().find((c) => c.id === companyId);
    const coa = generateStandardChartOfAccounts(companyId, comp?.entityType || 'LLC');
    saveAccounts(companyId, coa);
    return coa;
  }
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function saveAccounts(companyId: string, accounts: Account[]): void {
  localStorage.setItem(`${STORAGE_KEYS.ACCOUNTS_PREFIX}${companyId}`, JSON.stringify(accounts));
}

export function addAccount(companyId: string, account: Omit<Account, 'id' | 'companyId'>): Account {
  const accounts = getAccounts(companyId);
  const newAccount: Account = {
    ...account,
    id: `${companyId}-acc-${account.code}-${Date.now().toString(36)}`,
    companyId,
  };
  const updated = [...accounts, newAccount].sort((a, b) => a.code.localeCompare(b.code));
  saveAccounts(companyId, updated);
  return newAccount;
}

export function updateAccount(companyId: string, account: Account): void {
  const accounts = getAccounts(companyId);
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx !== -1) {
    accounts[idx] = account;
    accounts.sort((a, b) => a.code.localeCompare(b.code));
    saveAccounts(companyId, accounts);
  }
}

export function deleteAccount(companyId: string, accountId: string): void {
  const accounts = getAccounts(companyId);
  const updated = accounts.filter((a) => a.id !== accountId);
  saveAccounts(companyId, updated);
}

// Journal Entries (Per Company Isolation)
export function getJournalEntries(companyId: string): JournalEntry[] {
  if (!companyId) return [];
  const key = `${STORAGE_KEYS.JOURNALS_PREFIX}${companyId}`;
  const json = localStorage.getItem(key);
  if (!json) return [];
  try {
    const entries: JournalEntry[] = JSON.parse(json);
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function saveJournalEntries(companyId: string, entries: JournalEntry[]): void {
  localStorage.setItem(`${STORAGE_KEYS.JOURNALS_PREFIX}${companyId}`, JSON.stringify(entries));
}

export function addJournalEntry(companyId: string, entry: Omit<JournalEntry, 'id' | 'companyId' | 'createdAt'>): JournalEntry {
  const entries = getJournalEntries(companyId);
  const newEntry: JournalEntry = {
    ...entry,
    id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    companyId,
    createdAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...entries];
  saveJournalEntries(companyId, updated);
  return newEntry;
}

export function deleteJournalEntry(companyId: string, entryId: string): void {
  const entries = getJournalEntries(companyId);
  const filtered = entries.filter((e) => e.id !== entryId);
  saveJournalEntries(companyId, filtered);
}

// Transactions (Invoices / Bills / Direct Payments)
export function getTransactions(companyId: string): Transaction[] {
  if (!companyId) return [];
  const key = `${STORAGE_KEYS.TRANSACTIONS_PREFIX}${companyId}`;
  const json = localStorage.getItem(key);
  if (!json) return [];
  try {
    const txs: Transaction[] = JSON.parse(json);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function saveTransactions(companyId: string, transactions: Transaction[]): void {
  localStorage.setItem(`${STORAGE_KEYS.TRANSACTIONS_PREFIX}${companyId}`, JSON.stringify(transactions));
}

export function addTransaction(companyId: string, transaction: Omit<Transaction, 'id' | 'companyId' | 'createdAt'>): Transaction {
  const txs = getTransactions(companyId);
  const newTx: Transaction = {
    ...transaction,
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    companyId,
    createdAt: new Date().toISOString(),
  };
  const updated = [newTx, ...txs];
  saveTransactions(companyId, updated);
  return newTx;
}

export function updateTransaction(companyId: string, transaction: Transaction): void {
  const txs = getTransactions(companyId);
  const idx = txs.findIndex((t) => t.id === transaction.id);
  if (idx !== -1) {
    txs[idx] = transaction;
    saveTransactions(companyId, txs);
  }
}

// Export / Import / Backup
export function exportActiveCompanyData(companyId: string): string {
  const comp = getCompanies().find((c) => c.id === companyId);
  const accounts = getAccounts(companyId);
  const journalEntries = getJournalEntries(companyId);
  const transactions = getTransactions(companyId);

  const payload = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    company: comp,
    accounts,
    journalEntries,
    transactions,
  };
  return JSON.stringify(payload, null, 2);
}

export function importCompanyData(jsonString: string): { success: boolean; message: string; companyId?: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data.company || !data.accounts) {
      return { success: false, message: 'Invalid file format. Missing company profile or accounts.' };
    }

    // Assign new unique ID to avoid overwriting existing
    const newId = `comp-imported-${Date.now().toString(36)}`;
    const importedProfile: CompanyProfile = {
      ...data.company,
      id: newId,
      name: `${data.company.name || 'Imported Entity'} (Restored)`,
      createdAt: new Date().toISOString(),
    };

    const companies = getCompanies();
    saveCompanies([...companies, importedProfile]);

    const accounts: Account[] = (data.accounts || []).map((acc: Account) => ({
      ...acc,
      id: acc.id.replace(data.company.id, newId),
      companyId: newId,
    }));
    saveAccounts(newId, accounts);

    const journals: JournalEntry[] = (data.journalEntries || []).map((je: JournalEntry) => ({
      ...je,
      id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: newId,
      lines: (je.lines || []).map((l) => ({
        ...l,
        accountId: l.accountId.replace(data.company.id, newId),
      })),
    }));
    saveJournalEntries(newId, journals);

    const txs: Transaction[] = (data.transactions || []).map((tx: Transaction) => ({
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: newId,
      categoryAccountId: tx.categoryAccountId ? tx.categoryAccountId.replace(data.company.id, newId) : '',
      bankAccountId: tx.bankAccountId ? tx.bankAccountId.replace(data.company.id, newId) : undefined,
    }));
    saveTransactions(newId, txs);

    setActiveCompanyId(newId);
    return { success: true, message: `Successfully restored ${importedProfile.name}`, companyId: newId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Failed to parse data: ${errorMsg}` };
  }
}

export function resetToDefaults(): void {
  localStorage.clear();
  initStorage();
}

// Convenient Aliases for App.tsx
export function saveCompany(company: CompanyProfile): void {
  const companies = getCompanies();
  const exists = companies.some((c) => c.id === company.id);
  if (exists) {
    updateCompany(company);
  } else {
    saveCompanies([...companies, company]);
    // Initialize standard COA if not yet created
    const existingAccounts = getAccounts(company.id);
    if (existingAccounts.length === 0) {
      const coa = generateStandardChartOfAccounts(company.id, company.entityType);
      saveAccounts(company.id, coa);
    }
  }
}

export function saveAccount(account: Account): void {
  const accounts = getAccounts(account.companyId);
  const exists = accounts.some((a) => a.id === account.id);
  if (exists) {
    updateAccount(account.companyId, account);
  } else {
    saveAccounts(account.companyId, [...accounts, account]);
  }
}

export function saveJournalEntry(entry: JournalEntry): void {
  const entries = getJournalEntries(entry.companyId);
  const exists = entries.some((e) => e.id === entry.id);
  if (exists) {
    const updated = entries.map((e) => (e.id === entry.id ? entry : e));
    saveJournalEntries(entry.companyId, updated);
  } else {
    saveJournalEntries(entry.companyId, [entry, ...entries]);
  }
}

export function saveTransaction(transaction: Transaction): void {
  const txs = getTransactions(transaction.companyId);
  const exists = txs.some((t) => t.id === transaction.id);
  if (exists) {
    updateTransaction(transaction.companyId, transaction);
  } else {
    saveTransactions(transaction.companyId, [transaction, ...txs]);
  }
}

export function deleteTransaction(companyId: string, transactionId: string): void {
  const txs = getTransactions(companyId);
  const filtered = txs.filter((t) => t.id !== transactionId);
  saveTransactions(companyId, filtered);
}

// Inventory Management
export function getInventoryItems(companyId: string): InventoryItem[] {
  if (!companyId) return [];
  const key = `${STORAGE_KEYS.INVENTORY_PREFIX}${companyId}`;
  const json = localStorage.getItem(key);
  if (!json) {
    const defaultInv = getInitialSeedInventoryItems(companyId);
    saveInventoryItems(companyId, defaultInv);
    return defaultInv;
  }
  try {
    const items = JSON.parse(json);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveInventoryItems(companyId: string, items: InventoryItem[]): void {
  localStorage.setItem(`${STORAGE_KEYS.INVENTORY_PREFIX}${companyId}`, JSON.stringify(items));
}

export function saveInventoryItem(item: InventoryItem): void {
  const items = getInventoryItems(item.companyId);
  const exists = items.some((i) => i.id === item.id);
  if (exists) {
    const updated = items.map((i) => (i.id === item.id ? item : i));
    saveInventoryItems(item.companyId, updated);
  } else {
    saveInventoryItems(item.companyId, [item, ...items]);
  }
}

export function deleteInventoryItem(companyId: string, itemId: string): void {
  const items = getInventoryItems(companyId);
  const filtered = items.filter((i) => i.id !== itemId);
  saveInventoryItems(companyId, filtered);
}

export const exportCompanyData = exportActiveCompanyData;
export const resetToDefaultData = resetToDefaults;
