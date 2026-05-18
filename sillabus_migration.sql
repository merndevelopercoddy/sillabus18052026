-- =============================================
-- SILLABUS MODULI MIGRATSIYASI
-- =============================================

-- 1. ASOSIY SILLABUS JADVALI
CREATE TABLE IF NOT EXISTS sillabuslar (
  id                    SERIAL PRIMARY KEY,
  fan_oqituvchi_id      INTEGER NOT NULL UNIQUE REFERENCES fan_oqituvchi(id) ON DELETE CASCADE,

  -- Umumiy qismlar (oquv_bolimi kiradi)
  bilim_ko_nikma        TEXT,
  talabalarni_qabul_kuni VARCHAR(100),
  tuzuvchi_fish         VARCHAR(200),
  tuzuvchi_lavozim      VARCHAR(200),
  tuzuvchi_tel          VARCHAR(50),
  taqrizchi1_fish       VARCHAR(200),
  taqrizchi1_lavozim    VARCHAR(200),
  taqrizchi1_tel        VARCHAR(50),
  taqrizchi2_fish       VARCHAR(200),
  taqrizchi2_lavozim    VARCHAR(200),
  taqrizchi2_tel        VARCHAR(50),

  holat                 VARCHAR(20) DEFAULT 'tahrir',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- 2. MA'RUZA VA AMALIY MASHG'ULOTLAR REJASI
CREATE TABLE IF NOT EXISTS maruza_amaliy_reja (
  id            SERIAL PRIMARY KEY,
  sillabus_id   INTEGER NOT NULL REFERENCES sillabuslar(id) ON DELETE CASCADE,
  tartib_raqam  INTEGER NOT NULL,
  mavzu         VARCHAR(500) NOT NULL,
  dars_mazmuni  TEXT[],
  maruza_soat   INTEGER DEFAULT 0,
  amaliy_soat   INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 3. MUSTAQIL TA'LIM MASHG'ULOTLARI REJASI
CREATE TABLE IF NOT EXISTS mustaqil_talim (
  id            SERIAL PRIMARY KEY,
  sillabus_id   INTEGER NOT NULL REFERENCES sillabuslar(id) ON DELETE CASCADE,
  tartib_raqam  INTEGER NOT NULL,
  mavzu         VARCHAR(500) NOT NULL,
  topshiriq     TEXT,
  soat          INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 4. FANNI BAHOLASH MEZONI VA REJASI (foiz jadval)
CREATE TABLE IF NOT EXISTS baholash_mezoni (
  id          SERIAL PRIMARY KEY,
  sillabus_id INTEGER NOT NULL REFERENCES sillabuslar(id) ON DELETE CASCADE,
  nomi        VARCHAR(200) NOT NULL,
  foiz        NUMERIC(5,2) NOT NULL DEFAULT 0,
  izoh        TEXT,
  tartib      INTEGER DEFAULT 0
);

-- 5. TALABALAR BILIMINI BAHOLASH MEZONI (ball jadval)
CREATE TABLE IF NOT EXISTS talabalar_baholash (
  id               SERIAL PRIMARY KEY,
  sillabus_id      INTEGER NOT NULL REFERENCES sillabuslar(id) ON DELETE CASCADE,
  guruh            VARCHAR(100) NOT NULL,
  nazorat_nomi     VARCHAR(200) NOT NULL,
  izoh             TEXT,
  ball             INTEGER NOT NULL DEFAULT 0,
  otkazilish_vaqti VARCHAR(100),
  tartib           INTEGER DEFAULT 0
);
