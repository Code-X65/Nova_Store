-- Seed complete notification templates (adds return_* and missing lifecycle keys)
INSERT INTO notification_templates (key, name, subject, text_template, variables, channel) VALUES
  (
    'return_requested',
    'Return Requested',
    'Return request received — {{orderNumber}}',
    'Hi {{userName}}, we received your return request for order {{orderNumber}}. Reason: {{reason}}. We will review it within 1–2 business days and get back to you.',
    '["userName","orderNumber","reason"]',
    '{email,inapp}'
  ),
  (
    'return_approved',
    'Return Approved',
    'Your return for order {{orderNumber}} has been approved',
    'Hi {{userName}}, your return request for order {{orderNumber}} has been approved. Please ship the item back to us within 14 days. Refund: {{refundAmount}}.',
    '["userName","orderNumber","refundAmount"]',
    '{email,inapp}'
  ),
  (
    'return_rejected',
    'Return Rejected',
    'Return request for order {{orderNumber}} could not be processed',
    'Hi {{userName}}, we are unable to process your return for order {{orderNumber}}. {{note}}',
    '["userName","orderNumber","note"]',
    '{email,inapp}'
  ),
  (
    'return_completed',
    'Return Completed & Refund Issued',
    'Your refund for order {{orderNumber}} has been issued',
    'Hi {{userName}}, your return for order {{orderNumber}} has been completed. A refund of {{refundAmount}} has been issued to your original payment method. Please allow 5–10 business days for it to appear.',
    '["userName","orderNumber","refundAmount"]',
    '{email,inapp}'
  ),
  (
    'low_stock',
    'Low Stock Alert',
    '[ADMIN] Low stock — {{productName}}',
    'Product {{productName}} (SKU: {{sku}}) is below the minimum threshold. Current stock: {{stockQuantity}} (threshold: {{threshold}}).',
    '["productName","sku","stockQuantity","threshold"]',
    '{email,inapp}'
  ),
  (
    'new_review',
    'New Product Review',
    'New review on your product: {{productName}}',
    '{{userName}} left a {{rating}}-star review on {{productName}}: "{{comment}}"',
    '["userName","productName","rating","comment"]',
    '{email,inapp}'
  ),
  (
    'order_created',
    'Order Confirmation',
    'Order Confirmation — {{orderNumber}}',
    'Thank you for your order, {{userName}}! Your order {{orderNumber}} has been placed. Total: {{totalAmount}}. We will notify you when it ships.',
    '["userName","orderNumber","totalAmount"]',
    '{email,inapp}'
  ),
  (
    'order_shipped',
    'Order Shipped — {{orderNumber}}',
    'Your order is on the way!',
    'Hi {{userName}}, order {{orderNumber}} has been shipped via {{carrier}}. Your tracking number is {{trackingNumber}}. Estimated delivery: {{estimatedDate}}.',
    '["userName","orderNumber","carrier","trackingNumber","estimatedDate"]',
    '{email,inapp}'
  ),
  (
    'order_delivered',
    'Order Delivered — {{orderNumber}}',
    'Your order has been delivered — {{orderNumber}}',
    'Hi {{userName}}, order {{orderNumber}} has been delivered. We hope you enjoy your purchase!',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
   (
     'order_cancelled',
     'Order Cancelled — {{orderNumber}}',
     'Order {{orderNumber}} has been cancelled',
     'Hi {{userName}}, your order {{orderNumber}} has been cancelled. Reason: {{reason}}. Any payment will be refunded within 5–10 business days.',
     '["userName","orderNumber","reason"]',
     '{email,inapp}'
   ),
   (
     'password_reset',
     'Password Reset Request',
     'Reset your Nova Store password',
     'Hi {{userName}}, you requested a password reset. Click here to set a new password: {{resetLink}}. This link expires in 1 hour.',
     '["userName","resetLink"]',
     '{email}'
   ),
   (
     'email_verification',
     'Verify Your Email — Nova Store',
     'Please verify your email address',
     'Welcome {{userName}}! Click this link to verify your email: {{verificationLink}}. This link expires in 24 hours.',
     '["userName","verificationLink"]',
     '{email}'
   ),
   (
     'phone_otp',
     'Phone OTP Verification',
     'Your Nova Store verification code is: {{otp}}',
     'Your Nova Store verification code is: {{otp}}. Valid for 10 minutes. Do not share this code.',
     '["otp"]',
     '{sms}'
   ),
   (
     'referral_credited',
     'Referral Credited',
     '{{referredByName}} joined Nova Store using your referral link!',
     'Congrats {{referredByName}}! You earned {{points}} loyalty points.',
     '["referredByName","points"]',
     '{email,inapp}'
   )
 ON CONFLICT (key) DO NOTHING;
