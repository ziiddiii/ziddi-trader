ALTER TABLE public.deposit_settings
  ADD COLUMN IF NOT EXISTS till_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS till_business_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS active_method text NOT NULL DEFAULT 'paybill';