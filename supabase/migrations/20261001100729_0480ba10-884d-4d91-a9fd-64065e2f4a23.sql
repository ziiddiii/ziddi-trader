INSERT INTO public.platform_content (category, title, summary, media_type, media_url, published, sort_order)
SELECT 'awareness', 'M-PESA message: buy & sell NSE shares', 'A shared M-PESA message highlighting ZiiDi Trader. Personal transaction details are obscured.', 'image', '/__l5e/assets-v1/ac024cda-eb95-4fa7-8171-526fa86580e0/mpesa-promo-redacted.jpg', true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.platform_content WHERE media_url = '/__l5e/assets-v1/ac024cda-eb95-4fa7-8171-526fa86580e0/mpesa-promo-redacted.jpg');
INSERT INTO public.promo_flashes (message, enabled)
SELECT message, true FROM (VALUES
('Kenya • Review your withdrawal history in your account'),
('Kenya • Check your available balance before withdrawing'),
('Kenya • See your withdrawal status in your account'),
('Kenya • View the current minimum withdrawal before submitting'),
('Tanzania • Check available withdrawal methods before you submit'),
('Tanzania • Review your withdrawal details before confirming'),
('Tanzania • Keep your transaction reference for your records'),
('Tanzania • Follow your withdrawal status from your account'),
('Uganda • Check available withdrawal methods before you submit'),
('Uganda • Review your withdrawal amount and destination'),
('Uganda • Keep your transaction reference for your records'),
('Uganda • Follow your withdrawal status from your account')
) AS new_promos(message)
WHERE NOT EXISTS (SELECT 1 FROM public.promo_flashes existing WHERE existing.message = new_promos.message);