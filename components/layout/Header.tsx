

import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import { UI_COLORS } from '../../constants';

interface HeaderProps {
  onToggleSidebar: () => void;
  pageTitle: string;
}

const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, pageTitle }) => {
  const { t } = useLanguage();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // Navigation to login page will be handled by App.tsx due to currentUser becoming null
      // Swal can be added here if desired for logout confirmation
    } catch (error) {
      console.error("Logout failed:", error);
      // Optionally show error to user
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Hamburger Menu for Mobile */}
          <div className="lg:hidden">
            <button
              onClick={onToggleSidebar}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
              aria-label="Toggle sidebar"
            >
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Page Title */}
          <div className="flex-1 min-w-0">
             <h1 className="text-xl font-semibold text-gray-800 truncate">{pageTitle}</h1>
          </div>
          
          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {currentUser && (
              <>
                {/* @google/genai-api-fix: Use `currentUser.email` instead of `login`. */}
                <span className="text-sm text-gray-600 hidden sm:block" title={currentUser.email}>
                  {currentUser.email}
                </span>
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  size="sm" 
                  leftIcon={<LogoutIcon/>}
                  className={`border-purple-500 text-purple-600 hover:bg-purple-50`}
                >
                  {t('logout')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
