import {esc} from './ui.js';
const RELICS=['Starsteel Blade','Thunder Lantern','Moonveil Shield','Phoenix Scepter','Astral Compass','Stormglass Crown','Dawnfire Hammer','Dragonheart Key','Aurora Trident','Worldweaver Staff','Celestial Hourglass','Infinity Prism'];
export function motionAllowed(){try{return (typeof matchMedia==='undefined'||!matchMedia('(prefers-reduced-motion:reduce)').matches)&&(typeof localStorage==='undefined'||localStorage.getItem('qd-motion')!=='off');}catch{return true;}}
const STAGES=['Shape','Temper','Engrave','Enchant','Awaken'];
export function forgeState(solved=0,{result=false,correct=false}={}){
 const n=Math.max(0,Math.floor(Number(solved)||0)),complete=!!(result&&correct&&n>0&&n%5===0),cycle=Math.floor((complete?n-1:n)/5),step=complete?5:n%5;
 return {solved:n,cycle,step,complete,relic:RELICS[cycle%RELICS.length],rank:Math.floor(cycle/RELICS.length)+1,stage:complete?'Awakened!':STAGES[step],shape:cycle%6};
}
export const RELIC_PATHS=[
 'M38 7L48 19L43 57L48 60L45 67L38 63L31 67L28 60L33 57L28 19ZM35 64L41 64L41 78L35 78Z',
 'M22 26L54 26L59 62L49 73L27 73L17 62ZM31 26V17Q38 5 45 17V26M20 36L56 36M25 64L51 64',
 'M38 10L62 21L59 53L49 69L38 80L27 69L17 53L14 21ZM38 25L46 42L38 59L30 42Z',
 'M35 39L41 39L43 81L33 81ZM38 5L49 20L46 35L30 35L27 20ZM18 14L27 20M58 14L49 20',
 'M38 10L63 36L38 62L13 36ZM38 20L46 36L38 52L30 36ZM32 62L44 62L44 80L32 80Z',
 'M14 28L25 41L38 12L51 41L62 28L56 66L20 66ZM20 72L56 72L54 80L22 80Z'
 ];
export function relicMarkup(shape=0){
 return `<svg class="forge-relic" viewBox="0 0 76 88" aria-hidden="true"><path d="${RELIC_PATHS[shape%6]}" fill="currentColor" stroke="#fff1bd" stroke-width="2" stroke-linejoin="round"/><path d="M38 27L43 36L38 45L33 36Z" fill="#ecfaff"/></svg>`;
}
export function forgeMeter(solved=0,options={}){
 const f=forgeState(solved,options),streak=Math.max(0,Number(options.streak)||0),label=f.complete?`${f.relic} forged!`:`${f.relic} · ${f.step}/5`;
 return `<div class="forge-meter ${options.result?'forge-result':''} ${f.complete?'forge-awakened':''} ${options.result&&options.correct&&motionAllowed()?'forge-strike':''}" data-forge-step="${f.step}" data-forge-cycle="${f.cycle}" data-forge-complete="${f.complete}">${relicMarkup(f.shape)}<div class="forge-meter-copy"><strong>${esc(label)}${f.rank>1?` · Rank ${f.rank}`:''}</strong><span class="forge-stage">${f.complete?'Constellation lit · next relic awaits':`Next strike: ${f.stage}`}${streak>1?` · ${streak} word streak`:''}</span><div class="forge-strikes" role="progressbar" aria-label="Correct words toward this relic" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${f.step}">${STAGES.map((stage,i)=>`<i class="${i<f.step?'lit':''}" title="${stage}"></i>`).join('')}</div></div><span class="forge-sparks" aria-hidden="true">✦</span></div>`;
}
