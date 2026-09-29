-- ==============================================================================
-- 🚀 SMARTSTOCK AI / SHOPSTOCK AI - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Run this script in your Supabase SQL Editor:
-- 1. Go to https://supabase.com/dashboard/project/_/sql
-- 2. Paste this entire script
-- 3. Click "RUN"
-- ==============================================================================

-- 1. Create shop_users table (stores shop owner profiles & login details)
CREATE TABLE IF NOT EXISTS public.shop_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  category TEXT DEFAULT 'General Store',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shop_products table (stores inventory items scoped by user_id)
CREATE TABLE IF NOT EXISTS public.shop_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.shop_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 5,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create shop_transactions table (stores sales & profit records)
CREATE TABLE IF NOT EXISTS public.shop_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.shop_users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies for Client-Side Access (Public Anon Key)
DROP POLICY IF EXISTS "Allow public all on shop_users" ON public.shop_users;
CREATE POLICY "Allow public all on shop_users" ON public.shop_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on shop_products" ON public.shop_products;
CREATE POLICY "Allow public all on shop_products" ON public.shop_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on shop_transactions" ON public.shop_transactions;
CREATE POLICY "Allow public all on shop_transactions" ON public.shop_transactions FOR ALL USING (true) WITH CHECK (true);

-- 6. High-performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_products_user ON public.shop_products(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.shop_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.shop_users(email);
