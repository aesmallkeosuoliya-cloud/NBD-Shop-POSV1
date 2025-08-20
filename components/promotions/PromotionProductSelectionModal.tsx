
import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

interface PromotionProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: Product[];
  initialSelectedProductIds: string[];
  onConfirmSelection: (selectedProductIds: string[]) => void;
  isLoading?: boolean;
}

const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

const PromotionProductSelectionModal: React.FC<PromotionProductSelectionModalProps> = ({
  isOpen,
  onClose,
  availableProducts,
  initialSelectedProductIds,
  onConfirmSelection,
  isLoading = false,
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedProductIds));

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedProductIds));
      setSearchTerm('');
    }
  }, [isOpen, initialSelectedProductIds]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return availableProducts.sort((a,b) => a.name.localeCompare(b.name));
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerSearchTerm) ||
        p.id.toLowerCase().includes(lowerSearchTerm) ||
        (p.barcode && p.barcode.toLowerCase().includes(lowerSearchTerm))
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [searchTerm, availableProducts]);

  const handleToggleProductSelection = (productId: string) => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(productId)) {
        newSelectedIds.delete(productId);
      } else {
        newSelectedIds.add(productId);
      }
      return newSelectedIds;
    });
  };

  const handleConfirm = () => {
    onConfirmSelection(Array.from(selectedIds));
    onClose();
  };
  
  const handleSelectAllFiltered = () => {
    const allFilteredIds = new Set(filteredProducts.map(p => p.id));
    setSelectedIds(prevSelectedIds => new Set([...Array.from(prevSelectedIds), ...Array.from(allFilteredIds)]));
  };

  const handleDeselectAllFiltered = () => {
     const filteredIdsToRemove = new Set(filteredProducts.map(p => p.id));
     setSelectedIds(prevSelectedIds => {
        const newSet = new Set(prevSelectedIds);
        filteredIdsToRemove.forEach(id => newSet.delete(id));
        return newSet;
     });
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('selectProducts')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleConfirm}>{t('confirm')}</Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Input
          placeholder={t('searchProductModalPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10"
          wrapperClassName="mb-0"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
      </div>
      <div className="mb-3 flex justify-between items-center">
        <span className="text-sm text-gray-600">
            {t('selected')}: {selectedIds.size} / {availableProducts.length} {t('items')}
        </span>
        <div>
            <Button variant="ghost" size="sm" onClick={handleSelectAllFiltered} className="mr-2 text-xs">
                {t('selectAllFiltered') || 'Select All Filtered'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAllFiltered} className="text-xs">
                 {t('deselectAllFiltered') || 'Deselect All Filtered'}
            </Button>
        </div>
      </div>


      {isLoading ? (
         <div className="flex justify-center items-center h-40">
            <LoadingSpinner text={t('loading')} />
         </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
          {filteredProducts.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <li key={product.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800 text-sm">{product.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({product.category} - {product.id.slice(-6)})</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => handleToggleProductSelection(product.id)}
                    className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 py-6 text-sm">{t('noProductsMatchSearch')}</p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default PromotionProductSelectionModal;