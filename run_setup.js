// run_setup.js — SQL faylni bazaga ishlatish
// node run_setup.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'Sillabus-last';
const adminUrl = process.env.DATABASE_URL.replace(`/${DB_NAME}`, '/postgres');

async function run() {
  // 1. Baza mavjudligini tekshirish / yaratish
  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    const res = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME]
    );
    if (res.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✅ "${DB_NAME}" bazasi yaratildi.`);
    } else {
      console.log(`ℹ️  "${DB_NAME}" bazasi allaqachon mavjud.`);
    }
  } finally {
    await adminPool.end();
  }

  // 2. Jadvallarni yaratish
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Barcha jadvallar va seed ma\'lumotlar muvaffaqiyatli yaratildi.');
    console.log('');
    console.log('Keyingi qadam — admin foydalanuvchi yaratish:');
    console.log('  node seed.js');
  } catch (err) {
    console.error('❌ Xato:', err.message);
  } finally {
    await pool.end();
  }
}

run();
