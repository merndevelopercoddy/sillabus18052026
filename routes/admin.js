// routes/dashboard.js (CommonJS)
// console.log("LOADED HELPERS:", hbsHelpers);
const express = require('express');
const bcrypt = require('bcrypt');
const { requireAuth, forceChangePassword, requireRole } = require('../middleware/auth');
const checkProfileCompletion = require('../middleware/checkProfileCompletion');
const router = express.Router();
const multer = require("multer");
const puppeteer = require("puppeteer");
// const hbs = require("handlebars");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const pool = require('../config/db');
const uploadExcel = require("../middleware/uploadExcel");
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
/** Admin dashboard */
router.get('/admin/dashboard', requireRole('admin'), requireAuth, forceChangePassword, (req, res) => {
    // Admin uchun boshqaruv paneli (manager CRUD, templates, nazorat)
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        user: req.session.user
    });
});

router.get("/admin/users/add", requireRole('admin'), requireAuth, (req, res) => {
    res.render("admin/add_user");
});
router.post("/admin/users/add", requireRole('admin'), requireAuth,  async (req, res) => {
    try {
        const { login, password, role } = req.body;
        const password_hash = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (login, password_hash, role) VALUES ($1, $2, $3)",
            [login, password_hash, role]
        );
        res.redirect("/admin/dashboard");
    } catch (err) {
        console.error("Admin foydalanuvchi qo‘shishda xato:", err);
        res.status(500).send("Server xatosi");
    }
});
// 2️⃣ Parol yangilash sahifasi
router.get("/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            "SELECT id, login, role FROM users WHERE id = $1",
            [id]
        );
        if (!rows.length) return res.status(404).send("Foydalanuvchi topilmadi");

        res.render("admin/user_edit", { user: rows[0] });
    } catch (err) {
        console.error("Parol sahifasini yuklashda xato:", err);
        res.status(500).send("Server xatosi");
    }
});

// 3️⃣ Parolni yangilash (POST)
router.post("/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 6)
            return res.status(400).send("Parol kamida 6 ta belgidan iborat bo‘lishi kerak");

        const hash = await bcrypt.hash(new_password, 10);

        await pool.query(
            `UPDATE users 
         SET password_hash = $1, password_changed_at = NOW(), must_change_password = FALSE
         WHERE id = $2`,
            [hash, id]
        );

        res.redirect("/admin/view");
    } catch (err) {
        console.error("Parolni yangilashda xato:", err);
        res.status(500).send("Server xatosi");
    }
});

router.get("/admin/view", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, login, role, is_active
         FROM users 
         WHERE role IN ('admin')
         ORDER BY role, login`
        );

        res.render("admin/admin", { users: rows });
    } catch (err) {
        console.error("Foydalanuvchilarni olishda xato:", err);
        res.status(500).send("Server xatosi");
    }
});

router.get("/admin/manager", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, login, role, is_active
         FROM users 
         WHERE role IN ('manager')
         ORDER BY role, login`
        );

        res.render("admin/manager", { users: rows });
    } catch (err) {
        console.error("Managerlarni olishda xato:", err);
        res.status(500).send("Server xatosi");
    }
});
// Talabani tyutorga biriktirish
router.get("/admin/manager-assign", requireRole("admin"), async (req, res) => {
    try {
      // Barcha managerlar
      const managers = (await pool.query(`
        SELECT id, login 
        FROM users 
        WHERE role = 'manager'
        ORDER BY login ASC
      `)).rows;
  
    // 2. Faqat hali biriktirilmagan guruhlar
    const guruhlar = (await pool.query(`
        SELECT DISTINCT guruh
        FROM umumiy
        WHERE guruh IS NOT NULL
          AND guruh <> ''
          AND guruh NOT IN (SELECT guruh FROM manager_guruh)
        ORDER BY guruh ASC
      `)).rows;
  
      // Biriktirilganlar ro‘yxati
      const assignments = (await pool.query(`
        SELECT 
          mg.id, 
          mg.guruh, 
          u.login
        FROM manager_guruh mg
        JOIN users u ON mg.manager_id = u.id
        ORDER BY u.login ASC
      `)).rows;
      res.render("admin/manager_assign", { managers, guruhlar, assignments });
    } catch (err) {
      console.error("Biriktirish sahifasida xato:", err);
      res.status(500).send("Server xatosi");
    }
  });

  router.post("/admin/manager-assign", requireRole("admin"), async (req, res) => {
    try {
      const { manager_id, guruh } = req.body;
  
      if (!manager_id || !guruh) {
        return res.redirect("/admin/manager-assign?err=1");
      }
  
      await pool.query(`
        INSERT INTO manager_guruh (manager_id, guruh)
        VALUES ($1, $2)
        ON CONFLICT (manager_id, guruh) DO NOTHING
      `, [manager_id, guruh]);
  
      res.redirect("/admin/manager-assign?ok=1");
    } catch (err) {
      console.error("Biriktirishda xato:", err);
      res.status(500).send("Server xatosi");
    }
  });

router.post("/admin/manager-assign/delete/:id", requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(`DELETE FROM manager_guruh WHERE id = $1`, [id]);
      res.redirect("/admin/manager-assign?deleted=1");
    } catch (err) {
      console.error("O‘chirishda xato:", err);
      res.status(500).send("Server xatosi");
    }
  });

// Talabani active / passive qilish
router.post("/admin/student/toggle/:id", requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
  
      // Avval joriy holatini olamiz
      const userResult = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [id]);
      if (userResult.rows.length === 0) {
        return res.status(404).send("Foydalanuvchi topilmadi");
      }
  
      const currentStatus = userResult.rows[0].is_active;
      const newStatus = !currentStatus;
  
      // Holatini almashtiramiz
      await pool.query(`UPDATE users SET is_active = $1 WHERE id = $2`, [newStatus, id]);
  
      // Admin yoki menejer sahifasiga qaytamiz
      res.redirect("/admin/student"); // foydalanuvchi shu sahifada qoladi
  
    } catch (err) {
      console.error("Toggle xatosi:", err);
      res.status(500).send("Server xatosi");
    }
  });

// Talabani o'chirish
router.post("/admin/student/delete/:id", requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
  
      // Avval tekshiramiz — bunday foydalanuvchi mavjudmi
      const checkUser = await pool.query(`SELECT * FROM users WHERE id = $1 AND role = 'student'`, [id]);
      if (checkUser.rows.length === 0) {
        return res.status(404).send("Talaba topilmadi yoki o‘chirish mumkin emas");
      }
  
      // O‘chirish
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  
      res.redirect("/admin/student"); // o‘sha sahifaga qaytadi
  
    } catch (err) {
      console.error("Talabani o‘chirishda xato:", err);
      res.status(500).send("Server xatosi");
    }
  });
  
  
  
  

// router.get("/admin/student", requireRole("admin"), async (req, res) => {
//     try {
//         const { rows } = await pool.query(`
// SELECT 
//   u.id, 
//   u.login, 
//   u.is_active,
//   o.guruh, 
//   o.familiya, 
//   o.ism,
//   o.sharif
// FROM users u
// LEFT JOIN umumiy o ON o.talaba_id = u.id
// WHERE u.role = 'student'
// ORDER BY o.familiya ASC;
//       `);
//         res.render("admin/student", { students: rows });
//     } catch (err) {
//         console.error("Xatolik:", err);
//         res.status(500).send("Server xatosi");
//     }
// });


// router.get("/admin/student", requireRole("admin"), async (req, res) => {
//     try {
//       const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
//       const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 25;
//       const sort = req.query.sort || "familiya";
//       const order = req.query.order === "desc" ? "DESC" : "ASC";
//       const search = req.query.search ? req.query.search.trim() : "";
//       const offset = (page - 1) * limit;
  
//       const allowedSortFields = ["familiya", "ism", "sharif", "guruh", "login"];
//       const sortField = allowedSortFields.includes(sort) ? sort : "familiya";
  
//       let whereClause = `WHERE u.role = 'student'`;
//       const params = [];
  
//       if (search) {
//         whereClause += ` AND (LOWER(o.familiya) LIKE LOWER($1) OR LOWER(o.ism) LIKE LOWER($1))`;
//         params.push(`%${search}%`);
//       }

//       const totalResult = await pool.query(`
//         SELECT COUNT(*) 
//         FROM users u 
//         LEFT JOIN umumiy o ON o.talaba_id = u.id 
//         ${whereClause}
//       `, params);
  
//       const totalStudents = parseInt(totalResult.rows[0].count);

//       const { rows } = await pool.query(`
//         SELECT 
//           u.id,
//           u.login,
//           u.is_active,
//           o.guruh,
//           o.familiya,
//           o.ism,
//           o.sharif
//         FROM users u
//         LEFT JOIN umumiy o ON o.talaba_id = u.id
//         ${whereClause}
//         ORDER BY ${sortField} ${order}
//         LIMIT $${params.length + 1} OFFSET $${params.length + 2}
//       `, [...params, limit, offset]);
  
//       const totalPages = Math.ceil(totalStudents / limit);
  
//       res.render("admin/student", {
//         students: rows,
//         currentPage: page,
//         totalPages,
//         totalStudents,
//         limit,
//         sort: sortField,
//         order,
//         search,
//         startIndex: offset
//       });
  
//     } catch (err) {
//       console.error("Pagination yoki qidiruv xatosi:", err);
//       res.status(500).send("Server xatosi");
//     }
//   });
  
router.get("/admin/student", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
      const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 25;
      const sort = req.query.sort || "familiya";
      const order = req.query.order === "desc" ? "DESC" : "ASC";
      const search = req.query.search ? req.query.search.trim() : "";
      const offset = (page - 1) * limit;
  
      const allowedSortFields = ["familiya", "ism", "sharif", "guruh", "login"];
      const sortField = allowedSortFields.includes(sort) ? sort : "familiya";
  
      // 🔍 Qidiruv: familiya, ism yoki guruh bo‘yicha
      let whereClause = `WHERE u.role = 'student'`;
      const params = [];
  
      if (search) {
        whereClause += ` AND (
          LOWER(o.familiya) LIKE LOWER($1)
          OR LOWER(o.ism) LIKE LOWER($1)
          OR LOWER(o.guruh) LIKE LOWER($1)
        )`;
        params.push(`%${search}%`);
      }
  
      // 🔹 Jami son
      const totalResult = await pool.query(`
        SELECT COUNT(*) 
        FROM users u 
        LEFT JOIN umumiy o ON o.talaba_id = u.id 
        ${whereClause}
      `, params);
      const totalStudents = parseInt(totalResult.rows[0].count);
  
      // 🔹 Ma’lumotlar
      const { rows } = await pool.query(`
        SELECT 
          u.id,
          u.login,
          u.is_active,
          o.guruh,
          o.familiya,
          o.ism,
          o.sharif
        FROM users u
        LEFT JOIN umumiy o ON o.talaba_id = u.id
        ${whereClause}
        ORDER BY ${sortField} ${order}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);
  
      const totalPages = Math.ceil(totalStudents / limit);
  
      res.render("admin/student", {
        students: rows,
        currentPage: page,
        totalPages,
        totalStudents,
        limit,
        sort: sortField,
        order,
        search,
        startIndex: offset
      });
    } catch (err) {
      console.error("Qidiruv yoki pagination xatosi:", err);
      res.status(500).send("Server xatosi");
    }
  });
  
  
  
  

/* =================== TALABA PROFILI KO‘RISH =================== */
router.get("/admin/student/:id", requireRole("admin"), checkProfileCompletion, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.profileStatus;
        const [
            umumiy,
            talim,
            tillar,
            qiziqishlari,
            yutuqlari,
            yashash,
            oilaviy,
            ijtimoiy,
            iqtidorli,
            moddiy,
            huquqbuzarlik,
        ] = await Promise.all([
            pool.query("SELECT * FROM umumiy WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM talim WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM til_bilish WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM qiziqishlari WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM yutuqlari WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM yashash_holati WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM oilaviy_holati WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM ijtimoiy_holati WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM iqtidorli WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM moddiy_yordam WHERE talaba_id = $1", [id]),
            pool.query("SELECT * FROM huquqbuzarlik WHERE talaba_id = $1", [id]),
        ]);

        res.render("admin/student_profile", {
            id,
            umumiy: umumiy.rows[0],
            talim: talim.rows,
            tillar: tillar.rows,
            profileStatus: status,   // ✅ shu qo‘shiladi
            allCompleted: req.allCompleted,
            user: req.session.user,  // layoutda ko‘rsatiladi
        });
    } catch (err) {
        console.error("Profil yuklash xatosi:", err);
        res.status(500).send("Server xatosi");
    }
});


// 📤 Excel yuklash
router.get("/admin/upload", requireAuth, requireRole("admin"), (req, res) => {
    res.render("admin/excel_upload");
});

// 📤 Excel import qilish (POST)
router.post(
    "/admin/upload/salom",
    requireAuth,
    requireRole("admin"),
    uploadExcel.single("excelFile"),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).send("Excel fayl topilmadi.");

            // 1️⃣ Excel faylni o‘qish
            const workbook = xlsx.read(req.file.buffer, { type: "buffer" });

            // 2️⃣ Birinchi varaqni JSON formatga o‘tkazish
            const sheetName = workbook.SheetNames[0];
            const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            console.log("📊 Yuklangan satrlar soni:", sheet.length);
            console.log("🧾 1-satr namuna:", sheet[0]);
            console.log("🧾 2-satr namuna:", sheet[1]);
            console.log("🧾 3-satr namuna:", sheet[2]);
            console.log("🧾 4-satr namuna:", sheet[3]);
            console.log("🧾 5-satr namuna:", sheet[4]);
            console.log("🧾 6-satr namuna:", sheet[5]);

            for (const row of sheet) {
                const login = row["Login"];
                const familiya = row["Familiya"];
                const ism = row["Ism"];
                const sharif = row["Sharif"];
                const viloyat = row["Viloyat"];
                const tuman = row["Tuman"];
                const manzil = row["Manzil"];
                const t_sana = row["Tug‘ilgan sana"];
                const telefon = row["Telefon"];
                const talim_turi = row["Ta’lim turi"];
                const kursi = row["Kursi"];
                const mutaxassislik = row["Mutaxassislik"];
                const talim_muas = row["Ta’lim muassasasi"];
                const kirgan_yil = row["Kirgan yili"];
                const tugatgan_yil = row["Tugatgan yili"];
                const til_nomi = row["Til"];
                const til_daraja = row["Daraja"];
                const yutuq_nomi = row["Yutuq nomi"];
                const yutuq_yili = row["Yutuq yili"];

                // 3️⃣ Foydalanuvchini topish yoki yaratish
                let user = await pool.query("SELECT id FROM users WHERE login = $1", [login]);
                let userId;

                if (user.rows.length === 0) {
                    const hash = await bcrypt.hash("123456", 10); // standart parol
                    const newUser = await pool.query(
                        `INSERT INTO users (login, password_hash, role, must_change_password)
                 VALUES ($1,$2,'student',TRUE) RETURNING id`,
                        [login, hash]
                    );
                    userId = newUser.rows[0].id;
                } else {
                    userId = user.rows[0].id;
                }

                // 4️⃣ UMUMIY jadvalga
                await pool.query(
                    `INSERT INTO umumiy (talaba_id, familiya, ism, sharif, viloyat, tuman, manzili, t_sana, telefon, talim_turi, kursi, mutaxassislik)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               ON CONFLICT (talaba_id) DO UPDATE SET familiya=$2, ism=$3, sharif=$4, updated_at=NOW()`,
                    [userId, familiya, ism, sharif, viloyat, tuman, manzil, t_sana, telefon, talim_turi, kursi, mutaxassislik]
                );

                // 5️⃣ TALIM jadvaliga
                await pool.query(
                    `INSERT INTO talim (talaba_id, tm_nomi, kirgan, tugatgan, mutaxassislik)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT DO NOTHING`,
                    [userId, talim_muas, kirgan_yil, tugatgan_yil, mutaxassislik]
                );

                // 6️⃣ TIL_BILISH jadvaliga
                await pool.query(
                    `INSERT INTO til_bilish (talaba_id, til_nomi, daraja)
               VALUES ($1,$2,$3)
               ON CONFLICT DO NOTHING`,
                    [userId, til_nomi, til_daraja]
                );

                // 7️⃣ YUTUQLAR jadvaliga
                await pool.query(
                    `INSERT INTO yutuqlari (talaba_id, yutuq_nomi, yutuq_yili)
               VALUES ($1,$2,$3)
               ON CONFLICT DO NOTHING`,
                    [userId, yutuq_nomi, yutuq_yili]
                );
            }


            // 3️⃣ Foydalanuvchiga qaytarish
            return res.json({
                success: true,
                rows: sheet.length,
                sample: sheet.slice(0, 10), // faqat dastlabki 5 qatorni ko‘rsatish
            });
        } catch (err) {
            console.error("❌ Excel o‘qishda xato:", err);
            return res.status(500).send("Server xatosi: " + err.message);
        }
    }
);

router.post(
    "/admin/upload",
    requireAuth,
    requireRole("admin"),
    uploadExcel.single("excelFile"),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).send("Excel fayl topilmadi.");

            const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
            const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            const sheet = allRows.slice(4);

            console.log("📊 Yuklangan satrlar soni:", sheet.length);
            console.log("🧾 1-satr namuna:", sheet[0]);
            console.log("🧾 2-satr namuna:", sheet[1]);
            console.log("🧾 3-satr namuna:", sheet[2]);
            console.log("🧾 4-satr namuna:", sheet[3]);
            console.log("🧾 5-satr namuna:", sheet[4]);
            console.log("🧾 6-satr namuna:", sheet[5]);

            let count = 0;

            for (const row of sheet) {
                const talaba_id = row["__EMPTY"];
                const fuqarolik = row["__EMPTY_1"];
                const jshshir = row["__EMPTY_2"];
                const pasport = row["__EMPTY_3"];
                const fio = row["__EMPTY_4"];
                const tugilgan_sana = row["__EMPTY_5"];
                const jinsi = row["__EMPTY_6"];
                const telefon = row["__EMPTY_7"];
                const otm = row["__EMPTY_8"];
                const talim_turi = row["__EMPTY_9"];
                const tolov_turi = row["__EMPTY_10"];
                const shakli = row["__EMPTY_11"];
                const shifr = row["__EMPTY_12"];
                const mutaxassislik = row["__EMPTY_13"];
                const kurs = row["__EMPTY_14"];
                const guruh = row["__EMPTY_15"];
                const davlat = row["__EMPTY_16"];
                const viloyat = row["__EMPTY_17"];
                const tuman = row["__EMPTY_18"];
                const manzil = row["__EMPTY_19"];
                const oilaviy_holat = row["__EMPTY_25"];
                const tyutor = row["__EMPTY_62"];
                const parol = row["__EMPTY_63"] ? row["__EMPTY_63"].toString() : "123456";

                //   Yashash holati
                const yashash_joyi = row["__EMPTY_24"];
                const yashash_manzil = row["__EMPTY_22"];
                // Ijtimoiy holatlar
                const ihyar = row["__EMPTY_26"];
                const ydaftari = row["__EMPTY_27"];
                const ayoldaftari = row["__EMPTY_28"];
                const temirdaftari = row["__EMPTY_29"];
                const imtiyozuqish = row["__EMPTY_30"];
                const hxizmat = row["__EMPTY_31"];
                const nafaqa = row["__EMPTY_32"];
                const ishrasmiy = row["__EMPTY_33"];
                const ishnorasmiy = row["__EMPTY_34"];
                const farzandli = row["__EMPTY_35"];
                const ota_onalik_mahrum = row["__EMPTY_36"];
                const m_uyi = row["__EMPTY_37"];
                const nogironligi = row["__EMPTY_38"];
                const n_toifalari = row["__EMPTY_39"];
                const yetimlik = row["__EMPTY_40"];
                // Iqtidorli
                const dmukofot = row["__EMPTY_41"];
                const knishon = row["__EMPTY_42"];
                const pstipendiya = row["__EMPTY_43"];
                const dstipendiya = row["__EMPTY_44"];
                const xstipendiya = row["__EMPTY_45"];
                const rsport = row["__EMPTY_46"];
                const xsport = row["__EMPTY_47"];
                const resfan = row["__EMPTY_48"];
                const xfan = row["__EMPTY_49"];
                const boshqayutuq = row["__EMPTY_50"];

                // Moddiy yordam
                const itopshirgan = row["__EMPTY_51"];
                const ixarajat = row["__EMPTY_52"];
                const tshartnoma = row["__EMPTY_53"];
                const itulov = row["__EMPTY_54"];
            
                // Huquqbuzarlik
                const notinch = row["__EMPTY_55"];
                const ytabiatli = row["__EMPTY_56"];
                const jiem = row["__EMPTY_57"];
                const probatsiya = row["__EMPTY_58"];
                const horderi = row["__EMPTY_59"];
                const jqasd = row["__EMPTY_60"];
                const mhuquqbuzarlik = row["__EMPTY_61"];

                // Bo‘sh satrlarni o‘tkazib yuboramiz
                if (!fio || !talaba_id) continue;

                // FIO bo‘lish
                const [familiya, ism, ...sharifQolgan] = fio.split(" ");
                const sharif = sharifQolgan.join(" ");
                const p_seriya = row["__EMPTY_3"]?.substring(0, 2).trim() || null;
                const p_number = row["__EMPTY_3"]?.substring(2).trim() || null;

                // 🔐 Foydalanuvchini tekshirish yoki yaratish
                let userId;
                const user = await pool.query("SELECT id FROM users WHERE login = $1", [talaba_id]);
                if (user.rows.length === 0) {
                    const hash = await bcrypt.hash(parol, 10);
                    const newUser = await pool.query(
                        `INSERT INTO users (login, password_hash, role, must_change_password)
               VALUES ($1,$2,'student',TRUE) RETURNING id`,
                        [talaba_id, hash]
                    );
                    userId = newUser.rows[0].id;
                } else {
                    userId = user.rows[0].id;
                }

                //   VILOYAT, SHAHAR, TUMAN
                // Exceldan kelgan matnlar
                const viloyatNomi = row["__EMPTY_17"]?.trim() || null;
                const tumanNomi = row["__EMPTY_18"]?.trim() || null;
                const kursText = row["__EMPTY_14"]?.toString().trim() || null;
                const kursi = kursText ? parseInt(kursText.replace(/\D/g, ""), 10) : null;
                let viloyat_id = null;
                let tuman_id = null;

                // Viloyat ID sini topish
                if (viloyatNomi) {
                    const v = await pool.query(
                        "SELECT id FROM viloyatlar WHERE lower(nomi) = lower($1) LIMIT 1",
                        [viloyatNomi]
                    );
                    if (v.rows.length > 0) viloyat_id = v.rows[0].id;
                }

                // Tuman ID sini topish
                if (tumanNomi) {
                    const t = await pool.query(
                        "SELECT id FROM tumanlar WHERE lower(nomi) = lower($1) LIMIT 1",
                        [tumanNomi]
                    );
                    if (t.rows.length > 0) tuman_id = t.rows[0].id;
                }

                // Yashash holati
                const yashashViloyat = row["__EMPTY_20"]?.trim() || null;
                const yashashTuman = row["__EMPTY_21"]?.trim() || null;
                let Yashashviloyat_id = null;
                let Yashashtuman_id = null;

                if (yashashViloyat) {
                    const v = await pool.query(
                        "SELECT id FROM viloyatlar WHERE lower(nomi) = lower($1) LIMIT 1",
                        [yashashViloyat]
                    );
                    if (v.rows.length > 0) Yashashviloyat_id = v.rows[0].id;
                }

                if (yashashTuman) {
                    const t = await pool.query(
                        "SELECT id FROM tumanlar WHERE lower(nomi) = lower($1) LIMIT 1",
                        [yashashTuman]
                    );
                    if (t.rows.length > 0) Yashashtuman_id = t.rows[0].id;
                }

                function toBool(value) {
                    if (typeof value === "string") {
                        const v = value.trim().toLowerCase();
                        if (v === "ha") return true;
                        if (v === "yo'q" || v === "yoq" || v === "yo‘q") return false;
                    }
                    return null; // agar bo‘sh bo‘lsa
                }

                function toBooleanFromText(value) {
                    if (!value) return false;
                  
                    const v = value.toLowerCase().trim();
                  
                    // ijobiy qiymatlar:
                    if (v.includes("topshirgan") || v.includes("qoplab berilgan") || v.includes("to‘langan") || v.includes("tolangan") || v.includes("berilgan"))
                      return true;
                  
                    // manfiy qiymatlar:
                    if (v.includes("topshirmagan") || v.includes("qoplab berilmagan") || v.includes("to‘lanmagan") || v.includes("berilmagan"))
                      return false;
                  
                    return false; // default
                  }


                /* 🧩 umumiy */
                await pool.query(
                    `INSERT INTO umumiy (talaba_id, familiya, ism, sharif, viloyat , tuman, manzili, t_sana, telefon, p_seriya , p_number, jshshir, talim_turi, kursi, tolov_turi, talim_shakli, mutaxassislik, shifr, guruh)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (talaba_id)
             DO UPDATE SET familiya=$2, ism=$3, sharif=$4, viloyat=$5, tuman=$6, manzili=$7, t_sana=$8, telefon=$9, p_seriya=$10, p_number=$11, jshshir=$12, talim_turi=$13, kursi=$14, tolov_turi=$15, talim_shakli=$16, mutaxassislik=$17, shifr=$18, guruh=$19`,
                    [userId, familiya, ism, sharif, viloyat_id, tuman_id, manzil, tugilgan_sana, telefon, p_seriya, p_number, jshshir, talim_turi, kursi, tolov_turi, shakli, mutaxassislik, shifr, guruh]
                );

                /* 🏠 yashash_holati */
                await pool.query(
                    `INSERT INTO yashash_holati (talaba_id, yashash_joyi, viloyat_id, tuman_id, manzili)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (talaba_id) DO UPDATE SET yashash_joyi=$2, viloyat_id=$3, tuman_id=$4, manzili=$5`,
                    [userId, yashash_joyi, Yashashviloyat_id, Yashashtuman_id, yashash_manzil]
                );

                /* 👨‍👩‍👧 oilaviy_holati */
                await pool.query(
                    `INSERT INTO oilaviy_holati (talaba_id, jinsi, oilaviy_holat)
             VALUES ($1, $2, $3)
             ON CONFLICT (talaba_id)
             DO UPDATE SET
               jinsi = EXCLUDED.jinsi,
               oilaviy_holat = EXCLUDED.oilaviy_holat`,
                    [userId, jinsi, oilaviy_holat]
                );

                /* 🎓 talim */
                //   await pool.query(
                //     `INSERT INTO talim (talaba_id, tm_nomi, kirgan, tugatgan, mutaxassislik)
                //      VALUES ($1,$2,$3,$4,$5)
                //      ON CONFLICT (talaba_id) DO UPDATE SET tm_nomi=$2, kirgan=$3, tugatgan=$4, mutaxassislik=$7`,
                //     [userId, otm, talim_turi, tolov_turi, shakli, shifr, mutaxassislik, kurs]
                //   );

                /* 👥 ijtimoiy_holati */
                await pool.query(
                    `INSERT INTO ijtimoiy_holati (talaba_id, ihyar, ydaftari, ayoldaftari, temirdaftari, imtiyozuqish, hxizmat, nafaqa, ishrasmiy, ishnorasmiy, farzandli, ota_onalik_mahrum, m_uyi, nogironligi, n_toifalari, yetimlik)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (talaba_id)
             DO UPDATE SET ihyar=$2, ydaftari=$3, ayoldaftari=$4, temirdaftari=$5, imtiyozuqish=$6, hxizmat=$7, nafaqa=$8, ishrasmiy=$9, ishnorasmiy=$10, farzandli=$11, ota_onalik_mahrum=$12, m_uyi=$13, nogironligi=$14, n_toifalari=$15, yetimlik=$16`,
                    [
                        userId,
                        toBool(ihyar), 
                        toBool(ydaftari), 
                        toBool(ayoldaftari), 
                        toBool(temirdaftari), 
                        toBool(imtiyozuqish), 
                        toBool(hxizmat), 
                        toBool(nafaqa), 
                        toBool(ishrasmiy), 
                        toBool(ishnorasmiy), 
                        toBool(farzandli), 
                        toBool(ota_onalik_mahrum), 
                        toBool(m_uyi), 
                        toBool(nogironligi), 
                        n_toifalari, 
                        yetimlik
                    ]
                );

                /* 🏅 iqtidorli */
                await pool.query(
                    `INSERT INTO iqtidorli (talaba_id, dmukofot, knishon, pstipendiya, dstipendiya, xstipendiya, rsport, xsport, resfan, xfan, boshqayutuq)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (talaba_id)
             DO UPDATE SET dmukofot=$2, knishon=$3, pstipendiya=$4, dstipendiya=$5, xstipendiya=$6, rsport=$7, xsport=$8, resfan=$9, xfan=$10, boshqayutuq=$11`,
                    [
                        userId,
                        toBool(dmukofot), 
                        toBool(knishon), 
                        toBool(pstipendiya), 
                        toBool(dstipendiya), 
                        toBool(xstipendiya), 
                        toBool(rsport), 
                        toBool(xsport), 
                        toBool(resfan), 
                        toBool(xfan), 
                        toBool(boshqayutuq)
                    ]
                );

                /* 💸 moddiy_yordam */
                await pool.query(
                    `INSERT INTO moddiy_yordam (talaba_id, itopshirgan, ixarajat, tshartnoma, itulov)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (talaba_id)
             DO UPDATE SET itopshirgan=$2, ixarajat=$3, tshartnoma=$4, itulov=$5`,
                    [userId, 
                        toBooleanFromText(itopshirgan), 
                        toBooleanFromText(ixarajat), 
                        toBooleanFromText(tshartnoma), 
                        toBooleanFromText(itulov)
                    ]
                );

                /* ⚠️ huquqbuzarlik */
                await pool.query(
                    `INSERT INTO huquqbuzarlik (talaba_id, notinch, ytabiatli, jiem, probatsiya, horderi, jqasd, mhuquqbuzarlik)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (talaba_id)
             DO UPDATE SET notinch=$2, ytabiatli=$3, jiem=$4, probatsiya=$5, horderi=$6, jqasd=$7, mhuquqbuzarlik=$8`,
                    [userId, 
                        toBool(notinch), 
                        toBool(ytabiatli), 
                        toBool(jiem), 
                        toBool(probatsiya), 
                        toBool(horderi), 
                        toBool(jqasd), 
                        toBool(mhuquqbuzarlik)
                    ]
                );

                count++;
            }

            res.json({
                success: true,
                message: `✅ ${count} ta talaba ma’lumoti bazaga muvaffaqiyatli joylandi.`,
            });
        } catch (err) {
            console.error("❌ Excel import xatosi:", err);
            res.status(500).send("Server xatosi: " + err.message);
        }
    }
);










module.exports = router;