
import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

interface POProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: Product[];
  onConfirmSelection: (selectedProducts: Product[]) => void;
  existingProductIdsInPO: Set<string>;
}

const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

const POProductSelectionModal: React.FC<POProductSelectionModalProps> = ({
  isOpen,
  onClose,
  availableProducts,
  onConfirmSelection,
  existingProductIdsInPO,
}) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    let products = availableProducts.filter(p => !existingProductIdsInPO.has(p.id));
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(lower) ||
        (p.id || '').toLowerCase().includes(lower) ||
        p.barcode?.toLowerCase().includes(lower)
      );
    }
    return products.sort((a,b) => a.name.localeCompare(b.name));
  }, [searchTerm, availableProducts, existingProductIdsInPO]);

  const handleToggleProduct = (productId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) newSet.delete(productId);
      else newSet.add(productId);
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selectedProducts = availableProducts.filter(p => selectedIds.has(p.id));
    onConfirmSelection(selectedProducts);
    onClose();
  };

  const handleDoubleClick = (product: Product) => {
    onConfirmSelection([product]);
    onClose();
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = new Set(filteredProducts.map(p => p.id));
    setSelectedIds(prev => new Set([...Array.from(prev), ...Array.from(allFilteredIds)]));
  };
  
  const handleDeselectAllFiltered = () => {
     const filteredIdsToRemove = new Set(filteredProducts.map(p => p.id));
     setSelectedIds(prev => {
        const newSet = new Set(prev);
        filteredIdsToRemove.forEach(id => newSet.delete(id));
        return newSet;
     });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('selectProduct')}
      size="xl"
      footer={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={handleConfirm} disabled={selectedIds.size === 0}>{t('add')}</Button></>}
    >
      <div className="relative mb-3">
        <Input placeholder={t('searchProductModalPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" wrapperClassName="mb-0"/>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
      </div>
       <div className="mb-3 flex justify-between items-center">
        <span className="text-sm text-gray-600">
            {t('selected')}: {selectedIds.size} {t('items')}
        </span>
        <div>
            <Button variant="ghost" size="sm" onClick={handleSelectAllFiltered} className="mr-2 text-xs">
                {t('selectAllFiltered')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAllFiltered} className="text-xs">
                 {t('deselectAllFiltered')}
            </Button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto border rounded-md">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left">{t('productName')}</th>
              <th className="px-3 py-2 text-left">{t('productCategory')}</th>
              <th className="px-3 py-2 text-right">{t('stock')}</th>
              <th className="px-3 py-2 text-right">{t('costPrice')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onDoubleClick={() => handleDoubleClick(p)}>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => handleToggleProduct(p.id)} className="h-4 w-4 text-purple-600 rounded" />
                </td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.category}</td>
                <td className="px-3 py-2 text-right">{p.stock}</td>
                <td className="px-3 py-2 text-right">{p.costPrice.toLocaleString(localeForFormatting)}</td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">{t('noDataFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

export default POProductSelectionModal;
