-- Include class name(s) in list_students for assign / class management UIs

DROP FUNCTION IF EXISTS public.list_students();

CREATE OR REPLACE FUNCTION public.list_students()
RETURNS TABLE (id UUID, student_id TEXT, display_name TEXT, class_names TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.student_id,
    p.display_name,
    COALESCE(
      (
        SELECT STRING_AGG(c.name, ', ' ORDER BY c.name)
        FROM class_members cm
        JOIN classes c ON c.id = cm.class_id
        WHERE cm.student_id = p.id
      ),
      ''
    ) AS class_names
  FROM profiles p
  WHERE p.role = 'student'
  AND get_user_role() IN ('admin', 'teacher')
  ORDER BY p.student_id NULLS LAST, p.display_name
$$;

GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated;
