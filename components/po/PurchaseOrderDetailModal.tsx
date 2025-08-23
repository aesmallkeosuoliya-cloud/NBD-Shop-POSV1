
import React, { useMemo } from 'react';
import { PurchaseOrder, Product } from '../../types'; // Import Product
import { useLanguage } from '../../contexts/LanguageContext';
import { PO_STATUSES } from '../../constants';
import Modal from '../common/Modal';
import Button from '../common/Button';

interface PurchaseOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null;
  onImportToStockIn: (poId: string) => void;
  products: Product[]; // Add products prop
}

const PurchaseOrderDetailModal: React.FC<PurchaseOrderDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  purchaseOrder,
  onImportToStockIn,
  products 
}) => {
  const { t, language } = useLanguage();

  if (!isOpen || !purchaseOrder) return null;

  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const statusDetails = useMemo(() => {
    const foundStatus = PO_STATUSES.find(s => s.value === purchaseOrder.status);
    if (foundStatus) {
      return {
        text: t(foundStatus.labelKey),
        className: foundStatus.className, 
      };
    }
    return {
      text: purchaseOrder.status, 
      className: 'bg-gray-200 text-gray-800', 
    };
  }, [purchaseOrder.status, t]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('viewPODetails')} - ${purchaseOrder.poNumber}`} size="lg">
      <div className="space-y-4 text-sm">
        <div className="p-3 bg-gray-50 rounded-md shadow-sm">
          <h3 className="font-semibold text-md mb-2 text-purple-700">{t('details')}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-800">
            <p><strong>{t('poNumberLabel')}:</strong> {purchaseOrder.poNumber}</p>
            <p><strong>{t('orderDateLabel')}:</strong> {formatDate(purchaseOrder.orderDate)}</p>
            <p><strong>{t('supplier')}:</strong> {purchaseOrder.supplierName || '-'}</p>
            <p><strong>{t('poTableStatus')}:</strong> <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${statusDetails.className}`}>{statusDetails.text}</span></p>
            {purchaseOrder.notes && <p className="col-span-2"><strong>{t('poNotesLabel')}:</strong> {purchaseOrder.notes}</p>}
          </div>
        </div>

        <div>
            <h4 className="font-semibold text-md mb-1 text-purple-700">{t('poItemsLabel')}</h4>
            <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-100 sticky top-0">
                <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('productName')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('quantityOrderedLabel')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('unit')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('unitPriceAtPOLabel')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('totalPriceAtPOLabel')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('quantityReceivedLabel')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('po_quantityOutstanding')}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('stockLabel')}</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {purchaseOrder.items.map((item, index) => {
                    const productInfo = products.find(p => p.id === item.productId);
                    const outstandingQty = item.quantityOrdered - (item.quantityReceived || 0);
                    const currentStock = productInfo ? productInfo.stock : 0;
                    return (
                        <tr key={item.productId + index}>
                            <td className="px-2 py-1.5 whitespace-nowrap text-gray-800">{item.productName}</td>
                            <td className="px-2 py-1.5 text-right text-gray-800">{item.quantityOrdered}</td>
                            <td className="px-2 py-1.5 text-gray-800">{item.unit}</td>
                            <td className="px-2 py-1.5 text-right text-gray-800">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                            <td className={`px-2 py-1.5 text-right font-medium ${ (item.quantityReceived || 0) < item.quantityOrdered && purchaseOrder.status !== 'pending' ? 'text-orange-600' : (item.quantityReceived || 0) >= item.quantityOrdered ? 'text-green-600' : 'text-gray-600'}`}>
                                {item.quantityReceived || 0}
                            </td>
                            <td className="px-2 py-1.5 text-right font-bold text-red-600">{outstandingQty}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-blue-600">{currentStock}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
            </div>
        </div>

        <div className="pt-3 border-t border-gray-300 mt-3 space-y-1 text-right text-gray-800">
            <p><strong>{t('poSubtotalLabel')}:</strong> {formatCurrency(purchaseOrder.subtotalBeforeVAT)} {currencySymbol}</p>
            <p><strong>{t('poVatRateLabel')} ({purchaseOrder.vatRate}%):</strong> {formatCurrency(purchaseOrder.vatAmount)} {currencySymbol}</p>
            <p className="text-md font-bold text-purple-700"><strong>{t('poGrandTotalLabel')}:</strong> {formatCurrency(purchaseOrder.grandTotal)} {currencySymbol}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700 hover:bg-gray-100">{t('close')}</Button>
        {purchaseOrder.status !== 'received' && (
             <Button 
                variant="primary" 
                onClick={() => onImportToStockIn(purchaseOrder.id)}
                className="bg-green-600 hover:bg-green-700"
            >
            {t('importPOToStockInButton')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default PurchaseOrderDetailModal;
