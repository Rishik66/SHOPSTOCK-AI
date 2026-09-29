import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, Bot, RefreshCw, Barcode, X, Store, Star, Settings, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Page } from '../types';

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { currentPage, setCurrentPage, language, currentUser, isCloudConnected, isOnline, autoSyncEnabled } = useApp();

  const navItems: { id: Page; icon: React.ElementType; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'nav_dashboard' },
    { id: 'inventory', icon: Package, label: 'nav_inventory' },
    { id: 'billing', icon: ShoppingCart, label: 'nav_billing' },
    { id: 'ai-assistant', icon: Bot, label: 'nav_ai' },
    { id: 'smart-restock', icon: RefreshCw, label: 'nav_restock' },
    { id: 'invoice-scanner', icon: Barcode, label: 'nav_invoice' },
    { id: 'reviews', icon: Star, label: 'nav_reviews' },
    { id: 'settings', icon: Settings, label: 'nav_settings' },
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
      <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Store size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-900 truncate">
            {currentUser?.shopName || 'ShopStock Store'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {currentUser?.ownerName || 'Store Owner'} • {currentUser?.category || 'Retail'}
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setCurrentPage(item.id); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={19} className={isActive ? 'text-white' : 'text-gray-500'} />
              <span>{tr(language, item.label)}</span>
            </button>
          );
        })}
      </nav>
      
      {/* Sidebar Footer: Quick status linking to Settings */}
      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <button
          onClick={() => { setCurrentPage('settings'); onClose?.(); }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left group"
        >
          <div className="flex items-center gap-2">
            <Cloud size={16} className={isCloudConnected && isOnline ? 'text-emerald-600' : 'text-amber-500'} />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-gray-800 group-hover:text-blue-700">
                {isCloudConnected ? (isOnline ? 'Supabase Synced' : 'Sync Paused (Offline)') : 'Cloud Database'}
              </span>
              <span className="text-[10px] text-gray-500">
                {autoSyncEnabled ? 'Auto-sync active' : 'Manual sync'}
              </span>
            </div>
          </div>
          <Settings size={15} className="text-gray-400 group-hover:text-blue-600" />
        </button>
      </div>
    </div>
  );
}
