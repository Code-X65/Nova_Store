INSERT INTO notification_templates (key, name, subject, text_template, variables, channel) VALUES
('order_created', 'Order Confirmation', 'Order Confirmation - {{orderNumber}}', 'Your order {{orderNumber}} has been placed. Total: {{totalAmount}}', '["orderNumber", "totalAmount"]', '{email,inapp}'),
('order_shipped', 'Order Shipped', 'Your order is on the way!', 'Order {{orderNumber}} shipped via {{carrier}}. Track: {{trackingNumber}}', '["orderNumber", "carrier", "trackingNumber"]', '{email,sms,inapp}'),
('order_delivered', 'Order Delivered', 'Order delivered', 'Your order {{orderNumber}} has been delivered. Thank you!', '["orderNumber"]', '{email,inapp}'),
('order_cancelled', 'Order Cancelled', 'Order cancelled', 'Your order {{orderNumber}} has been cancelled. Reason: {{reason}}', '["orderNumber", "reason"]', '{email,inapp}'),
('password_reset', 'Password Reset Request', 'Password reset request', 'Reset link: {{resetLink}}', '["resetLink"]', '{email}'),
('low_stock', 'Low Stock Alert', '[ADMIN] Low stock alert', 'Product {{productName}} is below threshold ({{stockQuantity}})', '["productName", "stockQuantity"]', '{email,inapp}'),
('new_review', 'New Product Review', 'New review on your product', '"{{user}}" reviewed {{productName}}: {{rating}} stars', '["user", "productName", "rating"]', '{email,inapp}')
ON CONFLICT (key) DO NOTHING;
