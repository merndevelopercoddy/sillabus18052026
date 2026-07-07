(function () {
  function markState(el, cls) {
    el.classList.remove('ie-saving', 'ie-saved', 'ie-error');
    el.classList.add(cls);
    if (cls === 'ie-saved') {
      setTimeout(function () { el.classList.remove('ie-saved'); }, 1200);
    }
  }

  function saveField(el) {
    const container = el.closest('[data-save-url]');
    if (!container) return;
    const url = container.getAttribute('data-save-url');
    const field = el.getAttribute('data-autosave-field');
    const value = ('value' in el ? el.value : el.innerText).trim();

    if (el.dataset.lastSaved === value) return;
    el.dataset.lastSaved = value;

    markState(el, 'ie-saving');
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ field: field, value: value }).toString(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        markState(el, data && data.ok ? 'ie-saved' : 'ie-error');
      })
      .catch(function () {
        markState(el, 'ie-error');
      });
  }

  // blur doesn't bubble, so listen on the capture phase to delegate
  document.addEventListener('blur', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-autosave-field')) {
      saveField(e.target);
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-autosave-field') && e.target.hasAttribute('data-single-line')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    }
  });

  // Literature suggestions: show the recommended-books dropdown while the field is focused
  document.addEventListener('focus', function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-suggest-target')) return;
    const list = e.target.parentElement.querySelector('.adabiyot-suggest-list');
    if (list) list.classList.add('show');
  }, true);

  // Use mousedown (fires before blur) so clicking a suggestion doesn't close the field first
  document.addEventListener('mousedown', function (e) {
    const item = e.target.closest('.adabiyot-suggest-item');
    if (!item) return;
    e.preventDefault();

    const list = item.closest('.adabiyot-suggest-list');
    const field = list && list.previousElementSibling;
    if (!field || !field.hasAttribute('data-suggest-target')) return;

    const text = item.getAttribute('data-text');
    const current = field.innerText.trim();
    field.innerText = current ? current + '\n' + text : text;

    field.focus();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    saveField(field);
  });

  // Close suggestion dropdowns when clicking anywhere outside them
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.adabiyot-suggest-list.show').forEach(function (list) {
      if (!list.parentElement.contains(e.target)) list.classList.remove('show');
    });
  });
})();
