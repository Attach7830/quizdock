import {wordAdventure} from '../public/js/expedition-ui.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {GAME_GUIDES,gameGuideMarkup,nextMoveHint} from '../public/js/game-guide.js';
import {GAME_TYPES} from '../public/js/catalog.js';
import {forgeState,forgeMeter,RELIC_PATHS} from '../public/js/word-forge.js';
import {wordQuestionMarkup,wordKeyboardMarkup,SPANISH_LETTERS} from '../public/js/word-game-ui.js';
test('every mode explains its goal, three-step loop, first strategy, optional activities and saved currencies',()=>{
 assert.deepEqual(Object.keys(GAME_GUIDES),Object.keys(GAME_TYPES));
 for(const mode of Object.keys(GAME_TYPES)){const guide=GAME_GUIDES[mode],html=gameGuideMarkup({mode,settings:{kind:'score',target:1200}});assert.equal(guide.steps.length,3);assert.ok(guide.goal&&guide.start&&guide.rules);assert.match(html,/1,200/);assert.match(html,/separate saved balance/);assert.match(html,/Closing Adventure/);}
});
test('next-action hints disclose automatic moves and distinguish a choice for the next turn from an immediate reward',()=>{
 const me={feedback:{correct:true},play:{},adventure:{boost:2}};
 assert.match(nextMoveHint({mode:'battle',me}),/automatically strikes/);assert.match(nextMoveHint({mode:'fishing',me}),/NEXT water/);assert.match(nextMoveHint({mode:'rally',me}),/NEXT route.*2\/3/);assert.match(nextMoveHint({mode:'keep',me}),/saves/);assert.match(nextMoveHint({mode:'factory',me}),/saves/);
 assert.match(nextMoveHint({mode:'treasure',me:{...me,pendingChests:[]}}),/Choose a chest/);assert.match(nextMoveHint({mode:'battle',me:{feedback:{correct:false}}}),/correct answer/);
});
test('five correct words awaken a relic, the next prompt begins a new recipe, and mistakes never erase progress',()=>{
 assert.equal(forgeState(0).step,0);assert.equal(forgeState(4).stage,'Awaken');
 const f=forgeState(5,{result:true,correct:true});assert.equal(f.complete,true);assert.equal(f.step,5);assert.equal(f.cycle,0);assert.equal(f.relic,'Starsteel Blade');
 assert.equal(forgeState(5).cycle,1);assert.equal(forgeState(5).step,0);assert.equal(forgeState(5,{result:true,correct:false}).complete,false);
 assert.equal(forgeState(60).rank,2);assert.equal(new Set(RELIC_PATHS).size,6);assert.match(forgeMeter(5,{result:true,correct:true}),/data-forge-complete="true"/);
});
test('typed screen keeps the answer primary; the complete alphabet is only offered as an explained clue tool',()=>{
 const q={number:1,text:'to learn',slots:Array.from({length:8},()=>({letter:true,value:''})),misses:0,guesses:[]};
 const html=wordQuestionMarkup(q,false,{adventure:{solved:4}});assert.match(html,/live-word-answer/);assert.match(html,/data-forge-step="4"/);assert.match(html,/word-clues/);assert.doesNotMatch(html,/data-act="word-letter"/);
 const clues=wordKeyboardMarkup(q);assert.equal((clues.match(/data-act="word-letter"/g)||[]).length,SPANISH_LETTERS.length);for(const letter of SPANISH_LETTERS)assert.ok(clues.includes(`data-letter="${letter}"`));assert.match(clues,/type your full answer/);
 assert.equal(wordQuestionMarkup({...q,text:'<script>alert(1)</script>'}).includes('<script>'),false);
});

test('Word Forge adventure shows one explained helper and keeps automatic bosses and bonuses in a closed section',()=>{
 const state={activity:'crossword',crossword:{rows:1,cols:1,cells:[{active:true,row:0,col:0,number:1,value:'',indices:[0]}],entries:[{number:1,direction:'across',clue:'house',length:4,active:true}]},chain:0,rooms:1,seals:3,recipes:0,guardian:{name:'The constellation keeper',phase:2,defeated:0,hp:54,max:90}};
 const p={adventure:{solved:3},question:{activity:{kind:'crossword'}}},html=wordAdventure(state,2,p);
 assert.match(html,/data-word-helper="crossword"/);assert.match(html,/You do not click or type into the grid/);assert.match(html,/<details class="word-extra-challenge"><summary>/);assert.match(html,/automatic class boss/);assert.match(html,/remaining health/);assert.doesNotMatch(html,/Escape chain|No example attached/);assert.match(html,/Change helper · Crossword/);assert.match(html,/Return to my typed answer/);
 const chain=wordAdventure({...state,activity:'chain'},2,{...p,question:{activity:{kind:'chain'}}});assert.match(chain,/three-word streak/);assert.doesNotMatch(chain,/class="exp-crossword"/);
});
