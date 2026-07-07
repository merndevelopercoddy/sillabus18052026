// module.exports = {
//     eq: (a, b) => a === b,
//     formatDate: (date) => {
//       if (!date) return "";
//       const d = new Date(date);
//       if (isNaN(d)) return "";
//       const year = d.getFullYear();
//       const month = String(d.getMonth() + 1).padStart(2, "0");
//       const day = String(d.getDate()).padStart(2, "0");
//       return `${year}-${month}-${day}`;
//     },
//     formatDate2: (date) => {
//       if (!date) return "";
//       const d = new Date(date);
//       return `${String(d.getDate()).padStart(2, "0")}.${String(
//         d.getMonth() + 1
//       ).padStart(2, "0")}.${d.getFullYear()}`;
//     },
//     formatDate3: (dateString)=>{
//       if (!dateString) return "";

//   const date = new Date(dateString);

//   if (isNaN(date.getTime())) return "";

//   const day = String(date.getDate()).padStart(2, "0");
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const year = date.getFullYear();

//   const hours = String(date.getHours()).padStart(2, "0");
//   const minutes = String(date.getMinutes()).padStart(2, "0");

//   return `${day}.${month}.${year} ${hours}:${minutes}`;
//     },
//     ifCond: function (v1, v2, options) {
//       return v1 == v2 ? options.fn(this) : options.inverse(this);
//     },
//     gt: (a, b) => a > b,
//     lt: (a, b) => a < b,
//     increment: (val) => parseInt(val) + 1,
//     decrement: (val) => parseInt(val) - 1,
//     range: (start, end) => {
//       const arr = [];
//       for (let i = start; i <= end; i++) arr.push(i);
//       return arr;
//     },

//     generatePagination: (currentPage, totalPages, delta = 2) => {
//       const range = [];
//       const rangeWithDots = [];
//       let l;
    
//       for (let i = 1; i <= totalPages; i++) {
//         if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
//           range.push(i);
//         }
//       }
    
//       for (let i of range) {
//         if (l) {
//           if (i - l === 2) {
//             rangeWithDots.push(l + 1);
//           } else if (i - l !== 1) {
//             rangeWithDots.push("...");
//           }
//         }
//         rangeWithDots.push(i);
//         l = i;
//       }
    
//       return rangeWithDots;
//     },
//     and: (a, b) => a && b,  
//     // Raqamni to‘g‘ri tartibda hisoblash uchun
//     addOne: (startIndex, index) => startIndex + index + 1,
//     includes: (array, value) => {
//   if (!array) return false;
//   return array.includes(String(value));
// }
//   };

// helpers/hbsHelpers.js

module.exports = {
  eq: (a, b) => String(a) === String(b),

  and: (a, b) => a && b,

  or: (...args) => {
    args.pop();
    return args.some(Boolean);
  },

  percentOf: (val, pct) => Math.round((Number(val || 0) * Number(pct)) / 100),

  concat: (...args) => {
    args.pop();
    return args.join('');
  },

  concatArrays: (...arrays) => {
    arrays.pop();
    return arrays.reduce((acc, arr) => acc.concat(Array.isArray(arr) ? arr : []), []);
  },

  editableAttrs: (fieldName, showInlineEdit, multiline) => {
    if (!showInlineEdit) return '';
    const single = multiline ? '' : ' data-single-line="true"';
    return ` contenteditable="true" data-autosave-field="${fieldName}"${single} class="inline-editable no-print"`;
  },

  gt: (a, b) => Number(a) > Number(b),

  lt: (a, b) => Number(a) < Number(b),

  increment: (val) => Number(val) + 1,

  decrement: (val) => Number(val) - 1,

  addOne: (startIndex, index) => Number(startIndex) + Number(index) + 1,

  includes: (array, value) => {
    if (!array) return false;

    if (!Array.isArray(array)) {
      return String(array) === String(value);
    }

    return array.map(String).includes(String(value));
  },

  range: (start, end) => {
    const arr = [];
    start = Number(start);
    end = Number(end);

    for (let i = start; i <= end; i++) {
      arr.push(i);
    }

    return arr;
  },

  generatePagination: (currentPage, totalPages, delta = 2) => {
    currentPage = Number(currentPage);
    totalPages = Number(totalPages);
    delta = Number(delta);

    const range = [];
    const rangeWithDots = [];
    let last;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (last) {
        if (i - last === 2) {
          rangeWithDots.push(last + 1);
        } else if (i - last !== 1) {
          rangeWithDots.push("...");
        }
      }

      rangeWithDots.push(i);
      last = i;
    }

    return rangeWithDots;
  },

  formatDate: (date) => {
    if (!date) return "";

    const d = new Date(date);
    if (isNaN(d)) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  },

  formatDate2: (date) => {
    if (!date) return "";

    const d = new Date(date);
    if (isNaN(d)) return "";

    return `${String(d.getDate()).padStart(2, "0")}.${String(
      d.getMonth() + 1
    ).padStart(2, "0")}.${d.getFullYear()}`;
  },

  formatDate3: (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  },

  ifCond: function (v1, v2, options) {
    return String(v1) === String(v2) ? options.fn(this) : options.inverse(this);
  },

  sum: (a, b) => Number(a || 0) + Number(b || 0),

  totalMaruza: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.maruza_soat || 0), 0);
  },

  totalAmaliy: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.amaliy_soat || 0), 0);
  },

  totalJami: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.maruza_soat || 0) + Number(row.amaliy_soat || 0), 0);
  },

  auditoriyaSoatIzoh: (arr) => {
    if (!Array.isArray(arr) || !arr.length) return '';
    const maruza = arr.reduce((acc, row) => acc + Number(row.maruza_soat || 0), 0);
    const amaliy = arr.reduce((acc, row) => acc + Number(row.amaliy_soat || 0), 0);
    if (maruza > 0 && amaliy > 0) return `${maruza} soat maʻruza, ${amaliy} soat amaliy`;
    if (amaliy > 0) return 'amaliy';
    if (maruza > 0) return 'maʻruza';
    return '';
  },

  totalSoat: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.soat || 0), 0);
  },

  totalBall: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.ball || 0), 0);
  },

  totalFoiz: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.foiz || 0), 0);
  },

  totalBallGroup: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((acc, row) => acc + Number(row.ball || 0), 0);
  },

  totalBallAll: (...arrs) => {
    arrs.pop();
    return arrs.reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.reduce((a, row) => a + Number(row.ball || 0), 0) : 0), 0);
  },

  capitalize: (text) => {
    if (!text) return text;
    const s = String(text);
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  firstYear: (yilNomi) => {
    if (!yilNomi) return '';
    const match = String(yilNomi).match(/\d{4}/);
    return match ? match[0] : yilNomi;
  },

  sanaYil: (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    return d.getFullYear();
  },

  sanaKunOy: (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const oylar = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${d.getDate()} ${oylar[d.getMonth()]}dagi`;
  },

  splitLines: (text) => {
    if (!text) return [];
    return String(text).split('\n').map(s => s.trim()).filter(Boolean);
  },

  splitLetterItems: (text) => {
    if (!text) return [];
    return String(text).split(/,?\s*(?=[a-z]\))/).map(s => s.trim()).filter(Boolean);
  },

  cleanNum: (v) => {
    if (v === null || v === undefined || v === '') return '';
    const n = parseFloat(v);
    return Number.isFinite(n) ? String(n) : v;
  },

  withHafta: (text) => {
    if (!text) return '';
    const t = String(text).trim();
    return /hafta/i.test(t) ? t : `${t} hafta`;
  },
};