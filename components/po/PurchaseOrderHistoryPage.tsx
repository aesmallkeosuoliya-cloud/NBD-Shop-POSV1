
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PurchaseOrder, Product } from '../../types'; // Import Product
import { useLanguage } from '../../contexts/LanguageContext';
import { getPurchaseOrders, deletePurchaseOrder, getProducts } from '../../services/firebaseService'; // Import getProducts
import { PO_STATUSES, UI_COLORS } from '../../constants';
import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal';
import { useNavigate } from 'react-router-dom';

declare var Swal: any;

const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


const PurchaseOrderHistoryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [allPOs, setAllPOs] = useState<PurchaseOrder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // New state for products
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterPoNumber, setFilterPoNumber] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPOForDetail, setSelectedPOForDetail] = useState<PurchaseOrder | null>(null);

  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const fetchData = useCallback(async () => { // Renamed from fetchPOs
    setIsLoading(true);
    try {
      const [fetchedPOs, fetchedProducts] = await Promise.all([
        getPurchaseOrders(),
        getProducts()
      ]);
      setAllPOs(fetchedPOs); // Already sorted by date in service
      setAllProducts(fetchedProducts);
    } catch (error) {
      console.error("Error fetching POs:", error);
      Swal.fire(t('error'), t('errorFetchingPOs'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let result = allPOs;
    if (filterPoNumber) {
      result = result.filter(po => po.poNumber.toLowerCase().includes(filterPoNumber.toLowerCase()));
    }
    if (filterSupplier) {
      result = result.filter(po => po.supplierName?.toLowerCase().includes(filterSupplier.toLowerCase()));
    }
    if (filterDateFrom) {
      result = result.filter(po => new Date(po.orderDate) >= new Date(filterDateFrom));
    }
    if (filterDateTo) {
      result = result.filter(po => new Date(po.orderDate) <= new Date(filterDateTo + 'T23:59:59.999Z'));
    }
    if (filterStatus !== 'all') {
      result = result.filter(po => po.status === filterStatus);
    }
    setFilteredPOs(result);
  }, [allPOs, filterPoNumber, filterSupplier, filterDateFrom, filterDateTo, filterStatus]);

  const handleViewDetails = (po: PurchaseOrder) => {
    setSelectedPOForDetail(po);
    setIsDetailModalOpen(true);
  };

  const handleImportToStockIn = (poId: string) => {
    setIsDetailModalOpen(false); // Close modal first
    navigate(`/purchases?poId=${poId}`); // Navigate to Stock-In page with poId
  };

  const handleEditPO = (poId: string) => {
    navigate(`/purchase-orders/edit/${poId}`);
  };

  const handleDeletePO = async (poId: string) => {
    const result = await Swal.fire({
      title: t('confirmDeletePO'),
      text: t('actionCannotBeUndone'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      cancelButtonColor: UI_COLORS.secondary,
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel'),
    });

    if (result.isConfirmed) {
      setIsLoading(true);
      try {
        await deletePurchaseOrder(poId);
        Swal.fire(t('success'), t('poDeleteSuccess'), 'success');
        fetchData();
      } catch (error) {
        console.error("Error deleting PO:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };


  const getStatusDisplay = (statusValue: string) => {
    const statusInfo = PO_STATUSES.find(s => s.value === statusValue);
    // Ensure className provides text color that contrasts with its background
    return statusInfo ? { text: t(statusInfo.labelKey), className: statusInfo.className } : { text: statusValue, className: 'bg-gray-200 text-gray-800' };
  };
  
  const clearAllFilters = () => {
    setFilterPoNumber('');
    setFilterSupplier('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('all');
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">{t('poHistoryPageTitle')}</h1>

      <Card bodyClassName="p-4 space-y-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
          <Input label={t('filterByReceiptNo')} placeholder={t('poNumberShort') + '...'} value={filterPoNumber} onChange={e => setFilterPoNumber(e.target.value)} wrapperClassName="mb-0"/>
          <Input label={t('supplier')} placeholder={t('supplierName') + '...'} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} wrapperClassName="mb-0"/>
          <Input label={t('date') + ` (${t('from')})`} type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} wrapperClassName="mb-0"/>
          <Input label={t('date') + ` (${t('to')})`} type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} wrapperClassName="mb-0"/>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">{t('poTableStatus')}</label>
            <select id="statusFilter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2.5 h-11 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="all">{t('all')}</option>
              {PO_STATUSES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
             <Button onClick={clearAllFilters} variant="outline" className="h-10 border-gray-300 text-gray-700 hover:bg-gray-100">{t('clearFilters')}</Button>
        </div>
      </Card>

      {isLoading ? (
        <LoadingSpinner text={t('loading')} />
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('poNumberLabel')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('orderDateLabel')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('supplier')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{t('poTableItemCount')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{t('poGrandTotalLabel')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">{t('poTableStatus')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPOs.map(po => {
                const statusInfo = getStatusDisplay(po.status);
                const isActionable = po.status === 'pending';
                return (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-purple-600">{po.poNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">{formatDate(po.orderDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">{po.supplierName || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{po.items.length}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(po.grandTotal)} {currencySymbol}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${statusInfo.className}`}>
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(po)} className="text-blue-600 hover:text-blue-900 p-1" title={t('viewPODetails')}>
                        <EyeIcon />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditPO(po.id)} className="text-yellow-600 hover:text-yellow-900 p-1" title={isActionable ? t('edit') : t('editDisabledTooltipPO')} disabled={!isActionable}>
                        <EditIcon />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePO(po.id)} className="text-red-600 hover:text-red-900 p-1" title={isActionable ? t('delete') : t('deleteDisabledTooltipPO')} disabled={!isActionable}>
                        <DeleteIcon />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredPOs.length === 0 && !isLoading && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selectedPOForDetail && (
        <PurchaseOrderDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            purchaseOrder={selectedPOForDetail}
            onImportToStockIn={handleImportToStockIn}
            products={allProducts}
        />
      )}
    </div>
  );
};

export default PurchaseOrderHistoryPage;
