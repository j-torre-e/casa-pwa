// Aviso de conflicto: aparece cuando los dos móviles cambiaron lo mismo sin conexión.
// No se puede cerrar sin elegir qué versión se queda en cada elemento.

import * as store from '../store.js';
import { h, sheet } from '../ui.js';
import { eq } from '../sync.js';

const SECTION_LABEL = {
  batch: 'Batch cooking', compra: 'Lista de la compra', tareas: 'Tareas', calendario: 'Calendario',
  almacen: 'Almacenaje', mejoras: 'Mejoras de la app', config: 'Ajustes', mapa: 'Mapa',
  semanal: 'Menú semanal',
};
const HIDDEN_KEYS = new Set(['id', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt']);
const FIELD_LABEL = {
  name: 'Nombre', title: 'Título', qty: 'Cantidad', desc: 'Descripción', notes: 'Notas',
  done: 'Hecha', date: 'Fecha', start: 'Desde', end: 'Hasta', type: 'Tipo',
  roomId: 'Habitación', locationId: 'Ubicación', section: 'Sección', newSection: 'Nueva sección',
  locations: 'Ubicaciones', doneAt: 'Hecha el', created: 'Creada', value: 'Valor',
  status: 'Estado', blockedReason: 'Motivo del bloqueo', comida: 'Comida', cena: 'Cena',
};

function fmt(key, v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (key === 'roomId') return (store.rooms().find((r) => r.id === v) || {}).name || v;
  if (key === 'locationId') {
    for (const r of store.rooms()) { const l = r.locations.find((x) => x.id === v); if (l) return l.name; }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => (x && (x.name || x.title)) || String(x)).join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const itemName = (it) => it && (it.name || it.title);

function diffTable(c) {
  const l = c.local; const r = c.remote;
  let rows;
  if (!l || !r) {
    rows = [['Estado', l ? 'Existe' : 'Borrado', r ? 'Existe' : 'Borrado']];
    const it = l || r;
    Object.keys(it).filter((k) => !HIDDEN_KEYS.has(k)).forEach((k) => rows.push([FIELD_LABEL[k] || k, l ? fmt(k, l[k]) : '—', r ? fmt(k, r[k]) : '—']));
  } else {
    const keys = [...new Set([...Object.keys(l), ...Object.keys(r)])].filter((k) => !HIDDEN_KEYS.has(k) && !eq(l[k], r[k]));
    rows = keys.map((k) => [FIELD_LABEL[k] || k, fmt(k, l[k]), fmt(k, r[k])]);
  }
  return h('table', { class: 'diff-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Este móvil'), h('th', {}, 'Otro móvil'))),
    h('tbody', {}, rows.map(([label, a, b]) => h('tr', {}, h('th', {}, label), h('td', {}, a), h('td', {}, b)))));
}

function conflictBlock(c, i) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(c.key) ? new Date(c.key + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) : '';
  const name = itemName(c.local) || itemName(c.remote) || day || FIELD_LABEL[c.key] || c.key;
  const state = (it) => (it ? 'Modificado' : 'Borrado');
  const radio = (value) => h('input', { type: 'radio', name: 'conflict-' + i, value, required: true });
  const local = radio('local');
  const remote = radio('remote');

  const details = h('div', { class: 'diff', hidden: true }, diffTable(c));
  const toggle = h('button', {
    type: 'button', class: 'diff-toggle',
    onclick: () => {
      details.hidden = !details.hidden;
      toggle.textContent = details.hidden ? '+ Ver diferencias' : '− Ocultar diferencias';
    },
  }, '+ Ver diferencias');

  const el = h('div', { class: 'conflict' },
    h('div', { class: 'conflict-name' }, name),
    h('div', { class: 'choices' },
      h('label', { class: 'choice' }, local, h('span', {}, 'Este móvil'), h('small', {}, state(c.local))),
      h('label', { class: 'choice' }, remote, h('span', {}, 'Otro móvil'), h('small', {}, state(c.remote)))),
    toggle, details);
  return { el, choice: () => (local.checked ? 'local' : 'remote') };
}

const queue = [];
let showing = false;

function next() {
  if (showing || !queue.length) return;
  showing = true;
  const { section, conflicts } = queue.shift();
  const blocks = conflicts.map(conflictBlock);
  let resolved = false;

  sheet('Conflicto en ' + (SECTION_LABEL[section] || section), [
    h('p', { class: 'hint' }, 'Este móvil y el otro cambiaron lo mismo mientras no había conexión. Elige qué versión se queda en cada caso. El resto ya se ha fusionado solo.'),
    blocks.map((b) => b.el),
  ], {
    dismissable: false,
    saveLabel: 'Aplicar',
    onSave: () => {
      const choices = {};
      conflicts.forEach((c, i) => { choices[c.key] = blocks[i].choice(); });
      resolved = true;
      store.resolve(section, choices);
    },
    onClose: () => {
      showing = false;
      if (!resolved) queue.unshift({ section, conflicts }); // no se puede saltar
      setTimeout(next, resolved ? 0 : 300);
    },
  });
}

export function initConflicts() {
  store.onConflict((ev) => {
    const i = queue.findIndex((q) => q.section === ev.section);
    if (i >= 0) queue[i] = ev; else queue.push(ev);
    next();
  });
}
