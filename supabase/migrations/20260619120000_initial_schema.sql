-- IELTS Reading Platform - Initial Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Tests
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  instructions TEXT,
  duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  UNIQUE (test_id, order_index)
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  global_order INT NOT NULL DEFAULT 1,
  type TEXT NOT NULL CHECK (type IN (
    'multiple_choice', 'true_false_not_given', 'yes_no_not_given', 'gap_fill', 'matching'
  )),
  prompt TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (passage_id, order_index)
);

CREATE TABLE question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  acceptable_answers JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);

CREATE TABLE test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES test_assignments(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired'))
);

CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  value JSONB,
  flagged BOOLEAN NOT NULL DEFAULT false,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE TABLE session_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES test_sessions(id) ON DELETE CASCADE,
  raw_score NUMERIC NOT NULL,
  total_questions INT NOT NULL,
  band_score NUMERIC NOT NULL,
  question_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tests_created_by ON tests(created_by);
CREATE INDEX idx_passages_test_id ON passages(test_id);
CREATE INDEX idx_questions_passage_id ON questions(passage_id);
CREATE INDEX idx_assignments_student ON test_assignments(student_id);
CREATE INDEX idx_assignments_test ON test_assignments(test_id);
CREATE INDEX idx_sessions_assignment ON test_sessions(assignment_id);
CREATE INDEX idx_responses_session ON responses(session_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tests_updated_at
  BEFORE UPDATE ON tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR get_my_role() IN ('admin', 'teacher')
  );

CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Tests policies
CREATE POLICY tests_select ON tests FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR created_by = auth.uid()
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM test_assignments ta
        WHERE ta.test_id = tests.id AND ta.student_id = auth.uid()
      )
    )
  );

CREATE POLICY tests_insert ON tests FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'teacher')
    AND created_by = auth.uid()
  );

CREATE POLICY tests_update ON tests FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin' OR created_by = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'admin' OR created_by = auth.uid()
  );

CREATE POLICY tests_delete ON tests FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin' OR (created_by = auth.uid() AND status = 'draft')
  );

-- Passages policies (inherit test access)
CREATE POLICY passages_all ON passages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = passages.test_id
      AND (
        get_my_role() = 'admin'
        OR t.created_by = auth.uid()
        OR (
          t.status = 'published'
          AND EXISTS (
            SELECT 1 FROM test_assignments ta
            WHERE ta.test_id = t.id AND ta.student_id = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = passages.test_id
      AND (get_my_role() = 'admin' OR t.created_by = auth.uid())
    )
  );

-- Questions policies
CREATE POLICY questions_all ON questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM passages p
      JOIN tests t ON t.id = p.test_id
      WHERE p.id = questions.passage_id
      AND (
        get_my_role() = 'admin'
        OR t.created_by = auth.uid()
        OR (
          t.status = 'published'
          AND EXISTS (
            SELECT 1 FROM test_assignments ta
            WHERE ta.test_id = t.id AND ta.student_id = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM passages p
      JOIN tests t ON t.id = p.test_id
      WHERE p.id = questions.passage_id
      AND (get_my_role() = 'admin' OR t.created_by = auth.uid())
    )
  );

-- Question answers policies
CREATE POLICY question_answers_all ON question_answers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      JOIN passages p ON p.id = q.passage_id
      JOIN tests t ON t.id = p.test_id
      WHERE q.id = question_answers.question_id
      AND (
        get_my_role() = 'admin'
        OR t.created_by = auth.uid()
        OR (
          t.status = 'published'
          AND EXISTS (
            SELECT 1 FROM test_assignments ta
            JOIN test_sessions ts ON ts.assignment_id = ta.id
            JOIN session_results sr ON sr.session_id = ts.id
            WHERE ta.test_id = t.id AND ta.student_id = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM questions q
      JOIN passages p ON p.id = q.passage_id
      JOIN tests t ON t.id = p.test_id
      WHERE q.id = question_answers.question_id
      AND (get_my_role() = 'admin' OR t.created_by = auth.uid())
    )
  );

-- Assignments policies
CREATE POLICY assignments_select ON test_assignments FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR student_id = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_assignments.test_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY assignments_insert ON test_assignments FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'teacher')
    AND assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_assignments.test_id
      AND (get_my_role() = 'admin' OR t.created_by = auth.uid())
      AND t.status = 'published'
    )
  );

CREATE POLICY assignments_delete ON test_assignments FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_assignments.test_id AND t.created_by = auth.uid()
    )
  );

-- Sessions policies
CREATE POLICY sessions_select ON test_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_assignments ta
      JOIN tests t ON t.id = ta.test_id
      WHERE ta.id = test_sessions.assignment_id
      AND (
        get_my_role() = 'admin'
        OR ta.student_id = auth.uid()
        OR t.created_by = auth.uid()
        OR ta.assigned_by = auth.uid()
      )
    )
  );

CREATE POLICY sessions_insert ON test_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_assignments ta
      WHERE ta.id = test_sessions.assignment_id
      AND ta.student_id = auth.uid()
    )
  );

CREATE POLICY sessions_update ON test_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_assignments ta
      WHERE ta.id = test_sessions.assignment_id
      AND (
        ta.student_id = auth.uid()
        OR get_my_role() = 'admin'
      )
    )
  );

-- Responses policies
CREATE POLICY responses_all ON responses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_sessions ts
      JOIN test_assignments ta ON ta.id = ts.assignment_id
      JOIN tests t ON t.id = ta.test_id
      WHERE ts.id = responses.session_id
      AND (
        get_my_role() = 'admin'
        OR ta.student_id = auth.uid()
        OR t.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_sessions ts
      JOIN test_assignments ta ON ta.id = ts.assignment_id
      WHERE ts.id = responses.session_id
      AND ta.student_id = auth.uid()
      AND ts.status = 'in_progress'
    )
  );

-- Session results policies
CREATE POLICY session_results_select ON session_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_sessions ts
      JOIN test_assignments ta ON ta.id = ts.assignment_id
      JOIN tests t ON t.id = ta.test_id
      WHERE ts.id = session_results.session_id
      AND (
        get_my_role() = 'admin'
        OR ta.student_id = auth.uid()
        OR t.created_by = auth.uid()
      )
    )
  );

CREATE POLICY session_results_insert ON session_results FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- Helper: list students for assignment (teachers/admins only)
CREATE OR REPLACE FUNCTION public.list_students()
RETURNS TABLE (id UUID, display_name TEXT, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.email
  FROM profiles p
  WHERE p.role = 'student'
  AND get_my_role() IN ('admin', 'teacher')
  ORDER BY p.display_name
$$;

GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
