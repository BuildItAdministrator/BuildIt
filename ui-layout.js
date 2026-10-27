/* Build It!++ right-side navigation: keep all administration tools aligned. */
(function () {
  'use strict';

  const css = document.createElement('style');
  css.id = 'buildit-right-dock-style';
  css.textContent = [
    ':root{--bi-dock-right:12px;--bi-dock-width:264px;--bi-panel-top:213px}',
    '#placeSearchBox{position:absolute;top:12px;right:var(--bi-dock-right);left:auto;width:min(var(--bi-dock-width),calc(100vw - 24px));box-sizing:border-box;z-index:1170}',
    '#filterToggle,#logToggle,#biToggle{',
    'position:absolute!important;left:auto!important;right:var(--bi-dock-right)!important;',
    'width:min(var(--bi-dock-width),calc(100vw - 24px))!important;',
    'height:40px!important;box-sizing:border-box!important;',
    'padding:9px 13px!important;text-align:left!important;',
    'font:700 13px Arial,Helvetica,sans-serif!important;',
    'background:rgba(17,23,28,.95)!important;color:#f6f8fa!important;',
    'border:1px solid rgba(201,221,235,.32)!important;',
    'border-radius:9px!important;box-shadow:0 3px 14px rgba(0,0,0,.38)!important;',
    'cursor:pointer!important;z-index:1150!important;',
    '}',
    '#filterToggle{top:63px!important}',
    '#logToggle{top:109px!important}',
    '#biToggle{top:155px!important}',
    '#logToggle.has-data{border-color:#6bc9e9!important}',
    '#filterToggle:hover,#logToggle:hover,#biToggle:hover{background:#253846!important}',
    '#filterToggle:focus-visible,#logToggle:focus-visible,#biToggle:focus-visible{outline:2px solid #9adaf4;outline-offset:2px}',
    '#filterPanel,#logPanel,#biPanel{',
    'position:absolute!important;top:var(--bi-panel-top)!important;',
    'right:var(--bi-dock-right)!important;left:auto!important;',
    'width:min(380px,calc(100vw - 24px))!important;min-width:0!important;',
    'max-height:calc(100vh - 225px)!important;max-height:calc(100dvh - 225px)!important;',
    'overflow-y:auto!important;box-sizing:border-box!important;',
    'border-radius:11px!important;z-index:1160!important;',
    'scrollbar-width:thin;',
    '}',
    '#biPanel[hidden],#filterPanel.hidden,#logPanel.hidden{display:none!important}',
    'body.buildit-searching #filterToggle,body.buildit-searching #logToggle,body.buildit-searching #biToggle{visibility:hidden!important}',
    '@media(max-width:600px){',
    ':root{--bi-dock-right:10px;--bi-dock-width:230px;--bi-panel-top:210px}',
    '#filterPanel,#logPanel,#biPanel{width:calc(100vw - 20px)!important}',
    '}',
    '@media(max-height:320px){',
    '#filterPanel,#logPanel,#biPanel{max-height:95px!important}',
    '}'
  ].join('');
  document.head.appendChild(css);

  const panels = ['filterPanel', 'logPanel', 'biPanel']
    .map(id => document.getElementById(id)).filter(Boolean);
  const placeResults = document.getElementById('placeSearchResults');

  function isOpen(p) {
    return p && !p.hidden && !p.classList.contains('hidden');
  }
  function closePanel(p) {
    if (!isOpen(p)) return;
    if (p.id === 'biPanel') {
      // Use Event Manager's existing close handler to exit map placement mode.
      const close = document.getElementById('biClose');
      if (close) { close.click(); return; }
      p.hidden = true;
    } else {
      p.classList.add('hidden');
    }
  }
  function keepOneOpen(opened) {
    for (const p of panels) if (p !== opened) closePanel(p);
    if (placeResults) placeResults.classList.add('hidden');
  }

  // This also handles panels opened programmatically (for example from a map marker).
  const panelObserver = new MutationObserver(changes => {
    for (let i = changes.length - 1; i >= 0; i--) {
      const p = changes[i].target;
      if (isOpen(p)) { keepOneOpen(p); break; }
    }
  });
  for (const p of panels) {
    panelObserver.observe(p, {attributes:true,attributeFilter:['class','hidden']});
  }

  // Hide button row when the place search dropdown is open, so results
  // don't visually overlap the navigation buttons.
  if (placeResults) {
    const syncSearch = () => {
      document.body.classList.toggle('buildit-searching', !placeResults.classList.contains('hidden'));
    };
    new MutationObserver(syncSearch).observe(placeResults, {
      attributes:true,attributeFilter:['class']
    });
    syncSearch();
  }
  const placeInput = document.getElementById('placeSearchInput');
  if (placeInput) {
    placeInput.addEventListener('focus', () => {
      for (const p of panels) closePanel(p);
    });
  }
})();
