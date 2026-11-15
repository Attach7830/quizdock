import {PLAYER_TYPES} from './catalog.js';
export function playerPhase(room) {
 if (!room?.me) return 'connecting';
 if (room.status === 'paused') return 'paused';
 if (room.me.feedback && ['playing','finished'].includes(room.status)) return 'result';
 if (room.status !== 'playing') return room.status;
 if (PLAYER_TYPES[room.mode] && !room.me.roleType) return 'roles';
 return 'question';
}
export function playerViewKey(room) {
 const phase=playerPhase(room);
 return `${room?.pin}:${room?.roundNumber}:${room?.startedAt}:${room?.mode}:${phase}:${phase==='question'?room.me.question?.key:phase==='result'?room.me.answered:''}`;
}
