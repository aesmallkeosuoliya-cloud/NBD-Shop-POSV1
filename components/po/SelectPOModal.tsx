
import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseOrder } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPurchaseOrders } from '../../services/firebaseService';
import { PO_STATUSES } from '../../constants';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import LoadingSpinner from '../common/LoadingSpinner';

interface SelectPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPOSelect: (poId: string) => void;
}

const SelectPOModal: React.FC<SelectPOModalProps> = ({ isOpen, onClose, onPOSelect }) => {
  const { t, language } = useLanguage();
  const [allPOs, setAllPOs] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(true);

  const [filterPoNumber, setFilterPoNumber] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'partial' | 'all'>('pending'); // Default to pending/partial

  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  useEffect(() => {
    if (isOpen) {
      const fetchPOs = async () => {
        setIsLoadingPOs(true);
        try {
          const pos = await getPurchaseOrders();
          setAllPOs(pos); // Store all, filter later
        } catch (error) {
          console.error("Error fetching POs for selection:", error);
          // Consider showing an error to the user
        } finally {
          setIsLoadingPOs(false);
        }
      };
      fetchPOs();
    }
  }, [isOpen]);

  useEffect(() => {
    let result = allPOs;
    if (filterStatus !== 'all') {
      result = result.filter(po => po.status === filterStatus || (filterStatus === 'pending' && po.status === 'partial')); // Show pending and partial for 'pending' filter by default
    }
    if (filterPoNumber) {
      result = result.filter(po => po.poNumber.toLowerCase().includes(filterPoNumber.toLowerCase()));
    }
    if (filterSupplier) {
      result = result.filter(po => po.supplierName?.toLowerCase().includes(filterSupplier.toLowerCase()));
    }
    setFilteredPOs(result.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
  }, [allPOs, filterPoNumber, filterSupplier, filterStatus]);


  const handleSelect = (poId: string) => {
    onPOSelect(poId);
    onClose();
  };
  
  const getStatusDisplay = (statusValue: string) => {
    const statusInfo = PO_STATUSES.find(s => s.value === statusValue);
    return statusInfo ? { text: t(statusInfo.labelKey), className: statusInfo.className } : { text: statusValue, className: 'bg-gray-200 text-gray-800' };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('selectPOModalTitle')} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-2 border-b pb-3 mb-2">
          <Input label={t('filterByPONumber')} placeholder={t('poNumberShort') + '...'} value={filterPoNumber} onChange={e => setFilterPoNumber(e.target.value)} wrapperClassName="mb-0"/>
          <Input label={t('filterBySupplier')} placeholder={t('supplierName') + '...'} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} wrapperClassName="mb-0"/>
          <div>
            <label htmlFor="poStatusFilterModal" className="block text-sm font-medium text-gray-700 mb-1">{t('poTableStatus')}</label>
            <select 
              id="poStatusFilterModal" 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value as 'pending' | 'partial' | 'all')}
              className="mt-1 block w-full px-3 py-2.5 h-11 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="pending">{`${t('statusPendingPO')} / ${t('statusPartialReceiptPO')}`}</option>
              <option value="all">{t('all')}</option>
            </select>
          </div>
        </div>

        {isLoadingPOs ? (
          <div className="flex justify-center items-center h-40">
            <LoadingSpinner text={t('loading')} />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {filteredPOs.length === 0 ? (
              <p className="text-center text-gray-500 py-6">{t('noDataFound')}</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('poNumberLabel')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('orderDateLabel')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('supplier')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">{t('poTableStatus')}</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPOs.map(po => {
                    const statusInfo = getStatusDisplay(po.status);
                    return (
                        <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-purple-600">{po.poNumber}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatDate(po.orderDate)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{po.supplierName || '-'}</td>
                        <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${statusInfo.className}`}>
                                {statusInfo.text}
                            </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                            <Button variant="primary" size="sm" onClick={() => handleSelect(po.id)} >
                            {t('select')}
                            </Button>
                        </td>
                        </tr>
                    );
                   })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

export default SelectPOModal;