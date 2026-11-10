// Almacenaje: dónde está cada cosa. Habitación y ubicación se eligen de listas
// (gestionadas en Ajustes) para poder enlazarlas con el mapa más adelante.

import * as store from '../store.js';
import { h, field } from '../ui.js';
import { cardList } from '../components/cardlist.js';

const roomById = (id) => store.rooms().find((r) => r.id === id);
const locById = (room, id) => room && room.locations.find((l) => l.id === id);

function roomLocationFields(roomId, locationId) {
  const rooms = store.rooms();
  const roomSel = h('select', { value: roomId || '' },
    h('option', { value: '' }, '— Sin habitación —'),
    rooms.map((r) => h('option', { value: r.id }, r.name)));
  const locSel = h('select', {});

  const fillLocations = (selected) => {
    const r = roomById(roomSel.value);
    locSel.replaceChildren(
      h('option', { value: '' }, '— Sin ubicación —'),
      ...(r ? r.locations.map((l) => h('option', { value: l.id }, l.name)) : []));
    locSel.value = selected || '';
    locSel.disabled = !r;
  };
  fillLocations(locationId);
  roomSel.addEventListener('change', () => fillLocations(''));

  return {
    nodes: [
      field('Habitación', roomSel),
      field('Ubicación', locSel),
      rooms.length ? null : h('p', { class: 'hint' }, 'Crea habitaciones y ubicaciones en Más → Ajustes.'),
    ],
    read: () => ({ roomId: roomSel.value, locationId: locSel.value }),
  };
}

export default function render(root, params) {
  let roomFilter = params.get('room') || '';

  return cardList(root, {
    section: 'almacen',
    placeholder: 'Nuevo objeto…',
    qtyLabel: 'Cantidad',
    emptyText: 'No hay objetos aquí todavía.',
    alsoWatch: ['config'],
    openDetailOnAdd: true,
    newItem: () => ({ roomId: roomFilter, locationId: '' }),
    filter: (it) => !roomFilter || it.roomId === roomFilter,
    subtitle: (it) => {
      const r = roomById(it.roomId);
      const l = locById(r, it.locationId);
      return [r && r.name, l && l.name].filter(Boolean).join(' · ') || 'Sin ubicar';
    },
    header: (rerender) => {
      const sel = h('select', { value: roomFilter, 'aria-label': 'Filtrar por habitación' },
        h('option', { value: '' }, 'Todas las habitaciones'),
        store.rooms().map((r) => h('option', { value: r.id }, r.name)));
      sel.addEventListener('change', () => { roomFilter = sel.value; rerender(); });
      return h('div', { class: 'filter-row' }, sel);
    },
    extraFields: (it) => roomLocationFields(it.roomId, it.locationId),
  });
}
