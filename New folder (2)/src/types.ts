export type EntityType = 
  | 'Corporation' 
  | 'Sole Proprietorship'
  | 'Single Proprietorship' 
  | 'Partnership' 
  | 'Cooperative';

export type AccountingMethod = 'Accrual' | 'Cash';

export interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PartnerInfo {
  id: string;
  name: string;
  profitSharePercentage: number; // e.g. 50 (50%)
  beginningCapital?: number;
  additionalInvestment?: number;
  drawings?: number;
}

export interface CorporationInfo {
  authorizedCapitalStock: number; // Authorized Capital Stock declared amount (e.g., 1,000,000)
  parValuePerShare?: number; // e.g., 10.00
  authorizedShares?: number; // Number of authorized shares
  paidUpCapital: number; // Amount of authorized capital paid up (used as Share Capital in Equity)
  subscribedCapital?: number;
  appropriatedRetainedEarnings?: number; // E.g., Reserve for plant expansion / legal contingencies
  unappropriatedRetainedEarnings?: number; // Cumulative net income minus distributed dividends
  dividendsDeclared?: number;
}

export interface SoleProprietorInfo {
  ownerName: string;
  beginningCapital?: number;
  additionalInvestment?: number;
  drawings?: number;
}

export interface CompanyProfile {
  id: string;
  name: string;
  tradeName?: string;
  taxId: string; // EIN, TIN, or VAT number
  entityType: EntityType;
  currency: string; // e.g. 'USD', 'EUR', 'GBP', 'PHP', 'CAD', 'AUD'
  currencySymbol: string; // e.g. '$', '€', '£', '₱'
  fiscalYearEnd: string; // e.g. 'December 31'
  accountingMethod: AccountingMethod;
  email: string;
  phone: string;
  address: CompanyAddress;
  defaultTaxRate: number; // percentage
  brandColor: string; // Hex color for avatar / badge
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  establishedDate?: string; // Date legal company was established / registered (YYYY-MM-DD)

  // Entity-Specific Structural Fields
  partnershipInfo?: {
    partners: PartnerInfo[];
  };
  corporationInfo?: CorporationInfo;
  soleProprietorInfo?: SoleProprietorInfo;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export type AccountSubtype =
  // ASSETS: includes Prepaid Assets
  | 'Cash & Bank'
  | 'Accounts Receivable'
  | 'Inventory'
  | 'Prepaid Assets'
  | 'Prepaid Expenses'
  | 'Property, Plant & Equipment'
  | 'Other Asset'
  // LIABILITIES: Strictly Accounts Payable, Long Term Payable, Accrued Expenses, Unearned Revenue
  | 'Accounts Payable'
  | 'Long Term Payable'
  | 'Accrued Expenses'
  | 'Unearned Revenue'
  // Legacy aliases for backward compatibility with previous stored sessions
  | 'Credit Card'
  | 'Accrued Liabilities'
  | 'Sales Tax Payable'
  | 'Long-Term Debt'
  | 'Other Liability'
  // EQUITY
  | 'Owner Equity'
  | 'Share Capital'
  | 'Retained Earnings'
  | 'Appropriated Retained Earnings'
  | 'Unappropriated Retained Earnings'
  | 'Owner Capital'
  | 'Owner Drawings'
  | 'Partner Capital'
  | 'Partner Drawings'
  // REVENUE
  | 'Operating Revenue'
  | 'Other Income'
  // EXPENSES
  | 'Cost of Goods Sold'
  | 'Operating Expense'
  | 'Payroll Expense'
  | 'Rent & Utilities'
  | 'Professional Services'
  | 'Other Expense';

export type NormalBalance = 'Debit' | 'Credit';

export interface Account {
  id: string;
  companyId: string;
  code: string; // e.g. '1010'
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  normalBalance: NormalBalance;
  description?: string;
  isActive: boolean;
  isSystem?: boolean;
  isLocked?: boolean;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNumber: string; // e.g. 'JE-2026-001'
  date: string; // YYYY-MM-DD
  description: string;
  lines: JournalEntryLine[];
  status: 'Posted' | 'Draft';
  reference?: string;
  sourceType: 'Manual' | 'Invoice' | 'Bill' | 'Payment' | 'Opening_Balance' | 'Billing_Receipt' | 'Purchase_Receipt';
  sourceId?: string;
  createdAt: string;
}

export type PaymentMethod = 'Cash' | 'E-Wallet' | 'Check';

export type TransactionType = 
  | 'Billing_Receipt' 
  | 'Purchase_Receipt' 
  | 'Invoice' 
  | 'Bill' 
  | 'Expense' 
  | 'Payment_Received' 
  | 'Bill_Payment';

export type TransactionStatus = 'Draft' | 'Sent' | 'Paid' | 'Unpaid' | 'Overdue' | 'Void';

export interface TransactionItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  companyId: string;
  type: TransactionType;
  number: string; // e.g. 'BR-1001', 'PSR-501'
  date: string;
  dueDate?: string;
  contactName: string; // Customer or Vendor
  contactEmail?: string;
  amount: number;
  taxAmount?: number;
  status: TransactionStatus;
  categoryAccountId: string; // Revenue or Expense account
  bankAccountId?: string; // If paid directly via bank
  paymentMethod?: PaymentMethod;
  paymentReference?: string; // Reference # or account # for E-Wallet / Check
  description: string;
  items: TransactionItem[];
  linkedJournalEntryId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit: string; // e.g. 'pcs', 'units', 'boxes', 'kg'
  unitCost: number;
  unitPrice: number;
  quantityOnHand: number;
  reorderPoint: number;
  assetAccountId?: string;
  cogsAccountId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ReportPeriodType = 
  | 'all' 
  | 'this_month' 
  | 'last_month' 
  | 'this_quarter' 
  | 'ytd' 
  | 'custom';

export interface DateFilter {
  type: ReportPeriodType;
  startDate?: string;
  endDate?: string;
}

export interface AccountBalance {
  account: Account;
  totalDebits: number;
  totalCredits: number;
  netBalance: number; // calculated according to normal balance
}

export interface TrialBalanceReport {
  dateGenerated: string;
  period: string;
  rows: {
    accountId: string;
    code: string;
    name: string;
    type: AccountType;
    debitBalance: number;
    creditBalance: number;
  }[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface IncomeStatementReport {
  dateGenerated: string;
  period: string;
  revenues: { code: string; name: string; amount: number }[];
  totalRevenue: number;
  cogs: { code: string; name: string; amount: number }[];
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercentage: number;
  expenses: { code: string; name: string; amount: number; subtype: string }[];
  totalExpenses: number;
  netOperatingIncome: number;
  netMarginPercentage: number;
}

export interface BalanceSheetReport {
  dateGenerated: string;
  asOfDate: string;
  currentAssets: { code: string; name: string; amount: number }[];
  totalCurrentAssets: number;
  nonCurrentAssets: { code: string; name: string; amount: number }[];
  totalNonCurrentAssets: number;
  totalAssets: number;

  currentLiabilities: { code: string; name: string; amount: number }[];
  totalCurrentLiabilities: number;
  longTermLiabilities: { code: string; name: string; amount: number }[];
  totalLongTermLiabilities: number;
  totalLiabilities: number;

  equityItems: { code: string; name: string; amount: number }[];
  retainedEarnings: number;
  currentPeriodNetIncome: number;
  totalEquity: number;

  // Dynamic Entity-Specific Equity Breakdowns
  entityType?: EntityType;
  soleProprietorEquity?: {
    ownerName: string;
    beginningCapital: number;
    additionalInvestments: number;
    netIncome: number;
    drawings: number;
    endingCapital: number;
  };
  partnershipEquity?: {
    partners: Array<{
      id: string;
      name: string;
      profitSharePercentage: number;
      beginningCapital: number;
      additionalInvestments: number;
      shareOfNetIncome: number;
      drawings: number;
      endingCapital: number;
    }>;
    totalPartnersCapital: number;
  };
  corporationEquity?: {
    authorizedCapitalStock: number;
    parValuePerShare?: number;
    authorizedShares?: number;
    paidUpCapital: number; // Share Capital
    subscribedCapital?: number;
    appropriatedRetainedEarnings: number;
    unappropriatedRetainedEarnings: number;
    currentPeriodNetIncome: number;
    dividendsDistributed: number;
    totalRetainedEarnings: number;
    totalShareholdersEquity: number;
  };

  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  variance: number;
}
