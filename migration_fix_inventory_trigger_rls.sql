-- ============================================================
-- Migration: Fix inventory trigger RLS bypass
-- Date: 2026-07-04
-- Issue: When an anonymous (anon) user places an order via the
--        catalog checkout, the trigger function runs with the
--        anon role's permissions. The RLS policy on `products`
--        only allows `authenticated` users to UPDATE, so the
--        trigger's UPDATE on inventory_stock is silently blocked.
--
-- Fix: Recreate the function with SECURITY DEFINER so it
--      executes as the function owner (postgres), bypassing RLS.
--      Also pin search_path to 'public' to prevent search_path
--      hijacking, and use fully-qualified table names.
-- ============================================================

-- 1. Replace the function with SECURITY DEFINER + hardened search_path
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

-- 2. Revoke direct EXECUTE from public roles for defense-in-depth.
--    The trigger will still fire because it's owned by postgres.
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM anon;
REVOKE ALL ON FUNCTION update_inventory_on_order_item_change() FROM authenticated;

-- 3. Drop and recreate the trigger to ensure it's cleanly bound
DROP TRIGGER IF EXISTS trg_update_inventory_on_order_item_change ON public.order_items;

CREATE TRIGGER trg_update_inventory_on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_order_item_change();
