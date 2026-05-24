-- Database Seed Script for "idelbi gida" WhatsApp Catalog
-- Copy and paste this script directly into the Supabase SQL Editor to seed demonstration data.

-- 1. Clear any existing demo data to prevent unique constraints issues (Optional)
TRUNCATE categories, products, orders, order_items RESTART IDENTITY CASCADE;

-- 2. Seed data utilizing CTE (Common Table Expressions) for seamless UUID mapping
WITH seeded_categories AS (
  INSERT INTO categories (name)
  VALUES 
    ('مشروبات وغازيات'),
    ('بسكويت وحلويات'),
    ('معلبات وأغذية جافة'),
    ('ألبان وأجبان')
  RETURNING id, name
),
seeded_products AS (
  INSERT INTO products (name, price, category_id)
  VALUES
    -- Drinks
    ('كوكا كولا علب 330 مل', 25.00, (SELECT id FROM seeded_categories WHERE name = 'مشروبات وغازيات')),
    ('شاي تركي دوغادان 100 ظرف', 85.00, (SELECT id FROM seeded_categories WHERE name = 'مشروبات وغازيات')),
    ('عصير برتقال تيميز 1 لتر', 35.00, (SELECT id FROM seeded_categories WHERE name = 'مشروبات وغازيات')),
    
    -- Sweets
    ('بسكويت شوكولاتة أولكر 12 قطعة', 45.00, (SELECT id FROM seeded_categories WHERE name = 'بسكويت وحلويات')),
    ('شوكولاتة داماك بالفستق 80 غ', 65.00, (SELECT id FROM seeded_categories WHERE name = 'بسكويت وحلويات')),
    ('ويفر بكنيك كاكاو مكرر', 15.00, (SELECT id FROM seeded_categories WHERE name = 'بسكويت وحلويات')),
    
    -- Groceries
    ('صلصة طماطم تات 800 غ', 55.00, (SELECT id FROM seeded_categories WHERE name = 'معلبات وأغذية جافة')),
    ('أرز تركي بالدو 1 كغ', 70.00, (SELECT id FROM seeded_categories WHERE name = 'معلبات وأغذية جافة')),
    ('حمص معلب تات 400 غ', 30.00, (SELECT id FROM seeded_categories WHERE name = 'معلبات وأغذية جافة')),
    
    -- Dairy
    ('جبنة بيضاء بينار 500 غ', 110.00, (SELECT id FROM seeded_categories WHERE name = 'ألبان وأجبان')),
    ('لبن زبادي سوتاس 1.5 كغ', 75.00, (SELECT id FROM seeded_categories WHERE name = 'ألبان وأجبان')),
    ('زبدة تركي بينار 250 غ', 90.00, (SELECT id FROM seeded_categories WHERE name = 'ألبان وأجبان'))
  RETURNING id, name, price
),
seeded_orders AS (
  INSERT INTO orders (customer_name, total_price, status)
  VALUES
    ('سوبرماركت الياسمين', 475.00, 'pending'),
    ('بقالة النور البركة', 620.00, 'pending'),
    ('مطعم السلام الدمشقي', 485.00, 'pending')
  RETURNING id, customer_name
)
INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
VALUES
  -- 1. سوبرماركت الياسمين
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'سوبرماركت الياسمين'), 
    (SELECT id FROM seeded_products WHERE name = 'كوكا كولا علب 330 مل'), 
    10, 
    25.00
  ),
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'سوبرماركت الياسمين'), 
    (SELECT id FROM seeded_products WHERE name = 'بسكويت شوكولاتة أولكر 12 قطعة'), 
    5, 
    45.00
  ),
  
  -- 2. بقالة النور البركة
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'بقالة النور البركة'), 
    (SELECT id FROM seeded_products WHERE name = 'بسكويت شوكولاتة أولكر 12 قطعة'), 
    10, 
    45.00
  ),
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'بقالة النور البركة'), 
    (SELECT id FROM seeded_products WHERE name = 'شاي تركي دوغادان 100 ظرف'), 
    2, 
    85.00
  ),
  
  -- 3. مطعم السلام الدمشقي
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'مطعم السلام الدمشقي'), 
    (SELECT id FROM seeded_products WHERE name = 'صلصة طماطم تات 800 غ'), 
    5, 
    55.00
  ),
  (
    (SELECT id FROM seeded_orders WHERE customer_name = 'مطعم السلام الدمشقي'), 
    (SELECT id FROM seeded_products WHERE name = 'أرز تركي بالدو 1 كغ'), 
    3, 
    70.00
  );
