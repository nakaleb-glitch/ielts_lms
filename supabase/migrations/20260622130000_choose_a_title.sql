ALTER TABLE questions DROP CONSTRAINT questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
  CHECK (type IN (
    'multiple_choice', 'true_false_not_given', 'yes_no_not_given',
    'summary_completion', 'matching_information', 'matching_headings',
    'choose_a_title'
  ));
