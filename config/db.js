// config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10
});

pool.query('SELECT 1').then(() => {
  console.log('✅ Neon PostgreSQL ulandi');
}).catch(err => {
  console.error('❌ Neon ulanish xatosi:', err.message);
});

module.exports = pool;
