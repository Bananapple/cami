-- 0026_instructor_contact.sql
-- Adds email and phone to instructors for contact + platform invite.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
