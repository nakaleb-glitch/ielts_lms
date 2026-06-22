ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN (
    'multiple_choice', 'true_false_not_given', 'yes_no_not_given',
    'gap_fill', 'matching_information', 'matching_headings'
  ));

DELETE FROM questions WHERE type = 'matching';
