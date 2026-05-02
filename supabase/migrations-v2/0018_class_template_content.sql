-- Add marketing content columns to class_templates
ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url    TEXT;

-- Public read on schedule_rules (anon via x-studio-slug, members via studio membership)
-- Staff already have SELECT via staff_select_schedule_rules in 0017.
DROP POLICY IF EXISTS "anon_read_schedule_rules" ON schedule_rules;
CREATE POLICY "anon_read_schedule_rules" ON schedule_rules
  FOR SELECT TO anon
  USING (
    studio_id IN (
      SELECT id FROM studios
      WHERE slug = current_setting('request.headers', true)::json->>'x-studio-slug'
    )
  );

DROP POLICY IF EXISTS "member_read_schedule_rules" ON schedule_rules;
CREATE POLICY "member_read_schedule_rules" ON schedule_rules
  FOR SELECT TO authenticated
  USING (studio_id = ANY(user_studio_ids()));
