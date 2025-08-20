

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Importing firebaseService will execute its initializeFirebase() call.
import './services/firebaseService'; 
import { LanguageProvider } from './contexts/LanguageContext'; // Ensured relative path
import { AuthProvider } from './contexts/AuthContext'; // Ensured relative path

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>
);