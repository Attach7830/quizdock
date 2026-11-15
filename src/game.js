import {roleById} from '../public/js/catalog.js';
import {imageURL} from '../public/js/list-model.js';
// Portable base rules for six modes; new-round strategy lives in gameplay.js.
export const MODES = ['treasure', 'fishing', 'battle', 'factory', 'rally', 'keep', 'word', 'sketch'];
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 250;
export const MAX_PLAYERS = 45;
export const MAX_ROOM_MINUTES = 60;

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
  const result=input.map((raw, i) => {
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
    const cardId=/^[a-zA-Z0-9_-]{8,80}$/.test(String(raw?.cardId||''))?String(raw.cardId):crypto.randomUUID();
    const image=imageURL(raw?.image);
    return { cardId, text, answers, correct: indices, ...(image?{image,imageAlt:cleanText(raw?.imageAlt||'Question image',300)}:{}) };
  });
  if(new Set(result.map(q=>q.cardId)).size!==result.length)throw new Error('Question card identifiers must be unique.');
  return result;
}
export function newPlayer(id, token, name, questions) {
  return {
    id, token, name, joinedAt: Date.now(), answered: 0, correct: 0, streak: 0,
    score: 0, coins: 0, cash: 0, fishCount: 0, biggestFish: 0,
    rodLevel: 0, machineLevel: 0, hp: 100, knockouts: 0,
    roleType: null, accountId: null, skin: 'mint', email: null, lastEvent:null, lastAnswerAt: 0, current: createQuestion(questions, 0),
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
  return { key: current.key, text: q.text, options: current.order.map(i => q.answers[i]), number: current.index + 1, ...(q.image?{image:q.image,imageAlt:q.imageAlt}:{}) };
}
export function scoreboard(players, mode) {
  return Object.values(players).map(p => ({
    id: p.id, name: p.name, skin:p.skin||'mint', roleType:p.roleType, score: mode === 'treasure' ? p.coins : mode === 'factory' ? p.cash+(p.adventure?.assetValue||0) : p.score,
    correct: p.correct, answered: p.answered, streak: p.streak, hp: p.hp,
    fishCount: p.fishCount, biggestFish: p.biggestFish,
    machineLevel: p.machineLevel, rodLevel: p.rodLevel, knockouts: p.knockouts,shield:p.adventure?.shield||0,charge:p.adventure?.charge||0,protected:p.adventure?.protectedAt===p.answered,vault:p.adventure?.vault||0,discoveries:p.adventure?.collection?.length||0,orders:p.adventure?.orders||0
  })).sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
}
export function grantAnswerReward(room, player) {
  const mode = room.mode;
  if(mode==='rally'||mode==='keep'){
    const role=roleById(mode,player.roleType);if(!role)throw new Error('Choose a player type first.');
    const bonus=Math.min(player.streak,5)*(player.roleType==='ace'?6:3),points=role.gain+bonus;
    player.score+=points;
    if(mode==='keep'&&player.roleType==='mender')player.hp=Math.min(100,player.hp+10);
    return {text:mode==='rally'?`Tailwind! +${points} distance`:`Crystal charged! +${points} energy`,points,effect:{type:mode==='rally'?'boost':'charge',amount:points}};
  }
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
    return { text: `You caught a ${weight.toFixed(1)} kg fish! +${points} points`, points, effect:{type:'catch',weight,points} };
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
    return { text: `+${points} points! You hit ${target.name} for 20 HP.`, points, effect:{type:'attack',targetId:target.id,targetName:target.name} };
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
      return { text: `Pirate raid! You took ${amount} coins from ${target.name}.`, points: amount, effect:{type:'raid',amount,targetId:target.id,targetName:target.name} };
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
    if(room.gameplay?.version===1&&player.adventure?.mode==='factory')player.adventure.assetValue+=cost;
    player.score = player.cash+(player.adventure?.assetValue||0);
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
        const fueled=room.gameplay?.version===1&&p.adventure?.mode==='factory';
        const count=fueled?Math.min(periods,p.adventure.fuel||0):periods;
        p.cash += count * 8 * p.machineLevel;
        if(fueled&&p.machineLevel>0)p.adventure.fuel-=count;
        p.score = p.cash+(p.adventure?.assetValue||0);
      }
      room.lastPassiveAt += periods * 5000;
      changed = true;
    }
  }
  if (now >= room.endsAt) { room.status = 'finished'; room.finishedAt=room.endsAt; changed = true; }
  else if(room.settings?.kind==='score'&&scoreboard(room.players,room.mode).some(p=>p.score>=room.settings.target)){room.status='finished';room.finishedAt=now;changed=true;}
  return changed;
}
