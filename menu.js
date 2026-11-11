// Menú Trueba: menú mensual de la Haurreskola, guardado en el móvil para verlo sin conexión.
//
// Descarga automática (sin botón), lanzada por el móvil al abrir la app:
//  - Si ya está descargado el menú del mes en curso (flag menuDescargadoMes), NO busca nada
//    hasta el mes siguiente.
//  - Si aún no lo está (principio de mes, antes de que el colegio lo suba), lo intenta
//    como mucho una vez al día.
// El colegio no lo sube el día 1: el mes se deduce de la fecha del archivo.

import { h, icon } from '../ui.js';

const API = '/api/menu-trueba';
const CACHE = 'casa-menu';
const IMG_KEY = '/menu-trueba.jpg';
const META_KEY = 'casa:menu';
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const loadMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } };
const saveMeta = (m) => localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...m }));
const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const currentMonthKey = () => { const d = new Date(); return monthKey(d.getFullYear(), d.getMonth()); };

// Mes al que corresponde el menú: el de la fecha de subida; si se subió a partir del día 20,
// se considera el del mes siguiente (por si el colegio lo adelanta).
export function menuMonth(modified) {
  const d = new Date(modified);
  if (isNaN(d)) return null;
  let y = d.getFullYear();
  let m = d.getMonth();
  if (d.getDate() >= 20) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return { y, m };
}

async function hasCachedImage() {
  if (!window.caches) return false;
  return !!(await (await caches.open(CACHE)).match(IMG_KEY));
}

async function cachedImageUrl() {
  if (!window.caches) return null;
  const r = await (await caches.open(CACHE)).match(IMG_KEY);
  return r ? URL.createObjectURL(await r.blob()) : null;
}

let running = false;

// Comprobación automática. Devuelve true si ha guardado un menú nuevo.
export async function autoCheckMenu() {
  if (running || !window.caches) return false;
  const meta = loadMeta();
  const thisMonth = currentMonthKey();

  // Flag: el menú de este mes ya está en el móvil -> no se vuelve a buscar este mes.
  if (meta.menuDescargadoMes === thisMonth && await hasCachedImage()) return false;
  // Esperando a que el colegio lo publique: un intento al día como máximo.
  if (meta.checked === todayKey()) return false;

  running = true;
  try {
    const res = await fetch(API, { cache: 'no-store' });
    saveMeta({ checked: todayKey() });
    if (!res.ok) return false;
    const modified = res.headers.get('X-Menu-Modified') || '';
    const changed = modified !== meta.modified || !(await hasCachedImage());
    if (changed) {
      await (await caches.open(CACHE)).put(IMG_KEY,
        new Response(await res.blob(), { headers: { 'Content-Type': 'image/jpeg' } }));
    }
    const mm = menuMonth(modified);
    const got = mm ? monthKey(mm.y, mm.m) : '';
    saveMeta({ modified, ...(got >= thisMonth ? { menuDescargadoMes: thisMonth } : {}) });
    if (changed) window.dispatchEvent(new CustomEvent('menu-updated'));
    return changed;
  } catch {
    return false;               // sin conexión: se reintenta en la próxima apertura
  } finally {
    running = false;
  }
}

function zoomView(src) {
  const dlg = h('dialog', { class: 'zoom' },
    h('button', { class: 'icon-btn zoom-close', type: 'button', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icon('x')),
    h('div', { class: 'zoom-scroll' }, h('img', { src, alt: 'Menú del mes ampliado' })));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

export default function render(root) {
  const title = h('h2', { class: 'menu-title' }, 'Menú');
  const notice = h('p', { class: 'notice', hidden: true });
  const frame = h('div', { class: 'menu-frame' });
  const info = h('p', { class: 'hint' });
  let objectUrl = null;
  let alive = true;

  function paintHeader() {
    const meta = loadMeta();
    const mm = meta.modified ? menuMonth(meta.modified) : null;
    const now = new Date();
    title.textContent = 'Menú ' + cap(MONTHS[mm ? mm.m : now.getMonth()]);
    const behind = mm && monthKey(mm.y, mm.m) < currentMonthKey();
    notice.hidden = !behind;
    if (behind) notice.textContent = `El menú de ${MONTHS[now.getMonth()]} aún no está publicado. Se muestra el de ${MONTHS[mm.m]}.`;
    info.textContent = meta.modified
      ? 'Publicado por el colegio el ' + new Date(meta.modified).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) + '.'
      : '';
  }

  async function paintImage() {
    const url = await cachedImageUrl();
    if (!alive) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = url;
    frame.replaceChildren(url
      ? h('button', { class: 'menu-img', type: 'button', onclick: () => zoomView(url), 'aria-label': 'Ampliar menú' },
        h('img', { src: url, alt: 'Menú del mes de la Haurreskola' }),
        h('span', { class: 'menu-hint' }, 'Toca para ampliar'))
      : h('p', { class: 'empty' }, 'El menú se descargará solo en cuanto haya conexión.'));
  }

  const onUpdated = () => { paintHeader(); paintImage(); };
  window.addEventListener('menu-updated', onUpdated);

  root.append(h('div', { class: 'view' }, title, notice, frame, info));
  paintHeader();
  paintImage();
  autoCheckMenu();

  return () => {
    alive = false;
    window.removeEventListener('menu-updated', onUpdated);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}
