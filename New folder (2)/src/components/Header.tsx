import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  ShieldCheck, 
  Download, 
  LayoutDashboard, 
  BookOpen, 
  ReceiptText, 
  FolderTree, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Layers,
  Package
} from 'lucide-react';
import { CompanyProfile } from '../types';

interface HeaderProps {
  companies: CompanyProfile[];
  activeCompany: CompanyProfile | null;
  onSelectCompany: (companyId: string) => void;
  onOpenNewCompanyModal: () => void;
  currentTab?: string;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onChangeTab?: (tab: string) => void;
  onExportData?: () => void;
  onOpenQuickJournal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  activeCompany,
  onSelectCompany,
  onOpenNewCompanyModal,
  currentTab,
  activeTab,
  onSelectTab,
  onChangeTab,
  onExportData,
  onOpenQuickJournal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const selectedTab = currentTab || activeTab || 'dashboard';
  const handleTabChange = onSelectTab || onChangeTab || (() => {});

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory & COGS', icon: Package },
    { id: 'journals', label: 'Journal & Ledger', icon: BookOpen },
    { id: 'accounts', label: 'Chart of Accounts', icon: FolderTree },
    { id: 'company', label: 'Entity Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-sm">
            <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl tracking-tight leading-none">LedgerFlow</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">Multi-Entity Books</span>
          </div>
        </div>
        {mobileMenuOpen && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">
          Core Features
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                handleTabChange(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Entities Section */}
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-8 flex items-center justify-between">
          <span>Entities</span>
          <button
            type="button"
            onClick={onOpenNewCompanyModal}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded transition-colors"
            title="Add Company Entity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {(companies || []).filter(Boolean).map((comp) => {
            const isSelected = comp.id === activeCompany?.id;
            return (
              <div
                key={comp.id}
                onClick={() => {
                  onSelectCompany(comp.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-r-md cursor-pointer transition-all text-xs font-medium ${
                  isSelected
                    ? 'bg-slate-800 border-l-4 border-emerald-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate pr-2">{comp.name || 'Unnamed Entity'}</span>
                {isSelected ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold shrink-0">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 shrink-0 font-mono">
                    {comp.entityType ? comp.entityType.split(' ')[0] : 'Entity'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* User / Vault Status Card at Bottom */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 p-3 rounded-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {activeCompany?.name ? activeCompany.name.substring(0, 2).toUpperCase() : 'LF'}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-sm text-white font-medium truncate">Lead Controller, CPA</p>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              L3 Vault Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col shrink-0 min-h-screen sticky top-0 h-screen z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Top Navbar with Hamburger */}
      <div className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-white">
            <div className="w-3.5 h-3.5 border-2 border-white rounded-xs"></div>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">LedgerFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 truncate max-w-[120px]">
            {activeCompany?.name || 'Select Entity'}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-900 flex flex-col h-full shadow-2xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
