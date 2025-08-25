

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Promotion, Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import PromotionForm from './PromotionForm';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
    addPromotion, 
    getPromotions, 
    updatePromotion, 
    deletePromotion, 
    getProducts,
    isFirebaseInitialized 
} from '../../services/firebaseService';
import { UI_COLORS } from '../../constants';

declare var Swal: any; // For SweetAlert2

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;


const PromotionsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching promotions data.");
      return;
    }
    setIsLoading(true);
    try {
      const [fetchedPromotions, fetchedProducts] = await Promise.all([
        getPromotions(),
        getProducts()
      ]);
      setPromotions(fetchedPromotions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setAvailableProducts(fetchedProducts);
      const pMap = new Map<string, string>();
      fetchedProducts.forEach(p => pMap.set(p.id, p.name));
      setProductMap(pMap);

    } catch (error) {
      console.error("Error fetching promotions data:", error);
      Swal.fire(t('error'), t('errorFetchingPromotions'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddPromotion = () => {
    setEditingPromotion(null);
    setIsModalOpen(true);
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo);
    setIsModalOpen(true);
  };

  const handleDeletePromotion = async (id: string) => {
    const result = await Swal.fire({
      title: t('confirmDeletePromotion'),
      text: t('actionCannotBeUndone'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      cancelButtonColor: UI_COLORS.secondary,
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel')
    });

    if (result.isConfirmed) {
      setFormLoading(true); // Reuse formLoading or use a specific deleteLoading state
      try {
        await deletePromotion(id);
        Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
        fetchData(); 
      } catch (error) {
        console.error("Error deleting promotion:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setFormLoading(false);
      }
    }
  };

  const handleSubmitForm = async (promotionData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFormLoading(true);
    try {
      if (editingPromotion && editingPromotion.id) {
        await updatePromotion(editingPromotion.id, promotionData);
      } else {
        await addPromotion(promotionData);
      }
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchData(); 
    } catch (error) {
      console.error("Error saving promotion:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };
  
  const getParticipatingProductNames = (productIds: string[]): string => {
    if (!productIds || productIds.length === 0) return '-';
    return productIds.map(id => productMap.get(id) || id.slice(-6)).join(', ');
  };

  const getDiscountDisplay = (promo: Promotion): string => {
    if (promo.promotionType === 'free_product') {
        const freeProduct = productMap.get(promo.freeProductId || '');
        return `${t('quantityToBuy')}: ${promo.quantityToBuy}, ${t('selectFreeProduct')}: ${freeProduct}, ${t('quantityToGetFree')}: ${promo.quantityToGetFree}`;
    }
    // else it's 'discount'
    if (promo.discountType === 'fixed') {
        return `${formatCurrency(promo.discountValue || 0)} ${currencySymbol}`;
    }
    return `${promo.discountValue || 0}%`;
  };
  
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">{t('promotionsManagement')}</h1>
        <Button onClick={handleAddPromotion} variant="primary" leftIcon={<PlusIcon />}>
          {t('addNewPromotion')}
        </Button>
      </div>

      {isLoading && !promotions.length ? ( 
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-auto h-[calc(100vh-12rem)]">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('promotionName')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('participatingProducts')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('details')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('date')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{promo.name}</td>
                  <td className="px-6 py-4 whitespace-normal text-xs text-gray-500 max-w-xs truncate" title={getParticipatingProductNames(promo.productIds)}>{getParticipatingProductNames(promo.productIds)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{getDiscountDisplay(promo)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${formatDate(promo.startDate)} - ${formatDate(promo.endDate)}`}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${promo.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {promo.status === 'active' ? t('promotionStatusActive') : t('promotionStatusInactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditPromotion(promo)} className="text-blue-600 hover:text-blue-900 p-1" title={t('editPromotion')}><EditIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePromotion(promo.id)} className="text-red-600 hover:text-red-900 p-1" title={t('delete')}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
              {promotions.length === 0 && !isLoading && (
                 <tr><td colSpan={7} className="text-center py-10 text-gray-500">{t('noPromotionsFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPromotion ? t('editPromotion') : t('addNewPromotion')}
          size="lg"
        >
          <PromotionForm
            initialData={editingPromotion}
            onSubmit={handleSubmitForm}
            onCancel={() => setIsModalOpen(false)}
            isLoading={formLoading}
            availableProducts={availableProducts}
          />
        </Modal>
      )}
    </div>
  );
};

export default PromotionsPage;
