// routes/dashboard.js (CommonJS)
const express = require('express');
const { requireAuth, forceChangePassword, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * /dashboard - avtomatik yo'naltirish
 * student  -> /dashboard/student
 * manager  -> /dashboard/manager
 * admin    -> /dashboard/admin
 */
// router.get('/dashboard', requireAuth, forceChangePassword, (req, res) => {
//   const role = req.session.user.role;
//   if (role === 'student') return res.redirect('/dashboard/student');
//   if (role === 'manager') return res.redirect('/dashboard/manager');
//   return res.redirect('/dashboard/admin');
// });

/** Student dashboard */
router.get('/dashboard/student', requireAuth, forceChangePassword, (req, res) => {
  if (req.session.user.role !== 'student' && req.session.user.role !== 'admin') {
    return res.status(403).send('Ruxsat yo‘q');
  }
  // Bu yerda talabaga oid mini-statistikalar yoki qisqa linklar bo'ladi
  res.render('dashboard/student', {
    title: 'Talaba Dashboard',
    user: req.session.user
  });
});

/** Manager dashboard requireRole('manager'), */
router.get('dashboard/manager', requireAuth, forceChangePassword,  (req, res) => {
    if (req.session.user.role !== 'manager' && req.session.user.role !== 'admin') {
    return res.status(403).send('Ruxsat yo‘q');
  }
  res.render('dashboard/manager', {
    title: 'Manager Dashboard',
    user: req.session.user
  });
});

/** Admin dashboard */
router.get('/dashboard/admin', requireAuth, forceChangePassword, requireRole('admin'), (req, res) => {
  // Admin uchun boshqaruv paneli (manager CRUD, templates, nazorat)
  res.render('dashboard/admin', {
    title: 'Admin Dashboard',
    user: req.session.user
  });
});

module.exports = router;
