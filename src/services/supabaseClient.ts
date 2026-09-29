import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  URL: 'ss_supabase_url',
  ANON_KEY: 'ss_supabase_anon_key',
  ENABLED: 'ss_supabase_enabled'
};

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = (localStorage.getItem(STORAGE_KEYS.URL) || '').trim();
    localKey = (localStorage.getItem(STORAGE_KEYS.ANON_KEY) || '').trim();
  } catch {}

  const url = localUrl || envUrl;
  const key = localKey || envKey;

  return { url, key };
}

export function saveSupabaseConfig(url: string, key: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.URL, url.trim());
    localStorage.setItem(STORAGE_KEYS.ANON_KEY, key.trim());
    localStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
    cachedClient = null;
  } catch {}
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.URL);
    localStorage.removeItem(STORAGE_KEYS.ANON_KEY);
    localStorage.removeItem(STORAGE_KEYS.ENABLED);
    cachedClient = null;
  } catch {}
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url.startsWith('http') && key.length > 10);
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || !url.startsWith('http') || key.length < 10) {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.warn("Failed to initialize Supabase client:", err);
    return null;
  }
}

export async function testSupabaseConnection(overrideUrl?: string, overrideKey?: string): Promise<{ success: boolean; message: string }> {
  const url = (overrideUrl || getSupabaseConfig().url).trim();
  const key = (overrideKey || getSupabaseConfig().key).trim();

  if (!url || !key) {
    return { success: false, message: 'Please provide both Supabase Project URL and Anon API Key.' };
  }

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return { success: false, message: 'Project URL must start with https://' };
  }

  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.from('shop_users').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Connected to Supabase! Note: Please run the SQL schema in your Supabase SQL Editor to create tables.' 
        };
      }
      return { success: false, message: `Supabase response: ${error.message}` };
    }

    return { success: true, message: 'Successfully connected to Supabase Cloud Database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error connecting to Supabase.' };
  }
}
