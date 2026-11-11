// Lista de tarjetas con cantidad y botones − / +.
// La comparten Batch cooking, Lista de la compra y Almacenaje.
// Con cantidad 0 la tarjeta pasa a gris y baja al final (sirve de "ideas" / "habituales").

import * as store from '../store.js';
import { h, icon, sheet, field, empty, auditLine } from '../ui.js';

export function cardList(root, opts) {
  const {
    section,                 // sección del store
    placeholder,             // texto del campo de añadir
    qtyLabel = 'Cantidad',
    emptyText = 'Todavía no hay nada.',
    subtitle,                // (item) => texto bajo el nombre
    filter,                  // (item) => bool
    header,                  // (rerender) => nodo extra bajo el campo de añadir
    extraFields,             // (item) => { nodes, read() } campos extra en el detalle
    newItem,                 // () => campos extra al crear
    openDetailOnAdd = false,
    alsoWatch = [],          // otras secciones que obligan a repintar
  } = opts;

  const input = h('input', { type: 'text', placeholder, autocomplete: 'off', 'aria-label': placeholder });
  const addForm = h('form', {
    class: 'add-row',
    onsubmit: (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      const item = { id: store.uid(), name, qty: 1, desc: '', ...(newItem ? newItem() : {}) };
      store.update(section, (list) => { list.push(item); });
      input.value = '';
      if (openDetailOnAdd) openDetail(item.id);
    },
  }, input, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Añadir'));

  const list = h('div', { class: 'cards' });

  function render() {
    let items = store.get(section).slice();
    if (filter) items = items.filter(filter);
    items.sort((a, b) =>
      (a.qty > 0 ? 0 : 1) - (b.qty > 0 ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
    list.replaceChildren(...(items.length ? items.map(card) : [empty(emptyText)]));
  }

  function card(it) {
    const zero = !(it.qty > 0);
    const sub = subtitle ? subtitle(it) : '';
    return h('div', { class: 'card' + (zero ? ' zero' : '') },
      h('button', { class: 'card-main', type: 'button', onclick: () => openDetail(it.id) },
        h('span', { class: 'card-title' }, it.name),
        sub ? h('span', { class: 'card-sub' }, sub) : null),
      h('div', { class: 'stepper' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quitar uno', disabled: zero, onclick: () => change(it.id, -1) }, icon('minus')),
        h('span', { class: 'qty' }, String(it.qty || 0)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Añadir uno', onclick: () => change(it.id, 1) }, icon('plus'))));
  }

  function change(id, delta) {
    store.update(section, (list) => {
      const x = list.find((i) => i.id === id);
      if (x) x.qty = Math.max(0, (x.qty || 0) + delta);
    });
  }

  function openDetail(id) {
    const it = store.get(section).find((i) => i.id === id);
    if (!it) return;
    const name = h('input', { type: 'text', value: it.name, required: true });
    const qty = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: String(it.qty || 0) });
    const desc = h('textarea', { rows: '3', placeholder: 'Descripción breve' }, it.desc || '');
    const extra = extraFields ? extraFields(it) : null;

    sheet(it.name, [field('Nombre', name), field(qtyLabel, qty), extra && extra.nodes, field('Descripción', desc), auditLine(it)], {
      onSave: () => store.update(section, (list) => {
        const x = list.find((i) => i.id === id);
        if (!x) return;
        x.name = name.value.trim() || x.name;
        x.qty = Math.max(0, parseInt(qty.value, 10) || 0);
        x.desc = desc.value;
        if (extra) Object.assign(x, extra.read());
      }),
      onDelete: () => store.update(section, (list) => list.filter((i) => i.id !== id)),
    });
  }

  root.append(h('div', { class: 'view' }, addForm, header ? header(render) : null, list));

  const unsubs = [section, ...alsoWatch].map((s) => store.subscribe(s, render));
  render();
  return () => unsubs.forEach((u) => u());
}
