import { Product, Transaction, UserAccount } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface SupabaseSyncStatus {
  connected: boolean;
  syncedAt?: string;
  error?: string;
}

/**
 * Syncs user registration with Supabase shop_users table
 */
export async function syncSignUpToSupabase(user: UserAccount): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const userPayload: any = {
      id: user.id,
      email: user.email ? user.email.toLowerCase().trim() : '',
      password: user.password,
      shop_name: user.shopName,
      owner_name: user.ownerName,
      category: user.category || 'General Store',
      created_at: user.createdAt || new Date().toISOString()
    };
    if (user.phone) {
      userPayload.phone = user.phone.trim();
    }

    const { error } = await client.from('shop_users').upsert(userPayload);

    if (error) {
      console.warn("Supabase user signup sync notice:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase user signup sync error:", err);
    return false;
  }
}

/**
 * Checks credentials in Supabase when logging in (allows login across multiple devices via phone, email, or name)
 */
export async function syncSignInWithSupabase(
  identifier: string,
  pass: string
): Promise<{ success: boolean; user?: UserAccount; error?: string; notFound?: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, notFound: true };

  const clean = identifier.toLowerCase().trim();
  const cleanDigits = clean.replace(/\D/g, '');

  try {
    let matchedUser: any = null;

    // 1. Look up by email
    const { data: emailData } = await client
      .from('shop_users')
      .select('*')
      .eq('email', clean)
      .maybeSingle();

    if (emailData) matchedUser = emailData;

    // 2. Look up by phone if 10+ digits
    if (!matchedUser && cleanDigits.length >= 10) {
      const { data: phoneData } = await client
        .from('shop_users')
        .select('*')
        .eq('phone', cleanDigits.slice(-10))
        .maybeSingle();
      if (phoneData) matchedUser = phoneData;
    }

    // 3. If not found by email/phone, check owner_name or shop_name
    if (!matchedUser) {
      const { data: nameData } = await client
        .from('shop_users')
        .select('*')
        .or(`owner_name.ilike.${clean},shop_name.ilike.${clean}`)
        .limit(1);

      if (nameData && nameData.length > 0) {
        matchedUser = nameData[0];
      }
    }

    if (!matchedUser) {
      return { success: false, notFound: true };
    }

    if (matchedUser.password !== pass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const user: UserAccount = {
      id: matchedUser.id,
      email: matchedUser.email,
      phone: matchedUser.phone || undefined,
      password: matchedUser.password,
      shopName: matchedUser.shop_name,
      ownerName: matchedUser.owner_name,
      category: matchedUser.category || 'General Store',
      createdAt: matchedUser.created_at
    };

    return { success: true, user };
  } catch (err: any) {
    console.warn("Supabase login check error:", err);
    return { success: false, notFound: true, error: err?.message };
  }
}

/**
 * Updates user password in Supabase
 */
export async function syncUpdatePasswordInSupabase(userId: string, newPassword: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client
      .from('shop_users')
      .update({ password: newPassword })
      .eq('id', userId);
    return !error;
  } catch (err) {
    console.warn("Supabase password update error:", err);
    return false;
  }
}

/**
 * Fetches store products from Supabase for this user
 */
export async function fetchProductsFromSupabase(userId: string): Promise<Product[] | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;

  try {
    const { data, error } = await client
      .from('shop_products')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.warn("Error loading products from Supabase:", error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      stock: Number(row.stock),
      purchasePrice: Number(row.purchase_price),
      sellingPrice: Number(row.selling_price),
      minimumStock: Number(row.minimum_stock),
      barcode: row.barcode || undefined
    }));
  } catch (err) {
    console.warn("Supabase fetch products error:", err);
    return null;
  }
}

/**
 * Saves/upserts products to Supabase for this user
 */
export async function saveProductsToSupabase(userId: string, products: Product[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    if (products.length === 0) {
      // Clear user products in Supabase
      await client.from('shop_products').delete().eq('user_id', userId);
      return true;
    }

    const rows = products.map(p => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      category: p.category,
      stock: p.stock,
      purchase_price: p.purchasePrice,
      selling_price: p.sellingPrice,
      minimum_stock: p.minimumStock,
      barcode: p.barcode || null,
      updated_at: new Date().toISOString()
    }));

    // Upsert products
    const { error: upsertError } = await client.from('shop_products').upsert(rows);
    if (upsertError) {
      console.warn("Supabase products upsert notice:", upsertError.message);
      return false;
    }

    // Delete any products removed from inventory
    const currentIds = products.map(p => p.id);
    await client
      .from('shop_products')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${currentIds.join(',')})`);

    return true;
  } catch (err) {
    console.warn("Supabase save products error:", err);
    return false;
  }
}

/**
 * Fetches sales transactions from Supabase for this user
 */
export async function fetchTransactionsFromSupabase(userId: string): Promise<Transaction[] | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;

  try {
    const { data, error } = await client
      .from('shop_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Error loading transactions from Supabase:", error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
      total: Number(row.total),
      profit: Number(row.profit)
    }));
  } catch (err) {
    console.warn("Supabase fetch transactions error:", err);
    return null;
  }
}

/**
 * Inserts a new completed transaction into Supabase
 */
export async function saveTransactionToSupabase(userId: string, tx: Transaction): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    const { error } = await client.from('shop_transactions').insert({
      id: tx.id,
      user_id: userId,
      date: tx.date,
      items: tx.items,
      total: tx.total,
      profit: tx.profit,
      created_at: tx.date || new Date().toISOString()
    });

    if (error) {
      console.warn("Supabase save transaction notice:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase save transaction error:", err);
    return false;
  }
}

/**
 * Full two-way sync: Pushes all local data to Supabase and returns updated state
 */
export async function syncAllToSupabase(
  user: UserAccount,
  products: Product[],
  transactions: Transaction[]
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase is not configured yet. Please enter your Supabase URL & Key.' };
  }

  try {
    // 1. Ensure user profile exists
    await syncSignUpToSupabase(user);

    // 2. Save products
    await saveProductsToSupabase(user.id, products);

    // 3. Save transactions
    for (const tx of transactions) {
      await saveTransactionToSupabase(user.id, tx);
    }

    return { 
      success: true, 
      message: `Successfully synchronized ${products.length} products and ${transactions.length} sales to Supabase Cloud Database!` 
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Sync encountered an error.' };
  }
}

const AUTO_SYNC_KEY = 'ss_auto_sync_enabled';
const LAST_SYNC_KEY = 'ss_last_sync_time';

/**
 * Checks whether automatic sync is enabled. Defaults to true.
 */
export function isAutoSyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_SYNC_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Sets the auto-sync preference in localStorage so it stays active across sessions
 */
export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save auto sync setting', e);
  }
}

/**
 * Gets the timestamp string of the last successful sync
 */
export function getLastAutoSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Updates the timestamp of the last successful sync
 */
export function setLastAutoSyncTime(timestamp: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, timestamp);
  } catch (e) {
    console.warn('Failed to save last sync time', e);
  }
}

