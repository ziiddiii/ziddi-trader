
UPDATE public.listings SET status='cancelled' 
WHERE status='active' AND ticker NOT LIKE '%-BOND' AND buyer_id IS NULL;

WITH admin AS (SELECT user_id FROM public.user_roles WHERE role='admin' LIMIT 1)
INSERT INTO public.listings (seller_id, ticker, company_name, quantity, price_per_share, status, seller_name, logo_url)
SELECT admin.user_id, t.ticker, t.company_name, t.quantity, t.price, 'active', t.seller, t.logo
FROM admin, (VALUES
  ('SCOM','Safaricom PLC', 5000, 38.75, 'ZiiDi Broker', 'https://logo.clearbit.com/safaricom.co.ke'),
  ('EQTY','Equity Group Holdings', 3000, 45.20, 'ZiiDi Broker', 'https://logo.clearbit.com/equitygroupholdings.com'),
  ('KCB','KCB Group', 3500, 32.10, 'ZiiDi Broker', 'https://logo.clearbit.com/kcbgroup.com'),
  ('ABSA','Absa Bank Kenya', 4000, 15.85, 'ZiiDi Broker', 'https://logo.clearbit.com/absabank.co.ke'),
  ('COOP','Co-operative Bank of Kenya', 4500, 13.20, 'ZiiDi Broker', 'https://logo.clearbit.com/co-opbank.co.ke'),
  ('EABL','East African Breweries', 1500, 168.50, 'ZiiDi Broker', 'https://logo.clearbit.com/eabl.com'),
  ('BAT','British American Tobacco Kenya', 200, 410.00, 'ZiiDi Broker', 'https://logo.clearbit.com/batkenya.com'),
  ('NCBA','NCBA Group', 2500, 48.60, 'ZiiDi Broker', 'https://logo.clearbit.com/ncbagroup.com'),
  ('SCBK','Standard Chartered Bank Kenya', 800, 245.00, 'ZiiDi Broker', 'https://logo.clearbit.com/sc.com'),
  ('DTBK','Diamond Trust Bank Kenya', 1200, 66.75, 'ZiiDi Broker', 'https://logo.clearbit.com/dtbafrica.com'),
  ('JUB','Jubilee Holdings', 900, 190.25, 'ZiiDi Broker', 'https://logo.clearbit.com/jubileeholdings.com'),
  ('BAMB','Bamburi Cement', 1000, 51.50, 'ZiiDi Broker', 'https://logo.clearbit.com/bamburicement.com'),
  ('KEGN','KenGen', 8000, 4.85, 'ZiiDi Broker', 'https://logo.clearbit.com/kengen.co.ke'),
  ('KPLC','Kenya Power & Lighting', 12000, 3.20, 'ZiiDi Broker', 'https://logo.clearbit.com/kplc.co.ke'),
  ('CIC','CIC Insurance Group', 15000, 2.55, 'ZiiDi Broker', 'https://logo.clearbit.com/cic.co.ke'),
  ('BRIT','Britam Holdings', 6000, 6.15, 'ZiiDi Broker', 'https://logo.clearbit.com/britam.com'),
  ('SASN','Sasini PLC', 3000, 22.40, 'ZiiDi Broker', 'https://logo.clearbit.com/sasini.co.ke'),
  ('HFCK','HF Group', 8000, 4.10, 'ZiiDi Broker', 'https://logo.clearbit.com/hfgroup.co.ke'),
  ('UNGA','Unga Group', 1800, 22.90, 'ZiiDi Broker', 'https://logo.clearbit.com/unga.com'),
  ('KNRE','Kenya Re-Insurance', 12000, 2.10, 'ZiiDi Broker', 'https://logo.clearbit.com/kenyare.co.ke'),
  ('TOTL','TotalEnergies Marketing Kenya', 900, 28.35, 'ZiiDi Broker', 'https://logo.clearbit.com/totalenergies.co.ke'),
  ('CRDB','CRDB Bank', 700, 675.00, 'ZiiDi Broker', 'https://logo.clearbit.com/crdbbank.co.tz'),
  ('SBIC','Stanbic Holdings', 300, 155.75, 'ZiiDi Broker', 'https://logo.clearbit.com/stanbicbank.co.ke'),
  ('IMH','I&M Group', 1500, 34.90, 'ZiiDi Broker', 'https://logo.clearbit.com/imbankgroup.com')
) AS t(ticker, company_name, quantity, price, seller, logo);
