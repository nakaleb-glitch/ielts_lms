-- Per-test exam access password and secure session start

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS access_password TEXT;

CREATE OR REPLACE FUNCTION public.assignment_requires_password(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(t.access_password, '') <> ''
  FROM test_assignments ta
  JOIN tests t ON t.id = ta.test_id
  WHERE ta.id = p_assignment_id
    AND ta.student_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.start_test_session(p_assignment_id UUID, p_password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_test_password TEXT;
  v_session_id UUID;
BEGIN
  SELECT ta.student_id, t.access_password
  INTO v_student_id, v_test_password
  FROM test_assignments ta
  JOIN tests t ON t.id = ta.test_id
  WHERE ta.id = p_assignment_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  IF v_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO v_session_id
  FROM test_sessions
  WHERE assignment_id = p_assignment_id;

  IF v_session_id IS NOT NULL THEN
    RETURN v_session_id;
  END IF;

  IF COALESCE(v_test_password, '') <> '' AND COALESCE(p_password, '') <> v_test_password THEN
    RAISE EXCEPTION 'Invalid exam password';
  END IF;

  INSERT INTO test_sessions (assignment_id)
  VALUES (p_assignment_id)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assignment_requires_password(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_test_session(UUID, TEXT) TO authenticated;
