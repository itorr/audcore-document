const panels = [...document.querySelectorAll('.guide-panel')];
const links = [...document.querySelectorAll('.guide-menu a')];
function show() {
  const id = location.hash.slice(1) || 'start';
  const target = document.getElementById(id);
  const selected = target?.closest('.guide-panel') || panels[0];
  for (const panel of panels) panel.hidden = panel !== selected;
  for (const link of links) {
    if (link.hash === '#' + selected.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

}
show();
addEventListener('hashchange', show);