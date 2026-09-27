-- Add this policy in your Supabase SQL Editor to allow users to mark messages as read
CREATE POLICY "messages_update_in_match" ON public.messages
FOR UPDATE USING (
  exists (
    select 1 from public.matches m 
    where m.id = match_id and auth.uid() in (m.user_a, m.user_b)
  )
);
