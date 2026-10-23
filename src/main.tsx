import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './registerServiceWorker.ts';
import { captureReferralCode } from './lib/referral.ts';

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('unique "key" prop')) {
    return; // Ignore the warning
  }
  originalError(...args);
};

// Capture referral parameter from URL before any render/auth initialization
captureReferralCode();

// Register PWA service worker
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
