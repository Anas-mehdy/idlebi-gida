-- Database Schema & Migrations for "idelbi gida" WhatsApp Catalog MVP

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(10, 2) NOT NULL CHECK (price_at_purchase >= 0)
);

-- 5. Create settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed default settings (for WhatsApp number)
INSERT INTO settings (key, value) 
VALUES ('whatsapp_number', '905000000000')
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- Row Level Security (RLS) Policies
-- ----------------------------------------------------

-- Categories Policies
CREATE POLICY "Allow public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow admin all categories" ON categories FOR ALL TO authenticated USING (true);

-- Products Policies
CREATE POLICY "Allow public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow admin all products" ON products FOR ALL TO authenticated USING (true);

-- Orders Policies
CREATE POLICY "Allow public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin all orders" ON orders FOR ALL TO authenticated USING (true);

-- Order Items Policies
CREATE POLICY "Allow public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin all order_items" ON order_items FOR ALL TO authenticated USING (true);

-- Settings Policies
CREATE POLICY "Allow public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Allow admin all settings" ON settings FOR ALL TO authenticated USING (true);

-- ----------------------------------------------------
-- Migrations & Alterations
-- ----------------------------------------------------

-- Migration: Add is_hidden column to products table (unhide/hide feature)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE NOT NULL;

-- Migration: Make product price optional/nullable in products and order_items
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;
ALTER TABLE order_items ALTER COLUMN price_at_purchase DROP NOT NULL;

-- Migration: Add sort_order to categories table (drag & drop sorting)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Migration: Allow public select on orders and order_items (to view priced invoices)
DROP POLICY IF EXISTS "Allow public select orders" ON orders;
CREATE POLICY "Allow public select orders" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public select order_items" ON order_items;
CREATE POLICY "Allow public select order_items" ON order_items FOR SELECT USING (true);

-- Migration: Update status check constraint to allow 'postponed' orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'delivered', 'postponed'));

-- Migration: Create customers table and policies
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read customers" ON customers;
CREATE POLICY "Allow public read customers" ON customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin all customers" ON customers;
CREATE POLICY "Allow admin all customers" ON customers FOR ALL TO authenticated USING (true);


-- Migration: Add inventory_stock column to products table (NULL means not tracked in inventory)
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_stock INTEGER DEFAULT NULL;

-- Migration: Create trigger to automatically decrement/increment inventory stock when order items are changed
--            Uses SECURITY DEFINER to bypass RLS (so anon checkout can update products.inventory_stock)
--            search_path pinned to 'public' to prevent search_path hijacking
CREATE OR REPLACE FUNCTION update_inventory_on_order_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Handle INSERT: decrement stock for the new product
    IF (TG_OP = 'INSERT') THEN
        IF NEW.product_id IS NOT NULL THEN
            UPDATE public.products
            SET inventory_stock = inventory_stock - NEW.quantity
            WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
        END IF;
        RETURN NEW;

    -- Handle UPDATE: adjust stock by the difference
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case 1: product_id changed (rare, but handled)
        IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN
            -- Restore stock to old product
            IF OLD.product_id IS NOT NULL THEN
                UPDATE public.products
                SET inventory_stock = inventory_stock + OLD.quantity
                WHERE id = OLD.product_id AND inventory_stock IS NOT NULL;
            END IF;
            -- Subtract stock from new product
            IF NEW.product_id IS NOT NULL THEN
                UPDATE public.products
                SET inventory_stock = inventory_stock - NEW.quantity
                WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
            END IF;
        ELSE
            -- Case 2: same product, quantity changed
            IF NEW.product_id IS NOT NULL AND OLD.quantity IS DISTINCT FROM NEW.quantity THEN
                UPDATE public.products
                SET inventory_stock = inventory_stock + (OLD.quantity - NEW.quantity)
                WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
            END IF;
        END IF;
        RETURN NEW;

    -- Handle DELETE: restore stock for the removed product
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.product_id IS NOT NULL THEN
            UPDATE public.products
            SET inventory_stock = inventory_stock + OLD.quantity
            WHERE id = OLD.product_id AND inventory_stock IS NOT NULL;
        END IF;
        RETURN OLD;
    END IF;

    -- Fallback (should never reach here)
    RETURN NULL;
END;
$$;

-- Revoke direct EXECUTE from public roles for defense-in-depth
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM anon;
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_update_inventory_on_order_item_change ON public.order_items;

CREATE TRIGGER trg_update_inventory_on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_order_item_change();

-- Migration: Add Special Offer columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_offer BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_title TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'unlimited' CHECK (offer_type IN ('unlimited', 'date_limited', 'stock_limited'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_max_quantity INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_used_quantity INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;

-- Migration: Add applied_offer column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS applied_offer TEXT DEFAULT NULL;

-- Migration: Customer Devices Approval & Price Visibility System
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 2 NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

CREATE TABLE IF NOT EXISTS customer_access_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS customer_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_token_hash TEXT NOT NULL UNIQUE,
    fingerprint_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked', 'revoked')),
    device_name TEXT,
    browser TEXT,
    operating_system TEXT,
    user_agent TEXT,
    first_ip TEXT,
    last_ip TEXT,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    blocked_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS customer_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES customer_devices(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    device_id UUID REFERENCES customer_devices(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customer_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin all customer_access_links" ON customer_access_links;
CREATE POLICY "Allow admin all customer_access_links" ON customer_access_links FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all customer_devices" ON customer_devices;
CREATE POLICY "Allow admin all customer_devices" ON customer_devices FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all customer_sessions" ON customer_sessions;
CREATE POLICY "Allow admin all customer_sessions" ON customer_sessions FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all security_events" ON security_events;
CREATE POLICY "Allow admin all security_events" ON security_events FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_access_links_token ON customer_access_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_devices_token ON customer_devices(device_token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_devices_customer ON customer_devices(customer_id);






