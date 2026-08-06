// Voegt een "copy" knop toe aan code-blocks die je wél wil kopieren.
// Output-blocks (geen code om te kopieren) krijgen GEEN knop:
//   - blokken met class "no-copy"
//   - talen: text, plaintext, console, output, shell-session, no-highlight
//   - blokken zonder taal-aanduiding (platte output)
// De taal staat bij Jekyll/Rouge op de omsluitende <div class="language-XXX ...">
// en/of op <pre>/<code> — we kijken op al deze plekken.
(function () {
  var SKIP = ['no-copy', 'language-text', 'language-plaintext',
              'language-console', 'language-output', 'language-shell-session',
              'language-no-highlight', 'language-vb'];
  function blockClass(pre) {
    // verzamel classes van pre + diens ouders (div.highlighter-rouge e.d.)
    var cls = [];
    var el = pre;
    for (var d = 0; d < 3 && el; d++) {
      if (el.className) cls.push(el.className);
      el = el.parentElement;
    }
    var code = pre.querySelector('code');
    if (code && code.className) cls.push(code.className);
    return cls.join(' ');
  }
  function isOutput(pre) {
    var cls = blockClass(pre);
    for (var i = 0; i < SKIP.length; i++) {
      if (cls.indexOf(SKIP[i]) !== -1) return true;
    }
    // geen enkele "language-*" class => beschouw als output
    if (cls.indexOf('language-') === -1) return true;
    return false;
  }
  function init() {
    var pres = document.querySelectorAll('.prose pre');
    pres.forEach(function (pre) {
      if (pre.querySelector('.copy-btn')) return;
      if (isOutput(pre)) return;
      var code = pre.querySelector('code');
      if (!code) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.addEventListener('click', function () {
        var text = code.innerText;
        var done = function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(fallback);
        } else {
          fallback();
        }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
      pre.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
