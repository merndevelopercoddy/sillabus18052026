
// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })
})()

const input_t_sana = document.getElementById("t_sana");
if (input_t_sana && input_t_sana.value) {
  const d = new Date(input_t_sana.value);
  if (!isNaN(d)) {
    input_t_sana.value = d.toISOString().split("T")[0]; // YYYY-MM-DD
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("yearSelect");
  const selectEnd = document.getElementById("yearEnd");
  const selectYutuq = document.getElementById("yearYutuq");

  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 1940; year--) {
    [select, selectEnd, selectYutuq].forEach(sel => {
      if (sel) {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        sel.appendChild(option);
      }
    });
  }
});

// document.addEventListener("DOMContentLoaded", function () {
//   const viloyatSelect = document.getElementById("viloyat");
//   const tumanSelect = document.getElementById("tuman");

//   viloyatSelect.addEventListener("change", async function () {
//     const viloyatId = this.value;
//     tumanSelect.innerHTML = '<option value="" disabled selected>Tanlang...</option>';

//     if (viloyatId) {
//       const res = await fetch(`/api/tumanlar/${viloyatId}`);
//       const tumanlar = await res.json();
//       tumanlar.forEach(tuman => {
//         const opt = document.createElement("option");
//         opt.value = tuman.id;
//         opt.textContent = tuman.nomi;
//         tumanSelect.appendChild(opt);
//       });
//     }
//   });
// });

document.addEventListener("DOMContentLoaded", function () {
  const viloyatSelect = document.getElementById("viloyat");
  const tumanSelect = document.getElementById("tuman");

  // faqat elementlar mavjud bo‘lsa ishlaydi
  if (viloyatSelect && tumanSelect) {
    viloyatSelect.addEventListener("change", async function () {
      const viloyatId = this.value;
      tumanSelect.innerHTML = '<option value="" disabled selected>Tanlang...</option>';

      if (viloyatId) {
        try {
          const res = await fetch(`/api/tumanlar/${viloyatId}`);
          if (!res.ok) throw new Error("Tumanlarni olishda xato");
          const tumanlar = await res.json();

          tumanlar.forEach(tuman => {
            const opt = document.createElement("option");
            opt.value = tuman.id;
            opt.textContent = tuman.nomi;
            tumanSelect.appendChild(opt);
          });
        } catch (err) {
          console.error("Tumanlar yuklashda xato:", err);
        }
      }
    });
  }
});



// document.getElementById("kursi").addEventListener("input", function() {
//   if (this.value <= 0) this.value = "";
//   if (this.value > 5) this.value = 5;
// });

const kursiInput = document.getElementById("kursi");

if (kursiInput) {
  kursiInput.addEventListener("input", function() {
    if (this.value <= 0) this.value = "";
    if (this.value > 5) this.value = 5;
  });
}


// document.getElementById("p_seriya").addEventListener("input", function () {
//   this.value = this.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
// });

// document.getElementById("p_number").addEventListener("input", function () {
//   this.value = this.value.replace(/\D/g, "").slice(0, 7);
// });

// document.getElementById("jshshir").addEventListener("input", function () {
//   this.value = this.value.replace(/\D/g, "").slice(0, 14);
// });

const pSeriya = document.getElementById("p_seriya");
if (pSeriya) {
  pSeriya.addEventListener("input", function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  });
}

const pNumber = document.getElementById("p_number");
if (pNumber) {
  pNumber.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 7);
  });
}

const jshshir = document.getElementById("jshshir");
if (jshshir) {
  jshshir.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 14);
  });
}



function formatUzPhone(input) {
  if (!input) return; // agar input mavjud bo‘lmasa, chiqib ketadi

  input.addEventListener("focus", function () {
    if (!this.value.startsWith("+998")) {
      this.value = "+998";
    }
  });

  input.addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9+]/g, "");
    if (!this.value.startsWith("+998")) {
      this.value = "+998";
    }
    if (this.value.length > 13) {
      this.value = this.value.slice(0, 13);
    }
  });
}

// DOM yuklangandan keyin ishlashini ta’minlaymiz
document.addEventListener("DOMContentLoaded", () => {
  formatUzPhone(document.getElementById("telefon"));
  formatUzPhone(document.getElementById("telefon2"));
  formatUzPhone(document.getElementById("telefon3"));
});

// Flash uchun
document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
        const successAlert = document.getElementById("flash-success");
        const errorAlert = document.getElementById("flash-error");

        if (successAlert) {
            successAlert.classList.remove("show");
            setTimeout(() => successAlert.remove(), 300);
        }

        if (errorAlert) {
            errorAlert.classList.remove("show");
            setTimeout(() => errorAlert.remove(), 300);
        }
    }, 4000);
});


    // document.addEventListener("DOMContentLoaded", function () {
    //     const flashSuccess = document.getElementById("flash-success");
    //     const flashError = document.getElementById("flash-error");

    //     [flashSuccess, flashError].forEach((flash) => {
    //         if (flash) {
    //             setTimeout(() => {
    //                 flash.style.opacity = "0";
    //                 flash.style.transition = "opacity 0.5s ease";
    //                 setTimeout(() => {
    //                     flash.remove();
    //                 }, 500);
    //             }, 3000);
    //         }
    //     });
    // });