import React, { useState, useEffect, useCallback } from 'react';
import { Supplier } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import SupplierForm from './SupplierForm';
import LoadingSpinner from '../common/LoadingSpinner';
import { addSupplier, getSuppliers, updateSupplier, deleteSupplier, isFirebaseInitialized } from '../../services/firebaseService';
import Input from '../common/Input';
import { UI_COLORS } from '../../constants';

declare var Swal: any; // For SweetAlert2

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;

const SuppliersPage: React.FC = () => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching suppliers.");
      return;
    }
    setIsLoading(true);
    try {
      const fetchedSuppliers = await getSuppliers();
      setSuppliers(fetchedSuppliers.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    const result = await Swal.fire({
      title: t('areYouSureDelete'),
      text: t('actionCannotBeUndone'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      cancelButtonColor: UI_COLORS.secondary,
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel')
    });

    if (result.isConfirmed) {
      setIsLoading(true); // Can use a more specific loading for delete if needed
      try {
        await deleteSupplier(id);
        Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
        fetchSuppliers(); 
      } catch (error) {
        console.error("Error deleting supplier:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSubmitForm = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFormLoading(true);
    try {
      if (editingSupplier && editingSupplier.id) {
        await updateSupplier(editingSupplier.id, supplierData);
      } else {
        await addSupplier(supplierData);
      }
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };
  
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.taxId && s.taxId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">{t('suppliers')}</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <Input 
            placeholder={t('search') + '... (' + t('supplierName') + ', ' + t('phone') + ', ' + t('taxId') + ')'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs" // sm:max-w-sm
            wrapperClassName="mb-0 flex-grow"
            />
            <Button onClick={handleAddSupplier} variant="primary" leftIcon={<PlusIcon />} className="flex-shrink-0">
            {t('addNewSupplier')}
            </Button>
        </div>
      </div>

      {isLoading && !suppliers.length ? ( 
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('supplierName')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('phone')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('creditDays')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('taxInfo')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('taxId')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('notes')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{supplier.creditDays === undefined || supplier.creditDays === null ? '-' : supplier.creditDays}</td>
                  <td className="px-6 py-4 whitespace-normal text-xs text-gray-500 max-w-xs truncate" title={supplier.taxInfo}>{supplier.taxInfo || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.taxId || '-'}</td>
                  <td className="px-6 py-4 whitespace-normal text-xs text-gray-500 max-w-xs truncate" title={supplier.notes}>{supplier.notes || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditSupplier(supplier)} className="text-blue-600 hover:text-blue-900 p-1" title={t('editSupplier')}><EditIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSupplier(supplier.id)} className="text-red-600 hover:text-red-900 p-1" title={t('deleteSupplier')}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && !isLoading && (
                 <tr><td colSpan={7} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingSupplier ? t('editSupplier') : t('addNewSupplier')}
          size="md"
        >
          <SupplierForm
            initialData={editingSupplier}
            onSubmit={handleSubmitForm}
            onCancel={() => setIsModalOpen(false)}
            isLoading={formLoading}
          />
        </Modal>
      )}
    </div>
  );
};

export default SuppliersPage;