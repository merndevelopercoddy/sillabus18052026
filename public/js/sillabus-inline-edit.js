(function () {
  function saveRow(row) {
    if (row.dataset.saving === '1') return;

    const action = row.getAttribute('data-row-action');
    const requireField = row.getAttribute('data-require');
    const isNewRow = row.hasAttribute('data-new-row');

    if (isNewRow && requireField) {
      const reqInput = row.querySelector('[name="' + requireField + '"]');
      if (!reqInput || !reqInput.value.trim()) return; // don't save an empty placeholder row
    }

    const params = new URLSearchParams();
    row.querySelectorAll('[name]').forEach(function (el) { params.append(el.name, el.value); });

    const panel = row.closest('[data-inline-edit-panel]');
    if (!panel) return;

    row.dataset.saving = '1';
    panel.classList.add('ie-panel-saving');

    fetch(action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: params.toString(),
    })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        panel.innerHTML = html;
        panel.classList.remove('ie-panel-saving');
        if (window.sillabusAutoGrow) window.sillabusAutoGrow(panel);
      })
      .catch(function () {
        row.dataset.saving = '0';
        panel.classList.remove('ie-panel-saving');
      });
  }

  document.addEventListener('click', function (e) {
    // Delete a row
    const deleteBtn = e.target.closest('[data-row-delete]');
    if (deleteBtn) {
      if (!confirm("O'chirishga ishonchingiz komilmi?")) return;
      const panel = deleteBtn.closest('[data-inline-edit-panel]');
      if (!panel) return;
      panel.classList.add('ie-panel-saving');
      fetch(deleteBtn.getAttribute('data-delete-url'), {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then(function (res) { return res.text(); })
        .then(function (html) {
          panel.innerHTML = html;
          panel.classList.remove('ie-panel-saving');
        })
        .catch(function () { panel.classList.remove('ie-panel-saving'); });
    }
  });

  // Save a row once focus has actually left it (not just moved between its own fields),
  // so replacing the row's HTML never yanks focus out from under an active edit.
  document.addEventListener('focusout', function (e) {
    const row = e.target.closest && e.target.closest('[data-row-form]');
    if (!row) return;
    setTimeout(function () {
      if (!row.isConnected) return; // already replaced by another save
      if (!row.contains(document.activeElement)) {
        saveRow(row);
      }
    }, 0);
  });

  // <select> often doesn't fire blur reliably right after choosing an option
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('select')) return;
    const row = e.target.closest('[data-row-form]');
    if (row) saveRow(row);
  });

  // Enter commits the row instead of adding a newline, except in fields that
  // explicitly allow multi-line content (dars_mazmuni, topshiriq — no data-single-line).
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const row = e.target.closest && e.target.closest('[data-row-form]');
    if (!row) return;
    if (e.target.tagName === 'TEXTAREA' && !e.target.hasAttribute('data-single-line')) return;
    e.preventDefault();
    e.target.blur();
  });
})();
