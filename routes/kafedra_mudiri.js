const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, forceChangePassword } = require('../middleware/auth');


// Dashboard
router.get('/kafedra-mudiri/dashboard', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const kafedraRes = await pool.query(
      'SELECT k.* FROM kafedralar k JOIN users u ON u.kafedra_id = k.id WHERE u.id=$1', [userId]
    );
    const kafedra = kafedraRes.rows[0] || null;

    let fanlarCount = 0;
    let oqituvchiCount = 0;
    if (kafedra) {
      const [fRes, oRes] = await Promise.all([
        pool.query('SELECT COUNT(*) AS count FROM fanlar WHERE kafedra_id=$1', [kafedra.id]),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE kafedra_id=$1 AND role='oqituvchi'", [kafedra.id]),
      ]);
      fanlarCount = fRes.rows[0].count;
      oqituvchiCount = oRes.rows[0].count;
    }

    res.render('kafedra_mudiri/dashboard', {
      title: 'Kafedra mudiri',
      kafedra,
      fanlarCount,
      oqituvchiCount,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ── Yordamchi: sessiyadan kafedrani olish ──────────────────────────────────────
async function getKafedra(userId) {
  const res = await pool.query(
    'SELECT k.* FROM kafedralar k JOIN users u ON u.kafedra_id = k.id WHERE u.id=$1',
    [userId]
  );
  return res.rows[0] || null;
}

// ── KAFEDRA FANLARI ────────────────────────────────────────────────────────────
router.get('/kafedra-mudiri/fanlar', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) {
      req.flash('error', 'Sizga kafedra biriktirilmagan.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard'));
    }

    const faolYil = (await pool.query('SELECT * FROM akademik_yillar WHERE faol=TRUE LIMIT 1')).rows[0] || null;

    const { rows: fanlar } = await pool.query(`
      SELECT
        f.*,
        COUNT(DISTINCT fo.oqituvchi_id) AS oqituvchi_soni
      FROM fanlar f
      LEFT JOIN fan_oqituvchi fo ON fo.fan_id = f.id
        AND ($2::BIGINT IS NULL OR fo.akademik_yil_id = $2)
      WHERE f.kafedra_id = $1
      GROUP BY f.id
      ORDER BY f.f_nomi ASC
    `, [kafedra.id, faolYil?.id || null]);

    res.render('kafedra_mudiri/fanlar', {
      kafedra,
      fanlar,
      faolYil,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ── BIRIKTIRISH SAHIFASI ───────────────────────────────────────────────────────
router.get('/kafedra-mudiri/biriktirish', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) {
      req.flash('error', 'Sizga kafedra biriktirilmagan.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard'));
    }

    const faolYil = (await pool.query('SELECT * FROM akademik_yillar WHERE faol=TRUE LIMIT 1')).rows[0] || null;

    const [fanlarRes, oqituvchilarRes, biriktirishRes] = await Promise.all([
      pool.query('SELECT id, f_nomi, fan_kodi FROM fanlar WHERE kafedra_id=$1 ORDER BY f_nomi', [kafedra.id]),
      pool.query("SELECT id, login, full_name FROM users WHERE kafedra_id=$1 AND role='oqituvchi' ORDER BY full_name, login", [kafedra.id]),
      pool.query(`
        SELECT
          fo.id,
          fo.fan_id,
          fo.oqituvchi_id,
          fo.mas_ul,
          fo.bloklangan,
          fo.akademik_yil_id,
          f.f_nomi AS fan_nomi,
          f.fan_kodi,
          u.login AS oqituvchi_login,
          u.full_name AS oqituvchi_nomi,
          ay.nomi AS yil_nomi,
          COUNT(s.id) AS sillabus_soni
        FROM fan_oqituvchi fo
        JOIN fanlar f ON f.id = fo.fan_id
        JOIN users u ON u.id = fo.oqituvchi_id
        LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
        LEFT JOIN sillabuslar s ON s.fan_oqituvchi_id = fo.id
        WHERE f.kafedra_id = $1
        GROUP BY fo.id, fo.fan_id, fo.oqituvchi_id, fo.mas_ul, fo.bloklangan, fo.akademik_yil_id,
                 f.f_nomi, f.fan_kodi, u.login, u.full_name, ay.nomi
        ORDER BY ay.nomi DESC NULLS LAST, f.f_nomi, u.full_name
      `, [kafedra.id]),
    ]);

    const akademikYillar = (await pool.query('SELECT * FROM akademik_yillar ORDER BY boshlanish_yil DESC')).rows;

    res.render('kafedra_mudiri/biriktirish', {
      kafedra,
      fanlar: fanlarRes.rows,
      oqituvchilar: oqituvchilarRes.rows,
      biriktirishlar: biriktirishRes.rows,
      akademikYillar,
      faolYil,
      selectedFanId: req.query.fan_id ? Number(req.query.fan_id) : null,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// O'qituvchini fanga biriktirish POST
router.post('/kafedra-mudiri/biriktirish/add', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) { return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard')); }

    let { fan_id, oqituvchi_id, akademik_yil_id, mas_ul } = req.body;
    const isMasul = mas_ul === 'on';

    // NULL bo'lsa faol yilni olish (ON CONFLICT NULL bilan ishlamaydi)
    if (!akademik_yil_id) {
      const yilRes = await pool.query('SELECT id FROM akademik_yillar WHERE faol=TRUE LIMIT 1');
      akademik_yil_id = yilRes.rows[0]?.id || null;
    } else {
      akademik_yil_id = Number(akademik_yil_id);
    }

    if (!fan_id || !oqituvchi_id) {
      req.flash('error', 'Fan va o\'qituvchini tanlang.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    // Faqat o'z kafedra fanini biriktira oladi
    const fanCheck = await pool.query('SELECT id FROM fanlar WHERE id=$1 AND kafedra_id=$2', [fan_id, kafedra.id]);
    if (!fanCheck.rows.length) {
      req.flash('error', 'Bu fan sizning kafedrangizga tegishli emas.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    // Agar mas'ul qilinsa, avvalgi mas'ulni olib tashlash
    if (isMasul) {
      await pool.query(
        'UPDATE fan_oqituvchi SET mas_ul=FALSE WHERE fan_id=$1 AND (akademik_yil_id=$2 OR ($2::BIGINT IS NULL AND akademik_yil_id IS NULL))',
        [fan_id, akademik_yil_id]
      );
    }

    if (akademik_yil_id) {
      // akademik_yil_id mavjud — ON CONFLICT xavfsiz ishlaydi
      await pool.query(
        `INSERT INTO fan_oqituvchi (fan_id, oqituvchi_id, akademik_yil_id, mas_ul)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (fan_id, oqituvchi_id, akademik_yil_id)
         DO UPDATE SET mas_ul=EXCLUDED.mas_ul`,
        [fan_id, oqituvchi_id, akademik_yil_id, isMasul]
      );
    } else {
      // akademik_yil_id NULL — manual upsert
      const existing = await pool.query(
        'SELECT id FROM fan_oqituvchi WHERE fan_id=$1 AND oqituvchi_id=$2 AND akademik_yil_id IS NULL',
        [fan_id, oqituvchi_id]
      );
      if (existing.rows.length) {
        await pool.query('UPDATE fan_oqituvchi SET mas_ul=$1 WHERE id=$2', [isMasul, existing.rows[0].id]);
      } else {
        await pool.query(
          'INSERT INTO fan_oqituvchi (fan_id, oqituvchi_id, akademik_yil_id, mas_ul) VALUES ($1,$2,NULL,$3)',
          [fan_id, oqituvchi_id, isMasul]
        );
      }
    }

    req.flash('success', 'O\'qituvchi fanga muvaffaqiyatli biriktirildi.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Biriktirishda xatolik yuz berdi.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  }
});

// Vaqtincha bloklash / blokdan chiqarish
router.post('/kafedra-mudiri/biriktirish/:id/block', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) {
      req.flash('error', 'Kafedra topilmadi (userId=' + req.session.user.id + ')');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    // Avval record mavjudligini tekshirish
    const checkRes = await pool.query(
      `SELECT fo.id, fo.bloklangan, fo.fan_id, f.kafedra_id AS fan_kafedra_id
       FROM fan_oqituvchi fo JOIN fanlar f ON f.id=fo.fan_id
       WHERE fo.id=$1`,
      [req.params.id]
    );

    if (!checkRes.rows.length) {
      req.flash('error', `Record topilmadi: fan_oqituvchi.id=${req.params.id}`);
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    const rec = checkRes.rows[0];
    if (Number(rec.fan_kafedra_id) !== Number(kafedra.id)) {
      req.flash('error', `Ruxsat yo'q: fan kafedra_id=${rec.fan_kafedra_id}, sizning kafedra_id=${kafedra.id}`);
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    await pool.query(
      'UPDATE fan_oqituvchi SET bloklangan = NOT COALESCE(bloklangan, FALSE) WHERE id=$1',
      [req.params.id]
    );

    req.flash('success', 'Holat o\'zgartirildi.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  } catch (err) {
    console.error('BLOCK ERROR:', err.message);
    req.flash('error', 'Xatolik: ' + err.message);
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  }
});

// Boshqa o'qituvchiga ko'chirish (ma'lumotlar saqlanadi)
router.post('/kafedra-mudiri/biriktirish/:id/transfer', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) { return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard')); }

    const { yangi_oqituvchi_id } = req.body;
    if (!yangi_oqituvchi_id) {
      req.flash('error', 'Yangi o\'qituvchini tanlang.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    // Faqat o'z kafedra fanini o'zgartira oladi
    const check = await pool.query(`
      SELECT fo.id FROM fan_oqituvchi fo
      JOIN fanlar f ON f.id = fo.fan_id
      WHERE fo.id=$1 AND f.kafedra_id=$2
    `, [req.params.id, kafedra.id]);
    if (!check.rows.length) {
      req.flash('error', 'Ruxsat yo\'q.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    // oqituvchi_id ni yangilash — sillabus va barcha ma'lumotlar saqlanadi
    await pool.query(
      'UPDATE fan_oqituvchi SET oqituvchi_id=$1, bloklangan=FALSE WHERE id=$2',
      [yangi_oqituvchi_id, req.params.id]
    );

    req.flash('success', 'Fan boshqa o\'qituvchiga ko\'chirildi. Barcha ma\'lumotlar saqlanib qoldi.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Ko\'chirishda xatolik.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  }
});

// O'chirish — faqat sillabus ma'lumotlari yo'q bo'lsa
router.post('/kafedra-mudiri/biriktirish/:id/delete', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) { return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard')); }

    // Sillabus bor-yo'qligini tekshirish
    const sRes = await pool.query('SELECT COUNT(*) FROM sillabuslar WHERE fan_oqituvchi_id=$1', [req.params.id]);
    if (Number(sRes.rows[0].count) > 0) {
      req.flash('error', 'Bu biriktirish uchun sillabus ma\'lumotlari mavjud. O\'chirish o\'rniga "Bloklash" yoki "Ko\'chirish" tugmasidan foydalaning.');
      return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
    }

    await pool.query(`
      DELETE FROM fan_oqituvchi fo
      USING fanlar f
      WHERE fo.id=$1 AND fo.fan_id=f.id AND f.kafedra_id=$2
    `, [req.params.id, kafedra.id]);

    req.flash('success', 'Biriktirish o\'chirildi.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'O\'chirishda xatolik.');
    return req.session.save(() => res.redirect('/kafedra-mudiri/biriktirish'));
  }
});

module.exports = router;
