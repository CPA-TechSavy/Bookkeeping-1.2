import React, { useState } from 'react';
import { 
  Percent, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  AlertCircle, 
  HelpCircle, 
  CheckCircle2, 
  ArrowUpRight,
  Calculator,
  Compass,
  Zap
} from 'lucide-react';
import { BalanceSheetReport, CompanyProfile, IncomeStatementReport } from '../types';
import { formatCurrency } from '../services/accountingEngine';

interface FinancialRatiosViewProps {
  company: CompanyProfile;
  balanceSheet: BalanceSheetReport;
  incomeStatement: IncomeStatementReport;
  dateRangeText: string;
}

type RatioCategory = 'all' | 'liquidity' | 'profitability' | 'solvency' | 'efficiency';

interface RatioMetric {
  id: string;
  name: string;
  category: 'liquidity' | 'profitability' | 'solvency' | 'efficiency';
  formula: string;
  valueString: string;
  numericValue: number;
  benchmark: string;
  status: 'strong' | 'adequate' | 'caution';
  statusText: string;
  interpretation: string;
}

export const FinancialRatiosView: React.FC<FinancialRatiosViewProps> = ({
  company,
  balanceSheet,
  incomeStatement,
  dateRangeText,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<RatioCategory>('all');

  const currencySymbol = company.currencySymbol || '$';

  // Extract variables
  const currentAssets = balanceSheet.totalCurrentAssets;
  const currentLiabilities = balanceSheet.totalCurrentLiabilities;
  const totalAssets = balanceSheet.totalAssets;
  const totalLiabilities = balanceSheet.totalLiabilities;
  const totalEquity = balanceSheet.totalEquity;

  const totalRevenue = incomeStatement.totalRevenue;
  const totalCOGS = incomeStatement.totalCOGS;
  const grossProfit = incomeStatement.grossProfit;
  const totalExpenses = incomeStatement.totalExpenses;
  const netIncome = incomeStatement.netOperatingIncome;

  // Extract cash & accounts receivable & inventory
  const cashTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('101') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
    .reduce((s, a) => s + a.amount, 0);

  const arTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('103') || a.name.toLowerCase().includes('receivable'))
    .reduce((s, a) => s + a.amount, 0);

  const inventoryTotal = balanceSheet.currentAssets
    .filter((a) => a.code.startsWith('105') || a.name.toLowerCase().includes('inventory'))
    .reduce((s, a) => s + a.amount, 0);

  // Compute Ratios
  const ratios: RatioMetric[] = [];

  // --- 1. LIQUIDITY RATIOS ---
  // Current Ratio
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  ratios.push({
    id: 'current-ratio',
    name: 'Current Ratio',
    category: 'liquidity',
    formula: 'Current Assets ÷ Current Liabilities',
    valueString: `${currentRatio.toFixed(2)}x`,
    numericValue: currentRatio,
    benchmark: '> 1.50x to 2.50x',
    status: currentRatio >= 1.5 ? 'strong' : currentRatio >= 1.0 ? 'adequate' : 'caution',
    statusText: currentRatio >= 1.5 ? 'Strong Buffer' : currentRatio >= 1.0 ? 'Adequate' : 'Tight Working Capital',
    interpretation: currentRatio >= 1.5
      ? `The company holds ${currentRatio.toFixed(2)} in short-term assets for every 1.00 of current debt, providing excellent operational safety.`
      : 'Current assets are very close to current obligations; monitor cash outflows carefully.',
  });

  // Quick Ratio (Acid-Test)
  const quickAssets = cashTotal + arTotal;
  const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
  ratios.push({
    id: 'quick-ratio',
    name: 'Quick Ratio (Acid-Test)',
    category: 'liquidity',
    formula: '(Cash & Equivalents + Accounts Receivable) ÷ Current Liabilities',
    valueString: `${quickRatio.toFixed(2)}x`,
    numericValue: quickRatio,
    benchmark: '> 1.00x',
    status: quickRatio >= 1.0 ? 'strong' : quickRatio >= 0.7 ? 'adequate' : 'caution',
    statusText: quickRatio >= 1.0 ? 'Liquid & Robust' : quickRatio >= 0.7 ? 'Moderate' : 'Constrained',
    interpretation: `Measures immediate liquidity without relying on the sale of inventory. You hold ${quickRatio.toFixed(2)} of pure liquid funds per 1.00 of short-term liabilities.`,
  });

  // Cash Ratio
  const cashRatio = currentLiabilities > 0 ? cashTotal / currentLiabilities : 0;
  ratios.push({
    id: 'cash-ratio',
    name: 'Cash Ratio',
    category: 'liquidity',
    formula: 'Cash & Cash Equivalents ÷ Current Liabilities',
    valueString: `${cashRatio.toFixed(2)}x`,
    numericValue: cashRatio,
    benchmark: '> 0.20x to 0.50x',
    status: cashRatio >= 0.4 ? 'strong' : cashRatio >= 0.2 ? 'adequate' : 'caution',
    statusText: cashRatio >= 0.4 ? 'High Cash Cushion' : 'Moderate Cash',
    interpretation: `Shows that cash in bank accounts alone covers ${(cashRatio * 100).toFixed(1)}% of all short-term accounts payable and accrued liabilities.`,
  });

  // Working Capital
  const workingCapital = currentAssets - currentLiabilities;
  ratios.push({
    id: 'working-capital',
    name: 'Net Working Capital',
    category: 'liquidity',
    formula: 'Current Assets − Current Liabilities',
    valueString: formatCurrency(workingCapital, currencySymbol),
    numericValue: workingCapital,
    benchmark: '> $0.00 (Positive)',
    status: workingCapital > 0 ? 'strong' : 'caution',
    statusText: workingCapital > 0 ? 'Positive Liquidity' : 'Deficit Risk',
    interpretation: workingCapital > 0
      ? `The enterprise possesses ${formatCurrency(workingCapital, currencySymbol)} of net liquid operating cushion to fund payroll, inventory, and expansion.`
      : 'Working capital is negative; short-term debt exceeds short-term assets.',
  });

  // --- 2. PROFITABILITY RATIOS ---
  // Gross Profit Margin
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  ratios.push({
    id: 'gross-margin',
    name: 'Gross Profit Margin',
    category: 'profitability',
    formula: '(Gross Profit ÷ Total Revenue) × 100',
    valueString: `${grossMargin.toFixed(1)}%`,
    numericValue: grossMargin,
    benchmark: '> 30.0% to 50.0%',
    status: grossMargin >= 40 ? 'strong' : grossMargin >= 20 ? 'adequate' : 'caution',
    statusText: grossMargin >= 40 ? 'High Margin' : grossMargin >= 20 ? 'Normal Margin' : 'Thin Margin',
    interpretation: `For every 100 in sales, ${currencySymbol}${grossMargin.toFixed(1)} remains after direct Cost of Goods Sold to cover operating overhead and deliver profit.`,
  });

  // Net Profit Margin
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
  ratios.push({
    id: 'net-margin',
    name: 'Net Profit Margin',
    category: 'profitability',
    formula: '(Net Operating Income ÷ Total Revenue) × 100',
    valueString: `${netMargin.toFixed(1)}%`,
    numericValue: netMargin,
    benchmark: '> 10.0% to 20.0%',
    status: netMargin >= 15 ? 'strong' : netMargin >= 5 ? 'adequate' : 'caution',
    statusText: netMargin >= 15 ? 'Highly Profitable' : netMargin > 0 ? 'Profitable' : 'Operating Loss',
    interpretation: netMargin > 0
      ? `The company converts ${netMargin.toFixed(1)}% of all gross revenues directly into bottom-line net profit.`
      : 'Operating expenses and cost of goods exceed revenue in this period.',
  });

  // Return on Assets (ROA)
  const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
  ratios.push({
    id: 'roa',
    name: 'Return on Assets (ROA)',
    category: 'profitability',
    formula: '(Net Operating Income ÷ Total Assets) × 100',
    valueString: `${roa.toFixed(1)}%`,
    numericValue: roa,
    benchmark: '> 8.0% to 15.0%',
    status: roa >= 10 ? 'strong' : roa >= 5 ? 'adequate' : 'caution',
    statusText: roa >= 10 ? 'Efficient Capital' : 'Moderate',
    interpretation: `Indicates how efficiently the entity leverages its balance sheet assets to generate operating earnings (${roa.toFixed(1)}% return).`,
  });

  // Return on Equity (ROE)
  const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;
  ratios.push({
    id: 'roe',
    name: 'Return on Equity (ROE)',
    category: 'profitability',
    formula: '(Net Operating Income ÷ Total Stockholders Equity) × 100',
    valueString: `${roe.toFixed(1)}%`,
    numericValue: roe,
    benchmark: '> 15.0%',
    status: roe >= 15 ? 'strong' : roe >= 5 ? 'adequate' : 'caution',
    statusText: roe >= 15 ? 'Superior Return' : 'Moderate Return',
    interpretation: `Measures the profitability of shareholders' investments, producing a ${roe.toFixed(1)}% annualized return on equity capital.`,
  });

  // --- 3. SOLVENCY & CAPITAL STRUCTURE ---
  // Debt-to-Equity Ratio
  const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;
  ratios.push({
    id: 'debt-to-equity',
    name: 'Debt-to-Equity Ratio',
    category: 'solvency',
    formula: 'Total Liabilities ÷ Total Stockholders Equity',
    valueString: `${debtToEquity.toFixed(2)}x`,
    numericValue: debtToEquity,
    benchmark: '< 1.50x',
    status: debtToEquity <= 1.0 ? 'strong' : debtToEquity <= 2.0 ? 'adequate' : 'caution',
    statusText: debtToEquity <= 1.0 ? 'Low Leverage' : debtToEquity <= 2.0 ? 'Moderate Leverage' : 'High Leverage',
    interpretation: debtToEquity <= 1.0
      ? `The business is predominantly funded by equity capital (${debtToEquity.toFixed(2)} debt per 1.00 equity), signifying strong long-term solvency.`
      : 'Creditor financing is substantial relative to owner equity.',
  });

  // Debt-to-Assets Ratio
  const debtToAssets = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  ratios.push({
    id: 'debt-to-assets',
    name: 'Debt-to-Assets Ratio',
    category: 'solvency',
    formula: '(Total Liabilities ÷ Total Assets) × 100',
    valueString: `${debtToAssets.toFixed(1)}%`,
    numericValue: debtToAssets,
    benchmark: '< 50.0%',
    status: debtToAssets <= 40 ? 'strong' : debtToAssets <= 60 ? 'adequate' : 'caution',
    statusText: debtToAssets <= 40 ? 'Safe Solvency' : 'Moderate',
    interpretation: `Creditors have financed ${debtToAssets.toFixed(1)}% of total company assets, with the remaining owned outright by shareholders.`,
  });

  // Equity Ratio
  const equityRatio = totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0;
  ratios.push({
    id: 'equity-ratio',
    name: 'Equity-to-Assets Ratio',
    category: 'solvency',
    formula: '(Total Equity ÷ Total Assets) × 100',
    valueString: `${equityRatio.toFixed(1)}%`,
    numericValue: equityRatio,
    benchmark: '> 50.0%',
    status: equityRatio >= 50 ? 'strong' : 'adequate',
    statusText: equityRatio >= 50 ? 'Self-Funded' : 'Leveraged',
    interpretation: `Owners retain a ${equityRatio.toFixed(1)}% unencumbered stake in the total balance sheet capital of the business.`,
  });

  // --- 4. OPERATING EFFICIENCY ---
  // Asset Turnover
  const assetTurnover = totalAssets > 0 ? totalRevenue / totalAssets : 0;
  ratios.push({
    id: 'asset-turnover',
    name: 'Asset Turnover Ratio',
    category: 'efficiency',
    formula: 'Total Revenue ÷ Total Assets',
    valueString: `${assetTurnover.toFixed(2)}x`,
    numericValue: assetTurnover,
    benchmark: '> 0.80x to 1.50x',
    status: assetTurnover >= 1.0 ? 'strong' : 'adequate',
    statusText: assetTurnover >= 1.0 ? 'High Efficiency' : 'Moderate',
    interpretation: `Every 1.00 of total balance sheet assets generates ${currencySymbol}${assetTurnover.toFixed(2)} in commercial sales volume.`,
  });

  // Inventory Turnover (if inventory exists)
  if (inventoryTotal > 0 && totalCOGS > 0) {
    const inventoryTurnover = totalCOGS / inventoryTotal;
    const dsi = (inventoryTotal / totalCOGS) * 365;

    ratios.push({
      id: 'inv-turnover',
      name: 'Inventory Turnover',
      category: 'efficiency',
      formula: 'Cost of Goods Sold ÷ Ending Inventory Balance',
      valueString: `${inventoryTurnover.toFixed(2)}x`,
      numericValue: inventoryTurnover,
      benchmark: '> 4.00x to 8.00x / year',
      status: inventoryTurnover >= 3.0 ? 'strong' : 'adequate',
      statusText: 'Active Stock Cycle',
      interpretation: `The business turns over and sells its physical merchandise ${inventoryTurnover.toFixed(2)} times throughout the fiscal cycle.`,
    });

    ratios.push({
      id: 'dsi',
      name: 'Days Sales in Inventory (DSI)',
      category: 'efficiency',
      formula: '(Ending Inventory ÷ COGS) × 365 days',
      valueString: `${Math.round(dsi)} days`,
      numericValue: dsi,
      benchmark: '< 60 to 90 days',
      status: dsi <= 90 ? 'strong' : 'adequate',
      statusText: 'Healthy Turnover Speed',
      interpretation: `It takes approximately ${Math.round(dsi)} days from initial inventory receipt to final customer shipment and cost recognition.`,
    });
  }

  const filteredRatios = selectedCategory === 'all' 
    ? ratios 
    : ratios.filter((r) => r.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Intro Header Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">
              Financial Ratios & Analytical Performance Index
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Key financial ratios derived from the Statement of Financial Position and Statement of Comprehensive Income. Essential for evaluating liquidity risk, operational profitability, leverage solvency, and capital turnover.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs self-start sm:self-auto">
          Period: {dateRangeText}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: 'all', label: 'All Ratios', icon: Compass },
          { id: 'liquidity', label: 'Liquidity & Working Capital', icon: Activity },
          { id: 'profitability', label: 'Profitability & Returns', icon: TrendingUp },
          { id: 'solvency', label: 'Solvency & Leverage', icon: ShieldCheck },
          { id: 'efficiency', label: 'Operating Efficiency', icon: Zap },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as RatioCategory)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Ratios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRatios.map((ratio) => {
          const statusBadge = 
            ratio.status === 'strong'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : ratio.status === 'adequate'
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : 'bg-amber-50 text-amber-700 border-amber-200';

          return (
            <div
              key={ratio.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      {ratio.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {ratio.name}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}
                  >
                    {ratio.statusText}
                  </span>
                </div>

                {/* Big Metric Display */}
                <div className="my-3">
                  <span className="text-2xl font-black font-mono-num text-slate-900 tracking-tight block">
                    {ratio.valueString}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Benchmark: {ratio.benchmark}
                  </span>
                </div>

                {/* Formula Line */}
                <div className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 text-[10px] font-mono-num text-slate-600 mb-3 truncate">
                  {ratio.formula}
                </div>

                {/* Interpretation */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {ratio.interpretation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
