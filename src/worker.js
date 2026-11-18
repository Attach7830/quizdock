import {archiveSketchAdventure} from './sketch-adventures.js';
import {createExpedition,ensureExpeditionPlayer,expeditionAnswer,actExpedition,publicExpedition,expeditionOutcome,purgeExpeditionPlayer,voteExpedition,publicVote} from './expedition.js';
import {cleanEquipment} from '../public/js/item-catalog.js';
import {WORD_MODES,validateWordDeck,prepareWordQuestion,publicWordQuestion,guessWordLetter,gradeWord,startSketchWord,tickSketch,pauseSketch,resumeSketch,submitSketchGuess,publicSketch,appendSketchStroke,clearSketch,passSketch} from './word-games.js';
import {hasGameplay,newAdventure,createGameWorld,grantGameplayReward,openGameplayChest,resolveGameplayChoice,finishDefaultChoice,publicAdventure,publicPlay,publicWorld} from './gameplay.js';
import {maybeArcadeEvent} from './arcade-events.js';
import {gameSettings} from './academy-model.js';
import {PLAYER_TYPES,roleById} from '../public/js/catalog.js';
import {createRoundMetrics,recordCardAnswer,updateRoundMetrics,roundReport} from './round-metrics.js';
import { DurableObject } from 'cloudflare:workers';
import {
  MODES, MAX_PLAYERS, MAX_ROOM_MINUTES, cleanText, prepareQuestion,
  grantAnswerReward, newPlayer, openChest, publicQuestion, randomId,
  randomInt, scoreboard, settleTime, upgrade, validateQuestions
} from './game.js';

const ROOM_LIFETIME = 12 * 60 * 60 * 1000;
function restoreRoomState(target,saved){
  for(const key of Object.keys(target))if(!Object.hasOwn(saved,key))delete target[key];
  for(const [key,value]of Object.entries(saved)){
    if(value&&typeof value==='object'&&target[key]&&typeof target[key]==='object'&&Array.isArray(value)===Array.isArray(target[key]))restoreRoomState(target[key],value);
    else target[key]=value;
  }
  if(Array.isArray(target))target.length=saved.length;
}
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
        const questions = validateQuestions(data.questions,{typedOnly:data.mode==='word'});
        const mode = String(data.mode || 'treasure');
        if (!MODES.includes(mode)) return failure('Choose a valid game mode.');
        const title = cleanText(data.title || 'Classroom challenge', 70) || 'Classroom challenge';
        const settings=gameSettings(data.settings);
        for (let attempt = 0; attempt < 12; attempt++) {
          const pin = String(randomInt(100000, 999999));
          const id = env.ROOMS.idFromName(pin);
          const stub = env.ROOMS.get(id);
          const hostToken = randomId(24);
          const result = await stub.fetch('https://room.internal/init', {
            method: 'POST', body: JSON.stringify({ pin, hostToken, title, mode, questions, settings, classId:env.__REPORT_CONTEXT?.classId||null, reportOwner:env.__REPORT_CONTEXT?.owner||null, sourceList:env.__REPORT_CONTEXT?.source||null,solo:env.__SOLO_CONTEXT||null })
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
    this._serial=Promise.resolve();
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get('room')) || null;
    });
  }
  ensureRoundMetrics() {
    if(this.room?.startedAt && !this.room.roundMetrics)this.room.roundMetrics=createRoundMetrics(this.room,{partial:true});
  }
  async save() {
    if(this.room?.status==='finished'&&this.room.mode==='sketch')archiveSketchAdventure(this.room);
    this.ensureRoundMetrics();
    if(this.room.roundMetrics)updateRoundMetrics(this.room.roundMetrics,this.room);
    await this.ctx.storage.put('room',this.room);
    await this.publishReport();await this.publishClass();await this.scheduleAnalyticsAlarm();
  }
  async publishReport(force=false) {
    const r=this.room,m=r?.roundMetrics;
    if(!m||(!r.reportOwner&&!r.solo)||!this.env.TEACHER_LIBRARY)return;
    if(r.reportPublished?.id===m.id&&r.reportPublished.revision>=m.revision)return;
    const now=Date.now();
    if(!force&&(r.reportRetryAt>now||m.status!=='finished'&&now-(r.reportLastAttempt||0)<15000))return;
    const snapshot=roundReport(m),owner=r.reportOwner;
    r.reportLastAttempt=now;
    // Persist the outbox before the network call. Delivery may be retried with the same round/revision.
    await this.ctx.storage.put('room',r);
    try {
      const response=await this.env.TEACHER_LIBRARY.get(this.env.TEACHER_LIBRARY.idFromName('teachers')).fetch('https://library.internal/',{
        method:'POST',body:JSON.stringify(r.solo?{action:'record-solo-round',payload:{solo:r.solo,report:snapshot,expedition:m.status==='finished'?expeditionOutcome(r):null}}:{action:'record-round',payload:{owner,report:snapshot,outcome:m.status==='finished'?this.outcome():null,expedition:m.status==='finished'?expeditionOutcome(r):null}})
      });
      if(!response.ok)throw new Error('Report archive unavailable.');
      const archived=await response.json();if(archived.passports)for(const p of Object.values(r.players))if(archived.passports[p.accountId])p.passport=archived.passports[p.accountId];
      if(this.room?.roundMetrics?.id===snapshot.id){
        const old=this.room.reportPublished;
        this.room.reportPublished={id:snapshot.id,revision:Math.max(old?.id===snapshot.id?old.revision:0,snapshot.revision)};
        this.room.reportRetryAt=0;await this.ctx.storage.put('room',this.room);
      }
    } catch {
      if(this.room?.roundMetrics?.id===snapshot.id){this.room.reportRetryAt=now+30000;await this.ctx.storage.put('room',this.room);}
    }
  }
  outcome(){const r=this.room;return {id:r.roundMetrics.id,classId:r.classId||null,mode:r.mode,title:r.title,startedAt:r.startedAt,finishedAt:r.finishedAt||r.roundMetrics.finishedAt,players:scoreboard(r.players,r.mode).map(x=>({...x,accountId:r.players[x.id].accountId||null}))};}
  async publishClass(){
    const r=this.room;if((!r?.reportOwner&&!r?.solo)||!this.env.TEACHER_LIBRARY)return;
    const signature=`${r.status}:${r.roundNumber||0}:${r.settings?.allowLate}:${Object.values(r.players).map(p=>p.accountId||'').sort().join(',')}`;if(r.classPublished===signature)return;
    try{const result=await this.env.TEACHER_LIBRARY.get(this.env.TEACHER_LIBRARY.idFromName('teachers')).fetch('https://library.internal/',{method:'POST',body:JSON.stringify({action:'publish-class-room',payload:{owner:r.reportOwner||r.solo?.ownerId,solo:!!r.solo,classId:r.solo?.classId||r.classId,accountIds:Object.values(r.players).map(p=>p.accountId).filter(Boolean),pin:r.pin,mode:r.mode,title:r.title,status:r.status,roundNumber:r.roundNumber||0,allowLate:r.settings?.allowLate!==false,createdAt:r.createdAt,expiresAt:r.createdAt+ROOM_LIFETIME}})});if(result.ok){r.classPublished=signature;await this.ctx.storage.put('room',r);}}catch{/* retry on next save */}
  }
  async scheduleAnalyticsAlarm() {
    const r=this.room;if(!r)return;const now=Date.now(),times=[r.createdAt+ROOM_LIFETIME];
    if(r.status==='playing'&&r.endsAt!=null)times.push(r.endsAt);
    if(r.status==='playing'&&r.mode==='sketch'&&r.sketch){times.push(r.sketch.endsAt);if(r.sketch.phase==='drawing'){times.push(r.sketch.nextHintAt);if(!this.onlineIds().includes(r.sketch.artistId)){const due=r.sketch.offlineAt===null?now+1000:r.sketch.offlineAt+8000;if(due>now)times.push(due);}}}
    if((r.reportOwner||r.solo)&&r.roundMetrics&&(r.reportPublished?.id!==r.roundMetrics.id||r.reportPublished.revision<r.roundMetrics.revision))
      times.push(r.reportRetryAt||Math.max(now+250,(r.reportLastAttempt||0)+15000));
    await this.ctx.storage.setAlarm(Math.max(now+250,Math.min(...times)));
  }
  valid() { return this.room && Date.now() - this.room.createdAt < ROOM_LIFETIME; }

  exclusive(work){const operation=this._serial.then(work,work);this._serial=operation.catch(()=>{});return operation;}
  fetch(request){return this.exclusive(()=>this._fetch(request));}
  async _fetch(request) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/init') {
        if (request.method !== 'POST') return failure('Method not allowed.', 405);
        if (this.valid()) return failure('Room PIN already in use.', 409);
        if(this.room){await this._alarm();if(this.room)return failure('Previous room report is still being archived.',409);}
        const data = await bodyOf(request);
        this.room = {
          pin: data.pin, hostToken: data.hostToken, title: data.title, mode: data.mode,
          questions: data.questions, settings:gameSettings(data.settings), classId:data.classId||null, roundNumber:0, reportOwner:data.reportOwner||null, sourceList:data.sourceList||null, solo:data.solo||null, createdAt: Date.now(), status: 'lobby',
          players: {}, startedAt: null, endsAt: null, remainingMs: null, lastPassiveAt: null
        };
        await this.save();
        await this.scheduleAnalyticsAlarm();
        return json({ pin: this.room.pin, hostToken: this.room.hostToken });
      }
      if(path==='/privacy-purge'&&request.method==='POST'){
        const p=await bodyOf(request,2000),r=this.room;
        if(!r||r.createdAt!==p.createdAt)return json({ok:true,skipped:true});
        for(const player of Object.values(r.players))if(player.accountId===p.accountId&&(!p.erasedAt||player.joinedAt<=p.erasedAt)){
          for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.playerId===player.id){try{ws.close(4003,'Account data removed');}catch{}}
          purgeExpeditionPlayer(r,player);player.accountId=null;player.email=null;player.name='Deleted participant';player.skin='mint';player.equipment={};player.token=randomId(24);player.feedback=null;player.current=null;player.deleted=true;player.lastEvent=null;player.adventure=null;player.wordPuzzle=null;player.wordOrder=null;player.wordCycle=null;player.questionCycle=null;player.sketchReceipt=null;player.pendingPlay=null;player.lastPlay=null;if(r.lastArcadeEvent?.playerId===player.id)r.lastArcadeEvent=null;
          for(const other of Object.values(r.players)){other.lastPlay=null;if(other.feedback){delete other.feedback.game;if(other.feedback.effect?.targetId===player.id){other.feedback.reward='Game reward saved.';other.feedback.effect=null;}}}
          if(r.gameplay?.keep){r.gameplay.keep.participants=r.gameplay.keep.participants.filter(id=>id!==player.id);r.gameplay.keep.contributors=r.gameplay.keep.contributors.filter(id=>id!==player.id);}
          if(r.sketch){if(r.sketch.activeArtists)r.sketch.activeArtists=r.sketch.activeArtists.filter(id=>id!==player.id);if(r.sketch.assignments)delete r.sketch.assignments[player.id];if(r.sketch.gestures)delete r.sketch.gestures[player.id];r.sketch.guessed=r.sketch.guessed.filter(id=>id!==player.id);const drew=r.sketch.artists.includes(player.id);r.sketch.artists=r.sketch.artists.filter(id=>id!==player.id);if(drew){r.sketch.strokes=[];r.sketch.clearEpoch++;r.sketch.revision++;}if(r.sketch.artistId===player.id){r.sketch.artistId=null;r.sketch.offlineAt=Date.now()-8001;}tickSketch(r,this.onlineIds());}
        }
        if(r.solo?.accountId===p.accountId&&(!p.erasedAt||r.createdAt<=p.erasedAt))r.solo.accountId=null;
        await this.save();this.broadcast();return json({ok:true});
      }
      if (!this.valid()) return failure('This game room no longer exists.', 404);
      this.ensureRoundMetrics();
      if(settleTime(this.room)){await this.save();this.broadcast();}
      if(path==='/access')return json({classId:this.room.classId||null,status:this.room.status});
      if (path.endsWith('/join')||path==='/join-verified') {
        if (request.method !== 'POST') return failure('Method not allowed.', 405);
        const data = await bodyOf(request, 32000);
        const identity=path==='/join-verified'?data.identity:null;
        if(this.room.solo&&identity?.accountId!==this.room.solo.accountId)return failure('This solo game belongs to another account.',403);
        if(this.room.classId&&!identity?.accountId)return failure('Sign in with an account linked to this class.',403);
        if(identity?.accountId){const existing=Object.values(this.room.players).find(p=>p.accountId===identity.accountId);if(existing){existing.skin=identity.skin||'mint';existing.equipment=cleanEquipment(identity.equipment);existing.passport=identity.passport||null;existing.hangar=identity.hangar||null;await this.save();this.broadcast();return json({pin:this.room.pin,playerId:existing.id,playerToken:existing.token,name:existing.name});}}
        if(['playing','paused'].includes(this.room.status)&&this.room.settings?.allowLate===false)return failure('Your teacher has disabled late entry for this game.',409);
        let name = cleanText(identity?.name||data.name, 70).replace(/[<>]/g, '');
        if (name.length < (identity?.accountId?1:2)) return failure('Enter a nickname with at least 2 characters.');
        if (Object.keys(this.room.players).length >= MAX_PLAYERS) return failure('This room is full.', 409);
        const existing = new Set(Object.values(this.room.players).map(p => p.name.toLowerCase()));
        const original = name;
        let suffix = 2;
        while (existing.has(name.toLowerCase())) name = `${original.slice(0, 20)} ${suffix++}`;
        const id = randomId(8);
        const token = randomId(24);
        this.room.players[id] = {...newPlayer(id, token, name, this.room.questions),accountId:identity?.accountId||null,email:identity?.email||null,skin:identity?.skin||'mint',equipment:cleanEquipment(identity?.equipment),passport:identity?.passport||null,hangar:identity?.hangar||null};
        if(hasGameplay(this.room))this.room.players[id].adventure=newAdventure(this.room.mode);ensureExpeditionPlayer(this.room,this.room.players[id]);
        if(this.room.mode==='word'&&this.room.status==='playing')prepareWordQuestion(this.room,this.room.players[id]);
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
  snapshotFor(connection,includeDrawing=false) {
    const room = this.room;
    if(WORD_MODES.includes(room.mode)&&connection.protocol!==2)return{type:'error',error:'Refresh QuizDock to load the new word and drawing games.',refreshRequired:true};
    const players = scoreboard(room.players, room.mode).map(p=>({...p,skin:room.players[p.id].skin||'mint',equipment:cleanEquipment(room.players[p.id].equipment),hangar:room.players[p.id].hangar||null}));
    const shared = {
      type: 'state', pin: room.pin, title: room.title, mode: room.mode, lastArcadeEvent:room.lastArcadeEvent||null,gameplay:publicWorld(room),expedition:publicExpedition(room,room.players[connection.playerId]),expeditionVote:room.settings?.engagement?publicVote(room,room.players[connection.playerId]):null,sketch:publicSketch(room,connection,{history:includeDrawing}),
      status: room.status, questionCount: room.questions.length,
      startedAt: room.startedAt, endsAt: room.endsAt, remainingMs: room.remainingMs,
      settings:room.settings||gameSettings(),solo:!!room.solo,classId:room.classId||null,roundNumber:room.roundNumber||(room.startedAt?1:0),durationMinutes:room.settings?.minutes||10,players, online: this.onlineIds()
    };
    if (connection.role === 'host') return { ...shared, isHost: true,
      participantRoster:Object.values(room.players).map(p=>({id:p.id,name:p.name,email:p.email,accountId:p.accountId})),cardReport:roundReport(room.roundMetrics),
      reportArchived:!!room.reportOwner&&room.reportPublished?.id===room.roundMetrics?.id&&room.reportPublished?.revision>=room.roundMetrics?.revision
    };
    const me = room.players[connection.playerId];
    if (!me) return { type: 'error', error: 'You are no longer in this room.' };
    return {
      ...shared,
      isHost: false,
      me: { id: me.id, name: me.name, skin:me.skin||'mint',equipment:cleanEquipment(me.equipment),hangar:me.hangar||null,roleType:me.roleType,lastEvent:me.lastEvent,answered: me.answered, correct: me.correct,
        streak: me.streak, score: me.score, coins: me.coins, cash: me.cash,
        fishCount: me.fishCount, biggestFish: me.biggestFish, hp: me.hp,
        rodLevel: me.rodLevel, machineLevel: me.machineLevel,
        pendingChests: !!me.pendingChests,adventure:publicAdventure(room,me),play:publicPlay(room,me),lastPlay:me.lastPlay||null,
        feedback: me.feedback,
        question: room.mode==='sketch'?null:room.status === 'playing' && me.current
          ? room.mode==='word'?publicWordQuestion(room,me):publicQuestion(room.questions[me.current.index], me.current) : null }
    };
  }
  onlineIds() {
    return [...new Set(this.ctx.getWebSockets().map(ws => ws.deserializeAttachment())
      .filter(att => att?.role === 'student').map(att => att.playerId))];
  }
  broadcast(except=null) {
    if (!this.room) return;
    for (const ws of this.ctx.getWebSockets()) {
      if(ws===except)continue;
      const att = ws.deserializeAttachment();
      if (att?.role === 'host' || att?.role === 'student') this.send(ws, this.snapshotFor(att));
    }
  }
  async authenticate(ws, msg) {
    if (!this.valid()) throw new Error('Room expired.');
    if (msg.role === 'host' && msg.token === this.room.hostToken) {
      ws.serializeAttachment({ role: 'host',protocol:msg.protocol===2?2:1 });
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
      ws.serializeAttachment({ role: 'student', playerId: player.id,protocol:msg.protocol===2?2:1 });
    } else throw new Error('Session invalid. Rejoin the game.');
    this.send(ws, this.snapshotFor(ws.deserializeAttachment(),true));
    this.broadcast(ws);
  }
  requireHost(att) { if(att.role==='host')return;if(this.room.solo?.accountId&&att.role==='student'&&this.room.players[att.playerId]?.accountId===this.room.solo.accountId)return;throw new Error('Teacher access required.'); }
  requireStudent(att) {
    const me = this.room.players[att.playerId];
    if (att.role !== 'student' || !me || me.deleted) throw new Error('Student access required.');
    return me;
  }
  async act(ws, att, msg) {
    const room = this.room;
    if (!room) throw new Error('Room unavailable.');
    this.ensureRoundMetrics();
    if(att.role==='student'&&msg.roundNumber!==undefined&&msg.roundNumber!==(room.roundNumber||0)&&!['ping','sync'].includes(msg.type))throw new Error('A new round has started. Wait for its current screen.');
    const timed=settleTime(room);const changedByTimer=tickSketch(room,this.onlineIds())||timed;
    if(changedByTimer){await this.save();this.broadcast();}
    if (msg.type === 'ping' || msg.type === 'sync') {
      if (changedByTimer) { await this.save(); this.broadcast(); }
      else this.send(ws, this.snapshotFor(att,msg.type==='sync'));
      return;
    }
    const checkpoint=['start','answer','chest','play','next','upgrade','word-letter','sketch-guess','sketch-clear','sketch-pass','sketch-next','adventure','adventure-vote'].includes(msg.type)?structuredClone(room):null;
    try {
    if (msg.type === 'start') {
      this.requireHost(att);
      if (!['lobby', 'finished'].includes(room.status)) throw new Error('End the current game before starting the next one.');
      const mode=msg.mode??room.mode;if(!MODES.includes(mode))throw new Error('Choose a valid game mode.');
      if(room.solo&&(mode==='sketch'||msg.savedListId||msg.questions))throw new Error('Choose a solo-compatible mode using this shared question set.');
      if(!WORD_MODES.includes(mode)&&room.questions.some(q=>q.answers.length<2||q.answers.length>4))throw new Error('This typed-only set needs a multiple-choice question set for that mode.');
      if(!Object.keys(room.players).length)throw new Error('At least one player must join.');
      const settings=gameSettings(msg.settings||{...room.settings,minutes:msg.minutes??room.settings?.minutes??10});
      if(room.roundMetrics?.status==='finished'&&(room.reportOwner||room.solo)){
        await this.publishReport(true);
        if(room.reportPublished?.id!==room.roundMetrics.id||room.reportPublished.revision<room.roundMetrics.revision)
          throw new Error('The previous round report is still being saved. Retry before starting another round.');
      }
      const minutes=settings.minutes;
      if(msg.savedListId){
        if(!room.reportOwner||!this.env.TEACHER_LIBRARY)throw new Error('Sign in to use a saved list.');
        const res=await this.env.TEACHER_LIBRARY.get(this.env.TEACHER_LIBRARY.idFromName('teachers')).fetch('https://library.internal/',{method:'POST',body:JSON.stringify({action:'room-source',payload:{owner:room.reportOwner,id:msg.savedListId,revision:msg.listRevision}})});
        if(!res.ok)throw new Error('The selected saved list changed or is unavailable.');const snap=await res.json();room.questions=validateQuestions(snap.questions);room.sourceList={id:snap.listId,revision:snap.listRevision,title:snap.title};room.title=snap.title;
      }
      if(WORD_MODES.includes(mode)){validateWordDeck(room.questions);if(this.ctx.getWebSockets().some(ws=>{const a=ws.deserializeAttachment();return a?.role==='student'&&a.protocol!==2;}))throw new Error('Some students need to refresh QuizDock before starting a word or drawing game.');}
      if(mode==='sketch'&&this.onlineIds().length<2)throw new Error('Sketch Relay needs at least two connected students. Word Forge works with one.');
      for (const [id, p] of Object.entries(room.players)) {
        if(p.deleted){delete room.players[id];continue;}
        room.players[id] = {...newPlayer(id,p.token,p.name,room.questions),accountId:p.accountId||null,email:p.email||null,skin:p.skin||'mint',equipment:cleanEquipment(p.equipment),joinedAt:p.joinedAt,passport:p.passport||null,hangar:p.hangar||null};
      }
      room.mode=mode;room.durationMinutes=minutes;room.settings=settings;room.roundNumber=(room.roundNumber||(room.startedAt?1:0))+1;
      room.status = 'playing'; room.startedAt = Math.max(Date.now(),(room.startedAt||0)+1); room.endsAt = Date.now() + minutes * 60_000;
      room.lastPassiveAt = Date.now(); room.remainingMs = null; room.finishedAt=null; room.lastArcadeEvent=null;room.sketch=null;room.sketchCycle=null;room.sketchGallery=[];createGameWorld(room);createExpedition(room);
      if(mode==='word')for(const p of Object.values(room.players))prepareWordQuestion(room,p);
      if(mode==='sketch')startSketchWord(room,this.onlineIds());
      room.roundMetrics=createRoundMetrics(room);room.reportPublished=null;room.reportRetryAt=0;room.reportLastAttempt=0;
    } else if (msg.type === 'pause') {
      this.requireHost(att);
      if (room.status !== 'playing') throw new Error('The game is not running.');
      pauseSketch(room);room.remainingMs = Math.max(0, room.endsAt - Date.now()); room.status = 'paused';
    } else if (msg.type === 'resume') {
      this.requireHost(att);
      if (room.status !== 'paused') throw new Error('The game is not paused.');
      room.endsAt = Date.now() + room.remainingMs; room.status = 'playing';resumeSketch(room);
      room.lastPassiveAt = Date.now(); room.remainingMs = null;
    } else if (msg.type === 'end') {
      this.requireHost(att);
      if (room.status === 'lobby') throw new Error('Start the game first.');
      room.status = 'finished';room.finishedAt=Date.now();
    } else if(msg.type==='choose-role'){
      const p=this.requireStudent(att);if(!['lobby','playing'].includes(room.status)||p.answered>0||p.roleType)throw new Error('Player type is locked for this round.');
      if(!roleById(room.mode,msg.roleType))throw new Error('Choose a valid player type.');p.roleType=msg.roleType;
    } else if(msg.type==='adventure'){
      actExpedition(room,this.requireStudent(att),msg);
    } else if(msg.type==='adventure-vote'){
      voteExpedition(room,this.requireStudent(att),msg.modifier);
    } else if(msg.type==='word-letter'){
      const p=this.requireStudent(att);if(room.mode!=='word')throw new Error('Letter clues belong to Word Forge.');guessWordLetter(room,p,msg.key,msg.letter);
    } else if(msg.type==='sketch-guess'){
      const p=this.requireStudent(att);if(room.mode!=='sketch')throw new Error('This is not a drawing round.');const result=submitSketchGuess(room,p,msg.wordId,msg.answer,Date.now(),msg.id);if(!result.duplicate){expeditionAnswer(room,p,result.correct);recordCardAnswer(room.roundMetrics,{playerId:p.id,sequence:p.answered,cardIndex:result.cardIndex,correct:result.correct,typedAnswer:result.typedAnswer,hintsUsed:result.hintsUsed});}tickSketch(room,this.onlineIds());
    } else if(['sketch-clear','sketch-pass','sketch-next'].includes(msg.type)){
      if(room.mode!=='sketch')throw new Error('This is not a drawing round.');if(msg.type==='sketch-clear')clearSketch(room,att,msg.wordId,msg.clearEpoch);else{if(msg.type==='sketch-next')this.requireHost(att);else this.requireStudent(att);if(!passSketch(room,att,msg.wordId))startSketchWord(room,this.onlineIds());}
    } else if (msg.type === 'answer') {
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('The game is not active.');
      if (p.feedback || !p.current) throw new Error('Continue to the next question first.');
      if (Date.now() - p.lastAnswerAt < 450) throw new Error('Please answer a little more slowly.');
      if (msg.key !== p.current.key) throw new Error('This question is no longer active.');
      if(room.mode==='sketch')throw new Error('Use the drawing word guess box.');
      const typed=room.mode==='word',selection=typed?null:Number(msg.choice);
      if (!typed&&(!Number.isInteger(selection) || selection < 0 || selection >= p.current.order.length)) {
        throw new Error('Choose an answer.');
      }
      if(PLAYER_TYPES[room.mode]&&!p.roleType)throw new Error('Choose your player type before answering.');
      const question = room.questions[p.current.index];
      const correct = typed?gradeWord(question,msg.answer).correct:question.correct.includes(p.current.order[selection]);
      p.lastAnswerAt = Date.now(); p.answered++;
      p.streak = correct ? p.streak + 1 : 0;
      if (correct) p.correct++;
      if(hasGameplay(room))room.gameplay.activePlayers=Math.max(1,this.onlineIds().length);
      const reward = correct ? grantGameplayReward(room, p) : null;
      p.feedback = {
        correct, correctAnswers: question.correct.map(index => question.answers[index]),
        reward: reward?.text || (room.mode === 'battle' ? 'Missed! Your opponents are catching up.' : 'Keep going!'),
        selected: selection,effect:reward?.effect||null
      };
      if(!correct&&PLAYER_TYPES[room.mode]){const type=roleById(room.mode,p.roleType);if(room.mode==='rally')p.score=Math.max(0,p.score-type.penalty);else{p.hp-=type.penalty;if(p.hp<=0){p.hp=100;p.score=Math.max(0,p.score-40);p.feedback.reward='Shield rebuilt. You lost 40 energy; keep going.';}}}
      if (!correct && room.mode === 'battle') p.hp = Math.max(10, p.hp - 5);
      if(correct && room.mode!=='treasure')maybeArcadeEvent(room,p,reward?.points||0);
      expeditionAnswer(room,p,correct);
      recordCardAnswer(room.roundMetrics,{playerId:p.id,sequence:p.answered,cardIndex:p.current.index,optionIndex:typed?undefined:p.current.order[selection],correct,...(typed?{typedAnswer:msg.answer,hintsUsed:p.wordPuzzle?.guesses.length||0}:{})});
    } else if (msg.type === 'chest') {
      const p = this.requireStudent(att);
      if (room.status!=='playing'||room.mode !== 'treasure' || !p.pendingChests) throw new Error('No chest to open.');
      const reward = hasGameplay(room)?openGameplayChest(room,p,Number(msg.index)):openChest(room, p, Number(msg.index));
      p.feedback.reward = reward.text;p.feedback.effect=reward.effect||{type:'chest',amount:reward.points};
      maybeArcadeEvent(room,p,reward.points);
    } else if(msg.type==='play'){
      const p=this.requireStudent(att);if(room.status!=='playing')throw new Error('The game is not active.');
      if(!p.feedback?.correct&&!(p.lastPlay?.id===msg.id&&p.lastPlay.choice===msg.choice))throw new Error('Answer correctly before choosing a game action.');
      if(hasGameplay(room))room.gameplay.activePlayers=Math.max(1,this.onlineIds().length);
      const reward=resolveGameplayChoice(room,p,msg.id,msg.choice);if(!reward.duplicate)p.feedback.game=reward.text;
    } else if (msg.type === 'next') {
      if(room.mode==='sketch')throw new Error('Wait for the next drawing word.');
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('Game is not active.');
      if (!p.feedback || p.pendingChests) throw new Error('Finish this question first.');
      finishDefaultChoice(room,p);
      if(room.mode==='word')prepareWordQuestion(room,p);else prepareQuestion(room.questions,p);
      p.feedback = null;
    } else if (msg.type === 'upgrade') {
      const p = this.requireStudent(att);
      if (room.status !== 'playing') throw new Error('Game is not active.');
      const reward = upgrade(room, p);
      this.send(ws, { type: 'notice', message: reward.text });
    } else {
      throw new Error('Unknown action.');
    }
    settleTime(room);
    await this.save();
    this.broadcast();
    }catch(error){if(checkpoint)restoreRoomState(room,checkpoint);throw error;}
  }
  webSocketMessage(ws,raw){return this.exclusive(()=>this._webSocketMessage(ws,raw));}
  async _webSocketMessage(ws, raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 3000) throw new Error('Invalid message.');
      const msg = JSON.parse(raw);
      const att = ws.deserializeAttachment() || { role: 'pending' };
      if (att.role === 'pending') {
        if (msg.type !== 'auth') throw new Error('Authenticate to join.');
        await this.authenticate(ws, msg);
      } else if(msg.type==='sketch-stroke'){
        const p=this.requireStudent(att),r=this.room;if(msg.roundNumber!==r.roundNumber)throw new Error('A new round has started.');const previous={length:r.sketch?.strokes.length,revision:r.sketch?.revision,last:r.sketch?.lastStrokeAt,rate:structuredClone(r.sketch?.strokeRate)},packet=appendSketchStroke(r,p,msg);if(packet.duplicate){this.send(ws,{type:'sketch-ack',id:msg.id});return;}
        try{await this.ctx.storage.put('room',r);}catch(error){r.sketch.strokes.length=previous.length;r.sketch.revision=previous.revision;r.sketch.lastStrokeAt=previous.last;if(previous.rate)r.sketch.strokeRate=previous.rate;else delete r.sketch.strokeRate;throw error;}
        for(const other of this.ctx.getWebSockets()){const a=other.deserializeAttachment();if(a?.protocol===2&&['host','student'].includes(a.role))this.send(other,{type:'sketch-stroke',...packet});}
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
  alarm(){return this.exclusive(()=>this._alarm());}
  async _alarm() {
    if(!this.room)return;
    this.ensureRoundMetrics();const now=Date.now(),expired=now>=this.room.createdAt+ROOM_LIFETIME;
    if(expired&&['playing','paused'].includes(this.room.status)){this.room.status='finished';this.room.finishedAt=now;}
    else settleTime(this.room,now);
    tickSketch(this.room,this.onlineIds(),now);
    await this.save();this.broadcast();
    if(!expired)return;
    const r=this.room,m=r.roundMetrics;
    if((r.reportOwner||r.solo)&&m&&(r.reportPublished?.id!==m.id||r.reportPublished.revision<m.revision)){
      await this.ctx.storage.setAlarm(now+60000);return;
    }
    for(const ws of this.ctx.getWebSockets()){try{ws.close(4000,'Room expired');}catch{}}
    this.room=null;await this.ctx.storage.deleteAll();
  }
}
