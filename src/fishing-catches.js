import {FISH_SPECIES,FISH_RARITIES,FISH_ROLL_TOTAL,fishRarityWeights} from '../public/js/fish-catalog.js';
const pools=new Map();
for(const water of ['reef','deep','shallows'])for(const rarity of FISH_RARITIES)pools.set(`${water}:${rarity.id}`,FISH_SPECIES.filter(f=>f.water===water&&f.rarity===rarity.id));
export function catchRarity(ticket,boost=0){
 if(!Number.isInteger(ticket)||ticket<1||ticket>FISH_ROLL_TOTAL)throw new Error('Invalid catch ticket.');
 let ceiling=0;const weights=fishRarityWeights(boost);
 for(let i=0;i<weights.length;i++){ceiling+=weights[i];if(ticket<=ceiling)return FISH_RARITIES[i].id;}
}
// Discovery assistance can only choose within the rolled tier. In particular,
// neither an almost-complete collection nor a lucky habitat can force a Mythic.
export function selectFish({water,boost=0,owned=[],preferNew=false},rng){
 const rarity=catchRarity(rng(1,FISH_ROLL_TOTAL),boost);
 const pool=pools.get(`${water}:${rarity}`);if(!pool?.length)throw new Error('Choose valid fishing waters.');
 const seen=new Set(owned),fresh=preferNew&&rarity!=='mythic'?pool.filter(f=>!seen.has(f.id)):[];
 const choices=fresh.length?fresh:pool;return choices[rng(0,choices.length-1)];
}

export const SHINY_ODDS=8192;
export const rollShiny=rng=>rng(1,SHINY_ODDS)===1;
