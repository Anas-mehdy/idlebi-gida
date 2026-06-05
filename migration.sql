-- 1. إضافة أعمدة الاسم والصورة لجدول تفاصيل الطلبية (order_items)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_image TEXT;

-- 2. نقل الأسماء والصور الحالية للمنتجات النشطة والمخفية إلى الأعمدة الجديدة في الطلبات السابقة
UPDATE order_items 
SET product_name = products.name,
    product_image = products.image_url
FROM products 
WHERE order_items.product_id = products.id;
