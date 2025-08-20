import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';

interface SupplierFormProps {
  initialData?: Supplier | null;
  onSubmit: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { t } = useLanguage();
  const [supplier, setSupplier] = useState<Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>>({
    name: '',
    phone: '',
    creditDays: 0,
    taxInfo: '',
    taxId: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...formData } = initialData;
      setSupplier(formData);
    } else {
      setSupplier({
        name: '',
        phone: '',
        creditDays: 0,
        taxInfo: '',
        taxId: '',
        notes: '',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'creditDays') {
      if (value === '') {
        setSupplier(prev => ({ ...prev, creditDays: undefined }));
      } else {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          setSupplier(prev => ({ ...prev, creditDays: numValue }));
        }
        // If numValue is NaN (e.g. user typed "abc"), state for creditDays is not updated,
        // preserving the last valid number or undefined. The input field might show the invalid entry.
      }
    } else {
      setSupplier(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!supplier.name?.trim()) {
      newErrors.name = t('supplierNameRequired');
    }
    // Check if creditDays is a negative number. Undefined or positive/zero are fine.
    if (supplier.creditDays !== undefined && supplier.creditDays < 0) {
      newErrors.creditDays = t('creditDaysPositive');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const dataToSubmit: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> = {
        name: supplier.name || '', 
        phone: supplier.phone || undefined,
        creditDays: supplier.creditDays === undefined ? undefined : Number(supplier.creditDays) || 0,
        taxInfo: supplier.taxInfo || undefined,
        taxId: supplier.taxId || undefined,
        notes: supplier.notes || undefined,
    };
    
    await onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input 
        name="name" 
        label={t('supplierName')} 
        value={supplier.name || ''} 
        onChange={handleChange} 
        error={errors.name} 
        required 
      />
      <Input 
        name="phone" 
        label={t('phone')} 
        value={supplier.phone || ''} 
        onChange={handleChange} 
        error={errors.phone} 
      />
      <Input 
        name="creditDays" 
        label={t('creditDays')} 
        type="number" 
        value={supplier.creditDays === undefined || supplier.creditDays === null ? '' : String(supplier.creditDays)}
        onChange={handleChange} 
        error={errors.creditDays} 
        min="0" // HTML5 min attribute
      />
      <div>
        <label htmlFor="taxInfo" className="block text-sm font-medium text-gray-700 mb-1">{t('taxInfo')}</label>
        <textarea
          id="taxInfo"
          name="taxInfo"
          rows={3}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
          value={supplier.taxInfo || ''}
          onChange={handleChange}
        />
      </div>
       <Input 
        name="taxId" 
        label={t('taxId') + ` (${t('optional')})`}
        value={supplier.taxId || ''} 
        onChange={handleChange} 
        error={errors.taxId} 
      />
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
          value={supplier.notes || ''}
          onChange={handleChange}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>{initialData ? t('save') : t('add')}</Button>
      </div>
    </form>
  );
};

export default SupplierForm;