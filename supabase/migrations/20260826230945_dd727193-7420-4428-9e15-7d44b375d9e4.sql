GRANT SELECT, INSERT, UPDATE, REFERENCES, TRIGGER ON TABLE auth.users TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE ON TABLE auth.identities TO sandbox_exec;
GRANT USAGE ON SCHEMA extensions TO sandbox_exec;