import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Sale, Expense, Product, Purchase, Customer, SalePayment, StoreSettings, Language } from '../../types';
import { getSales, getExpenses, getProducts, getPurchases, getCustomers, getAllSalePayments, getStoreSettings } from '../../services/firebaseService';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { UI_COLORS, DEFAULT_STORE_SETTINGS } from '../../constants';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createRoot } from 'react-dom/client';
import LaoFontInstallationHelp from '../common/LaoFontInstallationHelp';
import Input from '../common/Input';


declare var Chart: any;
declare var Swal: any;

// --- IMPORTANT: PDF FONT DATA ---
const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";
// --- END IMPORTANT ---


const RevenueIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const ProfitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m-4-8c0-1.105.902-2 2-2h4c1.104 0 2 .895 2 2M8 8H7M8 16H7m8-8h1m-1 8h1m-5-10v-1c0-.553.452-1 1-1h2c.552 0 1 .447 1 1v1" /></svg>;
const CashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const InfoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;


interface DashboardData {
    totalRevenue: number;
    grossProfit: number;
    netProfit: number;
    endingCashBalance: number;
    currentRatio: number;
    grossMargin: number;
    netProfitMargin: number;
    debtToEquityRatio: number;
    monthlyPerformance: {
        labels: string[];
        revenue: number[];
        grossProfit: number[];
        netProfit: number[];
    };
}

const FinancialDashboardPage: React.FC = () => {
    const { t, language } = useLanguage();
    const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const performanceChartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<any | null>(null);

    const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
    const formatCurrency = (value: number) => value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const fetchDataAndCalculate = useCallback(async () => {
        setIsLoading(true);
        try {
            const [sales, expenses, products, customers, purchases, salePayments, settings] = await Promise.all([
                getSales(), getExpenses(), getProducts(), getCustomers(), getPurchases(), getAllSalePayments(), getStoreSettings()
            ]);
            setStoreSettings(settings || DEFAULT_STORE_SETTINGS);

            const [year, month] = selectedDate.split('-').map(Number);
            
            // --- Period Calculations ---
            const periodSales = sales.filter(s => s.transactionDate.startsWith(selectedDate));
            const periodExpenses = expenses.filter(e => e.date.startsWith(selectedDate));
            
            const totalRevenue = periodSales.reduce((sum, s) => sum + s.grandTotal, 0);
            const cogs = periodExpenses.filter(e => e.accountingCategoryCode === 1).reduce((sum, e) => sum + e.amount, 0);
            const otherExpenses = periodExpenses.filter(e => e.accountingCategoryCode !== 1).reduce((sum, e) => sum + e.amount, 0);
            const grossProfit = totalRevenue - cogs;
            const netProfit = grossProfit - otherExpenses;
            
            // --- Balance Sheet Ratios (Approximations) ---
            const inventoryValue = products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
            const accountsReceivable = sales.filter(s => s.status !== 'paid').reduce((sum, s) => sum + s.outstandingAmount, 0);
            const currentAssets = inventoryValue + accountsReceivable;
            const accountsPayable = 0; // Not tracked
            const currentLiabilities = accountsPayable > 0 ? accountsPayable : 1; // Avoid division by zero
            const totalEquity = netProfit; // Highly simplified
            const debtToEquityRatio = currentLiabilities / (totalEquity || 1);

            // --- Profitability Ratios ---
            const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
            const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

            // --- Cash Balance ---
            const startOfPeriod = new Date(year, month - 1, 1);
            const cashInBefore = sales.filter(s => new Date(s.transactionDate) < startOfPeriod && s.paymentMethod !== 'credit').reduce((sum, s) => sum + s.grandTotal, 0) + salePayments.filter(p => new Date(p.paymentDate) < startOfPeriod).reduce((sum, p) => sum + p.amountPaid, 0);
            const cashOutBefore = purchases.filter(p => new Date(p.purchaseDate) < startOfPeriod && p.paymentMethod !== 'credit').reduce((sum, p) => sum + p.totalAmount, 0) + expenses.filter(e => new Date(e.date) < startOfPeriod && !e.relatedPurchaseId).reduce((sum, e) => sum + e.amount, 0);
            const beginningCashBalance = cashInBefore - cashOutBefore;

            const cashInPeriod = periodSales.filter(s => s.paymentMethod !== 'credit').reduce((sum, s) => sum + s.grandTotal, 0) + salePayments.filter(p => p.paymentDate.startsWith(selectedDate)).reduce((sum, p) => sum + p.amountPaid, 0);
            const cashOutPeriod = purchases.filter(p => p.purchaseDate.startsWith(selectedDate) && p.paymentMethod !== 'credit').reduce((sum, p) => sum + p.totalAmount, 0) + periodExpenses.filter(e => !e.relatedPurchaseId).reduce((sum, e) => sum + e.amount, 0);
            const endingCashBalance = beginningCashBalance + cashInPeriod - cashOutPeriod;
            
            // --- Monthly Chart Data ---
            const monthlyPerformance = { labels: [] as string[], revenue: [] as number[], grossProfit: [] as number[], netProfit: [] as number[] };
            for (let i = 1; i <= 12; i++) {
                const monthStr = i.toString().padStart(2, '0');
                const monthLabel = new Date(year, i - 1, 1).toLocaleString(localeForFormatting, { month: 'short' });
                monthlyPerformance.labels.push(monthLabel);
                
                const monthlySales = sales.filter(s => s.transactionDate.startsWith(`${year}-${monthStr}`));
                const monthlyExpenses = expenses.filter(e => e.date.startsWith(`${year}-${monthStr}`));
                
                const mRevenue = monthlySales.reduce((sum, s) => sum + s.grandTotal, 0);
                const mCogs = monthlyExpenses.filter(e => e.accountingCategoryCode === 1).reduce((sum, e) => sum + e.amount, 0);
                const mOtherExpenses = monthlyExpenses.filter(e => e.accountingCategoryCode !== 1).reduce((sum, e) => sum + e.amount, 0);
                const mGrossProfit = mRevenue - mCogs;
                const mNetProfit = mGrossProfit - mOtherExpenses;

                monthlyPerformance.revenue.push(mRevenue);
                monthlyPerformance.grossProfit.push(mGrossProfit);
                monthlyPerformance.netProfit.push(mNetProfit);
            }

            setDashboardData({
                totalRevenue, grossProfit, netProfit, endingCashBalance,
                currentRatio, grossMargin, netProfitMargin, debtToEquityRatio,
                monthlyPerformance
            });
        } catch (error) {
            console.error("Error calculating dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, localeForFormatting]);

    useEffect(() => {
        fetchDataAndCalculate();
    }, [fetchDataAndCalculate]);
    
    useEffect(() => {
        if (performanceChartRef.current && dashboardData) {
            if (chartInstanceRef.current) chartInstanceRef.current.destroy();
            const ctx = performanceChartRef.current.getContext('2d');
            if (ctx) {
                chartInstanceRef.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: dashboardData.monthlyPerformance.labels,
                        datasets: [
                            { type: 'bar', label: t('revenue'), data: dashboardData.monthlyPerformance.revenue, backgroundColor: UI_COLORS.chartBlue, yAxisID: 'y' },
                            { type: 'bar', label: t('grossProfit'), data: dashboardData.monthlyPerformance.grossProfit, backgroundColor: UI_COLORS.chartGreen, yAxisID: 'y' },
                            { type: 'line', label: t('netProfit'), data: dashboardData.monthlyPerformance.netProfit, borderColor: UI_COLORS.chartOrange, backgroundColor: UI_COLORS.chartOrange + '33', fill: false, yAxisID: 'y', tension: 0.2 }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, ticks: { callback: (value: any) => formatCurrency(Number(value)) } } },
                        plugins: { tooltip: { callbacks: { label: (context: any) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } }
                    }
                });
            }
        }
        return () => chartInstanceRef.current?.destroy();
    }, [dashboardData, t, formatCurrency]);

    const exportToPDF = async () => {
        if (!dashboardData) return;
        try {
            const doc = new jsPDF({ unit: 'mm', orientation: 'p' });
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

            doc.setFontSize(16);
            doc.text(t('financialDashboard'), 14, 20);
            doc.setFontSize(10);
            doc.text(`${t('period')}: ${selectedDate}`, 14, 27);

            const kpiBody = [
                [t('totalRevenue'), formatCurrency(dashboardData.totalRevenue)],
                [t('grossProfit'), formatCurrency(dashboardData.grossProfit)],
                [t('netProfit'), formatCurrency(dashboardData.netProfit)],
                [t('endingCashBalance'), formatCurrency(dashboardData.endingCashBalance)],
            ];
            (doc as any).autoTable({
                startY: 35, head: [[t('keyMetrics'), '']], body: kpiBody, theme: 'grid', styles: { font: FONT_NAME }, headStyles: { font: FONT_NAME, fontStyle: 'bold' }
            });
            
            const ratioBody = [
                [`${t('currentRatio')} (${t('times')})`, dashboardData.currentRatio.toFixed(2)],
                [`${t('grossMargin')} (%)`, `${dashboardData.grossMargin.toFixed(2)}%`],
                [`${t('netProfitMargin')} (%)`, `${dashboardData.netProfitMargin.toFixed(2)}%`],
                [`${t('debtToEquityRatio')}`, dashboardData.debtToEquityRatio.toFixed(2)],
            ];
            (doc as any).autoTable({
                startY: (doc as any).lastAutoTable.finalY + 10, head: [[t('financialRatios'), '']], body: ratioBody, theme: 'grid', styles: { font: FONT_NAME }, headStyles: { font: FONT_NAME, fontStyle: 'bold' }
            });

            if (chartInstanceRef.current) {
                const chartImage = chartInstanceRef.current.toBase64Image();
                const chartY = (doc as any).lastAutoTable.finalY + 10;
                doc.addImage(chartImage, 'PNG', 14, chartY, 180, 90);
            }
            
            doc.save(`${t('financialDashboard')}_${selectedDate}.pdf`);
        } catch (err) { console.error(err); }
    };


    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-800">{t('financialDashboard')}</h1>
                <div className="flex items-center gap-4">
                    <Input label={t('selectPeriod')} type="month" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} wrapperClassName="mb-0" />
                    <Button onClick={exportToPDF} variant="outline">{t('exportToPDF')}</Button>
                </div>
            </div>

            {isLoading || !dashboardData ? (
                <LoadingSpinner />
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card bodyClassName="flex items-center justify-between bg-blue-50">
                            <div><p className="text-sm font-medium text-blue-700">{t('totalRevenue')}</p><p className="text-2xl font-bold text-blue-900">{formatCurrency(dashboardData.totalRevenue)}</p></div>
                            <RevenueIcon />
                        </Card>
                        <Card bodyClassName="flex items-center justify-between bg-green-50">
                            <div><p className="text-sm font-medium text-green-700">{t('grossProfit')}</p><p className="text-2xl font-bold text-green-900">{formatCurrency(dashboardData.grossProfit)}</p></div>
                            <ProfitIcon />
                        </Card>
                        <Card bodyClassName={`flex items-center justify-between ${dashboardData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div><p className={`text-sm font-medium ${dashboardData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{t('netProfit')}</p><p className={`text-2xl font-bold ${dashboardData.netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>{formatCurrency(dashboardData.netProfit)}</p></div>
                            <ProfitIcon />
                        </Card>
                        <Card bodyClassName="flex items-center justify-between bg-purple-50">
                            <div><p className="text-sm font-medium text-purple-700">{t('endingCashBalance')}</p><p className="text-2xl font-bold text-purple-900">{formatCurrency(dashboardData.endingCashBalance)}</p></div>
                            <CashIcon />
                        </Card>
                    </div>

                    {/* Ratios */}
                    <Card title={t('financialRatios')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                            <div className="p-2 border rounded-lg relative group">
                                <span className="absolute top-1 right-1" title={t('currentRatioTooltip')}><InfoIcon /></span>
                                <p className="text-sm text-gray-600">{t('currentRatio')}</p><p className="text-xl font-semibold">{dashboardData.currentRatio.toFixed(2)}</p>
                            </div>
                            <div className="p-2 border rounded-lg relative group">
                                <span className="absolute top-1 right-1" title={t('grossMarginTooltip')}><InfoIcon /></span>
                                <p className="text-sm text-gray-600">{t('grossMargin')}</p><p className="text-xl font-semibold">{dashboardData.grossMargin.toFixed(2)}%</p>
                            </div>
                            <div className="p-2 border rounded-lg relative group">
                                <span className="absolute top-1 right-1" title={t('netProfitMarginTooltip')}><InfoIcon /></span>
                                <p className="text-sm text-gray-600">{t('netProfitMargin')}</p><p className="text-xl font-semibold">{dashboardData.netProfitMargin.toFixed(2)}%</p>
                            </div>
                            <div className="p-2 border rounded-lg relative group">
                                <span className="absolute top-1 right-1" title={t('debtToEquityRatioTooltip')}><InfoIcon /></span>
                                <p className="text-sm text-gray-600">{t('debtToEquityRatio')}</p><p className="text-xl font-semibold">{dashboardData.debtToEquityRatio.toFixed(2)}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Chart */}
                    <Card title={`${t('performanceOverTime')} - ${new Date(selectedDate).getFullYear()}`}>
                        <div className="h-96">
                            <canvas ref={performanceChartRef}></canvas>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default FinancialDashboardPage;