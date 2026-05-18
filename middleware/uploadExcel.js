// middleware/uploadExcel.js
const multer = require("multer");

// 📦 Faylni RAM’da (xotirada) saqlaymiz
const storage = multer.memoryStorage();

// ✅ Faqat Excel fayllarini qabul qilish
const uploadExcel = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: function (req, file, cb) {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Faqat .xlsx yoki .xls fayl yuklanadi!"));
    }
    cb(null, true);
  }
});

module.exports = uploadExcel;