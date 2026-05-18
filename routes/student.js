// routes/dashboard.js (CommonJS)
// console.log("LOADED HELPERS:", hbsHelpers);
const express = require('express');
const { requireAuth, forceChangePassword, requireRole } = require('../middleware/auth');
const checkProfileCompletion = require('../middleware/checkProfileCompletion');
const router = express.Router();
const multer = require("multer");
const puppeteer = require("puppeteer");
// const hbs = require("handlebars");
const path = require("path");
const fs = require("fs");
const pool = require('../config/db');
// ============ Multer rasm yuklash sozlamalari ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads")); // public/uploads papkaga saqlanadi
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
/**
 * /dashboard - avtomatik yo'naltirish
 * student  -> /dashboard/student
 * manager  -> /dashboard/manager
 * admin    -> /dashboard/admin
 */
router.get("/api/tumanlar/:viloyatId", async (req, res) => {
  try {
    const { viloyatId } = req.params;
    const { rows } = await pool.query(
      "SELECT id, nomi FROM tumanlar WHERE viloyat_id = $1 ORDER BY nomi",
      [viloyatId]
    );
    console.log(rows)
    res.json(rows);
  } catch (err) {
    console.error("Tumanlarni olishda xato:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});





router.get("/student/umumiy", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    // Umumiy ma'lumot + viloyat va tuman nomlari
    const { rows } = await pool.query(
      `
      SELECT 
        u.*,
        v.nomi  AS viloyat_nomi,
        t.nomi  AS tuman_nomi,
        tv.nomi AS tugilgan_viloyat_nomi
      FROM umumiy u
      LEFT JOIN viloyatlar v  ON u.viloyat     = v.id
      LEFT JOIN tumanlar t    ON u.tuman       = t.id
      LEFT JOIN viloyatlar tv ON u.t_viloyat   = tv.id
      WHERE u.talaba_id = $1
      `,
      [req.session.user.id]
    );
    

    // Viloyatlar ro'yxati (select uchun)
    const viloyatlar = await pool.query(
      "SELECT id, nomi FROM viloyatlar ORDER BY nomi"
    );

    // Agar talaba uchun viloyat tanlangan bo‘lsa, shu viloyatga mos tumanlar
    let tumanlar = { rows: [] };
    if (rows[0]?.viloyat_id) {
      tumanlar = await pool.query(
        "SELECT id, nomi FROM tumanlar WHERE viloyat_id = $1 ORDER BY nomi",
        [rows[0].viloyat_id]
      );
    }

    res.render("student/student_umumiy", {
      data: rows[0] || null,          // umumiy + viloyat_nomi + tuman_nomi
      viloyatlar: viloyatlar.rows,   // drop-down uchun
      tumanlar: tumanlar.rows        // tanlangan viloyatga qarab tumanlar
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});


// ==================== 1. Qo‘shish ====================
router.post("/student/umumiy/add", requireRole("student"),  requireAuth, upload.single("rasm"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const {
      familiya, ism, sharif,
      viloyat, tuman, manzili, t_sana,
      telefon, telefon2, p_seriya, p_number,
      jshshir, talim_turi, kursi, tolov_turi,
      talim_shakli, shifr, mutaxassislik, talim_tili, t_viloyat, guruh
    } = req.body;

    const rasm = req.file ? req.file.filename : null;

    const query = `
        INSERT INTO umumiy (
          talaba_id, rasm, familiya, ism, sharif,
          viloyat, tuman, manzili, t_sana,
          telefon, telefon2, p_seriya, p_number,
          jshshir, talim_turi, kursi, tolov_turi,
          talim_shakli, shifr, mutaxassislik,talim_tili, t_viloyat, guruh
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        RETURNING *;
      `;

    const values = [
      talaba_id, rasm, familiya, ism, sharif,
      viloyat, tuman, manzili, t_sana,
      telefon, telefon2, p_seriya, p_number,
      jshshir, talim_turi, kursi, tolov_turi,
      talim_shakli, shifr, mutaxassislik, talim_tili, t_viloyat, guruh
    ];

    const { rows } = await pool.query(query, values);
    req.session.hasUmumiy = true;
    //   res.json({ success: true, data: rows[0] });
    res.redirect('/student/umumiy');
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

// ==================== 2. Tahrirlash ====================
router.get("/student/umumiy/edit", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      "SELECT * FROM umumiy WHERE talaba_id = $1",
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/umumiy");
    }

    // Barcha viloyatlar
    const viloyatlar = await pool.query(
      "SELECT id, nomi FROM viloyatlar ORDER BY nomi"
    );

    // Shu talaba saqlagan viloyatga tegishli tumanlar
    let tumanlar = { rows: [] };
    if (rows[0]?.viloyat) {
      tumanlar = await pool.query(
        "SELECT id, nomi FROM tumanlar WHERE viloyat_id = $1 ORDER BY nomi",
        [rows[0].viloyat]
      );
    }

    res.render("student/student_umumiy_edit", {
      data: rows[0],
      viloyatlar: viloyatlar.rows,
      tumanlar: tumanlar.rows,
    });
  } catch (err) {
    console.error("GET /student/umumiy/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});



// ====== EDIT SAVE (POST) ======
router.post("/student/umumiy/edit", requireRole("student"), requireAuth, upload.single("rasm"), async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const talaba_id = req.session.user.id;

    const {
      familiya, ism, sharif,
      viloyat, tuman, manzili, t_sana,
      telefon, telefon2, p_seriya, p_number,
      jshshir, talim_turi, kursi, tolov_turi,
      talim_shakli, shifr, mutaxassislik, talim_tili, t_viloyat, guruh
    } = req.body;

    let newRasm = req.file ? req.file.filename : null;

    // Agar yangi rasm bo‘lsa, eski faylni o‘chirish
    if (newRasm) {
      const oldRes = await pool.query(
        "SELECT rasm FROM umumiy WHERE talaba_id = $1",
        [talaba_id]
      );

      if (oldRes.rows.length > 0 && oldRes.rows[0].rasm) {
        const oldFile = path.join(__dirname, "./../public/uploads", oldRes.rows[0].rasm);
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile); // eski faylni o‘chirish
        }
      }
    }

    const query = `
        UPDATE umumiy SET
          rasm = COALESCE($1, rasm),
          familiya = $2,
          ism = $3,
          sharif = $4,
          viloyat = $5,
          tuman = $6,
          manzili = $7,
          t_sana = $8,
          telefon = $9,
          telefon2 = $10,
          p_seriya = $11,
          p_number = $12,
          jshshir = $13,
          talim_turi = $14,
          kursi = $15,
          tolov_turi = $16,
          talim_shakli = $17,
          shifr = $18,
          mutaxassislik = $19,
          talim_tili = $20,
          t_viloyat = $21,
          guruh=$22,
          updated_at = NOW()
        WHERE talaba_id = $23
        RETURNING *;
      `;

    const values = [
      newRasm, familiya, ism, sharif,
      viloyat, tuman, manzili, t_sana,
      telefon, telefon2, p_seriya, p_number,
      jshshir, talim_turi, kursi, tolov_turi,
      talim_shakli, shifr, mutaxassislik, talim_tili, t_viloyat, guruh, talaba_id
    ];

    const { rows } = await pool.query(query, values);
    req.session.hasUmumiy = true;
    if (rows.length === 0) {
      return res.redirect("/student/umumiy");
    }

    return res.redirect("/student/umumiy");

  } catch (err) {
    console.error("POST /student/umumiy/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// Talaba ta'lim ma'lumotlari Start ===========================================================================================================
router.get("/student/talim", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      "SELECT * FROM talim WHERE talaba_id = $1 ORDER BY tugatgan DESC",
      [req.session.user.id]
    );
    res.render("student/student_talim", {
      data: rows || null
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});


router.post("/student/talim/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const talaba_id = req.session.user.id;
    const { tm_nomi, kirgan, tugatgan, mutaxassislik } = req.body;

    const query = `
      INSERT INTO talim (tm_nomi, kirgan, tugatgan, mutaxassislik, talaba_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [tm_nomi, kirgan, tugatgan, mutaxassislik, talaba_id];
    const { rows } = await pool.query(query, values);

    res.redirect("/student/talim");
  } catch (err) {
    console.error("Talim qo'shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// ==================== 2. Tahrirlash ====================
router.get("/student/talim/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM talim WHERE id=$1 AND talaba_id = $2",
      [id, req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/talim"); // maʼlumot bo‘lmasa, qo‘shish formaga qaytarish
    }

    res.render("student/student_talim_edit", { data: rows[0] });
  } catch (err) {
    console.error("GET /student/talim/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// ====== EDIT SAVE (POST) ======
router.post("/student/talim/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const talaba_id = req.session.user.id;
    const { id } = req.params;
    const { tm_nomi, kirgan, tugatgan, mutaxassislik } = req.body;

    const query = `
      UPDATE talim SET
        tm_nomi = $1,
        kirgan = $2,
        tugatgan = $3,
        mutaxassislik = $4,
        updated_at = NOW()
      WHERE id=$5 AND talaba_id = $6
      RETURNING *;
    `;

    const values = [
      tm_nomi, kirgan, tugatgan, mutaxassislik, id, talaba_id
    ];

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.redirect("/student/talim");
    }

    return res.redirect("/student/talim");

  } catch (err) {
    console.error("POST /student/talim/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/talim/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const query = "DELETE FROM talim WHERE id=$1 AND talaba_id=$2 RETURNING *";
    const { rows } = await pool.query(query, [id, talaba_id]);

    if (rows.length === 0) {
      return res.redirect("/student/talim"); // hech narsa topilmadi
    }

    res.redirect("/student/talim"); // qayta yuklash
  } catch (err) {
    console.error("Talaba talim delete xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// ========= Til bilish darajasi ===========================
router.get("/student/til_bilish", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      "SELECT * FROM til_bilish WHERE talaba_id = $1",
      [req.session.user.id]
    );
    console.log(rows)
    res.render("student/student_til_bilish", {
      data: rows || null
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/til_bilish/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const talaba_id = req.session.user.id;
    let { til_nomi, sertifikat, sert_daraja, sert_muddati } = req.body;
    sertifikat = sertifikat && sertifikat.trim() !== "" ? sertifikat : null;
    sert_muddati = sert_muddati && sert_muddati.trim() !== "" ? sert_muddati : null;
    const query = `
      INSERT INTO til_bilish (til_nomi, sertifikat, sert_daraja, sert_muddati, talaba_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [til_nomi, sertifikat, sert_daraja, sert_muddati, talaba_id];
    const { rows } = await pool.query(query, values);

    res.redirect("/student/til_bilish");
  } catch (err) {
    console.error("Til bilish qo'shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/til_bilish/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM til_bilish WHERE id=$1 AND talaba_id=$2",
      [id, talaba_id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/til_bilish");
    }

    res.render("student/student_til_bilish_edit", { data: rows[0] });
  } catch (err) {
    console.error("Til bilish edit GET xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/til_bilish/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;
    let { til_nomi, sertifikat, sert_daraja, sert_muddati } = req.body;
    sertifikat = sertifikat && sertifikat.trim() !== "" ? sertifikat : null;
    sert_muddati = sert_muddati && sert_muddati.trim() !== "" ? sert_muddati : null;
    const query = `
      UPDATE til_bilish
      SET til_nomi=$1, sertifikat=$2, sert_daraja=$3, sert_muddati=$4
      WHERE id=$5 AND talaba_id=$6
      RETURNING *;
    `;

    const values = [til_nomi, sertifikat, sert_daraja, sert_muddati, id, talaba_id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.redirect("/student/til_bilish");
    }

    res.redirect("/student/til_bilish"); // yangilangan ro‘yxatga qaytarish
  } catch (err) {
    console.error("Til bilish tahrirlash POST xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/til_bilish/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const query = "DELETE FROM til_bilish WHERE id=$1 AND talaba_id=$2 RETURNING *";
    const { rows } = await pool.query(query, [id, talaba_id]);

    if (rows.length === 0) {
      return res.redirect("/student/til_bilish"); // hech narsa topilmadi
    }

    res.redirect("/student/til_bilish"); // qayta yuklash
  } catch (err) {
    console.error("Til bilish delete xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// STUDENT QIZIQISHLARI
router.get("/student/qiziqishlari", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      "SELECT * FROM qiziqishlari WHERE talaba_id = $1",
      [req.session.user.id]
    );

    res.render("student/student_qiziqishlari", {
      data: rows || null,
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qiziqishlari/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const talaba_id = req.session.user.id;
    const { qiziqish_turi, qiziqish_yunalish } = req.body;

    const query = `
      INSERT INTO qiziqishlari (qiziqish_turi, qiziqish_yunalish, talaba_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [qiziqish_turi, qiziqish_yunalish, talaba_id];
    const { rows } = await pool.query(query, values);

    res.redirect("/student/qiziqishlari");
  } catch (err) {
    console.error("Talaba qiziqishlari qo'shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/qiziqishlari/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM qiziqishlari WHERE id=$1 AND talaba_id=$2",
      [id, talaba_id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/qiziqishlari");
    }

    res.render("student/student_qiziqishlari_edit", { data: rows[0] });
  } catch (err) {
    console.error("Talaba qiziqishlari edit GET xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qiziqishlari/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;
    const { qiziqish_turi, qiziqish_yunalish } = req.body;

    const query = `
      UPDATE qiziqishlari
      SET qiziqish_turi=$1, qiziqish_yunalish=$2
      WHERE id=$3 AND talaba_id=$4
      RETURNING *;
    `;

    const values = [qiziqish_turi, qiziqish_yunalish, id, talaba_id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.redirect("/student/qiziqishlari");
    }

    res.redirect("/student/qiziqishlari"); // yangilangan ro‘yxatga qaytarish
  } catch (err) {
    console.error("Til bilish tahrirlash POST xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qiziqishlari/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const query = "DELETE FROM qiziqishlari WHERE id=$1 AND talaba_id=$2 RETURNING *";
    const { rows } = await pool.query(query, [id, talaba_id]);

    if (rows.length === 0) {
      return res.redirect("/student/qiziqishlari"); // hech narsa topilmadi
    }

    res.redirect("/student/qiziqishlari"); // qayta yuklash
  } catch (err) {
    console.error("Talaba qiziqishlari delete xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// Student Yutuqlari

router.get("/student/yutuqlari", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      "SELECT * FROM yutuqlari WHERE talaba_id = $1",
      [req.session.user.id]
    );

    res.render("student/student_yutuqlari", {
      data: rows || null,
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/yutuqlari/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const talaba_id = req.session.user.id;
    const { yutuq_nomi, yutuq_yili, yutuq_daraja, yutuq_joyi } = req.body;

    const query = `
      INSERT INTO yutuqlari (yutuq_nomi, yutuq_yili, yutuq_daraja, yutuq_joyi, talaba_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [yutuq_nomi, yutuq_yili, yutuq_daraja, yutuq_joyi, talaba_id];
    const { rows } = await pool.query(query, values);

    res.redirect("/student/yutuqlari");
  } catch (err) {
    console.error("Talaba yutuqlari qo'shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/yutuqlari/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM yutuqlari WHERE id=$1 AND talaba_id=$2",
      [id, talaba_id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/yutuqlari");
    }

    res.render("student/student_yutuqlari_edit", { data: rows[0] });
  } catch (err) {
    console.error("Talaba yutuqlari edit GET xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/yutuqlari/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;
    const { yutuq_nomi, yutuq_yili, yutuq_daraja, yutuq_joyi } = req.body;

    const query = `
      UPDATE yutuqlari
      SET yutuq_nomi=$1, yutuq_yili=$2, yutuq_daraja=$3, yutuq_joyi=$4
      WHERE id=$5 AND talaba_id=$6
      RETURNING *;
    `;

    const values = [yutuq_nomi, yutuq_yili, yutuq_daraja, yutuq_joyi, id, talaba_id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.redirect("/student/yutuqlari");
    }

    res.redirect("/student/yutuqlari"); // yangilangan ro‘yxatga qaytarish
  } catch (err) {
    console.error("Talaba yutuqlari tahrirlash POST xato:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/yutuqlari/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const query = "DELETE FROM yutuqlari WHERE id=$1 AND talaba_id=$2 RETURNING *";
    const { rows } = await pool.query(query, [id, talaba_id]);

    if (rows.length === 0) {
      return res.redirect("/student/yutuqlari"); // hech narsa topilmadi
    }

    res.redirect("/student/yutuqlari"); // qayta yuklash
  } catch (err) {
    console.error("Talaba yutuqlari delete xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// Student Yashash holati

router.get("/student/yashash_holati", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    // Umumiy ma'lumot + viloyat va tuman nomlari
    const { rows } = await pool.query(
      `SELECT u.*,
              v.nomi AS viloyat_nomi,
              t.nomi AS tuman_nomi
       FROM yashash_holati u
       LEFT JOIN viloyatlar v ON u.viloyat_id = v.id
       LEFT JOIN tumanlar t ON u.tuman_id = t.id
       WHERE u.talaba_id = $1`,
      [req.session.user.id]
    );

    // Viloyatlar ro'yxati (select uchun)
    const viloyatlar = await pool.query(
      "SELECT id, nomi FROM viloyatlar ORDER BY nomi"
    );

    // Agar talaba uchun viloyat tanlangan bo‘lsa, shu viloyatga mos tumanlar
    let tumanlar = { rows: [] };
    if (rows[0]?.viloyat_id) {
      tumanlar = await pool.query(
        "SELECT id, nomi FROM tumanlar WHERE viloyat_id = $1 ORDER BY nomi",
        [rows[0].viloyat_id]
      );
    }
    // console.log(rows)
    res.render("student/student_yashash_holati", {
      data: rows || null,          // umumiy + viloyat_nomi + tuman_nomi
      viloyatlar: viloyatlar.rows,   // drop-down uchun
      tumanlar: tumanlar.rows        // tanlangan viloyatga qarab tumanlar
    });

  } catch (err) {
    console.error("xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// POST - yangi yashash_holati yozish
router.post("/student/yashash_holati/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const { yashash_joyi, viloyat_id, tuman_id, manzili } = req.body;

    await pool.query(
      `INSERT INTO yashash_holati (talaba_id, yashash_joyi, viloyat_id, tuman_id, manzili)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.user.id, yashash_joyi, viloyat_id, tuman_id, manzili]
    );

    res.redirect("/student/yashash_holati");
  } catch (err) {
    console.error("POST /student/yashash_holati/add xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// GET - yashash_holati tahrirlash formasi
router.get("/student/yashash_holati/edit", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    // Talabaning mavjud yashash_holati ma’lumotlari + viloyat va tuman nomlari
    const { rows } = await pool.query(
      `SELECT u.*,
              v.nomi AS viloyat_nomi,
              t.nomi AS tuman_nomi
       FROM yashash_holati u
       LEFT JOIN viloyatlar v ON u.viloyat_id = v.id
       LEFT JOIN tumanlar t ON u.tuman_id = t.id
       WHERE u.talaba_id = $1`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/yashash_holati"); // agar ma’lumot bo‘lmasa
    }

    // Barcha viloyatlar (select uchun)
    const viloyatlar = await pool.query(
      "SELECT id, nomi FROM viloyatlar ORDER BY nomi"
    );

    // Agar talaba viloyat tanlagan bo‘lsa – shu viloyatga mos tumanlar
    let tumanlar = { rows: [] };
    if (rows[0]?.viloyat_id) {
      tumanlar = await pool.query(
        "SELECT id, nomi FROM tumanlar WHERE viloyat_id = $1 ORDER BY nomi",
        [rows[0].viloyat_id]
      );
    }

    res.render("student/student_yashash_holati_edit", {
      data: rows[0],               // mavjud ma’lumot
      viloyatlar: viloyatlar.rows, // select uchun viloyatlar
      tumanlar: tumanlar.rows      // viloyatga qarab tumanlar
    });

  } catch (err) {
    console.error("GET /student/yashash_holati/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// Yashash holati ma'lumotini yangilash (edit POST)
router.post("/student/yashash_holati/edit", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { yashash_joyi, viloyat_id, tuman_id, manzili } = req.body;

    // mavjud yozuvni update qilish
    await pool.query(
      `UPDATE yashash_holati 
       SET yashash_joyi = $1,
           viloyat_id   = $2,
           tuman_id     = $3,
           manzili      = $4
       WHERE talaba_id = $5`,
      [yashash_joyi, viloyat_id, tuman_id, manzili, req.session.user.id]
    );

    res.redirect("/student/yashash_holati");

  } catch (err) {
    console.error("POST /student/yashash_holati/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});


// Talaba Oilaviy holati 517241103946
router.get("/student/oilaviy_holati", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM oilaviy_holati WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    res.render("student/student_oilaviy_holati", {
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("GET /student/oilaviy_holati xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/oilaviy_holati/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { jinsi, oilaviy_holat } = req.body;

    await pool.query(
      `INSERT INTO oilaviy_holati (talaba_id, jinsi, oilaviy_holat)
       VALUES ($1, $2, $3)`,
      [req.session.user.id, jinsi, oilaviy_holat]
    );

    res.redirect("/student/oilaviy_holati");
  } catch (err) {
    console.error("POST /student/oilaviy_holati/add xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/oilaviy_holati/edit", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM oilaviy_holati WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/oilaviy_holati/add");
    }

    res.render("student/student_oilaviy_holati_edit", {
      data: rows[0],
    });
  } catch (err) {
    console.error("GET /student/oilaviy_holati/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/oilaviy_holati/edit", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { jinsi, oilaviy_holat } = req.body;

    await pool.query(
      `UPDATE oilaviy_holati
       SET jinsi = $1, oilaviy_holat = $2
       WHERE talaba_id = $3`,
      [jinsi, oilaviy_holat, req.session.user.id]
    );

    res.redirect("/student/oilaviy_holati");
  } catch (err) {
    console.error("POST /student/oilaviy_holati/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// Ijtimoiy holati
router.get("/student/ijtimoiy_holati", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM ijtimoiy_holati WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    res.render("student/student_ijtimoiy_holati", {
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("GET /student/ijtimoiy_holati xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});
// 2️⃣ Qo‘shish (CREATE)
router.post("/student/ijtimoiy_holati/add", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;

    const {
      ihyar,
      ydaftari,
      ayoldaftari,
      temirdaftari,
      imtiyozuqish,
      hxizmat,
      nafaqa,
      ishrasmiy,
      ishnorasmiy,
      farzandli,
      ota_onalik_mahrum,
      m_uyi,
      nogironligi,
      n_toifalari,
      yetimlik,
    } = req.body;

    await pool.query(
      `INSERT INTO ijtimoiy_holati (
        talaba_id, ihyar, ydaftari, ayoldaftari, temirdaftari, imtiyozuqish,
        hxizmat, nafaqa, ishrasmiy, ishnorasmiy, farzandli,
        ota_onalik_mahrum, m_uyi, nogironligi, n_toifalari, yetimlik
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (talaba_id) DO UPDATE SET
        ihyar = EXCLUDED.ihyar,
        ydaftari = EXCLUDED.ydaftari,
        ayoldaftari = EXCLUDED.ayoldaftari,
        temirdaftari = EXCLUDED.temirdaftari,
        imtiyozuqish = EXCLUDED.imtiyozuqish,
        hxizmat = EXCLUDED.hxizmat,
        nafaqa = EXCLUDED.nafaqa,
        ishrasmiy = EXCLUDED.ishrasmiy,
        ishnorasmiy = EXCLUDED.ishnorasmiy,
        farzandli = EXCLUDED.farzandli,
        ota_onalik_mahrum = EXCLUDED.ota_onalik_mahrum,
        m_uyi = EXCLUDED.m_uyi,
        nogironligi = EXCLUDED.nogironligi,
        n_toifalari = EXCLUDED.n_toifalari,
        yetimlik = EXCLUDED.yetimlik,
        updated_at = NOW()`,
      [
        talaba_id,
        ihyar ? true : false,
        ydaftari ? true : false,
        ayoldaftari ? true : false,
        temirdaftari ? true : false,
        imtiyozuqish ? true : false,
        hxizmat ? true : false,
        nafaqa ? true : false,
        ishrasmiy ? true : false,
        ishnorasmiy ? true : false,
        farzandli ? true : false,
        ota_onalik_mahrum ? true : false,
        m_uyi ? true : false,
        nogironligi ? true : false,
        n_toifalari || null,
        yetimlik || null,
      ]
    );

    res.redirect("/student/ijtimoiy_holati");
  } catch (err) {
    console.error("Ijtimoy holati Qo‘shish xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});
// 4️⃣ Tahrirlash sahifasi (GET)
router.get("/student/ijtimoiy_holati/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { rows } = await pool.query(
      "SELECT * FROM ijtimoiy_holati WHERE talaba_id = $1",
      [talaba_id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/ijtimoiy_holati");
    }

    const data = rows[0];
    res.render("student/student_ijtimoiy_holati_edit", { data });
  } catch (err) {
    console.error("Ijtimoiy holati tahrirlash sahifasida xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// 5️⃣ Tahrirni saqlash (POST)
router.post("/student/ijtimoiy_holati/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;

    const {
      ihyar,
      ydaftari,
      ayoldaftari,
      temirdaftari,
      imtiyozuqish,
      hxizmat,
      nafaqa,
      ishrasmiy,
      ishnorasmiy,
      farzandli,
      ota_onalik_mahrum,
      m_uyi,
      nogironligi,
      n_toifalari,
      yetimlik,
    } = req.body;

    await pool.query(
      `UPDATE ijtimoiy_holati SET
        ihyar=$1, ydaftari=$2, ayoldaftari=$3, temirdaftari=$4,
        imtiyozuqish=$5, hxizmat=$6, nafaqa=$7, ishrasmiy=$8,
        ishnorasmiy=$9, farzandli=$10, ota_onalik_mahrum=$11,
        m_uyi=$12, nogironligi=$13, n_toifalari=$14, yetimlik=$15,
        updated_at = NOW()
      WHERE talaba_id=$16`,
      [
        ihyar ? true : false,
        ydaftari ? true : false,
        ayoldaftari ? true : false,
        temirdaftari ? true : false,
        imtiyozuqish ? true : false,
        hxizmat ? true : false,
        nafaqa ? true : false,
        ishrasmiy ? true : false,
        ishnorasmiy ? true : false,
        farzandli ? true : false,
        ota_onalik_mahrum ? true : false,
        m_uyi ? true : false,
        nogironligi ? true : false,
        n_toifalari || null,
        yetimlik || null,
        talaba_id,
      ]
    );

    res.redirect("/student/ijtimoiy_holati");
  } catch (err) {
    console.error("Tahrirni saqlashda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// IQTIDORLI Yoshlar
router.get("/student/iqtidorli", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM iqtidorli WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    res.render("student/student_iqtidorli", {
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("GET /student/iqtidorli xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 2. Qo‘shish yoki yangilash ===== */
router.post("/student/iqtidorli/add", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const {
      dmukofot,
      knishon,
      pstipendiya,
      dstipendiya,
      xstipendiya,
      rsport,
      xsport,
      resfan,
      xfan,
      boshqayutuq
    } = req.body;

    await pool.query(
      `INSERT INTO iqtidorli (
        talaba_id, dmukofot, knishon, pstipendiya, dstipendiya, xstipendiya,
        rsport, xsport, resfan, xfan, boshqayutuq
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      ON CONFLICT (talaba_id) DO UPDATE SET
        dmukofot=EXCLUDED.dmukofot,
        knishon=EXCLUDED.knishon,
        pstipendiya=EXCLUDED.pstipendiya,
        dstipendiya=EXCLUDED.dstipendiya,
        xstipendiya=EXCLUDED.xstipendiya,
        rsport=EXCLUDED.rsport,
        xsport=EXCLUDED.xsport,
        resfan=EXCLUDED.resfan,
        xfan=EXCLUDED.xfan,
        boshqayutuq=EXCLUDED.boshqayutuq,
        updated_at=NOW()`,
      [
        talaba_id,
        dmukofot ? true : false,
        knishon ? true : false,
        pstipendiya ? true : false,
        dstipendiya ? true : false,
        xstipendiya ? true : false,
        rsport ? true : false,
        xsport ? true : false,
        resfan ? true : false,
        xfan ? true : false,
        boshqayutuq ? true : false
      ]
    );

    res.redirect("/student/iqtidorli");
  } catch (err) {
    console.error("Iqtidorli qo‘shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 4. Tahrirlash sahifasi ===== */
router.get("/student/iqtidorli/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { rows } = await pool.query("SELECT * FROM iqtidorli WHERE talaba_id = $1", [talaba_id]);
    if (rows.length === 0) return res.redirect("/student/iqtidorli");
    res.render("student/student_iqtidorli_edit", { data: rows[0] });
  } catch (err) {
    console.error("Iqtidorli edit xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 5. Tahrirlashni saqlash ===== */
router.post("/student/iqtidorli/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const {
      dmukofot,
      knishon,
      pstipendiya,
      dstipendiya,
      xstipendiya,
      rsport,
      xsport,
      resfan,
      xfan,
      boshqayutuq
    } = req.body;

    await pool.query(
      `UPDATE iqtidorli SET
        dmukofot=$1, knishon=$2, pstipendiya=$3, dstipendiya=$4, xstipendiya=$5,
        rsport=$6, xsport=$7, resfan=$8, xfan=$9, boshqayutuq=$10,
        updated_at=NOW()
      WHERE talaba_id=$11`,
      [
        dmukofot ? true : false,
        knishon ? true : false,
        pstipendiya ? true : false,
        dstipendiya ? true : false,
        xstipendiya ? true : false,
        rsport ? true : false,
        xsport ? true : false,
        resfan ? true : false,
        xfan ? true : false,
        boshqayutuq ? true : false,
        talaba_id
      ]
    );

    res.redirect("/student/iqtidorli");
  } catch (err) {
    console.error("Iqtidorli edit saqlash xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// MODDIY Ragbatlantirish
router.get("/student/moddiy", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM moddiy_yordam WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    res.render("student/student_moddiy", {
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("GET /student/moddiy xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 2. Qo‘shish (INSERT yoki UPDATE) ===== */
router.post("/student/moddiy/add", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { itopshirgan, ixarajat, tshartnoma, itulov } = req.body;

    await pool.query(
      `INSERT INTO moddiy_yordam (talaba_id, itopshirgan, ixarajat, tshartnoma, itulov)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (talaba_id) DO UPDATE SET
         itopshirgan=EXCLUDED.itopshirgan,
         ixarajat=EXCLUDED.ixarajat,
         tshartnoma=EXCLUDED.tshartnoma,
         itulov=EXCLUDED.itulov,
         updated_at=NOW()`,
      [
        talaba_id,
        itopshirgan ? true : false,
        ixarajat ? true : false,
        tshartnoma ? true : false,
        itulov ? true : false,
      ]
    );

    res.redirect("/student/moddiy");
  } catch (err) {
    console.error("Moddiy qo‘shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 4. Tahrirlash sahifasi ===== */
router.get("/student/moddiy/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { rows } = await pool.query("SELECT * FROM moddiy_yordam WHERE talaba_id = $1", [talaba_id]);
    if (rows.length === 0) return res.redirect("/student/moddiy");
    res.render("student/student_moddiy_edit", { data: rows[0] });
  } catch (err) {
    console.error("Moddiy edit sahifasida xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 5. Tahrirlashni saqlash ===== */
router.post("/student/moddiy/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { itopshirgan, ixarajat, tshartnoma, itulov } = req.body;

    await pool.query(
      `UPDATE moddiy_yordam SET
        itopshirgan=$1, ixarajat=$2, tshartnoma=$3, itulov=$4, updated_at=NOW()
       WHERE talaba_id=$5`,
      [
        itopshirgan ? true : false,
        ixarajat ? true : false,
        tshartnoma ? true : false,
        itulov ? true : false,
        talaba_id,
      ]
    );

    res.redirect("/student/moddiy");
  } catch (err) {
    console.error("Moddiy edit saqlashda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// Talabalar Huquqbuzarlik
router.get("/student/huquqbuzarlik", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM huquqbuzarlik WHERE talaba_id = $1`,
      [req.session.user.id]
    );

    res.render("student/student_huquqbuzarlik", {
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("GET /student/huquqbuzarlik xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});
/* ===== 2. Qo‘shish yoki yangilash ===== */
router.post("/student/huquqbuzarlik/add", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { notinch, ytabiatli, jiem, probatsiya, horderi, jqasd, mhuquqbuzarlik } = req.body;

    await pool.query(
      `INSERT INTO huquqbuzarlik (
        talaba_id, notinch, ytabiatli, jiem, probatsiya, horderi, jqasd, mhuquqbuzarlik
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      ON CONFLICT (talaba_id) DO UPDATE SET
        notinch=EXCLUDED.notinch,
        ytabiatli=EXCLUDED.ytabiatli,
        jiem=EXCLUDED.jiem,
        probatsiya=EXCLUDED.probatsiya,
        horderi=EXCLUDED.horderi,
        jqasd=EXCLUDED.jqasd,
        mhuquqbuzarlik=EXCLUDED.mhuquqbuzarlik,
        updated_at=NOW()`,
      [
        talaba_id,
        notinch ? true : false,
        ytabiatli ? true : false,
        jiem ? true : false,
        probatsiya ? true : false,
        horderi ? true : false,
        jqasd ? true : false,
        mhuquqbuzarlik ? true : false,
      ]
    );

    res.redirect("/student/huquqbuzarlik");
  } catch (err) {
    console.error("Huquqbuzarlik qo‘shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 4. Tahrirlash sahifasi ===== */
router.get("/student/huquqbuzarlik/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { rows } = await pool.query("SELECT * FROM huquqbuzarlik WHERE talaba_id = $1", [talaba_id]);
    if (rows.length === 0) return res.redirect("/student/huquqbuzarlik");
    res.render("student/student_huquqbuzarlik_edit", { data: rows[0] });
  } catch (err) {
    console.error("Huquqbuzarlik edit sahifasida xato:", err);
    res.status(500).send("Server xatosi");
  }
});

/* ===== 5. Tahrirni saqlash ===== */
router.post("/student/huquqbuzarlik/edit", requireRole("student"), async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { notinch, ytabiatli, jiem, probatsiya, horderi, jqasd, mhuquqbuzarlik } = req.body;

    await pool.query(
      `UPDATE huquqbuzarlik SET
        notinch=$1, ytabiatli=$2, jiem=$3, probatsiya=$4, 
        horderi=$5, jqasd=$6, mhuquqbuzarlik=$7, updated_at=NOW()
      WHERE talaba_id=$8`,
      [
        notinch ? true : false,
        ytabiatli ? true : false,
        jiem ? true : false,
        probatsiya ? true : false,
        horderi ? true : false,
        jqasd ? true : false,
        mhuquqbuzarlik ? true : false,
        talaba_id,
      ]
    );

    res.redirect("/student/huquqbuzarlik");
  } catch (err) {
    console.error("Huquqbuzarlik tahrir saqlashda xato:", err);
    res.status(500).send("Server xatosi");
  }
});







// Talaba yaqin qarindoshlari
router.get("/student/qarindoshlari_haqida", requireRole("student"), requireAuth, async (req, res) => {
  try {
    // const { rows } = await pool.query(
    //   "SELECT * FROM qarindoshlari_haqida WHERE talaba_id = $1 ORDER BY id",
    //   [req.session.user.id]
    // );
    const { rows } = await pool.query(
      `SELECT * FROM qarindoshlari_haqida WHERE talaba_id = $1
       ORDER BY CASE q_qarindoshligi
         WHEN 'Otasi' THEN 1
         WHEN 'Onasi' THEN 2
         WHEN 'Akasi' THEN 3
         WHEN 'Ukasi' THEN 4
         WHEN 'Opasi' THEN 5
         WHEN 'Singlisi' THEN 6
         ELSE 7 END`,
      [req.session.user.id]
    );
    res.render("student/student_qarindoshlar", { data: rows });
  } catch (err) {
    console.error("GET /student/qarindoshlari_haqida xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qarindoshlari_haqida/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const { q_familiya, q_ism, q_sharif, q_qarindoshligi, q_tugilgan, q_telefon, q_ish_joyi, q_lavozimi } = req.body;

    await pool.query(
      `INSERT INTO qarindoshlari_haqida 
        (q_familiya, q_ism, q_sharif, q_qarindoshligi, q_tugilgan, q_ish_joyi, q_lavozimi, q_telefon, talaba_id) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [q_familiya, q_ism, q_sharif, q_qarindoshligi, q_tugilgan, q_ish_joyi, q_lavozimi, q_telefon, req.session.user.id]
    );

    res.redirect("/student/qarindoshlari_haqida");
  } catch (err) {
    console.error("POST /student/qarindoshlari_haqida/add xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/qarindoshlari_haqida/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM qarindoshlari_haqida WHERE id = $1 AND talaba_id = $2",
      [id, req.session.user.id]
    );

    if (rows.length === 0) return res.redirect("/student/qarindoshlari_haqida");

    res.render("student/student_qarindoshlar_edit", { data: rows[0] });
  } catch (err) {
    console.error("GET /student/qarindoshlari_haqida/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qarindoshlari_haqida/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { q_familiya, q_ism, q_sharif, q_qarindoshligi, q_tugilgan, q_telefon, q_ish_joyi, q_lavozimi } = req.body;

    await pool.query(
      `UPDATE qarindoshlari_haqida 
       SET q_familiya=$1, q_ism=$2, q_sharif=$3, q_qarindoshligi=$4, q_tugilgan=$5, q_ish_joyi=$6, q_lavozimi=$7, q_telefon=$8
       WHERE id=$9 AND talaba_id=$10`,
      [q_familiya, q_ism, q_sharif, q_qarindoshligi, q_tugilgan, q_ish_joyi, q_lavozimi, q_telefon, id, req.session.user.id]
    );

    res.redirect("/student/qarindoshlari_haqida");
  } catch (err) {
    console.error("POST /student/qarindoshlari_haqida/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/qarindoshlari_haqida/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM qarindoshlari_haqida WHERE id=$1 AND talaba_id=$2", [
      id,
      req.session.user.id,
    ]);

    res.redirect("/student/qarindoshlari_haqida");
  } catch (err) {
    console.error("DELETE /student/qarindoshlari_haqida xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// Mehnat faoliyati
router.get("/student/mehnat", requireRole("student"), requireAuth, forceChangePassword, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const { rows } = await pool.query(
      `SELECT * FROM mehnat WHERE talaba_id = $1 ORDER BY tugagan DESC`,
      [req.session.user.id]
    );

    res.render("student/student_mehnat", {
      data: rows || null,
    });
  } catch (err) {
    console.error("GET /student/mehnat faoliyati xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/mehnat/add", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const talaba_id = req.session.user.id;
    const { tashkilot, lavozim, boshlangan, tugagan } = req.body;

    const query = `
      INSERT INTO mehnat (talaba_id , tashkilot, lavozim, boshlangan, tugagan)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [talaba_id , tashkilot, lavozim, boshlangan, tugagan];
    const { rows } = await pool.query(query, values);

    res.redirect("/student/mehnat");
  } catch (err) {
    console.error("Mehnat faoliyati qo'shishda xato:", err);
    res.status(500).send("Server xatosi");
  }
});

// ==================== 2. Tahrirlash ====================
router.get("/student/mehnat/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM mehnat WHERE id=$1 AND talaba_id = $2",
      [id, req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect("/student/mehnat"); // maʼlumot bo‘lmasa, qo‘shish formaga qaytarish
    }

    res.render("student/student_mehnat_edit", { data: rows[0] });
  } catch (err) {
    console.error("GET /student/mehnat/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

// ====== EDIT SAVE (POST) ======
router.post("/student/mehnat/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const talaba_id = req.session.user.id;
    const { id } = req.params;
    const { tashkilot, lavozim, boshlangan, tugagan } = req.body;

    const query = `
      UPDATE mehnat SET
        tashkilot = $1,
        lavozim = $2,
        boshlangan = $3,
        tugagan = $4
      WHERE id=$5 AND talaba_id = $6
      RETURNING *;
    `;

    const values = [
      tashkilot, lavozim, boshlangan, tugagan, id, talaba_id
    ];

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.redirect("/student/mehnat");
    }

    return res.redirect("/student/mehnat");

  } catch (err) {
    console.error("POST /student/mehnat/edit xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.post("/student/mehnat/delete/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const talaba_id = req.session.user.id;
    const { id } = req.params;

    const query = "DELETE FROM mehnat WHERE id=$1 AND talaba_id=$2 RETURNING *";
    const { rows } = await pool.query(query, [id, talaba_id]);

    if (rows.length === 0) {
      return res.redirect("/student/mehnat"); // hech narsa topilmadi
    }

    res.redirect("/student/mehnat"); // qayta yuklash
  } catch (err) {
    console.error("Talaba mehnat faoliyati delete xato:", err);
    res.status(500).send("Server xatosi");
  }
});






router.get("/student/dashboard", requireRole("student"), requireAuth, forceChangePassword, checkProfileCompletion, (req, res) => {
  if (req.session.user.role !== 'student' && req.session.user.role !== 'admin') {
    return res.status(403).send('Ruxsat yo‘q');
  }
  res.render("dashboard/student", {
    allCompleted: req.allCompleted
  });
});

router.get("/student/cv/select", requireRole("student"), requireAuth,  async (req, res) => {
  try {
    const id = req.session.user.id;
    const designs = [1, 2, 3];
    // Talaba ma’lumotlarini yuklash (CVda foydalanish uchun)
    const umumiy = await pool.query("SELECT * FROM umumiy WHERE talaba_id = $1", [id]);
    const talim = await pool.query("SELECT * FROM talim WHERE talaba_id = $1", [id]);
    const tillar = await pool.query("SELECT * FROM til_bilish WHERE talaba_id = $1", [id]);
    const yutuqlar = await pool.query("SELECT * FROM yutuqlari WHERE talaba_id = $1", [id]);
    const qiziqishlar = await pool.query("SELECT * FROM qiziqishlari WHERE talaba_id = $1", [id]);
    const yashash = await pool.query("SELECT * FROM yashash_holati WHERE talaba_id = $1", [id]);
    const oilaviy = await pool.query("SELECT * FROM oilaviy_holati WHERE talaba_id = $1", [id]);
    const qarindoshlar = await pool.query("SELECT * FROM qarindoshlari_haqida WHERE talaba_id = $1", [id]);

    // Barcha ma’lumotlarni bitta obyektga jamlaymiz
    const data = {
      umumiy: umumiy.rows[0],
      talim: talim.rows,
      tillar: tillar.rows,
      yutuqlar: yutuqlar.rows,
      qiziqishlar: qiziqishlar.rows,
      yashash: yashash.rows[0],
      oilaviy: oilaviy.rows[0],
      qarindoshlar: qarindoshlar.rows
    };

    // Dizayn tanlash sahifasini render qilish
    res.render("student/student_cv_select", { data, designs });
  } catch (err) {
    console.error("CV select sahifasi xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/cv/:id", requireRole("student"), requireAuth, async (req, res) => {
  try {
    const dizaynId = req.params.id;
    const id = req.session.user.id;

    if (!id) return res.redirect("/login");

    // talabaning barcha ma'lumotlarini olish
    const [umumiy, talim, til_bilish, qiziqishlari, yutuqlari, yashash_holati, oilaviy_holati, qarindoshlari_haqida, mehnat] = await Promise.all([
      pool.query(`SELECT u.*,
              v.nomi AS viloyat_nomi,
              t.nomi AS tuman_nomi,
              tv.nomi AS tugilgan_viloyat_nomi
       FROM umumiy u
       LEFT JOIN viloyatlar v ON u.viloyat = v.id
       LEFT JOIN tumanlar t ON u.tuman = t.id
       LEFT JOIN viloyatlar tv ON u.t_viloyat   = tv.id
       WHERE u.talaba_id = $1`, [id]),
      pool.query("SELECT * FROM talim WHERE talaba_id = $1 ORDER BY tugatgan DESC", [id]),
      pool.query("SELECT * FROM til_bilish WHERE talaba_id = $1", [id]),
      pool.query("SELECT * FROM qiziqishlari WHERE talaba_id = $1", [id]),
      pool.query("SELECT * FROM yutuqlari WHERE talaba_id = $1 ORDER BY yutuq_yili DESC", [id]),
      pool.query(`SELECT u.*,
        v.nomi AS viloyat_nomi,
        t.nomi AS tuman_nomi
 FROM yashash_holati u
 LEFT JOIN viloyatlar v ON u.viloyat_id = v.id
 LEFT JOIN tumanlar t ON u.tuman_id = t.id
 WHERE u.talaba_id = $1`, [id]),
      pool.query("SELECT * FROM oilaviy_holati WHERE talaba_id = $1", [id]),
      pool.query(`SELECT * FROM qarindoshlari_haqida WHERE talaba_id = $1
       ORDER BY CASE q_qarindoshligi
         WHEN 'Otasi' THEN 1
         WHEN 'Onasi' THEN 2
         WHEN 'Akasi' THEN 3
         WHEN 'Ukasi' THEN 4
         WHEN 'Opasi' THEN 5
         WHEN 'Singlisi' THEN 6
         ELSE 7 END`, [id]),
      pool.query("SELECT * FROM mehnat WHERE talaba_id = $1 ORDER BY tugagan DESC", [id]),

    ]);
    // console.log(umumiy.rows[0])
    res.render(`student/cv_templates/cv_design${dizaynId}`, {
      umumiy: umumiy.rows[0],
      talim: talim.rows,
      til_bilish: til_bilish.rows,
      qiziqishlari: qiziqishlari.rows,
      yutuqlari: yutuqlari.rows,
      yashash_holati: yashash_holati.rows[0],
      oilaviy_holati: oilaviy_holati.rows[0],
      qarindoshlari_haqida: qarindoshlari_haqida.rows,
      mehnat:mehnat.rows
    });

  } catch (err) {
    console.error("CV preview xatosi:", err);
    res.status(500).send("Server xatosi");
  }
});

router.get("/student/cv/download/:id", requireRole("student"), async (req, res) => {
  try {
    const id = req.params.id;

    // 1️⃣ Ma’lumotlarni DB’dan olish
    const umumiy = (await pool.query("SELECT * FROM umumiy WHERE id=$1", [id])).rows[0];
    const talim = (await pool.query("SELECT * FROM talim WHERE talaba_id=$1", [id])).rows;
    const til_bilish = (await pool.query("SELECT * FROM til_bilish WHERE talaba_id=$1", [id])).rows;

    // 2️⃣ Handlebars shablonni o‘qish
    const fs = require("fs");
    const path = require("path");
    const hbs = require("handlebars");

    const templatePath = path.join(__dirname, "../views/student/cv_templates/cv_design2.hbs");
    const htmlTemplate = fs.readFileSync(templatePath, "utf8");
    const template = hbs.compile(htmlTemplate);

    // 3️⃣ HTML’ni to‘g‘ridan-to‘g‘ri generatsiya qilish
    const html = template({
      umumiy,
      talim,
      til_bilish,
      layout: false,
    });

    // 4️⃣ CSS ni yuklab qo‘shish
    const cssPath = path.join(__dirname, "../public/css/cv_design2.css");
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

    // 5️⃣ Puppeteer orqali PDF yaratish
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(`<style>${css}</style>${html}`, { waitUntil: "load" });

    const element = await page.$("#cv_design");
    if (!element) {
      await browser.close();
      return res.status(404).send("cv_design bloki topilmadi!");
    }

    const pdfBuffer = await element.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    // 6️⃣ Foydalanuvchiga PDF yuborish
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CV_${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF yaratishda xatolik:", err);
    res.status(500).send("PDF yaratishda xatolik yuz berdi");
  }
});





module.exports = router;