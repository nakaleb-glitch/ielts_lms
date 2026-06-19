-- Block public self-signup; only admin-provisioned accounts via create-user edge function

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'created_by_admin', 'false') != 'true' THEN
    RAISE EXCEPTION 'Signup is disabled. Contact your administrator.';
  END IF;

  assigned_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'
    WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
    ELSE 'student'
  END;

  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (
    NEW.id,
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Ensure seeded admin can pass the trigger on re-seed / existing installs
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"created_by_admin": "true"}'::jsonb
WHERE email = 'na.kaleb@royal.edu.vn';
