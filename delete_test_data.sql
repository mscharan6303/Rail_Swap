-- ==============================================================================
-- RAIL SWAP - DELETE TEST / MOCK REQUESTS PERMANENTLY
-- ==============================================================================
-- Run this query in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to permanently delete test requests (such as train 17646 / RAL SC EXPRESS).

DELETE FROM public.exchange_requests 
WHERE train_number = '17646' 
   OR train_name LIKE '%RAL SC%'
   OR coach_number = 'S1' AND seat_number = '66';
