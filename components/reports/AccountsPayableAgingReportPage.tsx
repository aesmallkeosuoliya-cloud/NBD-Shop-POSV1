
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Purchase, Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPurchases, getSuppliers } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';

// --- TYPE DEFINITIONS ---
interface ProcessedInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  amount: number;
  paid: number; // Assumed 0 for now
  outstanding: number;
  agingDays: number;
}

interface SupplierAgingSummary {
  supplierId: string;
  supplierName: string;
  totalOutstanding: number;
  bucket1: number; // 0-30
  bucket2: number; // 31-60
  bucket3: number; // >60
  invoices: ProcessedInvoice[];
}

// --- Detail Table Sub-component ---
const DetailTable: React.FC<{ invoices: ProcessedInvoice[], t: (key: string) => string, formatCurrency: (val: number) => string, getAgingColor: (days: number) => string }> = 
({ invoices, t, formatCurrency, getAgingColor }) => {
    
    const subtotal = useMemo(() => invoices.reduce((sum, inv) => sum + inv.outstanding, 0), [invoices]);

    return (
        <div className="p-2 sm:p-4 bg-slate-50 rounded-b-lg">
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-200">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="px-2 py-2 text-left">{t('invoiceNo')}</th>
                            <th className="px-2 py-2 text-left">{t('invoiceDate')}</th>
                            <th className="px-2 py-2 text-left">{t('dueDate')}</th>
                            <th className="px-2 py-2 text-right">{t('amount')}</th>
                            <th className="px-2 py-2 text-right">{t('outstandingBalance')}</th>
                            <th className="px-2 py-2 text-right">{t('aging')}</th>
                            <th className="px-2 py-2 text-left">{t('remarks')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {invoices.map(inv => (
                            <tr key={inv.id}>
                                <td className="px-2 py-2 whitespace-nowrap">{inv.invoiceNo}</td>
                                <td className="px-2 py-2 whitespace-nowrap">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                <td className="px-2 py-2 whitespace-nowrap">{new Date(inv.dueDate).toLocaleDateString()}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(inv.amount)}</td>
                                <td className={`px-2 py-2 text-right font-semibold ${getAgingColor(inv.agingDays)}`}>{formatCurrency(inv.outstanding)}</td>
                                <td className={`px-2 py-2 text-right ${getAgingColor(inv.agingDays)}`}>{inv.agingDays}</td>
                                <td className="px-2 py-2">-</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr>
                            <td colSpan={4} className="px-2 py-2 text-right">{t('totalForSupplier')}:</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(subtotal)}</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};


// --- Main Page Component ---
const AccountsPayableAgingReportPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [suppliers, purchases] = await Promise.all([getSuppliers(), getPurchases()]);
        setAllSuppliers(suppliers);
        setAllPurchases(purchases);
      } catch (error) {
        console.error("Error fetching data for AP Aging Report:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return value.toLocaleString(language === 'lo' ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [language]);

  const getAgingColor = useCallback((days: number): string => {
    if (days > 60) return 'text-red-600';
    if (days > 30) return 'text-orange-500';
    return 'text-gray-800';
  }, []);
  
  const agingSummaryData = useMemo<SupplierAgingSummary[]>(() => {
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));
    const creditPurchases = allPurchases.filter(p => p.paymentMethod === 'credit' && p.supplierId);
    
    const today = new Date(asOfDate + 'T23:59:59.999Z');

    const summaryMap = new Map<string, SupplierAgingSummary>();

    creditPurchases.forEach(purchase => {
      const supplier = supplierMap.get(purchase.supplierId!);
      if (!supplier) return;

      const invoiceDate = new Date(purchase.purchaseDate);
      const creditDays = supplier.creditDays || 0;
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      if (dueDate > today) return; // Skip invoices not yet due as of the report date

      const agingDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const outstandingAmount = purchase.totalAmount; // Assuming full amount is outstanding

      const processedInvoice: ProcessedInvoice = {
        id: purchase.id,
        invoiceNo: purchase.purchaseOrderNumber || purchase.id.slice(-6),
        invoiceDate: purchase.purchaseDate,
        dueDate: dueDate.toISOString(),
        currency: purchase.currency,
        amount: purchase.totalAmount,
        paid: 0,
        outstanding: outstandingAmount,
        agingDays: agingDays < 0 ? 0 : agingDays,
      };

      let summary = summaryMap.get(supplier.id);
      if (!summary) {
        summary = {
          supplierId: supplier.id,
          supplierName: supplier.name,
          totalOutstanding: 0,
          bucket1: 0,
          bucket2: 0,
          bucket3: 0,
          invoices: [],
        };
        summaryMap.set(supplier.id, summary);
      }
      
      summary.invoices.push(processedInvoice);
      summary.totalOutstanding += outstandingAmount;

      if (agingDays <= 30) {
        summary.bucket1 += outstandingAmount;
      } else if (agingDays <= 60) {
        summary.bucket2 += outstandingAmount;
      } else {
        summary.bucket3 += outstandingAmount;
      }
    });

    return Array.from(summaryMap.values()).sort((a,b) => b.totalOutstanding - a.totalOutstanding);
  }, [allSuppliers, allPurchases, asOfDate]);

  const grandTotals = useMemo(() => {
    return agingSummaryData.reduce((acc, curr) => {
        acc.total += curr.totalOutstanding;
        acc.bucket1 += curr.bucket1;
        acc.bucket2 += curr.bucket2;
        acc.bucket3 += curr.bucket3;
        return acc;
    }, { total: 0, bucket1: 0, bucket2: 0, bucket3: 0 });
  }, [agingSummaryData]);

  const handleToggleRow = (supplierId: string) => {
    setExpandedSupplierId(prevId => (prevId === supplierId ? null : supplierId));
  };


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('apAgingReport')}</h1>

      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <Input label={t('asOfDate')} type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} wrapperClassName="mb-0" />
        </div>
      </Card>
      
      {isLoading ? <LoadingSpinner /> : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('supplier')}</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('totalOutstanding')}</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('aging_0_30')}</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('aging_31_60')}</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('aging_60_plus')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agingSummaryData.map(summary => (
                  <React.Fragment key={summary.supplierId}>
                    <tr onClick={() => handleToggleRow(summary.supplierId)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-purple-700">{summary.supplierName}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(summary.totalOutstanding)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(summary.bucket1)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${getAgingColor(31)}`}>{formatCurrency(summary.bucket2)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${getAgingColor(61)}`}>{formatCurrency(summary.bucket3)}</td>
                    </tr>
                    {expandedSupplierId === summary.supplierId && (
                      <tr>
                        <td colSpan={5} className="p-0 bg-gray-100">
                            <DetailTable invoices={summary.invoices} t={t} formatCurrency={formatCurrency} getAgingColor={getAgingColor} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-200 font-bold text-gray-800">
                <tr>
                    <td className="px-4 py-3 text-right">{t('grandTotalOutstanding')}:</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(grandTotals.total)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(grandTotals.bucket1)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(grandTotals.bucket2)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(grandTotals.bucket3)}</td>
                </tr>
              </tfoot>
            </table>
            {agingSummaryData.length === 0 && <p className="text-center text-gray-500 py-8">{t('noDataFound')}</p>}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AccountsPayableAgingReportPage;
