import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, Bot, RefreshCw, Camera, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Language, Page } from '../types';

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { currentPage, setCurrentPage, language, setLanguage, resetDemoData } = useApp();

  const navItems: { id: Page; icon: React.ElementType; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'nav_dashboard' },
    { id: 'inventory', icon: Package, label: 'nav_inventory' },
    { id: 'billing', icon: ShoppingCart, label: 'nav_billing' },
    { id: 'ai-assistant', icon: Bot, label: 'nav_ai' },
    { id: 'smart-restock', icon: RefreshCw, label: 'nav_restock' },
    { id: 'invoice-scanner', icon: Camera, label: 'nav_invoice' },
  ];

  return (
    <div className="flex flex-col h-full w-64 bg-white border-r border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">S</div>
          <span className="font-bold text-lg">SHOPSTOCK AI</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm font-medium text-gray-900">Ravi General Store</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setCurrentPage(item.id); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {tr(language, item.label)}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200 space-y-4">
        <div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
          >
            <option value="en">🇺🇸 English</option>
            <option value="te">🇮🇳 తెలుగు</option>
            <option value="hi">🇮🇳 हिन्दी</option>
            <option value="kn">🇮🇳 ಕನ್ನಡ</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (window.confirm(tr(language, 'resetConfirm'))) {
              resetDemoData();
            }
          }}
          className="w-full text-sm text-red-600 hover:bg-red-50 p-2 rounded-md font-medium"
        >
          {tr(language, 'reset')}
        </button>
      </div>
    </div>
  );
}
