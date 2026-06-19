-- Demo seed data (run after creating auth users manually or via Supabase dashboard)
-- Replace UUIDs with actual user IDs from auth.users after signup.

-- Example: create demo test owned by first teacher profile
-- This seed is intended for local dev; adjust created_by to your teacher UUID.

DO $$
DECLARE
  v_teacher_id UUID;
  v_student_id UUID;
  v_test_id UUID;
  v_passage_id UUID;
  v_q1 UUID;
  v_q2 UUID;
  v_q3 UUID;
  v_q4 UUID;
  v_q5 UUID;
  v_assignment_id UUID;
BEGIN
  SELECT id INTO v_teacher_id FROM profiles WHERE role IN ('teacher', 'admin') LIMIT 1;
  SELECT id INTO v_student_id FROM profiles WHERE role = 'student' LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RAISE NOTICE 'No teacher/admin profile found. Skipping seed.';
    RETURN;
  END IF;

  INSERT INTO tests (title, instructions, duration_minutes, status, created_by)
  VALUES (
    'Demo IELTS Reading Test',
    'Read the passage and answer all questions. You have 60 minutes.',
    60,
    'published',
    v_teacher_id
  )
  RETURNING id INTO v_test_id;

  INSERT INTO passages (test_id, order_index, title, body)
  VALUES (
    v_test_id,
    1,
    'Passage 1: Urban Farming',
    E'Urban farming has grown rapidly in cities worldwide. Rooftop gardens, vertical farms, and community plots allow residents to grow fresh produce close to home.\n\nProponents argue that urban agriculture reduces food miles, improves food security, and creates green spaces. Critics note that startup costs can be high and yields are often smaller than rural farms.\n\nDespite challenges, many cities now include urban farming in sustainability plans.'
  )
  RETURNING id INTO v_passage_id;

  INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
  VALUES (v_passage_id, 1, 1, 'multiple_choice',
    'What is one benefit of urban farming mentioned in the passage?',
    '{"options": ["It eliminates all food transport", "It can reduce food miles", "It always produces higher yields", "It replaces rural agriculture"]}'::jsonb)
  RETURNING id INTO v_q1;

  INSERT INTO question_answers (question_id, acceptable_answers) VALUES (v_q1, '["It can reduce food miles"]'::jsonb);

  INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
  VALUES (v_passage_id, 2, 2, 'true_false_not_given',
    'Urban farming is included in sustainability plans in many cities.',
    '{}'::jsonb)
  RETURNING id INTO v_q2;

  INSERT INTO question_answers (question_id, acceptable_answers) VALUES (v_q2, '["TRUE"]'::jsonb);

  INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
  VALUES (v_passage_id, 3, 3, 'yes_no_not_given',
    'All urban farms are more profitable than rural farms.',
    '{}'::jsonb)
  RETURNING id INTO v_q3;

  INSERT INTO question_answers (question_id, acceptable_answers) VALUES (v_q3, '["NOT GIVEN"]'::jsonb);

  INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
  VALUES (v_passage_id, 4, 4, 'gap_fill',
    'Complete: Urban agriculture can improve ______ security.',
    '{"blanks": ["food"]}'::jsonb)
  RETURNING id INTO v_q4;

  INSERT INTO question_answers (question_id, acceptable_answers) VALUES (v_q4, '[["food"]]'::jsonb);

  INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
  VALUES (v_passage_id, 5, 5, 'matching',
    'Match each feature to the correct category.',
    '{"items": ["Rooftop gardens", "High startup costs"], "matchOptions": ["Benefit", "Challenge"]}'::jsonb)
  RETURNING id INTO v_q5;

  INSERT INTO question_answers (question_id, acceptable_answers)
  VALUES (v_q5, '{"0": "Benefit", "1": "Challenge"}'::jsonb);

  IF v_student_id IS NOT NULL THEN
    INSERT INTO test_assignments (test_id, student_id, assigned_by)
    VALUES (v_test_id, v_student_id, v_teacher_id)
    RETURNING id INTO v_assignment_id;
  END IF;

  RAISE NOTICE 'Demo test created: %', v_test_id;
END $$;
