-- Staff can manage class templates
DROP POLICY IF EXISTS "staff_insert_class_templates" ON class_templates;
CREATE POLICY "staff_insert_class_templates" ON class_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_is_staff(studio_id));

DROP POLICY IF EXISTS "staff_update_class_templates" ON class_templates;
CREATE POLICY "staff_update_class_templates" ON class_templates
  FOR UPDATE TO authenticated
  USING (user_is_staff(studio_id))
  WITH CHECK (user_is_staff(studio_id));

-- Staff can manage schedule rules
DROP POLICY IF EXISTS "staff_select_schedule_rules" ON schedule_rules;
CREATE POLICY "staff_select_schedule_rules" ON schedule_rules
  FOR SELECT TO authenticated
  USING (user_is_staff(studio_id));

DROP POLICY IF EXISTS "staff_insert_schedule_rules" ON schedule_rules;
CREATE POLICY "staff_insert_schedule_rules" ON schedule_rules
  FOR INSERT TO authenticated
  WITH CHECK (user_is_staff(studio_id));

DROP POLICY IF EXISTS "staff_update_schedule_rules" ON schedule_rules;
CREATE POLICY "staff_update_schedule_rules" ON schedule_rules
  FOR UPDATE TO authenticated
  USING (user_is_staff(studio_id))
  WITH CHECK (user_is_staff(studio_id));
