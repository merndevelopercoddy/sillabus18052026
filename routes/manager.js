// routes/dashboard.js (CommonJS)
// console.log("LOADED HELPERS:", hbsHelpers);
const express = require("express");
const {
  requireAuth,
  forceChangePassword,
  requireRole,
} = require("../middleware/auth");
const checkProfileCompletion = require("../middleware/checkProfileCompletion");
const router = express.Router();
const multer = require("multer");
const puppeteer = require("puppeteer");
// const hbs = require("handlebars");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
// ============ Multer rasm yuklash sozlamalari ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads")); // public/uploads papkaga saqlanadi
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
router.get(
  "/manager/dashboard",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  (req, res) => {
    if (
      req.session.user.role !== "manager" &&
      req.session.user.role !== "admin"
    ) {
      return res.status(403).send("Ruxsat yo‘q");
    }
    res.render("manager/dashboard");
  },
);

// Tashkilot qo'shish
router.post(
  "/manager/tashkilot/add",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  upload.single("logo"),
  async (req, res) => {
    try {
      // const talaba_id = req.session.user.id;
      const { tashkilot_nomi, masul, short_name } = req.body;
      const logo = req.file ? req.file.filename : null;
      const query = `
        INSERT INTO tashkilot (
          tashkilot_nomi, logo, masul, short_name
        )
        VALUES ($1,$2,$3,$4)
        RETURNING *;
      `;
      const values = [tashkilot_nomi, logo, masul, short_name];

      const { rows } = await pool.query(query, values);
      // req.session.hasUmumiy = true;
      //   res.json({ success: true, data: rows[0] });
      res.redirect("/manager/tashkilot");
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, message: "Server xatosi" });
    }
  },
);
// Tashkilot ko'rsatish
router.get(
  "/manager/tashkilot",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");

      const { rows } = await pool.query("SELECT * FROM tashkilot");
      res.render("manager/tashkilot", {
        data: rows[0] || null,
      });
    } catch (err) {
      console.error("xatosi:", err);
      res.status(500).send("Server xatosi");
    }
  },
);
// Tahrirlash GET
router.get(
  "/manager/tashkilot/:id",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");
      const { id } = req.params;
      const { rows } = await pool.query("SELECT * FROM tashkilot WHERE id=$1", [
        id,
      ]);

      if (rows.length === 0) {
        return res.redirect("/manager/tashkilot"); // maʼlumot bo‘lmasa, qo‘shish formaga qaytarish
      }

      res.render("manager/tashkilot_edit", { data: rows[0] });
    } catch (err) {
      console.error("GET /manager/tashkilot/edit xatosi:", err);
      res.status(500).send("Server xatosi");
    }
  },
);

// Tahrirlash POST
router.post(
  "/manager/tashkilot/:id",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  upload.single("logo"),
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");
      const { id } = req.params;

      const { tashkilot_nomi, masul, short_name } = req.body;

      let newRasm = req.file ? req.file.filename : null;

      // Agar yangi rasm bo‘lsa, eski faylni o‘chirish
      if (newRasm) {
        const oldRes = await pool.query(
          "SELECT logo FROM tashkilot WHERE id = $1",
          [id],
        );

        if (oldRes.rows.length > 0 && oldRes.rows[0].logo) {
          const oldFile = path.join(
            __dirname,
            "./../public/uploads",
            oldRes.rows[0].logo,
          );
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile); // eski faylni o‘chirish
          }
        }
      }

      const query = `
        UPDATE tashkilot SET
          tashkilot_nomi = $1,
          logo = COALESCE($2, logo),
          masul = $3,
          short_name = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *;
      `;

      const values = [tashkilot_nomi, newRasm, masul, short_name, id];

      const { rows } = await pool.query(query, values);
      // req.session.hasUmumiy = true;
      if (rows.length === 0) {
        return res.redirect("/manager/tashkilot");
      }

      return res.redirect("/manager/tashkilot");
    } catch (err) {
      console.error("POST /manager/tashkilot/edit xatosi:", err);
      res.status(500).send("Server xatosi");
    }
  },
);

// Yonalish view
router.get(
  "/manager/yonalish",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const { rows } = await pool.query(
        "SELECT * FROM yonalish ORDER BY id DESC",
      );

      return res.render("manager/yonalish", {
        data: rows || [],
      });
    } catch (err) {
      console.error("xatosi:", err.message);
      req.flash("error", "Sahifani yuklashda xatolik yuz berdi.");
      return res.redirect("/manager/dashboard");
    }
  },
);
// yonalish add
router.post(
  "/manager/yonalish/add",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { yonalish_shifri, yonalish_nomi } = req.body;

      const shifr = yonalish_shifri?.trim();
      const nomi = yonalish_nomi?.trim();

      if (!nomi) {
        req.flash("error", "Barcha maydonlarni to'ldiring.");
        return res.redirect("/manager/yonalish");
      }

      const query = `
        INSERT INTO yonalish (yonalish_shifri, yonalish_nomi)
        VALUES ($1, $2)
        RETURNING *;
      `;

      await pool.query(query, [shifr, nomi]);
      req.flash("success", "Muvaffaqiyatli saqlandi.");
      return req.session.save(() => res.redirect("/manager/yonalish"));
      // return res.redirect("/manager/yonalish");
    } catch (err) {
      console.error("xatosi:", err.message);

      if (err.code === "23505") {
        req.flash("error", "Bu ta'lim yo‘nalishi shifri avval kiritilgan.");
        return req.session.save(() => res.redirect("/manager/yonalish"));
      }

      req.flash("error", "Server xatosi yuz berdi.");
      return res.redirect("/manager/yonalish");
    }
  },
);
// yonalish edit
router.get(
  "/manager/yonalish/:id",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");

      const { id } = req.params;

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const result = await pool.query("SELECT * FROM yonalish WHERE id = $1", [
        id,
      ]);

      if (result.rows.length === 0) {
        req.flash("error", "Bunday ta'lim yo'nalishi topilmadi.");
        return res.redirect("/manager/yonalish");
      }

      return res.render("manager/yonalish_edit", {
        item: result.rows[0],
      });
    } catch (err) {
      console.error("Tahrirlash sahifasini ochishda xatolik:", err.message);
      req.flash("error", "Sahifani yuklashda xatolik yuz berdi.");
      return res.redirect("/manager/yonalish");
    }
  },
);
// yonalish Post Edit
router.post(
  "/manager/yonalish/:id/edit",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { yonalish_shifri, yonalish_nomi } = req.body;

      const shifr = yonalish_shifri?.trim();
      const nomi = yonalish_nomi?.trim();

      if (!nomi) {
        req.flash("error", "Barcha maydonlarni to'ldiring.");
        return res.redirect(`/manager/yonalish/${id}`);
      }

      const check = await pool.query("SELECT * FROM yonalish WHERE id = $1", [
        id,
      ]);

      if (check.rows.length === 0) {
        req.flash("error", "Tahrirlanadigan yo'nalish topilmadi.");
        return res.redirect("/manager/yonalish");
      }

      await pool.query(
        `
        UPDATE yonalish
        SET yonalish_shifri = $1,
            yonalish_nomi = $2,
            updated_at = NOW()
        WHERE id = $3
        `,
        [shifr, nomi, id],
      );

      req.flash("success", "Ta'lim yo'nalishi muvaffaqiyatli yangilandi.");
      return req.session.save(() => res.redirect("/manager/yonalish"));
    } catch (err) {
      console.error("Yo'nalishni yangilashda xatolik:", err.message);

      const { id } = req.params;
      const shifr = req.body.yonalish_shifri?.trim();

      if (err.code === "23505") {
        req.flash(
          "error",
          `Bu ta'lim yo'nalishi shifri (${shifr}) allaqachon mavjud.`,
        );
        return res.redirect(`/manager/yonalish/${id}`);
      }

      req.flash("error", "Yangilashda server xatosi yuz berdi.");
      return res.redirect(`/manager/yonalish/${id}`);
    }
  },
);
// Yonalish delete
router.post(
  "/manager/yonalish/:id/delete",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const check = await pool.query("SELECT * FROM yonalish WHERE id = $1", [
        id,
      ]);

      if (check.rows.length === 0) {
        req.flash("error", "O'chiriladigan ta'lim yo'nalishi topilmadi.");
        return res.redirect("/manager/yonalish");
      }

      await pool.query("DELETE FROM yonalish WHERE id = $1", [id]);

      req.flash("success", "Ta'lim yo'nalishi muvaffaqiyatli o'chirildi.");
      return res.redirect("/manager/yonalish");
    } catch (err) {
      console.error("Yo'nalishni o'chirishda xatolik:", err.message);

      if (err.code === "23503") {
        req.flash(
          "error",
          "Bu yo'nalish boshqa ma'lumotlar bilan bog'langanligi sababli o'chirib bo'lmaydi.",
        );
        return res.redirect("/manager/yonalish");
      }

      req.flash("error", "O'chirishda server xatosi yuz berdi.");
      return res.redirect("/manager/yonalish");
    }
  },
);

// Fanlar View
router.get(
  "/manager/fanlar",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      if (!req.session.user) return res.redirect("/login");

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const [fanlarRes, yonalishRes, kafedraRes] = await Promise.all([
        pool.query(`
          SELECT f.*, k.nomi AS kafedra_nomi
          FROM fanlar f
          LEFT JOIN kafedralar k ON k.id = f.kafedra_id
          ORDER BY f.f_nomi ASC
        `),
        pool.query("SELECT id, yonalish_shifri, yonalish_nomi FROM yonalish ORDER BY yonalish_nomi ASC"),
        pool.query("SELECT id, nomi FROM kafedralar ORDER BY nomi"),
      ]);

      return res.render("manager/fanlar", {
        data: fanlarRes.rows || [],
        yonalishlar: yonalishRes.rows || [],
        kafedralar: kafedraRes.rows || [],
      });
    } catch (err) {
      console.error("xatosi:", err.message);
      req.flash("error", "Sahifani yuklashda xatolik yuz berdi.");
      return res.redirect("/manager/dashboard");
    }
  },
);
// Fan qo'shish
router.post(
  "/manager/fanlar/add",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      let {
        f_nomi, fan_kodi, grade, davomiyligi, semestr,
        t_shakli, ects, auditoriya_soat, mustaqil_soat, t_yunalish, kafedra_id,
      } = req.body;

      f_nomi = f_nomi?.trim();
      fan_kodi = fan_kodi?.trim();
      grade = grade?.trim();
      t_shakli = t_shakli?.trim();
      kafedra_id = kafedra_id || null;

      if (!f_nomi || !fan_kodi || !grade || !davomiyligi || !t_shakli || !ects) {
        req.flash("error", "Barcha majburiy maydonlarni to’ldiring.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      if (!semestr) {
        req.flash("error", "Kamida bitta semestr tanlang.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      if (!t_yunalish) {
        req.flash("error", "Kamida bitta ta’lim yo’nalishini tanlang.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      if (!Array.isArray(semestr)) semestr = [semestr];
      if (!Array.isArray(t_yunalish)) t_yunalish = [t_yunalish];

      await pool.query(
        `INSERT INTO fanlar
          (f_nomi, fan_kodi, grade, davomiyligi, semestr, t_shakli, ects, auditoriya_soat, mustaqil_soat, t_yunalish, kafedra_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [f_nomi, fan_kodi, grade, Number(davomiyligi), semestr, t_shakli,
         Number(ects), Number(auditoriya_soat || 0), Number(mustaqil_soat || 0), t_yunalish, kafedra_id]
      );

      req.flash("success", "Fan muvaffaqiyatli qo‘shildi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    } catch (err) {
      console.error("Fan qo‘shishda xatolik:", err.message);

      if (err.code === "23505") {
        req.flash("error", "Bu fan kodi avval kiritilgan.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      req.flash("error", "Fan qo‘shishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    }
  }
);
// Edit Get route
router.get(
  "/manager/fanlar/:id",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [fanResult, yonalishResult, kafedraResult] = await Promise.all([
        pool.query("SELECT * FROM fanlar WHERE id = $1", [id]),
        pool.query("SELECT id, yonalish_shifri, yonalish_nomi FROM yonalish ORDER BY yonalish_nomi ASC"),
        pool.query("SELECT id, nomi FROM kafedralar ORDER BY nomi"),
      ]);

      if (fanResult.rows.length === 0) {
        req.flash("error", "Fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      return res.render("manager/fan_edit", {
        fan: fanResult.rows[0],
        yonalishlar: yonalishResult.rows || [],
        kafedralar: kafedraResult.rows || [],
      });
    } catch (err) {
      console.error("Fan tahrirlash sahifasida xatolik:", err.message);
      req.flash("error", "Fan ma’lumotlarini yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    }
  }
);
// Tahrirlash route
router.post(
  "/manager/fanlar/:id/update",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      let {
        f_nomi,
        fan_kodi,
        grade,
        davomiyligi,
        semestr,
        t_shakli,
        ects,
        auditoriya_soat,
        mustaqil_soat,
        t_yunalish,
      } = req.body;

      f_nomi = f_nomi?.trim();
      fan_kodi = fan_kodi?.trim();
      grade = grade?.trim();
      t_shakli = t_shakli?.trim();

      if (!semestr) {
        req.flash("error", "Kamida bitta semestr tanlang.");
        return req.session.save(() => res.redirect(`/manager/fanlar/${id}`));
      }

      if (!t_yunalish) {
        req.flash("error", "Kamida bitta ta’lim yo‘nalishini tanlang.");
        return req.session.save(() => res.redirect(`/manager/fanlar/${id}`));
      }

      if (!Array.isArray(semestr)) semestr = [semestr];
      if (!Array.isArray(t_yunalish)) t_yunalish = [t_yunalish];

      const kafedra_id = req.body.kafedra_id || null;

      await pool.query(
        `UPDATE fanlar
         SET f_nomi=$1, fan_kodi=$2, grade=$3, davomiyligi=$4, semestr=$5,
             t_shakli=$6, ects=$7, auditoriya_soat=$8, mustaqil_soat=$9,
             t_yunalish=$10, kafedra_id=$11, updated_at=CURRENT_TIMESTAMP
         WHERE id=$12`,
        [f_nomi, fan_kodi, grade, Number(davomiyligi), semestr, t_shakli,
         Number(ects), Number(auditoriya_soat || 0), Number(mustaqil_soat || 0),
         t_yunalish, kafedra_id, id]
      );

      req.flash("success", "Fan muvaffaqiyatli yangilandi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    } catch (err) {
      console.error("Fan yangilashda xatolik:", err.message);
      req.flash("error", "Fan yangilashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${req.params.id}`));
    }
  }
);
// Ochirish route
router.post(
  "/manager/fanlar/:id/delete",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT id FROM fanlar WHERE id = $1",
        [id]
      );

      if (check.rows.length === 0) {
        req.flash("error", "O‘chiriladigan fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      await pool.query(
        "DELETE FROM fanlar WHERE id = $1",
        [id]
      );

      req.flash("success", "Fan muvaffaqiyatli o‘chirildi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    } catch (err) {
      console.error("Fan o‘chirishda xatolik:", err.message);

      if (err.code === "23503") {
        req.flash("error", "Bu fan boshqa ma’lumotlar bilan bog‘langanligi sababli o‘chirib bo‘lmaydi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      req.flash("error", "Fan o‘chirishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    }
  }
);

// ===============================
// DARS REJASI SAHIFASI
// ===============================

// Ro'yxat + qo'shish formasi
router.get(
  "/manager/fanlar/:fan_id/dars-reja",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      const { fan_id } = req.params;

      const fanResult = await pool.query("SELECT * FROM fanlar WHERE id = $1", [fan_id]);
      if (fanResult.rows.length === 0) {
        req.flash("error", "Fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      const { rows } = await pool.query(
        "SELECT * FROM dars_reja WHERE fan_id = $1 ORDER BY tartib_raqam ASC",
        [fan_id]
      );

      return res.render("manager/dars_reja", {
        fan: fanResult.rows[0],
        data: rows || [],
      });
    } catch (err) {
      console.error("Dars rejasi xatosi:", err.message);
      req.flash("error", "Sahifani yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    }
  }
);

// Qo'shish
router.post(
  "/manager/fanlar/:fan_id/dars-reja/add",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { fan_id } = req.params;
      let { tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat } = req.body;

      mavzu = mavzu?.trim();
      if (!mavzu || !tartib_raqam) {
        req.flash("error", "Mavzu va tartib raqamini kiriting.");
        return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja`));
      }

      let mazmunArray = [];
      if (dars_mazmuni) {
        mazmunArray = (Array.isArray(dars_mazmuni) ? dars_mazmuni : [dars_mazmuni])
          .map(s => s.trim()).filter(Boolean);
      }

      await pool.query(
        `INSERT INTO dars_reja (fan_id, tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [fan_id, Number(tartib_raqam), mavzu, mazmunArray, Number(maruza_soat || 2), Number(amaliy_soat || 2)]
      );

      req.flash("success", "Dars rejasi muvaffaqiyatli qo'shildi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja`));
    } catch (err) {
      console.error("Dars rejasi qo'shish xatosi:", err.message);
      req.flash("error", "Qo'shishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${req.params.fan_id}/dars-reja`));
    }
  }
);

// Tahrirlash GET
router.get(
  "/manager/fanlar/:fan_id/dars-reja/:id/edit",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      const { fan_id, id } = req.params;

      const fanResult = await pool.query("SELECT * FROM fanlar WHERE id = $1", [fan_id]);
      if (fanResult.rows.length === 0) {
        req.flash("error", "Fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      const result = await pool.query(
        "SELECT * FROM dars_reja WHERE id = $1 AND fan_id = $2",
        [id, fan_id]
      );
      if (result.rows.length === 0) {
        req.flash("error", "Dars rejasi topilmadi.");
        return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja`));
      }

      return res.render("manager/dars_reja_edit", {
        fan: fanResult.rows[0],
        item: result.rows[0],
      });
    } catch (err) {
      console.error("Dars rejasi edit xatosi:", err.message);
      req.flash("error", "Sahifani yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${req.params.fan_id}/dars-reja`));
    }
  }
);

// Tahrirlash POST
router.post(
  "/manager/fanlar/:fan_id/dars-reja/:id/update",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { fan_id, id } = req.params;
      let { tartib_raqam, mavzu, dars_mazmuni, maruza_soat, amaliy_soat } = req.body;

      mavzu = mavzu?.trim();
      if (!mavzu || !tartib_raqam) {
        req.flash("error", "Mavzu va tartib raqamini kiriting.");
        return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja/${id}/edit`));
      }

      let mazmunArray = [];
      if (dars_mazmuni) {
        mazmunArray = (Array.isArray(dars_mazmuni) ? dars_mazmuni : [dars_mazmuni])
          .map(s => s.trim()).filter(Boolean);
      }

      await pool.query(
        `UPDATE dars_reja SET
           tartib_raqam = $1,
           mavzu = $2,
           dars_mazmuni = $3,
           maruza_soat = $4,
           amaliy_soat = $5,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND fan_id = $7`,
        [Number(tartib_raqam), mavzu, mazmunArray, Number(maruza_soat || 2), Number(amaliy_soat || 2), id, fan_id]
      );

      req.flash("success", "Dars rejasi muvaffaqiyatli yangilandi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja`));
    } catch (err) {
      console.error("Dars rejasi update xatosi:", err.message);
      req.flash("error", "Yangilashda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${req.params.fan_id}/dars-reja/${req.params.id}/edit`));
    }
  }
);

// O'chirish
router.post(
  "/manager/fanlar/:fan_id/dars-reja/:id/delete",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { fan_id, id } = req.params;

      await pool.query("DELETE FROM dars_reja WHERE id = $1 AND fan_id = $2", [id, fan_id]);

      req.flash("success", "Dars rejasi muvaffaqiyatli o'chirildi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${fan_id}/dars-reja`));
    } catch (err) {
      console.error("Dars rejasi delete xatosi:", err.message);
      req.flash("error", "O'chirishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/fanlar/${req.params.fan_id}/dars-reja`));
    }
  }
);

// ===============================
// ADABIYOTLAR SAHIFASI
// ===============================
// router.get(
//   "/manager/adabiyotlar",
//   requireRole("manager", "oquv_bolimi", "superadmin"),
//   requireAuth,
//   forceChangePassword,
//   async (req, res) => {
//     try {
//       const adabiyotlarResult = await pool.query(`
//         SELECT
//           a.id,
//           a.manba_turi,
//           a.avtor,
//           a.adabiyot_nomi,
//           a.yili,
//           a.sahifa_soni,
//           a.url,
//           a.created_at,
//           a.updated_at,
//           COALESCE(
//             json_agg(
//               json_build_object(
//                 'fan_id', f.id,
//                 'fan_kodi', f.fan_kodi,
//                 'fan_nomi', f.f_nomi,
//                 'turi', fa.turi
//               )
//             ) FILTER (WHERE f.id IS NOT NULL),
//             '[]'
//           ) AS biriktirilgan_fanlar
//         FROM adabiyotlar a
//         LEFT JOIN fan_adabiyotlari fa ON fa.adabiyot_id = a.id
//         LEFT JOIN fanlar f ON f.id = fa.fan_id
//         GROUP BY a.id
//         ORDER BY a.id DESC
//       `);

//       const fanlarResult = await pool.query(`
//         SELECT id, f_nomi, fan_kodi
//         FROM fanlar
//         ORDER BY f_nomi ASC
//       `);

//       return res.render("manager/adabiyotlar", {
//         adabiyotlar: adabiyotlarResult.rows || [],
//         fanlar: fanlarResult.rows || [],
//       });
//     } catch (err) {
//       console.error("Adabiyotlar sahifasi xatosi:", err.message);
//       req.flash("error", "Adabiyotlar sahifasini yuklashda xatolik yuz berdi.");
//       return req.session.save(() => res.redirect("/manager/dashboard"));
//     }
//   }
// );
router.get(
  "/manager/adabiyotlar",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      let {
        search = "",
        manba_turi = "",
        fan_id = "",
        turi = "",
        page = 1,
        limit = 10,
      } = req.query;

      page = Number(page) || 1;
      limit = Number(limit) || 10;
      const offset = (page - 1) * limit;

      const conditions = [];
      const values = [];

      if (search) {
        values.push(`%${search}%`);
        conditions.push(`
          (
            a.avtor ILIKE $${values.length}
            OR a.adabiyot_nomi ILIKE $${values.length}
            OR a.url ILIKE $${values.length}
          )
        `);
      }

      if (manba_turi) {
        values.push(manba_turi);
        conditions.push(`a.manba_turi = $${values.length}`);
      }

      if (fan_id) {
        values.push(fan_id);
        conditions.push(`EXISTS (
          SELECT 1 
          FROM fan_adabiyotlari fa2 
          WHERE fa2.adabiyot_id = a.id 
          AND fa2.fan_id = $${values.length}
        )`);
      }

      if (turi) {
        values.push(turi);
        conditions.push(`EXISTS (
          SELECT 1 
          FROM fan_adabiyotlari fa3 
          WHERE fa3.adabiyot_id = a.id 
          AND fa3.turi = $${values.length}
        )`);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const countResult = await pool.query(
        `
        SELECT COUNT(DISTINCT a.id) AS total
        FROM adabiyotlar a
        ${whereClause}
        `,
        values
      );

      const totalItems = Number(countResult.rows[0].total);
      const totalPages = Math.ceil(totalItems / limit);

      const adabiyotlarResult = await pool.query(
        `
        SELECT
          a.id,
          a.manba_turi,
          a.avtor,
          a.adabiyot_nomi,
          a.yili,
          a.sahifa_soni,
          a.url,
          a.created_at,
          a.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'fan_id', f.id,
                'fan_kodi', f.fan_kodi,
                'fan_nomi', f.f_nomi,
                'turi', fa.turi
              )
            ) FILTER (WHERE f.id IS NOT NULL),
            '[]'
          ) AS biriktirilgan_fanlar
        FROM adabiyotlar a
        LEFT JOIN fan_adabiyotlari fa ON fa.adabiyot_id = a.id
        LEFT JOIN fanlar f ON f.id = fa.fan_id
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
        `,
        [...values, limit, offset]
      );

      const fanlarResult = await pool.query(`
        SELECT id, f_nomi, fan_kodi
        FROM fanlar
        ORDER BY f_nomi ASC
      `);

      return res.render("manager/adabiyotlar", {
        adabiyotlar: adabiyotlarResult.rows || [],
        fanlar: fanlarResult.rows || [],

        search,
        manba_turi,
        fan_id,
        turi,

        currentPage: page,
        limit,
        totalPages,
        totalItems,
      });
    } catch (err) {
      console.error("Adabiyotlar sahifasi xatosi:", err.message);
      req.flash("error", "Adabiyotlar sahifasini yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/dashboard"));
    }
  }
);
// ===============================
// ADABIYOT QO‘SHISH
// ===============================
router.post(
  "/manager/adabiyotlar/add",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      let {
        manba_turi,
        avtor,
        adabiyot_nomi,
        yili,
        sahifa_soni,
        url,
      } = req.body;

      manba_turi = manba_turi?.trim();
      avtor = avtor?.trim() || null;
      adabiyot_nomi = adabiyot_nomi?.trim() || null;
      url = url?.trim() || null;
      yili = yili ? Number(yili) : null;
      sahifa_soni = sahifa_soni ? Number(sahifa_soni) : null;

      if (!manba_turi) {
        req.flash("error", "Manba turini tanlang.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      if (manba_turi === "internet" && !url) {
        req.flash("error", "Internet manzilini kiriting.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      if (manba_turi === "kitob" && (!avtor || !adabiyot_nomi)) {
        req.flash("error", "Kitob uchun avtor va adabiyot nomini kiriting.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      await pool.query(
        `
        INSERT INTO adabiyotlar (
          manba_turi,
          avtor,
          adabiyot_nomi,
          yili,
          sahifa_soni,
          url
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url]
      );

      req.flash("success", "Adabiyot muvaffaqiyatli qo‘shildi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    } catch (err) {
      console.error("Adabiyot qo‘shish xatosi:", err.message);
      req.flash("error", "Adabiyot qo‘shishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    }
  }
);

// ===============================
// ADABIYOTNI FANGA BIRIKTIRISH
// ===============================
router.post(
  "/manager/adabiyotlar/:adabiyot_id/biriktirish",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { adabiyot_id } = req.params;
      const { fan_id, turi } = req.body;

      if (!fan_id || !turi) {
        req.flash("error", "Fan va ro‘yxat turini tanlang.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      const checkAdabiyot = await pool.query(
        "SELECT id FROM adabiyotlar WHERE id = $1",
        [adabiyot_id]
      );

      if (checkAdabiyot.rows.length === 0) {
        req.flash("error", "Adabiyot topilmadi.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      const checkFan = await pool.query(
        "SELECT id FROM fanlar WHERE id = $1",
        [fan_id]
      );

      if (checkFan.rows.length === 0) {
        req.flash("error", "Fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      await pool.query(
        `
        INSERT INTO fan_adabiyotlari (
          fan_id,
          adabiyot_id,
          turi
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (fan_id, adabiyot_id)
        DO UPDATE SET
          turi = EXCLUDED.turi,
          updated_at = CURRENT_TIMESTAMP
        `,
        [fan_id, adabiyot_id, turi]
      );

      req.flash("success", "Adabiyot fanga muvaffaqiyatli biriktirildi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    } catch (err) {
      console.error("Adabiyotni fanga biriktirish xatosi:", err.message);
      req.flash("error", "Adabiyotni fanga biriktirishda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    }
  }
);

// ===============================
// ADABIYOT EDIT SAHIFASI
// ===============================
router.get(
  "/manager/adabiyotlar/:id/edit",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM adabiyotlar WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        req.flash("error", "Adabiyot topilmadi.");
        return req.session.save(() => res.redirect("/manager/adabiyotlar"));
      }

      return res.render("manager/adabiyot_edit", {
        adabiyot: result.rows[0],
      });
    } catch (err) {
      console.error("Adabiyot edit xatosi:", err.message);
      req.flash("error", "Adabiyot ma’lumotlarini yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    }
  }
);

// ===============================
// ADABIYOT UPDATE
// ===============================
router.post(
  "/manager/adabiyotlar/:id/update",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      let {
        manba_turi,
        avtor,
        adabiyot_nomi,
        yili,
        sahifa_soni,
        url,
      } = req.body;

      manba_turi = manba_turi?.trim();
      avtor = avtor?.trim() || null;
      adabiyot_nomi = adabiyot_nomi?.trim() || null;
      url = url?.trim() || null;
      yili = yili ? Number(yili) : null;
      sahifa_soni = sahifa_soni ? Number(sahifa_soni) : null;

      if (!manba_turi) {
        req.flash("error", "Manba turini tanlang.");
        return req.session.save(() => res.redirect(`/manager/adabiyotlar/${id}/edit`));
      }

      if (manba_turi === "internet" && !url) {
        req.flash("error", "Internet manzilini kiriting.");
        return req.session.save(() => res.redirect(`/manager/adabiyotlar/${id}/edit`));
      }

      if (manba_turi === "kitob" && (!avtor || !adabiyot_nomi)) {
        req.flash("error", "Kitob uchun avtor va adabiyot nomini kiriting.");
        return req.session.save(() => res.redirect(`/manager/adabiyotlar/${id}/edit`));
      }

      await pool.query(
        `
        UPDATE adabiyotlar
        SET
          manba_turi = $1,
          avtor = $2,
          adabiyot_nomi = $3,
          yili = $4,
          sahifa_soni = $5,
          url = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        `,
        [manba_turi, avtor, adabiyot_nomi, yili, sahifa_soni, url, id]
      );

      req.flash("success", "Adabiyot muvaffaqiyatli yangilandi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    } catch (err) {
      console.error("Adabiyot update xatosi:", err.message);
      req.flash("error", "Adabiyot yangilashda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect(`/manager/adabiyotlar/${req.params.id}/edit`));
    }
  }
);

// ===============================
// ADABIYOT DELETE
// ===============================
router.post(
  "/manager/adabiyotlar/:id/delete",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query(
        "DELETE FROM adabiyotlar WHERE id = $1",
        [id]
      );

      req.flash("success", "Adabiyot muvaffaqiyatli o‘chirildi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    } catch (err) {
      console.error("Adabiyot delete xatosi:", err.message);
      req.flash("error", "Adabiyot o‘chirishda server xatosi yuz berdi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    }
  }
);

// Adabiyotni Fandan olib tashlash
router.post(
  "/manager/adabiyotlar/:adabiyot_id/fan/:fan_id/remove",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { adabiyot_id, fan_id } = req.params;

      await pool.query(
        `
        DELETE FROM fan_adabiyotlari
        WHERE adabiyot_id = $1 AND fan_id = $2
        `,
        [adabiyot_id, fan_id]
      );

      req.flash("success", "Adabiyot fandan ajratildi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    } catch (err) {
      console.error("Adabiyotni fandan ajratish xatosi:", err.message);

      req.flash("error", "Adabiyotni fandan ajratishda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/adabiyotlar"));
    }
  }
);
// ===============================
// BITTA FAN ADABIYOTLARINI KO‘RISH
// ===============================
router.get(
  "/manager/fanlar/:fan_id/adabiyotlar",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  forceChangePassword,
  async (req, res) => {
    try {
      const { fan_id } = req.params;

      const fanResult = await pool.query(
        "SELECT * FROM fanlar WHERE id = $1",
        [fan_id]
      );

      if (fanResult.rows.length === 0) {
        req.flash("error", "Fan topilmadi.");
        return req.session.save(() => res.redirect("/manager/fanlar"));
      }

      const adabiyotlarResult = await pool.query(
        `
        SELECT
          fa.id AS fan_adabiyot_id,
          fa.turi,
          a.*
        FROM fan_adabiyotlari fa
        JOIN adabiyotlar a ON a.id = fa.adabiyot_id
        WHERE fa.fan_id = $1
        ORDER BY 
          CASE WHEN fa.turi = 'asosiy' THEN 1 ELSE 2 END,
          fa.id ASC
        `,
        [fan_id]
      );

      return res.render("manager/fan_adabiyotlar", {
        fan: fanResult.rows[0],
        adabiyotlar: adabiyotlarResult.rows || [],
      });
    } catch (err) {
      console.error("Fan adabiyotlari xatosi:", err.message);
      req.flash("error", "Fan adabiyotlarini yuklashda xatolik yuz berdi.");
      return req.session.save(() => res.redirect("/manager/fanlar"));
    }
  }
);

// ===============================
// ADABIYOTNI FANDAN AJRATISH
// ===============================
router.post(
  "/manager/fanlar/:fan_id/adabiyotlar/:fan_adabiyot_id/remove",
  requireRole("manager", "oquv_bolimi", "superadmin"),
  requireAuth,
  async (req, res) => {
    try {
      const { fan_id, fan_adabiyot_id } = req.params;

      await pool.query(
        `
        DELETE FROM fan_adabiyotlari
        WHERE id = $1 AND fan_id = $2
        `,
        [fan_adabiyot_id, fan_id]
      );

      req.flash("success", "Adabiyot fandan ajratildi.");
      return req.session.save(() =>
        res.redirect(`/manager/fanlar/${fan_id}/adabiyotlar`)
      );
    } catch (err) {
      console.error("Adabiyotni fandan ajratish xatosi:", err.message);
      req.flash("error", "Adabiyotni fandan ajratishda xatolik yuz berdi.");
      return req.session.save(() =>
        res.redirect(`/manager/fanlar/${req.params.fan_id}/adabiyotlar`)
      );
    }
  }
);


module.exports = router;
