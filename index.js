// index.js (CommonJS)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require("connect-flash");
const connectPgSimple = require('connect-pg-simple');
const path = require('path');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const morgan = require('morgan');
const methodOverride = require('method-override');
const hbsHelpers = require("./helpers/hbsHelpers");
const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const managerRoutes = require('./routes/manager');
const superadminRoutes = require('./routes/superadmin');
const oquvBolomRoutes = require('./routes/oquv_bolimi');
const kafedraMudiriRoutes = require('./routes/kafedra_mudiri');
const oqituvchiRoutes = require('./routes/oqituvchi');
const { requireAuth, forceChangePassword } = require('./middleware/auth');
const checkSections = require("./middleware/checkSection");

const PgSession = connectPgSimple(session);
const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session
app.use(
  session({
    store: new PgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET || 'change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// app.engine(
//   'hbs',
//   exphbs.engine({
//     extname: 'hbs',
//     defaultLayout: 'main',
//     layoutsDir: path.join(__dirname, 'views', 'layouts'),
//     partialsDir: path.join(__dirname, 'views', 'partials'),
    
//     helpers: {
//       eq: (a, b) => a === b,
//       formatDate: (date) => {
//         if (!date) return "";
//         const d = new Date(date);
//         if (isNaN(d)) return "";
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, "0");
//         const day = String(d.getDate()).padStart(2, "0");
//         return `${year}-${month}-${day}`; 
//       },
//       formatDate2: (date) => {
//         if (!date) return "";
//         const d = new Date(date);
//         return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
//       },
//       ifCond: function (v1, v2, options) {
//         return v1 == v2 ? options.fn(this) : options.inverse(this);
//       }
//     }
//   })
// );

app.engine(
  'hbs',
  exphbs.engine({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: hbsHelpers, // endi alohida fayldan
  })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(checkSections);
// Static
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/dashboard/', express.static("public"));
app.use(['/' , '/dashboard' , '/student'], express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
// Locals
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
});

// Routes
app.use(authRoutes);
app.use(adminRoutes);
app.use(managerRoutes);
app.use(studentRoutes);
app.use(superadminRoutes);
app.use(oquvBolomRoutes);
app.use(kafedraMudiriRoutes);
app.use(oqituvchiRoutes);

// Home — rolga qarab yo'naltirish
app.get('/', requireAuth, forceChangePassword, (req, res) => {
  const role = req.session.user.role;
  if (role === 'superadmin')     return res.redirect('/superadmin/dashboard');
  if (role === 'oquv_bolimi')    return res.redirect('/oquv-bolimi/dashboard');
  if (role === 'kafedra_mudiri') return res.redirect('/kafedra-mudiri/dashboard');
  if (role === 'oqituvchi')      return res.redirect('/oqituvchi/dashboard');
  if (role === 'manager')        return res.redirect('/manager/dashboard');
  if (role === 'student')        return res.redirect('/student/dashboard');
  return res.redirect('/admin/dashboard');
});
// app.get('/', (req, res) => res.redirect('/dashboard'));



const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`→ http://localhost:${port}`));
