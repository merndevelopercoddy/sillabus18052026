// const pool = require('../config/db');

// const checkProfileCompletion = async (req, res, next) => {
//   try {
//     const id = req.session.user?.id;
//     if (!id) return res.redirect("/login");

//     const tables = [
//       "umumiy",
//       "talim",
//       "til_bilish",
//       "qiziqishlari",
//       "yashash_holati",
//       "oilaviy_holati",
//       "qarindoshlari_haqida"
//     ];

//     let allCompleted = true;

//     for (const table of tables) {
//       const { rows } = await pool.query(
//         `SELECT COUNT(*) FROM ${table} WHERE talaba_id = $1`,
//         [id]
//       );

//       if (Number(rows[0].count) === 0) {
//         allCompleted = false;
//         break;
//       }
//     }

//     req.allCompleted = allCompleted;
//     next();

//   } catch (err) {
//     console.error("checkProfileCompletion xatosi:", err);
//     res.status(500).send("Server xatosi");
//   }
// };
// module.exports = checkProfileCompletion;

// middleware/checkProfileCompletion.js
// middleware/checkProfileCompletion.js
const pool = require('../config/db');

const checkProfileCompletion = async (req, res, next) => {
  try {
    // 👇 admin /student/:id yo‘nalishida ishlaganda shu ishlaydi
    const id = req.params.id || req.session.user?.id;
    if (!id) return res.redirect("/login");

    const tables = [
      "umumiy",
      "talim",
      "til_bilish",
      "qiziqishlari",
      "yashash_holati",
      "oilaviy_holati",
      "qarindoshlari_haqida",
      "ijtimoiy_holati",
      "huquqbuzarlik",
      "iqtidorli",
      "mehnat",
      "moddiy_yordam",
      "yutuqlari"

    ];

    let completed = {};

    for (const table of tables) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM ${table} WHERE talaba_id = $1`,
        [id]
      );
      completed[table] = Number(rows[0].count) > 0;
    }

    req.profileStatus = completed;

    // umumiy holat
    req.allCompleted = Object.values(completed).every(Boolean);
    next();

  } catch (err) {
    console.error("checkProfileCompletion xatosi:", err);
    res.status(500).send("Server xatosi");
  }
};

module.exports = checkProfileCompletion;
