
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InternalUser, InternalUserRole } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { getInternalUsers, addInternalUser, updateInternalUser, deleteInternalUser, internalUserExists } from '../../services/firebaseService';
import Input from '../common/Input';
import Card from '../common/Card';
import InternalUserForm from './InternalUserForm'; // The form component
import { UI_COLORS, INTERNAL_USER_ROLES } from '../../constants';

declare var Swal: any;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;

export const UserManagementPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth(); // Logged in user from Firebase Auth
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<InternalUserRole | 'all'>('all');

  const fetchInternalUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const users = await getInternalUsers();
      setInternalUsers(users.sort((a, b) => a.fullname.localeCompare(b.fullname)));
    } catch (error) {
      console.error("Error fetching internal users:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchInternalUsers();
  }, [fetchInternalUsers]);

  const handleAddNewUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: InternalUser) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleToggleSuspendUser = async (user: InternalUser) => {
    const isSuspending = user.status === 'active';
    const result = await Swal.fire({
      title: t('areYouSure'),
      text: isSuspending ? t('areYouSureSuspend') : t('areYouSureActivate'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('yes'),
    });

    if (result.isConfirmed) {
      try {
        await updateInternalUser(user.id, { status: isSuspending ? 'suspended' : 'active' });
        Swal.fire(t('success'), t('saveSuccess'), 'success');
        fetchInternalUsers();
      } catch (error) {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      }
    }
  };

  const handleDeleteUser = async (user: InternalUser) => {
     if (user.username === currentUser?.email) {
        Swal.fire(t('error'), t('cannotDeleteSelf'), 'error');
        return;
    }
    const result = await Swal.fire({
      title: t('areYouSureDelete'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      confirmButtonText: t('delete'),
    });
    if (result.isConfirmed) {
      try {
        await deleteInternalUser(user.id);
        Swal.fire(t('success'), t('deleteSuccess'), 'success');
        fetchInternalUsers();
      } catch (error) {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      }
    }
  };

  const handleSubmitForm = async (userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFormLoading(true);
    try {
      if (editingUser) { // Edit mode
        await updateInternalUser(editingUser.id, userData);
      } else { // Add mode
        const exists = await internalUserExists(userData.username);
        if (exists) {
            Swal.fire(t('error'), t('loginAlreadyExists'), 'error');
            setFormLoading(false);
            return;
        }
        await addInternalUser(userData);
      }
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchInternalUsers();
    } catch (error) {
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return internalUsers.filter(u =>
      ((u.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (roleFilter === 'all' || u.role === roleFilter)
    );
  }, [internalUsers, searchTerm, roleFilter]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">{t('userManagement')}</h1>
        <Button onClick={handleAddNewUser} variant="primary" leftIcon={<PlusIcon />}>
          {t('addNewUser')}
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
                placeholder={t('search') + '...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                wrapperClassName="mb-0"
            />
            <div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="w-full h-11 border-gray-300 rounded-md shadow-sm">
                    <option value="all">{t('allRoles')}</option>
                    {INTERNAL_USER_ROLES.map(r => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
                </select>
            </div>
        </div>
      </Card>
      
      {isLoading ? ( 
        <div className="flex justify-center items-center h-64"><LoadingSpinner text={t('loading')} /></div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-auto flex-grow mt-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('fullname')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('username')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('role')}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.fullname}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t(`role_${user.role}`)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {t(user.status === 'active' ? 'statusActive' : 'statusSuspended')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <Button variant="outline" size="sm" onClick={() => handleToggleSuspendUser(user)} className="text-sm">
                      {user.status === 'active' ? t('suspend') : t('activate')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} className="text-blue-600 p-1"><EditIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} className="text-red-600 p-1" disabled={user.username === currentUser?.email}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && !isLoading && (
                 <tr><td colSpan={5} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingUser ? t('editUser') : t('addNewUser')}
          size="md"
        >
          <InternalUserForm
            initialData={editingUser}
            onSubmit={handleSubmitForm}
            onCancel={() => setIsModalOpen(false)}
            isLoading={formLoading}
            isEditMode={!!editingUser}
          />
        </Modal>
      )}
    </div>
  );
};
