// middleware/checkSections.js
const pool = require("../config/db"); // sizning db connection joylashgan faylga moslang

async function checkSection(req, res, next) {
  if (req.session.user && req.session.user.role === 'student') {
    try {
      const userId = req.session.user.id;

      const [umumiyRes, talimRes , til_bilishRes , qiziqishlariRes , yutuqlariRes, yashash_holatiRes, oilaviy_holatiRes, QarindoshRes , MehnatRes, IjtimoiyRes, IqtidorliRes, ModdiyRes, HuquqbuzarlikRes] = await Promise.all([
        pool.query("SELECT 1 FROM umumiy WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM talim WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM til_bilish WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM qiziqishlari WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM yutuqlari WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM yashash_holati WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM oilaviy_holati WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM qarindoshlari_haqida WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM mehnat WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM ijtimoiy_holati WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM iqtidorli WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM moddiy_yordam WHERE talaba_id = $1 LIMIT 1", [userId]),
        pool.query("SELECT 1 FROM huquqbuzarlik WHERE talaba_id = $1 LIMIT 1", [userId])
      ]);

      res.locals.hasUmumiy = umumiyRes.rows.length > 0;
      res.locals.hasTalim   = talimRes.rows.length > 0;
      res.locals.hasTil_bilish   = til_bilishRes.rows.length > 0;
      res.locals.hasQiziqishlari   = qiziqishlariRes.rows.length > 0;
      res.locals.hasYutuqlari   = yutuqlariRes.rows.length > 0;
      res.locals.hasYashash   = yashash_holatiRes.rows.length > 0;
      res.locals.hasOilaviy   = oilaviy_holatiRes.rows.length > 0;
      res.locals.hasQarindosh   = QarindoshRes.rows.length > 0;
      res.locals.hasMehnat   = MehnatRes.rows.length > 0;
      res.locals.hasIjtimoiy   = IjtimoiyRes.rows.length > 0;
      res.locals.hasIqtidorli   = IqtidorliRes.rows.length > 0;
      res.locals.hasModdiy   = ModdiyRes.rows.length > 0;
      res.locals.hasHuquqbuzarlik   = HuquqbuzarlikRes.rows.length > 0;
      
    } catch (err) {
      console.error("Menyu flag tekshirishda xato:", err);
    }
  }
  next();
}

module.exports = checkSection;