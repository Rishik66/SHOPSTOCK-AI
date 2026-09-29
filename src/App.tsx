import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Billing } from './pages/Billing';
import { AIAssistant } from './pages/AIAssistant';
import { SmartRestock } from './pages/SmartRestock';
import { InvoiceScanner } from './pages/InvoiceScanner';
import { ReviewsPage } from './pages/ReviewsPage';
import { Settings } from './pages/Settings';
import { AuthPage } from './pages/AuthPage';

function AppContent() {
  const { currentUser, currentPage, ready } = useApp();

  // Wait for session restoration before deciding to show Login or Dashboard
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/30 animate-pulse">
            S
          </div>
          <span className="text-xs text-blue-200 font-bold uppercase tracking-wider">Restoring ShopStock AI...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <Layout>
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'inventory' && <Inventory />}
      {currentPage === 'billing' && <Billing />}
      {currentPage === 'ai-assistant' && <AIAssistant />}
      {currentPage === 'smart-restock' && <SmartRestock />}
      {currentPage === 'invoice-scanner' && <InvoiceScanner />}
      {currentPage === 'reviews' && <ReviewsPage />}
      {currentPage === 'settings' && <Settings />}
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
