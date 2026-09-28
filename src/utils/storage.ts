import { Product, Transaction, Language, UserAccount } from '../types';

const KEYS = {
  USERS: 'ss_users',
  CURRENT_USER: 'ss_current_user',
  LANGUAGE: 'ss_language',
};

// Users management
export function getRegisteredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUsers(users: UserAccount[]): void {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  if (user) {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(KEYS.CURRENT_USER);
  }
}

// User-scoped products
export function saveUserProducts(userId: string, products: Product[]): void {
  localStorage.setItem(`ss_products_${userId}`, JSON.stringify(products));
}

export function loadUserProducts(userId: string): Product[] {
  try {
    const raw = localStorage.getItem(`ss_products_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// User-scoped transactions
export function saveUserTransactions(userId: string, transactions: Transaction[]): void {
  localStorage.setItem(`ss_transactions_${userId}`, JSON.stringify(transactions));
}

export function loadUserTransactions(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(`ss_transactions_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// User initialization flag
export function isUserInitialized(userId: string): boolean {
  return localStorage.getItem(`ss_initialized_${userId}`) === 'true';
}

export function setUserInitialized(userId: string): void {
  localStorage.setItem(`ss_initialized_${userId}`, 'true');
}

export function resetUserData(userId: string): void {
  localStorage.removeItem(`ss_products_${userId}`);
  localStorage.removeItem(`ss_transactions_${userId}`);
  localStorage.removeItem(`ss_initialized_${userId}`);
}

// Language
export function saveLanguage(lang: Language): void {
  localStorage.setItem(KEYS.LANGUAGE, lang);
}

export function loadLanguage(): Language {
  return (localStorage.getItem(KEYS.LANGUAGE) as Language) || 'en';
}
