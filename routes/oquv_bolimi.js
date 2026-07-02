const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, forceChangePassword } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ============ DASHBOARD ============
router.get('/oquv-bolimi/dashboard', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (_req, res) => {
  try {
    const [fanlarRes, yonalishRes, yilRes, sillabusRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM fanlar'),
      pool.query('SELECT COUNT(*) AS count FROM yonalish'),
      pool.query('SELECT * FROM akademik_yillar WHERE faol=TRUE LIMIT 1'),
      pool.query('SELECT COUNT(*) AS count FROM sillabuslar'),
    ]);
    res.render('oquv_bolimi/dashboard', {
      title: "O'quv bo'limi",
      fanlarCount: fanlarRes.rows[0].count,
      yonalishCount: yonalishRes.rows[0].count,
      faolYil: yilRes.rows[0] || null,
      sillabuslarCount: sillabusRes.rows[0].count,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ SILLABUSLAR - LIST ============
router.get('/oquv-bolimi/sillabuslar', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { yil, holat } = req.query;
    const yilId = yil ? Number(yil) : null;

    const params = [];
    const conditions = [];
    if (yilId) { params.push(yilId); conditions.push(`fo.akademik_yil_id = $${params.length}`); }
    if (holat) { params.push(holat); conditions.push(`s.holat = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [sillabuslar, akademikYillar] = await Promise.all([
      pool.query(`
        SELECT s.id, s.holat, s.created_at,
          f.f_nomi, f.fan_kodi,
          u.full_name AS oqituvchi_nomi,
          ay.nomi AS yil_nomi
        FROM sillabuslar s
        JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
        JOIN fanlar f ON f.id = fo.fan_id
        JOIN users u ON u.id = fo.oqituvchi_id
        LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
        ${where}
        ORDER BY s.created_at DESC
      `, params),
      pool.query('SELECT * FROM akademik_yillar ORDER BY boshlanish_yil DESC'),
    ]);

    res.render('oquv_bolimi/sillabuslar', {
      title: "Sillabuslar",
      sillabuslar: sillabuslar.rows,
      akademikYillar: akademikYillar.rows,
      selectedYilId: yilId,
      selectedHolat: holat || '',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ UMUMIY QISMLAR ============
router.get('/oquv-bolimi/sillabuslar/:id/umumiy', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.*, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi, u.full_name AS oqituvchi_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      LEFT JOIN users u ON u.id = fo.oqituvchi_id
      WHERE s.id = $1
    `, [sId]);
    if (!sRes.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    res.render('oquv_bolimi/sillabus_umumiy', { title: "Umumiy qismlar", sillabus: sRes.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/umumiy', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const {
      bilim_ko_nikma, talabalarni_qabul_kuni,
      tuzuvchi_fish, tuzuvchi_lavozim, tuzuvchi_tel,
      taqrizchi1_fish, taqrizchi1_lavozim, taqrizchi1_tel,
      taqrizchi2_fish, taqrizchi2_lavozim, taqrizchi2_tel,
      holat,
    } = req.body;
    await pool.query(`
      UPDATE sillabuslar SET
        bilim_ko_nikma=$1, talabalarni_qabul_kuni=$2,
        tuzuvchi_fish=$3, tuzuvchi_lavozim=$4, tuzuvchi_tel=$5,
        taqrizchi1_fish=$6, taqrizchi1_lavozim=$7, taqrizchi1_tel=$8,
        taqrizchi2_fish=$9, taqrizchi2_lavozim=$10, taqrizchi2_tel=$11,
        holat=$12, updated_at=NOW()
      WHERE id=$13
    `, [
      bilim_ko_nikma || null, talabalarni_qabul_kuni || null,
      tuzuvchi_fish || null, tuzuvchi_lavozim || null, tuzuvchi_tel || null,
      taqrizchi1_fish || null, taqrizchi1_lavozim || null, taqrizchi1_tel || null,
      taqrizchi2_fish || null, taqrizchi2_lavozim || null, taqrizchi2_tel || null,
      holat || 'tahrir', sId,
    ]);
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/umumiy');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ MA'RUZA VA AMALIY REJA ============

router.get('/oquv-bolimi/sillabuslar/:id/maruza-reja', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1
    `, [sId]);
    if (!sRes.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    const rows = (await pool.query('SELECT * FROM maruza_amaliy_reja WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId])).rows;
    const editRow = req.query.edit
      ? (await pool.query('SELECT * FROM maruza_amaliy_reja WHERE id=$1 AND sillabus_id=$2', [req.query.edit, sId])).rows[0] || null
      : null;
    res.render('sillabus/maruza_reja', {
      title: "Ma'ruza va amaliy reja",
      sillabus: sRes.rows[0],
      rows,
      nextNum: rows.length + 1,
      editRow,
      isOqituvchi: false,
      urlPrefix: '/oquv-bolimi',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/maruza-reja/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const check = await pool.query('SELECT id FROM sillabuslar WHERE id=$1', [sId]);
    if (!check.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    const { tartib_raqam, mavzu, maruza_soat, amaliy_soat } = req.body;
    const dars_mazmuni = req.body.dars_mazmuni
      ? req.body.dars_mazmuni.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    await pool.query(
      'INSERT INTO maruza_amaliy_reja (sillabus_id, tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat) VALUES ($1,$2,$3,$4,$5,$6)',
      [sId, Number(tartib_raqam) || 1, mavzu, dars_mazmuni, Number(maruza_soat) || 0, Number(amaliy_soat) || 0]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/maruza-reja/:rowId/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { tartib_raqam, mavzu, maruza_soat, amaliy_soat } = req.body;
    const dars_mazmuni = req.body.dars_mazmuni
      ? req.body.dars_mazmuni.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    await pool.query(
      'UPDATE maruza_amaliy_reja SET tartib_raqam=$1, mavzu=$2, dars_mazmuni=$3, maruza_soat=$4, amaliy_soat=$5, updated_at=NOW() WHERE id=$6 AND sillabus_id=$7',
      [Number(tartib_raqam) || 1, mavzu, dars_mazmuni, Number(maruza_soat) || 0, Number(amaliy_soat) || 0, req.params.rowId, sId]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/maruza-reja/:rowId/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    await pool.query('DELETE FROM maruza_amaliy_reja WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/maruza-reja');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ MUSTAQIL TA'LIM ============

router.get('/oquv-bolimi/sillabuslar/:id/mustaqil-talim', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1
    `, [sId]);
    if (!sRes.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    const rows = (await pool.query('SELECT * FROM mustaqil_talim WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId])).rows;
    const editRow = req.query.edit
      ? (await pool.query('SELECT * FROM mustaqil_talim WHERE id=$1 AND sillabus_id=$2', [req.query.edit, sId])).rows[0] || null
      : null;
    res.render('sillabus/mustaqil_talim', {
      title: "Mustaqil ta'lim",
      sillabus: sRes.rows[0],
      rows,
      nextNum: rows.length + 1,
      editRow,
      isOqituvchi: false,
      urlPrefix: '/oquv-bolimi',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/mustaqil-talim/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const check = await pool.query('SELECT id FROM sillabuslar WHERE id=$1', [sId]);
    if (!check.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    const { tartib_raqam, mavzu, topshiriq, soat } = req.body;
    await pool.query(
      'INSERT INTO mustaqil_talim (sillabus_id, tartib_raqam, mavzu, topshiriq, soat) VALUES ($1,$2,$3,$4,$5)',
      [sId, Number(tartib_raqam) || 1, mavzu, topshiriq || null, Number(soat) || 0]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/mustaqil-talim/:rowId/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { tartib_raqam, mavzu, topshiriq, soat } = req.body;
    await pool.query(
      'UPDATE mustaqil_talim SET tartib_raqam=$1, mavzu=$2, topshiriq=$3, soat=$4 WHERE id=$5 AND sillabus_id=$6',
      [Number(tartib_raqam) || 1, mavzu, topshiriq || null, Number(soat) || 0, req.params.rowId, sId]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/mustaqil-talim/:rowId/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    await pool.query('DELETE FROM mustaqil_talim WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/mustaqil-talim');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ BAHOLASH ============

router.get('/oquv-bolimi/sillabuslar/:id/baholash', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const sRes = await pool.query(`
      SELECT s.id, f.f_nomi, f.fan_kodi, ay.nomi AS yil_nomi
      FROM sillabuslar s
      JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
      JOIN fanlar f ON f.id = fo.fan_id
      LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
      WHERE s.id = $1
    `, [sId]);
    if (!sRes.rows.length) return res.redirect('/oquv-bolimi/sillabuslar');
    const [mezoniRows, talabalarRows] = await Promise.all([
      pool.query('SELECT * FROM baholash_mezoni WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
      pool.query('SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
    ]);
    const editMezoni = req.query.editMezoni
      ? (await pool.query('SELECT * FROM baholash_mezoni WHERE id=$1 AND sillabus_id=$2', [req.query.editMezoni, sId])).rows[0] || null
      : null;
    const editTalabalar = req.query.editTalabalar
      ? (await pool.query('SELECT * FROM talabalar_baholash WHERE id=$1 AND sillabus_id=$2', [req.query.editTalabalar, sId])).rows[0] || null
      : null;
    res.render('sillabus/baholash', {
      title: "Baholash mezoni",
      sillabus: sRes.rows[0],
      mezoniRows: mezoniRows.rows,
      talabalarRows: talabalarRows.rows,
      editMezoni,
      editTalabalar,
      isOqituvchi: false,
      urlPrefix: '/oquv-bolimi',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/mezoni/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { nomi, foiz, izoh, tartib } = req.body;
    await pool.query(
      'INSERT INTO baholash_mezoni (sillabus_id, nomi, foiz, izoh, tartib) VALUES ($1,$2,$3,$4,$5)',
      [sId, nomi, Number(foiz) || 0, izoh || null, Number(tartib) || 0]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/mezoni/:rowId/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { nomi, foiz, izoh, tartib } = req.body;
    await pool.query(
      'UPDATE baholash_mezoni SET nomi=$1, foiz=$2, izoh=$3, tartib=$4 WHERE id=$5 AND sillabus_id=$6',
      [nomi, Number(foiz) || 0, izoh || null, Number(tartib) || 0, req.params.rowId, sId]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/mezoni/:rowId/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    await pool.query('DELETE FROM baholash_mezoni WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/talabalar/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib } = req.body;
    await pool.query(
      'INSERT INTO talabalar_baholash (sillabus_id, guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [sId, guruh, nazorat_nomi, izoh || null, Number(ball) || 0, otkazilish_vaqti || null, Number(tartib) || 0]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/talabalar/:rowId/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const { guruh, nazorat_nomi, izoh, ball, otkazilish_vaqti, tartib } = req.body;
    await pool.query(
      'UPDATE talabalar_baholash SET guruh=$1, nazorat_nomi=$2, izoh=$3, ball=$4, otkazilish_vaqti=$5, tartib=$6 WHERE id=$7 AND sillabus_id=$8',
      [guruh, nazorat_nomi, izoh || null, Number(ball) || 0, otkazilish_vaqti || null, Number(tartib) || 0, req.params.rowId, sId]
    );
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/sillabuslar/:id/baholash/talabalar/:rowId/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const sId = Number(req.params.id);
    await pool.query('DELETE FROM talabalar_baholash WHERE id=$1 AND sillabus_id=$2', [req.params.rowId, sId]);
    res.redirect('/oquv-bolimi/sillabuslar/' + sId + '/baholash');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ============ YO'NALISHLAR ============
router.get('/oquv-bolimi/yonalish', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM yonalish ORDER BY id DESC');
    res.render('oquv_bolimi/yonalish', { data: rows || [] });
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Sahifani yuklashda xatolik.');
    return req.session.save(() => res.redirect('/oquv-bolimi/dashboard'));
  }
});

router.post('/oquv-bolimi/yonalish/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const shifr = req.body.yonalish_shifri?.trim();
    const nomi = req.body.yonalish_nomi?.trim();
    if (!nomi) { req.flash('error', "Barcha maydonlarni to'ldiring."); return req.session.save(() => res.redirect('/oquv-bolimi/yonalish')); }
    await pool.query('INSERT INTO yonalish (yonalish_shifri, yonalish_nomi) VALUES ($1,$2)', [shifr, nomi]);
    req.flash('success', 'Muvaffaqiyatli saqlandi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') { req.flash('error', "Bu ta'lim yo'nalishi shifri avval kiritilgan."); }
    else { req.flash('error', 'Server xatosi.'); }
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  }
});

router.get('/oquv-bolimi/yonalish/:id', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM yonalish WHERE id=$1', [req.params.id]);
    if (!result.rows.length) { req.flash('error', "Yo'nalish topilmadi."); return req.session.save(() => res.redirect('/oquv-bolimi/yonalish')); }
    res.render('oquv_bolimi/yonalish_edit', { item: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  }
});

router.post('/oquv-bolimi/yonalish/:id/edit', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const shifr = req.body.yonalish_shifri?.trim();
    const nomi = req.body.yonalish_nomi?.trim();
    if (!nomi) { req.flash('error', "Barcha maydonlarni to'ldiring."); return req.session.save(() => res.redirect(`/oquv-bolimi/yonalish/${id}`)); }
    const check = await pool.query('SELECT id FROM yonalish WHERE id=$1', [id]);
    if (!check.rows.length) { req.flash('error', "Yo'nalish topilmadi."); return req.session.save(() => res.redirect('/oquv-bolimi/yonalish')); }
    await pool.query('UPDATE yonalish SET yonalish_shifri=$1, yonalish_nomi=$2, updated_at=NOW() WHERE id=$3', [shifr, nomi, id]);
    req.flash('success', "Ta'lim yo'nalishi muvaffaqiyatli yangilandi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  } catch (err) {
    console.error(err.message);
    const { id } = req.params;
    if (err.code === '23505') { req.flash('error', 'Bu shifr allaqachon mavjud.'); return req.session.save(() => res.redirect(`/oquv-bolimi/yonalish/${id}`)); }
    req.flash('error', 'Yangilashda xatolik.');
    return req.session.save(() => res.redirect(`/oquv-bolimi/yonalish/${id}`));
  }
});

router.post('/oquv-bolimi/yonalish/:id/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM yonalish WHERE id=$1', [req.params.id]);
    if (!check.rows.length) { req.flash('error', "Yo'nalish topilmadi."); return req.session.save(() => res.redirect('/oquv-bolimi/yonalish')); }
    await pool.query('DELETE FROM yonalish WHERE id=$1', [req.params.id]);
    req.flash('success', "Ta'lim yo'nalishi muvaffaqiyatli o'chirildi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  } catch (err) {
    console.error(err.message);
    if (err.code === '23503') { req.flash('error', "Bu yo'nalish bog'langan, o'chirib bo'lmaydi."); }
    else { req.flash('error', "O'chirishda xatolik."); }
    return req.session.save(() => res.redirect('/oquv-bolimi/yonalish'));
  }
});

// ============ FANLAR ============
router.get('/oquv-bolimi/fanlar', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const [fanlarRes, yonalishRes, kafedraRes] = await Promise.all([
      pool.query('SELECT f.*, k.nomi AS kafedra_nomi FROM fanlar f LEFT JOIN kafedralar k ON k.id = f.kafedra_id ORDER BY f.f_nomi ASC'),
      pool.query('SELECT id, yonalish_shifri, yonalish_nomi FROM yonalish ORDER BY yonalish_nomi ASC'),
      pool.query('SELECT id, nomi FROM kafedralar ORDER BY nomi'),
    ]);
    res.render('oquv_bolimi/fanlar', { data: fanlarRes.rows || [], yonalishlar: yonalishRes.rows || [], kafedralar: kafedraRes.rows || [] });
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Sahifani yuklashda xatolik.');
    return req.session.save(() => res.redirect('/oquv-bolimi/dashboard'));
  }
});

router.post('/oquv-bolimi/fanlar/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    let { f_nomi, fan_kodi, grade, davomiyligi, semestr, t_shakli, ects, auditoriya_soat, mustaqil_soat, t_yunalish, kafedra_id } = req.body;
    f_nomi = f_nomi?.trim(); fan_kodi = fan_kodi?.trim(); grade = grade?.trim(); t_shakli = t_shakli?.trim(); kafedra_id = kafedra_id || null;
    if (!f_nomi || !fan_kodi || !grade || !davomiyligi || !t_shakli || !ects) { req.flash('error', "Barcha majburiy maydonlarni to'ldiring."); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    if (!semestr) { req.flash('error', 'Kamida bitta semestr tanlang.'); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    if (!t_yunalish) { req.flash('error', "Kamida bitta ta'lim yo'nalishini tanlang."); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    if (!Array.isArray(semestr)) semestr = [semestr];
    if (!Array.isArray(t_yunalish)) t_yunalish = [t_yunalish];
    await pool.query(
      'INSERT INTO fanlar (f_nomi, fan_kodi, grade, davomiyligi, semestr, t_shakli, ects, auditoriya_soat, mustaqil_soat, t_yunalish, kafedra_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [f_nomi, fan_kodi, grade, Number(davomiyligi), semestr, t_shakli, Number(ects), Number(auditoriya_soat||0), Number(mustaqil_soat||0), t_yunalish, kafedra_id]
    );
    req.flash('success', "Fan muvaffaqiyatli qo'shildi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') { req.flash('error', 'Bu fan kodi avval kiritilgan.'); } else { req.flash('error', "Fan qo'shishda xatolik."); }
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  }
});

router.get('/oquv-bolimi/fanlar/:id', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const [fanResult, yonalishResult, kafedraResult] = await Promise.all([
      pool.query('SELECT * FROM fanlar WHERE id=$1', [req.params.id]),
      pool.query('SELECT id, yonalish_shifri, yonalish_nomi FROM yonalish ORDER BY yonalish_nomi ASC'),
      pool.query('SELECT id, nomi FROM kafedralar ORDER BY nomi'),
    ]);
    if (!fanResult.rows.length) { req.flash('error', 'Fan topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    res.render('oquv_bolimi/fan_edit', { fan: fanResult.rows[0], yonalishlar: yonalishResult.rows || [], kafedralar: kafedraResult.rows || [] });
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  }
});

router.post('/oquv-bolimi/fanlar/:id/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    let { f_nomi, fan_kodi, grade, davomiyligi, semestr, t_shakli, ects, auditoriya_soat, mustaqil_soat, t_yunalish } = req.body;
    f_nomi = f_nomi?.trim(); fan_kodi = fan_kodi?.trim(); grade = grade?.trim(); t_shakli = t_shakli?.trim();
    if (!semestr) { req.flash('error', 'Kamida bitta semestr tanlang.'); return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${id}`)); }
    if (!t_yunalish) { req.flash('error', "Kamida bitta ta'lim yo'nalishini tanlang."); return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${id}`)); }
    if (!Array.isArray(semestr)) semestr = [semestr];
    if (!Array.isArray(t_yunalish)) t_yunalish = [t_yunalish];
    const kafedra_id = req.body.kafedra_id || null;
    await pool.query(
      'UPDATE fanlar SET f_nomi=$1, fan_kodi=$2, grade=$3, davomiyligi=$4, semestr=$5, t_shakli=$6, ects=$7, auditoriya_soat=$8, mustaqil_soat=$9, t_yunalish=$10, kafedra_id=$11, updated_at=CURRENT_TIMESTAMP WHERE id=$12',
      [f_nomi, fan_kodi, grade, Number(davomiyligi), semestr, t_shakli, Number(ects), Number(auditoriya_soat||0), Number(mustaqil_soat||0), t_yunalish, kafedra_id, id]
    );
    req.flash('success', 'Fan muvaffaqiyatli yangilandi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Fan yangilashda xatolik.');
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${req.params.id}`));
  }
});

router.post('/oquv-bolimi/fanlar/:id/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM fanlar WHERE id=$1', [req.params.id]);
    if (!check.rows.length) { req.flash('error', "Fan topilmadi."); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    await pool.query('DELETE FROM fanlar WHERE id=$1', [req.params.id]);
    req.flash('success', "Fan muvaffaqiyatli o'chirildi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  } catch (err) {
    console.error(err.message);
    if (err.code === '23503') { req.flash('error', "Bu fan bog'langan ma'lumotlari bor, o'chirib bo'lmaydi."); } else { req.flash('error', "O'chirishda xatolik."); }
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  }
});

router.get('/oquv-bolimi/fanlar/:fan_id/dars-reja', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { fan_id } = req.params;
    const fanResult = await pool.query('SELECT * FROM fanlar WHERE id=$1', [fan_id]);
    if (!fanResult.rows.length) { req.flash('error', 'Fan topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    const { rows } = await pool.query('SELECT * FROM dars_reja WHERE fan_id=$1 ORDER BY tartib_raqam ASC', [fan_id]);
    res.render('oquv_bolimi/dars_reja', { fan: fanResult.rows[0], data: rows || [] });
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/fanlar'));
  }
});

router.post('/oquv-bolimi/fanlar/:fan_id/dars-reja/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { fan_id } = req.params;
    let { tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat } = req.body;
    mavzu = mavzu?.trim();
    if (!mavzu || !tartib_raqam) { req.flash('error', 'Mavzu va tartib raqamini kiriting.'); return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja`)); }
    let mazmunArray = dars_mazmuni ? (Array.isArray(dars_mazmuni) ? dars_mazmuni : [dars_mazmuni]).map(s => s.trim()).filter(Boolean) : [];
    await pool.query('INSERT INTO dars_reja (fan_id, tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat) VALUES ($1,$2,$3,$4,$5,$6)', [fan_id, Number(tartib_raqam), mavzu, mazmunArray, Number(maruza_soat||2), Number(amaliy_soat||2)]);
    req.flash('success', "Dars rejasi muvaffaqiyatli qo'shildi.");
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja`));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${req.params.fan_id}/dars-reja`));
  }
});

router.get('/oquv-bolimi/fanlar/:fan_id/dars-reja/:id/edit', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { fan_id, id } = req.params;
    const fanResult = await pool.query('SELECT * FROM fanlar WHERE id=$1', [fan_id]);
    if (!fanResult.rows.length) { req.flash('error', 'Fan topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/fanlar')); }
    const result = await pool.query('SELECT * FROM dars_reja WHERE id=$1 AND fan_id=$2', [id, fan_id]);
    if (!result.rows.length) { req.flash('error', 'Dars rejasi topilmadi.'); return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja`)); }
    res.render('oquv_bolimi/dars_reja_edit', { fan: fanResult.rows[0], item: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${req.params.fan_id}/dars-reja`));
  }
});

router.post('/oquv-bolimi/fanlar/:fan_id/dars-reja/:id/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { fan_id, id } = req.params;
    let { tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat } = req.body;
    mavzu = mavzu?.trim();
    if (!mavzu || !tartib_raqam) { req.flash('error', 'Mavzu va tartib raqamini kiriting.'); return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja/${id}/edit`)); }
    let mazmunArray = dars_mazmuni ? (Array.isArray(dars_mazmuni) ? dars_mazmuni : [dars_mazmuni]).map(s => s.trim()).filter(Boolean) : [];
    await pool.query('UPDATE dars_reja SET tartib_raqam=$1, mavzu=$2, dars_mazmuni=$3, maruza_soat=$4, amaliy_soat=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6 AND fan_id=$7', [Number(tartib_raqam), mavzu, mazmunArray, Number(maruza_soat||2), Number(amaliy_soat||2), id, fan_id]);
    req.flash('success', 'Dars rejasi muvaffaqiyatli yangilandi.');
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja`));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${req.params.fan_id}/dars-reja/${req.params.id}/edit`));
  }
});

router.post('/oquv-bolimi/fanlar/:fan_id/dars-reja/:id/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { fan_id, id } = req.params;
    await pool.query('DELETE FROM dars_reja WHERE id=$1 AND fan_id=$2', [id, fan_id]);
    req.flash('success', "Dars rejasi muvaffaqiyatli o'chirildi.");
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${fan_id}/dars-reja`));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect(`/oquv-bolimi/fanlar/${req.params.fan_id}/dars-reja`));
  }
});

// ============ ADABIYOTLAR ============
router.get('/oquv-bolimi/adabiyotlar', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    let { search = '', manba_turi = '', fan_id = '', turi = '', page = 1, limit = 10 } = req.query;
    page = Number(page) || 1;
    limit = Number(limit) || 10;
    const offset = (page - 1) * limit;
    const conditions = [], values = [];
    if (search) { values.push(`%${search}%`); conditions.push(`(a.avtor ILIKE $${values.length} OR a.adabiyot_nomi ILIKE $${values.length} OR a.url ILIKE $${values.length})`); }
    if (manba_turi) { values.push(manba_turi); conditions.push(`a.manba_turi = $${values.length}`); }
    if (fan_id) { values.push(fan_id); conditions.push(`EXISTS (SELECT 1 FROM fan_adabiyotlari fa2 WHERE fa2.adabiyot_id = a.id AND fa2.fan_id = $${values.length})`); }
    if (turi) { values.push(turi); conditions.push(`EXISTS (SELECT 1 FROM fan_adabiyotlari fa3 WHERE fa3.adabiyot_id = a.id AND fa3.turi = $${values.length})`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(DISTINCT a.id) AS total FROM adabiyotlar a ${whereClause}`, values);
    const totalItems = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);
    const adabiyotlarResult = await pool.query(`
      SELECT a.id, a.manba_turi, a.avtor, a.adabiyot_nomi, a.yili, a.sahifa_soni, a.url, a.created_at, a.updated_at,
        COALESCE(json_agg(json_build_object('fan_id',f.id,'fan_kodi',f.fan_kodi,'fan_nomi',f.f_nomi,'turi',fa.turi)) FILTER (WHERE f.id IS NOT NULL),'[]') AS biriktirilgan_fanlar
      FROM adabiyotlar a
      LEFT JOIN fan_adabiyotlari fa ON fa.adabiyot_id = a.id
      LEFT JOIN fanlar f ON f.id = fa.fan_id
      ${whereClause}
      GROUP BY a.id ORDER BY a.id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, limit, offset]);
    const fanlarResult = await pool.query('SELECT id, f_nomi, fan_kodi FROM fanlar ORDER BY f_nomi ASC');
    res.render('oquv_bolimi/adabiyotlar', {
      adabiyotlar: adabiyotlarResult.rows || [],
      fanlar: fanlarResult.rows || [],
      search, manba_turi, fan_id, turi,
      currentPage: page, limit, totalPages, totalItems,
    });
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Adabiyotlar sahifasini yuklashda xatolik yuz berdi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/dashboard'));
  }
});

router.post('/oquv-bolimi/adabiyotlar/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    let { manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url } = req.body;
    manba_turi = manba_turi?.trim();
    avtor = avtor?.trim() || null;
    adabiyot_nomi = adabiyot_nomi?.trim() || null;
    url = url?.trim() || null;
    yili = yili ? Number(yili) : null;
    sahifa_soni = sahifa_soni ? Number(sahifa_soni) : null;
    if (!manba_turi) { req.flash('error', 'Manba turini tanlang.'); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    if (manba_turi === 'internet' && !url) { req.flash('error', 'Internet manzilini kiriting.'); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    if (manba_turi === 'kitob' && (!avtor || !adabiyot_nomi)) { req.flash('error', "Kitob uchun avtor va adabiyot nomini kiriting."); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    await pool.query('INSERT INTO adabiyotlar (manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url) VALUES ($1,$2,$3,$4,$5,$6)', [manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url]);
    req.flash('success', "Adabiyot muvaffaqiyatli qo'shildi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', "Adabiyot qo'shishda xatolik.");
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  }
});

router.post('/oquv-bolimi/adabiyotlar/:adabiyot_id/biriktirish', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { adabiyot_id } = req.params;
    const { fan_id, turi } = req.body;
    if (!fan_id || !turi) { req.flash('error', "Fan va ro'yxat turini tanlang."); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    const chkA = await pool.query('SELECT id FROM adabiyotlar WHERE id=$1', [adabiyot_id]);
    if (!chkA.rows.length) { req.flash('error', 'Adabiyot topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    const chkF = await pool.query('SELECT id FROM fanlar WHERE id=$1', [fan_id]);
    if (!chkF.rows.length) { req.flash('error', 'Fan topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    await pool.query(`INSERT INTO fan_adabiyotlari (fan_id, adabiyot_id, turi) VALUES ($1,$2,$3) ON CONFLICT (fan_id, adabiyot_id) DO UPDATE SET turi=EXCLUDED.turi, updated_at=CURRENT_TIMESTAMP`, [fan_id, adabiyot_id, turi]);
    req.flash('success', 'Adabiyot fanga muvaffaqiyatli biriktirildi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Biriktirish xatolik.');
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  }
});

router.get('/oquv-bolimi/adabiyotlar/:id/edit', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM adabiyotlar WHERE id=$1', [req.params.id]);
    if (!result.rows.length) { req.flash('error', 'Adabiyot topilmadi.'); return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar')); }
    res.render('oquv_bolimi/adabiyot_edit', { adabiyot: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  }
});

router.post('/oquv-bolimi/adabiyotlar/:id/update', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    let { manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url } = req.body;
    manba_turi = manba_turi?.trim();
    avtor = avtor?.trim() || null;
    adabiyot_nomi = adabiyot_nomi?.trim() || null;
    url = url?.trim() || null;
    yili = yili ? Number(yili) : null;
    sahifa_soni = sahifa_soni ? Number(sahifa_soni) : null;
    if (!manba_turi) { req.flash('error', 'Manba turini tanlang.'); return req.session.save(() => res.redirect(`/oquv-bolimi/adabiyotlar/${id}/edit`)); }
    if (manba_turi === 'internet' && !url) { req.flash('error', 'Internet manzilini kiriting.'); return req.session.save(() => res.redirect(`/oquv-bolimi/adabiyotlar/${id}/edit`)); }
    if (manba_turi === 'kitob' && (!avtor || !adabiyot_nomi)) { req.flash('error', "Kitob uchun avtor va adabiyot nomini kiriting."); return req.session.save(() => res.redirect(`/oquv-bolimi/adabiyotlar/${id}/edit`)); }
    await pool.query('UPDATE adabiyotlar SET manba_turi=$1, avtor=$2, adabiyot_nomi=$3, yili=$4, sahifa_soni=$5, url=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7', [manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url, id]);
    req.flash('success', 'Adabiyot muvaffaqiyatli yangilandi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect(`/oquv-bolimi/adabiyotlar/${req.params.id}/edit`));
  }
});

router.post('/oquv-bolimi/adabiyotlar/:id/delete', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM adabiyotlar WHERE id=$1', [req.params.id]);
    req.flash('success', "Adabiyot muvaffaqiyatli o'chirildi.");
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  }
});

router.post('/oquv-bolimi/adabiyotlar/:adabiyot_id/fan/:fan_id/remove', requireAuth, requireRole('oquv_bolimi', 'superadmin'), async (req, res) => {
  try {
    const { adabiyot_id, fan_id } = req.params;
    await pool.query('DELETE FROM fan_adabiyotlari WHERE adabiyot_id=$1 AND fan_id=$2', [adabiyot_id, fan_id]);
    req.flash('success', 'Adabiyot fandan ajratildi.');
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  } catch (err) {
    console.error(err.message);
    return req.session.save(() => res.redirect('/oquv-bolimi/adabiyotlar'));
  }
});

// ============ TASHKILOT ============
router.get('/oquv-bolimi/tashkilot', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tashkilot');
    res.render('oquv_bolimi/tashkilot', { title: "Tashkilot", data: rows[0] || null });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/tashkilot/add', requireAuth, requireRole('oquv_bolimi', 'superadmin'), upload.single('logo'), async (req, res) => {
  try {
    const { tashkilot_nomi, masul, short_name } = req.body;
    const logo = req.file ? req.file.filename : null;
    await pool.query(
      'INSERT INTO tashkilot (tashkilot_nomi, logo, masul, short_name) VALUES ($1,$2,$3,$4)',
      [tashkilot_nomi, logo, masul, short_name]
    );
    res.redirect('/oquv-bolimi/tashkilot');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.get('/oquv-bolimi/tashkilot/:id', requireAuth, requireRole('oquv_bolimi', 'superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tashkilot WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.redirect('/oquv-bolimi/tashkilot');
    res.render('oquv_bolimi/tashkilot_edit', { title: "Tashkilot tahrirlash", data: rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/oquv-bolimi/tashkilot/:id', requireAuth, requireRole('oquv_bolimi', 'superadmin'), upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tashkilot_nomi, masul, short_name } = req.body;
    let newLogo = req.file ? req.file.filename : null;
    if (newLogo) {
      const old = await pool.query('SELECT logo FROM tashkilot WHERE id=$1', [id]);
      if (old.rows[0]?.logo) {
        const oldFile = path.join(__dirname, '../public/uploads', old.rows[0].logo);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
    }
    await pool.query(
      'UPDATE tashkilot SET tashkilot_nomi=$1, logo=COALESCE($2,logo), masul=$3, short_name=$4, updated_at=NOW() WHERE id=$5',
      [tashkilot_nomi, newLogo, masul, short_name, id]
    );
    res.redirect('/oquv-bolimi/tashkilot');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

module.exports = router;
