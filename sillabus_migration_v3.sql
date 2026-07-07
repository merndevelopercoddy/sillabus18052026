-- v3: taqrizchi1/2 fixed columns -> dynamic sillabus_taqrizchilar table (unlimited reviewers)

CREATE TABLE IF NOT EXISTS sillabus_taqrizchilar (
  id SERIAL PRIMARY KEY,
  sillabus_id INTEGER NOT NULL REFERENCES sillabuslar(id) ON DELETE CASCADE,
  tartib INTEGER NOT NULL DEFAULT 1,
  fish VARCHAR(255),
  lavozim VARCHAR(255),
  tel VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO sillabus_taqrizchilar (sillabus_id, tartib, fish, lavozim, tel)
SELECT id, 1, taqrizchi1_fish, taqrizchi1_lavozim, taqrizchi1_tel
FROM sillabuslar
WHERE taqrizchi1_fish IS NOT NULL AND taqrizchi1_fish <> '';

INSERT INTO sillabus_taqrizchilar (sillabus_id, tartib, fish, lavozim, tel)
SELECT id, 2, taqrizchi2_fish, taqrizchi2_lavozim, taqrizchi2_tel
FROM sillabuslar
WHERE taqrizchi2_fish IS NOT NULL AND taqrizchi2_fish <> '';

ALTER TABLE sillabuslar
  DROP COLUMN IF EXISTS taqrizchi1_fish,
  DROP COLUMN IF EXISTS taqrizchi1_lavozim,
  DROP COLUMN IF EXISTS taqrizchi1_tel,
  DROP COLUMN IF EXISTS taqrizchi2_fish,
  DROP COLUMN IF EXISTS taqrizchi2_lavozim,
  DROP COLUMN IF EXISTS taqrizchi2_tel;
