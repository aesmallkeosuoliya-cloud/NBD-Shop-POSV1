import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer, CreditCustomerSummary, SalePayment, CreditInvoiceStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import PaymentForm from './PaymentForm'; // To be created
import { getSalePayments } from '../../services/firebaseService'; // Assuming this function exists or will be added

interface CustomerCreditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerSummary: CreditCustomerSummary;
  allSales: Sale[]; // Pass all sales, modal will filter
  onPaymentRecorded: () => void;
}

const CustomerCreditDetailModal: React.FC<CustomerCreditDetailModalProps> = ({
  isOpen,
  onClose,
  customerSummary,
  allSales,
  onPaymentRecorded,
}) => {
  const { t, language } = useLanguage();
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  // const [paymentsForSelectedInvoice, setPaymentsForSelectedInvoice] = useState<SalePayment[]>([]);
  // const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const customerOpenInvoices = useMemo(() => {
    return allSales.filter(
      (sale) =>
        sale.customerId === customerSummary.customerId &&
        sale.paymentMethod === 'credit' &&
        (sale.status === 'unpaid' || sale.status === 'partially_paid')
    ).sort((a,b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
  }, [allSales, customerSummary.customerId]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedInvoice(null);
      setShowPaymentForm(false);
    }
  }, [isOpen]);

  const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(language === 'lo' ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (isoDate: string | undefined) => {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleDateString(language === 'lo' ? 'lo-LA' : 'th-TH', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getInvoiceStatus = (invoice: Sale): CreditInvoiceStatus => {
    if (invoice.status === 'paid') return 'paid';
    if (!invoice.dueDate) return invoice.status === 'unpaid' ? 'unpaid' : 'partially_paid';

    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0,0,0,0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'due_soon';
    return invoice.status === 'unpaid' ? 'pending' : 'partially_paid'; // if not overdue/due_soon, it's pending or partially paid pending
  };
  
  const getStatusColorClass = (status: CreditInvoiceStatus) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'due_soon': return 'bg-orange-100 text-orange-700';
      case 'pending':
      case 'unpaid':
      case 'partially_paid':
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleMakePaymentClick = (invoice: Sale) => {
    setSelectedInvoice(invoice);
    setShowPaymentForm(true);
  };
  
  const handlePaymentFormClose = (paymentMade: boolean) => {
    setShowPaymentForm(false);
    setSelectedInvoice(null); // Deselect invoice
    if(paymentMade) {
        onPaymentRecorded(); // This will trigger data refresh and modal close if desired by parent
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('customerDetailModalTitle')}: ${customerSummary.customerName}`}
      size="xl"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-semibold text-gray-800 mb-2">{t('openInvoicesListTitle')}</h3>
          {customerOpenInvoices.length === 0 ? (
            <p className="text-gray-500">{t('noDataFound')}</p>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('invoiceNo')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('saleDate')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('grandTotal')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('paidToDate')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('outstandingAmount')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('dueDate')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">{t('status')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customerOpenInvoices.map((invoice) => {
                    const status = getInvoiceStatus(invoice);
                    return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{invoice.receiptNumber}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(invoice.transactionDate)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(invoice.grandTotal)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(invoice.paidAmount)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(invoice.outstandingAmount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(invoice.dueDate)}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${getStatusColorClass(status)}`}>
                            {t(`status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                            </span>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                            <Button variant="primary" size="sm" onClick={() => handleMakePaymentClick(invoice)}>
                                {t('recordPayment')}
                            </Button>
                        </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showPaymentForm && selectedInvoice && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-md font-semibold text-gray-800 mb-3">
              {t('paymentFormTitle', { invoiceNo: selectedInvoice.receiptNumber })}
            </h3>
            <PaymentForm
              saleInvoice={selectedInvoice}
              onClose={handlePaymentFormClose}
            />
          </div>
        )}
      </div>
      {!showPaymentForm && 
        <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={onClose}>{t('close')}</Button>
        </div>
      }
    </Modal>
  );
};

export default CustomerCreditDetailModal;