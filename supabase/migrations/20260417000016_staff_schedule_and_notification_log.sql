-- Staff RLS: read notification_log for their studio
DROP POLICY IF EXISTS "staff_reads_notification_log" ON notification_log;
CREATE POLICY "staff_reads_notification_log" ON notification_log
  FOR SELECT TO authenticated
  USING (user_is_staff(studio_id));

-- Staff RLS: update class_instances (cancel, edit capacity/instructor/notes)
DROP POLICY IF EXISTS "staff_update_class_instances" ON class_instances;
CREATE POLICY "staff_update_class_instances" ON class_instances
  FOR UPDATE TO authenticated
  USING (user_is_staff(studio_id))
  WITH CHECK (user_is_staff(studio_id));

-- Staff RLS: insert new one-off class_instances
DROP POLICY IF EXISTS "staff_insert_class_instances" ON class_instances;
CREATE POLICY "staff_insert_class_instances" ON class_instances
  FOR INSERT TO authenticated
  WITH CHECK (user_is_staff(studio_id));
