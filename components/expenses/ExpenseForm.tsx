import React, { useState, useEffect } from 'react';
import { Expense, Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { EXPENSE_CATEGORIES } from '../../constants';
import { getSuppliers } from '../../services/firebaseService';

interface ExpenseFormProps {
  initialData?: Expense | null;
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  availableCategories: string[];
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialData, onSubmit, onCancel, isLoading, availableCategories }) => {
  const { t } = useLanguage();
  const [expense, setExpense] = useState<Partial<Omit<Expense, 'id' | 'createdAt'>>>({
    date: new Date().toISOString().split('T')[0],
    category: availableCategories[0] || '',
    amount: 0,
    description: '',
    supplierId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(err => console.error("Failed to load suppliers for expense form", err));
  }, []);

  useEffect(() => {
    if (initialData) {
      setExpense({
        date: initialData.date,
        category: initialData.category,
        amount: initialData.amount,
        description: initialData.description,
        supplierId: initialData.supplierId || '',
      });
    } else {
      setExpense({ // Reset for new form
        date: new Date().toISOString().split('T')[0],
        category: availableCategories[0] || '',
        amount: 0,
        description: '',
        supplierId: '',
      });
    }
  }, [initialData, availableCategories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
        setExpense(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
        setExpense(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({...prev, [name]: ''}));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!expense.date) newErrors.date = t('requiredField');
    if (!expense.category?.trim()) newErrors.category = t('requiredField');
    if (expense.amount === undefined || expense.amount <= 0) newErrors.amount = t('amountPositive');
    if (!expense.description?.trim()) newErrors.description = t('requiredField');
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalExpenseData: Omit<Expense, 'id' | 'createdAt'> = {
      date: expense.date!,
      category: expense.category!,
      amount: expense.amount!,
      description: expense.description!,
      supplierId: expense.supplierId || undefined, // Ensure undefined if empty string
    };
    
    await onSubmit(finalExpenseData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input name="date" label={t('date')} type="date" value={expense.date} onChange={handleChange} error={errors.date} required />
      
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">{t('expenseCategory')}</label>
        <input
          type="text"
          id="category"
          name="category"
          list="expenseCategoryDatalist"
          value={expense.category || ''}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${errors.category ? 'border-red-500' : ''}`}
          required
        />
        <datalist id="expenseCategoryDatalist">
          {availableCategories.map(cat => <option key={cat} value={cat} />)}
        </datalist>
        {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
      </div>

      <Input name="amount" label={t('amount')} type="number" step="0.01" value={expense.amount || 0} onChange={handleChange} error={errors.amount} required />
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">{t('expenseDescription')}</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${errors.description ? 'border-red-500' : ''}`}
          value={expense.description || ''}
          onChange={handleChange}
          required
        />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
      </div>

      <div>
        <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">{t('supplier')} ({t('optional') || 'Optional'})</label>
        <select 
          id="supplierId" 
          name="supplierId" 
          value={expense.supplierId || ''} 
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
        >
          <option value="">-- {t('selectSupplier')} --</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>{initialData ? t('save') : t('add')}</Button>
      </div>
    </form>
  );
};

export default ExpenseForm;