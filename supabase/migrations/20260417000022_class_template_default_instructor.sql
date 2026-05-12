ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS default_instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL;
