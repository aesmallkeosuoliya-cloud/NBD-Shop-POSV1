

import React, { useState, useEffect, useCallback } from 'react';
import { Purchase, PurchaseOrder } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../../components/common/Button'; 
import Modal from '../../components/common/Modal'; 
import PurchaseForm from './PurchaseForm.tsx.tsx';
import LoadingSpinner from '../../components/common/LoadingSpinner'; 
import { addPurchaseAndProcess, getPurchases, deletePurchaseAndAssociatedRecords, isFirebaseInitialized, getPurchaseOrderById } from '../../services/firebaseService';
import { UI_COLORS } from '../../constants';
import { useLocation, useNavigate } from 'react-router-dom';
import SelectPOModal from '../../components/po/SelectPOModal'; 

declare var Swal: any; // For SweetAlert2

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ImportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
</svg>;


const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PurchasesPage: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation(); 
  const navigate = useNavigate(); 

  const [purchases, setPurchases] = useState<Purchase[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [initialPO, setInitialPO] = useState<PurchaseOrder | null>(null);
  const [isSelectPOModalOpen, setIsSelectPOModalOpen] = useState(false); // New state


  const fetchPurchasesAndPO = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching purchases.");
      return;
    }
    setIsLoading(true);
    const queryParams = new URLSearchParams(location.search);
    const poIdFromUrl = queryParams.get('poId');
    
    try {
      const fetchedPurchases = await getPurchases();
      setPurchases(fetchedPurchases);

      if (poIdFromUrl) {
        const po = await getPurchaseOrderById(poIdFromUrl);
        setInitialPO(po);
        if (po) {
            setIsModalOpen(true); 
        } else {
            Swal.fire(t('error'), t('errorFetchingPOs') + ` ID: ${poIdFromUrl}`, 'error');
             navigate('/purchases', { replace: true }); 
        }
      } else {
        setInitialPO(null);
      }

    } catch (error) {
      console.error("Error fetching purchases:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t, location.search, navigate]);

  useEffect(() => {
    fetchPurchasesAndPO();
  }, [fetchPurchasesAndPO]);

  const handleAddPurchase = () => {
    setInitialPO(null); 
    setViewingPurchase(null); 
    setIsModalOpen(true);
  };
  
  const handleViewPurchase = (purchase: Purchase) => {
    setViewingPurchase(purchase);
  };

  const handleSubmitForm = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>,
    relatedPoId?: string 
  ) => {
    setFormLoading(true);
    try {
      const expenseCategoryText = t('purchaseExpenseCategory');
      const expenseDescriptionTemplate = t('purchaseExpenseDescription');
      await addPurchaseAndProcess(purchaseData, expenseCategoryText, expenseDescriptionTemplate, relatedPoId);
      Swal.fire(t('success'), t('purchaseSuccess'), 'success');
      setIsModalOpen(false);
      setInitialPO(null); 
      navigate('/purchases', { replace: true }); 
      fetchPurchasesAndPO();
    } catch (error) {
      console.error("Error saving purchase (stock-in):", error);
      Swal.fire(t('error'), t('errorProcessingPurchase'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    const result = await Swal.fire({
        title: t('areYouSureDelete'),
        text: t('deletePurchaseConfirmation'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: UI_COLORS.danger,
        cancelButtonColor: UI_COLORS.secondary,
        confirmButtonText: t('delete'),
        cancelButtonText: t('cancel')
    });

    if (result.isConfirmed) {
        setFormLoading(true); 
        try {
            await deletePurchaseAndAssociatedRecords(purchaseId, t('purchaseDeletedLogNote'));
            Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
            fetchPurchasesAndPO(); 
        } catch (error: any) {
            console.error("Error deleting purchase (stock-in):", error);
            Swal.fire(t('error'), error.message || t('errorOccurred'), 'error');
        } finally {
            setFormLoading(false);
        }
    }
  };
  
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(t('language') === 'lo' ? 'lo-LA' : 'th-TH', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  const handleModalClose = () => {
    setIsModalOpen(false);
    setInitialPO(null);
    if (location.search.includes('poId=')) {
        navigate('/purchases', { replace: true }); 
    }
  }

  const handleOpenSelectPOModal = () => {
    setIsSelectPOModalOpen(true);
  };

  const handlePOSelectedFromModal = (poId: string) => {
    setIsSelectPOModalOpen(false);
    navigate(`/purchases?poId=${poId}`); // This will trigger the useEffect to fetch and pre-fill
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-semibold text-gray-700">{t('purchases')}</h1>
        <div className="flex items-center gap-3"> {/* Changed from space-x-2 and added items-center */}
            <Button onClick={handleOpenSelectPOModal} variant="secondary" leftIcon={<ImportIcon />}>
                {t('importFromPO')}
            </Button>
            <Button onClick={handleAddPurchase} variant="primary" leftIcon={<PlusIcon />}>
            {t('addNewPurchase')}
            </Button>
        </div>
      </div>

      {isLoading && !purchases.length ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('purchaseDate')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('purchaseOrderNumber')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('supplier')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('purchaseCategory')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('totalPurchaseAmount')}</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(purchase.purchaseDate)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.purchaseOrderNumber || (purchase.relatedPoId ? `PO: ${purchase.relatedPoId.slice(-6)}` : '-')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.supplierName || t('unknown')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.purchaseCategory}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(purchase.totalAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleViewPurchase(purchase)} className="text-blue-600 hover:text-blue-900 p-1" title={t('details')}><EyeIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePurchase(purchase.id)} className="text-red-600 hover:text-red-900 p-1" title={t('delete')} disabled={formLoading}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && !isLoading && (
                 <tr><td colSpan={6} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Adding/Editing Purchase (Stock-In) */}
      <Modal
        isOpen={isModalOpen && !viewingPurchase}
        onClose={handleModalClose}
        title={initialPO ? `${t('importFromPO')}: ${initialPO.poNumber}` : t('addNewPurchase')}
        size="xl" 
      >
        <PurchaseForm
          onSubmit={(data) => handleSubmitForm(data, initialPO?.id)} 
          onCancel={handleModalClose}
          isLoading={formLoading}
          initialPOData={initialPO} 
        />
      </Modal>

      {/* Modal for Viewing Purchase Details */}
      {viewingPurchase && (
        <Modal
            isOpen={!!viewingPurchase}
            onClose={() => setViewingPurchase(null)}
            title={`${t('details')} ${t('purchases')} #${viewingPurchase.id.substring(viewingPurchase.id.length - 6)}`}
            size="lg"
        >
            <div className="space-y-3 text-sm">
                <p><strong className="text-gray-700">{t('purchaseDate')}:</strong> <span className="text-gray-800">{formatDate(viewingPurchase.purchaseDate)}</span></p>
                <p><strong className="text-gray-700">{t('purchaseOrderNumber')}:</strong> <span className="text-gray-800">{viewingPurchase.purchaseOrderNumber || (viewingPurchase.relatedPoId ? `PO Ref: ${viewingPurchase.relatedPoId.slice(-6)}` : '-')}</span></p>
                <p><strong className="text-gray-700">{t('supplier')}:</strong> <span className="text-gray-800">{viewingPurchase.supplierName || t('unknown')}</span></p>
                <p><strong className="text-gray-700">{t('purchaseCategory')}:</strong> <span className="text-gray-800">{viewingPurchase.purchaseCategory}</span></p>
                <p><strong className="text-gray-700">{t('totalPurchaseAmount')}:</strong> <span className="text-gray-800 font-semibold">{formatCurrency(viewingPurchase.totalAmount)} {t('currencyBaht')}</span></p>
                {viewingPurchase.notes && <p><strong className="text-gray-700">{t('notes')}:</strong> <span className="text-gray-800">{viewingPurchase.notes}</span></p>}
                
                <h4 className="font-semibold pt-2 border-t mt-2 text-base text-gray-700">{t('itemsInPurchase')}:</h4>
                {viewingPurchase.items.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('productName')}</th>
                                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('quantity')} ({t('unit')})</th>
                                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('buyPrice')}</th>
                                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('totalCostPricePerUnit')}</th>
                                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sellingPrice')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewingPurchase.items.map((item, index) => (
                                    <tr key={index} className="border-b last:border-b-0">
                                        <td className="px-2 py-1 text-gray-800">{item.productName} ({item.productCategory})</td>
                                        <td className="px-2 py-1 text-right text-gray-800">{item.quantity}</td>
                                        <td className="px-2 py-1 text-right text-gray-800">{formatCurrency(item.buyPrice)}</td>
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
                <Button variant="outline" onClick={() => setViewingPurchase(null)}>{t('close')}</Button>
            </div>
        </Modal>
      )}

      {isSelectPOModalOpen && (
          <SelectPOModal
            isOpen={isSelectPOModalOpen}
            onClose={() => setIsSelectPOModalOpen(false)}
            onPOSelect={handlePOSelectedFromModal}
          />
      )}

    </div>
  );
};

export default PurchasesPage;