-- Allow test assigners (not just creators) to read session results

DROP POLICY IF EXISTS session_results_select ON session_results;

CREATE POLICY session_results_select ON session_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_sessions ts
      JOIN test_assignments ta ON ta.id = ts.assignment_id
      JOIN tests t ON t.id = ta.test_id
      WHERE ts.id = session_results.session_id
      AND (
        get_user_role() = 'admin'
        OR ta.student_id = auth.uid()
        OR t.created_by = auth.uid()
        OR ta.assigned_by = auth.uid()
      )
    )
  );
