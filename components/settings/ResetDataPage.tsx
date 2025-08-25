
import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import {
  reauthenticateUser,
  clearAllSalesAndPayments,
  clearAllPurchases,
  clearAllExpenses,
  clearAllProductsAndLogs,
  clearAllCustomers,
} from '../../services/firebaseService';
import { UI_COLORS } from '../../constants';

declare var Swal: any;

const ResetDataPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [options, setOptions] = useState({
    sales: false,
    purchases: false,
    expenses: false,
    stockHistory: false,
    products: false,
    customers: false,
  });
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setOptions(prev => ({ ...prev, [name]: checked }));
  };

  const isAnyOptionSelected = Object.values(options).some(Boolean);

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAnyOptionSelected || !password) return;

    const result = await Swal.fire({
      title: t('resetDataConfirmDialogTitle'),
      text: t('resetDataConfirmDialogText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      cancelButtonColor: UI_COLORS.secondary,
      confirmButtonText: t('yes'),
      cancelButtonText: t('no'),
    });

    if (!result.isConfirmed) return;

    setIsResetting(true);
    try {
      if (!currentUser?.email) throw new Error("User email not found");
      await reauthenticateUser(currentUser.email, password);

      const tasks: Promise<void>[] = [];
      if (options.sales) tasks.push(clearAllSalesAndPayments());
      if (options.purchases) tasks.push(clearAllPurchases());
      if (options.expenses) tasks.push(clearAllExpenses());
      if (options.stockHistory) tasks.push(clearAllProductsAndLogs()); // This is tied to products for safety
      if (options.products) tasks.push(clearAllProductsAndLogs());
      if (options.customers) tasks.push(clearAllCustomers(t('walkInCustomer')));

      await Promise.all(tasks);

      Swal.fire(t('success'), t('resetSuccess'), 'success');
      setOptions({ sales: false, purchases: false, expenses: false, stockHistory: false, products: false, customers: false });
      setPassword('');

    } catch (error: any) {
      console.error("Error during data reset:", error);
      if (error.code === 'auth/wrong-password' || error.message.includes('auth/wrong-password')) {
        Swal.fire(t('error'), t('reauthError'), 'error');
      } else {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 flex justify-center">
      <Card title={t('resetData')} className="w-full max-w-2xl">
        <form onSubmit={handleResetData} className="space-y-6">
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800">
            <h4 className="font-bold">{t('resetDataWarningTitle')}</h4>
            <p className="text-sm" dangerouslySetInnerHTML={{ __html: t('resetDataWarningBody') }} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-md font-semibold text-gray-800">{t('resetDataSelectHeader')}</legend>
            <CheckboxOption name="sales" label={t('resetDataSales')} checked={options.sales} onChange={handleOptionChange} />
            <CheckboxOption name="purchases" label={t('resetDataPurchases')} checked={options.purchases} onChange={handleOptionChange} />
            <CheckboxOption name="expenses" label={t('resetDataExpenses')} checked={options.expenses} onChange={handleOptionChange} />
            <CheckboxOption name="stockHistory" label={t('resetDataStockHistory')} checked={options.stockHistory} onChange={handleOptionChange} />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-md font-semibold text-red-600">{t('resetDataMasterHeader')}</legend>
            <CheckboxOption name="products" label={t('resetDataProducts')} checked={options.products} onChange={handleOptionChange} />
            <CheckboxOption name="customers" label={t('resetDataCustomers')} checked={options.customers} onChange={handleOptionChange} />
          </fieldset>

          <div className="pt-4 border-t">
            <Input
              label={t('resetDataConfirmLabel')}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            variant="danger"
            className="w-full text-lg py-3"
            isLoading={isResetting}
            disabled={!isAnyOptionSelected || !password || isResetting}
          >
            {t('resetDataConfirmButton')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

interface CheckboxOptionProps {
  name: string;
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckboxOption: React.FC<CheckboxOptionProps> = ({ name, label, checked, onChange }) => (
  <label className="flex items-center p-2 rounded-md hover:bg-gray-50 cursor-pointer">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="h-5 w-5 rounded text-purple-600 border-gray-300 focus:ring-purple-500"
    />
    <span className="ml-3 text-sm text-gray-700">{label}</span>
  </label>
);

export default ResetDataPage;
