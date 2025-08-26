import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sale, Expense, Purchase, SalePayment } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getExpenses, getPurchases, getAllSalePayments } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare var Chart: any;

interface CashFlowData {
  beginningCashBalance: number;
  cashReceiptsFromSales: number;
  cashPaymentsForInventory: number;
  cashPaymentsForExpenses: number;
  netCashFromOperating: number;
  netCashFromInvesting: number;
  netCashFromFinancing: number;
  netChangeInCash: number;
  endingCashBalance: number;
}

interface ChartData {
  labels: string[];
  data: number[];
}

const CashFlowPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any | null>(null);

  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const processReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sales, expenses, purchases, salePayments] = await Promise.all([
        getSales(), getExpenses(), getPurchases(), getAllSalePayments()
      ]);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // --- Calculate Beginning Balance (from dawn of time until start date) ---
      const dayBeforeStart = new Date(start);
      dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
      dayBeforeStart.setHours(23, 59, 59, 999);

      const cashSalesBefore = sales.filter(s => new Date(s.transactionDate) < start && s.paymentMethod !== 'credit');
      const creditPaymentsBefore = salePayments.filter(p => new Date(p.paymentDate) < start);
      const cashPurchasesBefore = purchases.filter(p => new Date(p.purchaseDate) < start && (p.paymentMethod === 'cash' || p.paymentMethod === 'transfer'));
      const manualExpensesBefore = expenses.filter(e => new Date(e.date) < start && !e.relatedPurchaseId);
      
      const cashInBefore = cashSalesBefore.reduce((sum, s) => sum + s.grandTotal, 0) + creditPaymentsBefore.reduce((sum, p) => sum + p.amountPaid, 0);
// @google/genai-api-fix: Replaced deprecated 'totalAmount' with 'grandTotal' to align with the Purchase type definition.
      const cashOutBefore = cashPurchasesBefore.reduce((sum, p) => sum + p.grandTotal, 0) + manualExpensesBefore.reduce((sum, e) => sum + e.amount, 0);
      const beginningCashBalance = cashInBefore - cashOutBefore;
      
      // --- Calculate Flows for the selected period ---
      const cashSalesInPeriod = sales.filter(s => new Date(s.transactionDate) >= start && new Date(s.transactionDate) <= end && s.paymentMethod !== 'credit');
      const creditPaymentsInPeriod = salePayments.filter(p => new Date(p.paymentDate) >= start && new Date(p.paymentDate) <= end);
      const cashPurchasesInPeriod = purchases.filter(p => new Date(p.purchaseDate) >= start && new Date(p.purchaseDate) <= end && (p.paymentMethod === 'cash' || p.paymentMethod === 'transfer'));
      const manualExpensesInPeriod = expenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end && !e.relatedPurchaseId);
      
      const cashReceiptsFromSales = cashSalesInPeriod.reduce((sum, s) => sum + s.grandTotal, 0) + creditPaymentsInPeriod.reduce((sum, p) => sum + p.amountPaid, 0);
// @google/genai-api-fix: Replaced deprecated 'totalAmount' with 'grandTotal' to align with the Purchase type definition.
      const cashPaymentsForInventory = cashPurchasesInPeriod.reduce((sum, p) => sum + p.grandTotal, 0);
      const cashPaymentsForExpenses = manualExpensesInPeriod.reduce((sum, e) => sum + e.amount, 0);
      
      const netCashFromOperating = cashReceiptsFromSales - cashPaymentsForInventory - cashPaymentsForExpenses;
      const netCashFromInvesting = 0; // Placeholder
      const netCashFromFinancing = 0; // Placeholder
      const netChangeInCash = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;
      const endingCashBalance = beginningCashBalance + netChangeInCash;

      setCashFlowData({
        beginningCashBalance,
        cashReceiptsFromSales,
        cashPaymentsForInventory,
        cashPaymentsForExpenses,
        netCashFromOperating,
        netCashFromInvesting,
        netCashFromFinancing,
        netChangeInCash,
        endingCashBalance
      });

      // --- Prepare Chart Data ---
      const labels: string[] = [];
      const dataPoints: number[] = [];
      const dailyChanges = new Map<string, number>();

      cashSalesInPeriod.forEach(s => { const d = s.transactionDate.split('T')[0]; dailyChanges.set(d, (dailyChanges.get(d) || 0) + s.grandTotal); });
      creditPaymentsInPeriod.forEach(p => { const d = p.paymentDate.split('T')[0]; dailyChanges.set(d, (dailyChanges.get(d) || 0) + p.amountPaid); });
// @google/genai-api-fix: Replaced deprecated 'totalAmount' with 'grandTotal' to align with the Purchase type definition.
      cashPurchasesInPeriod.forEach(p => { const d = p.purchaseDate.split('T')[0]; dailyChanges.set(d, (dailyChanges.get(d) || 0) - p.grandTotal); });
      manualExpensesInPeriod.forEach(e => { const d = e.date.split('T')[0]; dailyChanges.set(d, (dailyChanges.get(d) || 0) - e.amount); });
      
      let currentBalance = beginningCashBalance;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        labels.push(dateString);
        currentBalance += (dailyChanges.get(dateString) || 0);
        dataPoints.push(currentBalance);
      }
      setChartData({ labels, data: dataPoints });

    } catch (err) {
      console.error("Error processing cash flow:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    processReportData();
  }, [processReportData]);

  useEffect(() => {
    if (chartRef.current && chartData) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstanceRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: chartData.labels,
            datasets: [{
              label: t('cashBalance'),
              data: chartData.data,
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1,
              fill: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { ticks: { callback: (value: any) => formatCurrency(Number(value)) } } },
            plugins: { tooltip: { callbacks: { label: (context: any) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } }
          }
        });
      }
    }
    return () => chartInstanceRef.current?.destroy();
  }, [chartData, t, formatCurrency]);


  const exportToExcel = () => {
    if (!cashFlowData) return;
    const data = [
      { Item: t('cashFlowFromOperations'), Amount: '' },
      { Item: `  ${t('cashReceiptsFromSales')}`, Amount: cashFlowData.cashReceiptsFromSales },
      { Item: `  ${t('cashPaymentsForInventory')}`, Amount: -cashFlowData.cashPaymentsForInventory },
      { Item: `  ${t('cashPaymentsForExpenses')}`, Amount: -cashFlowData.cashPaymentsForExpenses },
      { Item: t('netCashFromOperating'), Amount: cashFlowData.netCashFromOperating },
      { Item: '', Amount: '' },
      { Item: t('cashFlowFromInvesting'), Amount: '' },
      { Item: `  ${t('purchaseOfAssets')} (${t('notTracked')})`, Amount: 0 },
      { Item: t('netCashFromInvesting'), Amount: cashFlowData.netCashFromInvesting },
      { Item: '', Amount: '' },
      { Item: t('cashFlowFromFinancing'), Amount: '' },
      { Item: `  ${t('capitalContribution')} (${t('notTracked')})`, Amount: 0 },
      { Item: t('netCashFromFinancing'), Amount: cashFlowData.netCashFromFinancing },
      { Item: '', Amount: '' },
      { Item: t('netChangeInCash'), Amount: cashFlowData.netChangeInCash },
      { Item: t('beginningCashBalance'), Amount: cashFlowData.beginningCashBalance },
      { Item: t('endingCashBalance'), Amount: cashFlowData.endingCashBalance },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('cashFlowStatement'));
    XLSX.writeFile(wb, `${t('cashFlowStatement')}_${startDate}_${endDate}.xlsx`);
  };

  const exportToPDF = () => {
    if(!cashFlowData) return;
    const doc = new jsPDF();
    doc.setFont('Helvetica'); // Placeholder, add custom font logic if needed
    doc.text(t('cashFlowStatement'), 14, 15);
    doc.text(`${t('period')}: ${startDate} - ${endDate}`, 14, 22);
    (doc as any).autoTable({
      startY: 30,
      head: [[t('details'), t('amount')]],
      body: [
        [t('cashFlowFromOperations'), ''],
        [`  ${t('cashReceiptsFromSales')}`, formatCurrency(cashFlowData.cashReceiptsFromSales)],
        [`  ${t('cashPaymentsForInventory')}`, `(${formatCurrency(Math.abs(cashFlowData.cashPaymentsForInventory))})`],
        [`  ${t('cashPaymentsForExpenses')}`, `(${formatCurrency(Math.abs(cashFlowData.cashPaymentsForExpenses))})`],
        [{ content: t('netCashFromOperating'), styles: {fontStyle: 'bold'}}, { content: formatCurrency(cashFlowData.netCashFromOperating), styles: {fontStyle: 'bold'}}],
        ['', ''],
        [t('cashFlowFromInvesting'), ''],
        [`  (${t('notTracked')})`, formatCurrency(0)],
        [{ content: t('netCashFromInvesting'), styles: {fontStyle: 'bold'}}, { content: formatCurrency(cashFlowData.netCashFromInvesting), styles: {fontStyle: 'bold'}}],
        ['', ''],
        [t('cashFlowFromFinancing'), ''],
        [`  (${t('notTracked')})`, formatCurrency(0)],
        [{ content: t('netCashFromFinancing'), styles: {fontStyle: 'bold'}}, { content: formatCurrency(cashFlowData.netCashFromFinancing), styles: {fontStyle: 'bold'}}],
        ['', ''],
        [{ content: t('netChangeInCash'), styles: {fontStyle: 'bold'}}, { content: formatCurrency(cashFlowData.netChangeInCash), styles: {fontStyle: 'bold'}}],
        [t('beginningCashBalance'), formatCurrency(cashFlowData.beginningCashBalance)],
        [{ content: t('endingCashBalance'), styles: {fontStyle: 'bold'}}, { content: formatCurrency(cashFlowData.endingCashBalance), styles: {fontStyle: 'bold'}}],
      ],
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } },
    });
    doc.save(`${t('cashFlowStatement')}_${startDate}_${endDate}.pdf`);
  };


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('cashFlowStatement')}</h1>
      
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <Input label={t('dateRangeStart')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} wrapperClassName="mb-0" />
          <Input label={t('dateRangeEnd')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} wrapperClassName="mb-0" />
          <Button onClick={processReportData} variant="primary" isLoading={isLoading}>{t('applyFiltersButton')}</Button>
        </div>
      </Card>
      
      {isLoading ? <LoadingSpinner /> : cashFlowData && (
        <>
          <Card>
              <div className="flex justify-end mb-4 space-x-2">
                  <Button onClick={exportToExcel} variant="outline" size="sm">{t('exportToExcel')}</Button>
                  <Button onClick={exportToPDF} variant="outline" size="sm">{t('exportToPDF')}</Button>
              </div>
              <div className="max-w-3xl mx-auto p-4 border rounded-lg">
                  <h3 className="text-center font-bold text-lg">{t('cashFlowStatement')}</h3>
                  <p className="text-center text-sm mb-4">{`${t('from')} ${startDate} ${t('to')} ${endDate}`}</p>
                  
                  <div className="space-y-4">
                      {/* Operating */}
                      <div className="font-bold border-b pb-1">{t('cashFlowFromOperations')}</div>
                      <div className="flex justify-between pl-4"><span>  {t('cashReceiptsFromSales')}</span><span>{formatCurrency(cashFlowData.cashReceiptsFromSales)}</span></div>
                      <div className="flex justify-between pl-4"><span>  {t('cashPaymentsForInventory')}</span><span>({formatCurrency(Math.abs(cashFlowData.cashPaymentsForInventory))})</span></div>
                      <div className="flex justify-between pl-4"><span>  {t('cashPaymentsForExpenses')}</span><span>({formatCurrency(Math.abs(cashFlowData.cashPaymentsForExpenses))})</span></div>
                      <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>{t('netCashFromOperating')}</span><span>{formatCurrency(cashFlowData.netCashFromOperating)}</span></div>

                      {/* Investing */}
                      <div className="font-bold border-b pb-1 mt-4">{t('cashFlowFromInvesting')}</div>
                      <div className="flex justify-between pl-4 text-gray-500"><span>  {t('purchaseOfAssets')} ({t('notTracked')})</span><span>0.00</span></div>
                      <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>{t('netCashFromInvesting')}</span><span>{formatCurrency(cashFlowData.netCashFromInvesting)}</span></div>

                      {/* Financing */}
                      <div className="font-bold border-b pb-1 mt-4">{t('cashFlowFromFinancing')}</div>
                      <div className="flex justify-between pl-4 text-gray-500"><span>  {t('capitalContribution')} ({t('notTracked')})</span><span>0.00</span></div>
                      <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>{t('netCashFromFinancing')}</span><span>{formatCurrency(cashFlowData.netCashFromFinancing)}</span></div>

                      {/* Summary */}
                      <div className="flex justify-between font-bold text-lg border-t-2 pt-2 mt-4"><span>{t('netChangeInCash')}</span><span>{formatCurrency(cashFlowData.netChangeInCash)}</span></div>
                      <div className="flex justify-between"><span>{t('beginningCashBalance')}</span><span>{formatCurrency(cashFlowData.beginningCashBalance)}</span></div>
                      <div className="flex justify-between font-bold text-lg border-t-2 border-b-4 border-double mt-1 py-1"><span>{t('endingCashBalance')}</span><span>{formatCurrency(cashFlowData.endingCashBalance)}</span></div>
                  </div>
              </div>
          </Card>
          <Card title={t('cashFlowChartTitle')}>
            <div className="h-80">
              <canvas ref={chartRef}></canvas>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default CashFlowPage;