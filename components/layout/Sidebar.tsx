import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { APP_NAME, UI_COLORS } from '../../constants';
import { Language } from '../../types';

// Simple SVG Icons (replace with a library or more complex SVGs if needed)
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const POSIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ProductIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;
const SupplierIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ExpenseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const HistoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ShoppingBagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l3 3m0 0l3-3m-3 3V5" />
</svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M12 12a4 4 0 110-8 4 4 0 010 8z" />
</svg>;
const CreditTrackingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
</svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
</svg>;
const ExchangeRateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const ReportsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
</svg>;
const PurchaseOrderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
</svg>;
const PromotionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-3-3m0 0l3-3m-3 3h12M3 21v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 12V7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H17a2 2 0 012 2v5M15 12H9" />
</svg>;
const BarcodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-4-16v16m8-16v16M3 8h2m14 0h2M3 12h2m14 0h2M3 16h2m14 0h2" /></svg>;


interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface NavItem {
  path: string;
  labelKey: string;
  icon: JSX.Element;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { t } = useLanguage();
  const location = useLocation();

  const navGroups: NavGroup[] = [
    {
      titleKey: 'groupOverview',
      items: [
        { path: '/', labelKey: 'dashboard', icon: <DashboardIcon /> },
        { path: '/pos', labelKey: 'pos', icon: <POSIcon /> },
      ],
    },
    {
      titleKey: 'groupSales',
      items: [
        { path: '/sales-history', labelKey: 'salesHistory', icon: <HistoryIcon /> },
        { path: '/credit-tracking', labelKey: 'creditTracking', icon: <CreditTrackingIcon /> },
        { path: '/promotions', labelKey: 'promotionsManagement', icon: <PromotionIcon /> },
      ],
    },
    {
      titleKey: 'groupInventory',
      items: [
        { path: '/products', labelKey: 'products', icon: <ProductIcon /> },
        { path: '/products/print-barcodes', labelKey: 'sidebarBarcodePrint', icon: <BarcodeIcon /> },
        { path: '/purchases', labelKey: 'purchases', icon: <ShoppingBagIcon /> },
        { path: '/purchase-history', labelKey: 'purchaseHistory', icon: <HistoryIcon /> },
      ],
    },
    {
      titleKey: 'groupPurchasing',
      items: [
        { path: '/purchase-orders/new', labelKey: 'createPurchaseOrder', icon: <PurchaseOrderIcon /> },
        { path: '/purchase-orders/history', labelKey: 'purchaseOrderHistory', icon: <HistoryIcon /> },
      ],
    },
    {
        titleKey: 'groupPartners',
        items: [
            { path: '/customers', labelKey: 'customers', icon: <UsersIcon /> },
            { path: '/suppliers', labelKey: 'suppliers', icon: <SupplierIcon /> },
        ]
    },
    {
        titleKey: 'groupFinancials',
        items: [
            { path: '/expenses', labelKey: 'expenses', icon: <ExpenseIcon /> },
            { path: '/reports/profit-loss', labelKey: 'profitLossSummaryPageTitle', icon: <ReportsIcon /> },
            { path: '/reports/stock-movement', labelKey: 'stockMovementReportPageTitle', icon: <HistoryIcon /> },
        ]
    },
    {
        titleKey: 'groupSystem',
        items: [
            { path: '/settings/store', labelKey: 'storeSettingsPageTitle', icon: <SettingsIcon /> },
            { path: '/settings/exchange-rate', labelKey: 'exchangeRateSettings', icon: <ExchangeRateIcon /> },
        ]
    }
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-purple-600 to-purple-700 text-white shadow-xl transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="p-4 border-b border-purple-500">
          <h1 className="text-2xl font-bold text-center">{APP_NAME}</h1>
        </div>
        <nav className="flex-grow p-2 space-y-1 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.titleKey}>
              <h2 className="px-3 pt-4 pb-2 text-xs font-semibold text-purple-200 uppercase tracking-wider">
                {t(group.titleKey)}
              </h2>
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)} // Close sidebar on mobile after click
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out text-base
                    ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'bg-purple-800 text-white font-semibold shadow-inner' : 'text-purple-100 hover:bg-purple-600'}`}
                >
                  {item.icon}
                  <span>{t(item.labelKey)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;