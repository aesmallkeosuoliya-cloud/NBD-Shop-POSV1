import React, { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';
import { addMultipleProducts, getSuppliers, getProducts } from '../../services/firebaseService';
import { Product, Supplier } from '../../types';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import Input from '../common/Input';

declare var Swal: any;

type MappableProductFields = 'name' | 'secondName' | 'productType' | 'category' | 'brand' | 'barcode' | 'costPrice' | 'sellingPrice' | 'sellingPrice2' | 'sellingPrice3' | 'unit' | 'stock' | 'notes' | 'supplierId';

const ImportFromExcelPage: React.FC = () => {
    // Hooks
    const { t } = useLanguage();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Component State
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [existingBarcodes, setExistingBarcodes] = useState<Set<string>>(new Set());
    const [duplicateRows, setDuplicateRows] = useState<Set<number>>(new Set());
    const [columnMap, setColumnMap] = useState<Record<MappableProductFields, string>>({
        name: '', secondName: '', productType: '', category: '', brand: '', supplierId: '', barcode: '', costPrice: '', sellingPrice: '', 
        sellingPrice2: '', sellingPrice3: '', unit: '', stock: '', notes: ''
    });
    const [autoGenerateBarcode, setAutoGenerateBarcode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    // Data Manipulation State
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isManipulationModalOpen, setIsManipulationModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: 'add' | 'change' | 'delete' | 'move' | null; title: string }>({ type: null, title: '' });
    const [manipulationOptions, setManipulationOptions] = useState({
        targetColumn: '',
        scope: 'all',
        text1: '',
        text2: '',
        position: 'before',
        sourceColumn: '',
        destinationColumn: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedSuppliers, fetchedProducts] = await Promise.all([
                    getSuppliers(),
                    getProducts()
                ]);
                setSuppliers(fetchedSuppliers);
                const barcodes = new Set(fetchedProducts.map(p => p.barcode).filter(Boolean) as string[]);
                setExistingBarcodes(barcodes);
            } catch (error) {
                console.error("Error fetching initial data for import page:", error);
            }
        };
        fetchData();
    }, []);
    
    useEffect(() => {
        if (!columnMap.barcode || data.length === 0) {
            setDuplicateRows(new Set());
            return;
        }
    
        const duplicates = new Set<number>();
        const excelBarcodes = new Set<string>();
    
        data.forEach((row, index) => {
            const barcodeValue = row[columnMap.barcode];
            if (barcodeValue) {
                const barcodeStr = String(barcodeValue).trim();
                if (existingBarcodes.has(barcodeStr) || excelBarcodes.has(barcodeStr)) {
                    duplicates.add(index);
                }
                excelBarcodes.add(barcodeStr);
            }
        });
    
        setDuplicateRows(duplicates);
    }, [data, columnMap.barcode, existingBarcodes]);

    // Mappable fields configuration
    const mappableFields: { key: MappableProductFields; labelKey: string; required: boolean }[] = [
        { key: 'name', labelKey: 'productName', required: true },
        { key: 'secondName', labelKey: 'secondName', required: false },
        { key: 'productType', labelKey: 'productType', required: true },
        { key: 'category', labelKey: 'productCategory', required: true },
        { key: 'brand', labelKey: 'brand', required: false },
        { key: 'supplierId', labelKey: 'supplier', required: false },
        { key: 'barcode', labelKey: 'barcode', required: true },
        { key: 'costPrice', labelKey: 'costPriceLabel', required: false },
        { key: 'sellingPrice', labelKey: 'productForm_sellingPrice1Label', required: false },
        { key: 'sellingPrice2', labelKey: 'productForm_sellingPrice2Label', required: false },
        { key: 'sellingPrice3', labelKey: 'productForm_sellingPrice3Label', required: false },
        { key: 'unit', labelKey: 'unit', required: true },
        { key: 'stock', labelKey: 'stockLabel', required: false },
        { key: 'notes', labelKey: 'notes', required: false },
    ];

    // Handlers
    const handleFileLoadClick = () => {
        fileInputRef.current?.click();
    };

    const processSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
        setSelectedSheet(sheetName);
        const worksheet = wb.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
            const sheetHeaders = (jsonData[0] as any[]).map(String).filter(h => h);
            const sheetData = XLSX.utils.sheet_to_json(worksheet);
            setHeaders(sheetHeaders);
            setData(sheetData);
        } else {
            setHeaders([]);
            setData([]);
        }
        setColumnMap({ name: '', secondName: '', productType: '', category: '', brand: '', supplierId: '', barcode: '', costPrice: '', sellingPrice: '', sellingPrice2: '', sellingPrice3: '', unit: '', stock: '', notes: '' });
        setSelectedRows(new Set());
    }, []);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const dataBuffer = await file.arrayBuffer();
            const wb = XLSX.read(dataBuffer);
            setWorkbook(wb);
            const names = wb.SheetNames;
            setSheetNames(names);
            if (names.length > 0) {
                processSheet(wb, names[0]);
            } else {
                setHeaders([]);
                setData([]);
            }
        } catch (error) {
            console.error("Error reading Excel file:", error);
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setIsLoading(false);
            e.target.value = '';
        }
    };
    
    const handleSheetChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const sheetName = e.target.value;
        if (workbook) {
            processSheet(workbook, sheetName);
        }
    };
    
    const handleMapChange = (field: MappableProductFields, excelColumn: string) => {
        setColumnMap(prev => ({ ...prev, [field]: excelColumn }));
    };
    
    // Row Selection Handlers
    const handleRowSelect = (rowIndex: number) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowIndex)) {
                newSet.delete(rowIndex);
            } else {
                newSet.add(rowIndex);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRows(new Set(data.map((_, i) => i)));
        } else {
            setSelectedRows(new Set());
        }
    };

    // Data Manipulation Handlers
    const openManipulationModal = (type: 'add' | 'change' | 'delete' | 'move') => {
        setManipulationOptions({
            targetColumn: headers.length > 0 ? headers[0] : '',
            scope: 'all',
            text1: '', text2: '',
            position: 'before',
            sourceColumn: headers.length > 0 ? headers[0] : '',
            destinationColumn: headers.length > 0 ? headers[1] || headers[0] : '',
        });

        const titles = {
            add: t('addTextModalTitle'),
            change: t('changeTextModalTitle'),
            delete: t('deleteTextModalTitle'),
            move: t('moveTextModalTitle'),
        };
        setModalConfig({ type, title: titles[type] });
        setIsManipulationModalOpen(true);
    };

    const handleConfirmManipulation = async () => {
        const result = await Swal.fire({
            title: t('confirm'),
            text: t('confirmDataChange'),
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: t('yes'),
            cancelButtonText: t('no'),
        });
        if (!result.isConfirmed) return;

        const { type } = modalConfig;
        const { scope, targetColumn, text1, text2, position, sourceColumn, destinationColumn } = manipulationOptions;
        const rowsToProcess = scope === 'selected' ? selectedRows : new Set(data.map((_, i) => i));

        if (rowsToProcess.size === 0 && scope === 'selected') {
            Swal.fire(t('error'), `${t('selectedRows')}: 0`, 'warning');
            return;
        }

        const newData = data.map((row, index) => {
            if (!rowsToProcess.has(index)) return row;

            const newRow = { ...row };

            switch(type) {
                case 'add':
                    const originalAdd = String(newRow[targetColumn] || '');
                    newRow[targetColumn] = position === 'before' ? text1 + originalAdd : originalAdd + text1;
                    break;
                case 'change':
                    const originalChange = String(newRow[targetColumn] || '');
                    newRow[targetColumn] = originalChange.split(text1).join(text2);
                    break;
                case 'delete':
                    const originalDelete = String(newRow[targetColumn] || '');
                    newRow[targetColumn] = originalDelete.split(text1).join('');
                    break;
                case 'move':
                    const sourceValue = String(newRow[sourceColumn] || '');
                    const destValue = String(newRow[destinationColumn] || '');
                    newRow[destinationColumn] = destValue + sourceValue;
                    newRow[sourceColumn] = '';
                    break;
            }
            return newRow;
        });
        setData(newData);
        setIsManipulationModalOpen(false);
    };

    const handleDeleteSelectedRows = async () => {
        if (selectedRows.size === 0) return;
        const result = await Swal.fire({
            title: t('confirm'),
            text: t('confirmDeleteRows', { count: selectedRows.size.toString() }),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: t('yes'),
            cancelButtonText: t('no'),
        });
        if (result.isConfirmed) {
            setData(prev => prev.filter((_, i) => !selectedRows.has(i)));
            setSelectedRows(new Set());
        }
    };


    const handleImport = async () => {
        // ... (existing import logic, slightly adjusted)
    };
    
    // ... (rest of the component, including the new JSX for the toolbar and modal)

    const renderModalContent = () => {
        const scopeOptions = (
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('itemsToProcess')}</label>
            <select value={manipulationOptions.scope} onChange={e => setManipulationOptions(prev => ({ ...prev, scope: e.target.value }))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10">
              <option value="all">{t('allRows')}</option>
              <option value="selected" disabled={selectedRows.size === 0}>{t('selectedRows')} ({selectedRows.size})</option>
            </select>
          </div>
        );
      
        switch(modalConfig.type) {
          case 'add':
            return <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700">{t('selectColumn')}</label><select value={manipulationOptions.targetColumn} onChange={e => setManipulationOptions(prev => ({...prev, targetColumn: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="">{t('notSpecified')}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
              {scopeOptions}
              <Input label={t('textToInsert')} value={manipulationOptions.text1} onChange={e => setManipulationOptions(prev => ({...prev, text1: e.target.value}))} />
              <div><label className="block text-sm font-medium text-gray-700">{t('insertMethod')}</label><select value={manipulationOptions.position} onChange={e => setManipulationOptions(prev => ({...prev, position: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="before">{t('insertBefore')}</option><option value="after">{t('insertAfter')}</option></select></div>
            </div>;
          case 'change':
             return <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700">{t('selectColumn')}</label><select value={manipulationOptions.targetColumn} onChange={e => setManipulationOptions(prev => ({...prev, targetColumn: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="">{t('notSpecified')}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                {scopeOptions}
                <Input label={t('textToChange')} value={manipulationOptions.text1} onChange={e => setManipulationOptions(prev => ({...prev, text1: e.target.value}))} />
                <Input label={t('changeTo')} value={manipulationOptions.text2} onChange={e => setManipulationOptions(prev => ({...prev, text2: e.target.value}))} />
             </div>;
           case 'delete':
             return <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700">{t('selectColumn')}</label><select value={manipulationOptions.targetColumn} onChange={e => setManipulationOptions(prev => ({...prev, targetColumn: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="">{t('notSpecified')}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                {scopeOptions}
                <Input label={t('textToDelete')} value={manipulationOptions.text1} onChange={e => setManipulationOptions(prev => ({...prev, text1: e.target.value}))} />
             </div>;
           case 'move':
             return <div className="space-y-4">
                {scopeOptions}
                <div><label className="block text-sm font-medium text-gray-700">{t('moveFromColumn')}</label><select value={manipulationOptions.sourceColumn} onChange={e => setManipulationOptions(prev => ({...prev, sourceColumn: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="">{t('notSpecified')}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700">{t('moveToColumn')}</label><select value={manipulationOptions.destinationColumn} onChange={e => setManipulationOptions(prev => ({...prev, destinationColumn: e.target.value}))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-10"><option value="">{t('notSpecified')}</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
             </div>;
          default:
            return null;
        }
      };


    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-full">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side */}
                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <Button onClick={handleFileLoadClick} isLoading={isLoading} className="w-full sm:w-auto">{t('loadExcelFile')}</Button>
                            {sheetNames.length > 0 && (
                                <select value={selectedSheet} onChange={handleSheetChange} className="w-full sm:w-auto h-11 border-gray-300 rounded-md">
                                    {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            )}
                        </div>
                    </Card>

                    {data.length > 0 && (
                         <Card title={t('dataManipulation')} className="mt-6">
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={() => openManipulationModal('add')} disabled={!data.length}>{t('addText')}</Button>
                                <Button onClick={() => openManipulationModal('change')} disabled={!data.length}>{t('changeText')}</Button>
                                <Button onClick={() => openManipulationModal('delete')} disabled={!data.length}>{t('deleteText')}</Button>
                                <Button onClick={() => openManipulationModal('move')} disabled={!data.length}>{t('moveText')}</Button>
                                <Button variant="danger" onClick={handleDeleteSelectedRows} disabled={selectedRows.size === 0}>{t('deleteRows')} ({selectedRows.size})</Button>
                            </div>
                        </Card>
                    )}


                    <Card title={`${t('excelData')} (${data.length} ${t('items')})`} className="mt-6">
                        <div className="max-h-[60vh] overflow-auto">
                           {data.length > 0 ? (
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2 w-10"><input type="checkbox" onChange={handleSelectAll} checked={data.length > 0 && selectedRows.size === data.length} className="h-4 w-4 text-purple-600 rounded"/></th>
                                            {headers.map(h => <th key={h} className="p-2 text-left font-semibold">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>{data.slice(0, 100).map((row, i) => <tr key={i} className={`border-b transition-colors ${duplicateRows.has(i) ? 'bg-yellow-200' : selectedRows.has(i) ? 'bg-purple-100' : ''}`}>
                                        <td className="p-2"><input type="checkbox" checked={selectedRows.has(i)} onChange={() => handleRowSelect(i)} className="h-4 w-4 text-purple-600 rounded"/></td>
                                        {headers.map(h => <td key={h} className="p-2 truncate max-w-xs">{String(row[h] === undefined || row[h] === null ? '' : row[h])}</td>)}
                                    </tr>)}</tbody>
                                </table>
                           ): <p className="text-center p-8 text-gray-500">{t('noDataFound')}</p>}
                        </div>
                    </Card>
                </div>
                
                {/* Right side */}
                <div className="lg:col-span-1">
                    <Card title={t('columnMapping')}>
                        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
                            {mappableFields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700">{t(field.labelKey)} {field.required && <span className="text-red-500">*</span>}</label>
                                    <select value={columnMap[field.key]} onChange={e => handleMapChange(field.key, e.target.value)} className="w-full h-10 mt-1 border-gray-300 rounded-md">
                                        <option value="">{t('notSpecified')}</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                            <div className="pt-2">
                                <label className="flex items-center">
                                    <input type="checkbox" checked={autoGenerateBarcode} onChange={e => setAutoGenerateBarcode(e.target.checked)} className="h-4 w-4 text-purple-600 border-gray-300 rounded"/>
                                    <span className="ml-2 text-sm text-gray-700">{t('autoGenerateBarcode')}</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6">{t('barcodeNotes')}</p>
                            </div>
                        </div>
                    </Card>

                    <div className="mt-6 flex flex-col gap-2">
                        <Button onClick={handleImport} isLoading={isImporting} disabled={data.length === 0} className="w-full h-12 text-lg">
                            {t('import')}
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/products')} className="w-full">
                            {t('close')}
                        </Button>
                    </div>
                </div>
            </div>

            {isManipulationModalOpen && (
                <Modal
                    isOpen={isManipulationModalOpen}
                    onClose={() => setIsManipulationModalOpen(false)}
                    title={modalConfig.title}
                    footer={
                        <>
                          <Button variant="outline" onClick={() => setIsManipulationModalOpen(false)}>{t('cancel')}</Button>
                          <Button onClick={handleConfirmManipulation}>{t('confirm')}</Button>
                        </>
                    }
                >
                    {renderModalContent()}
                </Modal>
            )}
        </div>
    );
};

export default ImportFromExcelPage;