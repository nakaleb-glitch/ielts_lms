-- Replace gap_fill with summary_completion

DELETE FROM questions WHERE type = 'gap_fill';

ALTER TABLE questions DROP CONSTRAINT questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN (
    'multiple_choice', 'true_false_not_given', 'yes_no_not_given',
    'summary_completion', 'matching_information', 'matching_headings'
  ));

-- Re-seed a summary completion group on the demo passage (if present)
DO $$
DECLARE
  v_passage_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_global_order INT;
  v_order_index INT;
  v_q_id UUID;
  v_summary TEXT := 'At the start of the 20th century, Dr. Elie Metchnikoff put forward his belief that the {{1}} and good health of Bulgarians could be attributed to eating fermented food each day. By {{2}} and preserving milk, they were able to convert it into {{3}} and {{4}} In other parts of Europe, fermented {{5}} was consumed as a replacement for clean water. People used to ferment {{6}} which gave them a longer lifespan but nowadays mass production favours pickling.';
  v_config JSONB;
  v_answers TEXT[] := ARRAY['C', 'I', 'B', 'H', 'E', 'J'];
  i INT;
BEGIN
  SELECT p.id INTO v_passage_id
  FROM passages p
  JOIN tests t ON t.id = p.test_id
  WHERE t.title = 'Demo IELTS Reading Test'
  LIMIT 1;

  IF v_passage_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(global_order), 0) + 1, COALESCE(MAX(order_index), 0) + 1
  INTO v_global_order, v_order_index
  FROM questions WHERE passage_id = v_passage_id;

  v_config := jsonb_build_object(
    'groupId', v_group_id::text,
    'directions', 'Complete the summary below by selecting the right word from the list below. Write the correct letter for your answer.',
    'noteHeading', 'International Uses for Fermentation',
    'summaryText', v_summary,
    'wordBank', jsonb_build_array(
      'ingesting', 'yogurt', 'longevity', 'pickled products', 'wine',
      'food', 'kimchi', 'cheese', 'detoxifying', 'vegetables'
    )
  );

  FOR i IN 1..6 LOOP
    INSERT INTO questions (passage_id, order_index, global_order, type, prompt, config)
    VALUES (
      v_passage_id,
      v_order_index,
      v_global_order,
      'summary_completion',
      'Blank ' || i,
      v_config
    )
    RETURNING id INTO v_q_id;

    INSERT INTO question_answers (question_id, acceptable_answers)
    VALUES (v_q_id, jsonb_build_array(v_answers[i]));

    v_order_index := v_order_index + 1;
    v_global_order := v_global_order + 1;
  END LOOP;
END $$;
