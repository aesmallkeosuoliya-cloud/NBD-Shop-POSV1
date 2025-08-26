
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppUser, UserRole } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { getUsers, updateUserRole, deleteUser } from '../../services/firebaseService';
import Input from '../common/Input';
import Card from '../common/Card';
import UserForm from './UserForm';
import { UI_COLORS } from '../../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare var Swal: any;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const UserManagementPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  const userRoles: UserRole[] = ['admin', 'manager', 'sales', 'purchasing', 'gr'];

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers.sort((a, b) => a.email.localeCompare(b.email)));
    } catch (error) {
      console.error("Error fetching users:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (user.uid === currentUser?.uid) {
        Swal.fire(t('error'), t('cannotDeleteSelf'), 'error');
        return;
    }
    const result = await Swal.fire({
      title: t('areYouSureDelete'),
      text: t('actionCannotBeUndone'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: UI_COLORS.danger,
      confirmButtonText: t('delete'),
    });

    if (result.isConfirmed) {
      try {
        await deleteUser(user.uid, currentUser!.uid, currentUser!.email);
        Swal.fire(t('deleted'), t('deleteSuccess'), 'success');
        fetchUsers();
      } catch (error) {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
      }
    }
  };

  const handleSubmitForm = async (uid: string, role: UserRole) => {
    setFormLoading(true);
    try {
      await updateUserRole(uid, role, currentUser!.uid, currentUser!.email);
      Swal.fire(t('success'), t('saveSuccess'), 'success');
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
        Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setFormLoading(false);
    }
  };
  
  const filteredUsers = useMemo(() => users.filter(u =>
    (u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (roleFilter === 'all' || u.role === roleFilter)
  ), [users, searchTerm, roleFilter]);
  
  const exportToExcel = () => {
    const dataToExport = filteredUsers.map(u => ({
        [t('email')]: u.email,
        [t('role')]: t(`role_${u.role}`),
        'Created At': new Date(u.createdAt).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "User_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(t('userManagement'), 14, 15);
    (doc as any).autoTable({
        head: [[t('email'), t('role'), 'Created At']],
        body: filteredUsers.map(u => [u.email, t(`role_${u.role}`), new Date(u.createdAt).toLocaleDateString()]),
        startY: 20,
    });
    doc.save('User_List.pdf');
  };


  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">{t('userManagement')}</h1>
        <p className="text-sm text-gray-500">{t('featureComingSoon')}</p> 
      </div>

      <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder={`${t('search')}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} wrapperClassName="mb-0 md:col-span-2" />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="h-11 border-gray-300 rounded-md">
                <option value="all">{t('allRoles')}</option>
                {userRoles.map(r => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
            </select>
          </div>
           <div className="mt-4 flex justify-end space-x-2">
            <Button onClick={exportToExcel} variant="outline" size="sm">{t('exportToExcel')}</Button>
            <Button onClick={exportToPDF} variant="outline" size="sm">{t('exportToPDF')}</Button>
          </div>
      </Card>

      {isLoading ? <LoadingSpinner /> : (
        <div className="overflow-auto flex-grow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{t('email')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{t('role')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.uid}>
                  <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{t(`role_${user.role}`)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}><EditIcon/></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)}><DeleteIcon/></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('editUser')}>
          <UserForm initialData={editingUser} onSubmit={handleSubmitForm} onCancel={() => setIsModalOpen(false)} isLoading={formLoading} />
        </Modal>
      )}
    </div>
  );
};

export default UserManagementPage;
