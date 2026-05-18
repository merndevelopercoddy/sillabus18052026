-- =============================================
-- SILLABUS TIZIMI — BARCHA JADVALLAR
-- PostgreSQL uchun
-- =============================================

-- 1. SESSION JADVALI (connect-pg-simple uchun)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR      NOT NULL COLLATE "default",
  "sess"   JSON         NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- =============================================
-- 2. FOYDALANUVCHILAR
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  login                VARCHAR(100) NOT NULL UNIQUE,
  password_hash        TEXT         NOT NULL,
  role                 VARCHAR(20)  NOT NULL CHECK (role IN ('superadmin', 'oquv_bolimi', 'kafedra_mudiri', 'oqituvchi', 'admin', 'manager', 'student')),
  full_name            VARCHAR(200),
  email                VARCHAR(200),
  kafedra_id           INTEGER,
  must_change_password BOOLEAN      DEFAULT TRUE,
  is_active            BOOLEAN      DEFAULT TRUE,
  last_login_at        TIMESTAMP,
  password_changed_at  TIMESTAMP,
  created_at           TIMESTAMP    DEFAULT NOW(),
  updated_at           TIMESTAMP    DEFAULT NOW()
);

-- =============================================
-- 3. VILOYATLAR
-- =============================================
CREATE TABLE IF NOT EXISTS viloyatlar (
  id   SERIAL PRIMARY KEY,
  nomi VARCHAR(150) NOT NULL UNIQUE
);

-- =============================================
-- 4. TUMANLAR
-- =============================================
CREATE TABLE IF NOT EXISTS tumanlar (
  id         SERIAL PRIMARY KEY,
  nomi       VARCHAR(150) NOT NULL,
  viloyat_id INTEGER      NOT NULL REFERENCES viloyatlar(id) ON DELETE CASCADE,
  UNIQUE(nomi, viloyat_id)
);

-- =============================================
-- 5. KAFEDRALAR
-- =============================================
CREATE TABLE IF NOT EXISTS kafedralar (
  id         SERIAL PRIMARY KEY,
  nomi       VARCHAR(300) NOT NULL,
  qisqa_nomi VARCHAR(50),
  mudiri_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_kafedra
  FOREIGN KEY (kafedra_id) REFERENCES kafedralar(id) ON DELETE SET NULL;

-- =============================================
-- 6. AKADEMIK YILLAR
-- =============================================
CREATE TABLE IF NOT EXISTS akademik_yillar (
  id             SERIAL PRIMARY KEY,
  nomi           VARCHAR(20) NOT NULL UNIQUE,
  boshlanish_yil INTEGER NOT NULL,
  tugash_yil     INTEGER NOT NULL,
  faol           BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 7. MANAGER — GURUH BIRIKTIRISH
-- =============================================
CREATE TABLE IF NOT EXISTS manager_guruh (
  id         SERIAL PRIMARY KEY,
  manager_id INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guruh      VARCHAR(100) NOT NULL,
  UNIQUE(manager_id, guruh)
);

-- =============================================
-- 6. UMUMIY MA'LUMOTLAR
-- =============================================
CREATE TABLE IF NOT EXISTS umumiy (
  id            SERIAL PRIMARY KEY,
  talaba_id     INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  rasm          VARCHAR(255),
  familiya      VARCHAR(100),
  ism           VARCHAR(100),
  sharif        VARCHAR(100),
  viloyat       INTEGER REFERENCES viloyatlar(id),
  tuman         INTEGER REFERENCES tumanlar(id),
  manzili       TEXT,
  t_sana        DATE,
  telefon       VARCHAR(25),
  telefon2      VARCHAR(25),
  p_seriya      VARCHAR(5),
  p_number      VARCHAR(20),
  jshshir       VARCHAR(20),
  talim_turi    VARCHAR(100),
  kursi         INTEGER,
  tolov_turi    VARCHAR(100),
  talim_shakli  VARCHAR(100),
  shifr         VARCHAR(50),
  mutaxassislik VARCHAR(200),
  talim_tili    VARCHAR(50),
  t_viloyat     INTEGER REFERENCES viloyatlar(id),
  guruh         VARCHAR(100),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 7. TA'LIM MA'LUMOTLARI
-- =============================================
CREATE TABLE IF NOT EXISTS talim (
  id            SERIAL PRIMARY KEY,
  talaba_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tm_nomi       VARCHAR(300),
  kirgan        VARCHAR(10),
  tugatgan      VARCHAR(10),
  mutaxassislik VARCHAR(200),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 8. TIL BILISH
-- =============================================
CREATE TABLE IF NOT EXISTS til_bilish (
  id           SERIAL PRIMARY KEY,
  talaba_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  til_nomi     VARCHAR(100),
  sertifikat   VARCHAR(100),
  sert_daraja  VARCHAR(50),
  sert_muddati DATE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 9. QIZIQISHLARI
-- =============================================
CREATE TABLE IF NOT EXISTS qiziqishlari (
  id                SERIAL PRIMARY KEY,
  talaba_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qiziqish_turi     VARCHAR(200),
  qiziqish_yunalish VARCHAR(200),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 10. YUTUQLARI
-- =============================================
CREATE TABLE IF NOT EXISTS yutuqlari (
  id           SERIAL PRIMARY KEY,
  talaba_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yutuq_nomi   VARCHAR(200),
  yutuq_yili   VARCHAR(10),
  yutuq_daraja VARCHAR(100),
  yutuq_joyi   VARCHAR(200),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 11. YASHASH HOLATI
-- =============================================
CREATE TABLE IF NOT EXISTS yashash_holati (
  id           SERIAL PRIMARY KEY,
  talaba_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  yashash_joyi VARCHAR(200),
  viloyat_id   INTEGER REFERENCES viloyatlar(id),
  tuman_id     INTEGER REFERENCES tumanlar(id),
  manzili      TEXT,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 12. OILAVIY HOLATI
-- =============================================
CREATE TABLE IF NOT EXISTS oilaviy_holati (
  id            SERIAL PRIMARY KEY,
  talaba_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  jinsi         VARCHAR(20),
  oilaviy_holat VARCHAR(100),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 13. IJTIMOIY HOLATI
-- =============================================
CREATE TABLE IF NOT EXISTS ijtimoiy_holati (
  id               SERIAL PRIMARY KEY,
  talaba_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ihyar            BOOLEAN,
  ydaftari         BOOLEAN,
  ayoldaftari      BOOLEAN,
  temirdaftari     BOOLEAN,
  imtiyozuqish     BOOLEAN,
  hxizmat          BOOLEAN,
  nafaqa           BOOLEAN,
  ishrasmiy        BOOLEAN,
  ishnorasmiy      BOOLEAN,
  farzandli        BOOLEAN,
  ota_onalik_mahrum BOOLEAN,
  m_uyi            BOOLEAN,
  nogironligi      BOOLEAN,
  n_toifalari      VARCHAR(100),
  yetimlik         VARCHAR(100),
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 14. IQTIDORLI YOSHLAR
-- =============================================
CREATE TABLE IF NOT EXISTS iqtidorli (
  id          SERIAL PRIMARY KEY,
  talaba_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dmukofot    BOOLEAN DEFAULT FALSE,
  knishon     BOOLEAN DEFAULT FALSE,
  pstipendiya BOOLEAN DEFAULT FALSE,
  dstipendiya BOOLEAN DEFAULT FALSE,
  xstipendiya BOOLEAN DEFAULT FALSE,
  rsport      BOOLEAN DEFAULT FALSE,
  xsport      BOOLEAN DEFAULT FALSE,
  resfan      BOOLEAN DEFAULT FALSE,
  xfan        BOOLEAN DEFAULT FALSE,
  boshqayutuq BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 15. MODDIY YORDAM
-- =============================================
CREATE TABLE IF NOT EXISTS moddiy_yordam (
  id          SERIAL PRIMARY KEY,
  talaba_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  itopshirgan BOOLEAN DEFAULT FALSE,
  ixarajat    BOOLEAN DEFAULT FALSE,
  tshartnoma  BOOLEAN DEFAULT FALSE,
  itulov      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 16. HUQUQBUZARLIK
-- =============================================
CREATE TABLE IF NOT EXISTS huquqbuzarlik (
  id              SERIAL PRIMARY KEY,
  talaba_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notinch         BOOLEAN DEFAULT FALSE,
  ytabiatli       BOOLEAN DEFAULT FALSE,
  jiem            BOOLEAN DEFAULT FALSE,
  probatsiya      BOOLEAN DEFAULT FALSE,
  horderi         BOOLEAN DEFAULT FALSE,
  jqasd           BOOLEAN DEFAULT FALSE,
  mhuquqbuzarlik  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 17. QARINDOSHLARI HAQIDA
-- =============================================
CREATE TABLE IF NOT EXISTS qarindoshlari_haqida (
  id               SERIAL PRIMARY KEY,
  talaba_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  q_familiya       VARCHAR(100),
  q_ism            VARCHAR(100),
  q_sharif         VARCHAR(100),
  q_qarindoshligi  VARCHAR(50),
  q_tugilgan       DATE,
  q_telefon        VARCHAR(25),
  q_ish_joyi       VARCHAR(200),
  q_lavozimi       VARCHAR(200),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 18. MEHNAT FAOLIYATI
-- =============================================
CREATE TABLE IF NOT EXISTS mehnat (
  id         SERIAL PRIMARY KEY,
  talaba_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tashkilot  VARCHAR(200),
  lavozim    VARCHAR(200),
  boshlangan DATE,
  tugagan    DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 19. TASHKILOT (manager profili)
-- =============================================
CREATE TABLE IF NOT EXISTS tashkilot (
  id             SERIAL PRIMARY KEY,
  tashkilot_nomi VARCHAR(200) NOT NULL,
  logo           VARCHAR(255),
  masul          VARCHAR(200),
  short_name     VARCHAR(50),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 20. TA'LIM YO'NALISHLARI
-- =============================================
CREATE TABLE IF NOT EXISTS yonalish (
  id              SERIAL PRIMARY KEY,
  yonalish_shifri VARCHAR(50) UNIQUE,
  yonalish_nomi   VARCHAR(300) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 21. FANLAR
-- =============================================
CREATE TABLE IF NOT EXISTS fanlar (
  id              SERIAL PRIMARY KEY,
  f_nomi          VARCHAR(300) NOT NULL,
  fan_kodi        VARCHAR(50)  NOT NULL UNIQUE,
  kafedra_id      INTEGER REFERENCES kafedralar(id) ON DELETE SET NULL,
  grade           VARCHAR(20),
  davomiyligi     INTEGER,
  semestr         TEXT[],
  t_shakli        VARCHAR(100),
  ects            NUMERIC(6,2),
  auditoriya_soat INTEGER DEFAULT 0,
  mustaqil_soat   INTEGER DEFAULT 0,
  t_yunalish      TEXT[],
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- FAN — O'QITUVCHI BIRIKTIRISH (ko'pdan-ko'p)
-- =============================================
CREATE TABLE IF NOT EXISTS fan_oqituvchi (
  id               SERIAL PRIMARY KEY,
  fan_id           INTEGER NOT NULL REFERENCES fanlar(id) ON DELETE CASCADE,
  oqituvchi_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  akademik_yil_id  INTEGER REFERENCES akademik_yillar(id) ON DELETE SET NULL,
  mas_ul           BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(fan_id, oqituvchi_id, akademik_yil_id)
);

-- NULL akademik_yil_id holati uchun alohida partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_fan_oqituvchi_null_yil
  ON fan_oqituvchi(fan_id, oqituvchi_id)
  WHERE akademik_yil_id IS NULL;

-- =============================================
-- 22. ADABIYOTLAR
-- =============================================
CREATE TABLE IF NOT EXISTS adabiyotlar (
  id            SERIAL PRIMARY KEY,
  manba_turi    VARCHAR(50),
  avtor         VARCHAR(300),
  adabiyot_nomi VARCHAR(500),
  yili          INTEGER,
  sahifa_soni   INTEGER,
  url           TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 23. FAN — ADABIYOTLAR (ko'pdan-ko'p)
-- =============================================
CREATE TABLE IF NOT EXISTS fan_adabiyotlari (
  id          SERIAL PRIMARY KEY,
  fan_id      INTEGER NOT NULL REFERENCES fanlar(id)     ON DELETE CASCADE,
  adabiyot_id INTEGER NOT NULL REFERENCES adabiyotlar(id) ON DELETE CASCADE,
  turi        VARCHAR(50),
  UNIQUE(fan_id, adabiyot_id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SEED: O'ZBEKISTON VILOYATLARI VA TUMANLARI
-- =============================================

INSERT INTO viloyatlar (nomi) VALUES
  ('Andijon viloyati'),
  ('Buxoro viloyati'),
  ('Farg''ona viloyati'),
  ('Jizzax viloyati'),
  ('Namangan viloyati'),
  ('Navoiy viloyati'),
  ('Qashqadaryo viloyati'),
  ('Qoraqalpog''iston Respublikasi'),
  ('Samarqand viloyati'),
  ('Sirdaryo viloyati'),
  ('Surxondaryo viloyati'),
  ('Toshkent viloyati'),
  ('Toshkent shahri'),
  ('Xorazm viloyati')
ON CONFLICT (nomi) DO NOTHING;

-- ANDIJON
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Andijon shahri'),
  ('Asaka tumani'),
  ('Baliqchi tumani'),
  ('Bo''z tumani'),
  ('Buloqboshi tumani'),
  ('Izbaskan tumani'),
  ('Jalolquduq tumani'),
  ('Marhamat tumani'),
  ('Oltinkol tumani'),
  ('Paxtaobod tumani'),
  ('Qo''rg''ontepa tumani'),
  ('Shahrixon tumani'),
  ('Ulugnor tumani'),
  ('Xo''jaobod tumani')
) AS t(nomi) WHERE v.nomi = 'Andijon viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- BUXORO
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Buxoro shahri'),
  ('G''ijduvon tumani'),
  ('Jondor tumani'),
  ('Kogon shahri'),
  ('Olot tumani'),
  ('Peshku tumani'),
  ('Qorakol tumani'),
  ('Qorovulbozor tumani'),
  ('Romitan tumani'),
  ('Shofirkon tumani'),
  ('Vobkent tumani')
) AS t(nomi) WHERE v.nomi = 'Buxoro viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- FARG'ONA
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Farg''ona shahri'),
  ('Bag''dod tumani'),
  ('Beshariq tumani'),
  ('Bo''ka tumani'),
  ('Dangara tumani'),
  ('Furqat tumani'),
  ('Marg''ilon shahri'),
  ('Oltiariq tumani'),
  ('O''zbekiston tumani'),
  ('Quva tumani'),
  ('Qo''qon shahri'),
  ('Rishton tumani'),
  ('So''x tumani'),
  ('Toshloq tumani'),
  ('Uchko''prik tumani'),
  ('Yozyovon tumani')
) AS t(nomi) WHERE v.nomi = 'Farg''ona viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- JIZZAX
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Jizzax shahri'),
  ('Arnasoy tumani'),
  ('Baxmal tumani'),
  ('Do''stlik tumani'),
  ('Forish tumani'),
  ('G''allaorol tumani'),
  ('Mirzacho''l tumani'),
  ('Paxtakor tumani'),
  ('Sharof Rashidov tumani'),
  ('Yangiobod tumani'),
  ('Zafarobod tumani'),
  ('Zarbdor tumani'),
  ('Zomin tumani')
) AS t(nomi) WHERE v.nomi = 'Jizzax viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- NAMANGAN
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Namangan shahri'),
  ('Chortoq tumani'),
  ('Chust tumani'),
  ('Kosonsoy tumani'),
  ('Mingbuloq tumani'),
  ('Namangan tumani'),
  ('Norin tumani'),
  ('Pop tumani'),
  ('To''raqo''rg''on tumani'),
  ('Uchqo''rg''on tumani'),
  ('Ulug''nor tumani'),
  ('Yangiqo''rg''on tumani')
) AS t(nomi) WHERE v.nomi = 'Namangan viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- NAVOIY
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Navoiy shahri'),
  ('Karmana tumani'),
  ('Konimex tumani'),
  ('Navbahor tumani'),
  ('Nurota tumani'),
  ('Qiziltepa tumani'),
  ('Tomdi tumani'),
  ('Uchquduq tumani'),
  ('Xatirchi tumani')
) AS t(nomi) WHERE v.nomi = 'Navoiy viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- QASHQADARYO
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Qarshi shahri'),
  ('Chiroqchi tumani'),
  ('Dehqonobod tumani'),
  ('G''uzor tumani'),
  ('Kamashi tumani'),
  ('Kasbi tumani'),
  ('Kitob tumani'),
  ('Koson tumani'),
  ('Mirishkor tumani'),
  ('Muborak tumani'),
  ('Nishon tumani'),
  ('Shahrisabz tumani'),
  ('Yakkabog'' tumani')
) AS t(nomi) WHERE v.nomi = 'Qashqadaryo viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- QORAQALPOG'ISTON
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Nukus shahri'),
  ('Amudaryo tumani'),
  ('Beruniy tumani'),
  ('Bo''zatov tumani'),
  ('Chimboy tumani'),
  ('Ellikkala tumani'),
  ('Kegeyli tumani'),
  ('Mo''ynoq tumani'),
  ('Nukus tumani'),
  ('Qanliko''l tumani'),
  ('Qo''ng''irot tumani'),
  ('Qorao''zak tumani'),
  ('Shumanay tumani'),
  ('Taxtako''pir tumani'),
  ('To''rtko''l tumani'),
  ('Xo''jayli tumani')
) AS t(nomi) WHERE v.nomi = 'Qoraqalpog''iston Respublikasi'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- SAMARQAND
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Samarqand shahri'),
  ('Bulungur tumani'),
  ('Ishtixon tumani'),
  ('Jomboy tumani'),
  ('Kattaqo''rg''on shahri'),
  ('Narpay tumani'),
  ('Nurobod tumani'),
  ('Oqdaryo tumani'),
  ('Pastdarg''om tumani'),
  ('Paxtachi tumani'),
  ('Payariq tumani'),
  ('Qo''shrabot tumani'),
  ('Toyloq tumani'),
  ('Urgut tumani')
) AS t(nomi) WHERE v.nomi = 'Samarqand viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- SIRDARYO
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Guliston shahri'),
  ('Boyovut tumani'),
  ('Guliston tumani'),
  ('Mirzaobod tumani'),
  ('Oqoltin tumani'),
  ('Sardoba tumani'),
  ('Sayxunobod tumani'),
  ('Sirdaryo tumani'),
  ('Xovos tumani'),
  ('Yangiyer shahri')
) AS t(nomi) WHERE v.nomi = 'Sirdaryo viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- SURXONDARYO
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Termiz shahri'),
  ('Angor tumani'),
  ('Bandixon tumani'),
  ('Boysun tumani'),
  ('Denov tumani'),
  ('Jarqo''rg''on tumani'),
  ('Muzrabot tumani'),
  ('Oltinsoy tumani'),
  ('Qiziriq tumani'),
  ('Qumqo''rg''on tumani'),
  ('Sariosiy tumani'),
  ('Sherobod tumani'),
  ('Sho''rchi tumani'),
  ('Uzun tumani')
) AS t(nomi) WHERE v.nomi = 'Surxondaryo viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- TOSHKENT VILOYATI
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Angren shahri'),
  ('Bekabad shahri'),
  ('Bo''stonliq tumani'),
  ('Chinoz tumani'),
  ('Ohangaron tumani'),
  ('Oqqo''rg''on tumani'),
  ('Parkent tumani'),
  ('Piskent tumani'),
  ('Qibray tumani'),
  ('Toshkent tumani'),
  ('Yangiyo''l shahri'),
  ('Yangiyo''l tumani'),
  ('Yuqorichirchiq tumani'),
  ('Zangiota tumani')
) AS t(nomi) WHERE v.nomi = 'Toshkent viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- TOSHKENT SHAHRI (tumanlar)
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Bektemir tumani'),
  ('Chilonzor tumani'),
  ('Hamza tumani'),
  ('Mirobod tumani'),
  ('Mirzo Ulug''bek tumani'),
  ('Olmazor tumani'),
  ('Sergeli tumani'),
  ('Shayxontohur tumani'),
  ('Uchtepa tumani'),
  ('Yakkasaroy tumani'),
  ('Yashnobod tumani'),
  ('Yunusobod tumani')
) AS t(nomi) WHERE v.nomi = 'Toshkent shahri'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;

-- XORAZM
INSERT INTO tumanlar (nomi, viloyat_id) SELECT t.nomi, v.id FROM viloyatlar v, (VALUES
  ('Urganch shahri'),
  ('Bog''ot tumani'),
  ('Gurlan tumani'),
  ('Xazarasp tumani'),
  ('Xiva tumani'),
  ('Xonqa tumani'),
  ('Qo''shko''pir tumani'),
  ('Shovot tumani'),
  ('Tuproqqal''a tumani'),
  ('Yangiariq tumani'),
  ('Yangibozor tumani')
) AS t(nomi) WHERE v.nomi = 'Xorazm viloyati'
ON CONFLICT (nomi, viloyat_id) DO NOTHING;
