import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PurchaseManager } from './components/PurchaseManager';
import { SalesManager } from './components/SalesManager';
import { InventoryManager } from './components/InventoryManager';
import { ContactsManager } from './components/ContactsManager';
import { ReportCenter } from './components/ReportCenter';
import { SettingsManager } from './components/SettingsManager';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 font-semibold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Verifying security session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'purchases' && <PurchaseManager />}
        {currentView === 'sales' && <SalesManager />}
        {currentView === 'inventory' && <InventoryManager />}
        {currentView === 'customers' && <ContactsManager type="customer" />}
        {currentView === 'suppliers' && <ContactsManager type="supplier" />}
        {currentView === 'reports' && <ReportCenter />}
        {currentView === 'settings' && <SettingsManager />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
