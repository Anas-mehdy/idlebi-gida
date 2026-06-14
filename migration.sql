-- 1. إضافة أعمدة الاسم والصورة لجدول تفاصيل الطلبية (order_items)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_image TEXT;

-- 2. نقل الأسماء والصور الحالية للمنتجات النشطة والمخفية إلى الأعمدة الجديدة في الطلبات السابقة
UPDATE order_items 
SET product_name = products.name,
    product_image = products.image_url
FROM products 
WHERE order_items.product_id = products.id;

-- 3. إضافة جدول الزبائن وقواعد الحماية RLS الخاصة به لتوحيد أسماء زبائن الفواتير
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

