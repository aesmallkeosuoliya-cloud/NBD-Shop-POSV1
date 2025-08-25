

import React, { useState, useEffect, useCallback } from 'react';
import { Promotion, Product, PromotionType, PromotionDiscountType, PromotionStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import PromotionProductSelectionModal from './PromotionProductSelectionModal';

interface PromotionFormProps {
  initialData?: Promotion | null;
  onSubmit: (promotion: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  availableProducts: Product[];
}

const PromotionForm: React.FC<PromotionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  availableProducts,
}) => {
  const { t } = useLanguage();

  const getDefaultState = useCallback(() => ({
    name: '',
    promotionType: 'discount' as PromotionType,
    productIds: [],
    discountType: 'percent' as PromotionDiscountType,
    discountValue: 0,
    quantityToBuy: 1,
    freeProductId: '',
    quantityToGetFree: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    status: 'active' as PromotionStatus,
  }), []);

  const [promotion, setPromotion] = useState<Partial<Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>>>(getDefaultState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProductSelectionModalOpen, setIsProductSelectionModalOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...formData } = initialData;
      setPromotion(formData);
    } else {
      setPromotion(getDefaultState());
    }
  }, [initialData, getDefaultState]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
        setPromotion(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
        setPromotion(prev => ({ ...prev, [name]: value as any }));
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const handlePromotionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PromotionType;
    setPromotion(prev => ({
      ...prev,
      promotionType: newType,
      discountType: newType === 'discount' ? 'percent' : undefined,
      discountValue: newType === 'discount' ? 0 : undefined,
      quantityToBuy: newType === 'free_product' ? 1 : undefined,
      freeProductId: newType === 'free_product' ? '' : undefined,
      quantityToGetFree: newType === 'free_product' ? 1 : undefined,
    }));
  };

  const handleSelectedProductsConfirm = (selectedProductIds: string[]) => {
    setPromotion(prev => ({ ...prev, productIds: selectedProductIds }));
    if (errors.productIds) {
        setErrors(prev => ({...prev, productIds: ''}));
    }
    setIsProductSelectionModalOpen(false);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!promotion.name?.trim()) newErrors.name = t('requiredField');
    if (!promotion.productIds || promotion.productIds.length === 0) newErrors.productIds = t('productsRequired');
    if (!promotion.startDate) newErrors.startDate = t('requiredField');
    if (!promotion.endDate) newErrors.endDate = t('requiredField');
    if (promotion.startDate && promotion.endDate && new Date(promotion.endDate) < new Date(promotion.startDate)) {
        newErrors.endDate = t('endDateAfterStartDate');
    }

    if (promotion.promotionType === 'discount') {
        if (promotion.discountValue === undefined || promotion.discountValue <= 0) newErrors.discountValue = t('discountValueRequired');
        if (promotion.discountType === 'percent' && (promotion.discountValue < 0 || promotion.discountValue > 100)) {
            newErrors.discountValue = t('discountValueRequired') + ' (0-100%)';
        }
    } else if (promotion.promotionType === 'free_product') {
        if (!promotion.freeProductId) newErrors.freeProductId = t('requiredField');
        if (!promotion.quantityToBuy || promotion.quantityToBuy <= 0) newErrors.quantityToBuy = t('requiredField');
        if (!promotion.quantityToGetFree || promotion.quantityToGetFree <= 0) newErrors.quantityToGetFree = t('requiredField');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    const dataToSubmit: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'> = {
        name: promotion.name!,
        promotionType: promotion.promotionType!,
        productIds: promotion.productIds!,
        startDate: promotion.startDate!,
        endDate: promotion.endDate!,
        status: promotion.status!,
        discountType: promotion.promotionType === 'discount' ? promotion.discountType : undefined,
        discountValue: promotion.promotionType === 'discount' ? promotion.discountValue : undefined,
        freeProductId: promotion.promotionType === 'free_product' ? promotion.freeProductId : undefined,
        quantityToBuy: promotion.promotionType === 'free_product' ? promotion.quantityToBuy : undefined,
        quantityToGetFree: promotion.promotionType === 'free_product' ? promotion.quantityToGetFree : undefined,
    };
    await onSubmit(dataToSubmit);
  };
  
  const selectedProductNames = promotion.productIds?.map(id => availableProducts.find(p => p.id === id)?.name).filter(Boolean).join(', ');

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('promotionName')} name="name" value={promotion.name || ''} onChange={handleChange} error={errors.name} required />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('participatingProducts')}</label>
          <div className="p-2 border border-gray-300 rounded-md min-h-[40px] bg-gray-50 text-sm text-gray-700">
            {selectedProductNames || <span className="italic">{t('selectProducts')}...</span>}
          </div>
          <Button type="button" variant="outline" onClick={() => setIsProductSelectionModalOpen(true)} className="mt-1 text-sm">
            {t('selectProducts')} ({promotion.productIds?.length || 0} {t('selected')})
          </Button>
          {errors.productIds && <p className="mt-1 text-xs text-red-600">{errors.productIds}</p>}
        </div>

        <div>
            <label htmlFor="promotionType" className="block text-sm font-medium text-gray-700 mb-1">{t('promotionType')}</label>
            <select id="promotionType" name="promotionType" value={promotion.promotionType} onChange={handlePromotionTypeChange} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm h-11">
              <option value="discount">{t('promotionType_discount')}</option>
              <option value="free_product">{t('promotionType_free_product')}</option>
            </select>
        </div>

        {promotion.promotionType === 'discount' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="discountType" className="block text-sm font-medium text-gray-700 mb-1">{t('discountType')}</label>
                    <select id="discountType" name="discountType" value={promotion.discountType} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm h-11">
                    <option value="percent">{t('discountTypePercentage')}</option>
                    <option value="fixed">{t('discountTypeFixedAmount')}</option>
                    </select>
                </div>
                <Input label={t('discountValue')} name="discountValue" type="number" step="0.01" min="0" value={promotion.discountValue || 0} onChange={handleChange} error={errors.discountValue} required />
            </div>
        )}

        {promotion.promotionType === 'free_product' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-4">
                <Input label={t('quantityToBuy')} name="quantityToBuy" type="number" min="1" value={promotion.quantityToBuy || 1} onChange={handleChange} error={errors.quantityToBuy} required />
                 <div>
                    <label htmlFor="freeProductId" className="block text-sm font-medium text-gray-700 mb-1">{t('selectFreeProduct')}</label>
                    <select id="freeProductId" name="freeProductId" value={promotion.freeProductId || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border ${errors.freeProductId ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm h-11`}>
                        <option value="">-- {t('selectProduct')} --</option>
                        {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {errors.freeProductId && <p className="mt-1 text-xs text-red-600">{errors.freeProductId}</p>}
                </div>
                <Input label={t('quantityToGetFree')} name="quantityToGetFree" type="number" min="1" value={promotion.quantityToGetFree || 1} onChange={handleChange} error={errors.quantityToGetFree} required />
            </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('startDate')} name="startDate" type="date" value={promotion.startDate || ''} onChange={handleChange} error={errors.startDate} required />
            <Input label={t('endDate')} name="endDate" type="date" value={promotion.endDate || ''} onChange={handleChange} error={errors.endDate} required />
        </div>
        
        <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
            <select id="status" name="status" value={promotion.status} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm h-11">
            <option value="active">{t('promotionStatusActive')}</option>
            <option value="inactive">{t('promotionStatusInactive')}</option>
            </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>{initialData ? t('save') : t('add')}</Button>
        </div>
      </form>

      {isProductSelectionModalOpen && (
        <PromotionProductSelectionModal
          isOpen={isProductSelectionModalOpen}
          onClose={() => setIsProductSelectionModalOpen(false)}
          availableProducts={availableProducts}
          initialSelectedProductIds={promotion.productIds || []}
          onConfirmSelection={handleSelectedProductsConfirm}
        />
      )}
    </>
  );
};

export default PromotionForm;
