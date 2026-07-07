const pool = require('../config/db');

function formatAdabiyot(a) {
  if (a.manba_turi === 'internet') {
    return a.adabiyot_nomi ? `${a.adabiyot_nomi} — ${a.url}` : (a.url || '');
  }
  const parts = [];
  if (a.avtor) parts.push(`${a.avtor}.`);
  if (a.adabiyot_nomi) parts.push(`${a.adabiyot_nomi}.`);
  if (a.yili) parts.push(`${a.yili},`);
  if (a.sahifa_soni) parts.push(`${a.sahifa_soni} bet.`);
  return parts.join(' ').trim();
}

// oqituvchiId is optional: when provided, restricts the lookup to sillabuses
// owned by that teacher (used by /oqituvchi routes); omit it for oquv_bolimi/superadmin access.
async function getSillabusPreviewData(sId, oqituvchiId) {
  const params = [sId];
  let ownerClause = '';
  if (oqituvchiId) {
    params.push(oqituvchiId);
    ownerClause = 'AND fo.oqituvchi_id = $2';
  }

  const sRes = await pool.query(`
    SELECT s.*,
      f.id AS fan_id,
      f.f_nomi, f.fan_kodi, f.grade, f.ects, f.semestr, f.t_shakli,
      f.auditoriya_soat, f.mustaqil_soat, f.davomiyligi, f.t_yunalish,
      ay.nomi AS yil_nomi,
      u.full_name AS oqituvchi_nomi, u.login AS oqituvchi_login,
      k.nomi AS kafedra_nomi,
      km.full_name AS kafedra_mudiri_nomi
    FROM sillabuslar s
    JOIN fan_oqituvchi fo ON fo.id = s.fan_oqituvchi_id
    JOIN fanlar f ON f.id = fo.fan_id
    LEFT JOIN akademik_yillar ay ON ay.id = fo.akademik_yil_id
    LEFT JOIN users u ON u.id = fo.oqituvchi_id
    LEFT JOIN kafedralar k ON k.id = f.kafedra_id
    LEFT JOIN users km ON km.role = 'kafedra_mudiri' AND km.kafedra_id = f.kafedra_id
    WHERE s.id = $1 ${ownerClause}
  `, params);
  if (!sRes.rows.length) return null;

  const sillabus = sRes.rows[0];

  const [maruzaRes, mustaqilRes, mezoniRes, jbRes, oiRes, yiRes, tashkilotRes, yonalishRes, adabiyotRes, taqrizchiRes] = await Promise.all([
    pool.query('SELECT * FROM maruza_amaliy_reja WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId]),
    pool.query('SELECT * FROM mustaqil_talim WHERE sillabus_id=$1 ORDER BY tartib_raqam ASC', [sId]),
    pool.query('SELECT * FROM baholash_mezoni WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='JB' ORDER BY tartib ASC", [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='OI' ORDER BY tartib ASC", [sId]),
    pool.query("SELECT * FROM talabalar_baholash WHERE sillabus_id=$1 AND guruh='YI' ORDER BY tartib ASC", [sId]),
    pool.query('SELECT * FROM tashkilot ORDER BY id ASC LIMIT 1'),
    pool.query('SELECT yonalish_shifri, yonalish_nomi FROM yonalish'),
    pool.query(`
      SELECT a.id, a.manba_turi, a.avtor, a.adabiyot_nomi, a.yili, a.sahifa_soni, a.url, fa.turi
      FROM fan_adabiyotlari fa
      JOIN adabiyotlar a ON a.id = fa.adabiyot_id
      WHERE fa.fan_id = $1
      ORDER BY a.avtor ASC, a.adabiyot_nomi ASC
    `, [sillabus.fan_id]),
    pool.query('SELECT * FROM sillabus_taqrizchilar WHERE sillabus_id=$1 ORDER BY tartib ASC', [sId]),
  ]);

  if (sillabus.t_yunalish && sillabus.t_yunalish.length) {
    const shifrMap = {};
    yonalishRes.rows.forEach(y => { shifrMap[y.yonalish_nomi] = y.yonalish_shifri; });
    sillabus.t_yunalish = sillabus.t_yunalish.map(nomi =>
      shifrMap[nomi] ? `${shifrMap[nomi]}-${nomi}` : nomi
    );
  }

  const asosiyAdabiyotTavsiya = [];
  const qoshimchaAdabiyotTavsiya = [];
  adabiyotRes.rows.forEach(a => {
    const item = { id: a.id, text: formatAdabiyot(a) };
    if (a.turi === 'qoshimcha') qoshimchaAdabiyotTavsiya.push(item);
    else asosiyAdabiyotTavsiya.push(item);
  });

  return {
    sillabus,
    maruzaRows: maruzaRes.rows,
    mustaqilRows: mustaqilRes.rows,
    mezoniRows: mezoniRes.rows,
    jbRows: jbRes.rows,
    oiRows: oiRes.rows,
    yiRows: yiRes.rows,
    tashkilot: tashkilotRes.rows[0] || null,
    asosiyAdabiyotTavsiya,
    qoshimchaAdabiyotTavsiya,
    taqrizchilar: taqrizchiRes.rows,
  };
}

const UMUMIY_FIELDS = [
  'talabalarni_qabul_kuni', 'bilim_ko_nikma',
  'tuzuvchi_fish', 'tuzuvchi_lavozim', 'tuzuvchi_tel',
  'asosiy_adabiyotlar', 'qoshimcha_adabiyotlar', 'internet_manzillar',
  'majlis_raqami', 'majlis_sanasi',
];

// Overlays unsaved form values onto the real preview data so the live-preview
// panel can reflect what the user is currently typing, without persisting anything.
function applyDraft(data, section, formData = {}, editingRowId = null) {
  formData = formData || {};
  editingRowId = editingRowId ? Number(editingRowId) : null;

  if (section === 'umumiy') {
    UMUMIY_FIELDS.forEach(f => {
      if (Object.prototype.hasOwnProperty.call(formData, f)) {
        data.sillabus[f] = formData[f] || null;
      }
    });
    // oquv_bolimi's classic form submits taqrizchi rows as parallel arrays
    // (taqrizchi_fish[], taqrizchi_lavozim[], taqrizchi_tel[]); reflect them
    // as a full replacement of the draft list so the live preview matches.
    if (formData.taqrizchi_fish) {
      const fishArr = [].concat(formData.taqrizchi_fish);
      const lavozimArr = [].concat(formData.taqrizchi_lavozim || []);
      const telArr = [].concat(formData.taqrizchi_tel || []);
      data.taqrizchilar = fishArr
        .map((fish, i) => ({ id: -1 - i, tartib: i + 1, fish, lavozim: lavozimArr[i] || '', tel: telArr[i] || '' }))
        .filter(r => r.fish && r.fish.trim());
    }
    return data;
  }

  if (section === 'taqrizchi') {
    const draftRow = {
      id: editingRowId || -1,
      tartib: Number(formData.tartib) || (data.taqrizchilar.length + 1),
      fish: formData.fish || '',
      lavozim: formData.lavozim || '',
      tel: formData.tel || '',
    };
    data.taqrizchilar = mergeRow(data.taqrizchilar, draftRow, editingRowId, 'tartib');
    return data;
  }

  if (section === 'maruza') {
    const draftRow = {
      id: editingRowId || -1,
      tartib_raqam: Number(formData.tartib_raqam) || (data.maruzaRows.length + 1),
      mavzu: formData.mavzu || '',
      dars_mazmuni: (formData.dars_mazmuni || '').split('\n').map(s => s.trim()).filter(Boolean),
      maruza_soat: Number(formData.maruza_soat) || 0,
      amaliy_soat: Number(formData.amaliy_soat) || 0,
    };
    data.maruzaRows = mergeRow(data.maruzaRows, draftRow, editingRowId);
    return data;
  }

  if (section === 'mustaqil') {
    const draftRow = {
      id: editingRowId || -1,
      tartib_raqam: Number(formData.tartib_raqam) || (data.mustaqilRows.length + 1),
      mavzu: formData.mavzu || '',
      topshiriq: formData.topshiriq || '',
      soat: Number(formData.soat) || 0,
    };
    data.mustaqilRows = mergeRow(data.mustaqilRows, draftRow, editingRowId);
    return data;
  }

  if (section === 'baholash-mezoni') {
    const draftRow = {
      id: editingRowId || -1,
      tartib: Number(formData.tartib) || (data.mezoniRows.length + 1),
      nomi: formData.nomi || '',
      foiz: Number(formData.foiz) || 0,
      izoh: formData.izoh || '',
    };
    data.mezoniRows = mergeRow(data.mezoniRows, draftRow, editingRowId, 'tartib');
    return data;
  }

  if (section === 'baholash-talabalar') {
    const draftRow = {
      id: editingRowId || -1,
      tartib: Number(formData.tartib) || 0,
      guruh: formData.guruh || 'JB',
      nazorat_nomi: formData.nazorat_nomi || '',
      izoh: formData.izoh || '',
      ball: Number(formData.ball) || 0,
      otkazilish_vaqti: formData.otkazilish_vaqti || '',
    };
    const key = { JB: 'jbRows', OI: 'oiRows', YI: 'yiRows' }[draftRow.guruh] || 'jbRows';
    ['jbRows', 'oiRows', 'yiRows'].forEach(k => {
      if (k !== key && editingRowId) {
        data[k] = data[k].filter(r => r.id !== editingRowId);
      }
    });
    data[key] = mergeRow(data[key], draftRow, editingRowId, 'tartib');
    return data;
  }

  return data;
}

function mergeRow(rows, draftRow, editingRowId, sortKey = 'tartib_raqam') {
  let next = editingRowId
    ? rows.filter(r => r.id !== editingRowId)
    : rows.slice();
  next.push(draftRow);
  next.sort((a, b) => (a[sortKey] || 0) - (b[sortKey] || 0));
  return next;
}

module.exports = { getSillabusPreviewData, applyDraft, UMUMIY_FIELDS };
