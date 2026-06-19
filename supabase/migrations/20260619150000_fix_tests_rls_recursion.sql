-- Fix infinite recursion between tests and test_assignments RLS policies

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_owns_test(p_test_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tests
    WHERE id = p_test_id AND created_by = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.student_has_test_assignment(p_test_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM test_assignments
    WHERE test_id = p_test_id AND student_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_test(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_has_test_assignment(UUID) TO authenticated;

-- Tests policies
DROP POLICY IF EXISTS tests_select ON tests;
DROP POLICY IF EXISTS tests_insert ON tests;
DROP POLICY IF EXISTS tests_update ON tests;
DROP POLICY IF EXISTS tests_delete ON tests;

CREATE POLICY tests_select ON tests FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR get_user_role() = 'admin'
    OR (status = 'published' AND student_has_test_assignment(id))
  );

CREATE POLICY tests_insert ON tests FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'teacher')
    AND created_by = auth.uid()
  );

CREATE POLICY tests_update ON tests FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin' OR created_by = auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'admin' OR created_by = auth.uid()
  );

CREATE POLICY tests_delete ON tests FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin' OR (created_by = auth.uid() AND status = 'draft')
  );

-- Assignments policies (avoid subqueries back into tests RLS)
DROP POLICY IF EXISTS assignments_select ON test_assignments;
DROP POLICY IF EXISTS assignments_insert ON test_assignments;
DROP POLICY IF EXISTS assignments_delete ON test_assignments;

CREATE POLICY assignments_select ON test_assignments FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR student_id = auth.uid()
    OR assigned_by = auth.uid()
    OR user_owns_test(test_id)
  );

CREATE POLICY assignments_insert ON test_assignments FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'teacher')
    AND assigned_by = auth.uid()
    AND user_owns_test(test_id)
    AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_assignments.test_id
      AND t.status = 'published'
    )
  );

CREATE POLICY assignments_delete ON test_assignments FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR assigned_by = auth.uid()
    OR user_owns_test(test_id)
  );
