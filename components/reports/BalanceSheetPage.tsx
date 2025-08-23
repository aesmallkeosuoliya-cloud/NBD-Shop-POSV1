import React, { useState, useEffect, useCallback } from 'react';
import { Sale, Expense, Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getExpenses, getProducts } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import * as XLSX from 'xlsx';

interface BalanceSheetData {
  cash: number;
  inventoryValue: number;
  accountsReceivable: number;
  totalAssets: number;
  accountsPayable: number;
  capital: number;
  retainedEarnings: number;
  totalLiabilitiesAndEquity: number;
}

const BalanceSheetPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData>({
    cash: 0,
    inventoryValue: 0,
    accountsReceivable: 0,
    totalAssets: 0,
    accountsPayable: 0,
    capital: 0,
    retainedEarnings: 0,
    totalLiabilitiesAndEquity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const processReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sales, expenses, products] = await Promise.all([getSales(), getExpenses(), getProducts()]);
      const date = new Date(asOfDate + 'T23:59:59.999Z');

      // --- ASSETS ---
      // Note: This is a simplified calculation. A true inventory value "as of" date would require historical stock tracking.
      // For now, we use the current stock value as an approximation.
      const inventoryValue = products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
      const accountsReceivable = sales
        .filter(s => s.paymentMethod === 'credit' && s.outstandingAmount > 0 && new Date(s.transactionDate) <= date)
        .reduce((sum, s) => sum + s.outstandingAmount, 0);

      // --- LIABILITIES & EQUITY ---
      // These are not fully tracked, so we simulate them.
      const accountsPayable = 0; // Not tracked yet
      const capital = 0; // Not tracked yet

      const salesUpToDate = sales.filter(s => new Date(s.transactionDate) <= date).reduce((sum, s) => sum + s.grandTotal, 0);
      const expensesUpToDate = expenses.filter(e => new Date(e.date) <= date).reduce((sum, e) => sum + e.amount, 0);
      const retainedEarnings = salesUpToDate - expensesUpToDate;
      
      const totalLiabilitiesAndEquity = accountsPayable + capital + retainedEarnings;
      
      // --- BALANCING ITEM (Cash) ---
      // Cash is calculated to make the accounting equation balance.
      // Cash = (Liabilities + Equity) - Other Assets
      const cash = totalLiabilitiesAndEquity - (accountsReceivable + inventoryValue);

      const totalAssets = cash + accountsReceivable + inventoryValue;
      
      setBalanceSheetData({
        cash,
        inventoryValue,
        accountsReceivable,
        totalAssets,
        accountsPayable,
        capital,
        retainedEarnings,
        totalLiabilitiesAndEquity,
      });

    } catch (err) {
      console.error("Error processing balance sheet:", err);
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    processReportData();
  }, [processReportData]);

  const handleApplyFilter = () => {
    processReportData();
  };

  const exportToExcel = () => {
    const dataForExport = [
        { Section: t('assets'), Item: '', Amount: '' },
        { Section: `  ${t('currentAssets')}`, Item: '', Amount: '' },
        { Section: '', Item: t('cash'), Amount: balanceSheetData.cash },
        { Section: '', Item: t('accountsReceivable'), Amount: balanceSheetData.accountsReceivable },
        { Section: '', Item: t('inventory'), Amount: balanceSheetData.inventoryValue },
        { Section: t('totalAssets'), Item: '', Amount: balanceSheetData.totalAssets, IsTotal: true },
        { Section: '', Item: '', Amount: '' },
        { Section: t('liabilities'), Item: '', Amount: '' },
        { Section: `  ${t('accountsPayable')}`, Item: `(${t('notYetTracked')})`, Amount: balanceSheetData.accountsPayable },
        { Section: '', Item: '', Amount: '' },
        { Section: t('equity'), Item: '', Amount: '' },
        { Section: `  ${t('capital')}`, Item: `(${t('notYetTracked')})`, Amount: balanceSheetData.capital },
        { Section: '', Item: t('retainedEarnings'), Amount: balanceSheetData.retainedEarnings },
        { Section: t('totalLiabilitiesAndEquity'), Item: '', Amount: balanceSheetData.totalLiabilitiesAndEquity, IsTotal: true },
    ];
    
    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('balanceSheet'));
    XLSX.writeFile(wb, `${t('balanceSheet')}_${asOfDate}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('balanceSheet')}</h1>
      
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <Input label={t('asOfDate')} type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} wrapperClassName="mb-0" />
          <Button onClick={handleApplyFilter} variant="primary" isLoading={isLoading}>{t('applyFiltersButton')}</Button>
        </div>
      </Card>
      
      {isLoading ? <LoadingSpinner /> : (
        <Card>
            <div className="flex justify-end mb-4">
                <Button onClick={exportToExcel} variant="outline" size="sm">{t('exportToExcel')}</Button>
            </div>
            <div className="p-4 border rounded-lg">
                <h3 className="text-center font-bold text-lg">{t('balanceSheet')}</h3>
                <p className="text-center text-sm mb-4">{t('asOfDate')} {new Date(asOfDate).toLocaleDateString(localeForFormatting)}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {/* Assets Column */}
                    <div className="space-y-2">
                        <div className="flex justify-between font-bold text-md border-b-2 border-gray-700 pb-1"><span>{t('assets')}</span><span></span></div>
                        
                        <div className="font-semibold">{t('currentAssets')}</div>
                        <div className="flex justify-between pl-4"><span>  {t('cash')}</span><span>{formatCurrency(balanceSheetData.cash)}</span></div>
                        <div className="flex justify-between pl-4"><span>  {t('accountsReceivable')}</span><span>{formatCurrency(balanceSheetData.accountsReceivable)}</span></div>
                        <div className="flex justify-between pl-4"><span>  {t('inventory')}</span><span>{formatCurrency(balanceSheetData.inventoryValue)}</span></div>
                        
                        <div className="flex justify-between font-bold border-t-2 border-gray-700 mt-2 pt-1"><span>{t('totalAssets')}</span><span>{formatCurrency(balanceSheetData.totalAssets)}</span></div>
                    </div>
                    
                    {/* Liabilities & Equity Column */}
                    <div className="space-y-2 mt-6 md:mt-0">
                        <div className="flex justify-between font-bold text-md border-b-2 border-gray-700 pb-1"><span>{t('liabilities')} & {t('equity')}</span><span></span></div>
                        
                        <div className="font-semibold">{t('liabilities')}</div>
                        <div className="flex justify-between pl-4"><span>  {t('accountsPayable')} <span className="text-xs text-gray-500">{`(${t('notYetTracked')})`}</span></span><span>{formatCurrency(balanceSheetData.accountsPayable)}</span></div>
                        
                        <div className="font-semibold mt-4">{t('equity')}</div>
                        <div className="flex justify-between pl-4"><span>  {t('capital')} <span className="text-xs text-gray-500">{`(${t('notYetTracked')})`}</span></span><span>{formatCurrency(balanceSheetData.capital)}</span></div>
                        <div className="flex justify-between pl-4"><span>  {t('retainedEarnings')}</span><span>{formatCurrency(balanceSheetData.retainedEarnings)}</span></div>
                        
                        <div className="flex justify-between font-bold border-t-2 border-gray-700 mt-2 pt-1"><span>{t('totalLiabilitiesAndEquity')}</span><span>{formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</span></div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-6 text-center italic">{t('balanceSheetSimulationNote')}</p>
            </div>
        </Card>
      )}
    </div>
  );
};

export default BalanceSheetPage;
