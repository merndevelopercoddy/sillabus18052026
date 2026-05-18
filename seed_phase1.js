require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./config/db');

const USERS = [
  { login: 'superadmin',     password: 'Super@123',    role: 'superadmin',     full_name: 'Super Administrator' },
  { login: 'oquv_bolimi',    password: 'Oquv@123',     role: 'oquv_bolimi',    full_name: "O'quv bo'limi xodimi" },
  { login: 'kafedra_mudiri', password: 'Kafedra@123',  role: 'kafedra_mudiri', full_name: 'Kafedra mudiri' },
  { login: 'oqituvchi',      password: 'Oqituvchi@123',role: 'oqituvchi',      full_name: "O'qituvchi" },
];

async function seed() {
  try {
    for (const u of USERS) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE lower(login) = lower($1)', [u.login]
      );
      if (existing.rows.length > 0) {
        console.log(`ℹ️  "${u.login}" allaqachon mavjud — o'tkazildi.`);
        continue;
      }
      const hash = await bcrypt.hash(u.password, 12);
      const { rows } = await pool.query(
        `INSERT INTO users (login, password_hash, role, full_name, must_change_password, is_active)
         VALUES ($1,$2,$3,$4,FALSE,TRUE) RETURNING id, login, role`,
        [u.login, hash, u.role, u.full_name]
      );
      console.log(`✅ Yaratildi: ${rows[0].login} / ${u.password} / ${rows[0].role}`);
    }
    console.log('\nBarcha foydalanuvchilar tayyor.');
  } catch (err) {
    console.error('❌ Xato:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
