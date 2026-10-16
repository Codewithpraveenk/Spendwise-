import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { TransactionsProvider } from './state/TransactionsContext';
import AppErrorBoundary from './components/ui/AppErrorBoundary';
import { AuthProvider } from './state/AuthProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider><TransactionsProvider>
          <App />
        </TransactionsProvider></AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
