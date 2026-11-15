// A shuffled pass visits every card once. Only the original card index is saved;
// confidence marks stay attached to card IDs, independent of presentation order.
import {shuffledOrder} from './card-order.js';
export {shuffledOrder} from './card-order.js';
export function startSolo(deck, progress, random) {
 const order = shuffledOrder(deck.cards.length, -1, random);
 return {order, cursor:0, progress:{...progress, index:order[0], known:[...progress.known], again:[...progress.again]}};
}
export function reshuffleSolo(solo, random) {
 solo.order = shuffledOrder(solo.deck.cards.length, solo.progress.index, random);
 solo.cursor = 0; solo.progress.index = solo.order[0]; solo.flipped = false;
}
export function advanceSolo(solo, direction = 1, random) {
 if (direction > 0 && solo.cursor === solo.order.length - 1) return reshuffleSolo(solo, random);
 solo.cursor = Math.max(0, solo.cursor + direction);
 solo.progress.index = solo.order[solo.cursor]; solo.flipped = false;
}
