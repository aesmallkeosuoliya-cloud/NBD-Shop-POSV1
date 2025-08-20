import React, { useState } from 'react';
import { CartItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import Button from '../common/Button';

interface PriceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItem: CartItem | null;
  onPriceSelect: (productId: string, newPrice: number) => void;
}

const PriceSelectionModal: React.FC<PriceSelectionModalProps> = ({
  isOpen,
  onClose,
  cartItem,
  onPriceSelect,
}) => {
  const { t, language } = useLanguage();
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  React.useEffect(() => {
    if (cartItem) {
      setSelectedPrice(cartItem.activeUnitPrice);
    }
  }, [cartItem]);

  if (!isOpen || !cartItem) return null;

  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  const formatCurrency = (value: number) => value.toLocaleString(localeForFormatting, { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const priceOptions = [
    { label: t('productForm_sellingPrice1Label'), value: cartItem.sellingPrice },
  ];

  if (cartItem.sellingPrice2 && cartItem.sellingPrice2 > 0) {
    priceOptions.push({ label: t('productForm_sellingPrice2Label'), value: cartItem.sellingPrice2 });
  }
  if (cartItem.sellingPrice3 && cartItem.sellingPrice3 > 0) {
    priceOptions.push({ label: t('productForm_sellingPrice3Label'), value: cartItem.sellingPrice3 });
  }


  const handleConfirm = () => {
    if (selectedPrice !== null) {
      onPriceSelect(cartItem.id, selectedPrice);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('selectSellingPrice')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={handleConfirm} className="bg-yellow-400 hover:bg-yellow-500 text-black">
            {t('confirm')}
          </Button>
        </>
      }
    >
      <div className="p-4 bg-green-50 rounded-lg">
        <div className="mb-4 p-2 bg-blue-100 rounded text-blue-800">
          <p className="font-semibold">{cartItem.name}</p>
          <p className="text-sm">{t('unit')}: {cartItem.unit}</p>
        </div>
        
        <div className="space-y-2">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-blue-200 text-blue-900">
                        <th className="p-2 text-left">{t('price')}</th>
                        <th className="p-2 text-right">{t('sellingPrice')}</th>
                    </tr>
                </thead>
                <tbody>
                    {priceOptions.map((option) => (
                        <tr 
                            key={option.label}
                            onClick={() => setSelectedPrice(option.value)}
                            className={`cursor-pointer hover:bg-yellow-100 ${selectedPrice === option.value ? 'bg-yellow-200 ring-2 ring-yellow-400' : ''}`}
                        >
                            <td className="p-2 border">{option.label}</td>
                            <td className="p-2 border text-right font-semibold">{formatCurrency(option.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </Modal>
  );
};

export default PriceSelectionModal;