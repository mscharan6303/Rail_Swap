-- Add verification fields to exchange_requests for QR/OCR ticket verification
ALTER TABLE public.exchange_requests
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verification_hash text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS passenger_name text,
  ADD COLUMN IF NOT EXISTS confirmed_by_a boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by_b boolean NOT NULL DEFAULT false;

-- Unique hash per user to prevent duplicate verifications for the same seat
CREATE UNIQUE INDEX IF NOT EXISTS exchange_requests_user_hash_unique
  ON public.exchange_requests (user_id, verification_hash)
  WHERE verification_hash IS NOT NULL;

-- Speed up matches lookup by train + date
CREATE INDEX IF NOT EXISTS exchange_requests_train_date_idx
  ON public.exchange_requests (train_number, journey_date);