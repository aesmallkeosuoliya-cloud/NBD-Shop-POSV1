
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: Product[];
  onProductSelect: (product: Product) => void;
  isLoadingExternally?: boolean;
}

const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

const formatCurrency = (value: number) => {
    return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  isOpen,
  onClose,
  allProducts,
  onProductSelect,
  isLoadingExternally = false,
}) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(''); 
      setTimeout(() => searchInputRef.current?.focus(), 100); 
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    const baseProducts = allProducts.filter(p => p.showInPOS && p.stock > 0);

    if (!searchTerm) {
      return baseProducts.sort((a,b) => a.name.localeCompare(b.name));
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return baseProducts.filter(
      (p) =>
        (p.name.toLowerCase().includes(lowerSearchTerm) ||
          p.id.toLowerCase().includes(lowerSearchTerm) || // Search by Product ID
          (p.barcode && p.barcode.toLowerCase().includes(lowerSearchTerm)))
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [searchTerm, allProducts]);

  useEffect(() => {
    if (isOpen && searchTerm) {
      const exactBarcodeMatch = allProducts.find(
        (p) => p.barcode === searchTerm && p.showInPOS && p.stock > 0
      );
      if (exactBarcodeMatch) {
        onProductSelect(exactBarcodeMatch);
      }
    }
  }, [searchTerm, allProducts, isOpen, onProductSelect]);

  const handleSelectProduct = (product: Product) => {
    onProductSelect(product);
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filteredProducts.length === 1) {
      handleSelectProduct(filteredProducts[0]);
    } else if (event.key === 'Enter' && searchTerm) {
       const exactBarcodeMatch = allProducts.find(p => p.barcode === searchTerm && p.showInPOS && p.stock > 0);
       if (exactBarcodeMatch) {
         handleSelectProduct(exactBarcodeMatch);
       }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('selectProductModalTitle')}
      size="lg"
    >
      <div className="relative mb-4">
        <Input
          ref={searchInputRef}
          placeholder={t('searchProductModalPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 h-11 text-base"
          wrapperClassName="mb-0"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
      </div>

      {isLoadingExternally ? (
         <div className="flex justify-center items-center h-40">
            <LoadingSpinner text={t('loading')} />
         </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2"> {/* Added negative margin for scrollbar */}
          {filteredProducts.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('productCode')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('productName')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('stockAvailable')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('sellingPrice')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleSelectProduct(product)} onDoubleClick={() => handleSelectProduct(product)}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{product.id.substring(product.id.length-6)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 truncate max-w-xs" title={product.name}>{product.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-right">{product.stock} {product.unit}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-purple-600 font-semibold text-right">{formatCurrency(product.sellingPrice)} {currencySymbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-500 py-8">{t('noProductsMatchSearch')}</p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ProductSelectionModal;