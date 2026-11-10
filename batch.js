import { cardList } from '../components/cardlist.js';

export default function render(root) {
  return cardList(root, {
    section: 'batch',
    placeholder: 'Nuevo plato…',
    qtyLabel: 'Raciones',
    emptyText: 'Añade lo que has cocinado.',
    subtitle: (it) => (it.qty > 0 ? (it.qty === 1 ? '1 ración' : `${it.qty} raciones`) : 'Idea para cocinar'),
  });
}
