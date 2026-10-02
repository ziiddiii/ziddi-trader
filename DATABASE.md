# ZiiDi Trader – Database restore

Files in `database/` (run in this order on a new Supabase/Postgres project, SQL editor or psql):
1. `schema_public.sql` – all tables, functions, policies, triggers
2. `data_auth_users.sql` – registered user accounts (passwords stay as they are)
3. `data_public.sql` – all app records (balances, listings, withdrawals, content…)
4. `create_admin.sql` – admin login

## Admin panel login
- URL: /admin-login
- Email: admin@admin.com
- Password: Admin123
(The old admin@gmail.com / Admin123 also stays working.)

Then set the new project URL and key in `.env` and email settings per EMAIL_SETUP.md.
