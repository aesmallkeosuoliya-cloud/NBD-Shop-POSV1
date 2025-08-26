

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
// @google/genai-api-fix: Imported missing AuthContextType to resolve type error.
import { AppUser, AuthContextType, UserRole } from '../types';
import { onAuthStateChangedListener, signIn, signOut } from '../services/authService';
import { addAuditLog } from '../services/firebaseService';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChangedListener from our authService will handle everything:
    // 1. Listen to Firebase Auth state
    // 2. If user is logged in, fetch their profile from RTDB
    // 3. Return the full AppUser object or null
    const unsubscribe = onAuthStateChangedListener((user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string): Promise<AppUser> => {
    const user = await signIn(email, pass); // This now returns the full AppUser with role
    if (user) {
      setCurrentUser(user);
      await addAuditLog({
          userId: user.uid,
          userLogin: user.email,
          action: 'user_login',
          details: `User ${user.email} logged in.`
      });
      return user;
    } else {
      // This case should be handled by an error thrown from signIn
      throw new Error('invalid_credentials');
    }
  };

  const logout = async (): Promise<void> => {
    if (currentUser) {
       await addAuditLog({
          userId: currentUser.uid,
          userLogin: currentUser.email,
          action: 'user_logout',
          details: `User ${currentUser.email} logged out.`
      });
    }
    await signOut();
    setCurrentUser(null);
  };
  
  const hasPermission = useCallback((allowedRoles: UserRole[]): boolean => {
    // --- ROLE MANAGEMENT TEMPORARILY DISABLED FOR TESTING ---
    // This check is bypassed to grant all permissions to any logged-in user.
    // To re-enable, restore the original logic.
    if (!currentUser) return false; // Still require a user to be logged in.
    return true;
    /*
    // ORIGINAL LOGIC:
    if (!currentUser) return false;
    if (allowedRoles.includes(currentUser.role)) {
        return true;
    }
    return false;
    */
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    logout,
    hasPermission
  };

  // The loading state from the context will be used by App.tsx to show a loading screen
  // while the initial auth state is being determined.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};