
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Sale, Expense, Product, StoreSettings, Language } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getExpenses, getProducts, getStoreSettings, isFirebaseInitialized } from '../../services/firebaseService';
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
// For Lao and Thai text to render correctly in PDFs, you MUST replace the following placeholder strings
// with the actual Base64 encoded content of your .ttf font files.
const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";
// --- END IMPORTANT ---

interface ProductCategorySummaryRow {
  categoryName: string;
  revenue: number;
  cost: number;
  profit: number;
  profitPercentage: number;
}

const ProfitLossPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  const [categorySummaryData, setCategorySummaryData] = useState<ProductCategorySummaryRow[]>([]);
  const [summaryCards, setSummaryCards] = useState({
    totalSales: 0,
    totalCOGS: 0,
    totalOtherExpenses: 0,
    netProfit: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); 
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableProductCategories, setAvailableProductCategories] = useState<string[]>([]);
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all');
  
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
      const [sales, expenses, products, settings] = await Promise.all([
        getSales(),
        getExpenses(),
        getProducts(),
        getStoreSettings(),
      ]);
      setAllSales(sales);
      setAllExpenses(expenses);
      setAllProducts(products);
      setStoreSettings(settings || DEFAULT_STORE_SETTINGS);

      const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
      setAvailableProductCategories(uniqueCategories);

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
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    
    const salesInDateRange = allSales.filter(s => 
        new Date(s.transactionDate) >= new Date(startDate) && 
        new Date(s.transactionDate) <= new Date(endDate + 'T23:59:59.999Z')
    );

    const categoryDataMap = new Map<string, { revenue: number; cost: number }>();

    salesInDateRange.forEach(sale => {
      sale.items.forEach(item => {
        const product = productMap.get(item.productId);
        if (!product) return;

        if (selectedProductCategory === 'all' || selectedProductCategory === '' || product.category === selectedProductCategory) {
          const categoryKey = product.category || t('unknown');
          const currentCategoryData = categoryDataMap.get(categoryKey) || { revenue: 0, cost: 0 };
          
          currentCategoryData.revenue += item.totalPrice;
          currentCategoryData.cost += item.quantity * product.costPrice;
          
          categoryDataMap.set(categoryKey, currentCategoryData);
        }
      });
    });
    
    const processedCategories: ProductCategorySummaryRow[] = Array.from(categoryDataMap.entries()).map(([categoryName, data]) => {
        const profit = data.revenue - data.cost;
        const profitPercentage = data.revenue !== 0 ? (profit / data.revenue) * 100 : 0;
        return {
            categoryName,
            revenue: data.revenue,
            cost: data.cost,
            profit,
            profitPercentage,
        };
    }).sort((a,b) => b.profit - a.profit); 

    setCategorySummaryData(processedCategories);

    const totalSalesForCards = processedCategories.reduce((sum, cat) => sum + cat.revenue, 0);
    const totalCOGSForCards = processedCategories.reduce((sum, cat) => sum + cat.cost, 0);
    
    const expensesInDateRange = allExpenses.filter(e => 
        new Date(e.date) >= new Date(startDate) && 
        new Date(e.date) <= new Date(endDate + 'T23:59:59.999Z')
    );
    const totalOtherExpensesForCards = expensesInDateRange.reduce((sum, exp) => sum + exp.amount, 0);

    setSummaryCards({
      totalSales: totalSalesForCards,
      totalCOGS: totalCOGSForCards,
      totalOtherExpenses: totalOtherExpensesForCards,
      netProfit: totalSalesForCards - totalCOGSForCards - totalOtherExpensesForCards,
    });

  }, [allSales, allExpenses, allProducts, startDate, endDate, selectedProductCategory, t]);

  useEffect(() => {
    if (!isLoading) {
      processReportData();
    }
  }, [isLoading, processReportData]);

  const handleApplyFilters = () => {
    processReportData();
  };

  const exportToExcel = () => {
    const dataToExport = categorySummaryData.map((row, index) => ({
      [t('tableColNo')]: index + 1,
      [t('tableColProductCategory')]: row.categoryName,
      [t('tableColRevenue')]: row.revenue,
      [t('tableColCost')]: row.cost,
      [t('tableColProfit')]: row.profit,
      [t('tableColProfitPercentage')]: row.profitPercentage.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.sheet_add_aoa(ws, [[
        t('total'), '',
        categorySummaryData.reduce((s, r) => s + r.revenue, 0),
        categorySummaryData.reduce((s, r) => s + r.cost, 0),
        categorySummaryData.reduce((s, r) => s + r.profit, 0),
        '' 
    ]], { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('profitLossSummaryPageTitle'));
    XLSX.writeFile(wb, `${t('profitLossSummaryPageTitle')}_CatSum_${startDate}_${endDate}.xlsx`);
  };

  const exportToPDF = async () => {
    try {
        const doc = new jsPDF({ unit: 'mm', orientation: 'landscape' });
        let FONT_NAME = 'Helvetica';
        let FONT_FILE_NAME = '';
        let FONT_BASE64_DATA = '';
        let FONT_INTERNAL_NAME = '';

        const currentAppLanguage = language;

        if (currentAppLanguage === 'th') {
            FONT_FILE_NAME = 'NotoSansThai-Regular.ttf';
            FONT_BASE64_DATA = NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER;
            FONT_INTERNAL_NAME = 'NotoSansThaiCustom';
        } else if (currentAppLanguage === Language.LO) { 
            FONT_FILE_NAME = 'NotoSansLao-Regular.ttf';
            FONT_BASE64_DATA = NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER;
            FONT_INTERNAL_NAME = 'NotoSansLaoCustom';
        }

        let customFontLoaded = false;
        if (FONT_BASE64_DATA && !FONT_BASE64_DATA.startsWith("PLACEHOLDER_") && (currentAppLanguage === Language.LO || currentAppLanguage === 'th')) {
            try {
                doc.addFileToVFS(FONT_FILE_NAME, FONT_BASE64_DATA);
                doc.addFont(FONT_FILE_NAME, FONT_INTERNAL_NAME, 'normal');
                FONT_NAME = FONT_INTERNAL_NAME;
                customFontLoaded = true;
                 console.log(`Custom font '${FONT_NAME}' loaded successfully for PDF for language: ${currentAppLanguage}`);
            } catch (e) {
                console.error(`Critical error embedding custom font '${FONT_INTERNAL_NAME}'. PDF will use Helvetica. Error:`, e);
            }
        }

        if (!customFontLoaded) {
            FONT_NAME = 'Helvetica'; // Explicitly fall back to Helvetica
            if (currentAppLanguage === Language.LO || currentAppLanguage === 'th') {
                const helpContainer = document.createElement('div');
                const tempRoot = createRoot(helpContainer);
                tempRoot.render(<LaoFontInstallationHelp />);
                
                Swal.fire({
                    icon: 'warning',
                    title: t('pdfFontNotFoundTitle'),
                    html: helpContainer,
                    confirmButtonText: t('confirm'),
                    width: '800px'
                });
                 const reason = (FONT_BASE64_DATA && FONT_BASE64_DATA.startsWith("PLACEHOLDER_"))
                    ? "placeholder Base64 data"
                    : "an error during font loading";
                console.warn(
                    `Custom font for ${currentAppLanguage === Language.LO ? 'Lao' : 'Thai'} was not loaded (due to ${reason}). ` +
                    `Falling back to Helvetica. A user-facing warning has been displayed.`
                );
            }
        }
        doc.setFont(FONT_NAME);
        
        doc.setFontSize(14);
        doc.text(t('profitLossSummaryPageTitle'), 14, 15);
        doc.setFontSize(10);
        doc.text(`${t('dateRangeStart')}: ${formatDate(startDate)} - ${t('dateRangeEnd')}: ${formatDate(endDate)}`, 14, 22);
        if (selectedProductCategory !== 'all' && selectedProductCategory !== '') {
            doc.text(`${t('productCategoryFilterLabel')}: ${selectedProductCategory}`, 14, 29);
        }

        const tableHeaders = [t('tableColNo'), t('tableColProductCategory'), t('tableColRevenue'), t('tableColCost'), t('tableColProfit'), t('tableColProfitPercentage')];
        const tableBody = categorySummaryData.map((row, index) => [
          index + 1,
          row.categoryName,
          formatCurrency(row.revenue),
          formatCurrency(row.cost),
          formatCurrency(row.profit),
          `${row.profitPercentage.toFixed(2)}%`
        ]);

        (doc as any).autoTable({
          head: [tableHeaders],
          body: tableBody,
          foot: [[
            '', t('total'), 
            formatCurrency(categorySummaryData.reduce((s,r) => s + r.revenue, 0)),
            formatCurrency(categorySummaryData.reduce((s,r) => s + r.cost, 0)),
            formatCurrency(categorySummaryData.reduce((s,r) => s + r.profit, 0)),
            ''
          ]],
          startY: (selectedProductCategory !== 'all' && selectedProductCategory !== '') ? 37 : 30,
          theme: 'grid',
          headStyles: { fillColor: UI_COLORS.primary.replace('#',''), font: FONT_NAME, textColor: '#FFFFFF' }, 
          footStyles: { fillColor: [220,220,220], font: FONT_NAME, fontStyle: 'bold', textColor: '#000000'}, 
          styles: { font: FONT_NAME, fontSize: 8, textColor: '#000000' }, 
          alternateRowStyles: { fillColor: [245, 245, 245] }, 
          didParseCell: function (data: any) { 
              if (data.cell.section === 'head' || data.cell.section === 'body' || data.cell.section === 'foot') {
                   data.cell.styles.font = FONT_NAME;
              }
              
              if (data.column.dataKey === 4 && data.cell.section === 'body') { 
                const profitValue = parseFloat(data.cell.raw?.toString().replace(/[^0-9.-]+/g,"") || "0");
                if (profitValue < 0) {
                  data.cell.styles.textColor = '#E53E3E'; 
                } else if (profitValue > 0) {
                   data.cell.styles.textColor = '#38A169'; 
                } else {
                   data.cell.styles.textColor = '#4A5568'; 
                }
              }
              if (data.column.dataKey === 5 && data.cell.section === 'body') { 
                const profitPercValue = parseFloat(data.cell.raw?.toString().replace('%','') || "0");
                 if (profitPercValue < 0) {
                  data.cell.styles.textColor = '#E53E3E'; 
                } else if (profitPercValue > 0) {
                   data.cell.styles.textColor = '#38A169'; 
                } else {
                   data.cell.styles.textColor = '#4A5568'; 
                }
              }
          }
        });

        doc.save(`${t('profitLossSummaryPageTitle')}_CatSum_${startDate}_${endDate}.pdf`);
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
          
          <div>
            <label htmlFor="productCategoryFilter" className="block text-sm font-medium text-gray-700 mb-1">{t('productCategoryFilterLabel')}</label>
            <select 
              id="productCategoryFilter" 
              value={selectedProductCategory} 
              onChange={e => setSelectedProductCategory(e.target.value)} 
              className="mt-1 block w-full h-11 px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-base text-gray-900"
              disabled={availableProductCategories.length === 0 && !isLoading}
            >
              <option value="all">{t('allCategoriesOption')}</option>
              {availableProductCategories.length > 0 ? (
                availableProductCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))
              ) : (
                !isLoading && <option value="" disabled>{t('noProductCategoriesFound')}</option>
              )}
            </select>
          </div>
        </div>
        <div className="mt-4">
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
            <Card title={t('totalSalesSummary')} className="bg-blue-100" titleClassName="text-blue-700 font-semibold"><p className="text-2xl font-bold text-blue-900">{formatCurrency(summaryCards.totalSales)} {currencySymbol}</p></Card>
            <Card title={t('cogsSummary')} className="bg-orange-100" titleClassName="text-orange-700 font-semibold"><p className="text-2xl font-bold text-orange-900">{formatCurrency(summaryCards.totalCOGS)} {currencySymbol}</p></Card>
            <Card title={t('totalOtherExpensesSummary')} className="bg-red-100" titleClassName="text-red-700 font-semibold"><p className="text-2xl font-bold text-red-900">{formatCurrency(summaryCards.totalOtherExpenses)} {currencySymbol}</p></Card>
            <Card title={t('netProfitSummary')} className={`${summaryCards.netProfit >= 0 ? 'bg-green-100' : 'bg-pink-100'}`} titleClassName={`${summaryCards.netProfit >= 0 ? 'text-green-700' : 'text-pink-700'} font-semibold`}><p className={`text-2xl font-bold ${summaryCards.netProfit >= 0 ? 'text-green-900' : 'text-pink-900'}`}>{formatCurrency(summaryCards.netProfit)} {currencySymbol}</p></Card>
          </div>

          <Card title={`${t('breakdownTableTitle')} - ${t('tableColProductCategory')}`} bodyClassName="bg-white">
            <div className="flex justify-end mb-4 space-x-2">
                <Button onClick={exportToExcel} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">{t('exportToExcel')}</Button>
                <Button onClick={exportToPDF} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">{t('exportToPDF')}</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-gray-800 uppercase">{t('tableColNo')}</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-gray-800 uppercase">{t('tableColProductCategory')}</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-800 uppercase">{t('tableColRevenue')}</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-800 uppercase">{t('tableColCost')}</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-800 uppercase">{t('tableColProfit')}</th>
                    <th className="px-3 py-2 text-right text-sm font-semibold text-gray-800 uppercase">{t('tableColProfitPercentage')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categorySummaryData.map((row, index) => (
                    <tr key={row.categoryName} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{row.categoryName}</td>
                      <td className="px-3 py-2 text-right text-sm text-gray-800">{formatCurrency(row.revenue)}</td>
                      <td className="px-3 py-2 text-right text-sm text-gray-800">{formatCurrency(row.cost)}</td>
                      <td className={`px-3 py-2 text-right text-sm font-medium ${row.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(row.profit)}
                      </td>
                       <td className={`px-3 py-2 text-right text-sm font-medium ${row.profitPercentage >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {row.profitPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {categorySummaryData.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">{t('noDataFound')}</td></tr>
                  )}
                </tbody>
                {categorySummaryData.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold text-black">
                        <tr>
                            <td colSpan={2} className="px-3 py-2 text-right text-sm">{t('totalForPeriod')}:</td>
                            <td className="px-3 py-2 text-right text-sm">{formatCurrency(categorySummaryData.reduce((s,r) => s + r.revenue, 0))}</td>
                            <td className="px-3 py-2 text-right text-sm">{formatCurrency(categorySummaryData.reduce((s,r) => s + r.cost, 0))}</td>
                            <td className={`px-3 py-2 text-right text-sm ${categorySummaryData.reduce((s,r) => s + r.profit, 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(categorySummaryData.reduce((s,r) => s + r.profit, 0))}
                            </td>
                            <td className="px-3 py-2 text-right text-sm">-</td> 
                        </tr>
                    </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProfitLossPage;