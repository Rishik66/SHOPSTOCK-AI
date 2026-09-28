import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Transaction, Language, AppNotification, Page, UserAccount } from '../types';
import {
  getCurrentUser,
  setCurrentUser,
  getRegisteredUsers,
  saveRegisteredUsers,
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

export const DEMO_USER: UserAccount = {
  id: 'demo_ravi',
  email: 'demo@shopstock.ai',
  password: 'demo',
  shopName: 'Ravi General Store',
  ownerName: 'Ravi Kumar',
  category: 'General Store',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const DEMO_PRODUCTS: Product[] = [
  { id: '1', name: 'Maggi', category: 'Noodles', stock: 8, purchasePrice: 12, sellingPrice: 14, minimumStock: 10 },
  { id: '2', name: 'Parle-G Biscuits', category: 'Biscuits', stock: 25, purchasePrice: 8, sellingPrice: 10, minimumStock: 20 },
  { id: '3', name: 'Aashirvaad Atta', category: 'Flour', stock: 15, purchasePrice: 55, sellingPrice: 65, minimumStock: 10 },
  { id: '4', name: 'Tata Salt', category: 'Spices', stock: 30, purchasePrice: 20, sellingPrice: 25, minimumStock: 15 },
  { id: '5', name: 'Amul Milk', category: 'Dairy', stock: 5, purchasePrice: 54, sellingPrice: 60, minimumStock: 10 },
  { id: '6', name: 'Coca-Cola', category: 'Beverages', stock: 18, purchasePrice: 38, sellingPrice: 45, minimumStock: 12 },
  { id: '7', name: 'Britannia Bread', category: 'Bakery', stock: 7, purchasePrice: 38, sellingPrice: 45, minimumStock: 10 },
  { id: '8', name: 'Surf Excel', category: 'Detergent', stock: 12, purchasePrice: 55, sellingPrice: 65, minimumStock: 8 },
  { id: '9', name: 'Colgate', category: 'Personal Care', stock: 20, purchasePrice: 75, sellingPrice: 90, minimumStock: 10 },
  { id: '10', name: 'Thums Up', category: 'Beverages', stock: 22, purchasePrice: 38, sellingPrice: 45, minimumStock: 12 },
];

function generateDemoTransactions(products: Product[]): Transaction[] {
  const today = new Date();
  const txns: Transaction[] = [];
  
  const makeDate = (daysAgo: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };
  
  const makeItem = (productId: string, qty: number) => {
    const p = products.find(x => x.id === productId)!;
    return {
      productId: p.id,
      productName: p.name,
      quantity: qty,
      sellingPrice: p.sellingPrice,
      purchasePrice: p.purchasePrice,
    };
  };
  
  const makeTxn = (id: string, date: string, items: any[]): Transaction => ({
    id,
    date,
    items,
    total: items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0),
    profit: items.reduce((s, i) => s + (i.sellingPrice - i.purchasePrice) * i.quantity, 0),
  });
  
  txns.push(makeTxn('d1', makeDate(6), [makeItem('1', 3), makeItem('2', 5), makeItem('5', 2)]));
  txns.push(makeTxn('d2', makeDate(5), [makeItem('1', 4), makeItem('9', 2), makeItem('6', 3)]));
  txns.push(makeTxn('d3', makeDate(4), [makeItem('2', 8), makeItem('5', 3), makeItem('3', 1)]));
  txns.push(makeTxn('d4', makeDate(3), [makeItem('1', 5), makeItem('10', 4), makeItem('7', 2)]));
  txns.push(makeTxn('d5', makeDate(2), [makeItem('1', 6), makeItem('5', 4), makeItem('4', 3)]));
  txns.push(makeTxn('d6', makeDate(1), [makeItem('2', 10), makeItem('8', 2), makeItem('6', 5)]));
  txns.push(makeTxn('t1', makeDate(0), [makeItem('1', 2), makeItem('5', 1)]));
  txns.push(makeTxn('t2', makeDate(0), [makeItem('2', 4), makeItem('3', 1), makeItem('9', 1)]));
  
  return txns;
}

interface AppContextType {
  currentUser: UserAccount | null;
  products: Product[];
  transactions: Transaction[];
  language: Language;
  notifications: AppNotification[];
  currentPage: Page;
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
      if (userId === DEMO_USER.id) {
        // Pre-populate demo store for Ravi General Store
        saveUserProducts(userId, DEMO_PRODUCTS);
        const demoTxns = generateDemoTransactions(DEMO_PRODUCTS);
        saveUserTransactions(userId, demoTxns);
        setUserInitialized(userId);
        setProductsState(DEMO_PRODUCTS);
        setTransactionsState(demoTxns);
      } else {
        // New real user gets full standard Kirana product catalog so all voice commands work immediately
        saveUserProducts(userId, DEMO_PRODUCTS);
        saveUserTransactions(userId, []);
        setUserInitialized(userId);
        setProductsState(DEMO_PRODUCTS);
        setTransactionsState([]);
      }
    } else {
      const loaded = loadUserProducts(userId);
      // Upgrade existing user accounts that had the dummy "Sample Item" placeholders to real Kirana catalog
      if (loaded.length === 0 || (loaded.length <= 2 && loaded.some(p => p.name.includes('Sample Item')))) {
        saveUserProducts(userId, DEMO_PRODUCTS);
        setProductsState(DEMO_PRODUCTS);
      } else {
        setProductsState(loaded);
      }
      setTransactionsState(loadUserTransactions(userId));
    }
  };

  useEffect(() => {
    // Load language preference
    const lang = loadLanguage();
    setLanguageState(lang);

    // Ensure demo user exists in registered users
    const users = getRegisteredUsers();
    if (!users.some(u => u.email === DEMO_USER.email)) {
      saveRegisteredUsers([...users, DEMO_USER]);
    }

    // Load active session
    const savedUser = getCurrentUser();
    if (savedUser) {
      setCurrentUserState(savedUser);
      loadUserData(savedUser);
    }

    setReady(true);
  }, []);

  const login = (identifier: string, pass: string): { success: boolean; error?: string } => {
    const clean = identifier.trim().toLowerCase();
    if (!clean) {
      return { success: false, error: 'Please enter your email, owner name, or shop name.' };
    }

    const users = getRegisteredUsers();
    
    // Look up by email, ownerName, or shopName
    const user = users.find(u => 
      u.email.toLowerCase() === clean ||
      u.ownerName.toLowerCase() === clean ||
      u.shopName.toLowerCase() === clean ||
      (clean.length >= 3 && (
        u.email.toLowerCase().includes(clean) ||
        u.ownerName.toLowerCase().includes(clean) ||
        u.shopName.toLowerCase().includes(clean)
      ))
    );

    if (!user) {
      return { 
        success: false, 
        error: `No account found for "${identifier}". Please check your spelling or switch to Create Account.` 
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

    if (users.some(u => u.email.toLowerCase() === cleanEmail && u.email !== DEMO_USER.email)) {
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

  if (!ready) return null;

  return (
    <AppContext.Provider value={{
      currentUser,
      products, setProducts,
      transactions, setTransactions,
      language, setLanguage,
      notifications, addNotification,
      currentPage, setCurrentPage,
      resetDemoData,
      login, signup, loginDemo, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}
