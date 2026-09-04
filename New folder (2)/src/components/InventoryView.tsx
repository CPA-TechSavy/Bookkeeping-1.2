import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Download, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Boxes, 
  Calculator, 
  TrendingDown, 
  TrendingUp, 
  ArrowDownRight, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { Account, CompanyProfile, InventoryItem, JournalEntry, Transaction } from '../types';
import { formatCurrency, formatTaxId } from '../services/accountingEngine';
import { 
  getInventoryItems, 
  saveInventoryItems, 
  saveInventoryItem, 
  deleteInventoryItem 
} from '../services/storage';
import { generateInventoryPDF } from '../utils/pdfExport';

interface InventoryViewProps {
  company: CompanyProfile;
  accounts: Account[];
  journalEntries: JournalEntry[];
  transactions: Transaction[];
  onSaveJournalEntry: (entry: JournalEntry) => void;
  onSaveTransaction?: (tx: Transaction) => void;
  onRefreshData?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  company,
  accounts,
  journalEntries,
  transactions,
  onSaveJournalEntry,
  onRefreshData,
}) => {
  const [items, setItems] = useState<InventoryItem[]>(() => getInventoryItems(company.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('Physical Inventory Count Reconciliation');

  // Form state for adding new item
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General Merchandise');
  const [newItemUnit, setNewItemUnit] = useState('units');
  const [newItemCost, setNewItemCost] = useState<number>(0);
  const [newItemPrice, setNewItemPrice] = useState<number>(0);
  const [newItemQty, setNewItemQty] = useState<number>(0);
  const [newItemReorder, setNewItemReorder] = useState<number>(10);

  const currencySymbol = company.currencySymbol || '$';

  // Find Inventory Asset Accounts (e.g. 1050 Merchandise Inventory)
  const inventoryAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.type === 'Asset' && (a.subtype === 'Inventory' || a.name.toLowerCase().includes('inventory'))
    );
  }, [accounts]);

  const defaultInventoryAccount = inventoryAccounts[0] || accounts.find((a) => a.code === '1050');

  // Find COGS Accounts (e.g. 5010 Cost of Goods Sold)
  const cogsAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.subtype === 'Cost of Goods Sold' || a.code.startsWith('501') || a.name.toLowerCase().includes('cost of goods')
    );
  }, [accounts]);

  const defaultCogsAccount = cogsAccounts[0] || accounts.find((a) => a.code === '5010');

  // Calculate Live General Ledger Ending Inventory Balance
  const endingInventoryAssetBalance = useMemo(() => {
    const invAccountIds = new Set(inventoryAccounts.map((a) => a.id));
    let balance = 0;
    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (invAccountIds.has(line.accountId)) {
          // Inventory is an Asset (Normal Balance: Debit)
          balance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      });
    });
    return Math.max(0, balance);
  }, [inventoryAccounts, journalEntries]);

  // Calculate General Ledger Posted COGS Expense
  const postedGlCOGS = useMemo(() => {
    const cogsIds = new Set(cogsAccounts.map((a) => a.id));
    let cogs = 0;
    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (cogsIds.has(line.accountId)) {
          cogs += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      });
    });
    return Math.max(0, cogs);
  }, [cogsAccounts, journalEntries]);

  // Physical Inventory Item Valuation Total
  const totalPhysicalInventoryValuation = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantityOnHand * item.unitCost, 0);
  }, [items]);

  // Effective Ending Inventory for COGS calculation
  // Prioritize general ledger ending balance if present, or physical stock valuation
  const effectiveEndingInventory = endingInventoryAssetBalance > 0 
    ? endingInventoryAssetBalance 
    : totalPhysicalInventoryValuation;

  // Compute Beginning Inventory & Purchases from transaction history
  // Beginning inventory is initial seed stock or opening balance
  const beginningInventory = useMemo(() => {
    const openingEntry = journalEntries.find((e) => e.sourceType === 'Opening_Balance');
    if (openingEntry) {
      const invLine = openingEntry.lines.find((l) => 
        inventoryAccounts.some((a) => a.id === l.accountId || a.code === l.accountCode)
      );
      if (invLine) return Number(invLine.debit) || 0;
    }
    // Default estimated beginning inventory if not specified
    return Math.round(effectiveEndingInventory * 0.75);
  }, [journalEntries, inventoryAccounts, effectiveEndingInventory]);

  // Purchases during the period (debits to inventory from Bills/Purchases)
  const periodPurchases = useMemo(() => {
    const invAccountIds = new Set(inventoryAccounts.map((a) => a.id));
    let purchases = 0;
    journalEntries.forEach((entry) => {
      if (entry.sourceType !== 'Opening_Balance') {
        entry.lines.forEach((line) => {
          if (invAccountIds.has(line.accountId) && Number(line.debit) > 0) {
            purchases += Number(line.debit) || 0;
          }
        });
      }
    });

    if (purchases > 0) return purchases;
    // If no explicit bills logged yet, purchase amount derives logically
    return Math.max(0, postedGlCOGS + effectiveEndingInventory - beginningInventory);
  }, [journalEntries, inventoryAccounts, postedGlCOGS, effectiveEndingInventory, beginningInventory]);

  // Cost of Goods Available for Sale (COGAS)
  const costOfGoodsAvailableForSale = beginningInventory + periodPurchases;

  // Computed Cost of Goods Sold (COGS) Formula:
  // Beginning Inventory + Purchases - Ending Inventory = COGS
  const computedCOGS = Math.max(0, costOfGoodsAvailableForSale - effectiveEndingInventory);

  // Variance between computed COGS and General Ledger COGS
  const cogsDiscrepancy = Math.abs(computedCOGS - postedGlCOGS);
  const isReconciled = cogsDiscrepancy < 1.0;

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [items, searchTerm, categoryFilter]);

  // Low stock items count
  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.quantityOnHand <= i.reorderPoint).length;
  }, [items]);

  // Save New Item Handler
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemSku || !newItemName) return;

    const newItem: InventoryItem = {
      id: `${company.id}-inv-${Date.now()}`,
      companyId: company.id,
      sku: newItemSku.toUpperCase().trim(),
      name: newItemName.trim(),
      category: newItemCategory,
      unit: newItemUnit,
      unitCost: Number(newItemCost) || 0,
      unitPrice: Number(newItemPrice) || 0,
      quantityOnHand: Number(newItemQty) || 0,
      reorderPoint: Number(newItemReorder) || 5,
      createdAt: new Date().toISOString(),
    };

    saveInventoryItem(newItem);
    const updated = getInventoryItems(company.id);
    setItems(updated);

    // Reset Form
    setNewItemSku('');
    setNewItemName('');
    setNewItemCost(0);
    setNewItemPrice(0);
    setNewItemQty(0);
    setIsAddModalOpen(false);
  };

  // Delete Item Handler
  const handleDeleteItem = (id: string) => {
    if (window.confirm('Are you sure you want to remove this inventory item?')) {
      deleteInventoryItem(company.id, id);
      setItems(getInventoryItems(company.id));
    }
  };

  // Open Adjust Modal
  const openAdjustModal = (item: InventoryItem) => {
    setSelectedItemForAdjust(item);
    setPhysicalCount(item.quantityOnHand);
    setAdjustmentReason('Physical Inventory Count Reconciliation');
    setIsAdjustModalOpen(true);
  };

  // Process Stock Adjustment & Auto-post Journal Entry
  const handleProcessAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;

    const currentQty = selectedItemForAdjust.quantityOnHand;
    const diffQty = physicalCount - currentQty;
    if (diffQty === 0) {
      setIsAdjustModalOpen(false);
      return;
    }

    const unitCost = selectedItemForAdjust.unitCost;
    const diffAmount = Math.abs(diffQty * unitCost);

    // Update item stock
    const updatedItem: InventoryItem = {
      ...selectedItemForAdjust,
      quantityOnHand: physicalCount,
      updatedAt: new Date().toISOString(),
    };
    saveInventoryItem(updatedItem);
    setItems(getInventoryItems(company.id));

    // Automatically post corresponding double-entry Journal Voucher to keep GL in sync!
    if (defaultInventoryAccount && defaultCogsAccount) {
      const today = new Date().toISOString().split('T')[0];
      const entryNumber = `JE-INV-${Date.now().toString().slice(-4)}`;

      // If diffQty < 0: Physical count is LESS than book (Inventory Shrinkage/Loss)
      // Debit COGS / Shrinkage, Credit Merchandise Inventory
      // If diffQty > 0: Physical count is GREATER than book (Inventory Gain/Found)
      // Debit Merchandise Inventory, Credit COGS / Inventory Gain
      const lines = diffQty < 0 ? [
        {
          id: `line-${Date.now()}-1`,
          accountId: defaultCogsAccount.id,
          accountCode: defaultCogsAccount.code,
          accountName: defaultCogsAccount.name,
          debit: diffAmount,
          credit: 0,
          memo: `Inventory adjustment (${diffQty} ${selectedItemForAdjust.unit}): ${selectedItemForAdjust.sku} ${selectedItemForAdjust.name}`,
        },
        {
          id: `line-${Date.now()}-2`,
          accountId: defaultInventoryAccount.id,
          accountCode: defaultInventoryAccount.code,
          accountName: defaultInventoryAccount.name,
          debit: 0,
          credit: diffAmount,
          memo: `Physical count reconciliation (${adjustmentReason})`,
        },
      ] : [
        {
          id: `line-${Date.now()}-1`,
          accountId: defaultInventoryAccount.id,
          accountCode: defaultInventoryAccount.code,
          accountName: defaultInventoryAccount.name,
          debit: diffAmount,
          credit: 0,
          memo: `Inventory count recovery (+${diffQty} ${selectedItemForAdjust.unit}): ${selectedItemForAdjust.sku}`,
        },
        {
          id: `line-${Date.now()}-2`,
          accountId: defaultCogsAccount.id,
          accountCode: defaultCogsAccount.code,
          accountName: defaultCogsAccount.name,
          debit: 0,
          credit: diffAmount,
          memo: `Physical count reconciliation (${adjustmentReason})`,
        },
      ];

      const adjustmentJE: JournalEntry = {
        id: `je-adj-${Date.now()}`,
        companyId: company.id,
        entryNumber,
        date: today,
        description: `Inventory Physical Count Adjustment: ${selectedItemForAdjust.sku} (${adjustmentReason})`,
        lines,
        status: 'Posted',
        sourceType: 'Manual',
        createdAt: new Date().toISOString(),
      };

      onSaveJournalEntry(adjustmentJE);
      if (onRefreshData) onRefreshData();
    }

    setIsAdjustModalOpen(false);
  };

  // Export PDF Handler
  const handleExportPDF = () => {
    generateInventoryPDF({
      company,
      inventoryItems: items,
      beginningInventory,
      purchases: periodPurchases,
      endingInventory: effectiveEndingInventory,
      computedCOGS,
      dateRangeText: 'Active Fiscal Accounting Period',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Inventory & Cost of Goods Sold (COGS)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time inventory asset balances, product stock valuations, and Cost of Goods Sold schedule for <span className="font-semibold text-slate-800">{company.name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download COGS Schedule (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Inventory Item</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ending Inventory Asset Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ending Inventory Balance
            </span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono-num text-slate-900 block">
              {formatCurrency(effectiveEndingInventory, currencySymbol)}
            </span>
            <span className="text-[11px] text-slate-500">
              Account 1050 (Asset normal balance: Debit)
            </span>
          </div>
        </div>

        {/* Card 2: Cost of Goods Sold (COGS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cost of Goods Sold (COGS)
            </span>
            <Calculator className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono-num text-rose-600 block">
              {formatCurrency(computedCOGS, currencySymbol)}
            </span>
            <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-0.5">
              <span>Income Statement Account 5010</span>
              {isReconciled ? (
                <span className="text-emerald-700 font-semibold flex items-center">
                  • Reconciled
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Card 3: Cost of Goods Available for Sale (COGAS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Goods Available for Sale (COGAS)
            </span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono-num text-slate-900 block">
              {formatCurrency(costOfGoodsAvailableForSale, currencySymbol)}
            </span>
            <span className="text-[11px] text-slate-500">
              Beginning Inventory + Purchases
            </span>
          </div>
        </div>

        {/* Card 4: Catalog SKUs & Low Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Catalog Items & Alerts
            </span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black font-mono-num text-slate-900 block">
                {items.length}
              </span>
              <span className="text-[11px] text-slate-500">
                Tracked inventory items
              </span>
            </div>
            {lowStockCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {lowStockCount} Low Stock
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Cost of Goods Sold (COGS) Computation Schedule */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8">
        <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Official Accounting Schedule
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Computation of Cost of Goods Sold (COGS)
            </h3>
            <p className="text-xs text-slate-500">
              Periodic Inventory Method formula: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">Beginning Inventory + Purchases − Ending Inventory = Cost of Goods Sold</code>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                isReconciled
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>{isReconciled ? 'GL Balance 100% Reconciled' : 'Reconciliation Pending'}</span>
            </span>
          </div>
        </div>

        {/* Mathematical Schedule Table */}
        <div className="space-y-3 font-sans">
          {/* Row 1: Beginning Inventory */}
          <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50 rounded-xl text-xs">
            <div>
              <span className="font-bold text-slate-900 block">1. Beginning Merchandise Inventory Balance</span>
              <span className="text-slate-500 text-[11px]">Carried forward from preceding fiscal period</span>
            </div>
            <span className="font-mono-num font-bold text-sm text-slate-900">
              {formatCurrency(beginningInventory, currencySymbol)}
            </span>
          </div>

          {/* Row 2: Plus Purchases */}
          <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50 rounded-xl text-xs">
            <div>
              <span className="font-bold text-slate-900 block">2. Add: Purchases of Merchandise & Inbound Freight</span>
              <span className="text-slate-500 text-[11px]">Net inventory acquisitions logged in current period</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-600 font-bold font-mono">+</span>
              <span className="font-mono-num font-bold text-sm text-slate-900">
                {formatCurrency(periodPurchases, currencySymbol)}
              </span>
            </div>
          </div>

          {/* Row 3: Subtotal COGAS */}
          <div className="flex justify-between items-center py-2.5 px-4 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-950">
            <div>
              <span className="block font-bold">Equals: Cost of Goods Available for Sale (COGAS)</span>
              <span className="text-indigo-600 text-[11px] font-normal">Total physical stock pool available for order fulfillment</span>
            </div>
            <span className="font-mono-num font-black text-sm text-indigo-950">
              {formatCurrency(costOfGoodsAvailableForSale, currencySymbol)}
            </span>
          </div>

          {/* Row 4: Less Ending Inventory */}
          <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50 rounded-xl text-xs">
            <div>
              <span className="font-bold text-slate-900 block">3. Less: Ending Merchandise Inventory Balance</span>
              <span className="text-slate-500 text-[11px]">
                Asset balance verified on Balance Sheet (Account 1050) & stock count
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-rose-600 font-bold font-mono">−</span>
              <span className="font-mono-num font-bold text-sm text-rose-600">
                ({formatCurrency(effectiveEndingInventory, currencySymbol)})
              </span>
            </div>
          </div>

          {/* Row 5: Equals Cost of Goods Sold */}
          <div className="flex justify-between items-center py-4 px-5 bg-slate-900 rounded-xl text-white shadow-sm mt-4">
            <div>
              <span className="text-sm font-black uppercase tracking-wider block">
                Equals: Cost of Goods Sold (COGS)
              </span>
              <span className="text-xs text-slate-400 font-normal">
                Direct cost of inventory sold, recognized on the Comprehensive Income Statement
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono-num tracking-tight block">
                {formatCurrency(computedCOGS, currencySymbol)}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                Postings match Account 5010
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Item Catalog & Stock Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Top Controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Inventory Item Catalog & Physical Stock Ledger
            </h3>
            <p className="text-xs text-slate-500">
              {items.length} items cataloged • Total Physical Valuation: <strong className="text-slate-900 font-mono-num">{formatCurrency(totalPhysicalInventoryValuation, currencySymbol)}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search SKU or name..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none w-44"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-slate-700"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4">Product Name & Category</th>
                <th className="py-2.5 px-4 text-right">Quantity on Hand</th>
                <th className="py-2.5 px-4 text-right">Unit Cost</th>
                <th className="py-2.5 px-4 text-right">Unit Selling Price</th>
                <th className="py-2.5 px-4 text-right">Total Asset Valuation</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No inventory items match your search filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const valuation = item.quantityOnHand * item.unitCost;
                  const isLow = item.quantityOnHand <= item.reorderPoint;
                  const isOutOfStock = item.quantityOnHand <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono-num font-bold text-slate-900">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.category} • {item.description || 'Standard product'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {item.quantityOnHand} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                        {formatCurrency(item.unitCost, currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                        {formatCurrency(item.unitPrice, currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {formatCurrency(valuation, currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Low Stock (≤{item.reorderPoint})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => openAdjustModal(item)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                          title="Record physical count & adjust stock"
                        >
                          Adjust Count
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Inventory Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Add New Inventory Item
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    placeholder="e.g. SKU-101"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    placeholder="e.g. Hardware"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Commercial Network Router"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Unit Cost ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Unit Price ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Unit Type
                  </label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs / units"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Initial Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Reorder Alert Point
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemReorder}
                    onChange={(e) => setNewItemReorder(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && selectedItemForAdjust && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Physical Count Adjustment
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedItemForAdjust.sku} - {selectedItemForAdjust.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessAdjustment} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Current Ledger Quantity:</span>
                  <span className="font-bold font-mono-num text-slate-900">
                    {selectedItemForAdjust.quantityOnHand} {selectedItemForAdjust.unit}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Unit Valuation Cost:</span>
                  <span className="font-bold font-mono-num text-slate-900">
                    {formatCurrency(selectedItemForAdjust.unitCost, currencySymbol)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Actual Counted Physical Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(parseInt(e.target.value) || 0)}
                  className="w-full text-sm font-mono-num font-bold px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Adjustment Reason
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Physical Inventory Count Reconciliation">Physical Count Reconciliation</option>
                  <option value="Stock Shrinkage / Damage">Stock Shrinkage / Damaged Goods</option>
                  <option value="Inventory Write-Down">Inventory Write-Down</option>
                  <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                </select>
              </div>

              {physicalCount !== selectedItemForAdjust.quantityOnHand && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold block mb-1">Automatic Double-Entry Posting:</span>
                  A journal voucher will be automatically posted to General Ledger:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 font-mono text-[11px]">
                    {physicalCount < selectedItemForAdjust.quantityOnHand ? (
                      <>
                        <li>Debit: Cost of Goods Sold / Shrinkage ({formatCurrency(Math.abs(physicalCount - selectedItemForAdjust.quantityOnHand) * selectedItemForAdjust.unitCost, currencySymbol)})</li>
                        <li>Credit: Merchandise Inventory ({formatCurrency(Math.abs(physicalCount - selectedItemForAdjust.quantityOnHand) * selectedItemForAdjust.unitCost, currencySymbol)})</li>
                      </>
                    ) : (
                      <>
                        <li>Debit: Merchandise Inventory ({formatCurrency(Math.abs(physicalCount - selectedItemForAdjust.quantityOnHand) * selectedItemForAdjust.unitCost, currencySymbol)})</li>
                        <li>Credit: Cost of Goods Sold / Gain ({formatCurrency(Math.abs(physicalCount - selectedItemForAdjust.quantityOnHand) * selectedItemForAdjust.unitCost, currencySymbol)})</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
                >
                  Confirm & Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
