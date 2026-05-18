// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const router = express.Router();

// Login form
router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.render('auth/login', { title: 'Kirish' });
});

// Login submit
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    const { rows } = await pool.query(
      `SELECT id, login, password_hash, role, must_change_password, is_active
         FROM users
        WHERE lower(login)=lower($1)`,
      [login]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.render('auth/login', { title: 'Kirish', error: "Login yoki parol noto'g'ri" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render('auth/login', { title: 'Kirish', error: "Login yoki parol noto'g'ri" });
    }

    await pool.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]);

    req.session.user = {
      id: user.id,
      username: user.login,
      role: user.role,
      must_change_password: user.must_change_password
    };

    if (user.must_change_password) return res.redirect('/change-password');
    return res.redirect('/');
  } catch (e) {
    console.error(e);
    res.render('auth/login', { title: 'Kirish', error: 'Kutilmagan xato' });
  }
});

// Force change password (GET)
router.get('/change-password', (req, res) => {
  const u = req.session?.user;
  if (!u) return res.redirect('/login');
  res.render('auth/force_change_password', { title: 'Parolni yangilash', layout: false });
});

// Force change password (POST)
router.post('/change-password', async (req, res) => {
  const u = req.session?.user;
  if (!u) return res.redirect('/login');

  const { new_password, new_password2 } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.render('auth/force_change_password', { layout: false, error: "Parol kamida 6 belgi bo'lsin" });
  }
  if (new_password !== new_password2) {
    return res.render('auth/force_change_password', { layout: false, error: 'Parollar mos emas' });
  }

  const hash = await bcrypt.hash(new_password, 12);
  await pool.query(
    `UPDATE users
        SET password_hash=$1,
            must_change_password=false,
            password_changed_at=NOW()
      WHERE id=$2`,
    [hash, u.id]
  );

  req.session.user.must_change_password = false;
  res.redirect('/');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
