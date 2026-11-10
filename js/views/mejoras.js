// Mejoras de la app: ideas de cambios, asociadas a una sección.
// Las hechas bajan al final en gris y se pueden seguir consultando.

import * as store from '../store.js';
import { h, icon, sheet, field, empty, sectionTitle, today } from '../ui.js';

export const SECTION_OPTIONS = [
  ['casa', 'Casa'],
  ['tareas', 'Tareas'],
  ['batch', 'Batch cooking'],
  ['calendario', 'Calendario'],
  ['compra', 'Lista de la compra'],
  ['almacen', 'Almacenaje'],
  ['ajustes', 'Ajustes'],
  ['mejoras', 'Mejoras'],
  ['nueva', 'Nueva sección'],
  ['otros', 'Otros'],
];
const LABELS = Object.fromEntries(SECTION_OPTIONS);

const sectionLabel = (m) => (m.section === 'nueva' && m.newSection ? 'Nueva: ' + m.newSection : LABELS[m.section] || 'Otros');

function setDone(id, done) {
  store.update('mejoras', (list) => {
    const x = list.find((i) => i.id === id);
    if (x) { x.done = done; x.doneAt = done ? today() : ''; }
  });
}

function mejoraSheet(id) {
  const isNew = !id;
  const m = isNew
    ? { name: '', desc: '', section: 'otros', newSection: '', done: false }
    : store.get('mejoras').find((x) => x.id === id);
  if (!m) return;

  const name = h('input', { type: 'text', value: m.name, required: true, placeholder: 'Ej. Agrupar la compra por tienda' });
  const section = h('select', { value: m.section }, SECTION_OPTIONS.map(([k, v]) => h('option', { value: k }, v)));
  const newSection = h('input', { type: 'text', value: m.newSection || '', placeholder: 'Nombre de la nueva sección' });
  const newField = field('Nombre de la nueva sección', newSection);
  const syncNew = () => { newField.hidden = section.value !== 'nueva'; };
  section.addEventListener('change', syncNew);
  syncNew();
  const desc = h('textarea', { rows: '4', placeholder: 'Qué cambiar y por qué' }, m.desc || '');
  const done = h('input', { type: 'checkbox', class: 'check', checked: m.done });

  sheet(isNew ? 'Nueva mejora' : 'Mejora', [
    field('Mejora', name),
    field('Sección que cambia', section),
    newField,
    field('Descripción', desc),
    isNew ? null : h('label', { class: 'check-row' }, done, h('span', {}, m.done && m.doneAt ? `Hecha (${m.doneAt})` : 'Marcar como hecha')),
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
        if (isNew) {
          list.push({ id: store.uid(), ...data, done: false, doneAt: '', created: today() });
        } else {
          const x = list.find((i) => i.id === id);
          if (!x) return;
          Object.assign(x, data);
          if (x.done !== done.checked) { x.done = done.checked; x.doneAt = done.checked ? today() : ''; }
        }
      });
    },
    onDelete: isNew ? null : () => store.update('mejoras', (list) => list.filter((i) => i.id !== id)),
  });
}

function row(m) {
  return h('div', { class: 'row' + (m.done ? ' done faded' : '') },
    h('input', {
      type: 'checkbox', class: 'check', checked: m.done, 'aria-label': 'Hecha',
      onchange: (e) => setDone(m.id, e.target.checked),
    }),
    h('button', { class: 'row-main stacked', type: 'button', onclick: () => mejoraSheet(m.id) },
      h('span', { class: 'row-title' }, m.name),
      h('span', { class: 'row-meta' },
        h('span', { class: 'tag' }, sectionLabel(m)),
        m.desc ? h('span', { class: 'row-desc' }, m.desc) : null)));
}

export default function render(root) {
  const pending = h('div', { class: 'list' });
  const doneTitle = sectionTitle('');
  const doneList = h('div', { class: 'list' });

  function draw() {
    const all = store.get('mejoras') || [];
    const open = all.filter((m) => !m.done);
    const closed = all.filter((m) => m.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
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
