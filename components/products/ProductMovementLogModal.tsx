
import React, { useState, useEffect, useCallback } from 'react';
import { ProductMovementLog, ProductMovementLogType, Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { getProductMovementLogs, getProductById } from '../../services/firebaseService';

interface ProductMovementLogModalProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProductMovementLogModal: React.FC<ProductMovementLogModalProps> = ({ productId, isOpen, onClose }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ProductMovementLog[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const [fetchedLogs, fetchedProduct] = await Promise.all([
        getProductMovementLogs(productId),
        getProductById(productId)
      ]);
      setLogs(fetchedLogs);
      setProduct(fetchedProduct);
    } catch (error) {
      console.error("Error fetching product movement logs:", error);
      // Consider showing an error message to the user via SweetAlert or similar
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isOpen && productId) {
      fetchLogs();
    }
  }, [isOpen, productId, fetchLogs]);

  const formatTimestamp = (isoDate: string) => {
    return new Date(isoDate).toLocaleString(t('language') === 'lo' ? 'lo-LA' : 'th-TH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getLogTypeTranslation = (type: ProductMovementLogType) => {
    switch(type) {
      case ProductMovementLogType.INITIAL_STOCK: return t('logType_initial_stock');
      case ProductMovementLogType.PURCHASE: return t('logType_purchase');
      case ProductMovementLogType.SALE: return t('logType_sale');
      case ProductMovementLogType.ADJUSTMENT_ADD: return t('logType_adjustment_add');
      case ProductMovementLogType.ADJUSTMENT_REMOVE: return t('logType_adjustment_remove');
      case ProductMovementLogType.ADJUSTMENT_UPDATE: return t('logType_adjustment_update');
      default: return type;
    }
  }

  const renderPriceChange = (log: ProductMovementLog) => {
    let changes = [];
    if (log.costPriceBefore !== undefined && log.costPriceAfter !== undefined && log.costPriceBefore !== log.costPriceAfter) {
      changes.push(`${t('costPrice')}: ${log.costPriceBefore.toFixed(2)} -> ${log.costPriceAfter.toFixed(2)}`);
    }
    if (log.sellingPriceBefore !== undefined && log.sellingPriceAfter !== undefined && log.sellingPriceBefore !== log.sellingPriceAfter) {
      changes.push(`${t('sellingPrice')}: ${log.sellingPriceBefore.toFixed(2)} -> ${log.sellingPriceAfter.toFixed(2)}`);
    }
    return changes.join(', ') || '-';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('productMovementHistory')} ${product ? `- ${product.name}` : ''}`}
      size="xl"
    >
      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{t('noDataFound')}</p>
      ) : (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('logTimestamp')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('logType')}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('logQuantityChange')}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('logStockBefore')}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('logStockAfter')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('details')} ({t('costPrice')}/{t('sellingPrice')})</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('logRelatedDocument')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('logNotes')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{getLogTypeTranslation(log.type)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-right font-medium ${log.quantityChange > 0 ? 'text-green-600' : log.quantityChange < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right text-gray-500">{log.stockBefore}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-800">{log.stockAfter}</td>
                  <td className="px-3 py-2">
                    {renderPriceChange(log)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{log.relatedDocumentId || '-'}</td>
                  <td className="px-3 py-2 text-gray-500 break-words max-w-xs">{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

export default ProductMovementLogModal;