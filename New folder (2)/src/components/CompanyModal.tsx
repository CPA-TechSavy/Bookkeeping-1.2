import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Plus, 
  Trash2, 
  Coins, 
  PieChart 
} from 'lucide-react';
import { 
  CompanyProfile, 
  EntityType, 
  AccountingMethod, 
  PartnerInfo, 
  CorporationInfo, 
  SoleProprietorInfo 
} from '../types';
import { formatTaxId, formatCurrency } from '../services/accountingEngine';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Omit<CompanyProfile, 'id' | 'createdAt'>, existingId?: string) => void;
  initialData?: CompanyProfile | null;
}

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar ($)' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar ($)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (₱)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar ($)' },
];

const BRAND_COLORS = [
  '#0284c7', // Sky
  '#059669', // Emerald
  '#7c3aed', // Violet
  '#d97706', // Amber
  '#e11d48', // Rose
  '#475569', // Slate
  '#0d9488', // Teal
  '#4f46e5', // Indigo
];

interface LocalPartner {
  id: string;
  name: string;
  profitSharePercentage: number;
  beginningCapital: number;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('Corporation');
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [fiscalYearEnd, setFiscalYearEnd] = useState('December 31');
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>('Accrual');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('United States');
  const [defaultTaxRate, setDefaultTaxRate] = useState(8.0);
  const [brandColor, setBrandColor] = useState('#0284c7');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Corporation Capital Stock Structure
  const [authorizedShares, setAuthorizedShares] = useState<number>(100000);
  const [parValuePerShare, setParValuePerShare] = useState<number>(10);
  const [authorizedCapitalStock, setAuthorizedCapitalStock] = useState<number>(1000000);
  const [paidUpCapital, setPaidUpCapital] = useState<number>(250000);
  const [appropriatedRetainedEarnings, setAppropriatedRetainedEarnings] = useState<number>(50000);
  const [unappropriatedRetainedEarnings, setUnappropriatedRetainedEarnings] = useState<number>(150000);

  // Partnership Profit Sharing & Partners Structure
  const [partners, setPartners] = useState<LocalPartner[]>([
    { id: '1', name: 'Partner A', profitSharePercentage: 50, beginningCapital: 100000 },
    { id: '2', name: 'Partner B', profitSharePercentage: 50, beginningCapital: 100000 },
  ]);

  // Single Proprietorship Owner Information
  const [ownerName, setOwnerName] = useState('');
  const [ownerBeginningCapital, setOwnerBeginningCapital] = useState<number>(150000);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setTradeName(initialData.tradeName || '');
      setTaxId(formatTaxId(initialData.taxId) || initialData.taxId || '');
      setEntityType((['Corporation', 'Single Proprietorship', 'Partnership', 'Cooperative'].includes(initialData.entityType)
        ? initialData.entityType
        : 'Corporation') as EntityType);
      setCurrency(initialData.currency || 'USD');
      setCurrencySymbol(initialData.currencySymbol || '$');
      setFiscalYearEnd(initialData.fiscalYearEnd || 'December 31');
      setAccountingMethod(initialData.accountingMethod || 'Accrual');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setStreet(initialData.address?.street || '');
      setCity(initialData.address?.city || '');
      setState(initialData.address?.state || '');
      setZip(initialData.address?.zip || '');
      setCountry(initialData.address?.country || 'USA');
      setDefaultTaxRate(initialData.defaultTaxRate ?? 8.0);
      setBrandColor(initialData.brandColor || '#0284c7');
      setNotes(initialData.notes || '');

      // Load Corporation fields if present
      if (initialData.corporationInfo) {
        setAuthorizedShares(initialData.corporationInfo.authorizedShares ?? 100000);
        setParValuePerShare(initialData.corporationInfo.parValuePerShare ?? 10);
        setAuthorizedCapitalStock(initialData.corporationInfo.authorizedCapitalStock ?? 1000000);
        setPaidUpCapital(initialData.corporationInfo.paidUpCapital ?? 250000);
        setAppropriatedRetainedEarnings(initialData.corporationInfo.appropriatedRetainedEarnings ?? 50000);
        setUnappropriatedRetainedEarnings(initialData.corporationInfo.unappropriatedRetainedEarnings ?? 150000);
      } else {
        setAuthorizedShares(100000);
        setParValuePerShare(10);
        setAuthorizedCapitalStock(1000000);
        setPaidUpCapital(250000);
        setAppropriatedRetainedEarnings(50000);
        setUnappropriatedRetainedEarnings(150000);
      }

      // Load Partnership fields if present
      if (initialData.partnershipInfo?.partners && initialData.partnershipInfo.partners.length > 0) {
        setPartners(
          initialData.partnershipInfo.partners.map((p, idx) => ({
            id: p.id || String(idx + 1),
            name: p.name || `Partner ${idx + 1}`,
            profitSharePercentage: p.profitSharePercentage ?? 50,
            beginningCapital: p.beginningCapital ?? 100000,
          }))
        );
      } else {
        setPartners([
          { id: '1', name: 'Partner A', profitSharePercentage: 50, beginningCapital: 100000 },
          { id: '2', name: 'Partner B', profitSharePercentage: 50, beginningCapital: 100000 },
        ]);
      }

      // Load Single Proprietorship fields if present
      if (initialData.soleProprietorInfo) {
        setOwnerName(initialData.soleProprietorInfo.ownerName || initialData.name || '');
        setOwnerBeginningCapital(initialData.soleProprietorInfo.beginningCapital ?? 150000);
      } else {
        setOwnerName(initialData.name || '');
        setOwnerBeginningCapital(150000);
      }
    } else {
      // Reset defaults for a new company
      setName('');
      setTradeName('');
      setTaxId('');
      setEntityType('Corporation');
      setCurrency('USD');
      setCurrencySymbol('$');
      setFiscalYearEnd('December 31');
      setAccountingMethod('Accrual');
      setEmail('');
      setPhone('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      setCountry('United States');
      setDefaultTaxRate(7.5);
      setBrandColor(BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]);
      setNotes('');

      // Corporation defaults
      setAuthorizedShares(100000);
      setParValuePerShare(10);
      setAuthorizedCapitalStock(1000000);
      setPaidUpCapital(250000);
      setAppropriatedRetainedEarnings(50000);
      setUnappropriatedRetainedEarnings(150000);

      // Partnership defaults
      setPartners([
        { id: '1', name: 'Partner A', profitSharePercentage: 50, beginningCapital: 100000 },
        { id: '2', name: 'Partner B', profitSharePercentage: 50, beginningCapital: 100000 },
      ]);

      // Sole Proprietorship defaults
      setOwnerName('');
      setOwnerBeginningCapital(150000);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    const curr = CURRENCY_OPTIONS.find((c) => c.code === code);
    if (curr) setCurrencySymbol(curr.symbol);
  };

  // Keep authorizedCapitalStock in sync with shares * par value unless manually adjusted
  const handleSharesChange = (val: number) => {
    const shares = Math.max(1, Number(val) || 0);
    setAuthorizedShares(shares);
    setAuthorizedCapitalStock(shares * parValuePerShare);
  };

  const handleParValueChange = (val: number) => {
    const par = Math.max(0.01, Number(val) || 0);
    setParValuePerShare(par);
    setAuthorizedCapitalStock(authorizedShares * par);
  };

  // Partnership Partner Helpers
  const addPartner = () => {
    const nextId = String(Date.now());
    setPartners((prev) => [
      ...prev,
      {
        id: nextId,
        name: `Partner ${String.fromCharCode(65 + prev.length)}`,
        profitSharePercentage: 0,
        beginningCapital: 50000,
      },
    ]);
  };

  const removePartner = (id: string) => {
    if (partners.length <= 2) {
      alert('A partnership must maintain at least 2 partners.');
      return;
    }
    setPartners((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePartner = (id: string, field: keyof LocalPartner, value: any) => {
    setPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const totalProfitShare = partners.reduce((sum, p) => sum + (Number(p.profitSharePercentage) || 0), 0);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Legal company name is required';
    if (!taxId.trim()) {
      newErrors.taxId = 'Tax Identification Number is required';
    } else if (taxId.replace(/\D/g, '').length < 9) {
      newErrors.taxId = 'TIN must be in format (xxx-xxx-xxx-xxxxx)';
    }
    if (!email.trim() || !email.includes('@')) newErrors.email = 'Valid corporate email is required';

    // Entity-Specific Validations
    if (entityType === 'Partnership') {
      if (partners.length < 2) {
        newErrors.partnership = 'Partnership must have at least 2 partners.';
      }
      const hasEmptyName = partners.some((p) => !p.name.trim());
      if (hasEmptyName) {
        newErrors.partnership = 'All partners must have a valid legal name.';
      }
      if (Math.abs(totalProfitShare - 100) > 0.01) {
        newErrors.partnership = `Profit sharing must total exactly 100% (currently ${totalProfitShare}%).`;
      }
    } else if (entityType === 'Corporation') {
      if (authorizedCapitalStock <= 0) {
        newErrors.corporation = 'Authorized Capital Stock must be declared and greater than zero.';
      }
      if (paidUpCapital < 0) {
        newErrors.corporation = 'Paid-up Capital cannot be negative.';
      }
      if (paidUpCapital > authorizedCapitalStock) {
        newErrors.corporation = 'Paid-up Capital cannot exceed the declared Authorized Capital Stock.';
      }
    } else if (entityType === 'Single Proprietorship' || entityType === 'Sole Proprietorship') {
      if (!ownerName.trim() && !name.trim()) {
        newErrors.soleProprietor = 'Sole Proprietor legal owner name is required.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const partnershipInfo = entityType === 'Partnership' ? {
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        profitSharePercentage: Number(p.profitSharePercentage) || 0,
        beginningCapital: Number(p.beginningCapital) || 0,
      })),
    } : undefined;

    const corporationInfo: CorporationInfo | undefined = entityType === 'Corporation' ? {
      authorizedShares: Number(authorizedShares) || 100000,
      parValuePerShare: Number(parValuePerShare) || 10,
      authorizedCapitalStock: Number(authorizedCapitalStock) || 1000000,
      paidUpCapital: Number(paidUpCapital) || 250000,
      appropriatedRetainedEarnings: Number(appropriatedRetainedEarnings) || 0,
      unappropriatedRetainedEarnings: Number(unappropriatedRetainedEarnings) || 0,
    } : undefined;

    const soleProprietorInfo: SoleProprietorInfo | undefined = 
      (entityType === 'Single Proprietorship' || entityType === 'Sole Proprietorship') ? {
        ownerName: ownerName.trim() || name.trim(),
        beginningCapital: Number(ownerBeginningCapital) || 0,
      } : undefined;

    onSave(
      {
        name: name.trim(),
        tradeName: tradeName.trim() || undefined,
        taxId: taxId.trim(),
        entityType,
        currency,
        currencySymbol,
        fiscalYearEnd,
        accountingMethod,
        email: email.trim(),
        phone: phone.trim(),
        address: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          country: country.trim(),
        },
        defaultTaxRate: Number(defaultTaxRate) || 0,
        brandColor,
        notes: notes.trim() || undefined,
        partnershipInfo,
        corporationInfo,
        soleProprietorInfo,
      },
      initialData?.id
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow"
              style={{ backgroundColor: brandColor }}
            >
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {initialData ? 'Edit Company Profile' : 'Add New Company Profile'}
              </h2>
              <p className="text-xs text-slate-300">
                {initialData
                  ? 'Update legal structure & financial settings for this entity'
                  : 'Provisions an isolated Chart of Accounts, General Ledger & Reports'}
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

        {/* Isolation Notice */}
        <div className="bg-emerald-50 border-b border-emerald-200/70 px-6 py-2.5 flex items-center space-x-2 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Data Isolation Guarantee:</strong> Transactions, journal entries, and financial statements are strictly locked to this company.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Basic Entity Info */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              1. Legal Entity Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summit Global Ventures LLC"
                  className={`w-full text-xs px-3 py-2 rounded-lg border ${
                    errors.name ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trade Name / DBA (Optional)
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="e.g., Summit Cloud Labs"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Entity Legal Structure <span className="text-rose-500">*</span>
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as EntityType)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium text-slate-900"
                >
                  <option value="Corporation">Corporation (Share Capital & Retained Earnings)</option>
                  <option value="Partnership">Partnership (Multi-Partner & Profit Sharing)</option>
                  <option value="Single Proprietorship">Single Proprietorship (Sole Owner Capital)</option>
                  <option value="Cooperative">Cooperative</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Identification Number (TIN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(formatTaxId(e.target.value))}
                  placeholder="xxx-xxx-xxx-xxxxx"
                  maxLength={18}
                  className={`w-full text-xs px-3 py-2 font-mono rounded-lg border ${
                    errors.taxId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
                  } focus:outline-none focus:ring-2`}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Format: xxx-xxx-xxx-xxxxx</p>
                {errors.taxId && <p className="text-[11px] text-rose-500 mt-1">{errors.taxId}</p>}
              </div>
            </div>
          </div>

          {/* =================================================================================== */}
          {/* ENTITY-SPECIFIC REQUIRED STRUCTURAL INFORMATION (User Requirement 4) */}
          {/* =================================================================================== */}
          
          {/* PARTNERSHIP: Profit Sharing & Partners Breakdown */}
          {entityType === 'Partnership' && (
            <div className="pt-3 border-t-2 border-indigo-100 bg-indigo-50/50 p-4 rounded-xl border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Partnership Profit Sharing & Capital Contributions <span className="text-rose-500">*</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={addPartner}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Partner</span>
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                In a Partnership, Net Income is distributed according to declared profit sharing percentages, and drawings are deducted from each partner's capital. Profit share must total exactly 100%.
              </p>

              <div className="space-y-2 mb-3">
                {partners.map((partner, index) => (
                  <div
                    key={partner.id}
                    className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs"
                  >
                    <div className="col-span-5">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Partner Legal Name
                      </label>
                      <input
                        type="text"
                        value={partner.name}
                        onChange={(e) => updatePartner(partner.id, 'name', e.target.value)}
                        placeholder={`e.g., Partner ${index + 1}`}
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Profit Share (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={partner.profitSharePercentage}
                        onChange={(e) => updatePartner(partner.id, 'profitSharePercentage', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono-num font-bold"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Beginning Capital ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={partner.beginningCapital}
                        onChange={(e) => updatePartner(partner.id, 'beginningCapital', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono-num"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-3">
                      <button
                        type="button"
                        onClick={() => removePartner(partner.id)}
                        disabled={partners.length <= 2}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title={partners.length <= 2 ? 'Minimum 2 partners required' : 'Remove partner'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Profit Share Balancing Status Bar */}
              <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-indigo-200">
                <span className="text-slate-700">Total Profit Sharing Allocated:</span>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-mono text-xs ${
                      Math.abs(totalProfitShare - 100) < 0.01
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {totalProfitShare.toFixed(1)}% / 100%
                  </span>
                  {Math.abs(totalProfitShare - 100) < 0.01 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                </div>
              </div>

              {errors.partnership && (
                <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.partnership}</span>
                </div>
              )}
            </div>
          )}

          {/* CORPORATION: Authorized Capital Stock, Par Value, and Shares */}
          {entityType === 'Corporation' && (
            <div className="pt-3 border-t-2 border-sky-100 bg-sky-50/50 p-4 rounded-xl border">
              <div className="flex items-center space-x-2 mb-2">
                <Coins className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Corporation Capital Stock Structure <span className="text-rose-500">*</span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                For Corporations, Authorized Capital Stock must be declared in the corporate charter. Capital Share represents the Paid-Up Capital of Shareholders, and Retained Earnings represents cumulative net earnings less dividends.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized Shares (Number of Shares) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={authorizedShares}
                    onChange={(e) => handleSharesChange(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 100000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num"
                  />
                  <span className="text-[10px] text-slate-500">Total authorized capital shares in charter</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Par Value Per Share ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={parValuePerShare}
                    onChange={(e) => handleParValueChange(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 10.00"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num"
                  />
                  <span className="text-[10px] text-slate-500">Stated or nominal value per share</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Declared Authorized Capital Stock ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={authorizedCapitalStock}
                    onChange={(e) => setAuthorizedCapitalStock(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 1000000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-500">
                    Formula: {authorizedShares.toLocaleString()} shares × {currencySymbol}{parValuePerShare} par value
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paid-Up Capital (Issued & Paid) ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paidUpCapital}
                    onChange={(e) => setPaidUpCapital(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 250000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num font-bold"
                  />
                  <span className="text-[10px] text-slate-500">
                    Actual paid-in share capital credited to stockholders
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Appropriated Retained Earnings (Reserves) ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={appropriatedRetainedEarnings}
                    onChange={(e) => setAppropriatedRetainedEarnings(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 50000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num"
                  />
                  <span className="text-[10px] text-slate-500">
                    Restricted for plant expansion, debt redemption, or contingencies
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unappropriated Retained Earnings ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={unappropriatedRetainedEarnings}
                    onChange={(e) => setUnappropriatedRetainedEarnings(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 150000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono-num"
                  />
                  <span className="text-[10px] text-slate-500">
                    Cumulative historical profits retained since inception
                  </span>
                </div>
              </div>

              {errors.corporation && (
                <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.corporation}</span>
                </div>
              )}
            </div>
          )}

          {/* SINGLE PROPRIETORSHIP: Owner Name & Contributed Capital */}
          {(entityType === 'Single Proprietorship' || entityType === 'Sole Proprietorship') && (
            <div className="pt-3 border-t-2 border-amber-100 bg-amber-50/50 p-4 rounded-xl border">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sole Proprietorship Owner Capital Details
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                In a Sole Proprietorship, owner's equity consists of beginning capital plus additional investments plus period net income, less personal drawings.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sole Owner Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner Initial Capital Balance ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ownerBeginningCapital}
                    onChange={(e) => setOwnerBeginningCapital(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 150000"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono-num font-bold"
                  />
                </div>
              </div>

              {errors.soleProprietor && (
                <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.soleProprietor}</span>
                </div>
              )}
            </div>
          )}

          {/* Bookkeeping & Financial Configuration */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              2. Accounting & Currency Standards
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Functional Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accounting Method
                </label>
                <select
                  value={accountingMethod}
                  onChange={(e) => setAccountingMethod(e.target.value as AccountingMethod)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Accrual">Accrual Basis (Recommended)</option>
                  <option value="Cash">Cash Basis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fiscal Year End
                </label>
                <select
                  value={fiscalYearEnd}
                  onChange={(e) => setFiscalYearEnd(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="December 31">Calendar Year (Dec 31)</option>
                  <option value="March 31">Q1 Fiscal End (Mar 31)</option>
                  <option value="June 30">Mid-Year End (Jun 30)</option>
                  <option value="September 30">Federal Fiscal End (Sep 30)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Sales Tax %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono-num"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Entity Brand Color Badge
                </label>
                <div className="flex items-center space-x-2 pt-1">
                  {BRAND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBrandColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        brandColor === color ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div
                    className="ml-3 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: brandColor }}
                  >
                    Preview Badge
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Address */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              3. Corporate Contact & Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Finance / Billing Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="accounting@company.com"
                  className={`w-full text-xs px-3 py-2 rounded-lg border ${
                    errors.email ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'
                  } focus:outline-none focus:ring-2`}
                />
                {errors.email && <p className="text-[11px] text-rose-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="100 Enterprise Blvd, Suite 500"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Austin"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State / Prov
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="TX"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ZIP / Postal
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="78701"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Operational Notes */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Entity Notes / Primary Line of Business
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Technology consulting and enterprise software maintenance."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
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
              <span>{initialData ? 'Update Profile' : 'Create Entity & Provision Books'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
