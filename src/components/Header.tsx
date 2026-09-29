import React, { useState } from 'react';
import { Menu, Bell, LogOut, User, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { SupabaseModal } from './SupabaseModal';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { currentPage, language, notifications, currentUser, logout, isCloudConnected } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  const getTitle = () => {
    switch (currentPage) {
      case 'dashboard': return tr(language, 'nav_dashboard');
      case 'inventory': return tr(language, 'nav_inventory');
      case 'billing': return tr(language, 'nav_billing');
      case 'ai-assistant': return tr(language, 'nav_ai');
      case 'smart-restock': return tr(language, 'nav_restock');
      case 'invoice-scanner': return tr(language, 'nav_invoice');
      case 'reviews': return tr(language, 'nav_reviews');
      default: return '';
    }
  };

  const cloudActive = isCloudConnected || isSupabaseConfigured();

  return (
    <>
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onMenuClick} className="lg:hidden p-2 text-gray-500 hover:text-gray-700">
            <Menu size={24} />
          </button>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate max-w-[140px] sm:max-w-none">
            {getTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Cloud Database (Supabase) Sync Status Button */}
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              cloudActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title="Cloud Database (Supabase) Settings & Sync"
          >
            <Cloud size={14} className={cloudActive ? 'text-emerald-600' : 'text-amber-600'} />
            <span className="hidden md:inline font-bold">
              {cloudActive ? 'Cloud Synced' : 'Connect Cloud'}
            </span>
          </button>

          {/* Active Store Name */}
          <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
            <User size={16} className="text-blue-600" />
            <span className="truncate max-w-[120px] lg:max-w-[180px]">{currentUser?.shopName || 'My Store'}</span>
          </div>

          {/* Notifications Bell */}
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

          {/* Logout Button */}
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to log out?")) {
                logout();
              }
            }}
            title="Log Out"
            className="flex items-center gap-1.5 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Supabase Settings & Sync Modal */}
      <SupabaseModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />
    </>
  );
}
