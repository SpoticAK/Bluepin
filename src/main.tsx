import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('unique "key" prop')) {
    return; // Ignore the warning
  }
  originalError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
