
import React, { useState, useEffect } from 'react';
import { AppUser, UserRole } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';

interface UserFormProps {
  initialData?: AppUser | null;
  onSubmit: (uid: string, role: UserRole) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('sales');

  useEffect(() => {
    if (initialData) {
      setEmail(initialData.email);
      setRole(initialData.role);
    }
  }, [initialData]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;
    await onSubmit(initialData.uid, role);
  };

  const userRoles: UserRole[] = ['admin', 'manager', 'sales', 'purchasing', 'gr'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input 
        label={t('email')} 
        name="email" 
        value={email} 
        readOnly
        disabled
      />
      
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm h-11"
        >
          {userRoles.map(r => (
            <option key={r} value={r}>{t(`role_${r}`)}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>{t('save')}</Button>
      </div>
    </form>
  );
};

export default UserForm;
