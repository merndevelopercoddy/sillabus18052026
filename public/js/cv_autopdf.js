
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('downloadCvBtn');
  if (!btn) return;

  btn.addEventListener('click', async function () {
    const el = document.getElementById('pdfWrap');
    
    if (!el) return;

    const imgs = Array.from(el.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(res => {
      img.onload = res; img.onerror = res;
    })));

    let filename = 'cv_design.pdf';
    const fio = document.querySelector('#cv_design .heading1')?.textContent?.trim();
    if (fio) filename = `CV_${fio.replace(/\s+/g, '_')}.pdf`;


    const opt = {
      margin: [0, 0, 0, 0],    
      filename,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 5,          
        useCORS: true,
        scrollX: 0, scrollY: 0,
        x: 0, y: 0, 
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { 
        mode: ['css', 'legacy'],
         before: '#qarindosh-section'
       }
    };

if (document.fonts && document.fonts.ready) {
  await document.fonts.ready;
}

    await html2pdf().set(opt).from(el).save();

  });
});


