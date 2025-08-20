import React, { useState, useEffect } from 'react';
import { Sale, SalePayment } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { recordSalePaymentAndUpdateSale } from '../../services/firebaseService'; // To be created or implemented

declare var Swal: any;

interface PaymentFormProps {
  saleInvoice: Sale;
  onClose: (paymentMade: boolean) => void; // Callback to inform parent if a payment was made
}

const PaymentForm: React.FC<PaymentFormProps> = ({ saleInvoice, onClose }) => {
  const { t } = useLanguage();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qr' | 'check'>('cash');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Reset form when invoice changes or on initial load
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmountPaid('');
    setPaymentMethod('cash');
    setNotes('');
    setError('');
  }, [saleInvoice]);

  const handleFullPayment = () => {
    setAmountPaid(saleInvoice.outstandingAmount);
  };

  const validate = (): boolean => {
    setError('');
    if (amountPaid === '' || Number(amountPaid) <= 0) {
      setError(t('amountPositive'));
      return false;
    }
    if (Number(amountPaid) > saleInvoice.outstandingAmount) {
      setError(t('paymentAmountExceedsOutstanding'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const paymentDetails: Omit<SalePayment, 'id' | 'createdAt' | 'recordedBy'> = {
        paymentDate: new Date(paymentDate).toISOString(),
        amountPaid: Number(amountPaid),
        paymentMethod: paymentMethod,
        notes: notes || undefined,
      };
      
      await recordSalePaymentAndUpdateSale(saleInvoice.id, paymentDetails);
      
      Swal.fire(t('success'), t('paymentRecordedSuccess'), 'success');
      onClose(true); // Indicate payment was made
    } catch (err: any) {
      console.error("Error recording payment:", err);
      setError(err.message || t('errorOccurred'));
      Swal.fire(t('error'), err.message || t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const paymentMethodOptions = [
    { value: 'cash', labelKey: 'paymentCash' },
    { value: 'transfer', labelKey: 'paymentTransfer' },
    { value: 'qr', labelKey: 'paymentQR' },
    { value: 'check', labelKey: 'paymentCheck' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-lg shadow">
      {error && <p className="text-red-500 text-sm bg-red-100 p-2 rounded">{error}</p>}
      
      <div className="text-sm mb-2">
        <p><strong>{t('outstandingAmount')}:</strong> <span className="font-semibold text-lg text-red-600">{(saleInvoice.outstandingAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('paymentDate')}
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
          wrapperClassName="mb-0"
        />
        <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">{t('paymentMethod')}</label>
            <select
                id="paymentMethod"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'transfer' | 'qr' | 'check')}
                className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm h-11"
                required
            >
                {paymentMethodOptions.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
            </select>
        </div>
      </div>
      
      <div>
        <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">{t('paymentAmount')}</label>
        <div className="flex items-center space-x-2">
            <Input
            id="amountPaid"
            type="number"
            step="0.01"
            value={amountPaid.toString()}
            onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
            required
            placeholder="0.00"
            wrapperClassName="mb-0 flex-grow"
            className="h-11"
            />
            <Button type="button" variant="outline" onClick={handleFullPayment} className="h-11 whitespace-nowrap">
                {t('fullPayment')}
            </Button>
        </div>
      </div>


      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('notes')} ({t('optional')})</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-3">
        <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="success" isLoading={isLoading} className="bg-green-600 hover:bg-green-700">
          {t('recordPayment')}
        </Button>
      </div>
    </form>
  );
};

export default PaymentForm;