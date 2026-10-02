UPDATE auth.users
SET confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = ''
WHERE email = 'admin@gmail.com';