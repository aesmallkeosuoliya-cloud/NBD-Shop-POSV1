
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { PurchaseOrder, PurchaseOrderItem, Product, Supplier, StoreSettings, PurchaseOrderStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getProducts, getSuppliers, addPurchaseOrder, updatePurchaseOrder, getPurchaseOrderById, getStoreSettings } from '../../services/firebaseService';
import { DEFAULT_STORE_SETTINGS, UI_COLORS } from '../../constants';
import Input from '../common/Input';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import POProductSelectionModal from './POProductSelectionModal'; // New Import

declare var Swal: any; // SweetAlert2

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const PrintablePO: React.FC<{
  po: PurchaseOrder;
  settings: StoreSettings;
  t: (key: string, replacements?: Record<string, string>) => string;
  formatCurrency: (value: number) => string;
  formatDate: (isoDate: string) => string;
}> = ({ po, settings, t, formatCurrency, formatDate }) => {
  return (
    <div className="po-print-container">
      <header className="po-print-header">
        <div className="store-info">
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '5px' }}>{settings.storeName}</h2>
          <p style={{ margin: 0 }}>{settings.address}</p>
          <p style={{ margin: 0 }}>{t('phone')}: {settings.phone}</p>
        </div>
        <div className="po-info" style={{ textAlign: 'right' }}>
          <h1>{t('poDocumentTitle')}</h1>
          <p style={{ margin: 0 }}><strong>{t('poNumberLabel')}:</strong> {po.poNumber}</p>
          <p style={{ margin: 0 }}><strong>{t('orderDateLabel')}:</strong> {formatDate(po.orderDate)}</p>
        </div>
      </header>
      <section className="po-print-supplier-info">
        <h3 style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{t('supplier')}:</h3>
        <p style={{ margin: 0 }}><strong>{po.supplierName || t('unknown')}</strong></p>
      </section>
      <table className="po-print-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('productName')}</th>
            <th style={{ textAlign: 'right' }}>{t('quantityOrderedLabel')}</th>
            <th style={{ textAlign: 'right' }}>{t('unitPriceAtPOLabel')}</th>
            <th style={{ textAlign: 'right' }}>{t('totalPriceAtPOLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((item, index) => (
            <tr key={item.productId + index}>
              <td>{index + 1}</td>
              <td>{item.productName} ({item.unit})</td>
              <td style={{ textAlign: 'right' }}>{item.quantityOrdered}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="po-print-summary">
        <tbody>
          <tr><td>{t('poSubtotalLabel')}:</td><td style={{ textAlign: 'right' }}>{formatCurrency(po.subtotalBeforeVAT)}</td></tr>
          <tr><td>{t('poVatRateLabel')} ({po.vatRate}%):</td><td style={{ textAlign: 'right' }}>{formatCurrency(po.vatAmount)}</td></tr>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}><td>{t('poGrandTotalLabel')}:</td><td style={{ textAlign: 'right' }}>{formatCurrency(po.grandTotal)}</td></tr>
        </tbody>
      </table>
      {po.notes && (
        <footer className="po-print-footer">
          <strong>{t('poNotesLabel')}:</strong>
          <p style={{ margin: '5px 0 0 0' }}>{po.notes}</p>
        </footer>
      )}
    </div>
  );
};

interface PurchaseOrderFormProps {
  poIdToEdit?: string;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ poIdToEdit }) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [poNumber, setPoNumber] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [vatRate, setVatRate] = useState(storeSettings.defaultVatRateForPO || 0);

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const poPrintAreaRootRef = useRef<Root | null>(null);

  const currencySymbol = language === 'lo' ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
  
  const formatCurrency = useCallback((value: number) => {
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },[localeForFormatting]);
  
  const formatDate = useCallback((isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },[localeForFormatting]);

  const generatePoNumber = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PO-${year}${month}${day}-${hours}${minutes}${seconds}-${randomSuffix}`;
  }, []);

  useEffect(() => {
    const fetchDataAndPopulateForm = async () => {
      setIsDataLoading(true);
      try {
        const [products, suppliers, settings] = await Promise.all([
          getProducts(),
          getSuppliers(),
          getStoreSettings()
        ]);
        
        setAvailableProducts(products.sort((a, b) => a.name.localeCompare(b.name)));
        setAvailableSuppliers(suppliers.sort((a, b) => a.name.localeCompare(b.name)));
        const activeSettings = settings || DEFAULT_STORE_SETTINGS;
        setStoreSettings(activeSettings);

        if (poIdToEdit) {
          setIsEditMode(true);
          const poToEdit = await getPurchaseOrderById(poIdToEdit);
          if (poToEdit) {
            setPoNumber(poToEdit.poNumber);
            setOrderDate(poToEdit.orderDate.split('T')[0]);
            setSupplierId(poToEdit.supplierId);
            setNotes(poToEdit.notes || '');
            setItems(poToEdit.items);
            setVatRate(poToEdit.vatRate);
            setIsEditable(poToEdit.status === 'pending');
          } else {
            Swal.fire(t('error'), `${t('errorFetchingPOs')}: ID not found.`, 'error');
            navigate('/purchase-orders/history');
          }
        } else {
          setIsEditMode(false);
          setPoNumber(generatePoNumber());
          setVatRate(activeSettings.defaultVatRateForPO || 0);
          setOrderDate(new Date().toISOString().split('T')[0]);
          setSupplierId(undefined);
          setNotes('');
          setItems([]);
          setIsEditable(true); // New PO is always editable
        }
      } catch (error) {
        console.error("Error loading data for PO form:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchDataAndPopulateForm();
  }, [poIdToEdit, generatePoNumber, t, navigate]);


  const selectedSupplierDetails = useMemo(() => {
    return availableSuppliers.find(s => s.id === supplierId);
  }, [supplierId, availableSuppliers]);

  const { subtotal, vatAmount, grandTotal } = useMemo(() => {
    const sub = items.reduce((acc, item) => acc + item.totalPrice, 0);
    const vat = sub * (vatRate / 100);
    const grand = sub + vat;
    return { subtotal: sub, vatAmount: vat, grandTotal: grand };
  }, [items, vatRate]);

  const handleAddProducts = (selectedProducts: Product[]) => {
    const newItems: PurchaseOrderItem[] = selectedProducts
        .filter(p => !items.some(item => item.productId === p.id)) // Filter out duplicates already in the list
        .map(p => ({
            productId: p.id,
            productName: p.name,
            productCategory: p.category,
            unit: p.unit,
            quantityOrdered: 1, // Default quantity
            unitPrice: p.costPrice, // Default to product's cost price
            totalPrice: p.costPrice * 1,
            quantityReceived: 0,
        }));
    
    setItems(prev => [...prev, ...newItems]);
    setIsProductModalOpen(false);
  };


  const handleItemChange = (index: number, field: 'quantityOrdered' | 'unitPrice', value: string) => {
    const numericValue = parseFloat(value) || 0;
    setItems(prevItems => {
        const newItems = [...prevItems];
        const itemToUpdate = { ...newItems[index] };
  
        if (field === 'quantityOrdered') {
            itemToUpdate.quantityOrdered = numericValue > 0 ? numericValue : 0;
        } else if (field === 'unitPrice') {
            itemToUpdate.unitPrice = numericValue >= 0 ? numericValue : 0;
        }
  
        itemToUpdate.totalPrice = itemToUpdate.quantityOrdered * itemToUpdate.unitPrice;
        newItems[index] = itemToUpdate;
        return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!orderDate) errors.orderDate = t('requiredField');
    if (!supplierId) errors.supplierId = t('requiredField');
    if (items.length === 0) {
        Swal.fire(t('error'), t('noItemsInPO'), 'warning');
        return false;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }
  
  const handlePrint = (poToPrint: PurchaseOrder) => {
    const printAreaContainer = document.getElementById('po-print-area-wrapper');
    if (printAreaContainer) {
      if (!poPrintAreaRootRef.current) {
        poPrintAreaRootRef.current = createRoot(printAreaContainer);
      }
      poPrintAreaRootRef.current.render(
        <PrintablePO 
          po={poToPrint} 
          settings={storeSettings} 
          t={t} 
          formatCurrency={formatCurrency} 
          formatDate={formatDate} 
        />
      );
      
      setTimeout(() => {
        document.body.classList.add('printing-po');
        
        const cleanup = () => {
            document.body.classList.remove('printing-po');
            window.removeEventListener('afterprint', cleanup);
            poPrintAreaRootRef.current?.render(null); // Cleanup react component
        };
        window.addEventListener('afterprint', cleanup);

        window.print();
        
      }, 500); // Allow time for render
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    const selectedSupplier = availableSuppliers.find(s => s.id === supplierId);

    const poDataPayload: Partial<Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>> = {
      poNumber,
      orderDate: new Date(orderDate).toISOString(),
      supplierId: supplierId,
      supplierName: selectedSupplier?.name,
      items,
      notes: notes || undefined,
      subtotalBeforeVAT: subtotal,
      vatRate: vatRate,
      vatAmount: vatAmount,
      grandTotal: grandTotal,
    };
    
    if (isEditMode) {
        const existingPO = await getPurchaseOrderById(poIdToEdit!);
        if (existingPO) {
            poDataPayload.status = existingPO.status;
        }
    } else {
        poDataPayload.status = 'pending';
    }


    try {
      if (isEditMode && poIdToEdit) {
        await updatePurchaseOrder(poIdToEdit, poDataPayload);
        Swal.fire(t('success'), t('poSuccessfullyUpdated', { poNumber }), 'success');
        navigate('/purchase-orders/history');
      } else {
        const newPOId = await addPurchaseOrder(poDataPayload as Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>);
        const savedPO: PurchaseOrder = { 
            ...(poDataPayload as Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>), 
            id: newPOId, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
        };
        
        Swal.fire({
          title: t('success'),
          text: t('poSuccessfullyCreated', { poNumber }),
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: t('printPO'),
          cancelButtonText: t('noThanks'),
          confirmButtonColor: UI_COLORS.primary,
        }).then((result) => {
          if (result.isConfirmed) {
            handlePrint(savedPO);
          }
           navigate('/purchase-orders/history');
        });
      }
    } catch (error) {
      console.error("Error saving PO:", error);
      Swal.fire(t('error'), isEditMode ? t('errorUpdatingPO') : t('errorCreatingPO'), 'error');
    } finally {
      setIsSaving(false);
    }
  };


  if (isDataLoading) {
    return <div className="p-6 flex justify-center"><LoadingSpinner text={t('loading')} /></div>;
  }
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
          {isEditMode ? t('editPurchaseOrder') : t('purchaseOrderPageTitle')}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title={t('details')} bodyClassName="text-gray-900">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label={t('poNumberLabel')} value={poNumber} readOnly disabled wrapperClassName="mb-0"/>
                <Input label={t('orderDateLabel')} type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} error={formErrors.orderDate} required wrapperClassName="mb-0"/>
                <div>
                    <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">{t('supplier')}</label>
                    <select id="supplierId" value={supplierId || ''} onChange={e => setSupplierId(e.target.value || undefined)}
                        className="mt-1 block w-full px-3 py-2.5 h-11 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        required
                    >
                        <option value="">-- {t('selectSupplier')} --</option>
                        {availableSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {formErrors.supplierId && <p className="mt-1 text-xs text-red-600">{formErrors.supplierId}</p>}
                </div>
            </div>
             {selectedSupplierDetails && (
                 <div className="mt-3 p-3 bg-slate-50 rounded-md border text-sm text-gray-700">
                    <h4 className="font-semibold mb-1 text-gray-800">{t('supplierDetails')}</h4>
                    <p><strong>{t('phone')}:</strong> {selectedSupplierDetails.phone || '-'}</p>
                    <p><strong>{t('taxInfo')}:</strong> {selectedSupplierDetails.taxInfo || '-'}</p>
                    <p><strong>{t('taxId')}:</strong> {selectedSupplierDetails.taxId || '-'}</p>
                    <p><strong>{t('creditDays')}:</strong> {selectedSupplierDetails.creditDays || 0} {t('days')}</p>
                 </div>
            )}
        </Card>
        
        <Card title={t('poItemsLabel')} bodyClassName="text-gray-900">
            {isEditable && (
                <div className="mb-4">
                    <Button type="button" onClick={() => setIsProductModalOpen(true)} variant="secondary" leftIcon={<PlusIcon />}>
                        {t('addProductToPOLabel')}
                    </Button>
                </div>
            )}

          <div className="overflow-auto relative border rounded-lg shadow-md" style={{ maxHeight: '40vh' }}>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">{t('productName')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">{t('quantityOrderedLabel')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">{t('unitPriceAtPOLabel')}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">{t('totalPriceAtPOLabel')}</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-500">{t('noItemsInPO')}</td></tr>}
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">{item.productName} ({item.unit})</td>
                    <td className="px-3 py-2 text-right">
                       <Input
                          type="number"
                          value={item.quantityOrdered.toString()}
                          onChange={(e) => handleItemChange(index, 'quantityOrdered', e.target.value)}
                          className="w-20 text-right h-8"
                          wrapperClassName="mb-0 inline-block"
                          disabled={!isEditable}
                        />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice.toString()}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-24 text-right h-8"
                          wrapperClassName="mb-0 inline-block"
                          disabled={!isEditable}
                        />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.totalPrice)}</td>
                    <td className="px-3 py-2 text-center">
                        {isEditable && (
                             <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="p-1 text-red-500 hover:bg-red-100"><TrashIcon/></Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
                 <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('poNotesLabel')}</label>
                 <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm"></textarea>
            </div>
            <div className="bg-slate-50 p-4 rounded-md space-y-2 text-right text-gray-900">
                <p className="flex justify-between text-md"><span>{t('poSubtotalLabel')}:</span> <span>{formatCurrency(subtotal)} {currencySymbol}</span></p>
                <div className="flex justify-between items-center">
                    <label htmlFor="vatRate" className="text-md">{t('poVatRateLabel')}:</label>
                    <Input type="number" id="vatRate" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className="w-24 h-9 text-right" wrapperClassName="mb-0"/>
                </div>
                <p className="flex justify-between text-md"><span>{t('poVatAmountLabel')}:</span> <span>{formatCurrency(vatAmount)} {currencySymbol}</span></p>
                <p className="flex justify-between text-xl font-bold border-t pt-2 mt-2"><span>{t('poGrandTotalLabel')}:</span> <span className="text-purple-700">{formatCurrency(grandTotal)} {currencySymbol}</span></p>
            </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/purchase-orders/history')} disabled={isSaving}>{t('cancel')}</Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={items.length === 0 || !isEditable}>
                {isEditMode ? t('save') : t('savePOButton')}
            </Button>
        </div>
      </form>

      <POProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        availableProducts={availableProducts}
        onConfirmSelection={handleAddProducts}
        existingProductIdsInPO={new Set(items.map(i => i.productId))}
      />
    </div>
  );
};

export default PurchaseOrderForm;
