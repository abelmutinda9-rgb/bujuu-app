-- Allow authenticated users to view their own subscriber and subscription rows
GRANT SELECT ON public.subscribers TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscribers' AND policyname = 'Users can read own subscriber row'
  ) THEN
    CREATE POLICY "Users can read own subscriber row"
    ON public.subscribers FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can read own subscriptions'
  ) THEN
    CREATE POLICY "Users can read own subscriptions"
    ON public.subscriptions FOR SELECT TO authenticated
    USING (subscriber_id IN (
      SELECT id FROM public.subscribers WHERE user_id = auth.uid()
    ));
  END IF;
END $$;
