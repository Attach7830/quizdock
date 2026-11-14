// A shuffled pass visits every card once. Only the original card index is saved;
// confidence marks stay attached to card IDs, independent of presentation order.
const below = max => {
 const a = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max;
 do { crypto.getRandomValues(a); } while (a[0] >= limit);
 return a[0] % max;
};
export function shuffledOrder(length, previous = -1, random = below) {
 const order = Array.from({length}, (_, i) => i);
 for (let i = length - 1; i > 0; i--) {
  const j = random(i + 1); [order[i], order[j]] = [order[j], order[i]];
 }
 // Avoid showing the last card of a pass again at the start of the next pass.
 if (length > 1 && order[0] === previous) {
  const j = 1 + random(length - 1); [order[0], order[j]] = [order[j], order[0]];
 }
 return order;
}
export function startSolo(deck, progress, random = below) {
 const order = shuffledOrder(deck.cards.length, -1, random);
 return {order, cursor:0, progress:{...progress, index:order[0], known:[...progress.known], again:[...progress.again]}};
}
export function reshuffleSolo(solo, random = below) {
 solo.order = shuffledOrder(solo.deck.cards.length, solo.progress.index, random);
 solo.cursor = 0; solo.progress.index = solo.order[0]; solo.flipped = false;
}
export function advanceSolo(solo, direction = 1, random = below) {
 if (direction > 0 && solo.cursor === solo.order.length - 1) return reshuffleSolo(solo, random);
 solo.cursor = Math.max(0, solo.cursor + direction);
 solo.progress.index = solo.order[solo.cursor]; solo.flipped = false;
}
