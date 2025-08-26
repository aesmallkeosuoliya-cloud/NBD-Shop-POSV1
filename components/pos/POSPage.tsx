
import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Product, CartItem, Sale, SaleTransactionItem, Customer, StoreSettings, Language, Promotion, ExchangeRates } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getProducts, addSale, isFirebaseInitialized, getCustomers, addCustomer, getStoreSettings, getActivePromotions, getExchangeRates } from '../../services/firebaseService';
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

// --- ICONS ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const UserPlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
const PromotionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7a1 1 0 011.414-1.414L10 14.586l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M10 2a1 1 0 011 1v12a1 1 0 11-2 0V3a1 1 0 011-1z" clipRule="evenodd" /></svg>;

// --- RECEIPT COMPONENT & TYPES ---
interface ReceiptData {
    receiptNumber: string;
    transactionDate: string;
    customerName: string;
    items: { productName: string; quantity: number; unitPrice: number; totalPrice: number }[];
    subtotal: number;
    discount: number;
    vat: number;
    vatRate: number;
    grandTotal: number;
    notes?: string;
    footerNote: string;
    changeGiven?: number;
    receivedAmount?: number;
    paymentMethod: string;
}
  
const PrintableReceipt: React.FC<{
    data: ReceiptData;
    settings: StoreSettings;
    exchangeRates: ExchangeRates | null;
    t: (key: string, replacements?: Record<string, string>) => string;
    formatCurrency: (value: number) => string;
}> = ({ data, settings, exchangeRates, t, formatCurrency }) => {
    return (
      <div style={{ width: '288px', fontFamily: "'Phetsarath OT', 'Noto Sans Lao', sans-serif", fontSize: '12px', color: 'black', margin: '0 auto', padding: '10px', background: 'white' }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: '80px', maxHeight: '40px', margin: '0 auto 5px' }} />}
          <h2 style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>{settings.storeName}</h2>
          <p style={{ margin: 0 }}>{settings.address}</p>
          <p style={{ margin: 0 }}>{t('receiptHeaderPhone')}: {settings.phone}</p>
          {settings.taxId && <p style={{ margin: 0 }}>{t('receiptHeaderTaxId')}: {settings.taxId}</p>}
        </div>
        <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0', fontSize: '11px' }}>
          <p style={{ margin: '1px 0' }}>{t('receiptNumber')}: {data.receiptNumber}</p>
          <p style={{ margin: '1px 0' }}>{t('date')}: {new Date(data.transactionDate).toLocaleString()}</p>
          <p style={{ margin: '1px 0' }}>{t('customerName')}: {data.customerName}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'left', padding: '2px', fontSize: '11px' }}>{t('productName')}</th>
              <th style={{ textAlign: 'right', padding: '2px', fontSize: '11px' }}>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                <td style={{ padding: '2px' }}>
                  {item.productName}<br/>
                  <span style={{ fontSize: '10px' }}>&nbsp;&nbsp;{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '2px', verticalAlign: 'top' }}>{formatCurrency(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: '1px dashed black', paddingTop: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('summarySubtotal')}:</span><span>{formatCurrency(data.subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('modalDiscount')}</span><span>-{formatCurrency(data.discount)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('summaryVatWithPercent', { percent: data.vatRate.toString()})}</span><span>{formatCurrency(data.vat)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '5px' }}><span>{t('grandTotal')}:</span><span>{formatCurrency(data.grandTotal)}</span></div>
        </div>
         {data.paymentMethod === 'cash' && data.receivedAmount !== undefined && (
          <div style={{ borderTop: '1px dashed black', marginTop: '5px', paddingTop: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('receivedAmount')}</span><span>{formatCurrency(data.receivedAmount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('changeDue')}</span><span>{formatCurrency(data.changeGiven ?? 0)}</span></div>
          </div>
        )}
        {data.notes && <p style={{ marginTop: '10px', fontSize: '10px', borderTop: '1px dashed black', paddingTop: '5px' }}>{t('notes')}: {data.notes}</p>}
        <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed black', paddingTop: '5px' }}>
          <p style={{ margin: 0 }}>{data.footerNote}</p>
        </div>

        {exchangeRates && (exchangeRates.thb > 0 || exchangeRates.usd > 0 || exchangeRates.cny > 0) && (
            <div style={{ borderTop: '1px dashed black', marginTop: '10px', paddingTop: '5px', fontSize: '11px' }}>
                <p style={{ margin: '1px 0', fontWeight: 'bold' }}>{t('receiptMultiCurrencyHeader')}</p>
                {exchangeRates.thb > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('receiptTotalThb')}:</span><span>{(data.grandTotal / exchangeRates.thb).toFixed(2)}</span></div>}
                {exchangeRates.usd > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('receiptTotalUsd')}:</span><span>{(data.grandTotal / exchangeRates.usd).toFixed(2)}</span></div>}
                {exchangeRates.cny > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('receiptTotalCny')}:</span><span>{(data.grandTotal / exchangeRates.cny).toFixed(2)}</span></div>}
            </div>
        )}

        {settings.qrPaymentUrl && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <img src={settings.qrPaymentUrl} alt={t('altQrPayment')} style={{ maxWidth: '120px', margin: '0 auto' }} />
            </div>
        )}
      </div>
    );
};


export const POSPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  
  const [allProductsDB, setAllProductsDB] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductSelectionModalOpen, setIsProductSelectionModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
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

  const receiptPrintAreaRootRef = useRef<Root | null>(null);
  
  const currencySymbol = language === Language.LO ? '₭' : '฿';
  const localeForFormatting = language === Language.LO ? 'lo-LA' : 'th-TH';

  const formatCurrency = useCallback((value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },[localeForFormatting]);

  const resetSaleState = () => {
    setCart([]);
    setSelectedCustomerId('');
    setModalDiscount('');
    setModalPaymentMethod('cash');
    setModalReceivedAmount('');
    setModalNotes('');
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedCustomers, fetchedStoreSettings, fetchedActivePromotions, fetchedExchangeRates] = await Promise.all([ 
        getProducts(), 
        getCustomers(),
        getStoreSettings(),
        getActivePromotions(),
        getExchangeRates()
      ]);
      setAllProductsDB(fetchedProducts);
      setCustomers(fetchedCustomers.sort((a,b) => a.name.localeCompare(b.name)));
      setStoreSettings(fetchedStoreSettings || DEFAULT_STORE_SETTINGS);
      setActivePromotions(fetchedActivePromotions);
      setExchangeRates(fetchedExchangeRates);
      if (fetchedExchangeRates && fetchedExchangeRates.vatRate !== undefined) {
        setEditableVatRate(fetchedExchangeRates.vatRate);
      }
    } catch (error) {
      console.error("Error fetching POS data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Effect to handle "Buy X Get Y Free" promotions
  useEffect(() => {
    const applyFreeProductPromotions = () => {
        if (activePromotions.length === 0 || allProductsDB.length === 0) return;

        const regularCartItems = cart.filter(item => !item.isFreeGift);
        const freeProductPromos = activePromotions.filter(p => p.promotionType === 'free_product');
        let newFreeItems: CartItem[] = [];
        let promoApplied = false;

        for (const promo of freeProductPromos) {
            if (!promo.productIds || !promo.quantityToBuy || !promo.freeProductId || !promo.quantityToGetFree) continue;

            const totalMainProductQty = regularCartItems
                .filter(item => promo.productIds.includes(item.id))
                .reduce((sum, item) => sum + item.quantityInCart, 0);

            if (totalMainProductQty > 0) {
                const numTimesTriggered = Math.floor(totalMainProductQty / promo.quantityToBuy);
                const totalFreeItemsQty = numTimesTriggered * promo.quantityToGetFree;

                if (totalFreeItemsQty > 0) {
                    const freeProduct = allProductsDB.find(p => p.id === promo.freeProductId);
                    if (freeProduct) {
                        const existingRegularItem = regularCartItems.find(item => item.id === freeProduct.id);
                        const stockReservedForRegularPurchase = existingRegularItem?.quantityInCart || 0;
                        const availableStockForGift = freeProduct.stock - stockReservedForRegularPurchase;

                        const actualFreeQty = Math.min(totalFreeItemsQty, availableStockForGift);
                        
                        if (actualFreeQty > 0) {
                            newFreeItems.push({
                                ...freeProduct,
                                quantityInCart: actualFreeQty,
                                activeUnitPrice: 0,
                                itemDiscountType: 'none',
                                itemDiscountValue: 0,
                                unitPriceAfterDiscount: 0,
                                appliedPromotionId: promo.id,
                                isFreeGift: true,
                            });
                            promoApplied = true;
                        }
                    }
                }
            }
        }
        
        const finalCart = [...regularCartItems, ...newFreeItems];
        if (JSON.stringify(finalCart) !== JSON.stringify(cart)) {
            setCart(finalCart);
        }
    };

    applyFreeProductPromotions();
  // We stringify cart to prevent deep comparison loops, but it's a signal to re-evaluate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cart.filter(i => !i.isFreeGift)), activePromotions, allProductsDB]);


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

  const previewData = useMemo((): ReceiptData => {
    const subtotal = cart.reduce((acc, item) => acc + item.activeUnitPrice * item.quantityInCart, 0);
    const discount = 0; // Preview doesn't include checkout modal discount
    const subtotalAfterDiscount = subtotal - discount;
    const vat = subtotalAfterDiscount * (editableVatRate / 100);
    const grandTotal = subtotalAfterDiscount + vat;

    return {
        receiptNumber: 'PREVIEW-12345',
        transactionDate: new Date().toISOString(),
        customerName: selectedCustomerDetails?.name || t('walkInCustomer'),
        items: cart.map(item => ({
            productName: item.name,
            quantity: item.quantityInCart,
            unitPrice: item.activeUnitPrice,
            totalPrice: item.activeUnitPrice * item.quantityInCart,
        })),
        subtotal: subtotal,
        discount: discount,
        vat: vat,
        vatRate: editableVatRate,
        grandTotal: grandTotal,
        notes: '',
        footerNote: storeSettings.footerNote,
        paymentMethod: modalPaymentMethod,
    };
  }, [cart, editableVatRate, selectedCustomerDetails, t, storeSettings, modalPaymentMethod]);

  const addToCart = useCallback((product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id && !item.isFreeGift); // Only target non-free items
      if (existingItem) {
        if (existingItem.quantityInCart < product.stock) {
          return prevCart.map(item => item.id === product.id && !item.isFreeGift ? { ...item, quantityInCart: item.quantityInCart + 1 } : item);
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
             isFreeGift: false,
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
      const itemToUpdate = prevCart.find(item => item.id === productId && !item.isFreeGift);
      if (!itemToUpdate) return prevCart;
      
      const newQuantity = itemToUpdate.quantityInCart + change;

      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== productId || item.isFreeGift);
      }
      if (newQuantity > itemToUpdate.stock) {
        Swal.fire({ title: t('notEnoughStock'), text: `${t('stockAvailable')}: ${itemToUpdate.stock}`, icon: 'warning', timer: 2000 });
        return prevCart;
      }
      return prevCart.map(item => item.id === productId && !item.isFreeGift ? { ...item, quantityInCart: newQuantity } : item);
    });
  };

  const handleSetCartItemQuantity = (productId: string, value: string) => {
    setCart(prevCart => {
        const newQuantity = parseInt(value, 10);
        
        const itemToUpdate = prevCart.find(item => item.id === productId && !item.isFreeGift);
        if (!itemToUpdate) return prevCart;

        if (value === '') {
            return prevCart.map(item => item.id === productId && !item.isFreeGift ? { ...item, quantityInCart: 0 } : item);
        }

        if (isNaN(newQuantity) || newQuantity < 0) {
            return prevCart;
        }

        if (newQuantity > itemToUpdate.stock) {
            Swal.fire({ title: t('notEnoughStock'), text: `${t('stockAvailable')}: ${itemToUpdate.stock}`, icon: 'warning', timer: 2000 });
            return prevCart.map(item => item.id === productId && !item.isFreeGift ? { ...item, quantityInCart: itemToUpdate.stock } : item);
        }
        
        return prevCart.map(item => item.id === productId && !item.isFreeGift ? { ...item, quantityInCart: newQuantity } : item);
    });
  };

  const handleQuantityInputBlur = (productId: string) => {
    setCart(prevCart => {
        const itemToUpdate = prevCart.find(item => item.id === productId && !item.isFreeGift);
        if (!itemToUpdate) return prevCart;

        if (itemToUpdate.quantityInCart <= 0) {
            return prevCart.filter(item => item.id !== productId || item.isFreeGift);
        }
        return prevCart;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId || item.isFreeGift));
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
  
  const handleOpenPreview = () => {
    if (cart.length === 0) {
      Swal.fire(t('cartIsEmpty'), '', 'warning');
      return;
    }
    setIsPreviewModalOpen(true);
  };

  const handleApplyPromotions = () => {
    if (activePromotions.length === 0 || cart.length === 0) return;

    let promotionsApplied = false;
    const newCart = cart.map(cartItem => {
        if (cartItem.appliedPromotionId || cartItem.isFreeGift) {
            return cartItem;
        }

        const applicablePromotion = activePromotions.find(promo => promo.promotionType === 'discount' && promo.productIds.includes(cartItem.id));

        if (applicablePromotion) {
            promotionsApplied = true;
            const originalPrice = cartItem.sellingPrice;
            let newPrice = originalPrice;

            if (applicablePromotion.discountType === 'percent') {
                newPrice = originalPrice * (1 - (applicablePromotion.discountValue || 0) / 100);
            } else {
                newPrice = originalPrice - (applicablePromotion.discountValue || 0);
            }

            newPrice = Math.max(0, newPrice);

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

  const handlePrintReceipt = useCallback((saleToPrint: Sale) => {
    const printAreaContainer = document.getElementById('receipt-print-area-wrapper');
    if (!printAreaContainer) {
        console.error("Receipt print area not found");
        return;
    }

    if (!receiptPrintAreaRootRef.current) {
        receiptPrintAreaRootRef.current = createRoot(printAreaContainer);
    }
    
    const totalDiscount = (saleToPrint.totalCartItemDiscountAmount || 0) + (saleToPrint.overallSaleDiscountAmountCalculated || 0);

    const receiptData: ReceiptData = {
        receiptNumber: saleToPrint.receiptNumber,
        transactionDate: saleToPrint.transactionDate,
        customerName: saleToPrint.customerName,
        items: saleToPrint.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPriceAfterItemDiscount, totalPrice: i.totalPrice })),
        subtotal: saleToPrint.totalCartOriginalPrice,
        discount: totalDiscount,
        vat: saleToPrint.vatAmountFromEditableRate,
        vatRate: editableVatRate,
        grandTotal: saleToPrint.grandTotal,
        notes: saleToPrint.notes,
        footerNote: storeSettings.footerNote,
        changeGiven: saleToPrint.changeGiven,
        receivedAmount: saleToPrint.receivedAmount,
        paymentMethod: saleToPrint.paymentMethod
    };
    
    receiptPrintAreaRootRef.current.render(
        <PrintableReceipt
            data={receiptData}
            settings={storeSettings}
            exchangeRates={exchangeRates}
            t={t}
            formatCurrency={formatCurrency}
        />
    );

    setTimeout(() => {
        document.body.classList.add('printing-receipt');
        const cleanup = () => {
            document.body.classList.remove('printing-receipt');
            window.removeEventListener('afterprint', cleanup);
            receiptPrintAreaRootRef.current?.render(null);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
    }, 500);
  }, [storeSettings, t, formatCurrency, editableVatRate, exchangeRates]);
  
  const handleProcessSale = async () => {
    if (!currentUser) {
        Swal.fire(t('error'), 'Current user not found.', 'error');
        return;
    }
    setIsProcessingSale(true);

    const totalOriginalPrice = cart.reduce((acc, item) => {
        if (item.isFreeGift) return acc;
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
        isFreeGift: item.isFreeGift || false,
        ...(item.appliedPromotionId && { appliedPromotionId: item.appliedPromotionId }),
    }));
    
    const saleData: Omit<Sale, 'id' | 'receiptNumber'> = {
        items: saleTransactionItems,
        customerId: selectedCustomerDetails?.id,
        customerName: selectedCustomerDetails?.name || t('walkInCustomer'),
        customerType: selectedCustomerDetails?.customerType || 'cash',
        transactionDate: new Date().toISOString(),
        // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
        userId: currentUser.uid,
        salespersonName: currentUser.email,
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
        const expenseCategoryText = t('sellingExpenseForPromo');
        const expenseDescriptionTemplate = t('sellingExpenseForPromoDesc');
        const sellingAccountingCategoryName = t('accountingCategory_selling');
        // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
        const savedSale = await addSale(saleData, expenseCategoryText, expenseDescriptionTemplate, sellingAccountingCategoryName, currentUser.uid, currentUser.email);
        
        handlePrintReceipt(savedSale);
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: t('saleSuccess'),
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
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
    if (item.isFreeGift) return; // Cannot change price of free item
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
                            <tr key={item.id + (item.isFreeGift ? '-free' : '')} className={`border-t ${!item.isFreeGift && 'hover:bg-slate-50 cursor-pointer'}`} onDoubleClick={() => handleCartItemDoubleClick(item)}>
                                <td className="p-2 font-semibold text-gray-800">
                                    {item.name}
                                    {item.appliedPromotionId && !item.isFreeGift && (
                                        <div className="text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full inline-block ml-2">
                                            {t('promotionApplied')}
                                        </div>
                                    )}
                                    {item.isFreeGift && (
                                        <div className="text-xs font-normal text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded-full inline-block ml-2">
                                            {t('freeGiftLabel')}
                                        </div>
                                    )}
                                </td>
                                <td className="p-2">
                                    <div className="flex items-center justify-center gap-1">
                                        {!item.isFreeGift ? (
                                        <>
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
                                        </>
                                        ) : (
                                            <span className="font-medium">{item.quantityInCart}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-2 text-right text-gray-600">
                                    {item.appliedPromotionId && item.originalUnitPriceBeforePromo != null && !item.isFreeGift && (
                                        <span className="line-through text-red-500 mr-1">
                                            {formatCurrency(item.originalUnitPriceBeforePromo)}
                                        </span>
                                    )}
                                    {formatCurrency(item.activeUnitPrice)}
                                </td>
                                <td className="p-2 text-right font-semibold text-gray-800">{formatCurrency(item.activeUnitPrice * item.quantityInCart)}</td>
                                <td className="p-2 text-center">
                                    {!item.isFreeGift && <Button onClick={() => removeFromCart(item.id)} size="sm" variant="ghost" className="text-red-500 hover:bg-red-100 p-1"><TrashIcon/></Button>}
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
                        <span className="text-gray-900">{t('grandTotal')}:</span>
                        <span className="text-red-600">{formatCurrency(cartGrandTotal)} {currencySymbol}</span>
                    </div>
                </div>
                <div className="mt-auto pt-4 space-y-2">
                    <Button onClick={handleApplyPromotions} variant="secondary" className="w-full h-12 text-lg bg-yellow-500 hover:bg-yellow-600">
                        <PromotionIcon /> {t('applyPromotions')}
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={handleOpenPreview} variant="outline" className="w-1/2 h-14 text-lg">
                            {t('printPreview')}
                        </Button>
                        <Button onClick={handleOpenCheckout} className="w-1/2 h-14 text-xl bg-green-600 hover:bg-green-700">{t('checkout')}</Button>
                    </div>
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

        {isPreviewModalOpen && (
            <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title={t('printPreview')}>
                <PrintableReceipt
                    data={previewData}
                    settings={storeSettings}
                    exchangeRates={exchangeRates}
                    t={t}
                    formatCurrency={formatCurrency}
                />
            </Modal>
        )}

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
                            <span className="text-gray-900">{t('modalGrandTotal')}:</span>
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
