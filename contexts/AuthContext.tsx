
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { InternalUser, AuthContextType, UserRole } from '../types';
import { findUserByLogin, addAuditLog, getInternalUsers, addInternalUser } from '../services/firebaseService';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In a real application, you'd use a secure hashing algorithm like bcrypt.
// For demonstration purposes, we use simple Base64 encoding. THIS IS NOT SECURE for production.
const encodePass = (pass: string) => btoa(pass);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<InternalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On initial load, check for a user in localStorage to maintain session
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('currentUser');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (login: string, pass: string): Promise<InternalUser> => {
    const user = await findUserByLogin(login, pass); // This service function handles password checking
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      await addAuditLog({
          userId: user.id,
          userLogin: user.login,
          action: 'user_login',
          details: `User ${user.login} logged in.`
      });
      return user;
    } else {
      throw new Error('invalid_credentials');
    }
  };

  const logout = async (): Promise<void> => {
    if (currentUser) {
       await addAuditLog({
          userId: currentUser.id,
          userLogin: currentUser.login,
          action: 'user_logout',
          details: `User ${currentUser.login} logged out.`
      });
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };
  
  const hasPermission = useCallback((allowedRoles: UserRole[]): boolean => {
    if (!currentUser) return false;
    if (allowedRoles.includes(currentUser.role)) {
        return true;
    }
    return false;
  }, [currentUser]);


  // One-time check on startup to ensure an admin user exists.
  useEffect(() => {
    const bootstrapAdmin = async () => {
      try {
        const users = await getInternalUsers();
        if (users.length === 0) {
          console.log("No users found. Creating default admin user...");
          await addInternalUser({ login: 'admin', role: 'admin' }, 'admin');
          console.log("Default admin user created. Login: admin, Password: admin");
        }
      } catch(e) {
        console.error("Failed to bootstrap admin user:", e);
      }
    };

    // We need a slight delay to ensure Firebase is initialized from the service.
    setTimeout(bootstrapAdmin, 1500);
  }, []);

  const value = {
    currentUser,
    loading,
    login,
    logout,
    hasPermission
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
