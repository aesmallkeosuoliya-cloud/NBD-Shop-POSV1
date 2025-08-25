import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Purchase, Supplier, StoreSettings } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPurchases, getSuppliers, getStoreSettings } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import { DEFAULT_STORE_SETTINGS } from '../../constants';

// --- TYPE DEFINITIONS ---
interface ProcessedInvoice {
  id: string; // Purchase ID
  docNo: string; // purchaseOrderNumber or sliced purchase ID
  invoiceDate: string;
  dueDate: string;
  creditDays: number;
  amount: number;
  outstanding: number;
  agingDays: number;
}

interface SupplierSummary {
  supplierId: string;
  supplierName: string;
  billCount: number;
  totalOutstanding: number;
  invoices: ProcessedInvoice[];
}

// --- PRINTABLE COMPONENT ---
const PrintableAPReport: React.FC<{
    reportData: SupplierSummary;
    storeSettings: StoreSettings;
    t: (key: string) => string;
}> = ({ reportData, storeSettings, t }) => {
    
    const formatDate = (isoDate: string) => new Date(isoDate).toLocaleDateString(t('language') === 'lo' ? 'lo-LA' : 'th-TH');
    const formatCurrency = (value: number) => value.toLocaleString(t('language') === 'lo' ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="ap-print-container">
            <header className="ap-print-header">
                <div className="logo-container">
                    {storeSettings.logoUrl && <img src={storeSettings.logoUrl} alt="Logo" style={{ maxHeight: '40px', maxWidth: '100px' }} />}
                </div>
                <div className="title-container">
                    <h1>{t('apAgingReport')}</h1>
                </div>
                <div className="date-container">
                    <p>{t('date')}: {new Date().toLocaleString(t('language') === 'lo' ? 'lo-LA' : 'th-TH')}</p>
                </div>
            </header>
            <section className="ap-print-supplier-info">
                <p><strong>{t('branch')}:</strong> {storeSettings.storeName}</p>
                <p><strong>{t('supplierHeader')}:</strong> {reportData.supplierName}</p>
            </section>
            <table className="ap-print-table">
                <thead>
                    <tr>
                        <th>{t('branch')}</th>
                        <th>{t('buyId')}</th>
                        <th>{t('docNo')}</th>
                        <th>{t('taxInvoiceNo')}</th>
                        <th>{t('tableColDocDate')}</th>
                        <th>{t('creditDaysColumn')}</th>
                        <th>{t('dueDate')}</th>
                        <th style={{ textAlign: 'right' }}>{t('outstandingAmountInCurrency')}</th>
                        <th style={{ textAlign: 'right' }}>{t('paidAmount')}</th>
                        <th style={{ textAlign: 'right' }}>{t('balanceAmount')}</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.invoices.map(inv => (
                        <tr key={inv.id}>
                            <td>{storeSettings.storeName}</td>
                            <td>{inv.id.slice(-6)}</td>
                            <td>{inv.docNo}</td>
                            <td>-</td>
                            <td>{formatDate(inv.invoiceDate)}</td>
                            <td>{inv.creditDays}</td>
                            <td>{formatDate(inv.dueDate)}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(inv.amount)}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(inv.outstanding)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={9} style={{ textAlign: 'right' }}>TOTAL:</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(reportData.totalOutstanding)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};


// --- MAIN PAGE COMPONENT ---
const AccountsPayableAgingReportPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [endDueDate, setEndDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierFilter, setSupplierFilter] = useState('');
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const printAreaRootRef = useRef<Root | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [suppliers, purchases, settings] = await Promise.all([getSuppliers(), getPurchases(), getStoreSettings()]);
        setAllSuppliers(suppliers);
        setAllPurchases(purchases);
        setStoreSettings(settings || DEFAULT_STORE_SETTINGS);
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
    return 'text-gray-900';
  }, []);

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));
    const creditPurchases = allPurchases.filter(p => p.paymentMethod === 'credit' && p.supplierId);
    
    const reportDate = new Date(endDueDate + 'T23:59:59.999Z');
    const summaryMap = new Map<string, SupplierSummary>();

    for (const purchase of creditPurchases) {
      const supplier = supplierMap.get(purchase.supplierId!);
      if (!supplier) continue;
      
      const invoiceDate = new Date(purchase.purchaseDate);
      const creditDays = supplier.creditDays || 0;
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      // Only include invoices due on or before the report date
      if (dueDate > reportDate) continue;
      
      const agingDays = Math.max(0, Math.floor((reportDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let summary = summaryMap.get(supplier.id);
      if (!summary) {
        summary = {
          supplierId: supplier.id,
          supplierName: supplier.name,
          billCount: 0,
          totalOutstanding: 0,
          invoices: [],
        };
        summaryMap.set(supplier.id, summary);
      }
      
      summary.invoices.push({
        id: purchase.id,
        docNo: purchase.purchaseOrderNumber || `SI-${purchase.id.slice(-6)}`,
        invoiceDate: purchase.purchaseDate,
        dueDate: dueDate.toISOString(),
        creditDays: creditDays,
        amount: purchase.totalAmount,
        outstanding: purchase.totalAmount, // Assuming full amount is outstanding
        agingDays: agingDays,
      });
      
      summary.billCount += 1;
      summary.totalOutstanding += purchase.totalAmount;
    }
    
    let filteredData = Array.from(summaryMap.values());
    
    if (supplierFilter) {
      const lowerFilter = supplierFilter.toLowerCase();
      filteredData = filteredData.filter(s => s.supplierName.toLowerCase().includes(lowerFilter));
    }
    
    return filteredData.sort((a,b) => b.totalOutstanding - a.totalOutstanding);

  }, [allSuppliers, allPurchases, endDueDate, supplierFilter]);

  const selectedSupplierDetails = useMemo(() => {
    if (!selectedSupplierId) return null;
    return supplierSummaries.find(s => s.supplierId === selectedSupplierId) || null;
  }, [selectedSupplierId, supplierSummaries]);
  
  const handleRowClick = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
  };

  const handlePrint = () => {
    if (!selectedSupplierDetails) return;

    const printAreaContainer = document.getElementById('ap-print-area-wrapper');
    if (!printAreaContainer) {
        console.error("Print area wrapper not found");
        return;
    }

    if (!printAreaRootRef.current) {
        printAreaRootRef.current = createRoot(printAreaContainer);
    }

    printAreaRootRef.current.render(
      <PrintableAPReport
        reportData={selectedSupplierDetails}
        storeSettings={storeSettings}
        t={t}
      />
    );
    
    setTimeout(() => {
        document.body.classList.add('printing-ap-report');
        const cleanup = () => {
            document.body.classList.remove('printing-ap-report');
            window.removeEventListener('afterprint', cleanup);
            if (printAreaRootRef.current) {
                printAreaRootRef.current.render(null);
            }
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
    }, 500);
  };
  
  const grandTotal = useMemo(() => {
    return supplierSummaries.reduce((sum, s) => sum + s.totalOutstanding, 0);
  }, [supplierSummaries]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('apAgingReport')}</h1>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <Input label={t('supplierName')} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} wrapperClassName="mb-0" />
          <Input label={t('endDueDate')} type="date" value={endDueDate} onChange={e => setEndDueDate(e.target.value)} wrapperClassName="mb-0" />
        </div>
      </Card>
      
      {isLoading ? <LoadingSpinner /> : (
        <>
          <Card title={`${t('unpaidSupplier')} (${supplierSummaries.length})`} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('supplierName')}</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('billCount')}</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('outstandingAmountInCurrency')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplierSummaries.map(summary => (
                    <tr 
                      key={summary.supplierId} 
                      onClick={() => handleRowClick(summary.supplierId)} 
                      className={`cursor-pointer transition-colors ${selectedSupplierId === summary.supplierId ? 'bg-purple-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-purple-700">{summary.supplierName}</td>
                      <td className="px-4 py-3 text-right">{summary.billCount}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(summary.totalOutstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                 <tfoot className="bg-gray-200 font-bold text-gray-800">
                    <tr>
                        <td colSpan={2} className="px-4 py-3 text-right">{t('grandTotalOutstanding')}:</td>
                        <td className="px-4 py-3 text-right text-lg">{formatCurrency(grandTotal)}</td>
                    </tr>
                 </tfoot>
              </table>
              {supplierSummaries.length === 0 && <p className="text-center text-gray-500 py-8">{t('noDataFound')}</p>}
            </div>
          </Card>

          {selectedSupplierDetails && (
            <Card 
              title={`${t('unpaidSupplierDetail')}: ${selectedSupplierDetails.supplierName}`}
              bodyClassName="p-0"
              titleActions={
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={handlePrint}>{t('printReport')}</Button>
                    <Button variant="danger" size="sm" onClick={() => setSelectedSupplierId(null)}>{t('close')}</Button>
                </div>
              }
            >
               <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-t">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-2 py-2 text-left">{t('docNo')}</th>
                            <th className="px-2 py-2 text-left">{t('invoiceDate')}</th>
                            <th className="px-2 py-2 text-left">{t('creditDaysColumn')}</th>
                            <th className="px-2 py-2 text-left">{t('dueDate')}</th>
                            <th className="px-2 py-2 text-right">{t('amount')}</th>
                            <th className="px-2 py-2 text-right">{t('paidAmount')}</th>
                            <th className="px-2 py-2 text-right">{t('balanceAmount')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {selectedSupplierDetails.invoices.map(inv => (
                            <tr key={inv.id}>
                                <td className="px-2 py-2 whitespace-nowrap">{inv.docNo}</td>
                                <td className="px-2 py-2 whitespace-nowrap">{new Date(inv.invoiceDate).toLocaleDateString(language === 'lo' ? 'lo-LA' : 'th-TH')}</td>
                                <td className="px-2 py-2 whitespace-nowrap">{inv.creditDays}</td>
                                <td className="px-2 py-2 whitespace-nowrap">{new Date(inv.dueDate).toLocaleDateString(language === 'lo' ? 'lo-LA' : 'th-TH')}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(inv.amount)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                                <td className={`px-2 py-2 text-right font-semibold ${getAgingColor(inv.agingDays)}`}>{formatCurrency(inv.outstanding)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                        <tr>
                            <td colSpan={6} className="px-2 py-2 text-right">{t('total')}:</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(selectedSupplierDetails.totalOutstanding)}</td>
                        </tr>
                    </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AccountsPayableAgingReportPage;