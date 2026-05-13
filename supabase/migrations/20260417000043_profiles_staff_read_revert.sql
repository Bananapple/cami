-- Revert 0042 profiles_staff_read_scope.
--
-- The slug-header approach in 0042 caused member_activity_summary to return
-- empty results. Root cause: that view uses INNER JOIN profiles, so when
-- profiles_staff_read blocks all rows (header null/empty in authenticated
-- context), the join collapses to zero rows.
--
-- Restoring the original pre-0042 policy. The cross-studio PII leak is a real
-- finding but requires a different fix — either at the view/function layer, or
-- a dedicated "operator" concept in the schema that doesn't rely on a
-- per-request header. Tracked in TODOS.md as deferred.

DROP POLICY IF EXISTS profiles_staff_read ON profiles;

CREATE POLICY profiles_staff_read ON profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM studio_members mine
    JOIN studio_members theirs ON theirs.studio_id = mine.studio_id
    WHERE mine.user_id = auth.uid()
      AND mine.is_active
      AND mine.role IN ('owner', 'manager')
      AND theirs.user_id = profiles.id
      AND theirs.is_active
  )
);
