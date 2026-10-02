GRANT ALL ON SCHEMA public TO sandbox_exec;
GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT ALL ON ALL TABLES IN SCHEMA public TO sandbox_exec;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO sandbox_exec;
GRANT anon, authenticated, service_role TO sandbox_exec;