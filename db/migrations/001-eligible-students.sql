BEGIN;
CREATE TABLE IF NOT EXISTS public.eligible_students (
  student_id text PRIMARY KEY CHECK (student_id ~ '^[A-Za-z0-9_./-]{1,80}$'),
  university_email text NOT NULL UNIQUE CHECK (
    university_email = lower(btrim(university_email)) AND
    university_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.eligible_students ENABLE ROW LEVEL SECURITY;
-- This app uses server-side Google sessions, not Supabase Auth policies.
REVOKE ALL ON public.eligible_students FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.eligible_students FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.eligible_students FROM authenticated;
  END IF;
END $$;
COMMIT;
