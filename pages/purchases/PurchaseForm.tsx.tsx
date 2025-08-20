import React, { useState, useEffect, useCallback } from 'react';
import { Purchase, PurchaseItemDetail, Product, Supplier, PurchaseOrder, PurchaseOrderItem } from '../../types'; // Added PurchaseOrder, PurchaseOrderItem
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { getProducts, getSuppliers } from '../../services/firebaseService';
import { PURCHASE_CATEGORIES, UI_COLORS } from '../../constants';
import LoadingSpinner from '../../components/common/LoadingSpinner'; 

declare var Swal: any;

interface PurchaseFormProps {
  onSubmit: (
    purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>,
    relatedPoId?: string
  ) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  initialPOData?: PurchaseOrder | null; // New prop for PO data
}

const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;

interface CurrentPurchaseItemState {
  productId: string;
  quantity: number | ''; // Quantity being received
  buyPrice: number | ''; 
  hiddenCost: number | ''; 
  gpPercent: number | '';
  sellingPrice: number | '';
  productCategoryDisplay: string; 
  originalPoQuantity?: number; // Store original PO quantity for reference
  productUnitDisplay?: string; // Store product unit for display
}

const initialCurrentItemState: CurrentPurchaseItemState = {
  productId: '',
  quantity: '', // Default to empty, user must input
  buyPrice: '',
  hiddenCost: '',
  gpPercent: '',
  sellingPrice: '',
  productCategoryDisplay: '',
  productUnitDisplay: '',
};

const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PurchaseForm: React.FC<PurchaseFormProps> = ({ onSubmit, onCancel, isLoading, initialPOData }) => {
  const { t, language } = useLanguage();
  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState<string | undefined>(initialPOData?.supplierId || undefined);
  const [purchaseCategory, setPurchaseCategory] = useState<string>(initialPOData ? t('importFromPO') : PURCHASE_CATEGORIES[0]);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(initialPOData?.poNumber || ''); // PO number or other ref
  const [notes, setNotes] = useState(initialPOData?.notes || '');
  const [items, setItems] = useState<PurchaseItemDetail[]>([]);
  
  const [currentItem, setCurrentItem] = useState<CurrentPurchaseItemState>(initialCurrentItemState);
  const [itemEntryError, setItemEntryError] = useState('');

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const [products, suppliers] = await Promise.all([getProducts(), getSuppliers()]);
        setAvailableProducts(products.sort((a,b) => a.name.localeCompare(b.name)));
        setAvailableSuppliers(suppliers.sort((a,b) => a.name.localeCompare(b.name)));
        
        if (initialPOData) {
            setSupplierId(initialPOData.supplierId);
            setPurchaseCategory(t('importFromPO'));
            setPurchaseOrderNumber(initialPOData.poNumber);
            setNotes(initialPOData.notes || '');
            
            const poItemsAsStockInItems: PurchaseItemDetail[] = initialPOData.items.map(poItem => {
                const productDetails = products.find(p => p.id === poItem.productId);
                const remainingQuantity = poItem.quantityOrdered - (poItem.quantityReceived || 0);
                return {
                    productId: poItem.productId,
                    productName: poItem.productName,
                    productCategory: poItem.productCategory,
                    quantity: remainingQuantity > 0 ? remainingQuantity : 0, // Default to remaining qty
                    buyPrice: poItem.unitPrice, // Default to PO unit price
                    hiddenCost: 0, // Default, user can adjust
                    totalCostPricePerUnit: poItem.unitPrice, // Initial total cost = buy price
                    calculatedSellingPrice: productDetails?.sellingPrice || 0, // Default to product's current selling price
                    gpPercentApplied: productDetails && poItem.unitPrice > 0 ? parseFloat((( (productDetails.sellingPrice || 0) - poItem.unitPrice) / (productDetails.sellingPrice || 1) * 100).toFixed(2)) : 0,
                    relatedPoId: initialPOData.id,
                    originalPoQuantity: poItem.quantityOrdered, // Store the original ordered quantity
                };
            }).filter(item => item.quantity > 0); // Only add items that still need receiving
            setItems(poItemsAsStockInItems);
        }

      } catch (error) {
        console.error("Error fetching products/suppliers for purchase form:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchData();
  }, [t, initialPOData]);

  const handleProductSelectionChange = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    setCurrentItem(prev => ({
        ...prev,
        productId: productId,
        productCategoryDisplay: product ? product.category : '',
        productUnitDisplay: product ? product.unit : '',
        buyPrice: product ? product.costPrice : '', 
        sellingPrice: product ? product.sellingPrice : '', 
        quantity: 1, 
    }));
  };
  
  const calculatePrices = useCallback((changedField: 'gp' | 'sellingPrice' | 'cost') => {
    setCurrentItem(prev => {
        const buyPrice = parseFloat(String(prev.buyPrice));
        const hiddenCost = parseFloat(String(prev.hiddenCost) || '0'); 
        let gp = parseFloat(String(prev.gpPercent));
        let sellingPrice = parseFloat(String(prev.sellingPrice));

        if (isNaN(buyPrice) || buyPrice < 0) return prev; 

        const totalCostPrice = buyPrice + (isNaN(hiddenCost) ? 0 : hiddenCost) ;

        if (changedField === 'cost') { 
            if (!isNaN(gp) && gp >= 0 && gp < 100) {
                const newSelling = totalCostPrice / (1 - (gp / 100));
                return { ...prev, sellingPrice: parseFloat(newSelling.toFixed(2)) };
            } else if (!isNaN(sellingPrice) && sellingPrice > totalCostPrice) {
                 const newGp = (1 - (totalCostPrice / sellingPrice)) * 100;
                 return { ...prev, gpPercent: parseFloat(newGp.toFixed(2)) };
            }
             return prev;
        }

        if (changedField === 'gp') {
            if (!isNaN(gp) && gp >= 0 && gp < 100) {
                const newSelling = totalCostPrice / (1 - (gp / 100));
                return { ...prev, sellingPrice: parseFloat(newSelling.toFixed(2)) };
            } else if (String(prev.gpPercent).trim() === '') { 
                return { ...prev, sellingPrice: '' }; 
            }
        }

        if (changedField === 'sellingPrice') {
            if (!isNaN(sellingPrice) && sellingPrice > totalCostPrice) {
                const newGp = (1 - (totalCostPrice / sellingPrice)) * 100;
                return { ...prev, gpPercent: parseFloat(newGp.toFixed(2)) };
            } else if (String(prev.sellingPrice).trim() === '') { 
                 return { ...prev, gpPercent: '' }; 
            } else if (!isNaN(sellingPrice) && sellingPrice <= totalCostPrice) {
                return { ...prev, gpPercent: '' };
            }
        }
        return prev;
    });
  }, []);


  const handleAddItem = () => {
    setItemEntryError('');
    const product = availableProducts.find(p => p.id === currentItem.productId);
    if (!product) {
      setItemEntryError(t('productRequired'));
      return;
    }
    if (currentItem.quantity === '' || currentItem.quantity <= 0) {
      setItemEntryError(t('quantityRequired'));
      return;
    }

    const buyPrice = parseFloat(String(currentItem.buyPrice));
    if (isNaN(buyPrice) || buyPrice < 0) {
      setItemEntryError(t('buyPriceRequired'));
      return;
    }
    const hiddenCost = parseFloat(String(currentItem.hiddenCost) || '0');
     if (isNaN(hiddenCost) || hiddenCost < 0) {
      setItemEntryError(t('hiddenCostRequired')); 
      return;
    }

    const totalCostPrice = buyPrice + hiddenCost;
    let sellingPrice = parseFloat(String(currentItem.sellingPrice));
    let gpPercent = parseFloat(String(currentItem.gpPercent));

    if (isNaN(sellingPrice) || sellingPrice <= totalCostPrice) {
        if(isNaN(gpPercent) || gpPercent < 0 || gpPercent >=100) {
            setItemEntryError(t('gpOrSellingPriceRequired') + '. ' + t('sellingPriceMustBeGreaterThanTotalCost'));
            return;
        }
        sellingPrice = parseFloat((totalCostPrice / (1-(gpPercent/100))).toFixed(2));
        if (isNaN(sellingPrice) || sellingPrice <= totalCostPrice) {
             setItemEntryError(t('sellingPriceMustBeGreaterThanTotalCost'));
             return;
        }
    } else if (isNaN(gpPercent) && sellingPrice > totalCostPrice) {
        gpPercent = parseFloat(((1 - (totalCostPrice / sellingPrice)) * 100).toFixed(2));
    }


    const newItemDetail: PurchaseItemDetail = {
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      quantity: Number(currentItem.quantity),
      buyPrice: buyPrice,
      hiddenCost: hiddenCost,
      totalCostPricePerUnit: totalCostPrice,
      gpPercentApplied: !isNaN(gpPercent) ? gpPercent : undefined,
      calculatedSellingPrice: sellingPrice,
      relatedPoId: initialPOData?.id, 
      originalPoQuantity: currentItem.originalPoQuantity, 
    };
    setItems(prevItems => [...prevItems, newItemDetail]);
    setCurrentItem(initialCurrentItemState); 
  };

  const handleItemFieldChange = (index: number, field: keyof PurchaseItemDetail, value: any) => {
    setItems(prevItems => {
        const newItems = [...prevItems];
        const itemToUpdate = { ...newItems[index] };
        
        if (field === 'quantity' || field === 'buyPrice' || field === 'hiddenCost' || field === 'calculatedSellingPrice' || field === 'gpPercentApplied') {
            (itemToUpdate as any)[field] = value === '' ? '' : parseFloat(String(value)) || 0;
        }

        // Recalculate based on what changed
        if (field === 'buyPrice' || field === 'hiddenCost') {
            itemToUpdate.totalCostPricePerUnit = (itemToUpdate.buyPrice || 0) + (itemToUpdate.hiddenCost || 0);
            if (itemToUpdate.gpPercentApplied !== undefined && itemToUpdate.gpPercentApplied >=0 && itemToUpdate.gpPercentApplied < 100) {
                itemToUpdate.calculatedSellingPrice = parseFloat((itemToUpdate.totalCostPricePerUnit / (1 - (itemToUpdate.gpPercentApplied / 100))).toFixed(2));
            } else if (itemToUpdate.calculatedSellingPrice <= itemToUpdate.totalCostPricePerUnit) {
                itemToUpdate.gpPercentApplied = undefined; 
            }
        } else if (field === 'gpPercentApplied') {
            itemToUpdate.gpPercentApplied = value === '' ? undefined : parseFloat(String(value)) || 0;
            if(itemToUpdate.gpPercentApplied !== undefined && itemToUpdate.gpPercentApplied >= 0 && itemToUpdate.gpPercentApplied < 100) {
                 itemToUpdate.calculatedSellingPrice = parseFloat((itemToUpdate.totalCostPricePerUnit / (1 - (itemToUpdate.gpPercentApplied / 100))).toFixed(2));
            }
        } else if (field === 'calculatedSellingPrice') {
             itemToUpdate.calculatedSellingPrice = parseFloat(String(value)) || 0;
             if (itemToUpdate.calculatedSellingPrice > itemToUpdate.totalCostPricePerUnit) {
                itemToUpdate.gpPercentApplied = parseFloat(((1 - (itemToUpdate.totalCostPricePerUnit / itemToUpdate.calculatedSellingPrice)) * 100).toFixed(2));
             } else {
                 itemToUpdate.gpPercentApplied = undefined;
             }
        }
        
        // Validate quantity against original PO quantity if applicable
        if (field === 'quantity' && initialPOData && itemToUpdate.relatedPoId === initialPOData.id) {
            const poItemForThisStockInItem = initialPOData.items.find(poi => poi.productId === itemToUpdate.productId);
            if (poItemForThisStockInItem) {
                const remainingPoQuantity = poItemForThisStockInItem.quantityOrdered - (poItemForThisStockInItem.quantityReceived || 0);
                if (Number(value) > remainingPoQuantity) {
                    Swal.fire(t('error'), `${t('cannotExceedPOQuantity')} (${remainingPoQuantity})`, 'warning');
                    (itemToUpdate as any)[field] = remainingPoQuantity;
                } else if (Number(value) < 0) {
                    (itemToUpdate as any)[field] = 0;
                }
            }
        }


        newItems[index] = itemToUpdate;
        return newItems;
    });
  };


  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      Swal.fire(t('error'), t('noItemsInPurchase'), 'warning');
      return;
    }

    const result = await Swal.fire({
      title: t('confirm'),
      text: t('confirmProcessPurchase'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.primary,
      cancelButtonColor: UI_COLORS.danger,
      confirmButtonText: t('yes'),
      cancelButtonText: t('no')
    });

    if (!result.isConfirmed) return;

    const selectedSupplier = availableSuppliers.find(s => s.id === supplierId);

    const purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'> = {
      purchaseDate,
      supplierId,
      supplierName: selectedSupplier?.name,
      purchaseCategory, 
      purchaseOrderNumber: purchaseOrderNumber || undefined, 
      notes: notes || undefined,
      items,
      relatedPoId: initialPOData?.id, 
    };
    await onSubmit(purchaseData, initialPOData?.id);
  };

  const totalPurchaseAmount = items.reduce((sum, item) => sum + (item.totalCostPricePerUnit * item.quantity), 0);

  if (isDataLoading && !initialPOData) { 
    return <div className="p-4 flex justify-center items-center h-64"><LoadingSpinner text={t('loading')} /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <fieldset className="border p-4 rounded-md">
        <legend className="text-md font-semibold px-2 text-gray-800">{t('details')}</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t('purchaseDate')} type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
          <div>
            <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">{t('supplier')}</label>
            <select id="supplierId" value={supplierId || ''} onChange={e => setSupplierId(e.target.value || undefined)}
              className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              disabled={!!initialPOData} 
            >
              <option value="">{`-- ${t('selectSupplier')} --`}</option>
              {availableSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="purchaseCategory" className="block text-sm font-medium text-gray-700 mb-1">{t('purchaseCategory')}</label>
            <select id="purchaseCategory" value={purchaseCategory} onChange={e => setPurchaseCategory(e.target.value)} required
              className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              disabled={!!initialPOData} 
            >
              {initialPOData && <option value={t('importFromPO')}>{t('importFromPO')}</option>}
              {!initialPOData && PURCHASE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <Input label={t('purchaseOrderNumber')} value={purchaseOrderNumber} onChange={e => setPurchaseOrderNumber(e.target.value)} disabled={!!initialPOData} />
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
          <textarea id="notes" name="notes" rows={2}
            className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            value={notes} onChange={(e) => setNotes(e.target.value)}
          ></textarea>
        </div>
      </fieldset>

      {/* Item Entry Section - Only if not pre-filled from PO */}
      {!initialPOData && (
        <fieldset className="border p-4 rounded-md">
            <legend className="text-md font-semibold px-2 text-gray-800">{t('add')} {t('products')}</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 items-start">
            <div className="lg:col-span-1">
                <label htmlFor="currentItemProductId" className="block text-sm font-medium text-gray-700 mb-1">{t('productName')}</label>
                <select id="currentItemProductId" value={currentItem.productId} 
                onChange={e => handleProductSelectionChange(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                >
                <option value="">{`-- ${t('selectProduct')} --`}</option>
                {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({t('unit')}: {p.unit}, {t('costPrice')}: {formatCurrency(p.costPrice)})</option>)}
                </select>
                {currentItem.productCategoryDisplay && <p className="mt-1 text-xs text-gray-500">{t('itemProductCategory')}: {currentItem.productCategoryDisplay}</p>}
            </div>
            <Input label={`${t('quantity')} (${currentItem.productUnitDisplay || ''})`} type="number" min="1" value={String(currentItem.quantity)} 
                onChange={e => setCurrentItem(prev => ({...prev, quantity: e.target.value === '' ? '' : parseFloat(e.target.value) || 1}))} 
                wrapperClassName="mb-0 mt-1 md:mt-0" />
            <Input label={t('buyPrice')} type="number" step="0.01" min="0" value={String(currentItem.buyPrice)} 
                onChange={e => {
                    setCurrentItem(prev => ({...prev, buyPrice: e.target.value === '' ? '' : parseFloat(e.target.value) || 0}));
                    calculatePrices('cost');
                }}
                wrapperClassName="mb-0 mt-1 md:mt-0" />
            <Input label={t('hiddenCost')} type="number" step="0.01" min="0" value={String(currentItem.hiddenCost)} 
                onChange={e => {
                    setCurrentItem(prev => ({...prev, hiddenCost: e.target.value === '' ? '' : parseFloat(e.target.value) || 0}));
                    calculatePrices('cost');
                }}
                wrapperClassName="mb-0 mt-1 md:mt-0" />
            <Input label={`${t('gpPercent')} (0-99)`} type="number" step="0.01" min="0" max="99.99" value={String(currentItem.gpPercent)} 
                onChange={e => {
                    setCurrentItem(prev => ({...prev, gpPercent: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }));
                    calculatePrices('gp');
                }}
                wrapperClassName="mb-0 mt-1 md:mt-0" />
            <Input label={t('calculatedSellingPrice')} type="number" step="0.01" min="0" value={String(currentItem.sellingPrice)} 
                onChange={e => {
                    setCurrentItem(prev => ({...prev, sellingPrice: e.target.value === '' ? '' : parseFloat(e.target.value) || 0}));
                    calculatePrices('sellingPrice');
                }}
                wrapperClassName="mb-0 mt-1 md:mt-0" />
            
            <div className="md:col-start-3 md:self-end lg:col-start-auto mt-2 md:mt-0"> 
                <Button type="button" variant="secondary" onClick={handleAddItem} leftIcon={<PlusIcon/>} className="w-full h-10" disabled={isLoading || !currentItem.productId}>{t('addItemToPurchase')}</Button>
            </div>
            </div>
            {itemEntryError && <p className="mt-2 text-xs text-red-600">{itemEntryError}</p>}
        </fieldset>
      )}


      {items.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-2 text-gray-800">{t('itemsInPurchase')}</h3>
          <div className="overflow-x-auto bg-white rounded-md shadow">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('productName')}</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">{t('itemProductCategory')}</th>
                  {initialPOData && <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('quantityOrderedLabel')}</th>}
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('quantity')} ({initialPOData ? t('quantityReceivedLabel') : t('unit')})</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('buyPrice')}</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('hiddenCost')}</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('totalCostPricePerUnit')}</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('gpPercent')}</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('sellingPrice')}</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">{t('total')}</th>
                  {!initialPOData && <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-800">{item.productName}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500">{item.productCategory}</td>
                    {initialPOData && <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-right">{item.originalPoQuantity}</td>}
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-right">
                         <Input type="number" min="0" max={item.originalPoQuantity} value={String(item.quantity)} 
                                onChange={e => handleItemFieldChange(index, 'quantity', e.target.value)} wrapperClassName="mb-0" className="w-20 text-right h-8"/>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-right">
                         <Input type="number" step="0.01" min="0" value={String(item.buyPrice)} 
                                onChange={e => handleItemFieldChange(index, 'buyPrice', e.target.value)} wrapperClassName="mb-0" className="w-24 text-right h-8"/>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-right">
                         <Input type="number" step="0.01" min="0" value={String(item.hiddenCost)} 
                                onChange={e => handleItemFieldChange(index, 'hiddenCost', e.target.value)} wrapperClassName="mb-0" className="w-20 text-right h-8"/>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-600 font-medium text-right">{formatCurrency(item.totalCostPricePerUnit)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-right">
                         <Input type="number" step="0.01" min="0" max="99.99" value={item.gpPercentApplied === undefined ? '' : String(item.gpPercentApplied)} 
                                onChange={e => handleItemFieldChange(index, 'gpPercentApplied', e.target.value)} wrapperClassName="mb-0" className="w-20 text-right h-8"/>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-purple-600 font-medium text-right">
                         <Input type="number" step="0.01" min="0" value={String(item.calculatedSellingPrice)} 
                                onChange={e => handleItemFieldChange(index, 'calculatedSellingPrice', e.target.value)} wrapperClassName="mb-0" className="w-24 text-right h-8"/>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-900 font-bold text-right">{formatCurrency(item.totalCostPricePerUnit * item.quantity)}</td>
                    {!initialPOData && 
                        <td className="px-2 py-2 text-center">
                        <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveItem(index)} className="p-1"><TrashIcon/></Button>
                        </td>
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 text-right">
        <span className="text-xl font-bold text-purple-700">{t('totalPurchaseAmount')}: {formatCurrency(totalPurchaseAmount)} {currencySymbol}</span>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300">
            {t('clear')} {/* Assuming "Cancel" for form means clear/reset */}
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={items.length === 0} className="bg-green-600 hover:bg-green-700">
            {t('save')} {/* Assuming this is "บันทึก" */}
        </Button>
      </div>
    </form>
  );
};

export default PurchaseForm;