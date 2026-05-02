-- Add marketing content columns to class_templates
ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url    TEXT;

-- Public read on schedule_rules (anon via x-studio-slug, members via studio membership)
-- Staff already have SELECT via schedule_rules_staff_read in 0008.
DROP POLICY IF EXISTS "anon_read_schedule_rules" ON schedule_rules;
CREATE POLICY "anon_read_schedule_rules" ON schedule_rules
  FOR SELECT TO anon
  USING (
    studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

DROP POLICY IF EXISTS "member_read_schedule_rules" ON schedule_rules;
CREATE POLICY "member_read_schedule_rules" ON schedule_rules
  FOR SELECT TO authenticated
  USING (
    studio_id = ANY(
      SELECT studio_id FROM studio_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
