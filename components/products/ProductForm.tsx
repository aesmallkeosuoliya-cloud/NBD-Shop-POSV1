import React, { useState, useEffect, useMemo } from 'react';
import { Product, Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
// DEFAULT_PRODUCT_CATEGORIES from constants will be part of the passed `availableCategories`
// import { DEFAULT_PRODUCT_CATEGORIES } from '../../constants'; 

declare var Swal: any;

interface ProductFormProps {
  initialData?: Product | null;
  onSubmit: (product: Product) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  availableCategories: string[]; // This prop will now receive dynamically loaded categories
  availableProductTypes: string[];
  availableBrands: string[];
  suppliers: Supplier[];
}

const BarcodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

const FormSectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="pt-4 pb-2 border-b border-gray-200">
      <h3 className="text-md font-semibold text-purple-700">{title}</h3>
    </div>
);

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, onCancel, isLoading, availableCategories, availableProductTypes, availableBrands, suppliers }) => {
  const { t } = useLanguage();
  const [product, setProduct] = useState<Partial<Product>>(
    initialData || {
      name: '',
      secondName: '',
      barcode: '',
      productType: '',
      category: availableCategories.length > 0 ? availableCategories[0] : '', // Default to first available or empty
      brand: '',
      supplierId: '',
      costPrice: 0,
      sellingPrice: 0,
      sellingPrice2: 0,
      sellingPrice3: 0,
      unit: t('unit'),
      stock: 0,
      showInPOS: true,
      hasSerialNumber: false,
      hasExpiryDate: false,
      notes: '',
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setProduct(initialData);
    } else {
      // For new product, ensure category defaults correctly if availableCategories changes
       setProduct(prev => ({
        ...prev,
        name: '', // Ensure name is reset
        secondName: '',
        barcode: '', // Ensure barcode is also reset for new product
        productType: '',
        category: initialData?.category || (availableCategories.length > 0 ? availableCategories[0] : ''),
        brand: '',
        supplierId: '',
        costPrice: 0,
        sellingPrice: 0,
        sellingPrice2: 0,
        sellingPrice3: 0,
        unit: t('unit'), // Use translation for default unit if available
        stock: 0,
        showInPOS: true,
        hasSerialNumber: false,
        hasExpiryDate: false,
        notes: '',
      }));
    }
  }, [initialData, availableCategories, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;

        if (name === 'showInPOS' && !checked && product.stock && product.stock > 0) {
            Swal.fire({
                icon: 'warning',
                title: t('cannotDisableProduct'),
                text: t('productHasStockWarning'),
            });
            return; // Prevent unchecking if stock exists
        }

        setProduct(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
        setProduct(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
    else {
        setProduct(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({...prev, [name]: ''}));
    }
  };

  const handleAutoGenerateBarcode = () => {
    const generatedBarcode = Date.now().toString();
    setProduct(prev => ({ ...prev, barcode: generatedBarcode }));
    if (errors.barcode) {
      setErrors(prev => ({...prev, barcode: ''}));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!product.name?.trim()) newErrors.name = t('requiredField');
    if (!product.category?.trim()) newErrors.category = t('requiredField'); 
    if (product.costPrice === undefined || product.costPrice < 0) newErrors.costPrice = t('requiredField') + ' (>=0)';
    if (product.sellingPrice === undefined || product.sellingPrice < 0) newErrors.sellingPrice = t('requiredField') + ' (>=0)';
    if (!product.unit?.trim()) newErrors.unit = t('requiredField');
    if (product.stock === undefined || product.stock < 0) newErrors.stock = t('requiredField') + ' (>=0)';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalProductData = {
      ...product,
      id: initialData?.id || '', 
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Ensure all required fields for Product type are present, even if empty or default from state
      name: product.name || '',
      category: product.category || '',
      costPrice: product.costPrice || 0,
      sellingPrice: product.sellingPrice || 0,
      sellingPrice2: product.sellingPrice2 || 0,
      sellingPrice3: product.sellingPrice3 || 0,
      unit: product.unit || t('unit'),
      stock: product.stock || 0,
      showInPOS: product.showInPOS === undefined ? true : product.showInPOS,
      hasSerialNumber: product.hasSerialNumber || false,
      hasExpiryDate: product.hasExpiryDate || false,
    } as Product;
    
    await onSubmit(finalProductData);
  };

  const calculateGp = (cost: number, sell: number) => {
    if (sell <= 0) return cost > 0 ? -100 : 0;
    const profit = sell - cost;
    return (profit / sell) * 100;
  };
  
  const gpPercentage1 = useMemo(() => calculateGp(product.costPrice ?? 0, product.sellingPrice ?? 0), [product.costPrice, product.sellingPrice]);
  const gpPercentage2 = useMemo(() => calculateGp(product.costPrice ?? 0, product.sellingPrice2 ?? 0), [product.costPrice, product.sellingPrice2]);
  const gpPercentage3 = useMemo(() => calculateGp(product.costPrice ?? 0, product.sellingPrice3 ?? 0), [product.costPrice, product.sellingPrice3]);

  const priceFields = [
    { level: 1, name: 'sellingPrice', value: product.sellingPrice, error: errors.sellingPrice, gp: gpPercentage1 },
    { level: 2, name: 'sellingPrice2', value: product.sellingPrice2, error: errors.sellingPrice2, gp: gpPercentage2 },
    { level: 3, name: 'sellingPrice3', value: product.sellingPrice3, error: errors.sellingPrice3, gp: gpPercentage3 }
  ];


  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      {/* BASIC INFO */}
      <FormSectionHeader title={t('productForm_section_basicInfo')} />
      <div className="space-y-4 pt-2 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input name="name" label={t('productName')} value={product.name || ''} onChange={handleChange} error={errors.name} required />
            <Input name="secondName" label={t('secondName')} value={product.secondName || ''} onChange={handleChange} error={errors.secondName} />
        </div>
        <div>
          <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">{t('barcode')}</label>
          <div className="flex items-center space-x-2">
            <Input 
              name="barcode" 
              id="barcode"
              value={product.barcode || ''} 
              onChange={handleChange} 
              error={errors.barcode} 
              wrapperClassName="flex-grow mb-0"
              className="rounded-r-none"
            />
            <Button 
              type="button" 
              onClick={handleAutoGenerateBarcode} 
              variant="outline" 
              size="md"
              className="rounded-l-none border-l-0 h-[38px] px-3" 
              title={t('autoGenerateBarcode')}
            >
              <BarcodeIcon />
            </Button>
          </div>
          {errors.barcode && <p className="mt-1 text-xs text-red-600">{errors.barcode}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="productType" className="block text-sm font-medium text-gray-700 mb-1">{t('productType')}</label>
                <input type="text" id="productType" name="productType" list="productTypeDatalist" value={product.productType || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
                <datalist id="productTypeDatalist">
                    {availableProductTypes.map(pt => <option key={pt} value={pt} />)}
                </datalist>
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">{t('productCategory')}</label>
                <input type="text" id="category" name="category" list="categoryDatalist" value={product.category || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${errors.category ? 'border-red-500' : ''}`} required />
                <datalist id="categoryDatalist">
                    {availableCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
            </div>
            <div>
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">{t('brand')}</label>
                <input type="text" id="brand" name="brand" list="brandDatalist" value={product.brand || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
                <datalist id="brandDatalist">
                    {availableBrands.map(b => <option key={b} value={b} />)}
                </datalist>
            </div>
            <div>
                <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">{t('supplier')}</label>
                <select id="supplierId" name="supplierId" value={product.supplierId || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                    <option value="">-- {t('selectSupplier')} --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* PRICING */}
      <FormSectionHeader title={t('productForm_section_pricing')} />
      <div className="space-y-4 pt-2 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1">
                <Input 
                    name="costPrice" 
                    label={t('productForm_costPriceLabel')} 
                    type="number" 
                    step="0.01" 
                    value={product.costPrice || 0} 
                    onChange={handleChange} 
                    error={errors.costPrice} 
                    required 
                    className="bg-purple-50 text-purple-800 font-semibold"
                />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm font-medium text-gray-700">{t('productForm_sellingPriceLabel')}</label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                  {priceFields.map(pf => (
                    <div key={pf.level}>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor={pf.name} className="block text-xs font-medium text-gray-600">{t(`productForm_sellingPrice${pf.level}Label` as any)}</label>
                            <span className={`text-xs font-semibold ${pf.gp >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {t('profit')}: {pf.gp.toFixed(2)}%
                            </span>
                        </div>
                        <Input 
                            name={pf.name}
                            id={pf.name}
                            type="number" 
                            step="0.01" 
                            value={pf.value || 0} 
                            onChange={handleChange} 
                            error={pf.error} 
                            required={pf.level === 1}
                            wrapperClassName="mb-0"
                            className="text-red-600 font-semibold"
                        />
                    </div>
                  ))}
               </div>
            </div>
        </div>
      </div>

      {/* STOCK */}
      <FormSectionHeader title={t('productForm_section_stock')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pb-4">
        <Input name="unit" label={t('unit')} value={product.unit || ''} onChange={handleChange} error={errors.unit} required />
        <Input name="stock" label={t('stock')} type="number" value={product.stock || 0} onChange={handleChange} error={errors.stock} required />
      </div>

      {/* DATES */}
      <FormSectionHeader title={t('productForm_section_dates')} />
      <div className="pt-2 pb-4">
        <label className="flex items-center">
          <input type="checkbox" name="showInPOS" checked={!!product.showInPOS} onChange={handleChange} className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0" />
          <span className="ml-2 text-sm text-gray-700">{t('showInPOS')}</span>
        </label>
      </div>

      {/* OPTIONS */}
      <FormSectionHeader title={t('productForm_section_options')} />
      <div className="space-y-4 pt-2 pb-4">
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('productNotes')}</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            value={product.notes || ''}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2 pt-2">
          <label className="flex items-center">
            <input type="checkbox" name="hasSerialNumber" checked={!!product.hasSerialNumber} onChange={handleChange} className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0" />
            <span className="ml-2 text-sm text-gray-700">{t('hasSerialNumber')}</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" name="hasExpiryDate" checked={!!product.hasExpiryDate} onChange={handleChange} className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0" />
            <span className="ml-2 text-sm text-gray-700">{t('hasExpiryDate')}</span>
          </label>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>{initialData ? t('save') : t('add')}</Button>
      </div>
    </form>
  );
};

export default ProductForm;