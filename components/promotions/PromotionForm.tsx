
import React, { useState, useEffect, useCallback } from 'react';
import { Promotion, Product, PromotionDiscountType, PromotionStatus } from '../../types';
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

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;

const PromotionForm: React.FC<PromotionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  availableProducts,
}) => {
  const { t } = useLanguage();
  const [promotion, setPromotion] = useState<Partial<Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>>>({
    name: '',
    productIds: [],
    discountType: 'percent',
    discountValue: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0], // Default to 7 days from now
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProductSelectionModalOpen, setIsProductSelectionModalOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...formData } = initialData;
      setPromotion(formData);
    } else {
      // Reset for new form
      setPromotion({
        name: '',
        productIds: [],
        discountType: 'percent',
        discountValue: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        status: 'active',
      });
    }
  }, [initialData]);

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
    if (promotion.discountValue === undefined || promotion.discountValue <= 0) newErrors.discountValue = t('discountValueRequired');
    if (promotion.discountType === 'percent' && (promotion.discountValue < 0 || promotion.discountValue > 100)) {
        newErrors.discountValue = t('discountValueRequired') + ' (0-100% for percentage)';
    }
    if (!promotion.startDate) newErrors.startDate = t('requiredField');
    if (!promotion.endDate) newErrors.endDate = t('requiredField');
    if (promotion.startDate && promotion.endDate && new Date(promotion.endDate) < new Date(promotion.startDate)) {
        newErrors.endDate = t('endDateAfterStartDate');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    // Ensure all fields are correctly typed for submission
    const dataToSubmit: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'> = {
        name: promotion.name!,
        productIds: promotion.productIds!,
        discountType: promotion.discountType!,
        discountValue: promotion.discountValue!,
        startDate: promotion.startDate!,
        endDate: promotion.endDate!,
        status: promotion.status!,
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