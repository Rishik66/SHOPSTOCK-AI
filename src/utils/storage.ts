import { Product, Transaction, Language, UserAccount, ReviewItem } from '../types';

const KEYS = {
  USERS: 'ss_users',
  USERS_BACKUP: 'ss_users_backup',
  CURRENT_USER: 'ss_current_user',
  LAST_USER: 'ss_last_active_user',
  EXPLICIT_LOGOUT: 'ss_explicit_logout',
  LANGUAGE: 'ss_language',
  REVIEWS: 'ss_reviews',
};

// Cookie utilities for multi-session persistence across browser closes
function setCookie(name: string, value: string, days: number = 365): void {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function removeCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
}

export const DEMO_USER: UserAccount = {
  id: 'demo_ravi',
  email: 'demo@shopstock.ai',
  password: 'demo',
  shopName: 'Ravi General Store',
  ownerName: 'Ravi Kumar',
  category: 'General Store',
  createdAt: '2026-01-01T00:00:00.000Z'
};

// Users management with multi-tier persistence (localStorage + backup key + cookies + individual user records)
export function getRegisteredUsers(): UserAccount[] {
  const usersMap = new Map<string, UserAccount>();

  // Always include DEMO_USER
  usersMap.set(DEMO_USER.id, DEMO_USER);

  // 1. Try reading primary storage
  try {
    const raw = localStorage.getItem(KEYS.USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(u => { if (u && u.id) usersMap.set(u.id, u); });
      }
    }
  } catch {}

  // 2. Try reading backup storage key
  try {
    const rawBackup = localStorage.getItem(KEYS.USERS_BACKUP);
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (Array.isArray(parsed)) {
        parsed.forEach(u => { if (u && u.id) usersMap.set(u.id, u); });
      }
    }
  } catch {}

  // 3. Try reading cookie storage
  try {
    const cookieRaw = getCookie('ss_users_cookie');
    if (cookieRaw) {
      const parsed = JSON.parse(cookieRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach(u => { if (u && u.id) usersMap.set(u.id, u); });
      }
    }
  } catch {}

  // 4. Scan localStorage for individual user account records (ss_user_profile_*)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ss_user_profile_')) {
        const val = localStorage.getItem(key);
        if (val) {
          const u = JSON.parse(val);
          if (u && u.id) usersMap.set(u.id, u);
        }
      }
    }
  } catch {}

  return Array.from(usersMap.values());
}

export function saveRegisteredUsers(users: UserAccount[]): void {
  try {
    // Ensure demo user is always retained
    const map = new Map<string, UserAccount>();
    map.set(DEMO_USER.id, DEMO_USER);
    users.forEach(u => { if (u && u.id) map.set(u.id, u); });
    const fullList = Array.from(map.values());

    const serialized = JSON.stringify(fullList);
    // 1. Primary localStorage
    localStorage.setItem(KEYS.USERS, serialized);
    // 2. Backup localStorage
    localStorage.setItem(KEYS.USERS_BACKUP, serialized);
    // 3. Cookie (max 365 days)
    setCookie('ss_users_cookie', serialized, 365);

    // 4. Save individual records for bulletproof recovery
    users.forEach(u => {
      if (u && u.id && u.id !== DEMO_USER.id) {
        localStorage.setItem(`ss_user_profile_${u.id}`, JSON.stringify(u));
        if (u.email) {
          localStorage.setItem(`ss_user_email_${u.email.toLowerCase().trim()}`, JSON.stringify(u));
        }
        if (u.ownerName) {
          localStorage.setItem(`ss_user_owner_${u.ownerName.toLowerCase().trim()}`, JSON.stringify(u));
        }
      }
    });
  } catch (e) {
    console.warn("Could not save users to storage:", e);
  }
}

export function findUserDirectly(identifier: string): UserAccount | null {
  const clean = identifier.toLowerCase().trim();
  if (!clean) return null;

  // 1. Check all registered users
  const list = getRegisteredUsers();
  const directMatch = list.find(u => 
    (u.email && u.email.toLowerCase().trim() === clean) ||
    (u.ownerName && u.ownerName.toLowerCase().trim() === clean) ||
    (u.shopName && u.shopName.toLowerCase().trim() === clean)
  );
  if (directMatch) return directMatch;

  // 2. Check individual email storage
  try {
    const rawEmail = localStorage.getItem(`ss_user_email_${clean}`);
    if (rawEmail) {
      const u = JSON.parse(rawEmail);
      if (u && u.id) return u;
    }
  } catch {}

  // 3. Check individual owner storage
  try {
    const rawOwner = localStorage.getItem(`ss_user_owner_${clean}`);
    if (rawOwner) {
      const u = JSON.parse(rawOwner);
      if (u && u.id) return u;
    }
  } catch {}

  // 4. Partial search
  if (clean.length >= 3) {
    const partialMatch = list.find(u => 
      (u.email && u.email.toLowerCase().includes(clean)) ||
      (u.ownerName && u.ownerName.toLowerCase().includes(clean)) ||
      (u.shopName && u.shopName.toLowerCase().includes(clean))
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

export function getCurrentUser(): UserAccount | null {
  try {
    // 1. Check primary active user session
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.id) return u;
    }

    // 2. Check cookie active user session
    const cookieUser = getCookie('ss_curr_user');
    if (cookieUser) {
      const u = JSON.parse(cookieUser);
      if (u && u.id) return u;
    }

    // 3. If user didn't explicitly click "Log Out", restore last active user across browser restarts
    const isExplicitLogout = localStorage.getItem(KEYS.EXPLICIT_LOGOUT) === 'true';
    if (!isExplicitLogout) {
      const lastRaw = localStorage.getItem(KEYS.LAST_USER);
      if (lastRaw) {
        const u = JSON.parse(lastRaw);
        if (u && u.id) return u;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  if (user) {
    const serialized = JSON.stringify(user);
    localStorage.setItem(KEYS.CURRENT_USER, serialized);
    localStorage.setItem(KEYS.LAST_USER, serialized);
    setCookie('ss_curr_user', serialized, 90);
    localStorage.removeItem(KEYS.EXPLICIT_LOGOUT);
  } else {
    // Explicit logout
    localStorage.removeItem(KEYS.CURRENT_USER);
    removeCookie('ss_curr_user');
    localStorage.setItem(KEYS.EXPLICIT_LOGOUT, 'true');
  }
}

// User-scoped products
export function saveUserProducts(userId: string, products: Product[]): void {
  try {
    const serialized = JSON.stringify(products);
    localStorage.setItem(`ss_products_${userId}`, serialized);
    localStorage.setItem(`ss_products_${userId}_bak`, serialized);
  } catch (e) {
    console.warn("Could not save user products:", e);
  }
}

export function loadUserProducts(userId: string): Product[] {
  try {
    const raw = localStorage.getItem(`ss_products_${userId}`) || localStorage.getItem(`ss_products_${userId}_bak`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// User-scoped transactions
export function saveUserTransactions(userId: string, transactions: Transaction[]): void {
  try {
    const serialized = JSON.stringify(transactions);
    localStorage.setItem(`ss_transactions_${userId}`, serialized);
    localStorage.setItem(`ss_transactions_${userId}_bak`, serialized);
  } catch (e) {
    console.warn("Could not save user transactions:", e);
  }
}

export function loadUserTransactions(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(`ss_transactions_${userId}`) || localStorage.getItem(`ss_transactions_${userId}_bak`);
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
  localStorage.removeItem(`ss_products_${userId}_bak`);
  localStorage.removeItem(`ss_transactions_${userId}`);
  localStorage.removeItem(`ss_transactions_${userId}_bak`);
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
