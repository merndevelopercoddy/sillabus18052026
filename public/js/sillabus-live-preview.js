(function () {
  const scriptTag = document.currentScript;
  const previewUrl = scriptTag.getAttribute('data-preview-url');
  const toggleBtn = document.getElementById('livePreviewToggle');
  const panel = document.getElementById('livePreviewPanel');
  const closeBtn = document.getElementById('livePreviewClose');
  const content = document.getElementById('livePreviewContent');

  if (!toggleBtn || !panel || !content || !previewUrl) return;

  let opened = false;
  let debounceTimer = null;
  let lastActiveContainer = null;

  function openPanel() {
    panel.classList.remove('d-none');
    opened = true;
    refresh();
  }

  function closePanel() {
    panel.classList.add('d-none');
    opened = false;
  }

  toggleBtn.addEventListener('click', function () {
    if (opened) closePanel(); else openPanel();
  });
  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  function collectFields() {
    const container = lastActiveContainer || document.querySelector('[data-preview-section]');
    if (!container) return null;
    const section = container.getAttribute('data-preview-section');
    const editingRowId = container.getAttribute('data-preview-row-id') || '';
    const params = new URLSearchParams();
    params.set('__section', section);
    params.set('__editingRowId', editingRowId);
    container.querySelectorAll('[name]').forEach(function (el) {
      if (el.disabled) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      params.append(el.name, el.value);
    });
    return params;
  }

  function refresh() {
    if (!opened) return;
    const params = collectFields();
    if (!params) return;
    content.style.opacity = '0.5';
    fetch(previewUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
      .then(function (res) { return res.ok ? res.text() : null; })
      .then(function (html) { if (html !== null) content.innerHTML = html; })
      .catch(function () { /* jonli koʻrinish ixtiyoriy — jim xato */ })
      .finally(function () { content.style.opacity = '1'; });
  }

  function scheduleRefresh() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, 500);
  }

  document.addEventListener('input', function (e) {
    const container = e.target.closest('[data-preview-section]');
    if (!container) return;
    lastActiveContainer = container;
    scheduleRefresh();
  });

  document.addEventListener('change', function (e) {
    const container = e.target.closest('[data-preview-section]');
    if (!container) return;
    lastActiveContainer = container;
    scheduleRefresh();
  });
})();
