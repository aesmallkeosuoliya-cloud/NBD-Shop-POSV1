import React, { useState, useEffect } from 'react';
import { InternalUser, InternalUserRole, Permission } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { ALL_PERMISSIONS, INTERNAL_USER_ROLES, ROLE_PERMISSIONS } from '../../constants';

interface InternalUserFormProps {
  initialData?: InternalUser | null;
  onSubmit: (userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading: boolean;
  isEditMode: boolean;
}

const InternalUserForm: React.FC<InternalUserFormProps> = ({ initialData, onSubmit, onCancel, isLoading, isEditMode }) => {
  const { t } = useLanguage();
  const [user, setUser] = useState<Partial<Omit<InternalUser, 'id'>>>({
    fullname: '',
    username: '',
    password: '',
    role: 'Sales',
    permissions: ROLE_PERMISSIONS['Sales'],
    status: 'active',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      const { id, createdAt, updatedAt, ...formData } = initialData;
      setUser({ ...formData, password: '' }); // Don't pre-fill password for editing
    } else {
      setUser({
        fullname: '',
        username: '',
        password: '',
        role: 'Sales',
        permissions: [...ROLE_PERMISSIONS['Sales']],
        status: 'active',
      });
    }
  }, [initialData]);

  // Effect to update permissions when role changes
  useEffect(() => {
    // @google/genai-api-fix: Add a guard to ensure user.role is a valid key in ROLE_PERMISSIONS before spreading.
    if (user.role && ROLE_PERMISSIONS[user.role]) {
      setUser(prev => ({
        ...prev,
        permissions: [...ROLE_PERMISSIONS[user.role!]]
      }));
    }
  }, [user.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUser(prev => ({ ...prev, [name]: value as any }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePermissionChange = (permission: Permission) => {
    setUser(prev => {
      const newPermissions = new Set(prev.permissions);
      if (newPermissions.has(permission)) {
        newPermissions.delete(permission);
      } else {
        newPermissions.add(permission);
      }
      return { ...prev, permissions: Array.from(newPermissions) };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!user.fullname?.trim()) newErrors.fullname = t('requiredField');
    if (!user.username?.trim()) newErrors.username = t('requiredField');
    if (!isEditMode && (!user.password || user.password.length < 4)) {
      newErrors.password = t('passwordTooShort');
    }
    if (user.password && user.password !== confirmPassword) {
      newErrors.confirmPassword = t('passwordsDoNotMatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    const dataToSubmit: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'> = {
        fullname: user.fullname!,
        username: user.username!,
        role: user.role!,
        permissions: user.permissions || [],
        status: user.status!,
        // Only include password if it was entered
        ...(user.password && { password: user.password }),
    };
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label={t('fullname')} name="fullname" value={user.fullname || ''} onChange={handleChange} error={errors.fullname} required />
      <Input label={t('username')} name="username" value={user.username || ''} onChange={handleChange} error={errors.username} required disabled={isEditMode} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label={t('password')} name="password" type="password" value={user.password || ''} onChange={handleChange} error={errors.password} placeholder={isEditMode ? t('leaveBlankToKeepPassword') : ''} required={!isEditMode} />
        <Input label={t('confirmPassword')} name="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} error={errors.confirmPassword} required={!!user.password} />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
        <select id="role" name="role" value={user.role} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm h-11">
          {INTERNAL_USER_ROLES.map(r => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('permissions')}</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md">
          {ALL_PERMISSIONS.map(p => (
            <label key={p} className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={user.permissions?.includes(p) || false} onChange={() => handlePermissionChange(p)} className="h-4 w-4 text-purple-600 rounded" />
              <span className="text-sm text-gray-700">{t(`permission_${p}`)}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>{t('save')}</Button>
      </div>
    </form>
  );
};

export default InternalUserForm;
