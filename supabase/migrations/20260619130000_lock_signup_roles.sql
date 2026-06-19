-- Prevent self-signup from assigning admin role via user metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  assigned_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'
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
