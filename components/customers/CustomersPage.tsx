
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Customer } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import CustomerForm from './CustomerForm';
import LoadingSpinner from '../common/LoadingSpinner';
import { addCustomer, getCustomers, updateCustomer, deleteCustomer as fbDeleteCustomer, isFirebaseInitialized } from '../../services/firebaseService';
import Input from '../common/Input';
import { UI_COLORS, CUSTOMER_TYPES } from '../../constants';

declare var Swal: any; // For SweetAlert2

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;

const CustomersPage: React.FC = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching customers.");
      return;
    }
    setIsLoading(true);
    try {
      const fetchedCustomers = await getCustomers();
      setCustomers(fetchedCustomers.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching customers:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDeleteCustomer = async (id: string) => {
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
      setFormLoading(true); 
      try {
        await fbDeleteCustomer(id);
        Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
        fetchCustomers();
      } catch (error) {
        console.error("Error deleting customer:", error);
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      } finally {
        setFormLoading(false);
      }
    }
  };

  const handleSubmitForm = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFormLoading(true);
    try {
      if (editingCustomer && editingCustomer.id) {
        await updateCustomer(editingCustomer.id, customerData);
      } else {
        await addCustomer(customerData);
      }
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [customers, searchTerm]);

  const getCustomerTypeLabel = (type: 'cash' | 'credit') => {
    const foundType = CUSTOMER_TYPES.find(ct => ct.value === type);
    return foundType ? t(foundType.labelKey) : type;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">{t('customerManagementPageTitle')}</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Input
            placeholder={t('searchCustomerByNameOrPhone')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
            wrapperClassName="mb-0 flex-grow"
          />
          <Button onClick={handleAddCustomer} variant="primary" leftIcon={<PlusIcon />} className="flex-shrink-0">
            {t('addNewCustomer')}
          </Button>
        </div>
      </div>

      {isLoading && !customers.length ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customerName')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customerType')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('phone')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('email')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('creditDays')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                    <div className="text-xs text-gray-500">{t('customerId')}: {customer.id.substring(customer.id.length-6)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.customerType === 'credit' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                        {getCustomerTypeLabel(customer.customerType)}
                     </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs" title={customer.email}>{customer.email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{customer.customerType === 'credit' ? (customer.creditDays || 0) : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(customer)} className="text-blue-600 hover:text-blue-900 p-1" title={t('edit') + ' ' + t('customers')}><EditIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomer(customer.id)} className="text-red-600 hover:text-red-900 p-1" title={t('delete') + ' ' + t('customers')}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCustomer ? t('edit') + ' ' + t('customers') : t('addNewCustomer')}
          size="md"
        >
          <CustomerForm
            initialData={editingCustomer}
            onSubmit={handleSubmitForm}
            onCancel={() => setIsModalOpen(false)}
            isLoading={formLoading}
          />
        </Modal>
      )}
    </div>
  );
};

export default CustomersPage;
