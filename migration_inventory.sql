-- 1. Add inventory_stock column to products table (NULL means not tracked in inventory)
-- Allows negative values as requested by the user. No CHECK constraint is added.
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_stock INTEGER DEFAULT NULL;

-- 2. Create trigger to automatically decrement/increment inventory stock when order items are changed
CREATE OR REPLACE FUNCTION update_inventory_on_order_item_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.product_id IS NOT NULL THEN
            UPDATE products 
            SET inventory_stock = inventory_stock - NEW.quantity
            WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
        END IF;
        
    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If product_id changed (unlikely, but handled just in case)
        IF OLD.product_id IS NOT NULL AND OLD.product_id <> COALESCE(NEW.product_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            -- Add back to old product
            UPDATE products 
            SET inventory_stock = inventory_stock + OLD.quantity
            WHERE id = OLD.product_id AND inventory_stock IS NOT NULL;
            
            -- Subtract from new product
            IF NEW.product_id IS NOT NULL THEN
                UPDATE products 
                SET inventory_stock = inventory_stock - NEW.quantity
                WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
            END IF;
        ELSE
            -- Same product, update by the difference
            IF NEW.product_id IS NOT NULL THEN
                UPDATE products 
                SET inventory_stock = inventory_stock + (OLD.quantity - NEW.quantity)
                WHERE id = NEW.product_id AND inventory_stock IS NOT NULL;
            END IF;
        END IF;
        
    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.product_id IS NOT NULL THEN
            UPDATE products 
            SET inventory_stock = inventory_stock + OLD.quantity
            WHERE id = OLD.product_id AND inventory_stock IS NOT NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Drop existing trigger if it exists and create the new one
DROP TRIGGER IF EXISTS trg_update_inventory_on_order_item_change ON order_items;

CREATE TRIGGER trg_update_inventory_on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_order_item_change();
