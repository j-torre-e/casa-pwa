// Menú semanal: lunes a domingo, con comida y cena. Por semanas reales, con flechas
// para ir a la siguiente o ver las anteriores. Se guarda al salir de cada campo.
// Cada día es un elemento propio (id = fecha), así los dos móviles pueden editar
// días distintos a la vez sin conflicto.

import * as store from '../store.js';
import { h, icon, ymd, today } from '../ui.js';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function weekLabel(monday) {
  const sunday = addDays(monday, 6);
  const f = (d, withMonth) => d.toLocaleDateString('es-ES', withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  const sameMonth = monday.getMonth() === sunday.getMonth();
  return `Semana del ${f(monday, !sameMonth)} al ${f(sunday, true)}`;
}

function saveMeal(dayId, meal, value) {
  store.update('semanal', (list) => {
    let d = list.find((x) => x.id === dayId);
    if (!d) { d = { id: dayId, comida: '', cena: '' }; list.push(d); }
    d[meal] = value.trim();
    return list.filter((x) => x.comida || x.cena); // los días vacíos no se guardan
  });
}

export default function render(root) {
  let monday = mondayOf(new Date());
  const label = h('span', { class: 'cal-title' });
  const toToday = h('button', { class: 'link-btn', type: 'button', onclick: () => { monday = mondayOf(new Date()); build(); } }, 'Ir a esta semana');
  const head = h('div', { class: 'cal-head' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semana anterior', onclick: () => { monday = addDays(monday, -7); build(); } }, icon('back')),
    label,
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semana siguiente', onclick: () => { monday = addDays(monday, 7); build(); } }, icon('chevron')));
  const daysEl = h('div', { class: 'week' });
  let inputs = []; // [{dayId, meal, el}]

  function build() {
    label.textContent = weekLabel(monday);
    toToday.hidden = ymd(monday) === ymd(mondayOf(new Date()));
    const now = today();
    inputs = [];
    daysEl.replaceChildren(...DAYS.map((name, i) => {
      const date = addDays(monday, i);
      const dayId = ymd(date);
      const meal = (key, lbl) => {
        const el = h('textarea', { rows: '1', placeholder: '—', 'aria-label': `${lbl} del ${name}` });
        el.addEventListener('change', () => saveMeal(dayId, key, el.value));
        inputs.push({ dayId, meal: key, el });
        return h('label', { class: 'meal' }, h('span', {}, lbl), el);
      };
      return h('div', { class: 'day-card' + (dayId === now ? ' today' : '') },
        h('div', { class: 'day-head' },
          h('span', { class: 'day-name' }, name),
          h('span', { class: 'day-date' }, date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))),
        meal('comida', 'Comida'),
        meal('cena', 'Cena'));
    }));
    fill();
  }

  // Rellena los campos con lo guardado, sin tocar el que se está escribiendo.
  function fill() {
    const byId = new Map(store.get('semanal').map((d) => [d.id, d]));
    for (const { dayId, meal, el } of inputs) {
      if (document.activeElement === el) continue;
      el.value = (byId.get(dayId) || {})[meal] || '';
    }
  }

  root.append(h('div', { class: 'view' }, head, toToday, daysEl));
  build();
  const unsub = store.subscribe('semanal', fill);
  return unsub;
}
