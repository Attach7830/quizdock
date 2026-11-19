// Presentation and discoverable game rules. All outcomes are resolved by the Worker.
export const GAMEPLAY_VERSION=1;
export const MODE_IDENTITIES={
 treasure:{verb:'Explore and protect',goal:'Build a haul, then decide when to bank it.'},
 fishing:{verb:'Discover the waters',goal:'Find new species and complete your collection.'},
 battle:{verb:'Read your rival',goal:'Build charge, guard a hit, or strike through a defense.'},
 factory:{verb:'Build an engine',goal:'Make parts, connect stations, and fulfill orders.'},
 rally:{verb:'Choose your racing line',goal:'Read the wind and save boost for a breakaway.'},
 keep:{verb:'Defend together',goal:'Build defenses and clear waves as a class.'},
 word:{verb:'Decode and forge',goal:'Use letter clues, then type the vocabulary word.'},
 sketch:{verb:'Draw and decode',goal:'One artist draws; classmates type guesses as letter clues appear.'}
};
export const WATERS=[
 {id:'reef',name:'Coral reef',hint:'Reliable catches and a good place to start a collection.',factor:.95,color:'#ffb59e'},
 {id:'deep',name:'Deep water',hint:'Heavier fish, with more varied catch sizes.',factor:1.25,color:'#97bdff'},
 {id:'shallows',name:'Moonlit shallows',hint:'Smaller catches, with a better chance of rare discoveries.',factor:.95,color:'#d8b2ff'}
];
export {FISH_SPECIES,FISH_RARITIES,FISH_BY_ID,fishRarity} from './fish-catalog.js';
export const WINDS=[{id:'tailwind',name:'Tailwind',hint:'A good time for rings or a boost dive.'},{id:'crosswind',name:'Crosswind',hint:'The ring route is trickier. Glide to build boost.'},{id:'storm',name:'Storm front',hint:'Gliding is reliable; charged dives still make progress.'}];
export const FISH_WEATHER=[{id:'clear',name:'Clear tide'},{id:'moon',name:'Moon tide'},{id:'current',name:'Strong current'}];
export const ARENAS=[
 {id:'standard',name:'Crystal arena',hint:'Balanced strikes and defenses.',strike:20,guard:18,charge:1,counter:12},
 {id:'surge',name:'Storm rails',hint:'Charge stores 2 power at once. Watch for heavy strikes.',strike:20,guard:18,charge:2,counter:12},
 {id:'mirror',name:'Mirror canopy',hint:'Guard absorbs 20 damage. Full blocks earn a larger counter bonus.',strike:20,guard:20,charge:1,counter:20},
 {id:'gale',name:'Gale ring',hint:'Strikes deal 24 damage, but guard absorbs only 16.',strike:24,guard:16,charge:1,counter:12}
];
export const STATIONS=[{id:'press',name:'Gear press',part:'gears',base:70,color:'#ffcc8b'},{id:'cells',name:'Cell lab',part:'cells',base:90,color:'#91ead7'},{id:'assembler',name:'Assembler',part:'bots',base:120,color:'#c9b0ff'}];
export const ENEMIES=[{id:'swarm',name:'Lantern swarm',intent:'Many small hits. Ward towers soften their attacks.',damage:10},{id:'golem',name:'Iron Golem',intent:'A heavy strike is coming. Repair or build a ward.',damage:18},{id:'wyvern',name:'Storm Wyvern',intent:'A boss wave! Build towers and combine your attacks.',damage:24}];
export const CHEST_ROUTES=[
 {id:'harbor',name:'Harbor chest',hint:'18–28 coins. Banks your whole haul; resets exploration bonus.',risk:'Safe'},
 {id:'ruins',name:'Ruins chest',hint:'24–42 coins, plus a growing exploration bonus. Your haul stays exposed.',risk:'Explore'},
 {id:'corsair',name:'Corsair chest',hint:'A bounded raid, a jackpot, or a storm. A storm risks at most 12 exposed coins.',risk:'Uncertain'}
];
