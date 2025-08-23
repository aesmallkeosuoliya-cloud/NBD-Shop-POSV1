import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Sale, Expense, StoreSettings, Language } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getExpenses, getStoreSettings, isFirebaseInitialized } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import LaoFontInstallationHelp from '../common/LaoFontInstallationHelp';
import { DEFAULT_STORE_SETTINGS, UI_COLORS } from '../../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // Import for side effects

declare var Swal: any; // SweetAlert2

// --- IMPORTANT: PDF FONT DATA ---
const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";
// --- END IMPORTANT ---

interface PnlData {
  totalSales: number;
  cogs: number;
  grossProfit: number;
  sellingExpenses: number;
  adminExpenses: number;
  totalOperatingExpenses: number;
  netProfit: number;
}

const ProfitLossPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  
  const [pnlData, setPnlData] = useState<PnlData>({
    totalSales: 0,
    cogs: 0,
    grossProfit: 0,
    sellingExpenses: 0,
    adminExpenses: 0,
    totalOperatingExpenses: 0,
    netProfit: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); 
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const localeForFormatting = language === Language.LO ? 'lo-LA' : 'th-TH';
  const currencySymbol = language === Language.LO ? t('currencyKip') : t('currencyBaht');

  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    setIsLoading(true);
    try {
      const [sales, expenses, settings] = await Promise.all([
        getSales(),
        getExpenses(),
        getStoreSettings(),
      ]);
      setAllSales(sales);
      setAllExpenses(expenses);
      setStoreSettings(settings || DEFAULT_STORE_SETTINGS);
    } catch (err) {
      console.error("Error fetching data for P&L:", err);
      Swal.fire(t('error'), t('errorFetchingData'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processReportData = useCallback(() => {
    const salesInDateRange = allSales.filter(s => 
        new Date(s.transactionDate) >= new Date(startDate) && 
        new Date(s.transactionDate) <= new Date(endDate + 'T23:59:59.999Z')
    );

    const expensesInDateRange = allExpenses.filter(e => 
        new Date(e.date) >= new Date(startDate) && 
        new Date(e.date) <= new Date(endDate + 'T23:59:59.999Z')
    );
    
    const totalSales = salesInDateRange.reduce((sum, sale) => sum + sale.grandTotal, 0);

    const cogs = expensesInDateRange
      .filter(e => e.accountingCategoryCode === 1) // 1: Cost
      .reduce((sum, exp) => sum + exp.amount, 0);

    const sellingExpenses = expensesInDateRange
      .filter(e => e.accountingCategoryCode === 2) // 2: Selling
      .reduce((sum, exp) => sum + exp.amount, 0);

    const adminExpenses = expensesInDateRange
      .filter(e => e.accountingCategoryCode === 3) // 3: Admin
      .reduce((sum, exp) => sum + exp.amount, 0);

    const grossProfit = totalSales - cogs;
    const totalOperatingExpenses = sellingExpenses + adminExpenses;
    const netProfit = grossProfit - totalOperatingExpenses;

    setPnlData({
      totalSales,
      cogs,
      grossProfit,
      sellingExpenses,
      adminExpenses,
      totalOperatingExpenses,
      netProfit,
    });
  }, [allSales, allExpenses, startDate, endDate]);

  useEffect(() => {
    if (!isLoading) {
      processReportData();
    }
  }, [isLoading, processReportData]);

  const handleApplyFilters = () => {
    processReportData();
  };

  const exportToExcel = () => {
    const pnlForExport = [
      { [t('breakdownTableTitle')]: t('totalSalesSummary'), Amount: pnlData.totalSales },
      { [t('breakdownTableTitle')]: `  ${t('cogsSummary')}`, Amount: -pnlData.cogs },
      { [t('breakdownTableTitle')]: t('grossProfitSummary'), Amount: pnlData.grossProfit },
      { [t('breakdownTableTitle')]: '', Amount: '' },
      { [t('breakdownTableTitle')]: t('expenses'), Amount: '' },
      { [t('breakdownTableTitle')]: `  ${t('accountingCategory_selling')}`, Amount: -pnlData.sellingExpenses },
      { [t('breakdownTableTitle')]: `  ${t('accountingCategory_admin')}`, Amount: -pnlData.adminExpenses },
      { [t('breakdownTableTitle')]: '', Amount: '' },
      { [t('breakdownTableTitle')]: t('netProfitSummary'), Amount: pnlData.netProfit },
    ];
    
    const ws = XLSX.utils.json_to_sheet(pnlForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('profitLossSummaryPageTitle'));
    XLSX.writeFile(wb, `${t('profitLossSummaryPageTitle')}_${startDate}_${endDate}.xlsx`);
  };

  const exportToPDF = async () => {
    try {
        const doc = new jsPDF({ unit: 'mm', orientation: 'portrait' });
        // Font setup... (same as before)
        let FONT_NAME = 'Helvetica'; 
        let FONT_FILE_NAME = '';
        let FONT_BASE64_DATA = '';
        let FONT_INTERNAL_NAME = '';
        const currentAppLanguage = language; 
        if (currentAppLanguage === 'th') {
            FONT_FILE_NAME = 'NotoSansThai-Regular.ttf'; FONT_BASE64_DATA = NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER; FONT_INTERNAL_NAME = 'NotoSansThaiCustom';
        } else if (currentAppLanguage === Language.LO) { 
            FONT_FILE_NAME = 'NotoSansLao-Regular.ttf'; FONT_BASE64_DATA = NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER; FONT_INTERNAL_NAME = 'NotoSansLaoCustom';
        }
        let customFontLoaded = false;
        if (FONT_BASE64_DATA && !FONT_BASE64_DATA.startsWith("PLACEHOLDER_")) {
            try { doc.addFileToVFS(FONT_FILE_NAME, FONT_BASE64_DATA); doc.addFont(FONT_FILE_NAME, FONT_INTERNAL_NAME, 'normal'); FONT_NAME = FONT_INTERNAL_NAME; customFontLoaded = true; } catch (e) { console.error(`Error embedding font`, e); }
        }
        if (!customFontLoaded && (currentAppLanguage === Language.LO || currentAppLanguage === 'th')) {
            const helpContainer = document.createElement('div'); const tempRoot = createRoot(helpContainer); tempRoot.render(<LaoFontInstallationHelp />);
            Swal.fire({ icon: 'warning', title: t('pdfFontNotFoundTitle'), html: helpContainer, confirmButtonText: t('confirm'), width: '800px' });
        }
        doc.setFont(FONT_NAME);
        
        doc.setFontSize(14);
        doc.text(t('profitLossSummaryPageTitle'), 14, 15);
        doc.setFontSize(10);
        doc.text(`${t('dateRangeStart')}: ${formatDate(startDate)} - ${t('dateRangeEnd')}: ${formatDate(endDate)}`, 14, 22);

        const tableBody = [
            [t('totalSalesSummary'), formatCurrency(pnlData.totalSales)],
            [`  ${t('cogsSummary')}`, `(${formatCurrency(pnlData.cogs)})`],
            [{ content: t('grossProfitSummary'), styles: { fontStyle: 'bold' } }, { content: formatCurrency(pnlData.grossProfit), styles: { fontStyle: 'bold' } }],
            ['', ''],
            [{ content: t('expenses'), styles: { fontStyle: 'bold' } }, ''],
            [`  ${t('accountingCategory_selling')}`, `(${formatCurrency(pnlData.sellingExpenses)})`],
            [`  ${t('accountingCategory_admin')}`, `(${formatCurrency(pnlData.adminExpenses)})`],
            ['', ''],
            [{ content: t('netProfitSummary'), styles: { fontStyle: 'bold' } }, { content: formatCurrency(pnlData.netProfit), styles: { fontStyle: 'bold' } }],
        ];

        (doc as any).autoTable({
          body: tableBody,
          startY: 30,
          theme: 'plain',
          styles: { font: FONT_NAME, fontSize: 10 },
          columnStyles: { 1: { halign: 'right' } },
          didDrawCell: (data: any) => {
            if (data.row.index === 2 || data.row.index === 8) { // Gross Profit and Net Profit rows
                doc.setLineWidth(0.5);
                doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                if(data.row.index === 8) { // Double line for Net Profit
                     doc.line(data.cell.x, data.cell.y + data.cell.height + 0.5, data.cell.x + data.cell.width, data.cell.y + data.cell.height + 0.5);
                }
            }
          }
        });

        doc.save(`${t('profitLossSummaryPageTitle')}_${startDate}_${endDate}.pdf`);
    } catch (err) {
        console.error("Error generating PDF:", err);
        Swal.fire(t('error'), t('pdfLibraryNotLoaded') + (err as Error).message, 'error');
    }
  };
  
  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">{t('profitLossSummaryPageTitle')}</h1>

      <Card bodyClassName="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <Input label={t('dateRangeStart')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} wrapperClassName="mb-0" />
          <Input label={t('dateRangeEnd')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} wrapperClassName="mb-0" />
          <Button onClick={handleApplyFilters} variant="primary" className="w-full md:w-auto h-11 text-base py-2.5 bg-blue-600 hover:bg-blue-700" isLoading={isLoading}>
            {t('applyFiltersButton')}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center mt-8"><LoadingSpinner text={t('loading')} /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title={t('totalSalesSummary')} className="bg-blue-100" titleClassName="text-blue-700 font-semibold"><p className="text-2xl font-bold text-blue-900">{formatCurrency(pnlData.totalSales)} {currencySymbol}</p></Card>
            <Card title={t('grossProfitSummary')} className="bg-teal-100" titleClassName="text-teal-700 font-semibold"><p className="text-2xl font-bold text-teal-900">{formatCurrency(pnlData.grossProfit)} {currencySymbol}</p></Card>
            <Card title={t('totalExpensesSummary')} className="bg-red-100" titleClassName="text-red-700 font-semibold"><p className="text-2xl font-bold text-red-900">{formatCurrency(pnlData.totalOperatingExpenses)} {currencySymbol}</p></Card>
            <Card title={t('netProfitSummary')} className={`${pnlData.netProfit >= 0 ? 'bg-green-100' : 'bg-pink-100'}`} titleClassName={`${pnlData.netProfit >= 0 ? 'text-green-700' : 'text-pink-700'} font-semibold`}><p className={`text-2xl font-bold ${pnlData.netProfit >= 0 ? 'text-green-900' : 'text-pink-900'}`}>{formatCurrency(pnlData.netProfit)} {currencySymbol}</p></Card>
          </div>

          <Card title={t('breakdownTableTitle')} bodyClassName="bg-white">
            <div className="flex justify-end mb-4 space-x-2">
                <Button onClick={exportToExcel} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">{t('exportToExcel')}</Button>
                <Button onClick={exportToPDF} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">{t('exportToPDF')}</Button>
            </div>
            <div className="space-y-2 p-4 text-gray-800 text-base max-w-2xl mx-auto">
                {/* Sales */}
                <div className="flex justify-between">
                    <span className="font-medium">{t('totalSalesSummary')}</span>
                    <span className="font-medium">{formatCurrency(pnlData.totalSales)}</span>
                </div>
                {/* COGS */}
                <div className="flex justify-between">
                    <span>{t('cogsSummary')}</span>
                    <span>({formatCurrency(pnlData.cogs)})</span>
                </div>
                {/* Gross Profit */}
                <div className="flex justify-between font-bold text-lg border-t-2 border-b-2 border-gray-800 my-2 py-1">
                    <span>{t('grossProfitSummary')}</span>
                    <span>{formatCurrency(pnlData.grossProfit)}</span>
                </div>
                {/* Expenses */}
                <div className="flex justify-between mt-4">
                    <span className="font-medium">{t('expenses')}</span>
                    <span></span>
                </div>
                <div className="flex justify-between pl-4">
                    <span>{t('accountingCategory_selling')}</span>
                    <span>({formatCurrency(pnlData.sellingExpenses)})</span>
                </div>
                <div className="flex justify-between pl-4">
                    <span>{t('accountingCategory_admin')}</span>
                    <span>({formatCurrency(pnlData.adminExpenses)})</span>
                </div>
                {/* Net Profit */}
                <div className="flex justify-between font-bold text-xl border-t-2 border-b-4 border-double border-gray-800 my-2 py-1">
                    <span>{t('netProfitSummary')}</span>
                    <span>{formatCurrency(pnlData.netProfit)}</span>
                </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProfitLossPage;