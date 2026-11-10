// Utilidades de interfaz compartidas por todas las vistas.

// Crea elementos: h('div', {class: 'x', onclick: fn}, 'texto', otroNodo)
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = !!v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  if (value !== undefined) el.value = value; // después de las opciones (para <select>)
  return el;
}

// ---------- Iconos (SVG propios, sin dependencias) ----------
const ICONS = {
  hex: '<path d="M14.2 18.2h1.4l3.6-6.2-3.6-6.2H8.4L4.8 12l3.6 6.2h1.4v-4.8h4.4v4.8"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/>',
  pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h2M20 10h2M9.5 3.5c-.8 1 .8 2 0 3M14.5 3.5c-.8 1 .8 2 0 3"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2l2-8H6.3"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

// ---------- Componentes pequeños ----------
export const field = (label, control) => h('label', { class: 'field' }, h('span', {}, label), control);
export const empty = (text) => h('p', { class: 'empty' }, text);
export const sectionTitle = (text) => h('h3', { class: 'section-title' }, text);

// Hoja inferior (bottom sheet) para editar. onSave puede devolver false para no cerrar.
export function sheet(title, body, { onSave, onDelete, saveLabel = 'Guardar' } = {}) {
  const dlg = h('dialog', { class: 'sheet' });
  const close = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  const form = h('form', {
    tabindex: '-1',
    onsubmit: (e) => {
      e.preventDefault();
      if (onSave && onSave() === false) return;
      close();
    },
  },
    h('header', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: close }, icon('x'))),
    h('div', { class: 'sheet-body' }, body),
    h('footer', { class: 'sheet-foot' },
      onDelete && h('button', {
        type: 'button', class: 'btn danger',
        onclick: () => { if (confirm('¿Seguro que quieres borrarlo?')) { onDelete(); close(); } },
      }, icon('trash'), 'Borrar'),
      h('span', { class: 'spacer' }),
      onSave && h('button', { type: 'submit', class: 'btn primary' }, saveLabel)));

  dlg.append(form);
  document.body.append(dlg);
  dlg.showModal();
  form.focus(); // sin foco en un botón ni teclado abierto al abrir
  return { close };
}

// ---------- Fechas (siempre como 'AAAA-MM-DD' en hora local) ----------
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDate(s, long = false) {
  const opts = long
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' };
  return parseYmd(s).toLocaleDateString('es-ES', opts);
}
export const today = () => ymd(new Date());
