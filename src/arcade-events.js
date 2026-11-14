import {ARCADE_EVENTS} from '../public/js/event-catalog.js';
import {randomInt} from './game.js';

// Called only after an accepted correct answer (after chest resolution in Treasure).
// Nothing here changes attempts, accuracy, streaks, assignments or account wallets.
export function maybeArcadeEvent(room, player, rewardPoints = 0, random = randomInt, now = Date.now()) {
 if (room.status !== 'playing' || !ARCADE_EVENTS[room.mode]) return null;
 const progress = player.eventProgress ||= {steps:0, sequence:0, lastKind:null};
 progress.steps++;
 // A little space between surprises, with a guarantee by the fourth success.
 if (progress.steps < 2 || (progress.steps < 4 && random(1, 4) !== 1)) return null;
 const choices = ARCADE_EVENTS[room.mode].filter(e => e.kind !== progress.lastKind);
 const item = choices[random(0, choices.length - 1)];
 let amount = 0, health = 0, fish = 0;
 switch (item.kind) {
  case 'coin-comet': amount = 24; break;
  case 'vault-echo': amount = Math.max(0, Math.min(30, rewardPoints)); break;
  case 'compass-cache': amount = 18; break;
  case 'lantern-shoal': amount = 20; fish = 2; break;
  case 'pearl-dive': amount = 35; break;
  case 'tidal-lift': amount = 25; break;
  case 'aegis-bloom': health = 25; break;
  case 'meteor-volley': amount = 30; break;
  case 'repair-drone': health = 15; amount = 10; break;
  case 'overdrive': amount = 20 + 8 * Math.min(5, player.machineLevel); break;
  case 'cargo-airship': amount = 35; break;
  case 'golden-blueprint': amount = 28; break;
  case 'slipstream': amount = 28; break;
  case 'rainbow-gates': amount = 32; break;
  case 'cloud-trampoline': amount = 22; break;
  case 'aurora-bridge': amount = 28; break;
  case 'root-renewal': health = 25; break;
  case 'crystal-orbit': amount = 32; break;
 }
 if (room.mode === 'treasure') player.coins += amount;
 else if (room.mode === 'factory') { player.cash += amount; player.score = player.cash; }
 else player.score += amount;
 const restored = Math.min(100 - player.hp, health);
 player.hp += restored; player.fishCount += fish;
 progress.steps = 0; progress.sequence++; progress.lastKind = item.kind;
 const event = {...item, id:`${room.roundNumber || 0}:${player.id}:${progress.sequence}`, sequence:progress.sequence,
  playerId:player.id, amount, health:restored, fish, at:now, playerName:player.name};
 player.lastEvent = event; room.lastArcadeEvent = event;
 return event;
}
