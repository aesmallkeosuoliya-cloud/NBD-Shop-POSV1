import React, { useState, useEffect, useCallback } from 'react';
import { Sale, Expense } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getExpenses } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import * as XLSX from 'xlsx';

interface CashFlowData {
  netIncome: number;
  arChange: number;
  netCashFromOps: number;
}

const CashFlowPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [cashFlowData, setCashFlowData] = useState<CashFlowData>({
    netIncome: 0,
    arChange: 0,
    netCashFromOps: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const processReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sales, expenses] = await Promise.all([getSales(), getExpenses()]);
      const start = new Date(startDate);
      const end = new Date(endDate + 'T23:59:59.999Z');
      const dayBeforeStart = new Date(start);
      dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);

      // Net Income for the period
      const salesInPeriod = sales.filter(s => new Date(s.transactionDate) >= start && new Date(s.transactionDate) <= end);
      const expensesInPeriod = expenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);
      const totalSales = salesInPeriod.reduce((sum, s) => sum + s.grandTotal, 0);
      const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + e.amount, 0);
      const netIncome = totalSales - totalExpenses;

      // Accounts Receivable Change
      const arAtStart = sales
        .filter(s => s.paymentMethod === 'credit' && new Date(s.transactionDate) <= dayBeforeStart)
        .reduce((sum, s) => sum + s.outstandingAmount, 0);
      
      const arAtEnd = sales
        .filter(s => s.paymentMethod === 'credit' && new Date(s.transactionDate) <= end)
        .reduce((sum, s) => sum + s.outstandingAmount, 0);
        
      const arChange = arAtEnd - arAtStart; // An increase in AR is a negative adjustment to cash flow

      const netCashFromOps = netIncome - arChange;

      setCashFlowData({
        netIncome,
        arChange,
        netCashFromOps,
      });

    } catch (err) {
      console.error("Error processing cash flow:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    processReportData();
  }, [processReportData]);

  const handleApplyFilter = () => {
    processReportData();
  };

  const exportToExcel = () => {
    const dataForExport = [
        { Section: t('cashFlowFromOperations'), Amount: '' },
        { Section: `  ${t('netIncome')}`, Amount: cashFlowData.netIncome },
        { Section: t('adjustments'), Amount: '' },
        { Section: `  ${t(cashFlowData.arChange >= 0 ? 'increaseInAccountsReceivable' : 'decreaseInAccountsReceivable')}`, Amount: -cashFlowData.arChange },
        { Section: t('netCashFromOperations'), Amount: cashFlowData.netCashFromOps },
        { Section: '', Amount: '' },
        { Section: t('cashFlowInvestingFinancing'), Amount: `(${t('notTracked')})` },
        { Section: '', Amount: '' },
        { Section: t('netChangeInCash'), Amount: cashFlowData.netCashFromOps },
    ];

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('cashFlowStatement'));
    XLSX.writeFile(wb, `${t('cashFlowStatement')}_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('cashFlowStatement')}</h1>
      
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <Input label={t('dateRangeStart')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} wrapperClassName="mb-0" />
          <Input label={t('dateRangeEnd')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} wrapperClassName="mb-0" />
          <Button onClick={handleApplyFilter} variant="primary" isLoading={isLoading}>{t('applyFiltersButton')}</Button>
        </div>
      </Card>
      
      {isLoading ? <LoadingSpinner /> : (
        <Card>
            <div className="flex justify-end mb-4">
                <Button onClick={exportToExcel} variant="outline" size="sm">{t('exportToExcel')}</Button>
            </div>
            <div className="max-w-2xl mx-auto p-4 border rounded-lg">
                <h3 className="text-center font-bold text-lg">{t('cashFlowStatement')}</h3>
                <p className="text-center text-sm mb-4">{t('from')} {new Date(startDate).toLocaleDateString(localeForFormatting)} {t('to')} {new Date(endDate).toLocaleDateString(localeForFormatting)}</p>

                <div className="space-y-4">
                    <div>
                        <div className="font-bold border-b pb-1"><span>{t('cashFlowFromOperations')}</span></div>
                        <div className="flex justify-between pl-4 pt-1"><span>  {t('netIncome')}</span><span>{formatCurrency(cashFlowData.netIncome)}</span></div>
                        <div className="pl-4 pt-1 text-gray-600"><span>  {t('adjustments')}:</span></div>
                        <div className="flex justify-between pl-8">
                            <span>{t(cashFlowData.arChange >= 0 ? 'increaseInAccountsReceivable' : 'decreaseInAccountsReceivable')}</span>
                            <span>({formatCurrency(Math.abs(cashFlowData.arChange))})</span>
                        </div>
                        <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>{t('netCashFromOperations')}</span><span>{formatCurrency(cashFlowData.netCashFromOps)}</span></div>
                    </div>
                    <div>
                        <div className="font-bold border-b pb-1"><span>{t('cashFlowInvestingFinancing')}</span></div>
                        <div className="pl-4 pt-1 text-gray-500"><span>  ({t('notTracked')})</span></div>
                    </div>
                    <div>
                        <div className="flex justify-between font-bold border-t-2 border-b-2 mt-2 pt-1 pb-1"><span>{t('netChangeInCash')}</span><span>{formatCurrency(cashFlowData.netCashFromOps)}</span></div>
                    </div>
                </div>
            </div>
        </Card>
      )}
    </div>
  );
};

export default CashFlowPage;
