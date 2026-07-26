-- ============================================================
-- Migration: Add atomic inventory adjustment RPC function
-- Date: 2026-07-26
-- Description: Provides an atomic database RPC to increment/decrement
--              inventory stock without read-modify-write race conditions.
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_inventory_stock(product_id UUID, delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_stock INTEGER;
BEGIN
    UPDATE public.products
    SET inventory_stock = inventory_stock + delta
    WHERE id = product_id AND inventory_stock IS NOT NULL
    RETURNING inventory_stock INTO new_stock;

    RETURN new_stock;
END;
$$;

-- Grant EXECUTE permission to anon & authenticated roles for defense-in-depth
GRANT EXECUTE ON FUNCTION adjust_inventory_stock(UUID, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION adjust_inventory_stock(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION adjust_inventory_stock(UUID, INTEGER) TO authenticated;
