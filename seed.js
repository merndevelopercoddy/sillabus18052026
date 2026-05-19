// seed.js — Foydalanuvchilarni yaratish
// Ishlatish: node seed.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./config/db');

const USERS = [
  { login: 'admin',          password: 'Admin@123',         role: 'admin'          },
  { login: 'manager',        password: 'Manager@123',       role: 'manager'        },
  { login: 'superadmin',     password: 'Superadmin@123',    role: 'superadmin'     },
  { login: 'oquv_bolimi',    password: 'OquvBolimi@123',    role: 'oquv_bolimi'    },
  { login: 'oqituvchi',      password: 'Oqituvchi@123',     role: 'oqituvchi'      },
  { login: 'kafedra_mudiri', password: 'KafedraMudiri@123', role: 'kafedra_mudiri' },
];

async function seedUsers() {
  try {
    for (const u of USERS) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE lower(login) = lower($1)',
        [u.login]
      );

      if (existing.rows.length > 0) {
        console.log(`ℹ️  "${u.login}" allaqachon mavjud — o'tkazildi.`);
        continue;
      }

      const hash = await bcrypt.hash(u.password, 12);
      const { rows } = await pool.query(
        `INSERT INTO users (login, password_hash, role, must_change_password, is_active)
         VALUES ($1, $2, $3, TRUE, TRUE) RETURNING id, login, role`,
        [u.login, hash, u.role]
      );

      console.log(`✅ Yaratildi: login=${rows[0].login}  parol=${u.password}  rol=${rows[0].role}  id=${rows[0].id}`);
    }
    console.log('');
    console.log('⚠️  Birinchi kirishda parolni o\'zgartirishingiz kerak bo\'ladi.');
  } catch (err) {
    console.error('❌ Seed xatosi:', err.message);
  } finally {
    await pool.end();
  }
}

seedUsers();
