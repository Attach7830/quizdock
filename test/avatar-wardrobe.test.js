import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_ITEMS,cleanEquipment,ownedEquipment,itemById} from '../public/js/item-catalog.js';
import {characterMarkup,characterParts} from '../public/js/characters.js';
import {skinById} from '../public/js/catalog.js';
import {groupWordSlots} from '../public/js/word-clues.js';
import {publicWordQuestion} from '../src/word-games.js';
import {TeacherLibrary} from '../src/library-service.js';
import {QuizRoom} from '../src/worker.js';
import {hash,uid} from '../src/library-domain.js';
import {context,internal,Socket} from './memory-runtime.js';

async function fixture(points=190){
 const ctx=context(),service=new TeacherLibrary(ctx,{}),email='wardrobe@example.com',id=await hash(email),token=uid();
 await ctx.storage.put({['account:'+id]:{id,email,name:'Wardrobe Student',points,owned:['mint','coral'],skin:'coral',createdAt:Date.now()-1000},['session:'+await hash(token)]:{owner:id,email,kind:'student',issuedAt:Date.now(),expiresAt:Date.now()+60000}});
 const call=async(action,p={})=>{const r=await service.fetch(internal('academy:'+action,p,token));return {status:r.status,body:await r.json()};};
 return {ctx,service,id,token,call};
}

test('avatar item catalog has distinct original art, safe prices and the requested absurd trophies',()=>{
 assert.equal(AVATAR_ITEMS.length,100);assert.equal(new Set(AVATAR_ITEMS.map(i=>i.id)).size,100);
 assert.equal(itemById('million-stick').price,1000000);assert.equal(itemById('billion-party-hat').price,1000000000);
 const art=AVATAR_ITEMS.map(item=>{assert.ok(item.quest?item.price===null&&Number.isSafeInteger(item.quest.goal)&&item.quest.goal>0:Number.isSafeInteger(item.price)&&item.price>0);return characterMarkup(skinById('mint',{[item.slot]:item.id}));});
 assert.equal(new Set(art).size,100);assert.ok(art.every(markup=>markup!==characterMarkup(skinById('mint'))));
 assert.deepEqual(cleanEquipment({hat:'million-stick',hand:'million-stick',face:'<script>',unknown:'paper-boat'}),{hand:'million-stick'});
 const skin=skinById('mint',{hat:'paper-boat',hand:'rubber-duck'});assert.equal(characterParts(skin),characterParts(skin));assert.notEqual(characterMarkup(skin),characterMarkup(skinById('mint',{hat:'paper-boat'})));
});

test('billion-point purchases use exact server prices, charge once and retain existing characters',async()=>{
 const f=await fixture(1001001000),buy=()=>f.call('buy-item',{itemId:'million-stick',price:1,slot:'hat'});
 assert.ok((await Promise.all([buy(),buy()])).every(r=>r.status===200));
 let p=await f.ctx.storage.get('account:'+f.id);assert.equal(p.points,1000001000);assert.deepEqual(p.ownedItems,['million-stick']);assert.deepEqual(p.equipment,{hand:'million-stick'});assert.deepEqual(p.owned,['mint','coral']);
 assert.equal((await f.call('buy-item',{itemId:'billion-party-hat',price:-1000000000})).status,200);
 p=await f.ctx.storage.get('account:'+f.id);assert.equal(p.points,1000);assert.deepEqual(p.equipment,{hat:'billion-party-hat',hand:'million-stick'});
 assert.equal((await f.call('buy-item',{itemId:'billion-party-hat'})).body.user.points,1000);
 assert.equal((await f.call('equip-skin',{skinId:'mint'})).body.user.equipment.hand,'million-stick');
});

test('unaffordable or unowned items cannot be equipped, and removing a slot never discards ownership',async()=>{
 const f=await fixture();assert.equal((await f.call('equip-item',{itemId:'billion-party-hat'})).status,403);assert.equal((await f.call('buy-item',{itemId:'billion-party-hat'})).status,400);
 assert.equal((await f.call('buy-item',{itemId:'paper-boat'})).body.user.points,165);
 assert.equal((await f.call('buy-item',{itemId:'rubber-duck'})).body.user.points,75);
 const removed=await f.call('remove-item',{slot:'hat'});assert.deepEqual(removed.body.user.equipment,{hand:'rubber-duck'});assert.ok(removed.body.user.ownedItems.includes('paper-boat'));
 assert.equal((await f.call('equip-item',{itemId:'paper-boat'})).body.user.points,75);assert.equal((await f.call('remove-item',{slot:'__proto__'})).status,400);
 const noSession=await f.service.fetch(internal('academy:buy-item',{itemId:'paper-boat'}));assert.equal(noSession.status,401);
 const auth=await f.service.fetch(internal('authorize-join',{equipment:{hat:'billion-party-hat'}},f.token));assert.deepEqual((await auth.json()).identity.equipment,{hat:'paper-boat',hand:'rubber-duck'});
 assert.deepEqual(ownedEquipment({ownedItems:['paper-boat'],equipment:{hat:'paper-boat',hand:'million-stick'}}),{hat:'paper-boat'});
 const exported=await f.service.fetch(internal('data:personal-export',{},f.token)),records=(await exported.json()).records;
 const saved=records.find(([key])=>key==='account:'+f.id)[1];assert.deepEqual(saved.equipment,{hat:'paper-boat',hand:'rubber-duck'});assert.ok(saved.ownedItems.includes('paper-boat'));
});

test('equipped accessories survive room reconnects and new rounds, and privacy erasure removes them',async()=>{
 const ctx=context(),room=new QuizRoom(ctx,{});await ctx.boot;const now=Date.now(),accountId=await hash('room-outfit@example.com');
 const init=await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',title:'Outfit fixture',mode:'treasure',questions:[{text:'Q',answers:['A','B'],correct:[0]}],settings:{kind:'time',minutes:10}})}));assert.equal(init.status,200);
 const join=await room.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:{accountId,name:'Outfit Student',email:'room-outfit@example.com',skin:'coral',equipment:{hat:'paper-boat',hand:'rubber-duck'}}})}));const joined=await join.json();assert.equal(join.status,200);
 const connection={role:'student',playerId:joined.playerId,protocol:2};assert.equal(room.snapshotFor(connection).me.equipment.hand,'rubber-duck');
 const player=room.room.players[joined.playerId];assert.equal(room.snapshotFor({role:'host',protocol:2}).players[0].equipment.hat,'paper-boat');
 // Existing new-round control creates players from persistent identity fields.
 await room.act(new Socket(),{role:'host'},{type:'start'});assert.deepEqual(room.room.players[player.id].equipment,{hat:'paper-boat',hand:'rubber-duck'});
 const erased=await room.fetch(new Request('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({accountId,createdAt:room.room.createdAt,erasedAt:now+10000})}));assert.equal(erased.status,200);assert.deepEqual(room.room.players[player.id].equipment,{});
});

test('sentence clues use one blank per normalized letter and preserve complete words and punctuation',()=>{
 const q={text:'Corrige solo el demostrativo.',answers:['Esos zapatos son de cuero.'],correct:[0]},player={current:{key:'test',index:0},wordPuzzle:{guesses:[],misses:0}};
 const clues=publicWordQuestion({questions:[q]},player),groups=groupWordSlots(clues.slots);
 assert.deepEqual(groups.filter(g=>g.letters).map(g=>g.letters),[4,7,3,2,5]);assert.equal(clues.slots.filter(s=>s.letter).length,21);assert.equal(groups.at(-1).slots.at(-1).value,'.');
 q.answers=['¡An\u0303o 2026, acción!'];const other=publicWordQuestion({questions:[q]},player),words=groupWordSlots(other.slots);assert.deepEqual(words.filter(g=>g.letters).map(g=>g.letters),[3,6]);assert.ok(other.slots.some(s=>s.value==='2'&&!s.letter));
});
