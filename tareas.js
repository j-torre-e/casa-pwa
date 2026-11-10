// Tareas. Las que tienen fecha aparecen también en el calendario.

import * as store from '../store.js';
import { h, icon, sheet, field, empty, fmtDate, today } from '../ui.js';

export function toggleTask(id, done) {
  store.update('tareas', (list) => {
    const x = list.find((t) => t.id === id);
    if (x) x.done = done;
  });
}

export function taskSheet(id) {
  const t = store.get('tareas').find((x) => x.id === id);
  if (!t) return;
  const title = h('input', { type: 'text', value: t.title, required: true });
  const date = h('input', { type: 'date', value: t.date || '' });
  const notes = h('textarea', { rows: '3', placeholder: 'Notas' }, t.notes || '');

  sheet('Tarea', [
    field('Título', title),
    field('Fecha (opcional · aparece en el calendario)', date),
    field('Notas', notes),
  ], {
    onSave: () => store.update('tareas', (list) => {
      const x = list.find((i) => i.id === id);
      if (!x) return;
      x.title = title.value.trim() || x.title;
      x.date = date.value;
      x.notes = notes.value;
    }),
    onDelete: () => store.update('tareas', (list) => list.filter((i) => i.id !== id)),
  });
}

export function taskRow(t, { showDate = true } = {}) {
  const late = !t.done && t.date && t.date < today();
  return h('div', { class: 'row' + (t.done ? ' done' : '') },
    h('input', {
      type: 'checkbox', class: 'check', checked: t.done, 'aria-label': 'Hecha',
      onchange: (e) => toggleTask(t.id, e.target.checked),
    }),
    h('button', { class: 'row-main', type: 'button', onclick: () => taskSheet(t.id) },
      h('span', { class: 'row-title' }, t.title),
      showDate && t.date ? h('span', { class: 'badge' + (late ? ' late' : '') }, fmtDate(t.date)) : null));
}

export default function render(root) {
  const input = h('input', { type: 'text', placeholder: 'Nueva tarea…', autocomplete: 'off', 'aria-label': 'Nueva tarea' });
  const addForm = h('form', {
    class: 'add-row',
    onsubmit: (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      store.update('tareas', (list) => { list.push({ id: store.uid(), title, done: false, date: '', notes: '' }); });
      input.value = '';
    },
  }, input, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Añadir'));

  const list = h('div', { class: 'list' });
  const key = (t) => t.date || '9999-99-99';

  function draw() {
    const items = store.get('tareas').slice()
      .sort((a, b) => (a.done - b.done) || key(a).localeCompare(key(b)));
    list.replaceChildren(...(items.length ? items.map((t) => taskRow(t)) : [empty('Sin tareas. Añade la primera.')]));
  }

  root.append(h('div', { class: 'view' }, addForm, list));
  const unsub = store.subscribe('tareas', draw);
  draw();
  return unsub;
}
