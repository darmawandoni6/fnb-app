INSERT INTO settings (id, cafe_name, service_rate, tax_rate, is_open,
                      cash_timeout_minutes, delivered_auto_complete_minutes,
                      ready_auto_deliver_minutes, ready_auto_deliver_warning_minutes)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Cafe', 5, 10, TRUE, 15, 5, 10, 2)
ON CONFLICT (id) DO UPDATE SET
  cafe_name = EXCLUDED.cafe_name,
  service_rate = EXCLUDED.service_rate,
  tax_rate = EXCLUDED.tax_rate,
  is_open = EXCLUDED.is_open,
  cash_timeout_minutes = EXCLUDED.cash_timeout_minutes,
  delivered_auto_complete_minutes = EXCLUDED.delivered_auto_complete_minutes,
  ready_auto_deliver_minutes = EXCLUDED.ready_auto_deliver_minutes,
  ready_auto_deliver_warning_minutes = EXCLUDED.ready_auto_deliver_warning_minutes;

INSERT INTO tables (table_number, qr_token)
VALUES ('T01', 'demo-qr-token')
ON CONFLICT (table_number) DO UPDATE SET qr_token = EXCLUDED.qr_token, is_active = TRUE;

INSERT INTO menu_categories (id, name, sort_order) VALUES
('00000000-0000-0000-0000-000000000002', 'Coffee', 1),
('00000000-0000-0000-0000-000000000003', 'Food', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO menus (id, category_id, name, price, is_available) VALUES
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'Latte', 25000, TRUE),
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Americano', 20000, TRUE),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', 'Croissant', 18000, TRUE)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, price = EXCLUDED.price, is_available = EXCLUDED.is_available;

INSERT INTO ingredients (id, name, unit, stock_qty, min_stock) VALUES
('00000000-0000-0000-0000-000000000020', 'Beans', 'g', 1000, 100),
('00000000-0000-0000-0000-000000000021', 'Milk', 'ml', 5000, 500),
('00000000-0000-0000-0000-000000000022', 'Flour', 'g', 5000, 500)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit, min_stock = EXCLUDED.min_stock;

INSERT INTO recipe_items (id, menu_id, ingredient_id, qty_used) VALUES
('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 18),
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000021', 200),
('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000020', 18),
('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 100)
ON CONFLICT (id) DO UPDATE SET menu_id = EXCLUDED.menu_id, ingredient_id = EXCLUDED.ingredient_id, qty_used = EXCLUDED.qty_used;
