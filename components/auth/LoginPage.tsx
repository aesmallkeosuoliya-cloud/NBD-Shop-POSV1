
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { APP_NAME, UI_COLORS } from '../../constants';

declare var Swal: any; // SweetAlert2

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      // AuthProvider will update currentUser, and App.tsx will navigate
      Swal.fire({
        icon: 'success',
        title: t('loginSuccessful'),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err: any) {
      console.error("Login failed:", err); 
      
      let userFacingMessageKey = 'loginFailed'; // Default message for UI text

      if (err.code) {
        switch (err.code) {
          case 'auth/api-key-not-valid':
          case 'auth/invalid-credential':
            userFacingMessageKey = 'authCredentialError'; 
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            userFacingMessageKey = 'invalidEmailOrPassword';
            break;
          default:
            console.warn(`Unhandled Firebase Auth error code: ${err.code}`);
        }
      } else {
        // Non-Firebase error or error object without a 'code'
        console.warn("Login error without a Firebase error code:", err);
      }
      
      const translatedErrorMessage = t(userFacingMessageKey);
      setError(translatedErrorMessage); // Update <p> tag on page
      
      Swal.fire({
        icon: 'error',
        title: t('loginFailed'), // General title "Login Failed"
        text: translatedErrorMessage, // Specific user-facing message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4`}>
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all hover:scale-105 duration-300">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">
            {APP_NAME}
          </h1>
          <p className="text-gray-500 mt-2">{t('login')}</p>
        </div>
        
        {error && <p className="mb-4 text-center text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label={t('email')}
            type="email"
            name="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="your@email.com"
          />
          <Input
            label={t('password')}
            type="password"
            name="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="********"
          />
          <Button type="submit" variant="primary" className="w-full text-lg py-3" isLoading={isLoading} disabled={isLoading}>
            {t('login')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
