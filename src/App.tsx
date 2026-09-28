import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Billing } from './pages/Billing';
import { AIAssistant } from './pages/AIAssistant';
import { SmartRestock } from './pages/SmartRestock';
import { InvoiceScanner } from './pages/InvoiceScanner';

import { AuthPage } from './pages/AuthPage';

function AppContent() {
  const { currentUser, currentPage } = useApp();

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
