-- Migration: Customer Debt Ledger & Payments System (دفتر الدين وكشف حسابات الزبائن)

-- 1. Add statement_token to customers table (for permanent dedicated statement link)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS statement_token TEXT UNIQUE;

-- Backfill statement_token for existing customers who don't have one
UPDATE customers 
SET statement_token = replace(gen_random_uuid()::text, '-', '')
WHERE statement_token IS NULL;

-- Make sure default statement_token is generated for any new customer
ALTER TABLE customers ALTER COLUMN statement_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- 2. Add customer_id to orders table for direct link
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Automatically link existing orders with customers if name matches exactly
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL AND TRIM(LOWER(o.customer_name)) = TRIM(LOWER(c.name));

-- 3. Create order_payments table (للدفعات المتعددة مع التوضيح)
CREATE TABLE IF NOT EXISTS order_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Allow public read on order_payments (for public statement & invoice view)
DROP POLICY IF EXISTS "Allow public read order_payments" ON order_payments;
CREATE POLICY "Allow public read order_payments" ON order_payments FOR SELECT USING (true);

-- Allow public insert on order_payments (if needed) or admin full control
DROP POLICY IF EXISTS "Allow admin all order_payments" ON order_payments;
CREATE POLICY "Allow admin all order_payments" ON order_payments FOR ALL USING (true);

-- Indexes for lightning fast querying
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_customer_id ON order_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_statement_token ON customers(statement_token);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
