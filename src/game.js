// Portable, dependency-free rules for the four original game modes.
export const MODES = ['treasure', 'fishing', 'battle', 'factory'];
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 250;
export const MAX_PLAYERS = 45;
export const MAX_ROOM_MINUTES = 30;

export function randomId(bytes = 16) {
  const buff = new Uint8Array(bytes);
  crypto.getRandomValues(buff);
  return Array.from(buff, n => n.toString(16).padStart(2, '0')).join('');
}
export function randomInt(min, max) {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return min + (data[0] % (max - min + 1));
}
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function cleanText(value, limit = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
}
export function validateQuestions(input) {
  if (!Array.isArray(input) || input.length < MIN_QUESTIONS || input.length > MAX_QUESTIONS) {
    throw new Error(`Import between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions.`);
  }
  return input.map((raw, i) => {
    const text = cleanText(raw?.text, 400);
    const answers = Array.isArray(raw?.answers) ? raw.answers.map(a => cleanText(a, 180)) : [];
    const correct = Array.isArray(raw?.correct) ? raw.correct : [raw?.correct];
    if (!text || answers.length < 2 || answers.length > 4 || answers.some(a => !a)) {
      throw new Error(`Question ${i + 1} must have a prompt and 2–4 nonempty answer options.`);
    }
    if (new Set(answers.map(a => a.toLocaleLowerCase())).size !== answers.length) {
      throw new Error(`Question ${i + 1} contains duplicate answer choices.`);
    }
    const indices = [...new Set(correct.map(Number))];
    if (!indices.length || indices.some(n => !Number.isInteger(n) || n < 0 || n >= answers.length)) {
      throw new Error(`Question ${i + 1} has an invalid correct answer.`);
    }
    return { text, answers, correct: indices };
  });
}
export function newPlayer(id, token, name, questions) {
  return {
    id, token, name, joinedAt: Date.now(), answered: 0, correct: 0, streak: 0,
    score: 0, coins: 0, cash: 0, fishCount: 0, biggestFish: 0,
    rodLevel: 0, machineLevel: 0, hp: 100, knockouts: 0,
    lastAnswerAt: 0, current: createQuestion(questions, 0),
    feedback: null, pendingChests: null
  };
}
export function createQuestion(questions, answered) {
  if (!questions.length) return null;
  const index = answered % questions.length;
  return { index, key: randomId(6), order: shuffle(questions[index].answers.map((_, i) => i)) };
}
export function publicQuestion(q, current) {
  if (!q || !current) return null;
  return { key: current.key, text: q.text, options: current.order.map(i => q.answers[i]), number: current.index + 1 };
}
export function scoreboard(players, mode) {
  return Object.values(players).map(p => ({
    id: p.id, name: p.name, score: mode === 'treasure' ? p.coins : mode === 'factory' ? p.cash : p.score,
    correct: p.correct, answered: p.answered, streak: p.streak, hp: p.hp,
    fishCount: p.fishCount, biggestFish: p.biggestFish,
    machineLevel: p.machineLevel, rodLevel: p.rodLevel, knockouts: p.knockouts
  })).sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
}
export function grantAnswerReward(room, player) {
  const mode = room.mode;
  if (mode === 'treasure') {
    const rewards = shuffle([
      { kind: 'coins', amount: randomInt(20, 60), text: 'Found treasure!' },
      { kind: 'coins', amount: randomInt(15, 45), text: 'A chest full of coins!' },
      { kind: 'steal', amount: randomInt(10, 35), text: 'Pirate swap!' }
    ]);
    player.pendingChests = rewards;
    return { text: 'Choose a mystery chest!', needsChest: true };
  }
  if (mode === 'fishing') {
    const weight = Math.round((randomInt(6, 60) / 10) * (1 + player.rodLevel * 0.4) * 10) / 10;
    const points = Math.round(weight * 10);
    player.fishCount++;
    player.biggestFish = Math.max(player.biggestFish, weight);
    player.score += points;
    return { text: `You caught a ${weight.toFixed(1)} kg fish! +${points} points`, points };
  }
  if (mode === 'factory') {
    const earned = 35 + Math.min(player.streak * 5, 25);
    player.cash += earned;
    player.score = player.cash;
    return { text: `Factory profits! +$${earned}`, points: earned };
  }
  // In Battle Arena points reflect accuracy and streaks. Hit opponents separately.
  const points = 60 + Math.min(player.streak * 10, 50);
  player.score += points;
  const targets = Object.values(room.players).filter(p => p.id !== player.id);
  if (targets.length) {
    const target = targets[randomInt(0, targets.length - 1)];
    target.hp -= 20;
    if (target.hp <= 0) { target.hp = 100; player.knockouts++; player.score += 100; }
    return { text: `+${points} points! You hit ${target.name} for 20 HP.`, points };
  }
  return { text: `+${points} points! Another player can join the battle.`, points };
}
export function openChest(room, player, chosen) {
  if (!player.pendingChests || !Number.isInteger(chosen) || chosen < 0 || chosen > 2) {
    throw new Error('Choose an available chest.');
  }
  const reward = player.pendingChests[chosen];
  player.pendingChests = null;
  if (reward.kind === 'steal') {
    const rivals = Object.values(room.players).filter(p => p.id !== player.id && p.coins > 0);
    if (rivals.length) {
      const target = rivals[randomInt(0, rivals.length - 1)];
      const amount = Math.min(target.coins, reward.amount);
      target.coins -= amount;
      player.coins += amount;
      return { text: `Pirate raid! You took ${amount} coins from ${target.name}.`, points: amount };
    }
    player.coins += reward.amount;
    return { text: `No rivals to raid: you found ${reward.amount} coins instead!`, points: reward.amount };
  }
  player.coins += reward.amount;
  return { text: `${reward.text} +${reward.amount} coins`, points: reward.amount };
}
export function upgrade(room, player) {
  if (room.mode === 'fishing') {
    const cost = (player.rodLevel + 1) * 100;
    if (player.score < cost) throw new Error(`You need ${cost} points to upgrade your rod.`);
    player.score -= cost;
    player.rodLevel++;
    return { text: `Rod upgraded to level ${player.rodLevel}!`, cost };
  }
  if (room.mode === 'factory') {
    const cost = (player.machineLevel + 1) * 120;
    if (player.cash < cost) throw new Error(`You need $${cost} to buy a machine.`);
    player.cash -= cost;
    player.score = player.cash;
    player.machineLevel++;
    return { text: `Bought machine level ${player.machineLevel}. It earns $8 per 5 seconds.`, cost };
  }
  throw new Error('Upgrades are only available in Fishing and Factory.');
}
export function settleTime(room, now = Date.now()) {
  if (!room || room.status !== 'playing') return false;
  let changed = false;
  if (room.mode === 'factory' && room.lastPassiveAt) {
    const periods = Math.floor((Math.min(now, room.endsAt) - room.lastPassiveAt) / 5000);
    if (periods > 0) {
      for (const p of Object.values(room.players)) {
        p.cash += periods * 8 * p.machineLevel;
        p.score = p.cash;
      }
      room.lastPassiveAt += periods * 5000;
      changed = true;
    }
  }
  if (now >= room.endsAt) { room.status = 'finished'; changed = true; }
  return changed;
}
