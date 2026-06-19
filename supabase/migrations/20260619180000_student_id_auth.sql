-- Student ID login, forced password change, and updated list_students RPC

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique
  ON profiles (student_id) WHERE student_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.list_students();
DROP FUNCTION IF EXISTS public.list_class_members(UUID);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
  meta_student_id TEXT;
  meta_display_name TEXT;
  meta_must_change BOOLEAN;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'created_by_admin', 'false') != 'true' THEN
    RAISE EXCEPTION 'Signup is disabled. Contact your administrator.';
  END IF;

  assigned_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'
    WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
    ELSE 'student'
  END;

  meta_student_id := NULLIF(TRIM(NEW.raw_user_meta_data->>'student_id'), '');
  meta_display_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), '');
  meta_must_change := COALESCE(
    (NEW.raw_user_meta_data->>'must_change_password')::boolean,
    assigned_role = 'student'
  );

  IF assigned_role = 'student' AND meta_display_name IS NULL THEN
    meta_display_name := COALESCE(meta_student_id, split_part(NEW.email, '@', 1));
  END IF;

  IF meta_display_name IS NULL THEN
    meta_display_name := COALESCE(split_part(NEW.email, '@', 1), 'User');
  END IF;

  INSERT INTO public.profiles (id, role, display_name, email, student_id, must_change_password)
  VALUES (
    NEW.id,
    assigned_role,
    meta_display_name,
    NEW.email,
    meta_student_id,
    meta_must_change
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_students()
RETURNS TABLE (id UUID, student_id TEXT, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.student_id, p.display_name
  FROM profiles p
  WHERE p.role = 'student'
  AND get_user_role() IN ('admin', 'teacher')
  ORDER BY p.student_id NULLS LAST, p.display_name
$$;

GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_class_members(p_class_id UUID)
RETURNS TABLE (id UUID, student_id TEXT, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.student_id, p.display_name
  FROM class_members cm
  JOIN profiles p ON p.id = cm.student_id
  WHERE cm.class_id = p_class_id
  AND get_user_role() IN ('admin', 'teacher')
  ORDER BY p.student_id NULLS LAST, p.display_name
$$;

GRANT EXECUTE ON FUNCTION public.list_class_members(UUID) TO authenticated;
