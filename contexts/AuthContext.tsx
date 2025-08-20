
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { FirebaseUser, AuthContextType } from '../types';
import { onAuthStateChangedListener, signInWithEmailAndPassword, signOutUser, isFirebaseInitialized as isFbInitialized } from '../services/firebaseService';
import LoadingSpinner from '../components/common/LoadingSpinner'; // For initial auth check loading

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true); // For initial auth state check

  useEffect(() => {
    // Wait for Firebase to be initialized before setting up the listener
    const checkFbAndListen = () => {
      if (isFbInitialized()) {
        const unsubscribe = onAuthStateChangedListener((user) => {
          setCurrentUser(user);
          setLoading(false);
        });
        return unsubscribe; // Cleanup on unmount
      } else {
        // Retry if Firebase is not yet ready (common with CDN loading)
        setTimeout(checkFbAndListen, 200);
      }
    };
    
    const unsubscribe = checkFbAndListen();
    return () => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    };
  }, []);

  const login = async (email: string, pass: string) => {
    return signInWithEmailAndPassword(email, pass);
  };

  const logout = async () => {
    return signOutUser();
  };

  const value = {
    currentUser,
    loading,
    login,
    logout,
  };

  // Show a loading screen while checking initial auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoadingSpinner text="Checking authentication..." size="lg" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};