
import React, { useState, useEffect, useCallback } from 'react';
import { Purchase, PurchaseItemDetail } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getPurchases, isFirebaseInitialized } from '../../services/firebaseService';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { PURCHASE_PAYMENT_METHODS_OPTIONS } from '../../constants';

declare var Swal: any; // For SweetAlert2

// Icons
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;

export const PurchaseHistoryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterRefNo, setFilterRefNo] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric', hour:'2-digit', minute: '2-digit'
    });
  };

  const fetchPurchases = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      return;
    }
    setIsLoading(true);
    try {
      const fetchedPurchases = await getPurchases(); // Service function already sorts by date
      setAllPurchases(fetchedPurchases);
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    let result = allPurchases;
    if (filterDateFrom) {
      result = result.filter(p => new Date(p.purchaseDate) >= new Date(filterDateFrom));
    }
    if (filterDateTo) {
      result = result.filter(p => new Date(p.purchaseDate) <= new Date(filterDateTo + 'T23:59:59.999Z'));
    }
    if (filterRefNo) {
      result = result.filter(p => p.purchaseOrderNumber?.toLowerCase().includes(filterRefNo.toLowerCase()));
    }
    if (filterSupplier) {
      result = result.filter(p => p.supplierName?.toLowerCase().includes(filterSupplier.toLowerCase()));
    }
    setFilteredPurchases(result);
  }, [allPurchases, filterDateFrom, filterDateTo, filterRefNo, filterSupplier]);

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailModalOpen(true);
  };
  
  const clearAllFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterRefNo('');
    setFilterSupplier('');
  };

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return '-';
    const option = PURCHASE_PAYMENT_METHODS_OPTIONS.find(opt => opt.value === method);
    return option ? t(option.labelKey) : method;
  };


  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">{t('purchaseHistory')}</h1>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
            <Input label={t('date') + ` (${t('from')})`} type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('date') + ` (${t('to')})`} type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('purchaseOrderNumber')} placeholder={t('purchaseOrderNumber') + '...'} value={filterRefNo} onChange={e => setFilterRefNo(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('supplier')} placeholder={t('supplierName') + '...'} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} wrapperClassName="mb-0"/>
            <Button onClick={clearAllFilters} variant="outline" className="w-full h-10">{t('clearFilters')}</Button>
        </div>
      </Card>
      
      {isLoading ? (
          <div className="flex justify-center items-center h-64"><LoadingSpinner text={t('loading')} /></div>
      ) : (
          <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('purchaseDate')}</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('purchaseOrderNumber')}</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('supplier')}</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('paymentMethod')}</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('totalPurchaseAmount')}</th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPurchases.map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(purchase.purchaseDate)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.purchaseOrderNumber || (purchase.relatedPoId ? `PO: ${purchase.relatedPoId.slice(-6)}` : '-')}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.supplierName || t('unknown')}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getPaymentMethodLabel(purchase.paymentMethod)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(purchase.totalAmount)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(purchase)} className="text-blue-600 hover:text-blue-900 p-1" title={t('details')}><EyeIcon /></Button>
                              </td>
                          </tr>
                      ))}
                      {filteredPurchases.length === 0 && !isLoading && (
                          <tr><td colSpan={6} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {selectedPurchase && (
          <Modal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              title={`${t('details')} ${t('purchases')} #${selectedPurchase.id.substring(selectedPurchase.id.length - 6)}`}
              size="lg"
          >
              <div className="space-y-3 text-sm">
                  <p><strong className="text-gray-700">{t('purchaseDate')}:</strong> <span className="text-gray-800">{formatDate(selectedPurchase.purchaseDate)}</span></p>
                  <p><strong className="text-gray-700">{t('purchaseOrderNumber')}:</strong> <span className="text-gray-800">{selectedPurchase.purchaseOrderNumber || (selectedPurchase.relatedPoId ? `PO Ref: ${selectedPurchase.relatedPoId.slice(-6)}` : '-')}</span></p>
                  <p><strong className="text-gray-700">{t('supplier')}:</strong> <span className="text-gray-800">{selectedPurchase.supplierName || t('unknown')}</span></p>
                  <p><strong className="text-gray-700">{t('paymentMethod')}:</strong> <span className="text-gray-800">{getPaymentMethodLabel(selectedPurchase.paymentMethod)}</span></p>
                  <p><strong className="text-gray-700">{t('totalPurchaseAmount')}:</strong> <span className="text-gray-800 font-semibold">{formatCurrency(selectedPurchase.totalAmount)}</span></p>
                  {selectedPurchase.notes && <p><strong className="text-gray-700">{t('notes')}:</strong> <span className="text-gray-800">{selectedPurchase.notes}</span></p>}
                  
                  <h4 className="font-semibold pt-2 border-t mt-2 text-base text-gray-700">{t('itemsInPurchase')}:</h4>
                  {selectedPurchase.items.length > 0 ? (
                      <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                              <thead className="bg-gray-100">
                                  <tr>
                                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('productName')}</th>
                                      <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('quantity')}</th>
                                      <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('totalCostPricePerUnit')}</th>
                                      <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sellingPrice')}</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {selectedPurchase.items.map((item, index) => (
                                      <tr key={index} className="border-b last:border-b-0">
                                          <td className="px-2 py-1 text-gray-800">{item.productName}</td>
                                          <td className="px-2 py-1 text-right text-gray-800">{item.quantity}</td>
                                          <td className="px-2 py-1 text-right font-medium text-gray-800">{formatCurrency(item.totalCostPricePerUnit)}</td>
                                          <td className="px-2 py-1 text-right font-medium text-purple-600">{formatCurrency(item.calculatedSellingPrice)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  ) : <p className="italic text-gray-600">{t('noItemsInPurchase')}</p>}
              </div>
              <div className="mt-6 flex justify-end">
                  <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>{t('close')}</Button>
              </div>
          </Modal>
      )}

    </div>
  );
};
