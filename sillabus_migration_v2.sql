-- =============================================
-- SILLABUS MODULI MIGRATSIYASI v2
-- Adabiyotlar, internet manzillar, kengash majlisi
-- =============================================

ALTER TABLE sillabuslar ADD COLUMN IF NOT EXISTS asosiy_adabiyotlar TEXT;
ALTER TABLE sillabuslar ADD COLUMN IF NOT EXISTS qoshimcha_adabiyotlar TEXT;
ALTER TABLE sillabuslar ADD COLUMN IF NOT EXISTS internet_manzillar TEXT;
ALTER TABLE sillabuslar ADD COLUMN IF NOT EXISTS majlis_raqami VARCHAR(50);
ALTER TABLE sillabuslar ADD COLUMN IF NOT EXISTS majlis_sanasi DATE;
