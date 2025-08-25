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

const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67.127 2.454.364m-3.033 4.22a4.5 4.5 0 00-6.364-6.364m6.364 6.364l-6.364-6.364" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.98 8.223A10.034 10.034 0 001.954 12c1.274 4.057 5.064 7 9.542 7 1.145 0 2.25-.13 3.3-.364m-3.35-2.022a4.5 4.5 0 006.364 6.364m-6.364-6.364l6.364 6.364" /></svg>;

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
              type={isPasswordVisible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              rightIcon={isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              onRightIconClick={() => setIsPasswordVisible(!isPasswordVisible)}
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