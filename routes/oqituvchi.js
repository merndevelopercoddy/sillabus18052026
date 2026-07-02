const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, forceChangePassword } = require('../middleware/auth');

// ============ DASHBOARD ============
router.get('/oqituvchi/dashboard', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const faolYil = (await pool.query('SELECT * FROM akademik_yillar WHERE faol=TRUE LIMIT 1')).rows[0] || null;
    const [kafedraRes, fanlarRes] = await Promise.all([
      pool.query('SELECT k.nomi FROM kafedralar k JOIN users u ON u.kafedra_id = k.id WHERE u.id=$1', [userId]),
      pool.query(
        'SELECT COUNT(*) AS count FROM fan_oqituvchi WHERE oqituvchi_id=$1 AND ($2::BIGINT IS NULL OR akademik_yil_id=$2)',
        [userId, faolYil?.id || null]
      ),
    ]);
    res.render('oqituvchi/dashboard', {
      title: "O'qituvchi",
      kafedra: kafedraRes.rows[0] || null,
      fanlarCount: fanlarRes.rows[0].count,
      faolYil,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ MENING FANLARIM ============
router.get('/oqituvchi/fanlar', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const faolYil = (await pool.query('SELECT * FROM akademik_yillar WHERE faol=TRUE LIMIT 1')).rows[0] || null;
    const { yil } = req.query;
    const yilId = yil ? Number(yil) : (faolYil?.id || null);

    const [fanlarRes, akademikYillar] = await Promise.all([
      pool.query(`
        SELECT
          fo.id AS fo_id,
          f.id, f.f_nomi, f.fan_kodi, f.grade, f.ects,
          f.semestr, f.t_shakli, f.auditoriya_soat, f.mustaqil_soat,
          k.nomi AS kafedra_nomi,
          fo.mas_ul,
          ay.nomi AS yil_nomi
        FROM fan_oqituvchi fo
        JOIN fanlar f ON f.id = fo.fan_id
        LEFT JOIN kafedralar k ON k.id = f.kafedra_id
        LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
        WHERE fo.oqituvchi_id = $1
          AND ($2::BIGINT IS NULL OR fo.akademik_yil_id = $2)
          AND fo.bloklangan = FALSE
        ORDER BY f.f_nomi ASC
      `, [userId, yilId]),
      pool.query('SELECT * FROM akademik_yillar ORDER BY boshlanish_yil DESC'),
    ]);

    // Sillabus ID larini alohida olamiz (jadval mavjud bo'lmasa xato bermaydi)
    let sillabusMap = {};
    try {
      const foIds = fanlarRes.rows.map(r => r.fo_id);
      if (foIds.length) {
        const sRes = await pool.query(
          'SELECT fan_oqituvchi_id, id FROM sillabuslar WHERE fan_oqituvchi_id = ANY($1::int[])',
          [foIds]
        );
        sRes.rows.forEach(r => { sillabusMap[r.fan_oqituvchi_id] = r.id; });
      }
    } catch (_e) { /* sillabuslar jadvali hali yaratilmagan */ }

    const fanlar = fanlarRes.rows.map(r => ({ ...r, sillabus_id: sillabusMap[r.fo_id] || null }));

    res.render('oqituvchi/fanlar', {
      fanlar,
      akademikYillar: akademikYillar.rows,
      faolYil,
      selectedYilId: yilId,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ SILLABUSLAR - LIST ============
router.get('/oqituvchi/sillabuslar', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const fanlarRes = await pool.query(`
      SELECT fo.id AS fo_id, f.f_nomi, f.fan_kodi,
        ay.nomi AS yil_nomi, fo.mas_ul
      FROM fan_oqituvchi fo
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE fo.oqituvchi_id = $1 AND fo.bloklangan = FALSE
      ORDER BY f.f_nomi ASC
    `, [userId]);

    let sillabusMap = {};
    try {
      const foIds = fanlarRes.rows.map(r => r.fo_id);
      if (foIds.length) {
        const sRes = await pool.query(
          'SELECT fan_oqituvchi_id, id, holat FROM sillabuslar WHERE fan_oqituvchi_id = ANY($1::int[])',
          [foIds]
        );
        sRes.rows.forEach(r => { sillabusMap[r.fan_oqituvchi_id] = { id: r.id, holat: r.holat }; });
      }
    } catch (_e) { /* sillabuslar jadvali hali yaratilmagan */ }

    const fanlar = fanlarRes.rows.map(r => ({
      ...r,
      sillabus_id: sillabusMap[r.fo_id]?.id || null,
      holat: sillabusMap[r.fo_id]?.holat || null,
    }));

    res.render('oqituvchi/sillabuslar', { title: "Sillabuslarim", fanlar });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ SILLABUSLAR - CREATE ============
router.post('/oqituvchi/sillabuslar/create', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { fan_oqituvchi_id } = req.body;
    const foRes = await pool.query('SELECT id FROM fan_oqituvchi WHERE id=$1 AND oqituvchi_id=$2', [fan_oqituvchi_id, userId]);
    if (!foRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const existing = await pool.query('SELECT id FROM sillabuslar WHERE fan_oqituvchi_id=$1', [fan_oqituvchi_id]);
    let sId;
    if (existing.rows.length) {
      sId = existing.rows[0].id;
    } else {
      const r = await pool.query('INSERT INTO sillabuslar (fan_oqituvchi_id) VALUES ($1) RETURNING id', [fan_oqituvchi_id]);
      sId = r.rows[0].id;
    }
    res.redirect('/oqituvchi/sillabuslar/' + sId);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ SILLABUSLAR - DETAIL ============
router.get('/oqituvchi/sillabuslar/:id', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);

    const sRes = await pool.query(`
      SELECT s.*, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi, u.full_name AS oqituvchi_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      LEFT JOIN users u ON u.id = fo.oqituvchi_id
      WHERE s.id = $1 AND fo.oqituvchi_id = $2
    `, [sId, userId]);

    if (!sRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const [mr, mt, bm, tb] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM maruza_amaliy_reja WHERE sillabus_id=$1', [sId]),
      pool.query('SELECT COUNT(*) FROM mustaqil_talim WHERE sillabus_id=$1', [sId]),
      pool.query('SELECT COUNT(*) FROM baholash_mezoni WHERE sillabus_id=$1', [sId]),
      pool.query('SELECT COUNT(*) FROM talabalar_baholash WHERE sillabus_id=$1', [sId]),
    ]);

    res.render('oqituvchi/sillabus_detail', {
      title: "Sillabus",
      sillabus: sRes.rows[0],
      maruzaCount: mr.rows[0].count,
      mustaqilCount: mt.rows[0].count,
      baholashMezoniCount: bm.rows[0].count,
      talabalarCount: tb.rows[0].count,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ MA'RUZA VA AMALIY REJA ============

router.get('/oqituvchi/sillabuslar/:id/maruza-reja', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi,
             f.auditoriya_soat
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1 AND fo.oqituvchi_id = $2
    `, [sId, userId]);
    if (!sRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const rows = (await pool.query('SELECT * FROM maruza_amaliy_reja WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId])).rows;
    const editRow = req.query.edit
      ? (await pool.query('SELECT * FROM maruza_amaliy_reja WHERE id=$1 AND sillabus_id=$2', [req.query.edit, sId])).rows[0] || null
      : null;

    const sillabus = sRes.rows[0];
    const ishlatilgan = rows.reduce((s, r) => s + Number(r.maruza_soat || 0) + Number(r.amaliy_soat || 0), 0);
    const limit = Number(sillabus.auditoriya_soat) || 0;
    const qolgan = limit - ishlatilgan;

    res.render('sillabus/maruza_reja', {
      title: "Ma'ruza va amaliy reja",
      sillabus,
      rows,
      nextNum: rows.length + 1,
      editRow,
      isOqituvchi: true,
      urlPrefix: '/oqituvchi',
      soatLimit: limit,
      ishlatilganSoat: ishlatilgan,
      qolganSoat: qolgan,
      soatOshdi: ishlatilgan > limit && limit > 0,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/maruza-reja/add', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const { tartib_raqam, mavzu, maruza_soat, amaliy_soat } = req.body;
    const yangiMaruza = Number(maruza_soat) || 0;
    const yangiAmaliy = Number(amaliy_soat) || 0;

    const limitRes = await pool.query(`
      SELECT f.auditoriya_soat,
             COALESCE((SELECT SUM(maruza_soat + amaliy_soat) FROM maruza_amaliy_reja WHERE sillabus_id=$1), 0) AS ishlatilgan
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      WHERE s.id = $1
    `, [sId]);
    const { auditoriya_soat, ishlatilgan } = limitRes.rows[0];
    if (auditoriya_soat > 0 && (Number(ishlatilgan) + yangiMaruza + yangiAmaliy) > Number(auditoriya_soat)) {
      req.flash('error', `Soat limiti oshib ketdi! Belgilangan: ${auditoriya_soat} soat, ishlatilgan: ${ishlatilgan} soat, qolgan: ${Number(auditoriya_soat) - Number(ishlatilgan)} soat.`);
      return res.redirect('/oqituvchi/sillabuslar/' + sId + '/maruza-reja');
    }

    const dars_mazmuni = req.body.dars_mazmuni
      ? req.body.dars_mazmuni.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    await pool.query(
      'INSERT INTO maruza_amaliy_reja (sillabus_id, tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat) VALUES ($1,$2,$3,$4,$5,$6)',
      [sId, Number(tartib_raqam) || 1, mavzu, dars_mazmuni, yangiMaruza, yangiAmaliy]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/maruza-reja/:rowId/update', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { tartib_raqam, mavzu, maruza_soat, amaliy_soat } = req.body;
    const yangiMaruza = Number(maruza_soat) || 0;
    const yangiAmaliy = Number(amaliy_soat) || 0;

    const limitRes = await pool.query(`
      SELECT f.auditoriya_soat,
             COALESCE((SELECT SUM(maruza_soat + amaliy_soat) FROM maruza_amaliy_reja WHERE sillabus_id=$1 AND id!=$2), 0) AS ishlatilgan
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      WHERE s.id = $1
    `, [sId, req.params.rowId]);
    const { auditoriya_soat, ishlatilgan } = limitRes.rows[0];
    if (auditoriya_soat > 0 && (Number(ishlatilgan) + yangiMaruza + yangiAmaliy) > Number(auditoriya_soat)) {
      req.flash('error', `Soat limiti oshib ketdi! Belgilangan: ${auditoriya_soat} soat, ishlatilgan: ${ishlatilgan} soat, qolgan: ${Number(auditoriya_soat) - Number(ishlatilgan)} soat.`);
      return res.redirect('/oqituvchi/sillabuslar/' + sId + '/maruza-reja?edit=' + req.params.rowId);
    }

    const dars_mazmuni = req.body.dars_mazmuni
      ? req.body.dars_mazmuni.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    await pool.query(
      'UPDATE maruza_amaliy_reja SET tartib_raqam=$1, mavzu=$2, dars_mazmuni=$3, maruza_soat=$4, amaliy_soat=$5, updated_at=NOW() WHERE id=$6 AND sillabus_id=$7',
      [Number(tartib_raqam) || 1, mavzu, dars_mazmuni, yangiMaruza, yangiAmaliy, req.params.rowId, sId]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/maruza-reja/:rowId/delete', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    await pool.query('DELETE FROM maruza_amaliy_reja WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ MUSTAQIL TA'LIM ============

router.get('/oqituvchi/sillabuslar/:id/mustaqil-talim', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi,
             f.mustaqil_soat
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1 AND fo.oqituvchi_id = $2
    `, [sId, userId]);
    if (!sRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const rows = (await pool.query('SELECT * FROM mustaqil_talim WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId])).rows;
    const editRow = req.query.edit
      ? (await pool.query('SELECT * FROM mustaqil_talim WHERE id=$1 AND sillabus_id=$2', [req.query.edit, sId])).rows[0] || null
      : null;

    const sillabus = sRes.rows[0];
    const ishlatilgan = rows.reduce((s, r) => s + Number(r.soat || 0), 0);
    const limit = Number(sillabus.mustaqil_soat) || 0;
    const qolgan = limit - ishlatilgan;

    res.render('sillabus/mustaqil_talim', {
      title: "Mustaqil ta'lim",
      sillabus,
      rows,
      nextNum: rows.length + 1,
      editRow,
      isOqituvchi: true,
      urlPrefix: '/oqituvchi',
      soatLimit: limit,
      ishlatilganSoat: ishlatilgan,
      qolganSoat: qolgan,
      soatOshdi: ishlatilgan > limit && limit > 0,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/mustaqil-talim/add', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const { tartib_raqam, mavzu, topshiriq, soat } = req.body;
    const yangiSoat = Number(soat) || 0;

    const limitRes = await pool.query(`
      SELECT f.mustaqil_soat,
             COALESCE((SELECT SUM(soat) FROM mustaqil_talim WHERE sillabus_id=$1), 0) AS ishlatilgan
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      WHERE s.id = $1
    `, [sId]);
    const { mustaqil_soat, ishlatilgan } = limitRes.rows[0];
    if (mustaqil_soat > 0 && (Number(ishlatilgan) + yangiSoat) > Number(mustaqil_soat)) {
      req.flash('error', `Soat limiti oshib ketdi! Belgilangan: ${mustaqil_soat} soat, ishlatilgan: ${ishlatilgan} soat, qolgan: ${Number(mustaqil_soat) - Number(ishlatilgan)} soat.`);
      return res.redirect('/oqituvchi/sillabuslar/' + sId + '/mustaqil-talim');
    }

    await pool.query(
      'INSERT INTO mustaqil_talim (sillabus_id, tartib_raqam, mavzu, topshiriq, soat) VALUES ($1,$2,$3,$4,$5)',
      [sId, Number(tartib_raqam) || 1, mavzu, topshiriq || null, yangiSoat]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/mustaqil-talim/:rowId/update', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { tartib_raqam, mavzu, topshiriq, soat } = req.body;
    const yangiSoat = Number(soat) || 0;

    const limitRes = await pool.query(`
      SELECT f.mustaqil_soat,
             COALESCE((SELECT SUM(soat) FROM mustaqil_talim WHERE sillabus_id=$1 AND id!=$2), 0) AS ishlatilgan
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      WHERE s.id = $1
    `, [sId, req.params.rowId]);
    const { mustaqil_soat, ishlatilgan } = limitRes.rows[0];
    if (mustaqil_soat > 0 && (Number(ishlatilgan) + yangiSoat) > Number(mustaqil_soat)) {
      req.flash('error', `Soat limiti oshib ketdi! Belgilangan: ${mustaqil_soat} soat, ishlatilgan: ${ishlatilgan} soat, qolgan: ${Number(mustaqil_soat) - Number(ishlatilgan)} soat.`);
      return res.redirect('/oqituvchi/sillabuslar/' + sId + '/mustaqil-talim?edit=' + req.params.rowId);
    }

    await pool.query(
      'UPDATE mustaqil_talim SET tartib_raqam=$1, mavzu=$2, topshiriq=$3, soat=$4 WHERE id=$5 AND sillabus_id=$6',
      [Number(tartib_raqam) || 1, mavzu, topshiriq || null, yangiSoat, req.params.rowId, sId]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/mustaqil-talim/:rowId/delete', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    await pool.query('DELETE FROM mustaqil_talim WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ BAHOLASH ============

router.get('/oqituvchi/sillabuslar/:id/baholash', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1 AND fo.oqituvchi_id = $2
    `, [sId, userId]);
    if (!sRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const [mezoniRes, jbRes, oiRes, yiRes] = await Promise.all([
      pool.query('SELECT * FROM baholash_mezoni WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
      pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='JB' ORDER BY tartib ASC", [sId]),
      pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='OI' ORDER BY tartib ASC", [sId]),
      pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='YI' ORDER BY tartib ASC", [sId]),
    ]);

    const jbRows = jbRes.rows;
    const oiRows = oiRes.rows;
    const yiRows = yiRes.rows;
    const allRows = [...jbRows, ...oiRows, ...yiRows];

    const editMezoni = req.query.editMezoni
      ? (await pool.query('SELECT * FROM baholash_mezoni WHERE id=$1 AND sillabus_id=$2', [req.query.editMezoni, sId])).rows[0] || null
      : null;
    const editTalabalar = req.query.editTalabalar
      ? (await pool.query('SELECT * FROM talabalar_baholash WHERE id=$1 AND sillabus_id=$2', [req.query.editTalabalar, sId])).rows[0] || null
      : null;

    res.render('sillabus/baholash', {
      title: "Baholash mezoni",
      sillabus: sRes.rows[0],
      mezoniRows: mezoniRes.rows,
      talabalarRows: allRows,
      jbRows,
      oiRows,
      yiRows,
      editMezoni,
      editTalabalar,
      isOqituvchi: true,
      urlPrefix: '/oqituvchi',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/mezoni/add', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { nomi, foiz, izoh, tartib } = req.body;
    await pool.query(
      'INSERT INTO baholash_mezoni (sillabus_id, nomi, foiz, izoh, tartib) VALUES ($1,$2,$3,$4,$5)',
      [sId, nomi, Number(foiz) || 0, izoh || null, Number(tartib) || 0]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/mezoni/:rowId/update', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { nomi, foiz, izoh, tartib } = req.body;
    await pool.query(
      'UPDATE baholash_mezoni SET nomi=$1, foiz=$2, izoh=$3, tartib=$4 WHERE id=$5 AND sillabus_id=$6',
      [nomi, Number(foiz) || 0, izoh || null, Number(tartib) || 0, req.params.rowId, sId]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/mezoni/:rowId/delete', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    await pool.query('DELETE FROM baholash_mezoni WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/talabalar/add', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib } = req.body;
    await pool.query(
      'INSERT INTO talabalar_baholash (sillabus_id, guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [sId, guruh, nazorat_nomi, izoh || null, Number(ball) || 0, otkazilish_vaqti || null, Number(tartib) || 0]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/talabalar/:rowId/update', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    const { guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib } = req.body;
    await pool.query(
      'UPDATE talabalar_baholash SET guruh=$1, nazorat_nomi=$2, izoh=$3, ball=$4, otkazilish_vaqti=$5, tartib=$6 WHERE id=$7 AND sillabus_id=$8',
      [guruh, nazorat_nomi, izoh || null, Number(ball) || 0, otkazilish_vaqti || null, Number(tartib) || 0, req.params.rowId, sId]
    );
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oqituvchi/sillabuslar/:id/baholash/talabalar/:rowId/delete', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);
    const check = await pool.query(
      'SELECT s.id FROM sillabuslar s JOIN fan_oqituvchi fo ON fo.id=s.fan_oqituvchi_id WHERE s.id=$1 AND fo.oqituvchi_id=$2',
      [sId, userId]
    );
    if (!check.rows.length) return res.redirect('/oqituvchi/sillabuslar');
    await pool.query('DELETE FROM talabalar_baholash WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oqituvchi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ── Sillabus preview uchun yordamchi funksiya ─────────────────────────────────
async function getSillabusPreviewData(sId, userId) {
  const sRes = await pool.query(`
    SELECT s.*,
      f.f_nomi, f.fan_kodi, f.grade, f.ects, f.semestr, f.t_shakli,
      f.auditoriya_soat, f.mustaqil_soat,
      ay.nomi AS yil_nomi,
      u.full_name AS oqituvchi_nomi, u.login AS oqituvchi_login,
      k.nomi AS kafedra_nomi
    FROM sillabuslar s
    JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
    JOIN fanlar f ON f.id = fo.fan_id
    LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
    LEFT JOIN users u ON u.id = fo.oqituvchi_id
    LEFT JOIN kafedralar k ON k.id = f.kafedra_id
    WHERE s.id = $1 AND fo.oqituvchi_id = $2
  `, [sId, userId]);
  if (!sRes.rows.length) return null;

  const [maruzaRes, mustaqilRes, mezoniRes, jbRes, oiRes, yiRes] = await Promise.all([
    pool.query('SELECT * FROM maruza_amaliy_reja WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId]),
    pool.query('SELECT * FROM mustaqil_talim WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId]),
    pool.query('SELECT * FROM baholash_mezoni WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='JB' ORDER BY tartib ASC", [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='OI' ORDER BY tartib ASC", [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='YI' ORDER BY tartib ASC", [sId]),
  ]);
  return {
    sillabus: sRes.rows[0],
    maruzaRows: maruzaRes.rows,
    mustaqilRows: mustaqilRes.rows,
    mezoniRows: mezoniRes.rows,
    jbRows: jbRes.rows,
    oiRows: oiRes.rows,
    yiRows: yiRes.rows,
  };
}

// ============ SILLABUS PREVIEW ============
router.get('/oqituvchi/sillabuslar/:id/preview', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const data = await getSillabusPreviewData(Number(req.params.id), req.session.user.id);
    if (!data) return res.redirect('/oqituvchi/sillabuslar');
    res.render('sillabus/preview', { title: "Sillabus ko'rinishi", ...data, urlPrefix: '/oqituvchi' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ SILLABUS WORD YUKLAB OLISH ============
router.get('/oqituvchi/sillabuslar/:id/word', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const data = await getSillabusPreviewData(Number(req.params.id), req.session.user.id);
    if (!data) return res.redirect('/oqituvchi/sillabuslar');
    req.app.render('sillabus/word', { ...data, layout: false }, (err, html) => {
      if (err) { console.error(err); return res.status(500).send('Xatolik'); }
      const fname = `sillabus-${data.sillabus.fan_kodi || req.params.id}.doc`;
      res.setHeader('Content-Type', 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.send(html);
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ TASDIQLASHGA YUBORISH ============
router.post('/oqituvchi/sillabuslar/:id/yuborish', requireAuth, requireRole('oqituvchi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sId = Number(req.params.id);

    const sRes = await pool.query(`
      SELECT s.holat FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      WHERE s.id = $1 AND fo.oqituvchi_id = $2
    `, [sId, userId]);

    if (!sRes.rows.length) return res.redirect('/oqituvchi/sillabuslar');

    const holat = sRes.rows[0].holat;
    if (holat === 'tasdiqlangan') {
      req.flash('error', 'Sillabus allaqachon tasdiqlangan.');
      return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId));
    }
    if (holat === 'yuborilgan') {
      req.flash('error', 'Sillabus allaqachon yuborilgan, tasdiqlash kutilmoqda.');
      return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId));
    }

    // Bo'limlar to'ldirilganmi tekshirish
    const [mr, mt] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM maruza_amaliy_reja WHERE sillabus_id=$1', [sId]),
      pool.query('SELECT COUNT(*) FROM mustaqil_talim WHERE sillabus_id=$1', [sId]),
    ]);
    if (Number(mr.rows[0].count) === 0) {
      req.flash('error', "Ma'ruza va amaliy reja bo'limi to'ldirilmagan.");
      return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId + '/preview'));
    }
    if (Number(mt.rows[0].count) === 0) {
      req.flash('error', "Mustaqil ta'lim bo'limi to'ldirilmagan.");
      return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId + '/preview'));
    }

    await pool.query(
      "UPDATE sillabuslar SET holat='yuborilgan', updated_at=NOW() WHERE id=$1",
      [sId]
    );

    req.flash('success', "Sillabus muvaffaqiyatli tasdiqlashga yuborildi. Kafedra mudiri ko'rib chiqadi.");
    return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Xatolik yuz berdi.');
    return req.session.save(() => res.redirect('/oqituvchi/sillabuslar/' + sId));
  }
});

module.exports = router;
