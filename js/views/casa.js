// Mapa de la casa. De momento: plano provisional + habitaciones.
// Futuro: plano real con sensores y actuadores (store 'mapa') colocados encima,
// y al pulsar una habitación, ver lo que hay guardado en ella.

import * as store from '../store.js';
import { h, icon, sectionTitle, empty } from '../ui.js';

export default function render(root) {
  const plan = h('div', { class: 'plan-placeholder' },
    icon('hex'),
    h('p', { class: 'plan-title' }, 'Aquí irá el plano de la casa'),
    h('p', { class: 'hint' }, 'Sensores y actuadores aparecerán sobre el plano.'));

  const roomsEl = h('div', { class: 'chips' });
  const devicesEl = h('div', { class: 'list' });

  function draw() {
    const items = store.get('almacen');
    const rs = store.rooms();
    roomsEl.replaceChildren(...(rs.length
      ? rs.map((r) => {
        const n = items.filter((i) => i.roomId === r.id).length;
        return h('a', { class: 'chip', href: '#/almacen?room=' + r.id }, r.name, h('small', {}, String(n)));
      })
      : [h('p', { class: 'hint' }, 'Sin habitaciones. Créalas en Más → Ajustes.')]));

    const devices = (store.get('mapa') && store.get('mapa').devices) || [];
    devicesEl.replaceChildren(...(devices.length
      ? devices.map((d) => h('div', { class: 'row' }, h('span', { class: 'row-title' }, d.name)))
      : [empty('Sin sensores ni actuadores conectados todavía.')]));
  }

  root.append(h('div', { class: 'view' },
    plan,
    sectionTitle('Habitaciones'),
    roomsEl,
    sectionTitle('Dispositivos'),
    devicesEl));

  const unsubs = ['config', 'almacen', 'mapa'].map((s) => store.subscribe(s, draw));
  draw();
  return () => unsubs.forEach((u) => u());
}
