const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, forceChangePassword } = require('../middleware/auth');

const ROLES = ['superadmin', 'oquv_bolimi', 'kafedra_mudiri', 'oqituvchi'];

// Dashboard
router.get('/superadmin/dashboard', requireAuth, requireRole('superadmin'), forceChangePassword, async (req, res) => {
  try {
    const [usersRes, kafedraRes, yilRes] = await Promise.all([
      pool.query("SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role"),
      pool.query("SELECT COUNT(*) AS count FROM kafedralar"),
      pool.query("SELECT * FROM akademik_yillar WHERE faol = TRUE LIMIT 1"),
    ]);
    res.render('superadmin/dashboard', {
      title: 'Superadmin Dashboard',
      userStats: usersRes.rows,
      kafedraCount: kafedraRes.rows[0].count,
      faolYil: yilRes.rows[0] || null,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// ── FOYDALANUVCHILAR ──────────────────────────────────────────────────────────
router.get('/superadmin/users', requireAuth, requireRole('superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { role = '', search = '' } = req.query;
    const conditions = [];
    const values = [];

    if (role) { values.push(role); conditions.push(`u.role = $${values.length}`); }
    if (search) { values.push(`%${search}%`); conditions.push(`(u.login ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT u.id, u.login, u.full_name, u.email, u.role, u.is_active, u.created_at,
              k.nomi AS kafedra_nomi
       FROM users u
       LEFT JOIN kafedralar k ON k.id = u.kafedra_id
       ${where}
       ORDER BY u.role, u.login`,
      values
    );
    const kafedraRes = await pool.query('SELECT id, nomi FROM kafedralar ORDER BY nomi');
    res.render('superadmin/users', {
      users: rows,
      kafedralar: kafedraRes.rows,
      roles: ROLES,
      filterRole: role,
      search,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// Foydalanuvchi qo'shish
router.post('/superadmin/users/add', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    let { login, password, role, full_name, email, kafedra_id } = req.body;
    login = login?.trim();
    full_name = full_name?.trim() || null;
    email = email?.trim() || null;
    kafedra_id = kafedra_id || null;

    if (!login || !password || !role) {
      req.flash('error', 'Login, parol va rolni kiriting.');
      return req.session.save(() => res.redirect('/superadmin/users'));
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (login, password_hash, role, full_name, email, kafedra_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
      [login, hash, role, full_name, email, kafedra_id]
    );
    req.flash('success', `Foydalanuvchi "${login}" yaratildi.`);
    return req.session.save(() => res.redirect('/superadmin/users'));
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'Bu login allaqachon mavjud.');
    } else {
      req.flash('error', 'Server xatosi yuz berdi.');
    }
    return req.session.save(() => res.redirect('/superadmin/users'));
  }
});

// Foydalanuvchi tahrirlash GET
router.get('/superadmin/users/:id/edit', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!rows.length) { req.flash('error', 'Topilmadi.'); return res.redirect('/superadmin/users'); }
    const kafedraRes = await pool.query('SELECT id, nomi FROM kafedralar ORDER BY nomi');
    res.render('superadmin/user_edit', { user: rows[0], kafedralar: kafedraRes.rows, roles: ROLES });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// Foydalanuvchi yangilash
router.post('/superadmin/users/:id/update', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    let { full_name, email, role, kafedra_id, is_active, new_password } = req.body;
    kafedra_id = kafedra_id || null;
    const active = is_active === 'true';

    await pool.query(
      `UPDATE users SET full_name=$1, email=$2, role=$3, kafedra_id=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6`,
      [full_name?.trim() || null, email?.trim() || null, role, kafedra_id, active, id]
    );

    if (new_password && new_password.length >= 6) {
      const hash = await bcrypt.hash(new_password, 12);
      await pool.query('UPDATE users SET password_hash=$1, must_change_password=FALSE WHERE id=$2', [hash, id]);
    }

    req.flash('success', 'Foydalanuvchi yangilandi.');
    return req.session.save(() => res.redirect('/superadmin/users'));
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Yangilashda xatolik.');
    return req.session.save(() => res.redirect(`/superadmin/users/${req.params.id}/edit`));
  }
});

// Faollik toggle
router.post('/superadmin/users/:id/toggle', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id=$1', [req.params.id]);
    req.flash('success', 'Holat o\'zgartirildi.');
    return req.session.save(() => res.redirect('/superadmin/users'));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

// Foydalanuvchi o'chirish
router.post('/superadmin/users/:id/delete', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
    if (rows[0]?.role === 'superadmin') {
      req.flash('error', 'Superadminni o\'chirib bo\'lmaydi.');
      return req.session.save(() => res.redirect('/superadmin/users'));
    }
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    req.flash('success', 'Foydalanuvchi o\'chirildi.');
    return req.session.save(() => res.redirect('/superadmin/users'));
  } catch (err) {
    req.flash('error', 'O\'chirishda xatolik.');
    return req.session.save(() => res.redirect('/superadmin/users'));
  }
});

// ── KAFEDRALAR ────────────────────────────────────────────────────────────────
router.get('/superadmin/kafedralar', requireAuth, requireRole('superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT k.*, u.full_name AS mudiri_nomi, u.login AS mudiri_login,
             COUNT(DISTINCT uu.id) AS xodimlar_soni
      FROM kafedralar k
      LEFT JOIN users u ON u.id = k.mudiri_id
      LEFT JOIN users uu ON uu.kafedra_id = k.id
      GROUP BY k.id, u.full_name, u.login
      ORDER BY k.nomi
    `);
    const mudirlar = await pool.query(
      "SELECT id, login, full_name FROM users WHERE role = 'kafedra_mudiri' ORDER BY login"
    );
    res.render('superadmin/kafedralar', { kafedralar: rows, mudirlar: mudirlar.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server xatosi');
  }
});

router.post('/superadmin/kafedralar/add', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    let { nomi, qisqa_nomi, mudiri_id } = req.body;
    nomi = nomi?.trim();
    qisqa_nomi = qisqa_nomi?.trim() || null;
    mudiri_id = mudiri_id || null;

    if (!nomi) { req.flash('error', 'Kafedra nomini kiriting.'); return req.session.save(() => res.redirect('/superadmin/kafedralar')); }
    await pool.query('INSERT INTO kafedralar (nomi, qisqa_nomi, mudiri_id) VALUES ($1,$2,$3)', [nomi, qisqa_nomi, mudiri_id]);
    req.flash('success', 'Kafedra qo\'shildi.');
    return req.session.save(() => res.redirect('/superadmin/kafedralar'));
  } catch (err) {
    req.flash('error', 'Xatolik yuz berdi.');
    return req.session.save(() => res.redirect('/superadmin/kafedralar'));
  }
});

router.post('/superadmin/kafedralar/:id/update', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    let { nomi, qisqa_nomi, mudiri_id } = req.body;
    mudiri_id = mudiri_id || null;
    await pool.query(
      'UPDATE kafedralar SET nomi=$1, qisqa_nomi=$2, mudiri_id=$3, updated_at=NOW() WHERE id=$4',
      [nomi?.trim(), qisqa_nomi?.trim() || null, mudiri_id, req.params.id]
    );
    req.flash('success', 'Kafedra yangilandi.');
    return req.session.save(() => res.redirect('/superadmin/kafedralar'));
  } catch (err) {
    req.flash('error', 'Yangilashda xatolik.');
    return req.session.save(() => res.redirect('/superadmin/kafedralar'));
  }
});

router.post('/superadmin/kafedralar/:id/delete', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM kafedralar WHERE id=$1', [req.params.id]);
    req.flash('success', 'Kafedra o\'chirildi.');
  } catch (err) {
    req.flash('error', 'Kafedrada bog\'liq ma\'lumotlar mavjud, o\'chirib bo\'lmadi.');
  }
  return req.session.save(() => res.redirect('/superadmin/kafedralar'));
});

// ── AKADEMIK YILLAR ───────────────────────────────────────────────────────────
router.get('/superadmin/akademik-yillar', requireAuth, requireRole('superadmin'), forceChangePassword, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM akademik_yillar ORDER BY boshlanish_yil DESC');
    res.render('superadmin/akademik_yillar', { yillar: rows });
  } catch (err) {
    res.status(500).send('Server xatosi');
  }
});

router.post('/superadmin/akademik-yillar/add', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    let { boshlanish_yil, tugash_yil, faol } = req.body;
    boshlanish_yil = Number(boshlanish_yil);
    tugash_yil = Number(tugash_yil);
    const nomi = `${boshlanish_yil}-${tugash_yil}`;
    const isFaol = faol === 'on';

    if (isFaol) await pool.query('UPDATE akademik_yillar SET faol=FALSE');
    await pool.query(
      'INSERT INTO akademik_yillar (nomi, boshlanish_yil, tugash_yil, faol) VALUES ($1,$2,$3,$4)',
      [nomi, boshlanish_yil, tugash_yil, isFaol]
    );
    req.flash('success', `${nomi} akademik yil qo'shildi.`);
    return req.session.save(() => res.redirect('/superadmin/akademik-yillar'));
  } catch (err) {
    if (err.code === '23505') req.flash('error', 'Bu akademik yil allaqachon mavjud.');
    else req.flash('error', 'Xatolik yuz berdi.');
    return req.session.save(() => res.redirect('/superadmin/akademik-yillar'));
  }
});

router.post('/superadmin/akademik-yillar/:id/faol', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('UPDATE akademik_yillar SET faol=FALSE');
    await pool.query('UPDATE akademik_yillar SET faol=TRUE WHERE id=$1', [req.params.id]);
    req.flash('success', 'Faol akademik yil o\'zgartirildi.');
    return req.session.save(() => res.redirect('/superadmin/akademik-yillar'));
  } catch (err) {
    res.status(500).send('Server xatosi');
  }
});

router.post('/superadmin/akademik-yillar/:id/delete', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM akademik_yillar WHERE id=$1', [req.params.id]);
    req.flash('success', 'Akademik yil o\'chirildi.');
  } catch (err) {
    req.flash('error', 'O\'chirishda xatolik.');
  }
  return req.session.save(() => res.redirect('/superadmin/akademik-yillar'));
});

module.exports = router;
