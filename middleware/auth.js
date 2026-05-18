// middleware/auth.js
function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    return res.redirect('/login');
  }
  
  // function requireRole(role) {
  //   return (req, res, next) => {
  //     const u = req.session?.user;
  //     if (!u) return res.redirect('/login');
  //     if (u.role === role || u.role === 'admin') return next() ;
  //     return res.status(403).send('Ruxsat yo‘q');
  //   };
  // }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.session.user) {
        return res.redirect("/login");
      }
  
      if (!roles.includes(req.session.user.role)) {
        // foydalanuvchining roli mos kelmasa
        return res.status(403).render("errors/403", {
          message: "Sizda bu sahifaga kirish huquqi yo‘q.",
          role: req.session.user.role,
        });
      }
  
      next();
    };
  }
  
  function forceChangePassword(req, res, next) {
    const u = req.session?.user;
    if (!u) return res.redirect('/login');
    if (u.must_change_password && !req.path.startsWith('/change-password')) {
      return res.redirect('/change-password');
    }
    next();
  }
  
  module.exports = { requireAuth, requireRole, forceChangePassword };
  