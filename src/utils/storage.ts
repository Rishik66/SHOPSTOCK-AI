import { Product, Transaction, Language } from '../types';

const KEYS = {
  PRODUCTS: 'ss_products',
  TRANSACTIONS: 'ss_transactions',
  LANGUAGE: 'ss_language',
  INITIALIZED: 'ss_initialized',
};

export function saveProducts(products: Product[]): void {
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
}

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(KEYS.PRODUCTS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveLanguage(lang: Language): void {
  localStorage.setItem(KEYS.LANGUAGE, lang);
}

export function loadLanguage(): Language {
  return (localStorage.getItem(KEYS.LANGUAGE) as Language) || 'en';
}

export function isInitialized(): boolean {
  return localStorage.getItem(KEYS.INITIALIZED) === 'true';
}

export function setInitialized(): void {
  localStorage.setItem(KEYS.INITIALIZED, 'true');
}

export function resetAllData(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
