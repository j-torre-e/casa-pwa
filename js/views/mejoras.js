// Mejoras de la app: ideas de cambios, asociadas a una sección y con estado.
// Estados: Nuevo · En curso · Bloqueada (con motivo o quién) · Hecha.
// Las hechas bajan al final en gris y se pueden seguir consultando.

import * as store from '../store.js';
import { h, icon, sheet, field, empty, sectionTitle, today, auditLine } from '../ui.js';

export const SECTION_OPTIONS = [
  ['casa', 'Casa'],
  ['tareas', 'Tareas'],
  ['batch', 'Batch cooking'],
  ['calendario', 'Calendario'],
  ['compra', 'Lista de la compra'],
  ['almacen', 'Almacenaje'],
  ['menu', 'Menú Trueba'],
  ['semanal', 'Menú semanal'],
  ['ajustes', 'Ajustes'],
  ['mejoras', 'Mejoras'],
  ['nueva', 'Nueva sección'],
  ['otros', 'Otros'],
];
const LABELS = Object.fromEntries(SECTION_OPTIONS);

export const STATUSES = [
  ['nuevo', 'Nuevo'],
  ['curso', 'En curso'],
  ['bloqueada', 'Bloqueada'],
  ['hecha', 'Hecha'],
];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const STATUS_ORDER = { curso: 0, nuevo: 1, bloqueada: 2, hecha: 3 };

// Las mejoras antiguas no tienen estado: se deduce de "hecha".
export const statusOf = (m) => m.status || (m.done ? 'hecha' : 'nuevo');

const sectionLabel = (m) => (m.section === 'nueva' && m.newSection ? 'Nueva: ' + m.newSection : LABELS[m.section] || 'Otros');

function applyStatus(x, status) {
  const wasDone = statusOf(x) === 'hecha';
  x.status = status;
  x.done = status === 'hecha';
  if (x.done && !wasDone) x.doneAt = today();
  if (!x.done) x.doneAt = '';
  if (status !== 'bloqueada') x.blockedReason = '';
}

function setStatus(id, status) {
  store.update('mejoras', (list) => {
    const x = list.find((i) => i.id === id);
    if (x) applyStatus(x, status);
  });
}

function mejoraSheet(id) {
  const isNew = !id;
  const m = isNew
    ? { name: '', desc: '', section: 'otros', newSection: '', status: 'nuevo', blockedReason: '' }
    : store.get('mejoras').find((x) => x.id === id);
  if (!m) return;

  const name = h('input', { type: 'text', value: m.name, required: true, placeholder: 'Ej. Agrupar la compra por tienda' });
  const section = h('select', { value: m.section }, SECTION_OPTIONS.map(([k, v]) => h('option', { value: k }, v)));
  const newSection = h('input', { type: 'text', value: m.newSection || '', placeholder: 'Nombre de la nueva sección' });
  const newField = field('Nombre de la nueva sección', newSection);
  const status = h('select', { value: statusOf(m) }, STATUSES.map(([k, v]) => h('option', { value: k }, v)));
  const reason = h('input', { type: 'text', value: m.blockedReason || '', placeholder: 'Ej. Esperando a la Raspberry · Juan' });
  const reasonField = field('Motivo o quién la bloquea', reason);
  const desc = h('textarea', { rows: '4', placeholder: 'Qué cambiar y por qué' }, m.desc || '');

  const sync = () => {
    newField.hidden = section.value !== 'nueva';
    reasonField.hidden = status.value !== 'bloqueada';
  };
  section.addEventListener('change', sync);
  status.addEventListener('change', sync);
  sync();

  sheet(isNew ? 'Nueva mejora' : 'Mejora', [
    field('Mejora', name),
    field('Sección que cambia', section),
    newField,
    field('Estado', status),
    reasonField,
    field('Descripción', desc),
    isNew ? null : auditLine(m),
  ], {
    onSave: () => {
      const data = {
        name: name.value.trim(),
        section: section.value,
        newSection: section.value === 'nueva' ? newSection.value.trim() : '',
        desc: desc.value,
      };
      if (!data.name) return false;
      store.update('mejoras', (list) => {
        let x = isNew ? null : list.find((i) => i.id === id);
        if (isNew) { x = { id: store.uid(), doneAt: '' }; list.push(x); }
        if (!x) return;
        Object.assign(x, data);
        applyStatus(x, status.value);
        if (status.value === 'bloqueada') x.blockedReason = reason.value.trim();
      });
    },
    onDelete: isNew ? null : () => store.update('mejoras', (list) => list.filter((i) => i.id !== id)),
  });
}

function row(m) {
  const st = statusOf(m);
  const done = st === 'hecha';
  return h('div', { class: 'row' + (done ? ' done faded' : '') },
    h('input', {
      type: 'checkbox', class: 'check', checked: done, 'aria-label': 'Hecha',
      onchange: (e) => setStatus(m.id, e.target.checked ? 'hecha' : 'nuevo'),
    }),
    h('button', { class: 'row-main stacked', type: 'button', onclick: () => mejoraSheet(m.id) },
      h('span', { class: 'row-title' }, m.name),
      h('span', { class: 'row-meta' },
        h('span', { class: 'tag status-' + st }, STATUS_LABEL[st]),
        h('span', { class: 'tag tag-otro' }, sectionLabel(m)),
        st === 'bloqueada' && m.blockedReason
          ? h('span', { class: 'row-desc' }, m.blockedReason)
          : (m.desc ? h('span', { class: 'row-desc' }, m.desc) : null))));
}

export default function render(root) {
  const pending = h('div', { class: 'list' });
  const doneTitle = sectionTitle('');
  const doneList = h('div', { class: 'list' });

  function draw() {
    const all = store.get('mejoras') || [];
    const open = all.filter((m) => statusOf(m) !== 'hecha')
      .sort((a, b) => STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)]);
    const closed = all.filter((m) => statusOf(m) === 'hecha')
      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    pending.replaceChildren(...(open.length ? open.map(row) : [empty('Sin mejoras pendientes.')]));
    doneTitle.textContent = `Hechas (${closed.length})`;
    doneTitle.hidden = !closed.length;
    doneList.replaceChildren(...closed.map(row));
  }

  root.append(h('div', { class: 'view' },
    h('button', { class: 'btn primary block top', type: 'button', onclick: () => mejoraSheet(null) }, icon('plus'), 'Nueva mejora'),
    pending, doneTitle, doneList));

  const unsub = store.subscribe('mejoras', draw);
  draw();
  return unsub;
}
