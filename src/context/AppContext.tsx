import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Transaction, Language, AppNotification, Page, UserAccount } from '../types';
import {
  DEMO_USER,
  getCurrentUser,
  setCurrentUser,
  getRegisteredUsers,
  saveRegisteredUsers,
  findUserDirectly,
  loadUserProducts,
  saveUserProducts,
  loadUserTransactions,
  saveUserTransactions,
  isUserInitialized,
  setUserInitialized,
  resetUserData,
  loadLanguage,
  saveLanguage as storageSaveLanguage,
} from '../utils/storage';
import { isSupabaseConfigured } from '../services/supabaseClient';
import {
  syncSignUpToSupabase,
  syncSignInWithSupabase,
  fetchProductsFromSupabase,
  saveProductsToSupabase,
  fetchTransactionsFromSupabase,
  saveTransactionToSupabase,
  syncAllToSupabase,
  isAutoSyncEnabled,
  setAutoSyncEnabled as saveAutoSyncEnabled,
  getLastAutoSyncTime,
  setLastAutoSyncTime
} from '../services/supabaseSyncService';

export { DEMO_USER };

const DEMO_PRODUCT_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const DEMO_PRODUCT_NAMES = new Set([
  'maggi', 'parle-g biscuits', 'aashirvaad atta', 'tata salt', 'amul milk',
  'coca-cola', 'britannia bread', 'surf excel', 'colgate', 'thums up'
]);
const DEMO_TXN_IDS = new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 't1', 't2']);

interface AppContextType {
  currentUser: UserAccount | null;
  products: Product[];
  transactions: Transaction[];
  language: Language;
  notifications: AppNotification[];
  currentPage: Page;
  ready: boolean;
  isCloudConnected: boolean;
  autoSyncEnabled: boolean;
  isOnline: boolean;
  lastSyncTime: string | null;
  setProducts: (products: Product[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setLanguage: (lang: Language) => void;
  setCurrentPage: (page: Page) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  resetDemoData: () => void;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  logout: () => void;
  refreshCloudSync: () => Promise<void>;
  syncNow: () => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(null);
  const [products, setProductsState] = useState<Product[]>([]);
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [language, setLanguageState] = useState<Language>('en');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [ready, setReady] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(isAutoSyncEnabled());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getLastAutoSyncTime());

  // Initialize or switch store data based on active user
  const loadUserData = (user: UserAccount | null) => {
    if (!user) {
      setProductsState([]);
      setTransactionsState([]);
      return;
    }

    const userId = user.id;

    if (!isUserInitialized(userId)) {
      saveUserProducts(userId, []);
      saveUserTransactions(userId, []);
      setUserInitialized(userId);
      setProductsState([]);
      setTransactionsState([]);
    } else {
      // Load user products and transactions from local storage
      const loadedProducts = loadUserProducts(userId);
      const cleanedProducts = loadedProducts.filter(
        p => !(DEMO_PRODUCT_IDS.has(p.id) && DEMO_PRODUCT_NAMES.has(p.name.toLowerCase()))
      );

      const loadedTransactions = loadUserTransactions(userId);
      const cleanedTxns = loadedTransactions.filter(t => !DEMO_TXN_IDS.has(t.id));

      if (cleanedProducts.length !== loadedProducts.length) {
        saveUserProducts(userId, cleanedProducts);
      }
      if (cleanedTxns.length !== loadedTransactions.length) {
        saveUserTransactions(userId, cleanedTxns);
      }

      setProductsState(cleanedProducts);
      setTransactionsState(cleanedTxns);
    }

    // Two-way background sync with Supabase Cloud
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER.id) {
      setIsCloudConnected(true);
      fetchProductsFromSupabase(userId).then(remoteProducts => {
        if (remoteProducts !== null) {
          if (remoteProducts.length > 0) {
            setProductsState(remoteProducts);
            saveUserProducts(userId, remoteProducts);
          } else {
            const local = loadUserProducts(userId);
            if (local.length > 0) {
              saveProductsToSupabase(userId, local);
            }
          }
          const now = new Date().toISOString();
          setLastSyncTime(now);
          setLastAutoSyncTime(now);
        }
      }).catch(err => console.warn('Supabase product sync background notice:', err));

      fetchTransactionsFromSupabase(userId).then(remoteTxns => {
        if (remoteTxns !== null) {
          if (remoteTxns.length > 0) {
            setTransactionsState(remoteTxns);
            saveUserTransactions(userId, remoteTxns);
          } else {
            const local = loadUserTransactions(userId);
            if (local.length > 0) {
              local.forEach(tx => saveTransactionToSupabase(userId, tx));
            }
          }
          const now = new Date().toISOString();
          setLastSyncTime(now);
          setLastAutoSyncTime(now);
        }
      }).catch(err => console.warn('Supabase tx sync background notice:', err));
    } else {
      setIsCloudConnected(isSupabaseConfigured());
    }
  };

  useEffect(() => {
    // 1. Load language preference
    const lang = loadLanguage();
    setLanguageState(lang);

    // 2. Ensure registered users list is initialized
    const users = getRegisteredUsers();
    saveRegisteredUsers(users);

    // 3. Check cloud connection
    setIsCloudConnected(isSupabaseConfigured());

    // 4. Load active session across browser closes
    const savedUser = getCurrentUser();
    if (savedUser) {
      setCurrentUserState(savedUser);
      loadUserData(savedUser);
    }

    // 5. Network online / offline event listeners for automatic silent sync
    const handleOnline = () => {
      setIsOnline(true);
      if (isAutoSyncEnabled()) {
        const user = getCurrentUser();
        if (user && user.id !== DEMO_USER.id && isSupabaseConfigured()) {
          const prods = loadUserProducts(user.id);
          const txns = loadUserTransactions(user.id);
          syncAllToSupabase(user, prods, txns).then(res => {
            if (res.success) {
              const now = new Date().toISOString();
              setLastSyncTime(now);
              setLastAutoSyncTime(now);
              setNotifications(prev => [{
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                type: 'info' as const,
                message: 'Internet restored: Automatically synced store data to Supabase.',
                timestamp: now
              }, ...prev].slice(0, 20));
            }
          }).catch(err => console.warn('Network auto-sync error:', err));
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setReady(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshCloudSync = async () => {
    setIsCloudConnected(isSupabaseConfigured());
    if (currentUser) {
      loadUserData(currentUser);
    }
  };

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const clean = identifier.trim();
    if (!clean) {
      return { success: false, error: 'Please enter your email, owner name, or shop name.' };
    }

    // 1. Direct local user lookup
    const localUser = findUserDirectly(clean);

    if (localUser) {
      if (localUser.password !== pass) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      setCurrentUser(localUser);
      setCurrentUserState(localUser);
      loadUserData(localUser);
      setCurrentPage('dashboard');

      // Sync user profile to Supabase in background
      if (isSupabaseConfigured() && localUser.id !== DEMO_USER.id) {
        syncSignUpToSupabase(localUser).catch(() => {});
      }

      return { success: true };
    }

    // 2. If not found locally, check Supabase cloud (allows multi-device login: laptop & phone)
    if (isSupabaseConfigured()) {
      const cloudRes = await syncSignInWithSupabase(clean, pass);
      if (cloudRes.success && cloudRes.user) {
        const cloudUser = cloudRes.user;
        const users = getRegisteredUsers();
        if (!users.some(u => u.id === cloudUser.id)) {
          saveRegisteredUsers([...users, cloudUser]);
        }
        setCurrentUser(cloudUser);
        setCurrentUserState(cloudUser);
        loadUserData(cloudUser);
        setCurrentPage('dashboard');
        return { success: true };
      } else if (cloudRes.error && !cloudRes.notFound) {
        return { success: false, error: cloudRes.error };
      }
    }

    return { 
      success: false, 
      error: `No account found for "${identifier}". Please check spelling or switch to Create Account.` 
    };
  };

  const signup = async (data: Omit<UserAccount, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanOwner = data.ownerName.trim();
    const cleanShop = data.shopName.trim();
    const users = getRegisteredUsers();

    if (users.some(u => u.email && u.email.toLowerCase() === cleanEmail && u.id !== DEMO_USER.id)) {
      return { success: false, error: 'An account with this email already exists. Please sign in.' };
    }

    const newUser: UserAccount = {
      ...data,
      shopName: cleanShop,
      ownerName: cleanOwner,
      email: cleanEmail,
      id: 'usr_' + Date.now().toString() + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    saveRegisteredUsers(updatedUsers);
    setCurrentUser(newUser);
    setCurrentUserState(newUser);

    // Initialize fresh account with 0 products and 0 transactions
    loadUserData(newUser);

    // Asynchronously sync new account to Supabase Cloud
    if (isSupabaseConfigured()) {
      syncSignUpToSupabase(newUser).catch(err => console.warn('Supabase signup sync notice:', err));
    }

    setCurrentPage('dashboard');
    return { success: true };
  };

  const loginDemo = () => {
    setCurrentUser(DEMO_USER);
    setCurrentUserState(DEMO_USER);
    loadUserData(DEMO_USER);
    setCurrentPage('dashboard');
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setProductsState([]);
    setTransactionsState([]);
    setCurrentPage('dashboard');
  };

  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    saveAutoSyncEnabled(enabled);
    if (enabled && currentUser && currentUser.id !== DEMO_USER.id && isSupabaseConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
      syncAllToSupabase(currentUser, products, transactions).then(res => {
        if (res.success) {
          const now = new Date().toISOString();
          setLastSyncTime(now);
          setLastAutoSyncTime(now);
          addNotification({
            type: 'success',
            message: 'Auto-sync activated! Synchronized store data with Supabase Cloud.'
          });
        }
      }).catch(err => console.warn('Initial auto-sync notice:', err));
    }
  };

  const syncNow = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Please sign in first.' };
    if (!isSupabaseConfigured()) return { success: false, message: 'Supabase is not configured yet. Please configure Supabase URL & Key.' };

    const res = await syncAllToSupabase(currentUser, products, transactions);
    if (res.success) {
      const now = new Date().toISOString();
      setLastSyncTime(now);
      setLastAutoSyncTime(now);
      addNotification({
        type: 'success',
        message: 'Successfully synchronized data to Supabase Cloud!'
      });
    } else {
      addNotification({
        type: 'error',
        message: res.message || 'Sync encountered an error.'
      });
    }
    return res;
  };

  const setProducts = (p: Product[]) => {
    setProductsState(p);
    if (currentUser) {
      saveUserProducts(currentUser.id, p);
      if (isSupabaseConfigured() && currentUser.id !== DEMO_USER.id && autoSyncEnabled && (typeof navigator === 'undefined' || navigator.onLine)) {
        saveProductsToSupabase(currentUser.id, p).then(ok => {
          if (ok) {
            const now = new Date().toISOString();
            setLastSyncTime(now);
            setLastAutoSyncTime(now);
          }
        }).catch(err => console.warn('Supabase product sync error:', err));
      }
    }
  };

  const setTransactions = (t: Transaction[]) => {
    setTransactionsState(t);
    if (currentUser) {
      saveUserTransactions(currentUser.id, t);
      if (isSupabaseConfigured() && currentUser.id !== DEMO_USER.id && autoSyncEnabled && (typeof navigator === 'undefined' || navigator.onLine) && t.length > 0) {
        saveTransactionToSupabase(currentUser.id, t[0]).then(ok => {
          if (ok) {
            const now = new Date().toISOString();
            setLastSyncTime(now);
            setLastAutoSyncTime(now);
          }
        }).catch(err => console.warn('Supabase transaction sync error:', err));
      }
    }
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    storageSaveLanguage(l);
  };

  const addNotification = (n: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...n,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20));
  };

  const resetDemoData = () => {
    if (currentUser) {
      resetUserData(currentUser.id);
      loadUserData(currentUser);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      products, setProducts,
      transactions, setTransactions,
      language, setLanguage,
      notifications, addNotification,
      currentPage, setCurrentPage,
      ready,
      isCloudConnected,
      autoSyncEnabled,
      setAutoSyncEnabled,
      isOnline,
      lastSyncTime,
      syncNow,
      refreshCloudSync,
      resetDemoData,
      login, signup, loginDemo, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}
