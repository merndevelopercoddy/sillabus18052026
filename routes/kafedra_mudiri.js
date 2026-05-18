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
          fo.mas_ul,
          fo.akademik_yil_id,
          f.f_nomi AS fan_nomi,
          f.fan_kodi,
          u.login AS oqituvchi_login,
          u.full_name AS oqituvchi_nomi,
          ay.nomi AS yil_nomi
        FROM fan_oqituvchi fo
        JOIN fanlar f ON f.id = fo.fan_id
        JOIN users u ON u.id = fo.oqituvchi_id
        LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
        WHERE f.kafedra_id = $1
        ORDER BY ay.nomi DESC, f.f_nomi, u.full_name
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

// Biriktirishni o'chirish
router.post('/kafedra-mudiri/biriktirish/:id/delete', requireAuth, requireRole('kafedra_mudiri', 'superadmin'), async (req, res) => {
  try {
    const kafedra = await getKafedra(req.session.user.id);
    if (!kafedra) { return req.session.save(() => res.redirect('/kafedra-mudiri/dashboard')); }

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
