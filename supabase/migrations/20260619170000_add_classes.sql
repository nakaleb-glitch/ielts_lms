-- Classes, class-based assignment, and allow deleting published tests

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE class_members (
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE class_test_assignments (
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, class_id)
);

ALTER TABLE test_assignments
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_class_member_is_student()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = NEW.student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'Only students can be added to classes';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER class_members_student_check
  BEFORE INSERT OR UPDATE ON class_members
  FOR EACH ROW EXECUTE FUNCTION check_class_member_is_student();

CREATE OR REPLACE FUNCTION public.sync_assignments_for_new_class_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO test_assignments (test_id, student_id, assigned_by, class_id, due_at)
  SELECT cta.test_id, NEW.student_id, cta.assigned_by, cta.class_id, cta.due_at
  FROM class_test_assignments cta
  WHERE cta.class_id = NEW.class_id
  ON CONFLICT (test_id, student_id) DO UPDATE
    SET class_id = EXCLUDED.class_id,
        due_at = EXCLUDED.due_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER class_members_sync_assignments
  AFTER INSERT ON class_members
  FOR EACH ROW EXECUTE FUNCTION sync_assignments_for_new_class_member();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_test_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_select ON classes FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'teacher'));

CREATE POLICY classes_insert ON classes FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin' AND created_by = auth.uid());

CREATE POLICY classes_update ON classes FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY classes_delete ON classes FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY class_members_select ON class_members FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'teacher'));

CREATE POLICY class_members_insert ON class_members FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY class_members_delete ON class_members FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY class_test_assignments_select ON class_test_assignments FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR user_owns_test(test_id)
    OR assigned_by = auth.uid()
  );

CREATE POLICY class_test_assignments_insert ON class_test_assignments FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'teacher')
    AND assigned_by = auth.uid()
    AND user_owns_test(test_id)
  );

CREATE POLICY class_test_assignments_delete ON class_test_assignments FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR assigned_by = auth.uid()
    OR user_owns_test(test_id)
  );

-- Allow test owners to delete published tests
DROP POLICY IF EXISTS tests_delete ON tests;
CREATE POLICY tests_delete ON tests FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin' OR created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_classes()
RETURNS TABLE (id UUID, name TEXT, member_count BIGINT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, COUNT(cm.student_id), c.created_at
  FROM classes c
  LEFT JOIN class_members cm ON cm.class_id = c.id
  WHERE get_user_role() IN ('admin', 'teacher')
  GROUP BY c.id, c.name, c.created_at
  ORDER BY c.name
$$;

CREATE OR REPLACE FUNCTION public.list_class_members(p_class_id UUID)
RETURNS TABLE (id UUID, display_name TEXT, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.email
  FROM class_members cm
  JOIN profiles p ON p.id = cm.student_id
  WHERE cm.class_id = p_class_id
  AND get_user_role() IN ('admin', 'teacher')
  ORDER BY p.display_name
$$;

CREATE OR REPLACE FUNCTION public.assign_test_to_class(p_test_id UUID, p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT (get_user_role() = 'admin' OR user_owns_test(p_test_id)) THEN
    RAISE EXCEPTION 'Not authorized to assign this test';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tests WHERE id = p_test_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Test must be published before assigning';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  INSERT INTO class_test_assignments (test_id, class_id, assigned_by)
  VALUES (p_test_id, p_class_id, auth.uid())
  ON CONFLICT (test_id, class_id) DO NOTHING;

  INSERT INTO test_assignments (test_id, student_id, assigned_by, class_id)
  SELECT p_test_id, cm.student_id, auth.uid(), p_class_id
  FROM class_members cm
  WHERE cm.class_id = p_class_id
  ON CONFLICT (test_id, student_id) DO UPDATE
    SET class_id = EXCLUDED.class_id,
        assigned_by = EXCLUDED.assigned_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_test_from_class(p_test_id UUID, p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT (get_user_role() = 'admin' OR user_owns_test(p_test_id)) THEN
    RAISE EXCEPTION 'Not authorized to unassign this test';
  END IF;

  DELETE FROM class_test_assignments
  WHERE test_id = p_test_id AND class_id = p_class_id;

  DELETE FROM test_assignments
  WHERE test_id = p_test_id AND class_id = p_class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_class_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_test_to_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_test_from_class(UUID, UUID) TO authenticated;
