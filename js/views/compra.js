import { cardList } from '../components/cardlist.js';

export default function render(root) {
  return cardList(root, {
    section: 'compra',
    placeholder: 'Añadir producto…',
    qtyLabel: 'Cantidad',
    emptyText: 'La lista de la compra está vacía.',
    subtitle: (it) => (it.qty > 0 ? '' : 'Habitual · pulsa + para añadir'),
  });
}
