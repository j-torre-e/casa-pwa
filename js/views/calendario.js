// Calendario general: eventos (visitas, viajes…) + tareas con fecha.

import * as store from '../store.js';
import { h, icon, sheet, field, empty, sectionTitle, ymd, fmtDate, today, auditLine } from '../ui.js';
import { taskRow } from './tareas.js';

const TYPES = { visita: 'Visita', viaje: 'Viaje', otro: 'Otro' };
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function eventSheet(id, day) {
  const isNew = !id;
  const e = isNew
    ? { title: '', type: 'visita', start: day, end: '', notes: '' }
    : store.get('calendario').find((x) => x.id === id);
  if (!e) return;

  const title = h('input', { type: 'text', value: e.title, required: true, placeholder: 'Ej. Visita de los abuelos' });
  const type = h('select', { value: e.type }, Object.entries(TYPES).map(([k, v]) => h('option', { value: k }, v)));
  const start = h('input', { type: 'date', value: e.start, required: true });
  const end = h('input', { type: 'date', value: e.end || '' });
  const notes = h('textarea', { rows: '3', placeholder: 'Notas' }, e.notes || '');

  sheet(isNew ? 'Nuevo evento' : 'Evento', [
    field('Título', title), field('Tipo', type), field('Desde', start),
    field('Hasta (opcional)', end), field('Notas', notes),
    isNew ? null : auditLine(e),
  ], {
    onSave: () => {
      const data = {
        title: title.value.trim(),
        type: type.value,
        start: start.value,
        end: end.value && end.value > start.value ? end.value : '',
        notes: notes.value,
      };
      if (!data.title || !data.start) return false;
      store.update('calendario', (list) => {
        if (isNew) list.push({ id: store.uid(), ...data });
        else Object.assign(list.find((i) => i.id === id) || {}, data);
      });
    },
    onDelete: isNew ? null : () => store.update('calendario', (list) => list.filter((i) => i.id !== id)),
  });
}

export default function render(root) {
  const cursor = new Date();
  cursor.setDate(1);
  let selected = today();

  const monthTitle = h('span', { class: 'cal-title' });
  const head = h('div', { class: 'cal-head' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior', onclick: () => { cursor.setMonth(cursor.getMonth() - 1); draw(); } }, icon('back')),
    monthTitle,
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => { cursor.setMonth(cursor.getMonth() + 1); draw(); } }, icon('chevron')));
  const grid = h('div', { class: 'cal-grid' });
  const dayTitle = sectionTitle('');
  const dayList = h('div', { class: 'list' });
  const addBtn = h('button', { class: 'btn primary block', type: 'button', onclick: () => eventSheet(null, selected) }, icon('plus'), 'Añadir evento');

  const itemsOn = (day) => ({
    events: store.get('calendario').filter((e) => e.start <= day && (e.end || e.start) >= day),
    tasks: store.get('tareas').filter((t) => t.date === day),
  });

  function draw() {
    const month = cursor.toLocaleDateString('es-ES', { month: 'long' });
    monthTitle.textContent = month.charAt(0).toUpperCase() + month.slice(1) + ' ' + cursor.getFullYear();
    const offset = (cursor.getDay() + 6) % 7; // lunes = 0
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset);
    const now = today();

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      const key = ymd(d);
      const { events, tasks } = itemsOn(key);
      const cls = ['cal-day',
        d.getMonth() !== cursor.getMonth() && 'out',
        key === now && 'today',
        key === selected && 'sel'].filter(Boolean).join(' ');
      cells.push(h('button', { type: 'button', class: cls, onclick: () => { selected = key; draw(); } },
        h('span', { class: 'num' }, d.getDate()),
        h('span', { class: 'dots' },
          events.length ? h('i', { class: 'dot ev' }) : null,
          tasks.length ? h('i', { class: 'dot task' }) : null)));
    }
    grid.replaceChildren(...WEEKDAYS.map((w) => h('span', { class: 'cal-wd' }, w)), ...cells);

    dayTitle.textContent = fmtDate(selected, true);
    const { events, tasks } = itemsOn(selected);
    const rows = [
      ...events.map((e) => h('button', { class: 'row row-btn', type: 'button', onclick: () => eventSheet(e.id) },
        h('span', { class: 'tag tag-' + e.type }, TYPES[e.type] || 'Evento'),
        h('span', { class: 'row-title' }, e.title))),
      ...tasks.map((t) => taskRow(t, { showDate: false })),
    ];
    dayList.replaceChildren(...(rows.length ? rows : [empty('Nada este día.')]));
  }

  root.append(h('div', { class: 'view' }, head, grid, dayTitle, dayList, addBtn));
  const unsubs = ['calendario', 'tareas'].map((s) => store.subscribe(s, draw));
  draw();
  return () => unsubs.forEach((u) => u());
}
