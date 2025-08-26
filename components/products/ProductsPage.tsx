import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { Product, Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import ProductForm from './ProductForm';
import LoadingSpinner from '../common/LoadingSpinner';
import { addProduct, getProducts, updateProduct, deleteMultipleProducts, isFirebaseInitialized, getSuppliers, updateMultipleProductsStatus } from '../../services/firebaseService';
import Input from '../common/Input';
import { UI_COLORS, DEFAULT_PRODUCT_CATEGORIES } from '../../constants';
import Card from '../common/Card';

declare var Swal: any; // For SweetAlert2

// --- ICONS ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
const SortIcon: React.FC<{ direction?: 'ascending' | 'descending' }> = ({ direction }) => {
    if (!direction) return <svg className="h-4 w-4 text-gray-400 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (direction === 'ascending') return <svg className="h-4 w-4 text-gray-600 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="h-4 w-4 text-gray-600 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
};

// --- MAIN COMPONENT ---
const ProductsPage: React.FC = () => {
  const { t, language } = useLanguage(); 
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());
  const [allAvailableCategories, setAllAvailableCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [allAvailableProductTypes, setAllAvailableProductTypes] = useState<string[]>([]);
  const [allAvailableBrands, setAllAvailableBrands] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; targetRowData: Product | null; targetCellValue: any } | null>(null);
  
  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => (sessionStorage.getItem('productsPageCategoryFilter') || 'all'));
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(() => ((sessionStorage.getItem('productsPageStatusFilter') as 'all' | 'active' | 'inactive') || 'all'));
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | 'supplierName' | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });

  const isSalesRole = currentUser?.role === 'sales';
  const currencySymbol = useMemo(() => (language === 'lo' ? t('currencyKip') : t('currencyBaht')), [language, t]);

  const formatCurrency = useCallback((value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(language === 'lo' ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [language]);

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedSuppliers] = await Promise.all([getProducts(), getSuppliers()]);
      setProducts(fetchedProducts);
      setSuppliers(fetchedSuppliers);

      const supMap = new Map<string, string>();
      fetchedSuppliers.forEach(s => supMap.set(s.id, s.name));
      setSupplierMap(supMap);
      
      const uniqueCategories = Array.from(new Set(fetchedProducts.map(p => p.category).filter(Boolean) as string[]));
      setAllAvailableCategories(Array.from(new Set([...DEFAULT_PRODUCT_CATEGORIES, ...uniqueCategories])).sort());
      
      const uniqueTypes = Array.from(new Set(fetchedProducts.map(p => p.productType).filter(Boolean) as string[]));
      setAllAvailableProductTypes(uniqueTypes.sort());
      
      const uniqueBrands = Array.from(new Set(fetchedProducts.map(p => p.brand).filter(Boolean) as string[]));
      setAllAvailableBrands(uniqueBrands.sort());

    } catch (error) {
      console.error("Error fetching products:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('productsPageCategoryFilter', selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    sessionStorage.setItem('productsPageStatusFilter', statusFilter);
  }, [statusFilter]);

  const finalFilteredAndSortedProducts = useMemo(() => {
    let filteredProducts = products.filter(p =>
      (selectedCategory === 'all' || p.category === selectedCategory) &&
      (statusFilter === 'all' || (statusFilter === 'active' ? p.showInPOS : !p.showInPOS)) &&
      (searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.secondName && p.secondName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.productType && p.productType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.supplierId && supplierMap.get(p.supplierId)?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );

    if (sortConfig.key) {
      filteredProducts.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'supplierName') {
            aValue = supplierMap.get(a.supplierId || '') || '';
            bValue = supplierMap.get(b.supplierId || '') || '';
        } else {
            aValue = a[sortConfig.key as keyof Product];
            bValue = b[sortConfig.key as keyof Product];
        }
        
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return filteredProducts;
  }, [products, selectedCategory, statusFilter, searchTerm, sortConfig, supplierMap]);

  const handleRowClick = (event: React.MouseEvent, productId: string, rowIndex: number) => {
    event.stopPropagation();
    const isShiftPressed = event.shiftKey;
    const isCtrlPressed = event.metaKey || event.ctrlKey;
    const currentProductIds = finalFilteredAndSortedProducts.map(p => p.id);

    if (isSalesRole) { // Sales can only select one row at a time for viewing
        setSelectedProductIds(new Set([productId]));
        setLastSelectedRowIndex(rowIndex);
        return;
    }

    if (isShiftPressed && lastSelectedRowIndex !== null) {
        const start = Math.min(lastSelectedRowIndex, rowIndex);
        const end = Math.max(lastSelectedRowIndex, rowIndex);
        const rangeIds = currentProductIds.slice(start, end + 1);
        const newSet = new Set(selectedProductIds);
        rangeIds.forEach(id => newSet.add(id));
        setSelectedProductIds(newSet);
    } else if (isCtrlPressed) {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(productId)) newSet.delete(productId);
        else newSet.add(productId);
        setSelectedProductIds(newSet);
        setLastSelectedRowIndex(rowIndex);
    } else {
        setSelectedProductIds(new Set([productId]));
        setLastSelectedRowIndex(rowIndex);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    if (isSalesRole) return;
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (productData: Product) => {
    if (!currentUser) return;
    setFormLoading(true);
    try {
      if (editingProduct && editingProduct.id) {
        const { id, createdAt, updatedAt, profitPerUnit, ...dataToUpdate} = productData;
        // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
        await updateProduct(editingProduct.id, dataToUpdate, currentUser.uid, currentUser.email);
      } else {
        const { id, createdAt, updatedAt, ...newProductData } = productData;
        // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
        await addProduct(newProductData as Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'profitPerUnit'>, currentUser.uid, currentUser.email);
      }
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchData(); 
    } catch (error) {
      console.error("Error saving product:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };
  
  const requestSort = (key: keyof Product | 'supplierName') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const totalStockValue = useMemo(() => {
    return finalFilteredAndSortedProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
  }, [finalFilteredAndSortedProducts]);

  const handleContextMenu = (event: React.MouseEvent, product: Product, cellValue: any) => {
    if (isSalesRole) return;
    event.preventDefault();
    if (!selectedProductIds.has(product.id)) {
        setSelectedProductIds(new Set([product.id]));
        setLastSelectedRowIndex(finalFilteredAndSortedProducts.findIndex(p => p.id === product.id));
    }
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, targetRowData: product, targetCellValue: cellValue });
  };
  
  const handleCopyRows = useCallback(() => {
    if (selectedProductIds.size === 0) return;
    const headersToCopy = [t('barcode'), t('productName'), t('stock'), t('unit'), t('sellingPrice'), t('gpPercent'), t('costPrice'), t('secondName'), t('productType'), t('productCategory'), t('brand'), t('supplier'), t('productStatus')];
    const selectedData = finalFilteredAndSortedProducts.filter(p => selectedProductIds.has(p.id)).map(p => {
        const profit = p.profitPerUnit ?? (p.sellingPrice - p.costPrice);
        const gp = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
        return [
            p.barcode || '',
            p.name,
            p.stock,
            p.unit,
            p.sellingPrice,
            `${gp.toFixed(2)}%`,
            p.costPrice,
            p.secondName || '',
            p.productType || '',
            p.category,
            p.brand || '',
            p.supplierId ? supplierMap.get(p.supplierId) || '' : '',
            p.showInPOS ? t('statusActive') : t('statusInactive')
        ].join('\t');
    });
    const tsvString = [headersToCopy.join('\t'), ...selectedData].join('\n');
    navigator.clipboard.writeText(tsvString).then(() => {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('copiedToClipboardSuccess'), showConfirmButton: false, timer: 1500 });
    });
    setContextMenu(null);
  }, [selectedProductIds, finalFilteredAndSortedProducts, supplierMap, t]);
  
  const handleCopyCell = useCallback(() => {
    if (!contextMenu || contextMenu.targetCellValue === undefined) return;
    navigator.clipboard.writeText(String(contextMenu.targetCellValue)).then(() => {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t('copiedToClipboardSuccess'), showConfirmButton: false, timer: 1500 });
    });
    setContextMenu(null);
  }, [contextMenu, t]);

  const handleSelectAllRows = useCallback(() => {
    setSelectedProductIds(new Set(finalFilteredAndSortedProducts.map(p => p.id)));
    setContextMenu(null);
  }, [finalFilteredAndSortedProducts]);

  const handleDeleteSelected = useCallback(async () => {
    setContextMenu(null);
    if (selectedProductIds.size === 0 || !currentUser) return;
    const result = await Swal.fire({
      title: t('areYouSure'),
      text: t('confirmDeleteSelected', { count: selectedProductIds.size.toString() }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      cancelButtonColor: UI_COLORS.secondary,
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel')
    });
    if (result.isConfirmed) {
      setFormLoading(true);
      try {
        // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
        await deleteMultipleProducts(Array.from(selectedProductIds), currentUser.uid, currentUser.email);
        Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
        setSelectedProductIds(new Set());
        fetchData(); 
      } catch (error) {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setFormLoading(false);
      }
    }
  }, [selectedProductIds, t, fetchData, currentUser]);
  
  const handleDeactivateSelected = useCallback(async () => {
    setContextMenu(null);
    if (selectedProductIds.size === 0 || !currentUser) return;
    const productsToDeactivate = products.filter(p => selectedProductIds.has(p.id));
    const productsWithStock = productsToDeactivate.filter(p => p.stock > 0);

    if (productsWithStock.length > 0) {
        Swal.fire({
            title: t('cannotDeactivateWithStockTitle'),
            html: t('cannotDeactivateWithStockBody', { productNames: productsWithStock.map(p => p.name).join('<br/>') }),
            icon: 'warning'
        });
        return;
    }

    const result = await Swal.fire({
        title: t('areYouSure'),
        text: t('confirmDeactivateSelected', { count: selectedProductIds.size.toString() }),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: t('yes'),
        cancelButtonText: t('no')
    });

    if (result.isConfirmed) {
        setFormLoading(true);
        try {
            // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
            await updateMultipleProductsStatus(Array.from(selectedProductIds), false, currentUser.uid, currentUser.email);
            Swal.fire(t('success'), t('deactivateSuccess'), 'success');
            setSelectedProductIds(new Set());
            fetchData();
        } catch (error) {
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setFormLoading(false);
        }
    }
  }, [selectedProductIds, products, t, fetchData, currentUser]);
  
  const handleActivateSelected = useCallback(async () => {
    setContextMenu(null);
    if (selectedProductIds.size === 0 || !currentUser) return;
    const result = await Swal.fire({
        title: t('areYouSure'),
        text: t('confirmActivateSelected', { count: selectedProductIds.size.toString() }),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: t('yes'),
        cancelButtonText: t('no')
    });
    
    if (result.isConfirmed) {
        setFormLoading(true);
        try {
            // @google/genai-api-fix: Use `currentUser.uid` and `currentUser.email` instead of `id` and `login`.
            await updateMultipleProductsStatus(Array.from(selectedProductIds), true, currentUser.uid, currentUser.email);
            Swal.fire(t('success'), t('activateSuccess'), 'success');
            setSelectedProductIds(new Set());
            fetchData();
        } catch (error) {
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setFormLoading(false);
        }
    }
  }, [selectedProductIds, t, fetchData, currentUser]);

  const SortableHeader: React.FC<{ sortKey: keyof Product | 'supplierName', labelKey: string, className?: string }> = ({ sortKey, labelKey, className }) => (
    <th scope="col" className={`px-2 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap ${className}`} onClick={() => requestSort(sortKey)}>
      {t(labelKey)}
      {sortConfig.key === sortKey ? <SortIcon direction={sortConfig.direction} /> : <SortIcon />}
    </th>
  );

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {!isSalesRole && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                  <label htmlFor="categoryFilter" className="block text-sm font-medium text-gray-700 mb-1">{t('productCategoryFilterLabel')}</label>
                  <select id="categoryFilter" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                      className="mt-1 block w-full h-11 px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm"
                  >
                      <option value="all">{t('allCategoriesOption')}</option>
                      {allAvailableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">{t('statusFilterLabel')}</label>
                  <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="mt-1 block w-full h-11 px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm"
                  >
                      <option value="all">{t('statusFilterAll')}</option>
                      <option value="active">{t('statusFilterActive')}</option>
                      <option value="inactive">{t('statusFilterInactive')}</option>
                  </select>
              </div>
              <div className="lg:col-span-2">
                  <Card title={t('totalStockValue')} className="text-center md:text-left bg-purple-50" titleClassName="text-purple-700">
                      <p className="text-2xl font-bold text-purple-700">{formatCurrency(totalStockValue)} {currencySymbol}</p>
                  </Card>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <Input placeholder={`${t('search')}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md h-11" wrapperClassName="mb-0 flex-grow" />
        {!isSalesRole && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button onClick={handleDeleteSelected} variant="danger" disabled={selectedProductIds.size === 0}>{t('deleteSelected')}</Button>
              <Button onClick={handleDeactivateSelected} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" disabled={selectedProductIds.size === 0}>{t('deactivateSelected')}</Button>
              <Button onClick={handleActivateSelected} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" disabled={selectedProductIds.size === 0}>{t('activateSelected')}</Button>
              <div className="border-l h-8 mx-2 hidden sm:block"></div>
              <Button onClick={() => navigate('/products/import')} variant="secondary">{t('addFromExcel')}</Button>
              <Button onClick={() => navigate('/products/edit-from-excel')} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">{t('editFromExcel')}</Button>
              <Button onClick={handleAddProduct} variant="primary" leftIcon={<PlusIcon />} className="h-11">{t('addNewProduct')}</Button>
          </div>
        )}
      </div>

      {isLoading && !products.length ? ( 
        <div className="flex justify-center items-center h-64"><LoadingSpinner text={t('loading')} /></div>
      ) : (
        <div className="overflow-auto relative border rounded-lg shadow-md flex-grow" style={{ height: 'calc(100vh - 25rem)' }}>
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {isSalesRole ? (
                <tr>
                  <SortableHeader sortKey="barcode" labelKey="barcode" className="text-left" />
                  <SortableHeader sortKey="name" labelKey="productName" className="text-left" />
                  <SortableHeader sortKey="stock" labelKey="stock" className="text-right" />
                  <SortableHeader sortKey="unit" labelKey="unit" className="text-left" />
                  <SortableHeader sortKey="sellingPrice" labelKey="sellingPrice" className="text-right" />
                </tr>
              ) : (
                <tr>
                  <SortableHeader sortKey="barcode" labelKey="barcode" className="text-left" />
                  <SortableHeader sortKey="name" labelKey="productName" className="text-left" />
                  <SortableHeader sortKey="stock" labelKey="stock" className="text-right" />
                  <SortableHeader sortKey="unit" labelKey="unit" className="text-left" />
                  <SortableHeader sortKey="sellingPrice" labelKey="sellingPrice" className="text-right" />
                  <th scope="col" className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('gpPercent')}</th>
                  <SortableHeader sortKey="costPrice" labelKey="costPrice" className="text-right" />
                  <SortableHeader sortKey="secondName" labelKey="secondName" className="text-left" />
                  <SortableHeader sortKey="productType" labelKey="productType" className="text-left" />
                  <SortableHeader sortKey="category" labelKey="productCategory" className="text-left" />
                  <SortableHeader sortKey="brand" labelKey="brand" className="text-left" />
                  <SortableHeader sortKey="supplierName" labelKey="supplier" className="text-left" />
                  <SortableHeader sortKey="showInPOS" labelKey="productStatus" className="text-center" />
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {finalFilteredAndSortedProducts.map((product, index) => (
                <tr key={product.id} 
                    onClick={(e) => handleRowClick(e, product.id, index)} 
                    onDoubleClick={isSalesRole ? undefined : () => handleEditProduct(product)}
                    onContextMenu={isSalesRole ? undefined : (e) => handleContextMenu(e, product, null)}
                    className={`transition-colors text-sm cursor-pointer ${selectedProductIds.has(product.id) ? 'bg-purple-100' : 'hover:bg-gray-50'} ${!product.showInPOS ? 'text-gray-500' : ''}`}>
                  {isSalesRole ? (
                    <>
                      <td className="px-2 py-2 whitespace-nowrap">{product.barcode || '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap"><div className={`font-medium ${!product.showInPOS ? 'text-gray-600' : 'text-gray-900'}`}>{product.name}</div></td>
                      <td className="px-2 py-2 whitespace-nowrap text-right">{product.stock}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{product.unit}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-right">{formatCurrency(product.sellingPrice)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.barcode)}>{product.barcode || '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.name)}>
                        <div className={`font-medium ${!product.showInPOS ? 'text-gray-600' : 'text-gray-900'}`}>{product.name}</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right" onContextMenu={(e) => handleContextMenu(e, product, product.stock)}>{product.stock}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.unit)}>{product.unit}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-right" onContextMenu={(e) => handleContextMenu(e, product, product.sellingPrice)}>{formatCurrency(product.sellingPrice)}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-right" onContextMenu={(e) => handleContextMenu(e, product, `${((product.profitPerUnit ?? (product.sellingPrice - product.costPrice)) / (product.sellingPrice || 1) * 100).toFixed(2)}%`)}>{((product.profitPerUnit ?? (product.sellingPrice - product.costPrice)) / (product.sellingPrice || 1) * 100).toFixed(2)}%</td>
                      <td className="px-2 py-2 whitespace-nowrap text-right" onContextMenu={(e) => handleContextMenu(e, product, product.costPrice)}>{formatCurrency(product.costPrice)}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.secondName)}>{product.secondName || '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.productType)}>{product.productType || '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.category)}>{product.category}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, product.brand)}>{product.brand || '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onContextMenu={(e) => handleContextMenu(e, product, supplierMap.get(product.supplierId || ''))}>{product.supplierId ? supplierMap.get(product.supplierId) || '-' : '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-center" onContextMenu={(e) => handleContextMenu(e, product, product.showInPOS ? t('statusActive') : t('statusInactive'))}>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.showInPOS ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {product.showInPOS ? t('statusActive') : t('statusInactive')}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {finalFilteredAndSortedProducts.length === 0 && !isLoading && (
                 <tr><td colSpan={isSalesRole ? 5 : 13} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isSalesRole && contextMenu?.visible && (
        <div style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-50 bg-white shadow-lg rounded-md py-1 w-56 border text-sm">
          <div onClick={handleCopyRows} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{t('copyToClipboard')} ({selectedProductIds.size})</div>
          <div onClick={handleCopyCell} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{t('copyCellToClipboard')}</div>
          <div className="border-t my-1"></div>
          <div onClick={handleSelectAllRows} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{t('selectAllRows')}</div>
          <div className="border-t my-1"></div>
          <div onClick={() => { if (contextMenu.targetRowData) { handleEditProduct(contextMenu.targetRowData); } setContextMenu(null); }} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{t('editProduct')}...</div>
          <div className="border-t my-1"></div>
          <div onClick={handleActivateSelected} className="px-4 py-2 hover:bg-green-50 text-green-700 cursor-pointer">{t('activateSelected')}</div>
          <div onClick={handleDeactivateSelected} className="px-4 py-2 hover:bg-orange-50 text-orange-700 cursor-pointer">{t('deactivateSelected')}</div>
          <div onClick={handleDeleteSelected} className="px-4 py-2 hover:bg-red-50 text-red-600 cursor-pointer">{t('deleteSelected')}</div>
        </div>
      )}

      {!isSalesRole && isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? t('editProduct') : t('addNewProduct')}
          size="lg"
        >
          <ProductForm
            initialData={editingProduct}
            onSubmit={handleSubmitForm}
            onCancel={() => setIsModalOpen(false)}
            isLoading={formLoading}
            availableCategories={allAvailableCategories}
            availableProductTypes={allAvailableProductTypes}
            availableBrands={allAvailableBrands}
            suppliers={suppliers}
          />
        </Modal>
      )}

    </div>
  );
};

export default ProductsPage;
