
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  sender_id uuid,
  body text NOT NULL,
  read_by_admin boolean NOT NULL DEFAULT false,
  read_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_user_created ON public.support_messages(user_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- User can read their own conversation
CREATE POLICY "User reads own support thread" ON public.support_messages
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- User can insert messages into their own thread (as 'user')
CREATE POLICY "User sends in own support thread" ON public.support_messages
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND sender_role = 'user')
  OR (public.has_role(auth.uid(),'admin') AND sender_role = 'admin')
);

-- Update (mark read) allowed to owner or admin
CREATE POLICY "Mark support messages read" ON public.support_messages
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
