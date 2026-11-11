// Ajustes: conexión al broker + habitaciones y ubicaciones (usadas por Almacenaje y, en el futuro, el mapa).

import * as store from '../store.js';
import { h, icon, field, empty, sectionTitle } from '../ui.js';
import { VERSION } from '../version.js';

function connectionForm() {
  const c = store.getConn();
  const url = h('input', { type: 'text', value: c.url || '', placeholder: 'wss://…:8084/mqtt', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  const user = h('input', { type: 'text', value: c.user || '', autocapitalize: 'off', autocomplete: 'off' });
  const pass = h('input', { type: 'password', value: c.pass || '', autocomplete: 'off' });
  const statusLine = h('p', { class: 'hint' });
  const unsub = store.onStatus((s) => { statusLine.textContent = 'Estado: ' + s.text; });

  const form = h('form', {
    class: 'panel',
    onsubmit: (e) => {
      e.preventDefault();
      store.setConn({ url: url.value.trim(), user: user.value.trim(), pass: pass.value });
    },
  },
    field('URL del broker', url),
    field('Usuario (distingue mayúsculas)', user),
    field('Contraseña', pass),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Guardar y conectar'),
    statusLine);
  return { form, unsub };
}

const updateRoom = (roomId, fn) => store.update('config', (c) => {
  c.rooms = c.rooms || [];
  const r = c.rooms.find((x) => x.id === roomId);
  if (r) fn(r);
});

function roomCard(r) {
  const locInput = h('input', { type: 'text', placeholder: 'Nueva ubicación…', autocomplete: 'off', 'aria-label': 'Nueva ubicación en ' + r.name });

  return h('div', { class: 'card room' },
    h('div', { class: 'room-head' },
      h('span', { class: 'card-title' }, r.name),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Renombrar',
        onclick: () => {
          const n = prompt('Nombre de la habitación', r.name);
          if (n && n.trim()) updateRoom(r.id, (x) => { x.name = n.trim(); });
        },
      }, icon('edit')),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Borrar habitación',
        onclick: () => {
          if (!confirm(`¿Borrar "${r.name}" y sus ubicaciones? Los objetos quedarán sin ubicar.`)) return;
          store.update('config', (c) => { c.rooms = (c.rooms || []).filter((x) => x.id !== r.id); });
          store.update('almacen', (l) => l.map((i) => (i.roomId === r.id ? { ...i, roomId: '', locationId: '' } : i)));
        },
      }, icon('trash'))),
    h('div', { class: 'chips' },
      r.locations.length
        ? r.locations.map((l) => h('span', { class: 'chip' }, l.name,
          h('button', {
            class: 'chip-x', type: 'button', 'aria-label': 'Quitar ' + l.name,
            onclick: () => {
              updateRoom(r.id, (x) => { x.locations = x.locations.filter((i) => i.id !== l.id); });
              store.update('almacen', (list) => list.map((i) => (i.locationId === l.id ? { ...i, locationId: '' } : i)));
            },
          }, '×')))
        : h('span', { class: 'hint' }, 'Sin ubicaciones')),
    h('form', {
      class: 'add-row tight',
      onsubmit: (e) => {
        e.preventDefault();
        const n = locInput.value.trim();
        if (n) updateRoom(r.id, (x) => { x.locations.push({ id: store.uid(), name: n }); });
      },
    }, locInput, h('button', { class: 'icon-btn', type: 'submit', 'aria-label': 'Añadir ubicación' }, icon('plus'))));
}

function nameForm() {
  const input = h('input', { type: 'text', value: store.getUserName(), placeholder: 'Ej. Juan', autocomplete: 'given-name' });
  const saved = h('p', { class: 'hint' }, 'Aparece en las tarjetas como quién las crea o modifica. Se guarda solo en este móvil.');
  return h('form', {
    class: 'panel',
    onsubmit: (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      store.setUserName(input.value);
      saved.textContent = 'Guardado: ' + store.getUserName();
    },
  }, field('Nombre de quien usa este móvil', input), h('button', { class: 'btn primary block', type: 'submit' }, 'Guardar nombre'), saved);
}

export default function render(root) {
  const conn = connectionForm();

  const roomInput = h('input', { type: 'text', placeholder: 'Nueva habitación…', autocomplete: 'off', 'aria-label': 'Nueva habitación' });
  const roomForm = h('form', {
    class: 'add-row',
    onsubmit: (e) => {
      e.preventDefault();
      const name = roomInput.value.trim();
      if (!name) return;
      store.update('config', (c) => { c.rooms = c.rooms || []; c.rooms.push({ id: store.uid(), name, locations: [] }); });
      roomInput.value = '';
    },
  }, roomInput, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Añadir'));

  const roomsEl = h('div', { class: 'cards' });
  const draw = () => {
    const rs = store.rooms();
    roomsEl.replaceChildren(...(rs.length ? rs.map(roomCard) : [empty('Sin habitaciones todavía.')]));
  };

  root.append(h('div', { class: 'view' },
    sectionTitle('Tu nombre'),
    nameForm(),
    sectionTitle('Conexión'),
    conn.form,
    sectionTitle('Habitaciones y ubicaciones'),
    roomForm,
    roomsEl,
    h('p', { class: 'hint center' }, 'Casa · versión ' + VERSION)));

  const unsub = store.subscribe('config', draw);
  draw();
  return () => { unsub(); conn.unsub(); };
}
