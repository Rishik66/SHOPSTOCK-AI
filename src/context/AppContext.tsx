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

export { DEMO_USER };

const DEMO_PRODUCT_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const DEMO_PRODUCT_NAMES = new Set([
  'maggi', 'parle-g biscuits', 'aashirvaad atta', 'tata salt', 'amul milk',
  'coca-cola', 'britannia bread', 'surf excel', 'colgate', 'thums up'
]);
const DEMO_TXN_IDS = new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 't1', 't2']);

const DEMO_PRODUCTS: Product[] = [];

function generateDemoTransactions(_products: Product[]): Transaction[] {
  return [];
}

interface AppContextType {
  currentUser: UserAccount | null;
  products: Product[];
  transactions: Transaction[];
  language: Language;
  notifications: AppNotification[];
  currentPage: Page;
  ready: boolean;
  setProducts: (products: Product[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setLanguage: (lang: Language) => void;
  setCurrentPage: (page: Page) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  resetDemoData: () => void;
  login: (email: string, pass: string) => { success: boolean; error?: string };
  signup: (data: Omit<UserAccount, 'id' | 'createdAt'>) => { success: boolean; error?: string };
  loginDemo: () => void;
  logout: () => void;
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
      // Load user products and transactions, stripping any legacy demo sample products
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
  };

  useEffect(() => {
    // 1. Load language preference
    const lang = loadLanguage();
    setLanguageState(lang);

    // 2. Ensure registered users list is initialized
    const users = getRegisteredUsers();
    saveRegisteredUsers(users);

    // 3. Load active session across browser closes
    const savedUser = getCurrentUser();
    if (savedUser) {
      setCurrentUserState(savedUser);
      loadUserData(savedUser);
    }

    setReady(true);
  }, []);

  const login = (identifier: string, pass: string): { success: boolean; error?: string } => {
    const clean = identifier.trim();
    if (!clean) {
      return { success: false, error: 'Please enter your email, owner name, or shop name.' };
    }

    // Direct and robust user lookup with backup scanning
    const user = findUserDirectly(clean);

    if (!user) {
      return { 
        success: false, 
        error: `No account found for "${identifier}". Please check spelling or switch to Create Account.` 
      };
    }

    if (user.password !== pass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    setCurrentUser(user);
    setCurrentUserState(user);
    loadUserData(user);
    setCurrentPage('dashboard');
    return { success: true };
  };

  const signup = (data: Omit<UserAccount, 'id' | 'createdAt'>): { success: boolean; error?: string } => {
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

  const setProducts = (p: Product[]) => {
    setProductsState(p);
    if (currentUser) {
      saveUserProducts(currentUser.id, p);
    }
  };

  const setTransactions = (t: Transaction[]) => {
    setTransactionsState(t);
    if (currentUser) {
      saveUserTransactions(currentUser.id, t);
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
      resetDemoData,
      login, signup, loginDemo, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}
