export type Language = 'en' | 'te' | 'hi' | 'kn';
export type Page = 'dashboard' | 'inventory' | 'billing' | 'ai-assistant' | 'smart-restock' | 'invoice-scanner' | 'reviews';

export interface ReviewItem {
  id: string;
  name: string;
  shopName: string;
  rating: number;
  category: string;
  comment: string;
  date: string;
}

export interface UserAccount {
  id: string;
  email: string;
  password: string;
  shopName: string;
  ownerName: string;
  category: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  purchasePrice: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  total: number;
  profit: number;
}

export interface AppNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface AIAction {
  type: 'ADD_STOCK' | 'REMOVE_STOCK';
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
  newStock: number;
}
