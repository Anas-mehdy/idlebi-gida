-- Migration Script: Add Special Offer support to Products and Order Items

-- Add Special Offer columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_offer BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_title TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'unlimited' CHECK (offer_type IN ('unlimited', 'date_limited', 'stock_limited'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_max_quantity INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_used_quantity INTEGER DEFAULT 0 NOT NULL;

-- Add applied_offer column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS applied_offer TEXT DEFAULT NULL;
