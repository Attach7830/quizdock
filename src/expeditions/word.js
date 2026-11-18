import {makeCrossword,publicCrossword,WORD_ACTIVITIES} from '../word-activities.js';
import {bonus,boss,celebrate,contribute,hitBoss,requireChoice,spend} from './shared.js';
export function createWord(w,size,rng,questions){w.word={crossword:makeCrossword(questions,rng),guardian:boss(size,'The constellation keeper')};}
export function wordPlayer(){return {activity:'auto',solved:[],seals:0,chain:0,rooms:0,lastHint:null,hints:0,recipes:0};}
export function wordAnswer(room,p){const s=p.expedition.modeState;if(!s.solved.includes(p.current.index)){s.solved.push(p.current.index);contribute(p,'discoveries');}s.seals++;s.chain++;contribute(p,'support');if(s.chain%3===0){s.rooms++;contribute(p,'rooms');celebrate(room,'word','A library chamber opens!',`Your chain forged ${s.chain} words.`);}const won=hitBoss(room,p,room.expedition.word.guardian,12,'The library’s last seal shatters!');if(won)bonus(room,p,30);}
export function wordAction(room,p,action,value){
 const s=p.expedition.modeState;
 if(action==='activity'){requireChoice(WORD_ACTIVITIES.includes(value));s.activity=value;return 'Word activity selected. Final typed answers keep the same grading.';}
 if(action==='hint'){requireChoice(['meaning','image','example'].includes(value));const q=room.questions[p.current.index];requireChoice(value!=='image'||q.image,'Your teacher has not attached an image to this card.');requireChoice(value!=='example'||q.example,'Your teacher has not attached an example to this card.');requireChoice(!s.lastHint||s.lastHint.key!==p.current.key||s.lastHint.kind!==value,'That hint is already open.');if(value!=='meaning')spend(p);s.hints++;s.lastHint={key:p.current.key,kind:value};return 'Hint opened. It changes only the optional adventure bonus.';}
 if(action==='recipe'){requireChoice(p.feedback?.correct,'Forge a correct word before collecting its recipe.');requireChoice(s.recipes<s.seals,'That recipe is already collected.');spend(p);s.recipes=s.seals;bonus(room,p,12);contribute(p,'discoveries');return 'The word recipe joins your spellbook.';}
 throw new Error('Choose a library action.');
}
export function wordView(room,p){const w=room.expedition.word,s=p.expedition.modeState;return {...s,crossword:publicCrossword(w.crossword,s.solved,p.current?.index),guardian:{...w.guardian,contributors:undefined}};}
