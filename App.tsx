

import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { HashRouter, Routes, Route, useLocation, Navigate, Outlet } = ReactRouterDOM;
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardPage from './components/dashboard/DashboardPage';
import ProductsPage from './components/products/ProductsPage';
import ImportFromExcelPage from './components/products/ImportFromExcelPage';
import ProductEditFromExcelPage from './components/products/ProductEditFromExcelPage'; // New
import BarcodePrintPage from './components/products/BarcodePrintPage';
import { POSPage } from './components/pos/POSPage'; // Ensured relative path & Changed to named import
import PurchaseOrderPage from './components/po/PurchaseOrderPage'; // New
import PurchaseOrderHistoryPage from './components/po/PurchaseOrderHistoryPage'; // New
import PurchasesPage from './pages/purchases/PurchasesPage'; // Updated path
import { PurchaseHistoryPage } from './pages/purchases/PurchaseHistoryPage'; // Updated path
import SuppliersPage from './components/suppliers/SuppliersPage';
import ExpensesPage from './components/expenses/ExpensesPage';
import SalesHistoryPage from './components/salesHistory/SalesHistoryPage';
import { CreditTrackingPage } from './components/creditTracking/CreditTrackingPage'; // New Page
import CustomersPage from './components/customers/CustomersPage'; // New Customer Management Page
import StoreSettingsPage from './components/settings/StoreSettingsPage'; // New Store Settings Page
import ExchangeRatePage from './components/settings/ExchangeRatePage'; // NEW Exchange Rate Page
import ResetDataPage from './components/settings/ResetDataPage'; // NEW Reset Data Page
import UserManagementPage from './components/settings/UserManagementPage'; // NEW User Management Page
import ProfitLossPage from './components/reports/ProfitLossPage'; // New Profit & Loss Page
import StockMovementReportPage from './components/reports/StockMovementReportPage'; // New Stock Movement Report Page
import AccountsPayableAgingReportPage from './components/reports/AccountsPayableAgingReportPage'; // New AP Aging Report
import PromotionsPage from './components/promotions/PromotionsPage'; // New Promotion Page
import BalanceSheetPage from './components/reports/BalanceSheetPage'; // NEW
import CashFlowPage from './components/reports/CashFlowPage'; // NEW
import FinancialDashboardPage from './components/reports/FinancialDashboardPage'; // NEW
import LoginPage from './components/auth/LoginPage'; 
import { useLanguage } from './contexts/LanguageContext'; // Correct relative import
import { useAuth } from './contexts/AuthContext'; 
import LoadingSpinner from './components/common/LoadingSpinner';


// This wrapper is useful if you want to set document.title or other page-specific things
const PageWrapper: React.FC<{ children: React.ReactNode, titleKey: string }> = ({ children, titleKey }) => {
  const { t } = useLanguage();
  React.useEffect(() => {
    document.title = `${t(titleKey)} - NBD Shop POS`;
  }, [t, titleKey]);
  return <>{children}</>;
};

// Layout for authenticated users
const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage(); 
  const { currentUser } = useAuth(); 

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const getPageTitleKey = (pathname: string): string => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/pos')) return 'pos';
    if (pathname.startsWith('/products/print-barcodes')) return 'barcodeV2_pageTitle';
    if (pathname.startsWith('/products/import')) return 'importProductsFromExcel';
    if (pathname.startsWith('/products/edit-from-excel')) return 'productEditFromExcelPageTitle';
    if (pathname.startsWith('/products')) return 'products';
    if (pathname.startsWith('/promotions')) return 'promotionsManagement';
    if (pathname.startsWith('/purchase-orders/edit/')) return 'editPurchaseOrder';
    if (pathname.startsWith('/purchase-orders/new')) return 'createPurchaseOrder';
    if (pathname.startsWith('/purchase-orders/history')) return 'purchaseOrderHistory';
    if (pathname.startsWith('/purchases')) return 'purchases';
    if (pathname.startsWith('/purchase-history')) return 'purchaseHistory';
    if (pathname.startsWith('/suppliers')) return 'suppliers';
    if (pathname.startsWith('/customers')) return 'customerManagementPageTitle'; 
    if (pathname.startsWith('/expenses')) return 'expenses';
    if (pathname.startsWith('/sales-history')) return 'salesHistory';
    if (pathname.startsWith('/credit-tracking')) return 'creditTrackingPageTitle';
    if (pathname.startsWith('/settings/store')) return 'storeSettingsPageTitle'; 
    if (pathname.startsWith('/settings/users')) return 'userManagement'; // New
    if (pathname.startsWith('/reports/profit-loss')) return 'profitLossSummaryPageTitle';
    if (pathname.startsWith('/reports/stock-movement')) return 'stockMovementReportPageTitle';
    if (pathname.startsWith('/reports/accounts-payable-aging')) return 'apAgingReport';
    if (pathname.startsWith('/reports/balance-sheet')) return 'balanceSheet';
    if (pathname.startsWith('/reports/cash-flow')) return 'cashFlowStatement';
    if (pathname.startsWith('/reports/financial-dashboard')) return 'financialDashboard';
    if (pathname.startsWith('/settings/exchange-rate')) return 'exchangeRateSettings';
    if (pathname.startsWith('/settings/reset-data')) return 'resetData';
    return 'appName'; 
  };
  
  const pageTitle = t(getPageTitleKey(location.pathname));

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} pageTitle={pageTitle} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100">
           <Outlet /> 
        </main>
      </div>
    </div>
  );
};

// Component to protect routes based on role
const PermissionRoute: React.FC<{ allowedRoles: any[] }> = ({ allowedRoles }) => {
    const { hasPermission, loading } = useAuth();
    if (loading) return null; // Or a loading spinner
    
    // --- ROLE MANAGEMENT TEMPORARILY DISABLED FOR TESTING ---
    // The check is bypassed to allow all logged-in users to access all routes.
    // To re-enable, uncomment the original line and remove `return <Outlet />`.
    return <Outlet />;
    // return hasPermission(allowedRoles) ? <Outlet /> : <Navigate to="/" replace />;
};


// Component to protect routes
const ProtectedRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) { 
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoadingSpinner text="Authenticating..." size="lg" />
      </div>
    );
  }

  return currentUser ? <MainLayout /> : <Navigate to="/login" replace />;
};

// Component for public routes like login
const PublicRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();
   if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoadingSpinner text="Loading..." size="lg" />
      </div>
    );
  }
  return currentUser ? <Navigate to="/" replace /> : <Outlet />;
}


const App: React.FC = () => {
  const { loading: authLoading } = useAuth(); 

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoadingSpinner text="Application Loading..." size="lg" />
      </div>
    );
  }
  
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<PageWrapper titleKey="dashboard"><DashboardPage /></PageWrapper>} />
          <Route path="/pos" element={<PageWrapper titleKey="pos"><POSPage /></PageWrapper>} />
          <Route path="/products/print-barcodes" element={<PageWrapper titleKey="barcodeV2_pageTitle"><BarcodePrintPage /></PageWrapper>} />
          <Route path="/products/import" element={<PageWrapper titleKey="importProductsFromExcel"><ImportFromExcelPage /></PageWrapper>} />
          <Route path="/products/edit-from-excel" element={<PageWrapper titleKey="productEditFromExcelPageTitle"><ProductEditFromExcelPage /></PageWrapper>} />
          <Route path="/products" element={<PageWrapper titleKey="products"><ProductsPage /></PageWrapper>} />
          <Route path="/promotions" element={<PageWrapper titleKey="promotionsManagement"><PromotionsPage /></PageWrapper>} />
          <Route path="/purchase-orders/new" element={<PageWrapper titleKey="createPurchaseOrder"><PurchaseOrderPage /></PageWrapper>} />
          <Route path="/purchase-orders/edit/:poId" element={<PageWrapper titleKey="editPurchaseOrder"><PurchaseOrderPage /></PageWrapper>} />
          <Route path="/purchase-orders/history" element={<PageWrapper titleKey="purchaseOrderHistory"><PurchaseOrderHistoryPage /></PageWrapper>} />
          <Route path="/purchases" element={<PageWrapper titleKey="purchases"><PurchasesPage /></PageWrapper>} />
          <Route path="/purchase-history" element={<PageWrapper titleKey="purchaseHistory"><PurchaseHistoryPage /></PageWrapper>} />
          <Route path="/suppliers" element={<PageWrapper titleKey="suppliers"><SuppliersPage /></PageWrapper>} />
          <Route path="/customers" element={<PageWrapper titleKey="customerManagementPageTitle"><CustomersPage /></PageWrapper>} /> 
          <Route path="/expenses" element={<PageWrapper titleKey="expenses"><ExpensesPage /></PageWrapper>} />
          <Route path="/sales-history" element={<PageWrapper titleKey="salesHistory"><SalesHistoryPage /></PageWrapper>} />
          <Route path="/credit-tracking" element={<PageWrapper titleKey="creditTrackingPageTitle"><CreditTrackingPage /></PageWrapper>} />
          <Route path="/settings/store" element={<PageWrapper titleKey="storeSettingsPageTitle"><StoreSettingsPage /></PageWrapper>} />
          <Route path="/settings/exchange-rate" element={<PageWrapper titleKey="exchangeRateSettings"><ExchangeRatePage /></PageWrapper>} />
          <Route path="/settings/reset-data" element={<PageWrapper titleKey="resetData"><ResetDataPage /></PageWrapper>} />
          <Route path="/reports/profit-loss" element={<PageWrapper titleKey="profitLossSummaryPageTitle"><ProfitLossPage /></PageWrapper>} />
          <Route path="/reports/stock-movement" element={<PageWrapper titleKey="stockMovementReportPageTitle"><StockMovementReportPage /></PageWrapper>} />
          <Route path="/reports/accounts-payable-aging" element={<PageWrapper titleKey="apAgingReport"><AccountsPayableAgingReportPage /></PageWrapper>} />
          <Route path="/reports/balance-sheet" element={<PageWrapper titleKey="balanceSheet"><BalanceSheetPage /></PageWrapper>} />
          <Route path="/reports/cash-flow" element={<PageWrapper titleKey="cashFlowStatement"><CashFlowPage /></PageWrapper>} />
          <Route path="/reports/financial-dashboard" element={<PageWrapper titleKey="financialDashboard"><FinancialDashboardPage /></PageWrapper>} />
          
          {/* Admin Only Route */}
          <Route element={<PermissionRoute allowedRoles={['admin']} />}>
            <Route path="/settings/users" element={<PageWrapper titleKey="userManagement"><UserManagementPage /></PageWrapper>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;