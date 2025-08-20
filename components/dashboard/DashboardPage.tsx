

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import { getDashboardSummary } from '../../services/firebaseService';
import { DashboardData } from '../../types';
import { UI_COLORS } from '../../constants';

// Forward declare Chart from global scope (CDN)
declare var Chart: any;

// SVG Icons
const SalesIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m-4-8c0-1.105.902-2 2-2h4c1.104 0 2 .895 2 2M8 8H7M8 16H7m8-8h1m-1 8h1m-5-10v-1c0-.553.452-1 1-1h2c.552 0 1 .447 1 1v1"></path></svg>;
const ExpenseIconDash = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"></path></svg>;
const ProfitIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const StockIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>;
const ProductIconDash = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>;
const SupplierIconDash = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const CustomerIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>;
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15" /></svg>;

const formatCurrency = (value: number | null | undefined, lang: string = 'th-TH') => {
    if (typeof value !== 'number' || isNaN(value)) {
        return (0).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  baseColorShade: 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'pink'; // Added red for negative profit
  isLoading?: boolean;
  currency?: string;
  languageForFormatting: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, baseColorShade, isLoading, currency, languageForFormatting }) => {
  const bgColor = `bg-${baseColorShade}-100`;
  const titleColor = `text-${baseColorShade}-700`;
  const valueColor = `text-${baseColorShade}-900`; // Darker shade for value
  const iconBg = `bg-${baseColorShade}-200`;
  const iconColor = `text-${baseColorShade}-600`;

  // Tailwind JIT compiler needs full class names.
  // We'll construct them carefully. Ensure these color combinations exist in your Tailwind config or are default.
  const safeBgColor = `bg-${baseColorShade}-100`;
  const safeTitleColor = `text-${baseColorShade}-700`;
  const safeValueColor = `text-${baseColorShade}-900`;
  const safeIconBgColor = `bg-${baseColorShade}-200`;
  const safeIconColor = `text-${baseColorShade}-600`;
  const safePulseBgColor = `bg-${baseColorShade}-200`;


  return (
    <Card className={`${safeBgColor} shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium uppercase tracking-wider ${safeTitleColor} opacity-90`}>{title}</p>
          {isLoading ? (
             <div className={`h-8 w-24 ${safePulseBgColor} animate-pulse rounded-md mt-1`}></div>
          ) : (
            <p className={`text-3xl font-bold mt-1 ${safeValueColor}`}>
                {typeof value === 'number' ? formatCurrency(value, languageForFormatting) : value}
                {currency && <span className={`text-xl ml-1 ${safeValueColor}`}>{currency}</span>}
            </p>
          )}
        </div>
        <div className={`p-3 ${safeIconBgColor} rounded-lg`}>
          <span className={safeIconColor}>{icon}</span>
        </div>
      </div>
    </Card>
  );
};

const REFRESH_INTERVAL_SECONDS = 60;

const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  const monthlySalesChartRef = useRef<HTMLCanvasElement | null>(null);
  const monthlySalesChartInstanceRef = useRef<any | null>(null);
  const expenseBreakdownChartRef = useRef<HTMLCanvasElement | null>(null);
  const expenseBreakdownChartInstanceRef = useRef<any | null>(null);
  
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if(!isManualRefresh) setIsLoading(true); 
    else if (isLoading && !isManualRefresh) return; 
    
    if (isManualRefresh && !isLoading) setIsLoading(true); 
    
    setError(null);
    try {
      const data = await getDashboardSummary();
      setDashboardData(data);
      setCountdown(REFRESH_INTERVAL_SECONDS); 
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(t('errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  }, [t, isLoading]); // Added isLoading to dependency array

  useEffect(() => {
    fetchDashboardData();
    const intervalId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchDashboardData(); // Call without isManualRefresh=true
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed fetchDashboardData from here to avoid loop with isLoading

  // Monthly Sales Chart Effect
  useEffect(() => {
    if (dashboardData?.monthlySalesChart && monthlySalesChartRef.current) {
      if (monthlySalesChartInstanceRef.current) {
        monthlySalesChartInstanceRef.current.destroy();
      }
      const ctx = monthlySalesChartRef.current.getContext('2d');
      if (ctx) {
        monthlySalesChartInstanceRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dashboardData.monthlySalesChart.labels,
            datasets: [{
              label: t('monthSales'),
              data: dashboardData.monthlySalesChart.data,
              backgroundColor: UI_COLORS.primary, // This is a hex color
              borderColor: UI_COLORS.primary,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
              y: { 
                beginAtZero: true, 
                ticks: { 
                  callback: (value:any) => formatCurrency(Number(value), localeForFormatting),
                  color: UI_COLORS.textSecondary // Axis ticks color
                },
                grid: { color: '#e0e0e0' } // Light grid lines
              },
              x: {
                ticks: { color: UI_COLORS.textSecondary }, // Axis ticks color
                grid: { display: false }
              }
            },
            plugins: { 
              tooltip: { 
                callbacks: { label: (context: any) => `${context.dataset.label}: ${formatCurrency(context.parsed.y, localeForFormatting)}`},
                bodyColor: UI_COLORS.textPrimary,
                titleColor: UI_COLORS.textPrimary,
                backgroundColor: UI_COLORS.backgroundLight,
                borderColor: UI_COLORS.textSecondary,
                borderWidth: 1
              },
              legend: { labels: { color: UI_COLORS.textPrimary } } // Legend text color
            }
          }
        });
      }
    }
    return () => {
        if (monthlySalesChartInstanceRef.current) {
            monthlySalesChartInstanceRef.current.destroy();
            monthlySalesChartInstanceRef.current = null;
        }
    };
  }, [dashboardData?.monthlySalesChart, t, localeForFormatting]);

  // Expense Breakdown Chart Effect
  useEffect(() => {
    if (dashboardData?.expenseBreakdownChart && expenseBreakdownChartRef.current) {
      if (expenseBreakdownChartInstanceRef.current) {
        expenseBreakdownChartInstanceRef.current.destroy();
      }
      const ctx = expenseBreakdownChartRef.current.getContext('2d');
      if (ctx) {
        expenseBreakdownChartInstanceRef.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: dashboardData.expenseBreakdownChart.labels,
            datasets: [{
              label: t('expenses'),
              data: dashboardData.expenseBreakdownChart.data,
              backgroundColor: dashboardData.expenseBreakdownChart.backgroundColors, // These are hex colors
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
              tooltip: { 
                callbacks: { label: (context: any) => `${context.label}: ${formatCurrency(context.parsed, localeForFormatting)}`},
                bodyColor: UI_COLORS.textPrimary,
                titleColor: UI_COLORS.textPrimary,
                backgroundColor: UI_COLORS.backgroundLight,
                borderColor: UI_COLORS.textSecondary,
                borderWidth: 1
              },
              legend: { 
                position: 'bottom',
                labels: { color: UI_COLORS.textPrimary } // Legend text color
              }
            }
          }
        });
      }
    }
     return () => {
        if (expenseBreakdownChartInstanceRef.current) {
            expenseBreakdownChartInstanceRef.current.destroy();
            expenseBreakdownChartInstanceRef.current = null;
        }
    };
  }, [dashboardData?.expenseBreakdownChart, t, localeForFormatting]);

  if (error && !dashboardData) { 
    return <div className="p-6 text-red-600 bg-red-100 rounded-md m-4 border border-red-300">{error}</div>;
  }

  const profitToday = dashboardData ? dashboardData.salesToday - dashboardData.expensesToday : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">{t('dashboard')}</h1>
        <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">
              {isLoading && !error ? t('loading') : `${t('refreshingIn')} ${countdown} ${t('seconds')}`}
            </span>
            <Button onClick={() => fetchDashboardData(true)} variant="outline" size="sm" leftIcon={<RefreshIcon />} disabled={isLoading}>
                {t('refreshNow')}
            </Button>
        </div>
      </div>
       {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200">{error}</div>}


      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard title={t('salesToday')} value={dashboardData?.salesToday ?? 0} icon={<SalesIcon />} baseColorShade="blue" isLoading={isLoading} currency={currencySymbol} languageForFormatting={localeForFormatting} />
        <MetricCard title={t('expensesToday')} value={dashboardData?.expensesToday ?? 0} icon={<ExpenseIconDash />} baseColorShade="orange" isLoading={isLoading} currency={currencySymbol} languageForFormatting={localeForFormatting} />
        <MetricCard title={t('profitToday')} value={profitToday} icon={<ProfitIcon />} baseColorShade={profitToday >= 0 ? "green" : "red"} isLoading={isLoading} currency={currencySymbol} languageForFormatting={localeForFormatting}/>
        <MetricCard title={t('totalStockValue')} value={dashboardData?.totalStockValue ?? 0} icon={<StockIcon />} baseColorShade="purple" isLoading={isLoading} currency={currencySymbol} languageForFormatting={localeForFormatting}/>
      </div>

      {/* Quick Stats & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
            <Card title={t('quickStats')} bodyClassName="space-y-3 bg-white">
                {isLoading ? Array(3).fill(0).map((_, idx) => <div key={idx} className="h-10 bg-gray-200 animate-pulse rounded-md"></div>) : <>
                    <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                        <div className="flex items-center space-x-2 text-gray-700"> <ProductIconDash/> <span>{t('activeProductsStat')}</span></div>
                        <span className="font-semibold text-lg text-purple-700">{dashboardData?.activeProductsCount ?? 0} {t('items')}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                        <div className="flex items-center space-x-2 text-gray-700"> <SupplierIconDash/> <span>{t('suppliersStat')}</span></div>
                        <span className="font-semibold text-lg text-purple-700">{dashboardData?.suppliersCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                        <div className="flex items-center space-x-2 text-gray-700"> <CustomerIcon/> <span>{t('customersStat')}</span></div>
                        <span className="font-semibold text-lg text-purple-700">{dashboardData?.customersThisMonthCount ?? 0}</span>
                    </div>
                </>}
            </Card>
        </div>

        <Card title={t('latestPurchasesTitle')} className="lg:col-span-1 bg-white">
          {isLoading ? <div className="flex justify-center py-4"><LoadingSpinner text={t('loading')} /></div> :
            dashboardData?.latestPurchases && dashboardData.latestPurchases.length > 0 ? (
            <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
              {dashboardData.latestPurchases.map(purchase => (
                <li key={purchase.id} className="py-3 px-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-800 truncate" title={purchase.supplierName || purchase.purchaseOrderNumber || t('details')}>
                        {purchase.supplierName || purchase.purchaseOrderNumber || `ID: ...${purchase.id.slice(-4)}`}
                    </span>
                    <span className="text-gray-600">{new Date(purchase.purchaseDate).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-purple-700 font-semibold">{formatCurrency(purchase.totalAmount, localeForFormatting)} {currencySymbol}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-600 text-center py-4">{t('noDataFound')}</p>}
        </Card>

        <Card title={t('topSellingProductsTitle')} className="lg:col-span-1 bg-white">
          {isLoading ? <div className="flex justify-center py-4"><LoadingSpinner text={t('loading')} /></div> : 
            dashboardData?.topSellingProducts && dashboardData.topSellingProducts.length > 0 ? (
            <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
              {dashboardData.topSellingProducts.map(product => (
                <li key={product.productId} className="py-3 px-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-800 truncate" title={product.name}>{product.name}</span>
                    <span className="text-purple-700 font-semibold">{product.totalQuantitySold} {t('unit')}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-600 text-center py-4">{t('noDataFound')}</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <Card title={t('monthlySalesChartTitle')} className="lg:col-span-3 bg-white">
          <div className="h-72 md:h-80 relative">
            {isLoading && !dashboardData?.monthlySalesChart ? <div className="flex justify-center items-center h-full"><LoadingSpinner text={t('loading')}/></div> : <canvas ref={monthlySalesChartRef}></canvas>}
          </div>
        </Card>
        <Card title={t('expenseBreakdownChartTitle')} className="lg:col-span-2 bg-white">
          <div className="h-72 md:h-80 relative">
             {isLoading && !dashboardData?.expenseBreakdownChart ? <div className="flex justify-center items-center h-full"><LoadingSpinner text={t('loading')}/></div> : <canvas ref={expenseBreakdownChartRef}></canvas>}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;