import React, { useState, useRef, useCallback, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';
import { updateMultipleProducts, ProductUpdatePayload, getProducts } from '../../services/firebaseService';
import { Product } from '../../types';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { UI_COLORS } from '../../constants';
import Input from '../common/Input';


declare var Swal: any;

type MappableProductFields = 'id' | 'name' | 'secondName' | 'productType' | 'category' | 'brand' | 'supplierId' | 'barcode' | 'costPrice' | 'sellingPrice' | 'sellingPrice2' | 'sellingPrice3' | 'unit' | 'stock' | 'notes';

const ProductEditFromExcelPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File & Data State
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [columnMap, setColumnMap] = useState<Record<MappableProductFields, string>>({
        id: '', name: '', secondName: '', productType: '', category: '', brand: '', supplierId: '', barcode: '', costPrice: '', sellingPrice: '', 
        sellingPrice2: '', sellingPrice3: '', unit: '', stock: '', notes: ''
    });

    // UI & Loading State
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Validation & Manipulation State
    const [existingBarcodeMap, setExistingBarcodeMap] = useState<Map<string, string>>(new Map()); // Map barcode -> productID
    const [duplicateRows, setDuplicateRows] = useState<Set<number>>(new Set());
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
        const fetchInitialData = async () => {
            try {
                const products = await getProducts();
                const barcodeMap = new Map<string, string>();
                products.forEach(p => {
                    if (p.barcode) {
                        barcodeMap.set(p.barcode, p.id);
                    }
                });
                setExistingBarcodeMap(barcodeMap);
            } catch (error) {
                console.error("Error fetching products for duplicate check:", error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (data.length === 0 || !columnMap.barcode || !columnMap.id) {
            setDuplicateRows(new Set());
            return;
        }

        const newDuplicateRows = new Set<number>();
        const excelBarcodesInThisSheet = new Map<string, number>(); // Map barcode -> firstRowIndex

        data.forEach((row, index) => {
            const excelId = String(row[columnMap.id] || '').trim();
            const newBarcode = String(row[columnMap.barcode] || '').trim();

            if (newBarcode) {
                // Check against existing DB data
                const existingProductIdForBarcode = existingBarcodeMap.get(newBarcode);
                if (existingProductIdForBarcode && existingProductIdForBarcode !== excelId) {
                    newDuplicateRows.add(index);
                }

                // Check for duplicates within the current Excel sheet
                if (excelBarcodesInThisSheet.has(newBarcode)) {
                    newDuplicateRows.add(index);
                    const firstIndex = excelBarcodesInThisSheet.get(newBarcode);
                    if (firstIndex !== undefined) {
                         newDuplicateRows.add(firstIndex);
                    }
                } else {
                    excelBarcodesInThisSheet.set(newBarcode, index);
                }
            }
        });

        setDuplicateRows(newDuplicateRows);
    }, [data, columnMap.id, columnMap.barcode, existingBarcodeMap]);


    const mappableFields: { key: MappableProductFields; labelKey: string }[] = [
        { key: 'id', labelKey: 'productId' },
        { key: 'barcode', labelKey: 'barcode' },
        { key: 'name', labelKey: 'productName' },
        { key: 'secondName', labelKey: 'secondName' },
        { key: 'productType', labelKey: 'productType' },
        { key: 'category', labelKey: 'productCategory' },
        { key: 'brand', labelKey: 'brand' },
        { key: 'supplierId', labelKey: 'supplier' },
        { key: 'costPrice', labelKey: 'costPriceLabel' },
        { key: 'sellingPrice', labelKey: 'productForm_sellingPrice1Label' },
        { key: 'sellingPrice2', labelKey: 'productForm_sellingPrice2Label' },
        { key: 'sellingPrice3', labelKey: 'productForm_sellingPrice3Label' },
        { key: 'unit', labelKey: 'unit' },
        { key: 'stock', labelKey: 'stockLabel' },
        { key: 'notes', labelKey: 'notes' },
    ];

    const handleFileLoadClick = () => fileInputRef.current?.click();

    const processSheet = useCallback((workbook: XLSX.WorkBook, sheetName: string) => {
        setSelectedSheet(sheetName);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
            const sheetHeaders = (jsonData[0] as any[]).map(String).filter(h => h);
            const sheetData = XLSX.utils.sheet_to_json(worksheet);
            setHeaders(sheetHeaders);
            setData(sheetData);
        } else {
            setHeaders([]); setData([]);
        }
        setColumnMap({ id: '', name: '', secondName: '', productType: '', category: '', brand: '', supplierId: '', barcode: '', costPrice: '', sellingPrice: '', sellingPrice2: '', sellingPrice3: '', unit: '', stock: '', notes: '' });
        setSelectedRows(new Set());
    }, []);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        try {
            const dataBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(dataBuffer);
            setWorkbook(workbook);
            setSheetNames(workbook.SheetNames);
            if (workbook.SheetNames.length > 0) {
                processSheet(workbook, workbook.SheetNames[0]);
            }
        } catch (error) {
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setIsLoading(false);
            if (e.target) e.target.value = '';
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

    const handleRowSelect = (rowIndex: number) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            newSet.has(rowIndex) ? newSet.delete(rowIndex) : newSet.add(rowIndex);
            return newSet;
        });
    };

    const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
        setSelectedRows(e.target.checked ? new Set(data.map((_, i) => i)) : new Set());
    };

    const openManipulationModal = (type: 'add' | 'change' | 'delete' | 'move') => {
        setManipulationOptions({
            targetColumn: headers[0] || '',
            scope: 'all', text1: '', text2: '', position: 'before',
            sourceColumn: headers[0] || '',
            destinationColumn: headers[1] || headers[0] || '',
        });
        const titles = { add: t('addTextModalTitle'), change: t('changeTextModalTitle'), delete: t('deleteTextModalTitle'), move: t('moveTextModalTitle') };
        setModalConfig({ type, title: titles[type] });
        setIsManipulationModalOpen(true);
    };
    
    const handleConfirmManipulation = async () => {
        const result = await Swal.fire({ title: t('confirm'), text: t('confirmDataChange'), icon: 'question', showCancelButton: true, confirmButtonText: t('yes'), cancelButtonText: t('no') });
        if (!result.isConfirmed) return;

        const { type } = modalConfig;
        const { scope, targetColumn, text1, text2, position, sourceColumn, destinationColumn } = manipulationOptions;
        const rowsToProcess = scope === 'selected' ? selectedRows : new Set(data.map((_, i) => i));

        if (scope === 'selected' && rowsToProcess.size === 0) {
            Swal.fire(t('error'), `${t('selectedRows')}: 0`, 'warning');
            return;
        }

        setData(prevData => prevData.map((row, index) => {
            if (!rowsToProcess.has(index)) return row;
            const newRow = { ...row };
            switch(type) {
                case 'add': newRow[targetColumn] = position === 'before' ? text1 + (newRow[targetColumn] || '') : (newRow[targetColumn] || '') + text1; break;
                case 'change': newRow[targetColumn] = String(newRow[targetColumn] || '').split(text1).join(text2); break;
                case 'delete': newRow[targetColumn] = String(newRow[targetColumn] || '').split(text1).join(''); break;
                case 'move': newRow[destinationColumn] = (newRow[destinationColumn] || '') + (newRow[sourceColumn] || ''); newRow[sourceColumn] = ''; break;
            }
            return newRow;
        }));
        setIsManipulationModalOpen(false);
    };

    const handleDeleteSelectedRows = async () => {
        if (selectedRows.size === 0) return;
        const result = await Swal.fire({ title: t('confirm'), text: t('confirmDeleteRows', { count: selectedRows.size.toString() }), icon: 'warning', showCancelButton: true, confirmButtonText: t('yes'), cancelButtonText: t('no') });
        if (result.isConfirmed) {
            setData(prev => prev.filter((_, i) => !selectedRows.has(i)));
            setSelectedRows(new Set());
        }
    };


    const handleUpdate = async () => {
        if (!columnMap.id && !columnMap.barcode) {
            Swal.fire(t('error'), t('updateErrorIdentifier'), 'warning');
            return;
        }

        const validDataWithIndex = data
            .map((row, index) => ({ row, index }))
            .filter(({ index }) => !duplicateRows.has(index));
        
        const remainingCount = validDataWithIndex.length;

        if (remainingCount === 0 && data.length > 0) {
            Swal.fire(t('error'), t('noValidProductsToUpdate'), 'info');
            return;
        }

        if (duplicateRows.size > 0) {
            const result = await Swal.fire({
                title: t('updateDuplicateBarcodeWarningTitle'),
                html: t('updateDuplicateBarcodeWarningText', {
                    count: duplicateRows.size.toString(),
                    remainingCount: remainingCount.toString(),
                }),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: UI_COLORS.primary,
                cancelButtonColor: UI_COLORS.danger,
                confirmButtonText: t('yes'),
                cancelButtonText: t('no'),
            });
            if (!result.isConfirmed) return;
        }

        const payloads: ProductUpdatePayload[] = validDataWithIndex
            .map(({ row, index }) => {
                const idValue = columnMap.id ? String(row[columnMap.id] || '').trim() : '';
                const barcodeValue = columnMap.barcode ? String(row[columnMap.barcode] || '').trim() : '';
                
                let identifier: { field: 'id' | 'barcode', value: string } | null = null;
                if (idValue) identifier = { field: 'id', value: idValue };
                else if (barcodeValue) identifier = { field: 'barcode', value: barcodeValue };
                
                if (!identifier) return null;

                const changes: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = {};
                mappableFields.forEach(field => {
                    if (columnMap[field.key] && row[columnMap[field.key]] !== undefined && field.key !== 'id') {
                        const val = row[columnMap[field.key]];
                        const key = field.key;
                        if (['costPrice', 'sellingPrice', 'sellingPrice2', 'sellingPrice3', 'stock'].includes(key)) {
                            const numVal = parseFloat(String(val).replace(/,/g, ''));
                            if (!isNaN(numVal)) (changes as any)[key] = numVal;
                        } else {
                            (changes as any)[key] = String(val);
                        }
                    }
                });

                if (Object.keys(changes).length === 0) return null;
                return { identifier, changes, rowNumber: index + 2 };

            }).filter((p): p is ProductUpdatePayload => p !== null);

        if (payloads.length === 0) {
            Swal.fire({title: t('info'), text: t('noDataFound'), icon: 'info'});
            return;
        }
        
        if (duplicateRows.size === 0) {
             const result = await Swal.fire({
                title: t('confirm'),
                text: t('confirmUpdate', { count: payloads.length.toString() }),
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: t('yes'), cancelButtonText: t('no'),
            });
            if (!result.isConfirmed) return;
        }

        setIsUpdating(true);
        try {
            const res = await updateMultipleProducts(payloads);
            const totalSkipped = duplicateRows.size + res.skipped.length;

            let message = t('updateResultSummary', { 
                successCount: res.successCount.toString(), 
                skippedCount: totalSkipped.toString(), 
                errorCount: res.errors.length.toString() 
            });
            if (res.errors.length > 0) {
                 message += `<br/><br/><strong>Errors:</strong><br/>` + res.errors.map(e => `Row ${e.rowNumber}: ${e.reason}`).join('<br/>');
            }
            if (res.skipped.length > 0) {
                 message += `<br/><br/><strong>Skipped (not found):</strong><br/>` + res.skipped.map(e => `Row ${e.rowNumber}: ${e.reason}`).join('<br/>');
            }

            Swal.fire({ title: t('success'), html: message, icon: 'success' });
            navigate('/products');
        } catch (error) {
            Swal.fire(t('error'), t('errorOccurred'), 'error');
        } finally {
            setIsUpdating(false);
        }
    };
    
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
                {/* Left */}
                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <Button onClick={handleFileLoadClick} isLoading={isLoading}>{t('loadExcelFile')}</Button>
                            {sheetNames.length > 0 && <select value={selectedSheet} onChange={handleSheetChange} className="w-full sm:w-auto h-11 border-gray-300 rounded-md">{sheetNames.map(name => <option key={name} value={name}>{name}</option>)}</select>}
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
                                    <thead className="bg-gray-100 sticky top-0"><tr>
                                        <th className="p-2 w-10"><input type="checkbox" onChange={handleSelectAll} checked={data.length > 0 && selectedRows.size === data.length} className="h-4 w-4 text-purple-600 rounded"/></th>
                                        {headers.map(h => <th key={h} className="p-2 text-left font-semibold">{h}</th>)}
                                    </tr></thead>
                                    <tbody>{data.slice(0, 100).map((row, i) => <tr key={i} className={`border-b transition-colors ${duplicateRows.has(i) ? 'bg-yellow-200' : selectedRows.has(i) ? 'bg-purple-100' : ''}`}>
                                        <td className="p-2"><input type="checkbox" checked={selectedRows.has(i)} onChange={() => handleRowSelect(i)} className="h-4 w-4 text-purple-600 rounded"/></td>
                                        {headers.map(h => <td key={h} className="p-2 truncate max-w-xs">{String(row[h] === undefined || row[h] === null ? '' : row[h])}</td>)}
                                    </tr>)}</tbody>
                                </table>
                           ): <p className="text-center p-8 text-gray-500">{t('noDataFound')}</p>}
                        </div>
                    </Card>
                </div>
                
                {/* Right */}
                <div className="lg:col-span-1">
                    <Card title={t('columnMapping')}>
                        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
                        <div className="p-2 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-md">
                            <strong>{t('notes')}:</strong> {t('searchPriorityNote')}
                        </div>
                            {mappableFields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700">{t(field.labelKey)} {(field.key === 'id' || field.key === 'barcode') && <span className="text-red-500">*</span>}</label>
                                    <select value={columnMap[field.key]} onChange={e => handleMapChange(field.key, e.target.value)} className="w-full h-10 mt-1 border-gray-300 rounded-md">
                                        <option value="">{t('notSpecified')}</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </Card>
                    <div className="mt-6 flex flex-col gap-2">
                        <Button onClick={handleUpdate} isLoading={isUpdating} disabled={data.length === 0} className="w-full h-12 text-lg">
                            {t('editSelectedDataButton')}
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
                    footer={<><Button variant="outline" onClick={() => setIsManipulationModalOpen(false)}>{t('cancel')}</Button><Button onClick={handleConfirmManipulation}>{t('confirm')}</Button></>}
                >
                    {renderModalContent()}
                </Modal>
            )}
        </div>
    );
};

export default ProductEditFromExcelPage;