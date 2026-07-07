(function () {
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function autoGrowAll(root) {
    (root || document).querySelectorAll('.doc-autogrow').forEach(autoGrow);
  }

  window.sillabusAutoGrow = autoGrowAll;

  document.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('doc-autogrow')) {
      autoGrow(e.target);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { autoGrowAll(); });
  } else {
    autoGrowAll();
  }
})();
