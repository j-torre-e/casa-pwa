// Mapa de la casa: dos pisos con selector (Piso abajo / Piso arriba).
// Futuro: sensores y actuadores (store 'mapa'.devices, cada uno con su campo floor:
// 'abajo' | 'arriba' y posición x/y en % sobre el plano) colocados encima del plano.

import * as store from '../store.js';
import { h, sectionTitle, empty } from '../ui.js';

export const FLOORS = [
  { id: 'abajo', label: 'Piso abajo', src: '/img/plano-abajo.png' },
  { id: 'arriba', label: 'Piso arriba', src: '/img/plano-arriba.jpg' },
];
const FLOOR_KEY = 'casa:piso';

export default function render(root) {
  let floor = localStorage.getItem(FLOOR_KEY) || 'abajo';

  const segButtons = FLOORS.map((f) => h('button', {
    type: 'button', class: 'seg-btn', 'data-floor': f.id,
    onclick: () => { floor = f.id; localStorage.setItem(FLOOR_KEY, floor); drawPlan(); },
  }, f.label));
  const seg = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Piso' }, segButtons);

  const planImg = h('img', { class: 'plan-img', alt: '' });
  const layer = h('div', { class: 'plan-layer' }); // aquí irán los sensores y actuadores
  const plan = h('div', { class: 'plan' }, planImg, layer);

  const roomsEl = h('div', { class: 'chips' });
  const devicesEl = h('div', { class: 'list' });

  function drawPlan() {
    const f = FLOORS.find((x) => x.id === floor) || FLOORS[0];
    planImg.src = f.src;
    planImg.alt = 'Plano ' + f.label.toLowerCase();
    segButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.floor === f.id)));
    drawDevices();
  }

  function drawDevices() {
    const devices = ((store.get('mapa') && store.get('mapa').devices) || []).filter((d) => (d.floor || 'abajo') === floor);
    layer.replaceChildren(...devices.filter((d) => d.x != null && d.y != null)
      .map((d) => h('span', { class: 'device-dot', title: d.name, style: `left:${d.x}%;top:${d.y}%` })));
    devicesEl.replaceChildren(...(devices.length
      ? devices.map((d) => h('div', { class: 'row' }, h('span', { class: 'row-title' }, d.name)))
      : [empty('Sin sensores ni actuadores en este piso todavía.')]));
  }

  function drawRooms() {
    const items = store.get('almacen');
    const rs = store.rooms();
    roomsEl.replaceChildren(...(rs.length
      ? rs.map((r) => {
        const n = items.filter((i) => i.roomId === r.id).length;
        return h('a', { class: 'chip', href: '#/almacen?room=' + r.id }, r.name, h('small', {}, String(n)));
      })
      : [h('p', { class: 'hint' }, 'Sin habitaciones. Créalas en Más → Ajustes.')]));
  }

  root.append(h('div', { class: 'view' },
    seg,
    plan,
    sectionTitle('Habitaciones'),
    roomsEl,
    sectionTitle('Dispositivos'),
    devicesEl));

  drawPlan();
  drawRooms();
  const unsubs = [
    store.subscribe('config', drawRooms),
    store.subscribe('almacen', drawRooms),
    store.subscribe('mapa', drawDevices),
  ];
  return () => unsubs.forEach((u) => u());
}
