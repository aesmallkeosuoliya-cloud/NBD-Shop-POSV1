
import React, { useState, useEffect } from 'react';
import { InternalUser, UserRole } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';

interface UserFormProps {
  initialData?: InternalUser | null;
  onSubmit: (userData: Partial<InternalUser>, password?: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const { t } = useLanguage();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('sales');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setLogin(initialData.login);
      setRole(initialData.role);
    } else {
      setLogin('');
      setRole('sales');
    }
    setPassword('');
    setConfirmPassword('');
    setErrors({});
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!login.trim()) {
      newErrors.login = t('requiredField');
    }

    if (!isEditMode) { // Password is required for new users
      if (!password) {
        newErrors.password = t('requiredField');
      } else if (password.length < 4) {
        newErrors.password = t('passwordTooShort');
      }
    }
    
    if (password && password !== confirmPassword) {
      newErrors.confirmPassword = t('passwordsDoNotMatch');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const userData: Partial<InternalUser> = {
      login,
      role,
    };
    
    await onSubmit(userData, password || undefined);
  };

  const userRoles: UserRole[] = ['admin', 'manager', 'sales', 'purchasing', 'gr'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input 
        label={t('usernameOrEmail')} 
        name="login" 
        value={login} 
        onChange={(e) => setLogin(e.target.value)} 
        error={errors.login} 
        required 
      />
      <Input 
        label={t('password')} 
        name="password" 
        type="password"
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        error={errors.password} 
        required={!isEditMode}
        placeholder={isEditMode ? t('leaveBlankToKeepPassword') : ''}
      />
       <Input 
        label={t('confirmPassword')} 
        name="confirmPassword" 
        type="password"
        value={confirmPassword} 
        onChange={(e) => setConfirmPassword(e.target.value)} 
        error={errors.confirmPassword} 
        required={!isEditMode || !!password}
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
        <Button type="submit" variant="primary" isLoading={isLoading}>{initialData ? t('save') : t('add')}</Button>
      </div>
    </form>
  );
};

export default UserForm;
