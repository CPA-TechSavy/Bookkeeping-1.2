import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Account, 
  BalanceSheetReport, 
  CompanyProfile, 
  IncomeStatementReport, 
  InventoryItem, 
  JournalEntry, 
  TrialBalanceReport 
} from '../types';
import { 
  formatTaxId, 
  buildNotesToFSData, 
  buildFinancialRatiosData,
  FormattedNoteSection
} from '../services/accountingEngine';

export interface LedgerEntryRow {
  date: string;
  entryNumber: string;
  description: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Safely formats currency for jsPDF (WinAnsi/Latin-1 compatible).
 * Prevents non-Latin-1 glyphs (like PHP ₱) from breaking font rendering.
 */
export function safeFormatCurrencyForPDF(
  amount: number, 
  symbol = '$', 
  currencyCode = 'USD'
): string {
  let safeSymbol = symbol || '$';
  if (safeSymbol.charCodeAt(0) > 255) {
    if (currencyCode === 'PHP' || safeSymbol === '₱') {
      safeSymbol = 'PHP ';
    } else if (currencyCode) {
      safeSymbol = `${currencyCode} `;
    } else {
      safeSymbol = '$';
    }
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  if (isNegative) {
    return `(${safeSymbol}${formatted})`;
  }
  return `${safeSymbol}${formatted}`;
}

/**
 * Generates a publication-grade, professional PDF for an Account's General Ledger.
 * Perfectly aligned with the UI preview: sans-serif typography, right-aligned headers & amounts, generous widths.
 */
export function generateAccountLedgerPDF({
  company,
  account,
  dateRangeText,
  openingBalance,
  rows,
  totalDebits,
  totalCredits,
  endingBalance,
}: {
  company: CompanyProfile;
  account: Account;
  dateRangeText: string;
  openingBalance: number;
  rows: LedgerEntryRow[];
  totalDebits: number;
  totalCredits: number;
  endingBalance: number;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currencySymbol = company.currencySymbol || '$';
  const currencyCode = company.currency || 'USD';

  // --- Header Bar ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 44, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('GENERAL LEDGER ACCOUNT STATEMENT', 40, 27);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('OFFICIAL BOOKKEEPING RECORD', pageWidth - 40, 27, { align: 'right' });

  // Company and Account Meta Box
  let y = 62;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 40, y);

  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600
  const formattedTin = formatTaxId(company.taxId) || company.taxId || 'N/A';
  doc.text(`TIN/EIN: ${formattedTin}  •  Legal Structure: ${company.entityType}`, 40, y);

  if (company.address?.street) {
    y += 12;
    doc.text(`${company.address.street}, ${company.address.city}, ${company.address.state} ${company.address.zip}`, 40, y);
  }

  y += 16;
  // Account Information Banner
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(40, y, pageWidth - 80, 48, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${account.code} - ${account.name}`, 52, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Classification: ${account.type} • Subtype: ${account.subtype} • Normal Balance: ${account.normalBalance}`,
    52,
    y + 34
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Period: ${dateRangeText}`, pageWidth - 52, y + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - 52,
    y + 34,
    { align: 'right' }
  );

  // Table Data Preparation
  const tableData: any[][] = [];

  // Opening Balance Row
  tableData.push([
    '--',
    '--',
    'Beginning / Opening Balance as of Filter Date',
    '--',
    '--',
    safeFormatCurrencyForPDF(openingBalance, currencySymbol, currencyCode),
  ]);

  rows.forEach((r) => {
    const descText = r.memo && r.memo !== r.description
      ? `${r.description}\n[Memo: ${r.memo}]`
      : r.description;

    tableData.push([
      r.date,
      r.entryNumber,
      descText,
      r.debit > 0 ? safeFormatCurrencyForPDF(r.debit, currencySymbol, currencyCode) : '--',
      r.credit > 0 ? safeFormatCurrencyForPDF(r.credit, currencySymbol, currencyCode) : '--',
      safeFormatCurrencyForPDF(r.runningBalance, currencySymbol, currencyCode),
    ]);
  });

  autoTable(doc, {
    startY: y + 58,
    margin: { left: 40, right: 40, bottom: 45 },
    head: [['Date', 'Entry #', 'Description / Details', 'Debit', 'Credit', 'Balance']],
    body: tableData,
    foot: [
      [
        'Total Activity',
        '',
        `Period Transactions: ${rows.length}`,
        safeFormatCurrencyForPDF(totalDebits, currencySymbol, currencyCode),
        safeFormatCurrencyForPDF(totalCredits, currencySymbol, currencyCode),
        safeFormatCurrencyForPDF(endingBalance, currencySymbol, currencyCode),
      ],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 6,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 5.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 65, halign: 'left' },
      1: { cellWidth: 72, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 80, halign: 'right' },
      4: { cellWidth: 80, halign: 'right' },
      5: { cellWidth: 85, halign: 'right', fontStyle: 'bold' },
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [148, 163, 184],
      lineWidth: 1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (hookData) => {
      // Ensure header and footer cells for numeric columns are strictly right aligned
      if (hookData.section === 'head' && [3, 4, 5].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
      if (hookData.section === 'foot' && [3, 4, 5].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `EntityBooks Accounting System • General Ledger Statement • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 18,
        { align: 'center' }
      );
    },
  });

  const filename = `Ledger_${account.code}_${account.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Generates a comprehensive General Ledger & Journal Book Register PDF.
 * Eliminates crooked wrapping by using generous column dimensions, right-aligned headers, and clean sans-serif typography.
 */
export function generateGeneralLedgerPDF({
  company,
  journalEntries,
  dateRangeText,
}: {
  company: CompanyProfile;
  journalEntries: JournalEntry[];
  dateRangeText: string;
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currencySymbol = company.currencySymbol || '$';
  const currencyCode = company.currency || 'USD';

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('GENERAL JOURNAL & GENERAL LEDGER AUDIT REGISTER', 40, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - 40,
    26,
    { align: 'right' }
  );

  let y = 58;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 40, y);

  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const formattedTin = formatTaxId(company.taxId) || company.taxId || 'N/A';
  doc.text(`TIN/EIN: ${formattedTin}  •  Legal Structure: ${company.entityType}  •  Reporting Period: ${dateRangeText}`, 40, y);

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  const tableData: any[][] = [];

  journalEntries.forEach((je) => {
    je.lines.forEach((line, idx) => {
      grandTotalDebit += Number(line.debit) || 0;
      grandTotalCredit += Number(line.credit) || 0;

      tableData.push([
        idx === 0 ? je.date : '',
        idx === 0 ? je.entryNumber : '',
        idx === 0 ? je.description : '',
        `${line.accountCode} - ${line.accountName}`,
        line.memo || '--',
        line.debit > 0 ? safeFormatCurrencyForPDF(line.debit, currencySymbol, currencyCode) : '--',
        line.credit > 0 ? safeFormatCurrencyForPDF(line.credit, currencySymbol, currencyCode) : '--',
        idx === 0 ? je.status : '',
      ]);
    });
  });

  autoTable(doc, {
    startY: y + 16,
    margin: { left: 40, right: 40, bottom: 42 },
    head: [
      [
        'Date',
        'Entry #',
        'Transaction Description',
        'Account Title & Code',
        'Memo / Details',
        'Debit',
        'Credit',
        'Status',
      ],
    ],
    body: tableData,
    foot: [
      [
        'Total',
        '',
        `Total Journal Entries: ${journalEntries.length}`,
        '',
        '',
        safeFormatCurrencyForPDF(grandTotalDebit, currencySymbol, currencyCode),
        safeFormatCurrencyForPDF(grandTotalCredit, currencySymbol, currencyCode),
        grandTotalDebit.toFixed(2) === grandTotalCredit.toFixed(2) ? 'Balanced' : 'Discrepancy',
      ],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 6,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left' },
      1: { cellWidth: 68, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 155, halign: 'left' },
      3: { cellWidth: 155, halign: 'left', fontStyle: 'bold' },
      4: { cellWidth: 'auto', halign: 'left' },
      5: { cellWidth: 82, halign: 'right' },
      6: { cellWidth: 82, halign: 'right' },
      7: { cellWidth: 46, halign: 'center' },
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [148, 163, 184],
      lineWidth: 1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (hookData) => {
      // Header and footer numeric columns alignment
      if (hookData.section === 'head' && [5, 6].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
      if (hookData.section === 'foot' && [5, 6].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `EntityBooks General Journal Audit Register • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 16,
        { align: 'center' }
      );
    },
  });

  const safeCompanyName = company.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`General_Ledger_${safeCompanyName}.pdf`);
}

/**
 * Generates an official Single Journal Entry Voucher PDF.
 */
export function generateSingleJournalEntryPDF({
  company,
  entry,
}: {
  company: CompanyProfile;
  entry: JournalEntry;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currencySymbol = company.currencySymbol || '$';
  const currencyCode = company.currency || 'USD';

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL JOURNAL VOUCHER', 40, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`VOUCHER #${entry.entryNumber}`, pageWidth - 40, 26, { align: 'right' });

  // Company Information
  let y = 62;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 40, y);

  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const formattedTin = formatTaxId(company.taxId) || company.taxId || 'N/A';
  doc.text(`TIN/EIN: ${formattedTin}  •  Structure: ${company.entityType}`, 40, y);

  y += 16;
  // Voucher Meta Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(40, y, pageWidth - 80, 56, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Date: ${entry.date}`, 52, y + 18);
  doc.text(`Status: ${entry.status}`, 52, y + 34);
  if (entry.reference) {
    doc.text(`Reference: ${entry.reference}`, 52, y + 48);
  }

  doc.setFont('helvetica', 'normal');
  doc.text(`Description: ${entry.description}`, 220, y + 18, { maxWidth: pageWidth - 280 });

  let totalDebit = 0;
  let totalCredit = 0;

  const tableData = entry.lines.map((l) => {
    totalDebit += Number(l.debit) || 0;
    totalCredit += Number(l.credit) || 0;
    return [
      l.accountCode,
      l.accountName,
      l.memo || '--',
      l.debit > 0 ? safeFormatCurrencyForPDF(l.debit, currencySymbol, currencyCode) : '--',
      l.credit > 0 ? safeFormatCurrencyForPDF(l.credit, currencySymbol, currencyCode) : '--',
    ];
  });

  autoTable(doc, {
    startY: y + 68,
    margin: { left: 40, right: 40, bottom: 100 },
    head: [['Account Code', 'Account Title', 'Memo / Particulars', 'Debit', 'Credit']],
    body: tableData,
    foot: [
      [
        'Total',
        '',
        totalDebit.toFixed(2) === totalCredit.toFixed(2) ? 'VERIFIED BALANCED' : 'OUT OF BALANCE',
        safeFormatCurrencyForPDF(totalDebit, currencySymbol, currencyCode),
        safeFormatCurrencyForPDF(totalCredit, currencySymbol, currencyCode),
      ],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 6,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 80, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 160, halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 90, halign: 'right' },
      4: { cellWidth: 90, halign: 'right' },
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [148, 163, 184],
      lineWidth: 1,
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && [3, 4].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
      if (hookData.section === 'foot' && [3, 4].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
    },
  });

  // Signature / Approval Block
  const finalY = (doc as any).lastAutoTable.finalY + 35;
  if (finalY < pageHeight - 70) {
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(40, finalY, 190, finalY);
    doc.line(230, finalY, 380, finalY);
    doc.line(420, finalY, 555, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared By / Bookkeeper', 40, finalY + 12);
    doc.text('Verified By / Controller', 230, finalY + 12);
    doc.text('Approved By / Officer', 420, finalY + 12);
  }

  doc.save(`Journal_Voucher_${entry.entryNumber}.pdf`);
}

/**
 * Generates an official, publication-grade Financial Statement PDF.
 * Fixes user request 2 by providing real PDF downloads for all Reports!
 */
export function generateFinancialReportPDF({
  company,
  reportType,
  incomeStatement,
  balanceSheet,
  trialBalance,
  cashFlowData,
  notesData,
  ratiosData,
  dateRangeText,
}: {
  company: CompanyProfile;
  reportType: 'income_statement' | 'balance_sheet' | 'trial_balance' | 'cash_flows' | 'notes_to_fs' | 'ratios';
  incomeStatement: IncomeStatementReport;
  balanceSheet: BalanceSheetReport;
  trialBalance: TrialBalanceReport;
  cashFlowData?: {
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashChange: number;
    beginningCashBalance: number;
    endingCashBalance: number;
  };
  notesData?: FormattedNoteSection[];
  ratiosData?: Array<{
    category: string;
    name: string;
    formula: string;
    value: string;
    status: string;
    interpretation: string;
  }>;
  dateRangeText: string;
}) {
  const isLandscape = reportType === 'notes_to_fs' || reportType === 'ratios';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currencySymbol = company.currencySymbol || '$';
  const currencyCode = company.currency || 'USD';

  // Report Titles map
  const titles: Record<string, string> = {
    income_statement: 'STATEMENT OF COMPREHENSIVE INCOME (P&L)',
    balance_sheet: 'STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)',
    trial_balance: 'OFFICIAL TRIAL BALANCE AUDIT SCHEDULE',
    cash_flows: 'STATEMENT OF CASH FLOWS',
    notes_to_fs: 'NOTES TO FINANCIAL STATEMENTS (ACCOUNT COMPOSITION)',
    ratios: 'KEY FINANCIAL RATIOS & PERFORMANCE METRICS',
  };

  const reportTitle = titles[reportType] || 'FINANCIAL STATEMENT';

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle, 40, 26);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Official Record • ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - 40,
    26,
    { align: 'right' }
  );

  let y = 60;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 40, y);

  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const formattedTin = formatTaxId(company.taxId) || company.taxId || 'N/A';
  doc.text(
    `TIN/EIN: ${formattedTin}  •  Legal Structure: ${company.entityType}  •  Accounting Basis: ${company.accountingMethod}  •  Currency: ${company.currency}`,
    40,
    y
  );

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Period: ${dateRangeText}`, 40, y);

  // 1. INCOME STATEMENT PDF
  if (reportType === 'income_statement') {
    const rows: any[][] = [];
    rows.push([{ content: '1. OPERATING REVENUE', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
    incomeStatement.revenues.forEach((r) => {
      rows.push([`   ${r.code} - ${r.name}`, safeFormatCurrencyForPDF(r.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Operating Revenues', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(incomeStatement.totalRevenue, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: '2. COST OF GOODS SOLD (COGS)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
    incomeStatement.cogs.forEach((c) => {
      rows.push([`   ${c.code} - ${c.name}`, safeFormatCurrencyForPDF(c.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Cost of Goods Sold', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(incomeStatement.totalCOGS, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: 'GROSS PROFIT', styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87] } }, { content: safeFormatCurrencyForPDF(incomeStatement.grossProfit, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [4, 120, 87] } }]);

    rows.push([{ content: '3. OPERATING EXPENSES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
    incomeStatement.expenses.forEach((e) => {
      rows.push([`   ${e.code} - ${e.name} (${e.subtype})`, safeFormatCurrencyForPDF(e.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Operating Expenses', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(incomeStatement.totalExpenses, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: 'NET OPERATING INCOME (NET PROFIT)', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: safeFormatCurrencyForPDF(incomeStatement.netOperatingIncome, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }]);

    autoTable(doc, {
      startY: y + 15,
      margin: { left: 40, right: 40, bottom: 45 },
      head: [['Line Item / Account Classification', 'Amount']],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 120, halign: 'right' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 1) {
          hookData.cell.styles.halign = 'right';
        }
      },
    });
  }

  // 2. BALANCE SHEET PDF
  else if (reportType === 'balance_sheet') {
    const rows: any[][] = [];
    rows.push([{ content: 'ASSETS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
    rows.push([{ content: 'Current Assets', colSpan: 2, styles: { fontStyle: 'bold' } }]);
    balanceSheet.currentAssets.forEach((a) => {
      rows.push([`   ${a.code} - ${a.name}`, safeFormatCurrencyForPDF(a.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Current Assets', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalCurrentAssets, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: 'Non-Current Assets / Fixed Assets', colSpan: 2, styles: { fontStyle: 'bold' } }]);
    balanceSheet.nonCurrentAssets.forEach((a) => {
      rows.push([`   ${a.code} - ${a.name}`, safeFormatCurrencyForPDF(a.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Non-Current Assets', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalNonCurrentAssets, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: 'TOTAL ASSETS', styles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [67, 56, 202] } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalAssets, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [67, 56, 202] } }]);

    rows.push([{ content: 'LIABILITIES & STOCKHOLDERS EQUITY', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
    rows.push([{ content: 'Current Liabilities', colSpan: 2, styles: { fontStyle: 'bold' } }]);
    balanceSheet.currentLiabilities.forEach((l) => {
      rows.push([`   ${l.code} - ${l.name}`, safeFormatCurrencyForPDF(l.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Current Liabilities', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalCurrentLiabilities, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    rows.push([{ content: 'Long-Term Liabilities', colSpan: 2, styles: { fontStyle: 'bold' } }]);
    balanceSheet.longTermLiabilities.forEach((l) => {
      rows.push([`   ${l.code} - ${l.name}`, safeFormatCurrencyForPDF(l.amount, currencySymbol, currencyCode)]);
    });
    rows.push([{ content: 'Total Liabilities', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalLiabilities, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);

    // EQUITY SECTION (Entity-Specific Breakdown)
    if (company.entityType === 'Single Proprietorship' || company.entityType === 'Sole Proprietorship') {
      const sp = balanceSheet.soleProprietorEquity;
      rows.push([{ content: "OWNER'S EQUITY (SOLE PROPRIETORSHIP)", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
      rows.push([`   Owner's Capital, Beginning Balance`, safeFormatCurrencyForPDF(sp?.beginningCapital || 0, currencySymbol, currencyCode)]);
      rows.push([`   Add: Additional Investments Contributed`, safeFormatCurrencyForPDF(sp?.additionalInvestments || 0, currencySymbol, currencyCode)]);
      rows.push([`   Add: Current Period Net Operating Income`, safeFormatCurrencyForPDF(sp?.netIncome || 0, currencySymbol, currencyCode)]);
      if ((sp?.drawings || 0) > 0) {
        rows.push([`   Less: Owner's Personal Drawings`, safeFormatCurrencyForPDF(-(sp?.drawings || 0), currencySymbol, currencyCode)]);
      }
      rows.push([{ content: "Total Owner's Capital, Ending Balance", styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(sp?.endingCapital || balanceSheet.totalEquity, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);
    } else if (company.entityType === 'Partnership') {
      const pe = balanceSheet.partnershipEquity;
      rows.push([{ content: "PARTNERS' EQUITY / CAPITAL (PARTNERSHIP)", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
      pe?.partners.forEach((p) => {
        rows.push([{ content: `   ${p.name} (Profit Share: ${p.profitSharePercentage}%)`, colSpan: 2, styles: { fontStyle: 'bold' } }]);
        rows.push([`      Beginning Capital Balance`, safeFormatCurrencyForPDF(p.beginningCapital, currencySymbol, currencyCode)]);
        if (p.additionalInvestments > 0) {
          rows.push([`      Add: Additional Investments`, safeFormatCurrencyForPDF(p.additionalInvestments, currencySymbol, currencyCode)]);
        }
        rows.push([`      Add: Share of Net Income (${p.profitSharePercentage}%)`, safeFormatCurrencyForPDF(p.shareOfNetIncome, currencySymbol, currencyCode)]);
        if (p.drawings > 0) {
          rows.push([`      Less: Partner Drawings`, safeFormatCurrencyForPDF(-p.drawings, currencySymbol, currencyCode)]);
        }
        rows.push([`      Ending Capital Balance`, safeFormatCurrencyForPDF(p.endingCapital, currencySymbol, currencyCode)]);
      });
      rows.push([{ content: "Total Partners' Capital", styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(pe?.totalPartnersCapital || balanceSheet.totalEquity, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);
    } else {
      // Corporation / Cooperative
      const corp = balanceSheet.corporationEquity;
      rows.push([{ content: "SHAREHOLDERS' EQUITY (CORPORATION)", colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
      rows.push([{ content: '   Capital Stock', colSpan: 2, styles: { fontStyle: 'bold' } }]);
      rows.push([`      Authorized Capital Stock (${(corp?.authorizedShares || 0).toLocaleString()} shares @ ${currencySymbol}${corp?.parValuePerShare || 10} par)`, safeFormatCurrencyForPDF(corp?.authorizedCapitalStock || 0, currencySymbol, currencyCode)]);
      rows.push([`      Paid-Up Share Capital (Subscribed & Paid)`, safeFormatCurrencyForPDF(corp?.paidUpCapital || 0, currencySymbol, currencyCode)]);
      rows.push([{ content: '   Retained Earnings', colSpan: 2, styles: { fontStyle: 'bold' } }]);
      rows.push([`      Appropriated Retained Earnings (Reserve)`, safeFormatCurrencyForPDF(corp?.appropriatedRetainedEarnings || 0, currencySymbol, currencyCode)]);
      rows.push([`      Unappropriated Retained Earnings (Cumulative)`, safeFormatCurrencyForPDF(corp?.unappropriatedRetainedEarnings || 0, currencySymbol, currencyCode)]);
      rows.push([{ content: 'Total Shareholders Equity', styles: { fontStyle: 'bold' } }, { content: safeFormatCurrencyForPDF(corp?.totalShareholdersEquity || balanceSheet.totalEquity, currencySymbol, currencyCode), styles: { fontStyle: 'bold' } }]);
    }

    rows.push([{ content: 'TOTAL LIABILITIES & EQUITY', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: safeFormatCurrencyForPDF(balanceSheet.totalLiabilitiesAndEquity, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }]);

    autoTable(doc, {
      startY: y + 15,
      margin: { left: 40, right: 40, bottom: 45 },
      head: [['Statement of Financial Position Item', 'Balance']],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 120, halign: 'right' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 1) {
          hookData.cell.styles.halign = 'right';
        }
      },
    });
  }

  // 3. TRIAL BALANCE PDF
  else if (reportType === 'trial_balance') {
    const rows = trialBalance.rows.map((r) => [
      r.code,
      r.name,
      r.type,
      r.debitBalance > 0 ? safeFormatCurrencyForPDF(r.debitBalance, currencySymbol, currencyCode) : '--',
      r.creditBalance > 0 ? safeFormatCurrencyForPDF(r.creditBalance, currencySymbol, currencyCode) : '--',
    ]);

    autoTable(doc, {
      startY: y + 15,
      margin: { left: 40, right: 40, bottom: 45 },
      head: [['Account Code', 'Account Name', 'Type', 'Debit Balance', 'Credit Balance']],
      body: rows,
      foot: [
        [
          'Total Balanced Sum',
          '',
          trialBalance.isBalanced ? 'BALANCED' : 'DISCREPANCY',
          safeFormatCurrencyForPDF(trialBalance.totalDebits, currencySymbol, currencyCode),
          safeFormatCurrencyForPDF(trialBalance.totalCredits, currencySymbol, currencyCode),
        ],
      ],
      theme: 'plain',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: {
        0: { cellWidth: 80, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 75, halign: 'left' },
        3: { cellWidth: 95, halign: 'right' },
        4: { cellWidth: 95, halign: 'right' },
      },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && [3, 4].includes(hookData.column.index)) {
          hookData.cell.styles.halign = 'right';
        }
        if (hookData.section === 'foot' && [3, 4].includes(hookData.column.index)) {
          hookData.cell.styles.halign = 'right';
        }
      },
    });
  }

  // 4. CASH FLOWS PDF
  else if (reportType === 'cash_flows' && cashFlowData) {
    const rows: any[][] = [
      [{ content: '1. Cash Flows From Operating Activities', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ['Net Operating Income', safeFormatCurrencyForPDF(incomeStatement.netOperatingIncome, currencySymbol, currencyCode)],
      ['Net Cash Provided by Operating Activities', safeFormatCurrencyForPDF(cashFlowData.operatingCashFlow, currencySymbol, currencyCode)],

      [{ content: '2. Cash Flows From Investing Activities', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ['Capital Expenditures (Equipment & Infrastructure)', safeFormatCurrencyForPDF(cashFlowData.investingCashFlow, currencySymbol, currencyCode)],
      ['Net Cash Used in Investing Activities', safeFormatCurrencyForPDF(cashFlowData.investingCashFlow, currencySymbol, currencyCode)],

      [{ content: '3. Cash Flows From Financing Activities', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ['Capital Contributions / Stock Subscriptions', safeFormatCurrencyForPDF(cashFlowData.financingCashFlow, currencySymbol, currencyCode)],
      ['Net Cash Provided by Financing Activities', safeFormatCurrencyForPDF(cashFlowData.financingCashFlow, currencySymbol, currencyCode)],

      [{ content: 'Cash and Cash Equivalents Summary', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ['Beginning Cash & Cash Equivalents', safeFormatCurrencyForPDF(cashFlowData.beginningCashBalance, currencySymbol, currencyCode)],
      ['Net Change in Cash Position', safeFormatCurrencyForPDF(cashFlowData.netCashChange, currencySymbol, currencyCode)],
      [{ content: 'Ending Cash Balance', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: safeFormatCurrencyForPDF(cashFlowData.endingCashBalance, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }],
    ];

    autoTable(doc, {
      startY: y + 15,
      margin: { left: 40, right: 40, bottom: 45 },
      head: [['Cash Flow Activity', 'Amount']],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 5.5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 130, halign: 'right' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 1) {
          hookData.cell.styles.halign = 'right';
        }
      },
    });
  }

  // 5. NOTES TO FINANCIAL STATEMENTS PDF
  else if (reportType === 'notes_to_fs') {
    const finalNotes = notesData && notesData.length > 0 
      ? notesData 
      : buildNotesToFSData(company, [], balanceSheet, incomeStatement);

    let currentY = y + 15;
    finalNotes.forEach((note) => {
      // Check for page overflow
      if (currentY > pageHeight - 110) {
        doc.addPage();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${company.name} • NOTES TO FINANCIAL STATEMENTS (Continued)`, 40, 18);
        currentY = 46;
      }

      // Note Header Card
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(40, currentY, pageWidth - 80, 22, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`${note.noteNumber}: ${note.title}`, 48, currentY + 14);

      if (note.total !== 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: ${safeFormatCurrencyForPDF(note.total, currencySymbol, currencyCode)}`, pageWidth - 48, currentY + 14, { align: 'right' });
      }

      currentY += 28;

      // Note Description text if available
      if (note.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        const splitDesc = doc.splitTextToSize(note.description, pageWidth - 80);
        doc.text(splitDesc, 40, currentY);
        currentY += splitDesc.length * 9.5 + 8;
      }

      // Items Table if present
      if (note.items && note.items.length > 0) {
        const rows = note.items.map((it) => [
          it.code,
          it.name,
          it.subtype,
          it.detail,
          safeFormatCurrencyForPDF(it.balance, currencySymbol, currencyCode),
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: 40, right: 40, bottom: 45 },
          head: [['Code', 'Account Title', 'Classification', 'Narrative Disclosure / Terms', 'Balance']],
          body: rows,
          foot: note.total !== 0 ? [[note.totalLabel || 'Total', '', '', '', safeFormatCurrencyForPDF(note.total, currencySymbol, currencyCode)]] : undefined,
          theme: 'plain',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
          styles: { font: 'helvetica', fontSize: 7, cellPadding: 3.5, lineColor: [226, 232, 240], lineWidth: 0.5 },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 140 },
            2: { cellWidth: 95 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 85, halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (hookData) => {
            if (hookData.section === 'head' && hookData.column.index === 4) {
              hookData.cell.styles.halign = 'right';
            }
            if (hookData.section === 'foot' && hookData.column.index === 4) {
              hookData.cell.styles.halign = 'right';
            }
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 16;
      } else {
        currentY += 8;
      }
    });
  }

  // 6. FINANCIAL RATIOS PDF
  else if (reportType === 'ratios') {
    const finalRatios = ratiosData && ratiosData.length > 0
      ? ratiosData
      : buildFinancialRatiosData(company, balanceSheet, incomeStatement);

    const rows = finalRatios.map((r) => [
      r.category,
      r.name,
      r.formula,
      r.value,
      r.status,
      r.interpretation,
    ]);

    autoTable(doc, {
      startY: y + 15,
      margin: { left: 40, right: 40, bottom: 45 },
      head: [['Category', 'Ratio Name', 'Formula Basis', 'Value', 'Status', 'Financial Interpretation']],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 110, fontStyle: 'bold' },
        2: { cellWidth: 130 },
        3: { cellWidth: 65, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 70, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 3) {
          hookData.cell.styles.halign = 'right';
        }
        if (hookData.section === 'head' && hookData.column.index === 4) {
          hookData.cell.styles.halign = 'center';
        }
      },
    });
  }

  const safeCompanyName = company.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${reportType.toUpperCase()}_${safeCompanyName}.pdf`);
}

/**
 * Generates an Inventory & Cost of Goods Sold Schedule PDF.
 */
export function generateInventoryPDF({
  company,
  inventoryItems,
  beginningInventory,
  purchases,
  endingInventory,
  computedCOGS,
  dateRangeText,
}: {
  company: CompanyProfile;
  inventoryItems: InventoryItem[];
  beginningInventory: number;
  purchases: number;
  endingInventory: number;
  computedCOGS: number;
  dateRangeText: string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currencySymbol = company.currencySymbol || '$';
  const currencyCode = company.currency || 'USD';

  // Top header banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('INVENTORY VALUATION & COST OF GOODS SOLD SCHEDULE', 40, 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - 40,
    26,
    { align: 'right' }
  );

  let y = 62;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, 40, y);

  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const formattedTin = formatTaxId(company.taxId) || company.taxId || 'N/A';
  doc.text(`TIN/EIN: ${formattedTin}  •  Legal Structure: ${company.entityType}  •  Period: ${dateRangeText}`, 40, y);

  y += 16;
  // COGS Computation Summary Box
  const cogsRows: any[][] = [
    ['Beginning Inventory (Ending Balance of Inventory from last year carried forward to current year)', safeFormatCurrencyForPDF(beginningInventory, currencySymbol, currencyCode)],
    ['Add: Purchases of Inventory from the current year', safeFormatCurrencyForPDF(purchases, currencySymbol, currencyCode)],
    [{ content: 'Cost of Goods Available for Sale (COGAS)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: safeFormatCurrencyForPDF(beginningInventory + purchases, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['Less: Ending Inventory (Reported in Balance Sheet under Current Assets as a Real Account)', safeFormatCurrencyForPDF(-endingInventory, currencySymbol, currencyCode)],
    [{ content: 'COST OF GOODS SOLD (Reported in Income Statement as a Nominal Account)', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: safeFormatCurrencyForPDF(computedCOGS, currencySymbol, currencyCode), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [['Cost of Goods Sold (COGS) Computation Formula', 'Amount']],
    body: cogsRows,
    theme: 'plain',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 120, halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && hookData.column.index === 1) {
        hookData.cell.styles.halign = 'right';
      }
    },
  });

  const nextY = (doc as any).lastAutoTable.finalY + 20;

  // Inventory Items Table
  let totalValuation = 0;
  const itemRows = inventoryItems.map((item) => {
    const val = item.quantityOnHand * item.unitCost;
    totalValuation += val;
    return [
      item.sku,
      item.name,
      item.category,
      `${item.quantityOnHand} ${item.unit}`,
      safeFormatCurrencyForPDF(item.unitCost, currencySymbol, currencyCode),
      safeFormatCurrencyForPDF(item.unitPrice, currencySymbol, currencyCode),
      safeFormatCurrencyForPDF(val, currencySymbol, currencyCode),
    ];
  });

  autoTable(doc, {
    startY: nextY,
    margin: { left: 40, right: 40, bottom: 45 },
    head: [['SKU', 'Product Name', 'Category', 'Stock Qty', 'Unit Cost', 'Unit Price', 'Total Valuation']],
    body: itemRows,
    foot: [
      [
        'Total Physical Inventory Valuation',
        '',
        '',
        `${inventoryItems.length} Products`,
        '',
        '',
        safeFormatCurrencyForPDF(totalValuation, currencySymbol, currencyCode),
      ],
    ],
    theme: 'plain',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4.5, lineColor: [226, 232, 240], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 130 },
      2: { cellWidth: 90 },
      3: { cellWidth: 60, halign: 'right' },
      4: { cellWidth: 65, halign: 'right' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 75, halign: 'right', fontStyle: 'bold' },
    },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && [3, 4, 5, 6].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
      if (hookData.section === 'foot' && hookData.column.index === 6) {
        hookData.cell.styles.halign = 'right';
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `EntityBooks Inventory Schedule • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 16,
        { align: 'center' }
      );
    },
  });

  const safeCompanyName = company.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Inventory_COGS_Schedule_${safeCompanyName}.pdf`);
}
