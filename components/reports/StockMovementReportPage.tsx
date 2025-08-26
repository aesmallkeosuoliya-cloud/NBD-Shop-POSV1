
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Product, ProductMovementLog, ProductMovementLogType, StoreSettings } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getProducts, getProductMovementLogs, getStoreSettings } from '../../services/firebaseService';
import { DEFAULT_STORE_SETTINGS } from '../../constants';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

// --- Printable Component ---
const PrintableStockMovementReport: React.FC<{
    reportData: ProductMovementLog[];
    selectedProduct: Product;
    storeSettings: StoreSettings;
    startDate: string;
    endDate: string;
    t: (key: string) => string;
    formatDate: (isoDate: string, options?: Intl.DateTimeFormatOptions) => string;
    getLogTypeTranslation: (type: ProductMovementLogType) => string;
}> = ({ reportData, selectedProduct, storeSettings, startDate, endDate, t, formatDate, getLogTypeTranslation }) => {
    return (
        <div className="stock-movement-print-container">
            <header className="stock-movement-print-header">
                <h2>{storeSettings.storeName}</h2>
                <p>{storeSettings.address}</p>
                <p>{t('phoneLabel')}: {storeSettings.phone}</p>
                {storeSettings.taxId && <p>{t('taxIdLabel')}: {storeSettings.taxId}</p>}
            </header>
            
            <h1 className="stock-movement-print-title">{selectedProduct.name}</h1>
            
            <table className="stock-movement-print-table">
                <thead>
                    <tr>
                        <th>{t('tableColDocDate')}</th>
                        <th>{t('tableColDocType')}</th>
                        <th>{t('docNo')}</th>
                        <th>{t('taxInvoiceNo')}</th>
                        <th style={{ textAlign: 'right' }}>{t('tableColQtyIn')}</th>
                        <th style={{ textAlign: 'right' }}>{t('tableColQtyOut')}</th>
                        <th style={{ textAlign: 'right' }}>{t('tableColBalance')}</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map(log => {
                        const isStockIn = log.quantityChange > 0;
                        return (
                            <tr key={log.id}>
                                <td>{formatDate(log.timestamp, { year: '2-digit', month: 'short', day: 'numeric' })}</td>
                                <td>{getLogTypeTranslation(log.type)}</td>
                                <td>{log.relatedDocumentId?.slice(-8) || '-'}</td>
                                <td>-</td>
                                <td style={{ textAlign: 'right' }}>{isStockIn ? log.quantityChange.toFixed(2) : '-'}</td>
                                <td style={{ textAlign: 'right' }}>{!isStockIn ? Math.abs(log.quantityChange).toFixed(2) : '-'}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{log.stockAfter.toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <footer className="stock-movement-print-footer">
                <p>{t('stockMovementReportPageTitle')}</p>
                <p>{t('from')} {formatDate(startDate)} {t('to')} {formatDate(endDate)}</p>
            </footer>
        </div>
    );
};


const StockMovementReportPage: React.FC = () => {
    // Hooks and State
    const { t, language } = useLanguage();
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [productCategories, setProductCategories] = useState<string[]>([]);
    const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    // Filter State
    const [productNameFilter, setProductNameFilter] = useState('');
    const [productCodeFilter, setProductCodeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    
    // Selection and Report State
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [reportData, setReportData] = useState<ProductMovementLog[]>([]);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [startDate, setStartDate] = useState(() => new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const printAreaRootRef = useRef<Root | null>(null);

    // Data fetching
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [products, settings] = await Promise.all([getProducts(), getStoreSettings()]);
                setAllProducts(products);
                setStoreSettings(settings || DEFAULT_STORE_SETTINGS);
                const categories = Array.from(new Set(products.map(p => p.category))).sort();
                setProductCategories(categories);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Memoized filtered product list for selection
    const filteredProductList = useMemo(() => {
        return allProducts.filter(p => {
            const nameMatch = productNameFilter ? (p.name || '').toLowerCase().includes(productNameFilter.toLowerCase()) : true;
            const codeMatch = productCodeFilter ? (p.id || '').toLowerCase().includes(productCodeFilter.toLowerCase()) : true;
            const categoryMatch = categoryFilter !== 'all' ? p.category === categoryFilter : true;
            return nameMatch && codeMatch && categoryMatch;
        });
    }, [allProducts, productNameFilter, productCodeFilter, categoryFilter]);
    
    // Handlers
    const handleGenerateReport = async () => {
        if (!selectedProductId) {
            // Using Swal from global scope
            (window as any).Swal.fire(t('error'), t('selectProductForReport'), 'warning');
            return;
        }
        setIsReportLoading(true);
        try {
            const logs = await getProductMovementLogs(selectedProductId);
            const filteredLogs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= new Date(startDate) && logDate <= new Date(endDate + 'T23:59:59.999Z');
            });
            setReportData(filteredLogs);
        } catch (error) {
            console.error("Failed to generate report:", error);
             (window as any).Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setIsReportLoading(false);
        }
    };
    
    const selectedProduct = useMemo(() => allProducts.find(p => p.id === selectedProductId), [selectedProductId, allProducts]);
    const localeForFormatting = language === 'lo' ? 'lo-LA' : 'th-TH';
    const formatCurrency = (value: number) => value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatDate = (isoDate: string, options?: Intl.DateTimeFormatOptions) => {
        const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(isoDate).toLocaleString(localeForFormatting, options || defaultOptions);
    };

    const getLogTypeTranslation = (type: ProductMovementLogType) => {
      // Re-using existing keys from product history
      const key = `logType_${type}`;
      const translated = t(key);
      // Fallback if key doesn't exist
      return translated === key ? type : translated;
    }

    const handlePrint = () => {
        if (reportData.length === 0 || !selectedProduct) {
            (window as any).Swal.fire(t('error'), t('noDataFound'), 'warning');
            return;
        }

        const printAreaContainer = document.getElementById('stock-movement-print-area-wrapper');
        if (!printAreaContainer) {
            console.error("Print area wrapper not found");
            return;
        }

        if (!printAreaRootRef.current) {
            printAreaRootRef.current = createRoot(printAreaContainer);
        }
        
        printAreaRootRef.current.render(
            <PrintableStockMovementReport
                reportData={reportData}
                selectedProduct={selectedProduct}
                storeSettings={storeSettings}
                startDate={startDate}
                endDate={endDate}
                t={t}
                formatDate={formatDate}
                getLogTypeTranslation={getLogTypeTranslation}
            />
        );

        setTimeout(() => {
            document.body.classList.add('printing-stock-movement');
            const cleanup = () => {
                document.body.classList.remove('printing-stock-movement');
                window.removeEventListener('afterprint', cleanup);
                if (printAreaRootRef.current) {
                    printAreaRootRef.current.render(null); // Unmount component
                }
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 500); // Delay to ensure rendering
    };


    // Render
    return (
        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 min-h-full print:block">
            {/* --- Left Panel: Filters --- */}
            <div className="lg:col-span-1 space-y-4 no-print">
                <Card title={t('search')}>
                    <Input label={t('filterByProductName')} value={productNameFilter} onChange={e => setProductNameFilter(e.target.value)} />
                    <Input label={t('filterByProductCode')} value={productCodeFilter} onChange={e => setProductCodeFilter(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('productCategory')}</label>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm h-11">
                            <option value="all">{t('all')}</option>
                            {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </Card>

                <Card title={t('productList')}>
                    {isLoading ? <LoadingSpinner /> : (
                        <div className="max-h-96 overflow-y-auto border rounded-md">
                            {filteredProductList.map(p => (
                                <div key={p.id} 
                                     onClick={() => setSelectedProductId(p.id)}
                                     className={`p-2 cursor-pointer border-b last:border-b-0 ${selectedProductId === p.id ? 'bg-purple-100' : 'hover:bg-gray-50'}`}>
                                    <p className="font-medium text-sm">{p.name}</p>
                                    <p className="text-xs text-gray-500">{t('productCode')}: {p.id.slice(-6)} | {t('stock')}: {p.stock}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
            
            {/* --- Right Panel: Report --- */}
            <div className="lg:col-span-2 space-y-4">
                <Card title={t('stockReport')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end no-print">
                        <Input label={t('dateRangeStart')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <Input label={t('dateRangeEnd')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="mt-4 flex justify-between items-center no-print">
                        <Button onClick={handleGenerateReport} variant="primary" isLoading={isReportLoading}>{t('generateReport')}</Button>
                        {reportData.length > 0 && <Button onClick={handlePrint} variant="secondary">{t('print')}</Button>}
                    </div>
                    
                    <div className="mt-6">
                        {selectedProduct && <h3 className="text-xl font-bold mb-2 text-center print-only">{t('stockReport')}</h3>}
                        {selectedProduct && <h3 className="text-lg font-semibold mb-4">{t('reportForProduct')}: {selectedProduct.name} ({selectedProduct.id.slice(-6)})</h3>}
                        
                        {isReportLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : reportData.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-2 py-2 text-left">{t('tableColItem')}</th>
                                            <th className="px-2 py-2 text-left">{t('tableColDocDate')}</th>
                                            <th className="px-2 py-2 text-left">{t('tableColDocType')}</th>
                                            <th className="px-2 py-2 text-left">{t('tableColDocId')}</th>
                                            <th className="px-2 py-2 text-right">{t('tableColQtyIn')}</th>
                                            <th className="px-2 py-2 text-right">{t('tableColQtyOut')}</th>
                                            <th className="px-2 py-2 text-right">{t('tableColBalance')}</th>
                                            <th className="px-2 py-2 text-right">{t('tableColUnitPrice')}</th>
                                            <th className="px-2 py-2 text-right">{t('tableColTotalValue')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {reportData.map((log, index) => {
                                            const isStockIn = log.quantityChange > 0;
                                            const unitPrice = isStockIn ? log.costPriceAfter : log.sellingPriceAfter;
                                            const totalValue = unitPrice ? Math.abs(log.quantityChange) * unitPrice : 0;
                                            return (
                                                <tr key={log.id}>
                                                    <td className="px-2 py-2">{index + 1}</td>
                                                    <td className="px-2 py-2 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                                                    <td className="px-2 py-2">{getLogTypeTranslation(log.type)}</td>
                                                    <td className="px-2 py-2">{log.relatedDocumentId?.slice(-8) || '-'}</td>
                                                    <td className="px-2 py-2 text-right text-green-600 font-medium">{isStockIn ? log.quantityChange : '-'}</td>
                                                    <td className="px-2 py-2 text-right text-red-600 font-medium">{!isStockIn ? Math.abs(log.quantityChange) : '-'}</td>
                                                    <td className="px-2 py-2 text-right font-bold">{log.stockAfter}</td>
                                                    <td className="px-2 py-2 text-right">{unitPrice ? formatCurrency(unitPrice) : '-'}</td>
                                                    <td className="px-2 py-2 text-right">{totalValue ? formatCurrency(totalValue) : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">{selectedProductId ? t('noDataFound') : t('selectProductForReport')}</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default StockMovementReportPage;
