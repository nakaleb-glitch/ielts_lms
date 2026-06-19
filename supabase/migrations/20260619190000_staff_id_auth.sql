-- Staff ID login for teachers/admins, admin migration, and admin user list RPC

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS staff_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_staff_id_unique
  ON profiles (staff_id) WHERE staff_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
  meta_student_id TEXT;
  meta_staff_id TEXT;
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
  meta_staff_id := NULLIF(TRIM(NEW.raw_user_meta_data->>'staff_id'), '');
  meta_display_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), '');
  meta_must_change := COALESCE(
    (NEW.raw_user_meta_data->>'must_change_password')::boolean,
    assigned_role IN ('student', 'teacher')
  );

  IF assigned_role = 'student' AND meta_display_name IS NULL THEN
    meta_display_name := COALESCE(meta_student_id, split_part(NEW.email, '@', 1));
  END IF;

  IF assigned_role IN ('teacher', 'admin') AND meta_display_name IS NULL THEN
    meta_display_name := COALESCE(meta_staff_id, split_part(NEW.email, '@', 1));
  END IF;

  IF meta_display_name IS NULL THEN
    meta_display_name := COALESCE(split_part(NEW.email, '@', 1), 'User');
  END IF;

  INSERT INTO public.profiles (id, role, display_name, email, student_id, staff_id, must_change_password)
  VALUES (
    NEW.id,
    assigned_role,
    meta_display_name,
    NEW.email,
    meta_student_id,
    meta_staff_id,
    meta_must_change
  );
  RETURN NEW;
END;
$$;

-- Migrate existing admin to Staff ID KNA0200793
DO $$
DECLARE
  admin_user_id UUID;
  old_email TEXT := 'na.kaleb@royal.edu.vn';
  new_email TEXT := 'kna0200793@staff.royal.edu.vn';
  admin_staff_id TEXT := 'KNA0200793';
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = old_email;

  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users WHERE email = new_email;
  END IF;

  IF admin_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE auth.users
  SET
    email = new_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('staff_id', admin_staff_id, 'role', 'admin', 'display_name', 'Admin')
  WHERE id = admin_user_id;

  UPDATE auth.identities
  SET identity_data = jsonb_build_object(
    'sub', admin_user_id::text,
    'email', new_email
  )
  WHERE user_id = admin_user_id AND provider = 'email';

  UPDATE public.profiles
  SET
    staff_id = admin_staff_id,
    email = new_email,
    display_name = COALESCE(display_name, 'Admin')
  WHERE id = admin_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN position('@' in trim(p_identifier)) > 0 THEN trim(p_identifier)
    WHEN EXISTS (
      SELECT 1 FROM profiles WHERE lower(student_id) = lower(trim(p_identifier))
    ) THEN lower(trim(p_identifier)) || '@student.royal.edu.vn'
    WHEN EXISTS (
      SELECT 1 FROM profiles WHERE lower(staff_id) = lower(trim(p_identifier))
    ) THEN lower(trim(p_identifier)) || '@staff.royal.edu.vn'
    ELSE lower(trim(p_identifier)) || '@student.royal.edu.vn'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  student_id TEXT,
  staff_id TEXT,
  role TEXT,
  classes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.student_id,
    p.staff_id,
    p.role,
    COALESCE(cls.names, '')
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT string_agg(c.name, ', ' ORDER BY c.name) AS names
    FROM class_members cm
    JOIN classes c ON c.id = cm.class_id
    WHERE cm.student_id = p.id
  ) cls ON true
  WHERE get_user_role() = 'admin'
  ORDER BY
    CASE p.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END,
    p.display_name
$$;

GRANT EXECUTE ON FUNCTION public.list_users_for_admin() TO authenticated;
