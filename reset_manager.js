require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./config/db');

async function reset() {
  const hash = await bcrypt.hash('Manager@123', 12);
  const { rows } = await pool.query(
    'UPDATE users SET password_hash=$1, must_change_password=TRUE WHERE login=$2 RETURNING login, role',
    [hash, 'manager']
  );
  if (rows.length > 0) {
    console.log('Parol yangilandi:', rows[0].login, '/', rows[0].role);
    console.log('Yangi parol: Manager@123');
  } else {
    console.log('Manager topilmadi');
  }
  await pool.end();
}

reset().catch(console.error);
