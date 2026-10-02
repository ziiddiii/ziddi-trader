CREATE TABLE public.platform_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('journey', 'awareness', 'promos', 'general')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'youtube', 'video', 'image')),
  media_url text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_content TO authenticated;
GRANT ALL ON public.platform_content TO service_role;
ALTER TABLE public.platform_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published content visible to everyone" ON public.platform_content FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY "Admins view all content" ON public.platform_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add content" ON public.platform_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins edit content" ON public.platform_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove content" ON public.platform_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER platform_content_updated_at BEFORE UPDATE ON public.platform_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.platform_content (category, title, summary, media_type, media_url, published, sort_order) VALUES
('awareness', 'Buy & sell NSE shares with ZiiDi Trader', 'An illustrated awareness message inspired by the M-PESA text you shared.', 'video', '/__l5e/assets-v1/b2b90a01-d32b-4590-873e-acf210efec16/ziidi-awareness.mp4', true, 1),
('journey', 'The platform journey', 'Watch the first video you shared.', 'youtube', 'https://www.youtube.com/watch?t=25&v=jgzuWCcNkh8', true, 2),
('general', 'More from the platform', 'Watch the second video you shared.', 'youtube', 'https://www.youtube.com/watch?t=23&v=OyiPh1nzazA', true, 3);