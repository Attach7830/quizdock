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
 if (length > 1 && order[0] === previous) {
  const j = 1 + random(length - 1); [order[0], order[j]] = [order[j], order[0]];
 }
 return order;
}
// Persist the remaining pass, so reconnecting never redraws the active card.
export function drawShuffledCard(cycle, indices, previous = -1, random = below) {
 if (!indices.length) throw new Error('A shuffled deck needs at least one card.');
 const deck = indices.join(',');
 const remaining = cycle?.deck === deck && cycle.remaining?.length
  ? [...cycle.remaining]
  : shuffledOrder(indices.length, indices.indexOf(previous), random).map(i => indices[i]);
 const index = remaining.shift();
 return {index, cycle:{deck, remaining}};
}
