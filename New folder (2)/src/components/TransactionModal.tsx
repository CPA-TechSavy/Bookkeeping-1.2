import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle2, Receipt, FileText, ArrowDownRight, ArrowUpRight, CreditCard } from 'lucide-react';
import { Account, CompanyProfile, Transaction, TransactionItem, TransactionType, PaymentMethod } from '../types';
import { formatCurrency } from '../services/accountingEngine';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  company?: CompanyProfile;
  onSave: (
    tx: Omit<Transaction, 'id' | 'companyId' | 'createdAt'>,
    createJournalEntry: boolean
  ) => void;
  type?: TransactionType;
  defaultType?: TransactionType;
  companyCurrency?: string;
  defaultTaxRate?: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  company,
  onSave,
  type: propType,
  defaultType = 'Invoice',
  companyCurrency,
  defaultTaxRate,
}) => {
  const companyName = company?.name || 'Active Entity';
  const activeCurrency = company?.currencySymbol || companyCurrency || '$';
  const [type, setType] = useState<TransactionType>(propType || defaultType);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [categoryAccountId, setCategoryAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [createGLPosting, setCreateGLPosting] = useState(true);

  // Filter accounts for categories
  const revenueAccounts = accounts.filter((a) => a.type === 'Revenue');
  const expenseAccounts = accounts.filter((a) => a.type === 'Expense');
  const bankAccounts = accounts.filter((a) => a.subtype === 'Cash & Bank');

  useEffect(() => {
    setType(defaultType);
    const seq = Math.floor(Math.random() * 900) + 100;
    const prefix = defaultType === 'Invoice' ? 'INV' : defaultType === 'Bill' ? 'BILL' : 'EXP';
    setNumber(`${prefix}-${new Date().getFullYear()}-${seq}`);
    setDate(new Date().toISOString().split('T')[0]);

    // Due date 30 days out for invoices & bills
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setDueDate(due.toISOString().split('T')[0]);

    setContactName('');
    setContactEmail('');
    setDescription('');
    setItems([{ id: '1', description: 'Consulting / Professional Services', quantity: 1, unitPrice: 1000, total: 1000 }]);

    if (defaultType === 'Invoice') {
      setCategoryAccountId(revenueAccounts[0]?.id || '');
    } else {
      setCategoryAccountId(expenseAccounts[0]?.id || '');
      setBankAccountId(bankAccounts[0]?.id || '');
    }
  }, [defaultType, isOpen]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const seq = Math.floor(Math.random() * 900) + 100;
    const prefix = newType === 'Invoice' ? 'INV' : newType === 'Bill' ? 'BILL' : 'EXP';
    setNumber(`${prefix}-${new Date().getFullYear()}-${seq}`);

    if (newType === 'Invoice') {
      setCategoryAccountId(revenueAccounts[0]?.id || '');
    } else {
      setCategoryAccountId(expenseAccounts[0]?.id || '');
      if (newType === 'Expense') {
        setBankAccountId(bankAccounts[0]?.id || '');
      }
    }
  };

  const handleItemChange = (index: number, field: 'description' | 'quantity' | 'unitPrice', val: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    if (field === 'description') {
      item.description = String(val);
    } else if (field === 'quantity') {
      item.quantity = Number(val) || 0;
      item.total = item.quantity * item.unitPrice;
    } else if (field === 'unitPrice') {
      item.unitPrice = Number(val) || 0;
      item.total = item.quantity * item.unitPrice;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    onSave(
      {
        type,
        number,
        date,
        dueDate: type === 'Expense' ? undefined : dueDate,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        amount: subtotal,
        status: type === 'Expense' ? 'Paid' : 'Sent',
        categoryAccountId,
        bankAccountId: type === 'Expense' ? bankAccountId : undefined,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        description: description.trim() || `${type} for ${contactName}`,
        items,
      },
      createGLPosting
    );
    onClose();
  };

  if (!isOpen) return null;

  const displayTypeTitle =
    type === 'Invoice'
      ? 'Billing Receipt (AR)'
      : type === 'Bill'
      ? 'Purchases/Services Receipt'
      : 'Purchases/Services (Direct Expense)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              {type === 'Invoice' ? <ArrowDownRight className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight">Record {displayTypeTitle}</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/20">
                  {companyName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {type === 'Invoice'
                  ? 'Bills customer & automatically debits A/R and credits Revenue'
                  : type === 'Bill'
                  ? 'Records vendor payable & credits A/P'
                  : 'Direct payment disbursed via cash, bank, or electronic wallet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Selector Pills */}
          <div className="flex space-x-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['Invoice', 'Bill', 'Expense'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  type === t
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'Invoice' ? '📄 Billing Receipt (AR)' : t === 'Bill' ? '🧾 Purchases/Services Receipt' : '💸 Direct Expense'}
              </button>
            ))}
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'Invoice' ? 'Customer / Client Name' : 'Vendor / Supplier Name'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={type === 'Invoice' ? 'e.g., Acme Global Corp' : 'e.g., Amazon Web Services'}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="billing@partner.com"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Document # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            {type !== 'Expense' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'Invoice' ? 'Revenue Category Account' : 'Expense Category Account'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryAccountId}
                onChange={(e) => setCategoryAccountId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                required
              >
                {(type === 'Invoice' ? revenueAccounts : expenseAccounts).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            {type === 'Expense' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paid From (Bank / Checking) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  required
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Check">Check</option>
                <option value="Electronic (GCash / Maya)">Electronic (GCash / Maya)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Reference # / Check #
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., Check #5402, GCash Ref #991"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Memo / Purpose Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Q1 Strategic Advisory Retainer or Cloud Server Lease"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 grid grid-cols-12 gap-3 text-xs font-bold text-slate-700">
              <span className="col-span-6">Item / Service Description</span>
              <span className="col-span-2 text-right">Quantity</span>
              <span className="col-span-2 text-right">Unit Price</span>
              <span className="col-span-2 text-right">Total ({activeCurrency})</span>
            </div>

            <div className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="Description of deliverable or expense"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full text-xs font-mono-num text-right px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full text-xs font-mono-num text-right px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-xs font-bold font-mono-num text-slate-900 w-full text-right pr-2">
                      {formatCurrency(item.total, activeCurrency)}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300/60 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-semibold mr-2">Total Amount:</span>
                <span className="text-base font-bold font-mono-num text-slate-900">
                  {formatCurrency(subtotal, activeCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* GL Auto-Posting Checkbox */}
          <div className="flex items-center space-x-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
            <input
              type="checkbox"
              id="createGLPosting"
              checked={createGLPosting}
              onChange={(e) => setCreateGLPosting(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <label htmlFor="createGLPosting" className="text-xs text-slate-800 cursor-pointer">
              <strong>Automatically post balanced double-entry journal to General Ledger:</strong>{' '}
              {type === 'Invoice'
                ? `Debit A/R (1030) ${formatCurrency(subtotal, activeCurrency)} & Credit Revenue ${formatCurrency(subtotal, activeCurrency)}`
                : type === 'Bill'
                ? `Debit Expense ${formatCurrency(subtotal, activeCurrency)} & Credit A/P (2010) ${formatCurrency(subtotal, activeCurrency)}`
                : `Debit Expense ${formatCurrency(subtotal, activeCurrency)} & Credit Cash (1010) ${formatCurrency(subtotal, activeCurrency)}`}
            </label>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm transition-all flex items-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Post {type}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
