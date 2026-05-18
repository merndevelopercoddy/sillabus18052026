const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, forceChangePassword } = require('../middleware/auth');

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

module.exports = router;
