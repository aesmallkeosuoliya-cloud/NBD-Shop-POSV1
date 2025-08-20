import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Product, StoreSettings } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getProducts, getStoreSettings } from '../../services/firebaseService';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { DEFAULT_STORE_SETTINGS } from '../../constants';

declare var JsBarcode: any;
declare var Swal: any;

// --- TYPE DEFINITIONS ---
interface PrintQueueItem extends Product {
    quantityToPrint: number;
}

type BarcodeLabelPart = 'StoreName' | 'ProductName' | 'Price' | 'Date' | 'BarcodeValue';

interface PrintOptions {
    showStoreName: boolean;
    boldStoreName: boolean;
    spacingStoreName: number;
    showProductName: boolean;
    boldProductName: boolean;
    spacingProductName: number;
    showPrice: boolean;
    boldPrice: boolean;
    spacingPrice: number;
    showDate: boolean;
    boldDate: boolean;
    spacingDate: number;
    showBarcodeValue: boolean;
    boldBarcodeValue: boolean;
    spacingBarcodeValue: number;
    barcodeHeight: number;
    barcodeWidth: number;
    fontSizeStoreName: number;
    fontSizeProductName: number;
    fontSizePrice: number;
    fontSizeDate: number;
    fontSizeBarcodeValue: number;
}

// --- CONSTANTS & HELPERS ---
const BARCODE_PRINT_OPTIONS_KEY = 'nbdPosBarcodePrintOptions';

const defaultPrintOptions: PrintOptions = {
    showStoreName: false,
    boldStoreName: false,
    spacingStoreName: 2,
    showProductName: true,
    boldProductName: true,
    spacingProductName: 2,
    showPrice: true,
    boldPrice: true,
    spacingPrice: 3,
    showDate: true,
    boldDate: false,
    spacingDate: 1,
    showBarcodeValue: true,
    boldBarcodeValue: false,
    spacingBarcodeValue: 1,
    barcodeHeight: 40,
    barcodeWidth: 2,
    fontSizeStoreName: 10,
    fontSizeProductName: 14,
    fontSizePrice: 16,
    fontSizeDate: 8,
    fontSizeBarcodeValue: 8,
};

const loadOptionsFromStorage = (): PrintOptions => {
    try {
        const savedOptions = localStorage.getItem(BARCODE_PRINT_OPTIONS_KEY);
        if (savedOptions) {
            // Merge with defaults to ensure any new properties are included
            return { ...defaultPrintOptions, ...JSON.parse(savedOptions) };
        }
    } catch (error) {
        console.error("Failed to load barcode print options from storage", error);
    }
    return defaultPrintOptions;
};


// --- CHILD COMPONENTS ---

const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const ProductSelectionForBarcodeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    availableProducts: Product[];
    initialSelectedIds: Set<string>;
    onConfirm: (selectedIds: Set<string>) => void;
    isLoading?: boolean;
}> = ({ isOpen, onClose, availableProducts, initialSelectedIds, onConfirm, isLoading = false }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelectedIds);
    const localeForFormatting = t('language') === 'lo' ? 'lo-LA' : 'th-TH';
    const formatCurrency = (value: number) => value.toLocaleString(localeForFormatting, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    useEffect(() => {
        if (isOpen) setSelectedIds(new Set(initialSelectedIds));
    }, [isOpen, initialSelectedIds]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return availableProducts;
        const lower = searchTerm.toLowerCase();
        return availableProducts.filter(p => p.name.toLowerCase().includes(lower) || p.id.toLowerCase().includes(lower) || p.barcode?.toLowerCase().includes(lower));
    }, [searchTerm, availableProducts]);

    const handleToggleProduct = (productId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) newSet.delete(productId);
            else newSet.add(productId);
            return newSet;
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('barcodeV2_selectProductTitle')} size="lg" footer={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={() => onConfirm(selectedIds)}>{t('barcodeV2_addSelected')}</Button></>}>
            <div className="relative mb-3">
                <Input placeholder={t('barcodeV2_searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" wrapperClassName="mb-0"/>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <LoadingSpinner text={t('loading')} />
                    </div>
                ) : (
                    availableProducts.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0"><tr><th className="w-10"></th><th>{t('barcodeV2_productTable_name')}</th><th>{t('barcodeV2_productTable_code')}</th><th>{t('barcodeV2_productTable_barcode')}</th><th className="text-right">{t('barcodeV2_productTable_price')}</th></tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredProducts.map(p => <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleToggleProduct(p.id)}>
                                    <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.has(p.id)} readOnly className="h-4 w-4 text-purple-600 rounded" /></td>
                                    <td className="p-2 font-medium">{p.name}</td><td>{p.id.slice(-6)}</td><td>{p.barcode}</td><td className="text-right">{formatCurrency(p.sellingPrice)}</td>
                                </tr>)}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-gray-500 py-6 text-sm">{t('noDataFound')}</p>
                    )
                )}
            </div>
        </Modal>
    );
};

// --- MAIN COMPONENT ---
const BarcodePrintPage: React.FC = () => {
    const { t, language } = useLanguage();
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
    const [printOptions, setPrintOptions] = useState<PrintOptions>(loadOptionsFromStorage);
    const printAreaRootRef = useRef<Root | null>(null);

    const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
    const currencyDisplay = t('currencyKip'); 
    const formatCurrency = (value: number) => value.toLocaleString(localeForFormatting, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [products, settings] = await Promise.all([getProducts(), getStoreSettings()]);
                setAllProducts(products.filter(p => p.barcode).sort((a,b) => a.name.localeCompare(b.name)));
                setStoreSettings(settings || DEFAULT_STORE_SETTINGS);
            } catch (error) {
                console.error("Error fetching data:", error);
                Swal.fire(t('error'), t('errorFetchingData'), 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [t]);
    
    const handleConfirmProductSelection = (confirmedIds: Set<string>) => {
        const newQueue: PrintQueueItem[] = [];
        confirmedIds.forEach(productId => {
            const existingItem = printQueue.find(item => item.id === productId);
            if (existingItem) {
                newQueue.push(existingItem);
            } else {
                const productToAdd = allProducts.find(p => p.id === productId);
                if (productToAdd) {
                    newQueue.push({ ...productToAdd, quantityToPrint: 5 });
                }
            }
        });
        setPrintQueue(newQueue.sort((a,b) => a.name.localeCompare(b.name)));
        setIsProductModalOpen(false);
    };

    const updateQueueItemQuantity = (productId: string, quantity: number) => {
        setPrintQueue(prev => prev.map(item => item.id === productId ? { ...item, quantityToPrint: Math.max(0, quantity) } : item));
    };

    const handleRemoveFromQueue = (productId: string) => {
        setPrintQueue(prev => prev.filter(item => item.id !== productId));
    };

    const handlePrintOptionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setPrintOptions(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : Number(value) }));
    };

    const handleSaveSettings = () => {
        try {
            localStorage.setItem(BARCODE_PRINT_OPTIONS_KEY, JSON.stringify(printOptions));
            Swal.fire({
                icon: 'success',
                title: t('saveSuccess'),
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
            });
        } catch (error) {
            console.error("Failed to save barcode print options to storage", error);
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        }
    };

    const handlePrint = () => {
        if (printQueue.length === 0 || printQueue.every(i => i.quantityToPrint === 0)) {
            Swal.fire(t('error'), t('barcodeV2_queueEmpty'), 'warning');
            return;
        }
    
        const printAreaContainer = document.getElementById('barcode-print-area-wrapper');
        if (!printAreaContainer) {
            console.error("Print area wrapper not found");
            return;
        }
    
        if (typeof JsBarcode === 'undefined') {
            console.error("JsBarcode library not loaded");
            return;
        }
    
        const dateToPrint = new Date().toLocaleDateString(localeForFormatting);
    
        const PrintableContent = () => {
            const labels = printQueue.flatMap(item => Array.from({ length: item.quantityToPrint }, (_, i) => ({ ...item, uniqueId: `print-${item.id}-${i}` })));
            
            useEffect(() => {
                labels.forEach(label => {
                    const el = document.getElementById(`barcode-${label.uniqueId}`);
                    if (el && label.barcode) {
                        try {
                            JsBarcode(el, label.barcode, {
                                format: "CODE128",
                                width: printOptions.barcodeWidth,
                                height: printOptions.barcodeHeight,
                                displayValue: false,
                                margin: 0,
                                marginTop: 0,
                                marginBottom: 0
                            });
                        } catch(e) { console.error(`Failed to generate barcode for ${label.barcode}`, e); }
                    }
                });
            }, [labels, printOptions]);
    
            return <div id="barcode-print-area">{labels.map(label => (
                <div key={label.uniqueId} className="barcode-label-print">
                    {printOptions.showStoreName && <div className="label-store-name" style={{fontSize: `${printOptions.fontSizeStoreName}px`, fontWeight: printOptions.boldStoreName ? 'bold' : 'normal', marginBottom: `${printOptions.spacingStoreName}px`}}>{storeSettings.storeName}</div>}
                    {printOptions.showProductName && <div className="label-product-name" style={{fontSize: `${printOptions.fontSizeProductName}px`, fontWeight: printOptions.boldProductName ? 'bold' : 'normal', marginBottom: `${printOptions.spacingProductName}px`}}>{label.name}</div>}
                    <svg id={`barcode-${label.uniqueId}`}></svg>
                    {printOptions.showBarcodeValue && <div className="label-barcode-value" style={{fontSize: `${printOptions.fontSizeBarcodeValue}px`, fontWeight: printOptions.boldBarcodeValue ? 'bold' : 'normal', marginTop: `${printOptions.spacingBarcodeValue}px`}}>{label.barcode}</div>}
                    {printOptions.showDate && <div className="label-date" style={{fontSize: `${printOptions.fontSizeDate}px`, fontWeight: printOptions.boldDate ? 'bold' : 'normal', marginTop: `${printOptions.spacingDate}px`}}>{dateToPrint}</div>}
                    {printOptions.showPrice && <div className="label-price" style={{fontSize: `${printOptions.fontSizePrice}px`, fontWeight: printOptions.boldPrice ? 'bold' : 'normal', marginTop: `${printOptions.spacingPrice}px`}}>{formatCurrency(label.sellingPrice)} {currencyDisplay}</div>}
                </div>
            ))}</div>
        };
        
        if (!printAreaRootRef.current) {
            printAreaRootRef.current = createRoot(printAreaContainer);
        }
        printAreaRootRef.current.render(<PrintableContent />);
    
        setTimeout(() => {
            document.body.classList.add('printing-barcodes');
    
            const cleanup = () => {
                document.body.classList.remove('printing-barcodes');
                window.removeEventListener('afterprint', cleanup);
                if (printAreaRootRef.current) {
                    printAreaRootRef.current.render(null); // Cleanup
                }
            };
            window.addEventListener('afterprint', cleanup);
            
            window.print();
        }, 500); // Add delay to ensure content is rendered.
    };
    
    const previewItem = printQueue.find(i => i.quantityToPrint > 0) || null;
    useEffect(() => {
        if (previewItem && previewItem.barcode) {
             const previewElement = document.getElementById(`barcode-preview-svg`);
             if(previewElement) {
                try {
                    JsBarcode(previewElement, previewItem.barcode, {
                        format: "CODE128",
                        width: printOptions.barcodeWidth,
                        height: printOptions.barcodeHeight,
                        displayValue: false,
                        margin: 0,
                        marginTop: 0,
                        marginBottom: 0
                    });
                } catch (e) { console.error("Failed to generate preview barcode", e); }
             }
        }
    }, [previewItem, printOptions]);

    const SettingsRow: React.FC<{ name: BarcodeLabelPart, label: string }> = ({ name, label }) => {
      const showKey = `show${name}` as keyof PrintOptions;
      const boldKey = `bold${name}` as keyof PrintOptions;
      const spacingKey = `spacing${name}` as keyof PrintOptions;
      const fontKey = `fontSize${name}` as keyof PrintOptions;
      
      const fontLabelKey = useMemo(() => {
        switch (name) {
            case 'StoreName': return 'barcodeV2_fontSizeStore';
            case 'ProductName': return 'barcodeV2_fontSizeName';
            case 'Price': return 'barcodeV2_fontSizePrice';
            case 'Date': return 'barcodeV2_fontSizeDate';
            case 'BarcodeValue': return 'barcodeV2_fontSizeBarcode';
        }
      }, [name]);

      return (
        <div className="p-3 border-b last:border-b-0">
            <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-800">
                    <input type="checkbox" name={showKey} checked={printOptions[showKey] as boolean} onChange={handlePrintOptionsChange} className="h-4 w-4 mr-2 text-purple-600 rounded"/>
                    {label}
                </label>
                <label className="flex items-center text-sm text-gray-600">
                    <input type="checkbox" name={boldKey} checked={printOptions[boldKey] as boolean} onChange={handlePrintOptionsChange} className="h-4 w-4 mr-2 text-purple-600 rounded"/>
                    {t('barcodeV2_bold')}
                </label>
            </div>
            <div className="grid grid-cols-2 gap-x-4 mt-2">
                 <div><label className="block text-xs text-gray-500">{t('barcodeV2_spacing')}: {printOptions[spacingKey]}px</label><input type="range" name={spacingKey} min="0" max="40" value={printOptions[spacingKey] as number} onChange={handlePrintOptionsChange} className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer"/></div>
                 <div><label className="block text-xs text-gray-500">{t(fontLabelKey!)}: {printOptions[fontKey]}px</label><input type="range" name={fontKey} min="5" max="50" value={printOptions[fontKey] as number} onChange={handlePrintOptionsChange} className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer"/></div>
            </div>
        </div>
      );
    };

    return (
        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50 min-h-full no-print">
            {/* Left Panel */}
            <Card 
                title={t('barcodeV2_pageTitle')} 
                bodyClassName="p-0 flex flex-col"
                footer={
                    <div className="flex justify-end">
                        <Button onClick={handleSaveSettings} variant="primary">
                            {t('saveSettingsButton')}
                        </Button>
                    </div>
                }
            >
                <div className="p-4 border-b">
                    <Button onClick={() => setIsProductModalOpen(true)} className="w-full h-11 text-base">{t('barcodeV2_addProduct')}</Button>
                </div>
                <div className="overflow-y-auto">
                    <SettingsRow name="StoreName" label={t('showStoreName')} />
                    <SettingsRow name="ProductName" label={t('showProductName')} />
                    <SettingsRow name="Price" label={t('showPrice')} />
                    <SettingsRow name="Date" label={t('showDate')} />
                    <SettingsRow name="BarcodeValue" label={t('showBarcodeValue')} />
                    <div className="p-3 border-b last:border-b-0 grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-800">{t('barcodeV2_barcodeHeight')}: {printOptions.barcodeHeight}</label><input type="range" name="barcodeHeight" min="20" max="100" value={printOptions.barcodeHeight} onChange={handlePrintOptionsChange} className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer"/></div>
                        <div><label className="block text-sm font-medium text-gray-800">{t('barcodeV2_barcodeThickness')}: {printOptions.barcodeWidth}</label><input type="range" name="barcodeWidth" min="1" max="12" value={printOptions.barcodeWidth} onChange={handlePrintOptionsChange} className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer"/></div>
                    </div>
                </div>
            </Card>
            
            {/* Right Panel */}
            <div className="space-y-6 flex flex-col">
                 <Card 
                    title={t('barcodeV2_printQueue')} 
                    bodyClassName="p-0 flex-grow flex flex-col"
                    titleActions={
                        <Button onClick={handlePrint} leftIcon={<PrintIcon/>} className="bg-blue-600 hover:bg-blue-700" size="md">
                            {t('barcodeV2_print')}
                        </Button>
                    }
                >
                    <div className="flex-grow overflow-y-auto">
                        {printQueue.length === 0 ? <p className="p-4 text-center text-gray-500">{t('barcodeV2_queueEmpty')}</p> :
                        <table className="w-full text-sm">
                            <tbody>
                                {printQueue.map(item => (
                                    <tr key={item.id} className="border-b last:border-b-0">
                                        <td className="p-2 font-medium">{item.name}</td>
                                        <td className="p-2"><Input type="number" value={item.quantityToPrint} onChange={(e) => updateQueueItemQuantity(item.id, parseInt(e.target.value, 10) || 0)} className="w-20 h-8 text-center" wrapperClassName="mb-0"/></td>
                                        <td className="p-2 text-right"><Button variant="ghost" onClick={() => handleRemoveFromQueue(item.id)} className="text-red-500 hover:bg-red-100 p-1"><TrashIcon/></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>}
                    </div>
                </Card>
                <Card title={t('barcodeV2_preview')} className="flex-shrink-0">
                    <div className="p-4 border rounded-md bg-gray-100 min-h-[200px] flex justify-center items-center">
                        {previewItem ? (
                            <div className="bg-white p-2 border text-center shadow-md text-black">
                                {printOptions.showStoreName && <div style={{fontSize: `${printOptions.fontSizeStoreName}px`, fontWeight: printOptions.boldStoreName ? 'bold' : 'normal', marginBottom: `${printOptions.spacingStoreName}px`}}>{storeSettings.storeName}</div>}
                                {printOptions.showProductName && <div style={{fontSize: `${printOptions.fontSizeProductName}px`, fontWeight: printOptions.boldProductName ? 'bold' : 'normal', marginBottom: `${printOptions.spacingProductName}px`}} className="max-w-[150px] truncate mx-auto">{previewItem.name}</div>}
                                <svg id="barcode-preview-svg"></svg>
                                {printOptions.showBarcodeValue && <div style={{fontSize: `${printOptions.fontSizeBarcodeValue}px`, fontWeight: printOptions.boldBarcodeValue ? 'bold' : 'normal', marginTop: `${printOptions.spacingBarcodeValue}px`}}>{previewItem.barcode}</div>}
                                {printOptions.showDate && <div style={{fontSize: `${printOptions.fontSizeDate}px`, fontWeight: printOptions.boldDate ? 'bold' : 'normal', marginTop: `${printOptions.spacingDate}px`}}>{new Date().toLocaleDateString(localeForFormatting)}</div>}
                                {printOptions.showPrice && <div style={{fontSize: `${printOptions.fontSizePrice}px`, fontWeight: printOptions.boldPrice ? 'bold' : 'normal', marginTop: `${printOptions.spacingPrice}px`}}>{formatCurrency(previewItem.sellingPrice)} {currencyDisplay}</div>}
                            </div>
                        ) : (<div className="text-center text-gray-500">{t('barcodeV2_previewEmpty')}</div>)}
                    </div>
                </Card>
            </div>

            <ProductSelectionForBarcodeModal 
                isOpen={isProductModalOpen} 
                onClose={() => setIsProductModalOpen(false)}
                availableProducts={allProducts}
                initialSelectedIds={new Set(printQueue.map(p => p.id))}
                onConfirm={handleConfirmProductSelection}
                isLoading={isLoading}
            />
        </div>
    );
};

export default BarcodePrintPage;