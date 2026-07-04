import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Make sure this Client ID matches exactly
const GOOGLE_CLIENT_ID = '1071080157818-6f6plb7pjmgm70kpn2d34alm9pd4blr0.apps.googleusercontent.com';

root.render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);