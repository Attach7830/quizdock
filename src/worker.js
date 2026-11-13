import { DurableObject } from 'cloudflare:workers';
import {
  MODES, MAX_PLAYERS, MAX_ROOM_MINUTES, cleanText, createQuestion,
  grantAnswerReward, newPlayer, openChest, publicQuestion, randomId,
  randomInt, scoreboard, settleTime, upgrade, validateQuestions
} from './game.js';

const ROOM_LIFETIME = 12 * 60 * 60 * 1000;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const failure = (message, status = 400) => json({ error: message }, status);
async function bodyOf(request, limit = 250_000) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('This file is too large.');
  const text = await request.text();
  if (text.length > limit) throw new Error('This file is too large.');
  try { return JSON.parse(text); } catch { throw new Error('Invalid request format.'); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ ok: true, app: 'QuizDock' });
    try {
      if (url.pathname === '/api/create' && request.method === 'POST') {
        const data = await bodyOf(request);
        const questions = validateQuestions(data.questions);
        const mode = String(data.mode || 'treasure');
        if (!MODES.includes(mode)) return failure('Choose a valid game mode.');
        const title = cleanText(data.title || 'Classroom challenge', 70) || 'Classroom challenge';
        for (let attempt = 0; attempt < 12; attempt++) {
          const pin = String(randomInt(100000, 999999));
          const id = env.ROOMS.idFromName(pin);
          const stub = env.ROOMS.get(id);
          const hostToken = randomId(24);
          const result = await stub.fetch('https://room.internal/init', {
            method: 'POST', body: JSON.stringify({ pin, hostToken, title, mode, questions })
          });
          if (result.status === 409) continue;
          return result;
        }
        return failure('Unable to create a game PIN. Try again.', 503);
      }
      const match = url.pathname.match(/^\/api\/room\/(\d{6})\/(join|socket)$/);
      if (match) {
        const [, pin, operation] = match;
        if (operation === 'join' && request.method !== 'POST') return failure('POST required.', 405);
        if (operation === 'socket' && request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
          return failure('WebSocket required.', 426);
        }
        return env.ROOMS.get(env.ROOMS.idFromName(pin)).fetch(request);
      }
      return failure('Unknown API endpoint.', 404);
    } catch (err) { return failure(err?.message || 'Unexpected server error.'); }
  }
};

export class QuizRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get('room')) || null;
    });
  }
  async save() { await this.ctx.storage.put('room', this.room); }
  valid() { return this.room && Date.now() - this.room.createdAt < ROOM_LIFETIME; }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/init') {
        if (request.method !== 'POST') return failure('Method not allowed.', 405);
        if (this.valid()) return failure('Room PIN already in use.', 409);
        const data = await bodyOf(request);
        this.room = {
          pin: data.pin, hostToken: data.hostToken, title: data.title, mode: data.mode,
          questions: data.questions, createdAt: Date.now(), status: 'lobby',
          players: {}, startedAt: null, endsAt: null, remainingMs: null, lastPassiveAt: null
        };
        await this.save();
        await this.ctx.storage.setAlarm(this.room.createdAt + ROOM_LIFETIME);
        return json({ pin: this.room.pin, hostToken: this.room.hostToken });
      }
      if (!this.valid()) return failure('This game room no longer exists.', 404);
      if (path.endsWith('/join')) {
        if (request.method !== 'POST') return failure('Method not allowed.', 405);
        if (this.room.status === 'finished') return failure('This game has already finished.', 409);
        if (Object.keys(this.room.players).length >= MAX_PLAYERS) return failure('This room is full.', 409);
        const data = await bodyOf(request, 2000);
        let name = cleanText(data.name, 24).replace(/[<>]/g, '');
        if (name.length < 2) return failure('Enter a nickname with at least 2 characters.');
        const existing = new Set(Object.values(this.room.players).map(p => p.name.toLowerCase()));
        const original = name;
        let suffix = 2;
        while (existing.has(name.toLowerCase())) name = `${original.slice(0, 20)} ${suffix++}`;
        const id = randomId(8);
        const token = randomId(24);
        this.room.players[id] = newPlayer(id, token, name, this.room.questions);
        await this.save();
        this.broadcast();
        return json({ pin: this.room.pin, playerId: id, playerToken: token, name });
      }
      if (path.endsWith('/socket')) {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return failure('WebSocket required.', 426);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ role: 'pending' });
        server.send(JSON.stringify({ type: 'hello' }));
        return new Response(null, { status: 101, webSocket: client });
      }
      return failure('Unknown endpoint.', 404);
    } catch (err) { return failure(err.message || 'Room error.'); }
  }

  send(ws, data) {
    try { ws.send(JSON.stringify(data)); } catch { /* disconnected socket */ }
  }
  snapshotFor(connection) {
    const room = this.room;
    const players = scoreboard(room.players, room.mode);
    const shared = {
      type: 'state', pin: room.pin, title: room.title, mode: room.mode,
      status: room.status, questionCount: room.questions.length,
      startedAt: room.startedAt, endsAt: room.endsAt, remainingMs: room.remainingMs,
      players, online: this.onlineIds()
    };
    if (connection.role === 'host') return { ...shared, isHost: true };
    const me = room.players[connection.playerId];
    if (!me) return { type: 'error', error: 'You are no longer in this room.' };
    return {
      ...shared,
      isHost: false,
      me: { id: me.id, name: me.name, answered: me.answered, correct: me.correct,
        streak: me.streak, score: me.score, coins: me.coins, cash: me.cash,
        fishCount: me.fishCount, biggestFish: me.biggestFish, hp: me.hp,
        rodLevel: me.rodLevel, machineLevel: me.machineLevel,
        pendingChests: !!me.pendingChests,
        feedback: me.feedback,
        question: room.status === 'playing' && me.current
          ? publicQuestion(room.questions[me.current.index], me.current) : null }
    };
  }
  onlineIds() {
    return [...new Set(this.ctx.getWebSockets().map(ws => ws.deserializeAttachment())
      .filter(att => att?.role === 'student').map(att => att.playerId))];
  }
  broadcast() {
    if (!this.room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment();
      if (att?.role === 'host' || att?.role === 'student') this.send(ws, this.snapshotFor(att));
    }
  }
  async authenticate(ws, msg) {
    if (!this.valid()) throw new Error('Room expired.');
    if (msg.role === 'host' && msg.token === this.room.hostToken) {
      ws.serializeAttachment({ role: 'host' });
    } else if (msg.role === 'student') {
      const player = this.room.players[msg.playerId];
      if (!player || player.token !== msg.token) throw new Error('Invalid student session.');
      // Only one active connection per player: prevent double-answering across tabs.
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const att = other.deserializeAttachment();
        if (att?.role === 'student' && att.playerId === player.id) {
          try { other.close(4001, 'Signed in elsewhere'); } catch { /* ignored */ }
        }
      }
      ws.serializeAttachment({ role: 'student', playerId: player.id });
    } else throw new Error('Session invalid. Rejoin the game.');
    this.send(ws, this.snapshotFor(ws.deserializeAttachment()));
    this.broadcast();
  }
  requireHost(att) { if (att.role !== 'host') throw new Error('Teacher access required.'); }
  requireStudent(att) {
    const me = this.room.players[att.playerId];
    if (att.role !== 'student' || !me) throw new Error('Student access required.');
    return me;
  }
  async act(ws, att, msg) {
    const room = this.room;
    if (!room) throw new Error('Room unavailable.');
    const changedByTimer = settleTime(room);
    if (msg.type === 'ping' || msg.type === 'sync') {
      if (changedByTimer) { await this.save(); this.broadcast(); }
      else this.send(ws, this.snapshotFor(att));
      return;
    }
    if (msg.type === 'start') {
      this.requireHost(att);
      if (!['lobby', 'finished'].includes(room.status)) throw new Error('This game is already running.');
      const minutes = Math.max(3, Math.min(MAX_ROOM_MINUTES, Math.floor(Number(msg.minutes) || 10)));
      for (const [id, p] of Object.entries(room.players)) {
        room.players[id] = newPlayer(id, p.token, p.name, room.questions);
      }
      room.status = 'playing'; room.startedAt = Date.now(); room.endsAt = Date.now() + minutes * 60_000;
      room.lastPassiveAt = Date.now(); room.remainingMs = null;
    } else if (msg.type === 'pause') {
      this.requireHost(att);
      if (room.status !== 'playing') throw new Error('The game is not running.');
      room.remainingMs = Math.max(0, room.endsAt - Date.now()); room.status = 'paused';
    } else if (msg.type === 'resume') {
      this.requireHost(att);
      if (room.status !== 'paused') throw new Error('The game is not paused.');
      room.endsAt = Date.now() + room.remainingMs; room.status = 'playing';
      room.lastPassiveAt = Date.now(); room.remainingMs = null;
    } else if (msg.type === 'end') {
      this.requireHost(att);
      if (room.status === 'lobby') throw new Error('Start the game first.');
      room.status = 'finished';
    } else if (msg.type === 'answer') {
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('The game is not active.');
      if (p.feedback || !p.current) throw new Error('Continue to the next question first.');
      if (Date.now() - p.lastAnswerAt < 450) throw new Error('Please answer a little more slowly.');
      if (msg.key !== p.current.key) throw new Error('This question is no longer active.');
      const selection = Number(msg.choice);
      if (!Number.isInteger(selection) || selection < 0 || selection >= p.current.order.length) {
        throw new Error('Choose an answer.');
      }
      const question = room.questions[p.current.index];
      const correct = question.correct.includes(p.current.order[selection]);
      p.lastAnswerAt = Date.now(); p.answered++;
      p.streak = correct ? p.streak + 1 : 0;
      if (correct) p.correct++;
      const reward = correct ? grantAnswerReward(room, p) : null;
      p.feedback = {
        correct, correctAnswers: question.correct.map(index => question.answers[index]),
        reward: reward?.text || (room.mode === 'battle' ? 'Missed! Your opponents are catching up.' : 'Keep going!'),
        selected: selection
      };
      if (!correct && room.mode === 'battle') p.hp = Math.max(10, p.hp - 5);
    } else if (msg.type === 'chest') {
      const p = this.requireStudent(att);
      if (room.mode !== 'treasure' || !p.pendingChests) throw new Error('No chest to open.');
      const reward = openChest(room, p, Number(msg.index));
      p.feedback.reward = reward.text;
    } else if (msg.type === 'next') {
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('Game is not active.');
      if (!p.feedback || p.pendingChests) throw new Error('Finish this question first.');
      p.current = createQuestion(room.questions, p.answered);
      p.feedback = null;
    } else if (msg.type === 'upgrade') {
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('Game is not active.');
      const reward = upgrade(room, p);
      this.send(ws, { type: 'notice', message: reward.text });
    } else {
      throw new Error('Unknown action.');
    }
    await this.save();
    this.broadcast();
  }
  async webSocketMessage(ws, raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 3000) throw new Error('Invalid message.');
      const msg = JSON.parse(raw);
      const att = ws.deserializeAttachment() || { role: 'pending' };
      if (att.role === 'pending') {
        if (msg.type !== 'auth') throw new Error('Authenticate to join.');
        await this.authenticate(ws, msg);
      } else await this.act(ws, att, msg);
    } catch (err) { this.send(ws, { type: 'error', error: err.message || 'Game error.' }); }
  }
  webSocketClose(ws) {
    try { ws.close(); } catch { /* already closed */ }
    this.broadcast();
  }
  webSocketError(ws) {
    try { ws.close(); } catch { /* already closed */ }
    this.broadcast();
  }
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(4000, 'Room expired'); } catch { /* already disconnected */ }
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }
}
