

// IMPORTANT: This file relies on Firebase SDKs being loaded globally via CDN in index.html.

import { FIREBASE_CONFIG } from '../constants'; 
import { AppUser, FirebaseUser } from '../types'; 
import { createUserProfile, getUser } from './firebaseService';

// Declare Firebase types if not automatically available from global scope.
declare global {
  interface Window {
    firebase: any;
  }
}

let app: any; // Firebase App instance
let auth: any; // Firebase Authentication service instance

export const initializeFirebase = () => {
  if (typeof window.firebase === 'undefined' || typeof window.firebase.initializeApp !== 'function') {
    console.error("Firebase SDK not found or not loaded correctly.");
    return;
  }
  
  if (!window.firebase.apps.length) {
    app = window.firebase.initializeApp(FIREBASE_CONFIG);
  } else {
    app = window.firebase.app(); 
  }

  if (app && typeof window.firebase.auth === 'function') {
    auth = window.firebase.auth(app);
  } else {
    console.error("Firebase Authentication SDK not found or failed to initialize.");
  }
};

initializeFirebase();

// --- Authentication Service ---
export const signIn = async (email: string, pass: string): Promise<AppUser> => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  const userCredential = await auth.signInWithEmailAndPassword(email, pass);
  const firebaseUser = userCredential.user;

  // After successful Firebase Auth login, fetch the user's profile/role from RTDB
  let userProfile = await getUser(firebaseUser.uid);
  
  if (!userProfile) {
    // If no profile exists, it's their first login. Create a profile with a default role.
    console.log(`User profile for ${firebaseUser.email} not found. Creating one with a default 'sales' role.`);
    userProfile = await createUserProfile(firebaseUser.uid, firebaseUser.email!, 'sales');
  }
  
  return userProfile;
};

export const signOut = async (): Promise<void> => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  await auth.signOut();
};

export const onAuthStateChangedListener = (callback: (user: AppUser | null) => void): (() => void) => {
  if (!auth) {
    console.error("Firebase Auth not initialized. Cannot listen for auth state changes.");
    return () => {}; // Return a no-op unsubscribe function
  }
  return auth.onAuthStateChanged(async (firebaseUser: any) => {
    if (firebaseUser) {
      const userProfile = await getUser(firebaseUser.uid);
      // Only consider the user logged in if they have a profile in our DB
      callback(userProfile);
    } else {
      callback(null);
    }
  });
};

export const reauthenticate = async (password: string): Promise<boolean> => {
    if (!auth || !auth.currentUser) {
        console.error("User is not signed in for reauthentication.");
        return false;
    }
    const user = auth.currentUser;
    const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, password);

    try {
        await user.reauthenticateWithCredential(credential);
        return true;
    } catch (error) {
        console.error("Reauthentication failed:", error);
        return false;
    }
};

export const isAuthInitialized = (): boolean => !!auth;