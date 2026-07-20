-- ============================================================
-- TEST: Verify inventory trigger works for both anon and admin
-- Date: 2026-07-04
-- 
-- Run this AFTER applying migration_fix_inventory_trigger_rls.sql
-- Run each section sequentially in Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- SETUP: Create test product and test order
-- ============================================================

-- 1. Create a test product with tracked inventory (stock = 100)
INSERT INTO public.products (id, name, price, category_id, inventory_stock)
VALUES (
    '00000000-0000-0000-0000-000000000099'::uuid,
    '__TEST_PRODUCT_INVENTORY__',
    10.00,
    (SELECT id FROM public.categories LIMIT 1),
    100
);

-- 2. Create a test order
INSERT INTO public.orders (id, customer_name, total_price, status)
VALUES (
    '00000000-0000-0000-0000-000000000098'::uuid,
    '__TEST_ORDER__',
    0,
    'pending'
);

-- 3. Verify starting stock
SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- Expected: inventory_stock = 100


-- ============================================================
-- TEST 1: INSERT (simulates customer checkout via anon)
-- Anon user inserts an order_item → stock should decrease
-- ============================================================

-- Switch to anon role to simulate customer checkout
SET ROLE anon;

INSERT INTO public.order_items (id, order_id, product_id, quantity, price_at_purchase)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000098'::uuid,
    '00000000-0000-0000-0000-000000000099'::uuid,
    5,
    10.00
);

-- Switch back to postgres to check the result
RESET ROLE;

SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- ✅ Expected: inventory_stock = 95 (was 100, decreased by 5)


-- ============================================================
-- TEST 2: UPDATE quantity (simulates admin editing quantity)
-- Admin updates quantity from 5 → 8 → stock should decrease by 3 more
-- ============================================================

-- Switch to authenticated role to simulate admin
SET ROLE authenticated;

UPDATE public.order_items
SET quantity = 8
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

RESET ROLE;

SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- ✅ Expected: inventory_stock = 92 (was 95, decreased by 3 more)


-- ============================================================
-- TEST 3: UPDATE quantity down (admin reduces quantity)
-- Admin updates quantity from 8 → 3 → stock should increase by 5
-- ============================================================

SET ROLE authenticated;

UPDATE public.order_items
SET quantity = 3
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

RESET ROLE;

SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- ✅ Expected: inventory_stock = 97 (was 92, increased by 5)


-- ============================================================
-- TEST 4: DELETE (admin cancels/removes an order item)
-- Delete the order_item → stock should be fully restored
-- ============================================================

SET ROLE authenticated;

DELETE FROM public.order_items
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

RESET ROLE;

SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- ✅ Expected: inventory_stock = 100 (was 97, restored 3 from the remaining item)


-- ============================================================
-- TEST 5: INSERT with NULL product_id (custom product)
-- Should NOT affect any inventory
-- ============================================================

SET ROLE anon;

INSERT INTO public.order_items (id, order_id, product_id, quantity, price_at_purchase, product_name)
VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000098'::uuid,
    NULL,  -- custom product, no product_id
    10,
    5.00,
    'منتج مخصص للاختبار'
);

RESET ROLE;

SELECT name, inventory_stock 
FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;
-- ✅ Expected: inventory_stock = 100 (unchanged — NULL product_id is ignored)


-- ============================================================
-- TEST 6: Verify trigger is correctly bound
-- ============================================================

SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.order_items'::regclass
  AND tgname = 'trg_update_inventory_on_order_item_change';
-- ✅ Expected: One row showing the trigger is enabled and bound to INSERT/UPDATE/DELETE


-- ============================================================
-- TEST 7: Verify function is SECURITY DEFINER with correct search_path
-- ============================================================

SELECT 
    proname AS function_name,
    prosecdef AS is_security_definer,
    proconfig AS config
FROM pg_proc
WHERE proname = 'update_inventory_on_order_item_change';
-- ✅ Expected: is_security_definer = true, config includes search_path=public


-- ============================================================
-- CLEANUP: Remove all test data
-- ============================================================

-- Delete test order (CASCADE will delete order_items too)
DELETE FROM public.orders 
WHERE id = '00000000-0000-0000-0000-000000000098'::uuid;

-- Delete test product
DELETE FROM public.products 
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid;

-- Final verification: no test data remains
SELECT count(*) AS remaining_test_products 
FROM public.products 
WHERE name = '__TEST_PRODUCT_INVENTORY__';
-- ✅ Expected: 0

SELECT count(*) AS remaining_test_orders 
FROM public.orders 
WHERE customer_name = '__TEST_ORDER__';
-- ✅ Expected: 0
