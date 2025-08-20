
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Product, CartItem, Sale, SaleTransactionItem, Customer, StoreSettings, Language, Promotion } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getProducts, addSale, isFirebaseInitialized, getCustomers, addCustomer, getStoreSettings, getActivePromotions } from '../../services/firebaseService';
import Input from '../common/Input';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { UI_COLORS, DEFAULT_STORE_SETTINGS } from '../../constants';
import LoadingSpinner from '../common/LoadingSpinner';
import CustomerForm from '../customers/CustomerForm';
import ProductSelectionModal from './ProductSelectionModal';
import PriceSelectionModal from './PriceSelectionModal';
import PrintOptionsModal from './PrintOptionsModal';
import LaoFontInstallationHelp from '../common/LaoFontInstallationHelp';
import { jsPDF } from 'jspdf'; 
import 'jspdf-autotable';

declare var Swal: any;

const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const UserPlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
const PromotionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7a1 1 0 011.414-1.414L10 14.586l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M10 2a1 1 0 011 1v12a1 1 0 11-2 0V3a1 1 0 011-1z" clipRule="evenodd" /></svg>;


export const POSPage: React.FC = () => {
  const { t, language } = useLanguage();
  
  const [allProductsDB, setAllProductsDB] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductSelectionModalOpen, setIsProductSelectionModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedCartItemForPriceChange, setSelectedCartItemForPriceChange] = useState<CartItem | null>(null);

  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [customerFormLoading, setCustomerFormLoading] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [editableVatRate, setEditableVatRate] = useState<number>(7);
  
  // Checkout Modal State
  const [modalDiscount, setModalDiscount] = useState<number | ''>('');
  const [modalPaymentMethod, setModalPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [modalReceivedAmount, setModalReceivedAmount] = useState<number | ''>('');
  const [modalNotes, setModalNotes] = useState('');
  
  const currencySymbol = language === Language.LO ? '₭' : '฿';
  const localeForFormatting = language === Language.LO ? 'lo-LA' : 'th-TH';

  const formatCurrency = useCallback((value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },[localeForFormatting]);

  const resetSaleState = () => {
    setCart([]);
    setSelectedCustomerId('');
    setEditableVatRate(7);
    setModalDiscount('');
    setModalPaymentMethod('cash');
    setModalReceivedAmount('');
    setModalNotes('');
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedCustomers, fetchedStoreSettings, fetchedActivePromotions] = await Promise.all([ 
        getProducts(), 
        getCustomers(),
        getStoreSettings(),
        getActivePromotions()
      ]);
      setAllProductsDB(fetchedProducts);
      setCustomers(fetchedCustomers.sort((a,b) => a.name.localeCompare(b.name)));
      setStoreSettings(fetchedStoreSettings || DEFAULT_STORE_SETTINGS);
      setActivePromotions(fetchedActivePromotions);
    } catch (error) {
      console.error("Error fetching POS data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedCustomerDetails = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  const cartSubtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.activeUnitPrice * item.quantityInCart), 0), [cart]);
  const cartVatAmount = useMemo(() => cartSubtotal * (editableVatRate / 100), [cartSubtotal, editableVatRate]);
  const cartGrandTotal = useMemo(() => cartSubtotal + cartVatAmount, [cartSubtotal, cartVatAmount]);

  const modalCalculations = useMemo(() => {
    const total = cartSubtotal;
    const discount = Number(modalDiscount) || 0;
    const subtotalAfterDiscount = total - discount;
    const taxAmount = subtotalAfterDiscount * (editableVatRate / 100);
    const grandTotal = subtotalAfterDiscount + taxAmount;
    const received = Number(modalReceivedAmount) || 0;
    const change = (modalPaymentMethod === 'cash' && received >= grandTotal) ? received - grandTotal : 0;
    return { total, discount, taxAmount, grandTotal, change };
  }, [cartSubtotal, modalDiscount, editableVatRate, modalReceivedAmount, modalPaymentMethod]);


  const addToCart = useCallback((product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantityInCart < product.stock) {
          return prevCart.map(item => item.id === product.id ? { ...item, quantityInCart: item.quantityInCart + 1 } : item);
        } else {
          Swal.fire({ title: t('notEnoughStock'), icon: 'warning', timer: 1500 });
          return prevCart;
        }
      } else {
        if (product.stock > 0) {
           const newCartItem: CartItem = {
             ...product,
             quantityInCart: 1,
             activeUnitPrice: product.sellingPrice,
             itemDiscountType: 'none',
             itemDiscountValue: 0,
             unitPriceAfterDiscount: product.sellingPrice,
           };
           return [...prevCart, newCartItem];
        } else {
           Swal.fire({ title: t('productOutOfStock'), icon: 'warning', timer: 1500 });
           return prevCart;
        }
      }
    });
  }, [t]);

  const updateCartItemQuantity = (productId: string, change: number) => {
    setCart(prevCart => {
      const itemToUpdate = prevCart.find(item => item.id === productId);
      if (!itemToUpdate) return prevCart;
      
      const newQuantity = itemToUpdate.quantityInCart + change;

      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== productId);
      }
      if (newQuantity > itemToUpdate.stock) {
        Swal.fire({ title: t('notEnoughStock'), text: `${t('stockAvailable')}: ${itemToUpdate.stock}`, icon: 'warning', timer: 2000 });
        return prevCart;
      }
      return prevCart.map(item => item.id === productId ? { ...item, quantityInCart: newQuantity } : item);
    });
  };

  const handleSetCartItemQuantity = (productId: string, value: string) => {
    setCart(prevCart => {
        const newQuantity = parseInt(value, 10);
        
        const itemToUpdate = prevCart.find(item => item.id === productId);
        if (!itemToUpdate) return prevCart;

        if (value === '') { // Allow empty input while typing
            return prevCart.map(item => item.id === productId ? { ...item, quantityInCart: 0 } : item); // Use 0 as a temporary value
        }

        if (isNaN(newQuantity) || newQuantity < 0) { // Invalid number or negative
            return prevCart; // Do nothing
        }

        if (newQuantity > itemToUpdate.stock) {
            Swal.fire({ title: t('notEnoughStock'), text: `${t('stockAvailable')}: ${itemToUpdate.stock}`, icon: 'warning', timer: 2000 });
            return prevCart.map(item => item.id === productId ? { ...item, quantityInCart: itemToUpdate.stock } : item);
        }
        
        return prevCart.map(item => item.id === productId ? { ...item, quantityInCart: newQuantity } : item);
    });
  };

  const handleQuantityInputBlur = (productId: string) => {
    setCart(prevCart => {
        const itemToUpdate = prevCart.find(item => item.id === productId);
        if (!itemToUpdate) return prevCart;

        if (itemToUpdate.quantityInCart <= 0) {
            return prevCart.filter(item => item.id !== productId); // Remove item if quantity is 0 or less
        }
        return prevCart;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };
  
  const handleClearBill = () => {
    Swal.fire({
        title: t('areYouSure'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: UI_COLORS.danger,
        cancelButtonText: t('cancel'),
        confirmButtonText: t('yes'),
    }).then((result: any) => {
        if (result.isConfirmed) {
            resetSaleState();
        }
    });
  };

  const handleAddNewCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
      setCustomerFormLoading(true);
      try {
          const newCustomerId = await addCustomer(customerData);
          await fetchData();
          setSelectedCustomerId(newCustomerId as string);
          setIsCustomerModalOpen(false);
      } catch (error) {
          Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
          setCustomerFormLoading(false);
      }
  };
    
  const handleOpenCheckout = () => {
      if (cart.length === 0) {
        Swal.fire(t('cartIsEmpty'), '', 'warning');
        return;
      }
      if (modalPaymentMethod === 'credit' && !selectedCustomerId) {
          Swal.fire(t('error'), t('selectCustomer'), 'warning');
          return;
      }
      setIsCheckoutModalOpen(true);
  };

  const handleApplyPromotions = () => {
    if (activePromotions.length === 0 || cart.length === 0) return;

    let promotionsApplied = false;
    const newCart = cart.map(cartItem => {
        if (cartItem.appliedPromotionId) {
            return cartItem; // Promotion already applied, skip
        }

        const applicablePromotion = activePromotions.find(promo => promo.productIds.includes(cartItem.id));

        if (applicablePromotion) {
            promotionsApplied = true;
            const originalPrice = cartItem.sellingPrice;
            let newPrice = originalPrice;

            if (applicablePromotion.discountType === 'percent') {
                newPrice = originalPrice * (1 - applicablePromotion.discountValue / 100);
            } else { // 'fixed'
                newPrice = originalPrice - applicablePromotion.discountValue;
            }

            newPrice = Math.max(0, newPrice); // Don't let price be negative

            // Only apply if the new price is better than the current active price
            if (newPrice < cartItem.activeUnitPrice) {
                return {
                    ...cartItem,
                    activeUnitPrice: newPrice,
                    unitPriceAfterDiscount: newPrice,
                    appliedPromotionId: applicablePromotion.id,
                    originalUnitPriceBeforePromo: originalPrice,
                    itemDiscountType: 'none' as 'none',
                    itemDiscountValue: 0,
                };
            }
        }
        return cartItem;
    });

    setCart(newCart);

    if (promotionsApplied) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: t('promotionApplied'),
            showConfirmButton: false,
            timer: 2000
        });
    }
  };
  
  const handleProcessSale = async () => {
    setIsProcessingSale(true);

    const totalOriginalPrice = cart.reduce((acc, item) => {
        const originalItemPrice = item.originalUnitPriceBeforePromo ?? item.sellingPrice;
        return acc + (originalItemPrice * item.quantityInCart);
    }, 0);
    const currentSubtotal = cart.reduce((acc, item) => acc + (item.activeUnitPrice * item.quantityInCart), 0);
    const totalItemDiscount = totalOriginalPrice - currentSubtotal;

    const saleTransactionItems: SaleTransactionItem[] = cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantityInCart,
        originalUnitPrice: item.originalUnitPriceBeforePromo ?? item.sellingPrice,
        itemDiscountType: item.appliedPromotionId ? 'none' : item.itemDiscountType,
        itemDiscountValue: item.appliedPromotionId ? 0 : item.itemDiscountValue,
        unitPriceAfterItemDiscount: item.activeUnitPrice,
        totalPrice: item.activeUnitPrice * item.quantityInCart,
        appliedPromotionId: item.appliedPromotionId,
    }));
    
    const saleData: Omit<Sale, 'id' | 'receiptNumber'> = {
        items: saleTransactionItems,
        customerId: selectedCustomerDetails?.id,
        customerName: selectedCustomerDetails?.name || t('walkInCustomer'),
        customerType: selectedCustomerDetails?.customerType || 'cash',
        transactionDate: new Date().toISOString(),
        totalCartOriginalPrice: totalOriginalPrice,
        totalCartItemDiscountAmount: totalItemDiscount,
        subtotalAfterItemDiscounts: currentSubtotal,
        overallSaleDiscountType: modalCalculations.discount > 0 ? 'fixed' : 'none',
        overallSaleDiscountValueInput: modalCalculations.discount,
        overallSaleDiscountAmountCalculated: modalCalculations.discount,
        subtotalAfterOverallSaleDiscount: modalCalculations.total - modalCalculations.discount,
        totalSaleLevelDiscountAmount: modalCalculations.discount,
        subtotalBeforeEditableVAT: modalCalculations.total - modalCalculations.discount,
        editableVatRate: editableVatRate / 100,
        vatAmountFromEditableRate: modalCalculations.taxAmount,
        grandTotal: modalCalculations.grandTotal,
        paymentMethod: modalPaymentMethod,
        receivedAmount: modalPaymentMethod === 'cash' ? Number(modalReceivedAmount) || 0 : undefined,
        changeGiven: modalPaymentMethod === 'cash' ? modalCalculations.change : undefined,
        status: modalPaymentMethod === 'credit' ? 'unpaid' : 'paid',
        paidAmount: modalPaymentMethod !== 'credit' ? modalCalculations.grandTotal : 0,
        outstandingAmount: modalPaymentMethod === 'credit' ? modalCalculations.grandTotal : 0,
        notes: modalNotes || undefined,
        vatStrategy: 'add',
        vatAmount: modalCalculations.taxAmount,
    };
    
    try {
        await addSale(saleData);
        Swal.fire({
            icon: 'success',
            title: t('saleSuccess'),
            showConfirmButton: false,
            timer: 1500
        });
        resetSaleState();
        setIsCheckoutModalOpen(false);
    } catch (error: any) {
        console.error("Error processing sale:", error);
        Swal.fire(t('error'), error.message || t('errorProcessingSale'), 'error');
    } finally {
        setIsProcessingSale(false);
    }
  };

  const handleCartItemDoubleClick = (item: CartItem) => {
    if (
        (item.sellingPrice2 && item.sellingPrice2 > 0) ||
        (item.sellingPrice3 && item.sellingPrice3 > 0)
    ) {
        setSelectedCartItemForPriceChange(item);
        setIsPriceModalOpen(true);
    }
  };

  const handlePriceSelect = (productId: string, newPrice: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, activeUnitPrice: newPrice, unitPriceAfterDiscount: newPrice }
          : item
      )
    );
    setIsPriceModalOpen(false);
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-5rem)] p-4 bg-gray-100">
        {/* Left Panel */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-md flex flex-col">
            <div className="p-4 border-b">
                <Button onClick={() => setIsProductSelectionModalOpen(true)} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700">
                    <PlusIcon /> {t('addProductButtonPos')}
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                <h2 className="text-lg font-semibold text-gray-700 p-4 sticky top-0 bg-white z-10">{t('cartItemsList')}</h2>
                {cart.length === 0 ? (
                    <p className="text-center text-gray-500 py-16">{t('emptyCart')}</p>
                ) : (
                <table className="w-full">
                    <thead>
                        <tr className="text-sm text-left text-gray-500">
                            <th className="p-2 font-medium">{t('productName')}</th>
                            <th className="p-2 font-medium text-center">{t('quantity')}</th>
                            <th className="p-2 font-medium text-right">{t('price')}</th>
                            <th className="p-2 font-medium text-right">{t('total')}</th>
                            <th className="p-2 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map(item => (
                            <tr key={item.id} className="border-t hover:bg-slate-50 cursor-pointer" onDoubleClick={() => handleCartItemDoubleClick(item)}>
                                <td className="p-2 font-semibold text-gray-800">
                                    {item.name}
                                    {item.appliedPromotionId && (
                                        <div className="text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full inline-block ml-2">
                                            {t('promotionApplied')}
                                        </div>
                                    )}
                                </td>
                                <td className="p-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button type="button" onClick={() => updateCartItemQuantity(item.id, -1)} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-purple-400">
                                            <MinusIcon />
                                        </button>
                                        <input
                                            type="number"
                                            value={item.quantityInCart > 0 ? item.quantityInCart : ''}
                                            onChange={(e) => handleSetCartItemQuantity(item.id, e.target.value)}
                                            onBlur={() => handleQuantityInputBlur(item.id)}
                                            className="w-12 h-8 text-center border-0 bg-transparent focus:ring-1 focus:ring-purple-200 focus:outline-none rounded-md text-base font-medium text-gray-800"
                                        />
                                        <button type="button" onClick={() => updateCartItemQuantity(item.id, 1)} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-purple-400">
                                            <PlusIcon />
                                        </button>
                                    </div>
                                </td>
                                <td className="p-2 text-right text-gray-600">
                                    {item.appliedPromotionId && item.originalUnitPriceBeforePromo != null && (
                                        <span className="line-through text-red-500 mr-1">
                                            {formatCurrency(item.originalUnitPriceBeforePromo)}
                                        </span>
                                    )}
                                    {formatCurrency(item.activeUnitPrice)}
                                </td>
                                <td className="p-2 text-right font-semibold text-gray-800">{formatCurrency(item.activeUnitPrice * item.quantityInCart)}</td>
                                <td className="p-2 text-center">
                                    <Button onClick={() => removeFromCart(item.id)} size="sm" variant="ghost" className="text-red-500 hover:bg-red-100 p-1"><TrashIcon/></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-semibold mb-2 flex items-center">{t('selectExistingCustomer')}</h3>
                <div className="flex items-center gap-2">
                    <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full h-10 border-gray-300 rounded-md shadow-sm">
                        <option value="">{t('walkInCustomer')}</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button onClick={() => setIsCustomerModalOpen(true)} className="flex-shrink-0 bg-green-600 hover:bg-green-700 h-10 w-10 p-0"><UserPlusIcon/></Button>
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 flex-grow flex flex-col">
                <h3 className="text-lg font-semibold mb-4">{t('summary')}</h3>
                <div className="space-y-2 text-lg flex-grow">
                    <div className="flex justify-between"><span>{t('summarySubtotal')}</span><span>{formatCurrency(cartSubtotal)} {currencySymbol}</span></div>
                    <div className="flex justify-between"><span>{t('summaryVatWithPercent', {percent: editableVatRate.toString()})}</span><span>{formatCurrency(cartVatAmount)} {currencySymbol}</span></div>
                    <div className="flex justify-between font-bold text-2xl border-t pt-2 mt-2">
                        <span className="text-gray-900">{t('grandTotal')}</span>
                        <span className="text-red-600">{formatCurrency(cartGrandTotal)} {currencySymbol}</span>
                    </div>
                </div>
                <div className="mt-auto pt-4 space-y-2">
                    <Button onClick={handleApplyPromotions} variant="secondary" className="w-full h-12 text-lg bg-yellow-500 hover:bg-yellow-600">
                        <PromotionIcon /> {t('applyPromotions')}
                    </Button>
                    <Button onClick={handleOpenCheckout} className="w-full h-14 text-xl bg-green-600 hover:bg-green-700">{t('checkout')}</Button>
                    <Button onClick={handleClearBill} variant="outline" className="w-full h-10">{t('clearBillRed')}</Button>
                </div>
            </div>
        </div>

        {/* Modals */}
        <ProductSelectionModal isOpen={isProductSelectionModalOpen} onClose={() => setIsProductSelectionModalOpen(false)} allProducts={allProductsDB} onProductSelect={addToCart} isLoadingExternally={isLoading} />
        <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={t('addNewCustomer')}>
            <CustomerForm onSubmit={handleAddNewCustomer} onCancel={() => setIsCustomerModalOpen(false)} isLoading={customerFormLoading} />
        </Modal>
        <PriceSelectionModal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} cartItem={selectedCartItemForPriceChange} onPriceSelect={handlePriceSelect} />


        {/* Checkout Modal */}
        {isCheckoutModalOpen && (
            <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title={t('checkoutModalTitle')}>
                <div className="space-y-4 pt-2">
                    <div className="p-4 bg-gray-100 rounded-lg space-y-2 text-right">
                        <div className="flex justify-between text-lg"><span>{t('modalTotalAmount')}</span><span>{formatCurrency(modalCalculations.total)} {currencySymbol}</span></div>
                        <div className="flex justify-between items-center text-lg">
                          <label htmlFor="discount">{t('modalDiscount')}</label>
                          <Input id="discount" type="number" value={modalDiscount} onChange={(e) => setModalDiscount(e.target.value === '' ? '' : Number(e.target.value))} className="w-32 h-9 text-right" wrapperClassName="mb-0"/>
                        </div>
                        <div className="flex justify-between text-lg"><span>{t('modalTaxAmount', {percent: editableVatRate.toString()})}</span><span>{formatCurrency(modalCalculations.taxAmount)} {currencySymbol}</span></div>
                        <div className="flex justify-between text-2xl font-bold border-t pt-2 mt-2">
                            <span className="text-gray-900">{t('modalGrandTotal')}</span>
                            <span className="text-red-600">{formatCurrency(modalCalculations.grandTotal)} {currencySymbol}</span>
                        </div>
                    </div>
                    
                    <div className="flex justify-center gap-2 pt-2">
                        {(['cash', 'transfer', 'credit'] as const).map(method => (
                            <Button key={method} onClick={() => setModalPaymentMethod(method)}
                                className={`w-full ${modalPaymentMethod === method ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}>
                                {t(method === 'credit' ? 'paymentDebt' : `payment${method.charAt(0).toUpperCase() + method.slice(1)}`)}
                            </Button>
                        ))}
                    </div>

                    {modalPaymentMethod === 'cash' && (
                        <div className="p-4 border rounded-lg space-y-2">
                            <div className="flex justify-between items-center text-lg">
                                <label htmlFor="receivedAmount">{t('receivedAmount')}</label>
                                <Input id="receivedAmount" type="number" value={modalReceivedAmount} onChange={(e) => setModalReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-40 h-10 text-right" wrapperClassName="mb-0"/>
                            </div>
                            <div className="flex justify-between text-xl font-bold">
                                <span className="text-gray-900">{t('changeDue')}</span>
                                <span className="text-green-600">{formatCurrency(modalCalculations.change)} {currencySymbol}</span>
                            </div>
                        </div>
                    )}
                    
                    <div>
                      <label htmlFor="saleNotes" className="block text-sm font-medium text-gray-700 mb-1">{t('modalNotes')}</label>
                      <textarea id="saleNotes" value={modalNotes} onChange={e => setModalNotes(e.target.value)} rows={2} className="w-full border-gray-300 rounded-md shadow-sm"></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => setIsCheckoutModalOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handleProcessSale} isLoading={isProcessingSale} className="bg-red-600 hover:bg-red-700">{t('confirmPayment')}</Button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};
