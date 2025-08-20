
import React from 'react';
import { Sale, SaleTransactionItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import { VAT_RATE, PAYMENT_METHODS_OPTIONS, UI_COLORS, VAT_STRATEGIES, SALES_CHANNELS, CUSTOMER_TYPES } from '../../constants';

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ isOpen, onClose, sale }) => {
  const { t, language } = useLanguage();
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');

  if (!isOpen || !sale) return null;

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString(language === 'lo' ? 'lo-LA' : 'th-TH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getPaymentMethodText = (methodValue: string) => {
    const option = PAYMENT_METHODS_OPTIONS.find(opt => opt.value === methodValue);
    return option ? t(option.labelKey) : methodValue;
  };
  
  const getSalesChannelText = (value?: string) => {
    if (!value) return '-';
    const option = SALES_CHANNELS.find(opt => opt.value === value);
    return option ? t(option.labelKey) : value;
  };

  const getCustomerTypeText = (value?: 'cash' | 'credit') => {
    if (!value) return '-';
    const option = CUSTOMER_TYPES.find(opt => opt.value === value);
    return option ? t(option.labelKey) : value;
  }
  
  const getVatStrategyText = (value: 'none' | 'add' | 'included') => {
    const option = VAT_STRATEGIES.find(opt => opt.value === value);
    return option ? t(option.labelKey) : value;
  }


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('viewSaleDetails')} - ${t('receiptNumber')} ${sale.receiptNumber}`} size="lg">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 p-3 bg-gray-50 rounded-md shadow-sm">
          <p><strong>{t('receiptNumber')}:</strong> {sale.receiptNumber}</p>
          <p><strong>{t('date')}:</strong> {formatDate(sale.transactionDate)}</p>
          <p><strong>{t('customerName')}:</strong> {sale.customerName}</p>
          <p><strong>{t('customerType')}:</strong> {getCustomerTypeText(sale.customerType)} {sale.customerType === 'credit' && sale.customerCreditDays ? `(${sale.customerCreditDays} ${t('days')})` : ''}</p>
          {sale.customerPhone && <p><strong>{t('customerPhone')}:</strong> {sale.customerPhone}</p>}
          <p><strong>{t('paymentMethod')}:</strong> {getPaymentMethodText(sale.paymentMethod)}</p>
          {sale.salespersonName && <p><strong>{t('salesperson')}:</strong> {sale.salespersonName}</p>}
          <p><strong>{t('salesChannel')}:</strong> {getSalesChannelText(sale.salesChannel)}</p>
        </div>

        <h4 className="font-semibold text-md pt-2">{t('saleItems')}:</h4>
        <div className="overflow-x-auto border rounded-md max-h-60">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-600 uppercase">{t('productName')}</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 uppercase">{t('quantity')}</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 uppercase">{t('unitPrice')}</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 uppercase">{t('discountTypeFixed')}</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 uppercase">{t('totalPrice')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sale.items.map((item: SaleTransactionItem, index: number) => (
                <tr key={item.productId + index}>
                  <td className="px-2 py-1.5 whitespace-nowrap">{item.productName}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{item.quantity}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatCurrency(item.originalUnitPrice)}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {item.itemDiscountType === 'percent' ? `${item.itemDiscountValue}%` : item.itemDiscountType === 'fixed' ? formatCurrency(item.itemDiscountValue) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 border-t mt-2 grid grid-cols-2 gap-x-4">
            <div> {/* Left column for totals */}
                <div className="flex justify-between"><span>{t('totalCartOriginalPrice')}:</span> <span>{formatCurrency(sale.totalCartOriginalPrice)}</span></div>
                <div className="flex justify-between"><span>{t('totalCartItemDiscountAmount')}:</span> <span className="text-red-600">-{formatCurrency(sale.totalCartItemDiscountAmount)}</span></div>
                <div className="flex justify-between font-medium border-t pt-1"><span>{t('subtotalAfterItemDiscounts')}:</span> <span>{formatCurrency(sale.subtotalAfterItemDiscounts)}</span></div>

                {sale.overallSaleDiscountAmountCalculated > 0 && 
                    <div className="flex justify-between">
                        <span>{t('overallSaleDiscount')} ({sale.overallSaleDiscountType === 'percent' ? `${sale.overallSaleDiscountValueInput}%` : t('discountTypeFixed')}):</span> 
                        <span className="text-red-600">-{formatCurrency(sale.overallSaleDiscountAmountCalculated)}</span>
                    </div>
                }
                {sale.couponDiscountAmountApplied && sale.couponDiscountAmountApplied > 0 && 
                    <div className="flex justify-between">
                        <span>{t('couponCode')} ({sale.couponCodeApplied || ''}):</span> 
                        <span className="text-red-600">-{formatCurrency(sale.couponDiscountAmountApplied)}</span>
                    </div>
                }
                 <div className="flex justify-between font-medium border-t pt-1">
                    <span>{t('subtotalBeforeVAT')}:</span> {/* This label refers to subtotal after all discounts, before VAT */}
                    <span>{formatCurrency(sale.subtotalBeforeEditableVAT)}</span>
                </div>
            </div>
            <div> {/* Right column for VAT and Grand Total */}
                <div className="flex justify-between">
                    <span>{t('vatStrategy')}:</span> 
                    <span>{getVatStrategyText(sale.vatStrategy)}</span>
                </div>
                {sale.vatStrategy !== 'none' && 
                    <div className="flex justify-between">
                    <span>{t('vat')} ({(sale.editableVatRate * 100).toFixed(0)}%):</span> 
                    <span>{formatCurrency(sale.vatAmountFromEditableRate)}</span>
                    </div>
                }
                <div className="flex justify-between font-bold text-md text-purple-600 pt-2 border-t mt-2">
                    <span>{t('grandTotal')}:</span>
                    <span>{formatCurrency(sale.grandTotal)} {currencySymbol}</span>
                </div>
                 {sale.paymentMethod === 'cash' && (
                    <>
                    <div className="flex justify-between"><span>{t('receivedAmount')}:</span> <span>{formatCurrency(sale.receivedAmount || 0)}</span></div>
                    <div className="flex justify-between"><span>{t('changeDue')}:</span> <span>{formatCurrency(sale.changeGiven || 0)}</span></div>
                    </>
                )}
            </div>
        </div>
        {sale.notes && <div className="pt-2 border-t"><p><strong>{t('notes')}:</strong> {sale.notes}</p></div>}
      </div>
    </Modal>
  );
};

export default SaleDetailModal;