// Arranque: navegación (barra inferior + "Más"), cabecera y conexión.

import * as store from './store.js';
import { h, icon } from './ui.js';
import casa from './views/casa.js';
import tareas from './views/tareas.js';
import batch from './views/batch.js';
import calendario from './views/calendario.js';
import mas from './views/mas.js';
import compra from './views/compra.js';
import almacen from './views/almacen.js';
import ajustes from './views/ajustes.js';
import mejoras from './views/mejoras.js';
import { initConflicts } from './components/conflicts.js';

// Para añadir una sección: crear su vista y añadirla aquí (en TABS o dentro de "Más").
const ROUTES = {
  casa:       { title: 'Casa',               view: casa },
  tareas:     { title: 'Tareas',             view: tareas },
  batch:      { title: 'Batch cooking',      view: batch },
  calendario: { title: 'Calendario',         view: calendario },
  mas:        { title: 'Más',                view: mas },
  compra:     { title: 'Lista de la compra', view: compra,  parent: 'mas' },
  almacen:    { title: 'Almacenaje',         view: almacen, parent: 'mas' },
  ajustes:    { title: 'Ajustes',            view: ajustes, parent: 'mas' },
  mejoras:    { title: 'Mejoras de la app',  view: mejoras, parent: 'mas' },
};

const TABS = [
  ['casa', 'hex', 'Casa'],
  ['tareas', 'check', 'Tareas'],
  ['batch', 'pot', 'Batch'],
  ['calendario', 'calendar', 'Calendario'],
  ['mas', 'dots', 'Más'],
];

const main = document.getElementById('main');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const statusBtn = document.getElementById('status');
const tabbar = document.getElementById('tabbar');

backBtn.append(icon('back'));
backBtn.addEventListener('click', () => { location.hash = '#/mas'; });
statusBtn.addEventListener('click', () => { location.hash = '#/ajustes'; });

// Aviso de versión nueva: franja bajo la cabecera; al tocarla se reinicia la app.
const updateBtn = document.getElementById('update');
updateBtn.addEventListener('click', () => location.reload());
function markUpdatePending() { updateBtn.hidden = false; }

const tabEls = TABS.map(([route, ic, label]) => {
  const a = h('a', { class: 'tab', href: '#/' + route }, icon(ic), h('span', {}, label));
  tabbar.append(a);
  return [route, a];
});

store.onStatus((s) => {
  statusBtn.textContent = s.text;
  statusBtn.classList.toggle('ok', s.ok);
});

let cleanup = null;

function navigate() {
  const m = location.hash.match(/^#\/(\w+)(?:\?(.*))?$/);
  const name = m && ROUTES[m[1]] ? m[1] : 'casa';
  const params = new URLSearchParams((m && m[2]) || '');
  const route = ROUTES[name];

  if (cleanup) cleanup();
  main.replaceChildren();
  window.scrollTo(0, 0);

  titleEl.textContent = route.title;
  document.title = route.title + ' · Casa';
  backBtn.hidden = !route.parent;
  const activeTab = route.parent || name;
  tabEls.forEach(([r, a]) => (r === activeTab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));

  cleanup = route.view(main, params) || null;
}

window.addEventListener('hashchange', navigate);
navigate();
initConflicts();
store.connect();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'update-ready') markUpdatePending();
  });
  // Por si el aviso llegó antes de que la app terminara de arrancar
  if (window.caches) caches.match('/__update-pending').then((r) => { if (r) markUpdatePending(); });
}
