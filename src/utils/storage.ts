import { Product, Transaction, Language, UserAccount, ReviewItem } from '../types';

const KEYS = {
  USERS: 'ss_users',
  CURRENT_USER: 'ss_current_user',
  LANGUAGE: 'ss_language',
  REVIEWS: 'ss_reviews',
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

const DEFAULT_REVIEWS: ReviewItem[] = [
  {
    id: 'rev_1',
    name: 'Ramesh Patel',
    shopName: 'Patel Kirana & General Store',
    rating: 5,
    category: 'Billing & POS',
    comment: 'Billing is so simple and fast! Even during peak evening rush, bills are done in 10 seconds. Excellent app for Indian shops.',
    date: '2026-09-24T10:30:00.000Z'
  },
  {
    id: 'rev_2',
    name: 'Suresh Reddy',
    shopName: 'Sri Venkateshwara Provisions',
    rating: 5,
    category: 'AI Assistant',
    comment: 'Voice assistant in Telugu and Hindi is a game changer. I just speak "Add 20 Maggi" or "What is today sales" and it handles it instantly.',
    date: '2026-09-26T14:15:00.000Z'
  },
  {
    id: 'rev_3',
    name: 'Anand Sharma',
    shopName: 'Sharma Dairy & Daily Needs',
    rating: 5,
    category: 'Smart Restock',
    comment: 'The restock calculator tells me exactly how many days of milk and bread stock are left. No more stockouts or wastage!',
    date: '2026-09-27T09:45:00.000Z'
  },
  {
    id: 'rev_4',
    name: 'Manjunath Swamy',
    shopName: 'Bangalore Daily Supermarket',
    rating: 4,
    category: 'Ease of Use',
    comment: 'Very clean and easy to use. No complicated setup, works directly on my mobile phone browser.',
    date: '2026-09-28T08:00:00.000Z'
  }
];

export function loadReviews(): ReviewItem[] {
  try {
    const raw = localStorage.getItem(KEYS.REVIEWS);
    if (!raw) {
      localStorage.setItem(KEYS.REVIEWS, JSON.stringify(DEFAULT_REVIEWS));
      return DEFAULT_REVIEWS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_REVIEWS;
  }
}

export function saveReviews(reviews: ReviewItem[]): void {
  localStorage.setItem(KEYS.REVIEWS, JSON.stringify(reviews));
}

