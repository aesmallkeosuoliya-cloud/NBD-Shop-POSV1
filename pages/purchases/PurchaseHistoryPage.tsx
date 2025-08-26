

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Purchase, PurchaseItemDetail, PurchasePaidStatus, Supplier, Product, PurchasePayment, StoreSettings } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getPurchases, getSuppliers, isFirebaseInitialized, softDeletePurchase, recordPurchasePayment, getPurchasePayments, cancelPurchasePayment, getStoreSettings, getProducts } from '../../services/firebaseService';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { UI_COLORS, PURCHASE_PAYMENT_METHODS_OPTIONS, DEFAULT_STORE_SETTINGS } from '../../constants';

declare var Swal: any;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;


export const PurchaseHistoryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const grnPrintAreaRootRef = useRef<Root | null>(null);
  
  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // New State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'items' | 'payments'>('items');

  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (isoDate: string) => {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    try {
      const [fetchedPurchases, fetchedSuppliers, fetchedSettings, fetchedProducts] = await Promise.all([
        getPurchases(), 
        getSuppliers(),
        getStoreSettings(),
        getProducts()
      ]);
      setAllPurchases(fetchedPurchases.filter(p => !p.isDeleted));
      setSuppliers(fetchedSuppliers);
      setAllProducts(fetchedProducts);
      setStoreSettings(fetchedSettings || DEFAULT_STORE_SETTINGS);
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let result = allPurchases;
    if (filterDateFrom) result = result.filter(p => new Date(p.purchaseDate) >= new Date(filterDateFrom));
    if (filterDateTo) result = result.filter(p => new Date(p.purchaseDate) <= new Date(filterDateTo + 'T23:59:59.999Z'));
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(p => 
            p.docNo?.toLowerCase().includes(lowerSearch) ||
            p.id.toLowerCase().includes(lowerSearch) ||
            p.invoiceNo?.toLowerCase().includes(lowerSearch) ||
            p.purchaseOrderNumber?.toLowerCase().includes(lowerSearch) ||
            p.supplierName?.toLowerCase().includes(lowerSearch)
        );
    }
    setFilteredPurchases(result);
  }, [allPurchases, filterDateFrom, filterDateTo, searchTerm]);

  const selectedPurchase = useMemo(() => {
    if (!selectedPurchaseId) return null;
    return allPurchases.find(p => p.id === selectedPurchaseId) || null;
  }, [selectedPurchaseId, allPurchases]);

  useEffect(() => {
    setActiveDetailTab('items');
  }, [selectedPurchaseId]);


  const getStatusClass = (status?: PurchasePaidStatus) => {
    switch(status) {
        case 'paid': return 'bg-green-100 text-green-800';
        case 'partial': return 'bg-orange-100 text-orange-800';
        case 'unpaid': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  }
  
  const getStatusText = (status?: PurchasePaidStatus) => {
    if(!status) return t('unknown');
    const key = `paidStatus${status.charAt(0).toUpperCase() + status.slice(1)}`;
    return t(key);
  }

  const handlePayClick = () => {
    if (selectedPurchase && selectedPurchase.paidStatus !== 'paid') {
      setIsPayModalOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedPurchaseId || !currentUser) return;
    const result = await Swal.fire({
      title: t('areYouSureDelete'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('yes'),
      cancelButtonText: t('no')
    });

    if (result.isConfirmed) {
      setIsLoading(true);
      try {
        await softDeletePurchase(selectedPurchaseId, { officerId: currentUser.uid, officerName: currentUser.email });
        Swal.fire(t('success'), t('deleteSuccess'), 'success');
        setSelectedPurchaseId(null);
        fetchData();
      } catch (error) {
        console.error("Error deleting purchase:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePrint = () => {
    if (!selectedPurchase) {
      Swal.fire(t('error'), t('select') + ' ' + t('purchases'), 'warning');
      return;
    }
    
    const printAreaContainer = document.getElementById('grn-print-area-wrapper');
    if (!printAreaContainer) {
      console.error("GRN print area wrapper not found in index.html");
      Swal.fire(t('error'), 'Print container not found.', 'error');
      return;
    }
    
    if (!grnPrintAreaRootRef.current) {
        grnPrintAreaRootRef.current = createRoot(printAreaContainer);
    }
    
    grnPrintAreaRootRef.current.render(
      <PrintableGRN
        purchase={selectedPurchase}
        settings={storeSettings}
        suppliers={suppliers}
        products={allProducts}
        t={t}
        formatCurrency={formatCurrency}
        formatDate={(iso) => new Date(iso).toLocaleDateString(localeForFormatting)}
      />
    );

    setTimeout(() => {
        document.body.classList.add('printing-grn');
        
        const cleanup = () => {
            document.body.classList.remove('printing-grn');
            window.removeEventListener('afterprint', cleanup);
            if (grnPrintAreaRootRef.current) {
                grnPrintAreaRootRef.current.render(null);
            }
        };
        window.addEventListener('afterprint', cleanup);
        
        window.print();
    }, 500);
  };


  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-100 p-2 sm:p-4 text-sm">
      <Card className="mb-2 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <Input label={t('date') + ` (${t('from')})`} type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('date') + ` (${t('to')})`} type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('search')} placeholder="Doc No, PO No, Supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} wrapperClassName="mb-0"/>
            <Button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setSearchTerm(''); }} variant="outline" className="h-10">{t('clearFilters')}</Button>
        </div>
      </Card>
      
      <div className="flex-grow flex flex-col bg-white shadow-md rounded-lg overflow-hidden">
        {isLoading ? <div className="flex-grow flex items-center justify-center"><LoadingSpinner/></div> : (
            <div className="flex-grow overflow-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            {['docNo', 'invoiceNo', 'poDocNo', 'supplierName', 'grandTotal', 'creditDays', 'dueDate', 'paidStatus', 'paidAmount', 'outstandingAmount', 'notes', 'createOfficerName'].map(key => (
                                <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t(key)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPurchases.map(p => (
                          <tr key={p.id} onClick={() => setSelectedPurchaseId(p.id)} className={`cursor-pointer ${selectedPurchaseId === p.id ? 'bg-purple-200' : getStatusClass(p.paidStatus)} hover:bg-purple-300`}>
                              <td className="px-3 py-2 whitespace-nowrap">{p.docNo || p.id.slice(-8)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.invoiceNo || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.purchaseOrderNumber || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.supplierName}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">{formatCurrency(p.grandTotal)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right">{p.creditDays || 0}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.dueDate ? formatDate(p.dueDate) : '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(p.paidStatus)}`}>{getStatusText(p.paidStatus)}</span></td>
                              <td className="px-3 py-2 whitespace-nowrap text-right">{formatCurrency(p.paidAmount)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-red-600">{formatCurrency(p.outstanding)}</td>
                              <td className="px-3 py-2 whitespace-nowrap max-w-xs truncate">{p.notes || '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.createOfficerName || p.createOfficerId}</td>
                          </tr>
                      ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {selectedPurchase && (
          <div className="flex-shrink-0 h-2/5 border-t-2 border-gray-300 flex flex-col bg-slate-50">
            <div className="flex-shrink-0 border-b bg-gray-100">
                <button onClick={() => setActiveDetailTab('items')} className={`px-4 py-2 text-sm font-medium ${activeDetailTab === 'items' ? 'bg-white border-purple-500 border-t-2 text-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}>{t('itemsList')}</button>
                <button onClick={() => setActiveDetailTab('payments')} className={`px-4 py-2 text-sm font-medium ${activeDetailTab === 'payments' ? 'bg-white border-purple-500 border-t-2 text-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}>{t('paymentHistory')}</button>
            </div>
            <div className="flex-grow p-2 overflow-auto">
                {activeDetailTab === 'items' && <ItemsTab items={selectedPurchase.items} formatCurrency={formatCurrency} t={t} />}
                {activeDetailTab === 'payments' && <PaymentsTab purchase={selectedPurchase} onActionSuccess={fetchData} formatCurrency={formatCurrency} formatDate={formatDate} t={t} currentUser={currentUser} />}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 bg-gray-200 p-1.5 mt-2 rounded-md shadow-inner flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={!selectedPurchaseId} leftIcon={<EditIcon />}>{t('edit')}</Button>
        <Button size="sm" variant="ghost" disabled={true}>{t('actionEditPrice')}</Button>
        <Button size="sm" variant="ghost" disabled={!selectedPurchaseId} leftIcon={<DeleteIcon />} onClick={handleDelete}>{t('delete')}</Button>
        <Button size="sm" variant="ghost" disabled={!selectedPurchaseId || selectedPurchase?.paidStatus === 'paid'} leftIcon={<PayIcon />} onClick={handlePayClick}>{t('actionPay')}</Button>
        <Button size="sm" variant="ghost" disabled={!selectedPurchaseId || !['partial', 'paid'].includes(selectedPurchase?.paidStatus || '')} onClick={() => setActiveDetailTab('payments')}>{t('actionCancelPay')}</Button>
        <Button size="sm" variant="ghost" disabled={!selectedPurchaseId} leftIcon={<PrintIcon />} onClick={handlePrint}>{t('print')}</Button>
        <Button size="sm" variant="ghost" disabled={true}>{t('printReport')}</Button>
      </div>

      {isPayModalOpen && selectedPurchase && (
        <PayModal
          purchase={selectedPurchase}
          onClose={() => setIsPayModalOpen(false)}
          onSuccess={fetchData}
          t={t}
          currentUser={currentUser}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};


// --- INLINE COMPONENTS ---

const ItemsTab: React.FC<{items: PurchaseItemDetail[], formatCurrency: (v: number) => string, t: (k:string) => string}> = ({items, formatCurrency, t}) => (
    <div className="overflow-auto h-full">
        <table className="min-w-full text-xs">
            <thead className="bg-gray-200 sticky top-0"><tr className="text-left">
                <th>{t('productName')}</th><th>{t('quantity')}</th><th>{t('buyPrice')}</th><th>{t('total')}</th>
            </tr></thead>
            <tbody>{items.map(item => <tr key={item.productId} className="border-b">
                <td>{item.productName}</td><td>{item.quantity}</td><td>{formatCurrency(item.buyPrice)}</td><td>{formatCurrency(item.quantity * item.buyPrice)}</td>
            </tr>)}</tbody>
        </table>
    </div>
);

const PaymentsTab: React.FC<{purchase: Purchase, onActionSuccess: () => void, formatCurrency: (v:number)=>string, formatDate: (d:string)=>string, t: (k:string)=>string, currentUser: any}> = ({ purchase, onActionSuccess, formatCurrency, formatDate, t, currentUser }) => {
    const [payments, setPayments] = useState<PurchasePayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            setIsLoading(true);
            try {
                const fetchedPayments = await getPurchasePayments(purchase.id);
                setPayments(fetchedPayments.sort((a,b) => new Date(b.payDate).getTime() - new Date(a.payDate).getTime()));
            } catch (error) { console.error("Error fetching payments", error); }
            finally { setIsLoading(false); }
        };
        fetchPayments();
    }, [purchase.id]);

    const handleCancelPayment = async (paymentId: string) => {
        if (!currentUser) return;
        const result = await Swal.fire({ title: t('confirm'), text: t('confirmCancelPayment'), icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) {
            try {
                await cancelPurchasePayment(purchase.id, paymentId, { officerId: currentUser.uid, officerName: currentUser.email });
                Swal.fire(t('success'), t('paymentCancelledSuccess'), 'success');
                onActionSuccess();
            } catch (error) {
                Swal.fire(t('error'), (error as Error).message, 'error');
            }
        }
    };
    
    if (isLoading) return <LoadingSpinner />;
    if (payments.length === 0) return <p className="text-center p-4">{t('noPaymentsMade')}</p>;

    return (
        <div className="overflow-auto h-full">
            <table className="min-w-full text-xs">
                <thead className="bg-gray-200 sticky top-0"><tr className="text-left">
                    <th>{t('payDate')}</th><th>{t('payAmount')}</th><th>{t('paymentMethod')}</th><th>{t('officer')}</th><th>{t('remark')}</th><th>{t('actions')}</th>
                </tr></thead>
                <tbody>{payments.map(p => <tr key={p.id} className={`border-b ${p.isCancelled ? 'bg-red-100 text-gray-500 line-through' : ''}`}>
                    <td>{formatDate(p.payDate)}</td><td>{formatCurrency(p.payAmount)}</td><td>{p.method}</td><td>{p.officerName}</td><td>{p.remark}</td>
                    <td>
                        {!p.isCancelled && <Button size="sm" variant="danger" onClick={() => handleCancelPayment(p.id)}>{t('cancel')}</Button>}
                        {p.isCancelled && <span className="font-bold text-red-600">{t('cancelled')}</span>}
                    </td>
                </tr>)}</tbody>
            </table>
        </div>
    );
};

const PayModal: React.FC<{purchase: Purchase, onClose: () => void, onSuccess: () => void, t: any, currentUser: any, formatCurrency: any}> = ({ purchase, onClose, onSuccess, t, currentUser, formatCurrency }) => {
    const [payAmount, setPayAmount] = useState<number | ''>(purchase.outstanding ?? 0);
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState<'cash' | 'transfer' | 'cheque' | 'other'>('transfer');
    const [remark, setRemark] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payAmount || payAmount <= 0) return;
        if (payAmount > (purchase.outstanding ?? 0)) {
            Swal.fire(t('error'), t('paymentCannotExceedOutstanding'), 'error');
            return;
        }
        setIsSaving(true);
        try {
            await recordPurchasePayment(
                purchase.id,
                { payDate, payAmount, method, remark },
                { officerId: currentUser.uid, officerName: currentUser.email }
            );
            Swal.fire(t('success'), t('saveSuccess'), 'success');
            onSuccess();
            onClose();
        } catch (error) {
            Swal.fire(t('error'), (error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`${t('actionPay')}: ${purchase.docNo || purchase.id.slice(-8)}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-2 bg-slate-100 rounded">Outstanding: <span className="font-bold text-red-600">{formatCurrency(purchase.outstanding)}</span></div>
                <Input label={t('payDate')} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
                <Input label={t('payAmount')} type="number" value={String(payAmount)} onChange={e => setPayAmount(Number(e.target.value))} required />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentMethod')}</label>
                    <select value={method} onChange={e => setMethod(e.target.value as any)} className="w-full h-11 border-gray-300 rounded-md">
                        <option value="cash">{t('paymentMethodCash')}</option>
                        <option value="transfer">{t('paymentMethodTransfer')}</option>
                        <option value="cheque">{t('paymentMethodCheque')}</option>
                        <option value="other">{t('paymentMethodOther')}</option>
                    </select>
                </div>
                <Input label={t('remark')} value={remark} onChange={e => setRemark(e.target.value)} />
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
                    <Button type="submit" isLoading={isSaving}>{t('save')}</Button>
                </div>
            </form>
        </Modal>
    );
};

const PrintableGRN: React.FC<{
  purchase: Purchase;
  settings: StoreSettings;
  suppliers: Supplier[];
  products: Product[];
  t: (key: string, replacements?: Record<string, string>) => string;
  formatCurrency: (value: number) => string;
  formatDate: (isoDate: string) => string;
}> = ({ purchase, settings, suppliers, products, t, formatCurrency, formatDate }) => {
    
    const numberToLaoWords = (num: number): string => {
        if (typeof num !== 'number') return '';
    
        const laoNumbers = ['ສູນ', 'ໜຶ່ງ', 'ສອງ', 'ສາມ', 'ສີ່', 'ຫ້າ', 'ຫົກ', 'ເຈັດ', 'ແປດ', 'ເກົ້າ'];
        const laoPlaceholders = ['', 'ສິບ', 'ຮ້ອຍ', 'ພັນ', 'ໝື່ນ', 'ແສນ', 'ລ້ານ'];
    
        const toWords = (n: number): string => {
            if (n === 0) return '';
            let word = '';
            const numStr = n.toString();
            const len = numStr.length;
            for (let i = 0; i < len; i++) {
                let digit = parseInt(numStr[i]);
                let pos = len - 1 - i;
                if (digit === 0) continue;
                
                if (pos === 1) { // Tens
                    if (digit === 1) word += 'ສິບ';
                    else if (digit === 2) word += 'ຊາວ';
                    else word += laoNumbers[digit] + 'ສິບ';
                } else if (pos === 0) { // Units
                     if (len > 1 && numStr[len - 2] !== '0' && digit === 1) word += 'ເອັດ';
                     else word += laoNumbers[digit];
                } else { // Others (hundreds, thousands...)
                    word += laoNumbers[digit] + laoPlaceholders[pos];
                }
            }
            return word;
        };
    
        const kipPart = Math.floor(num);
        const attPart = Math.round((num - kipPart) * 100);
    
        const kipWords = toWords(kipPart);
        const attWords = toWords(attPart);
    
        let result = '';
        if (kipPart > 0) result += `${kipWords}${t('kip')}`;
        if (attPart > 0) {
            if (result !== '') result += ' ';
            result += `${attWords}${t('att')}`;
        }
        if (result === '') return `${laoNumbers[0]} ${t('kip')}`;
        return result;
    };


    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const discount = (purchase.subtotal + purchase.taxAmount) - purchase.grandTotal;

    return (
    <div className="grn-v2-container">
      <header className="grn-v2-header">
        <div className="grn-v2-header-left">
            <p className="store-name">{settings.storeName}</p>
        </div>
        <div className="grn-v2-header-right">
             <p className="title">{t('purchaseBillTitle')}</p>
        </div>
      </header>
      
      <div className="grn-v2-info-grid">
          <div className="supplier-info">
            <p><strong>{t('supplierName')}:</strong> {purchase.supplierName || t('unknown')}</p>
            <p><strong>{t('address')}:</strong> {supplier?.taxInfo || '-'}</p>
            <p><strong>{t('phone')}:</strong> {supplier?.phone || '-'}</p>
          </div>
          <div className="doc-info">
             <div className="doc-info-item"><span>{t('docNo')}:</span><span>{purchase.docNo || purchase.id.slice(-6)}</span></div>
             <div className="doc-info-item"><span>{t('invoiceNo')}:</span><span>{purchase.invoiceNo || purchase.purchaseOrderNumber || '-'}</span></div>
             <div className="doc-info-item"><span>{t('date')}:</span><span>{formatDate(purchase.purchaseDate)}</span></div>
             <div className="doc-info-item"><span>{t('creditTerm')}:</span><span>{purchase.creditDays || 0} {t('days')}</span></div>
          </div>
      </div>
      
      <table className="grn-v2-items-table">
        <thead>
          <tr>
            <th>{t('table_no')}</th>
            <th>{t('table_barcode')}</th>
            <th>{t('itemsList')}</th>
            <th style={{ textAlign: 'right' }}>{t('quantity')}</th>
            <th>{t('table_unit')}</th>
            <th style={{ textAlign: 'right' }}>{t('table_unit_price')}</th>
            <th style={{ textAlign: 'right' }}>{t('totalPrice')}</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((item, index) => {
            const product = productMap.get(item.productId);
            return (
            <tr key={item.productId + index}>
              <td>{index + 1}</td>
              <td>{product?.barcode || '-'}</td>
              <td>{item.productName}</td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td>{product?.unit || '-'}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.buyPrice)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.buyPrice * item.quantity)}</td>
            </tr>
          )})}
        </tbody>
      </table>
      
       <div className="grn-v2-footer">
          <div className="grn-v2-footer-left">
            <div className="amount-in-words">
                {`(${numberToLaoWords(purchase.grandTotal)})`}
            </div>
            <div className="notes">
                <strong>{t('notes')}:</strong>
                <p style={{ margin: 0 }}>{purchase.notes || '-'}</p>
            </div>
          </div>
          <div className="grn-v2-footer-right">
             <table className="grn-v2-summary-table">
                 <tbody>
                     <tr><td className="summary-label">{t('totalAmountAll')}:</td><td className="summary-value">{formatCurrency(purchase.subtotal)}</td></tr>
                     {discount > 0 && <tr><td className="summary-label">{t('endOfBillDiscount')}:</td><td className="summary-value">{formatCurrency(discount)}</td></tr>}
                     {purchase.taxAmount > 0 && <tr><td className="summary-label">{t('taxAmount')}:</td><td className="summary-value">{formatCurrency(purchase.taxAmount)}</td></tr>}
                     <tr className="grand-total"><td className="summary-label">{t('grandTotalNet')}:</td><td className="summary-value">{formatCurrency(purchase.grandTotal)}</td></tr>
                 </tbody>
             </table>
          </div>
      </div>
      
      <div className="grn-v2-signatures">
          <div className="signature-box">
              <div className="signature-line"></div>
              <span>({t('issuer')})</span>
          </div>
          <div className="signature-box">
              <div className="signature-line"></div>
              <span>({t('approver')})</span>
          </div>
      </div>
    </div>
  );
};
