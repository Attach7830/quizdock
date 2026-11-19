// Public presentation data. Purchases and game rules are enforced by the server.
export const GAME_TYPES = {
 treasure:{name:'Treasure Quest',icon:'◆',description:'Bank a haul, explore ruins, or risk a corsair chest.',unit:'coins'},
 fishing:{name:'Fishing Frenzy',icon:'≈',description:'Explore waters, discover species, and complete collections.',unit:'points'},
 battle:{name:'Battle Arena',icon:'ϟ',description:'Strike, guard, and charge in a tactical arena.',unit:'points'},
 factory:{name:'Factory Tycoon',icon:'▦',description:'Build production lines and fulfill orders.',unit:'net worth'},
 rally:{name:'Sky Rally',icon:'➤',description:'Choose your plane, read the wind, and manage boost.',unit:'distance'},
 keep:{name:'Crystal Keep',icon:'⬡',description:'Defend a shared crystal with towers and team attacks.',unit:'energy'},
 word:{name:'Word Forge',icon:'✦',description:'Decode vocabulary with letter clues and typed answers.',unit:'points'},
 sketch:{name:'Sketch Relay',icon:'✎',description:'Take turns drawing while classmates guess with letter clues.',unit:'points'}
};
export const PLAYER_TYPES = {
 rally:[
  {id:'sprinter',name:'Sprinter',benefit:'32 distance per correct answer',weakness:'Wrong answers lose 14 distance',gain:32,penalty:14},
  {id:'navigator',name:'Navigator',benefit:'Wrong answers lose only 2 distance',weakness:'Only 20 distance per correct answer',gain:20,penalty:2},
  {id:'ace',name:'Ace',benefit:'Streak bonus doubles',weakness:'Starts at 22 distance per correct answer; loses 8 on mistakes',gain:22,penalty:8}
 ],
 keep:[
  {id:'striker',name:'Striker',benefit:'Earns 40 energy on a correct answer',weakness:'Mistakes cost 24 health',gain:40,penalty:24},
  {id:'warden',name:'Warden',benefit:'Mistakes cost only 6 health',weakness:'Earns only 24 energy per correct answer',gain:24,penalty:6},
  {id:'mender',name:'Mender',benefit:'Correct answers restore 10 health',weakness:'Earns 28 energy; mistakes cost 16 health',gain:28,penalty:16}
 ]
};
export const SKINS = [
 {id:'mint',name:'Harbor Scout',price:0,primary:'#69e3cb',secondary:'#1d6172',accent:'#e6fff7',shape:'round'},
 {id:'coral',name:'Coral Captain',price:60,primary:'#ff9d98',secondary:'#a64373',accent:'#ffecc4',shape:'round'},
 {id:'solar',name:'Solar Pilot',price:90,primary:'#ffd27d',secondary:'#b47239',accent:'#fff3ca',shape:'visor'},
 {id:'orchid',name:'Orchid Ranger',price:120,primary:'#c2a1ff',secondary:'#6545a1',accent:'#f4e6ff',shape:'crown'},
 {id:'arctic',name:'Arctic Explorer',price:150,primary:'#9ee3ff',secondary:'#3e73ad',accent:'#f0fbff',shape:'visor'},
 {id:'ember',name:'Ember Guardian',price:180,primary:'#ffb371',secondary:'#a44542',accent:'#ffe5b8',shape:'horns'},
 {id:'forest',name:'Forest Keeper',price:200,primary:'#b1e79e',secondary:'#41795f',accent:'#fff4a9',shape:'crown'},
 {id:'midnight',name:'Midnight Voyager',price:250,primary:'#94a3d3',secondary:'#353a66',accent:'#e1d1ff',shape:'visor'},
 {id:'stormwing',name:'Stormwing Ace',price:7500,primary:'#91e7ed',secondary:'#6045a1',accent:'#e0ffff',shape:'wings',rarity:'Epic'},
 {id:'frostblade',name:'Frostblade Knight',price:10000,primary:'#a5dfff',secondary:'#3869a8',accent:'#efffff',shape:'knight',rarity:'Epic'},
 {id:'nebula',name:'Nebula Mage',price:50000,primary:'#c8a4ff',secondary:'#55378d',accent:'#ffdf9f',shape:'mage',rarity:'Legendary'},
 {id:'sunforge',name:'Sunforge Sentinel',price:100000,primary:'#ffd58b',secondary:'#985044',accent:'#fff3c4',shape:'sentinel',rarity:'Legendary'},
 {id:'kitsune',name:'Nightfall Kitsune',price:250000,primary:'#e7b4ff',secondary:'#64448c',accent:'#fff0e3',shape:'fox',rarity:'Legendary'}
];
export const skinById = (id,equipment) => {const skin=SKINS.find(s=>s.id===id)||SKINS[0];return equipment?{...skin,equipment}:skin;};
export const roleById = (mode,id) => PLAYER_TYPES[mode]?.find(r=>r.id===id);
