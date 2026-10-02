UPDATE public.listings
SET quantity = GREATEST(quantity, CEIL(25000.0 / price_per_share)::int)
WHERE status = 'active' AND price_per_share > 0 AND quantity * price_per_share < 25000;