import React, { useState, useEffect } from 'react';
import { Customer } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { CUSTOMER_TYPES } from '../../constants';

interface CustomerFormProps {
  initialData?: Customer | null;
  onSubmit: (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | void>; // Returns ID if new
  onCancel: () => void;
  isLoading: boolean;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { t } = useLanguage();
  const [customer, setCustomer] = useState<Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>>({
    name: '',
    customerType: 'cash',
    creditDays: 0,
    phone: '',
    email: '',
    address: '',
    taxId: '',
    notes: '',
    totalDebtAmount: 0, // Initialize
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...formData } = initialData;
      setCustomer({ ...formData, totalDebtAmount: formData.totalDebtAmount || 0 });
    } else {
      setCustomer({
        name: '',
        customerType: 'cash',
        creditDays: 0,
        phone: '',
        email: '',
        address: '',
        taxId: '',
        notes: '',
        totalDebtAmount: 0, // Initialize for new customer
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'creditDays' && type === 'number') {
        setCustomer(prev => ({ ...prev, creditDays: parseInt(value, 10) || 0 }));
    } else if (name === 'customerType') {
        const newType = value as 'cash' | 'credit';
        setCustomer(prev => ({ 
            ...prev, 
            customerType: newType,
            creditDays: newType === 'cash' ? 0 : (prev.creditDays || 0) // Reset credit days if cash
        }));
    }
    else {
      setCustomer(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!customer.name?.trim()) {
      newErrors.name = t('customerNameRequired');
    }
    if (customer.customerType === 'credit' && (customer.creditDays === undefined || customer.creditDays <= 0)) {
      newErrors.creditDays = t('requiredField') + ' ' + t('amountPositive');
    }
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
        newErrors.email = t('invalidEmailOrPassword'); // Using this for general invalid email format
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const dataToSubmit: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> = {
        name: customer.name!, 
        customerType: customer.customerType!,
        creditDays: customer.customerType === 'credit' ? (customer.creditDays || 0) : undefined,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
        address: customer.address || undefined,
        taxId: customer.taxId || undefined,
        notes: customer.notes || undefined,
        totalDebtAmount: customer.totalDebtAmount || 0, // Ensure it's included
    };
    
    await onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input 
        name="name" 
        label={t('customerName')} 
        value={customer.name || ''} 
        onChange={handleChange} 
        error={errors.name} 
        required 
      />
      <div>
        <label htmlFor="customerType" className="block text-sm font-medium text-gray-700 mb-1">{t('customerType')}</label>
        <select
          id="customerType"
          name="customerType"
          value={customer.customerType}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
        >
          {CUSTOMER_TYPES.map(type => (
            <option key={type.value} value={type.value}>{t(type.labelKey)}</option>
          ))}
        </select>
      </div>

      {customer.customerType === 'credit' && (
        <Input 
          name="creditDays" 
          label={t('customerCreditDays')} 
          type="number" 
          value={String(customer.creditDays || 0)}
          onChange={handleChange} 
          error={errors.creditDays} 
          min="0"
          required={customer.customerType === 'credit'}
        />
      )}
      <Input 
        name="phone" 
        label={t('customerPhone') + ` (${t('optional')})`}
        value={customer.phone || ''} 
        onChange={handleChange} 
        error={errors.phone} 
      />
       <Input 
        name="email" 
        label={t('customerEmail') + ` (${t('optional')})`}
        type="email"
        value={customer.email || ''} 
        onChange={handleChange} 
        error={errors.email} 
      />
       <Input 
        name="address" 
        label={t('customerAddress') + ` (${t('optional')})`}
        value={customer.address || ''} 
        onChange={handleChange} 
      />
      <Input 
        name="taxId" 
        label={t('customerTaxId') + ` (${t('optional')})`}
        value={customer.taxId || ''} 
        onChange={handleChange} 
      />
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('notes') + ` (${t('optional')})`}</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
          value={customer.notes || ''}
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

export default CustomerForm;