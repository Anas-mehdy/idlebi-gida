-- Migration: Add note column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;
