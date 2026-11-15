-- Keep the tour-assignment RPC and production table contract aligned.
-- Existing assignment rows receive the migration timestamp through the DEFAULT.
ALTER TABLE public.tour_assigned_extras
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
