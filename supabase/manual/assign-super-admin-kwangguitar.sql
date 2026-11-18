-- Dorm Happy Hub: promote the requested account to the highest application role.
-- Run this once in Supabase Dashboard -> SQL Editor for the Dorm Happy Hub project.
-- This uses the existing app_role enum and user_roles table from this repository.
-- It does NOT change passwords or grant Supabase project-owner access.

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
    INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('kwangguitar@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for kwangguitar@gmail.com. Create/confirm the account first, then run this script again.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT target_user_id, 'owner'::public.app_role
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = 'owner'::public.app_role
  );
END
$$;

-- Verify the assignment:
SELECT
  u.email,
  ur.role
FROM auth.users AS u
JOIN public.user_roles AS ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('kwangguitar@gmail.com');
