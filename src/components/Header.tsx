import React, { useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { currentPage, language, notifications } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);

  const getTitle = () => {
    switch (currentPage) {
      case 'dashboard': return tr(language, 'nav_dashboard');
      case 'inventory': return tr(language, 'nav_inventory');
      case 'billing': return tr(language, 'nav_billing');
      case 'ai-assistant': return tr(language, 'nav_ai');
      case 'smart-restock': return tr(language, 'nav_restock');
      case 'invoice-scanner': return tr(language, 'nav_invoice');
      default: return '';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-gray-500 hover:text-gray-700">
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{getTitle()}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-sm font-medium text-gray-600">Ravi General Store</div>
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 text-gray-500 hover:text-gray-700 relative"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-sm">{tr(language, 'notif_title')}</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">{tr(language, 'notif_empty')}</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-3 border-b border-gray-100 text-sm">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium ${
                          n.type === 'error' ? 'text-red-600' :
                          n.type === 'success' ? 'text-green-600' :
                          n.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {n.message}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(n.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
