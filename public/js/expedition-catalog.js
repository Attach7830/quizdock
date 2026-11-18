import {AVATAR_ITEMS} from './item-catalog.js';
// Shared presentation data. The room server owns resources, choices and awards.
export const EXPEDITION_VERSION=1;
export const INTENSITIES={calm:{name:'Calm',eventEvery:8,rareEvery:5},standard:{name:'Standard',eventEvery:5,rareEvery:4},chaotic:{name:'Chaotic',eventEvery:3,rareEvery:3}};
export const MODIFIERS=[
 {id:'explorers',name:'Explorer skies',description:'Every third correct answer supplies an extra adventure token.'},
 {id:'teamwork',name:'Together we shine',description:'Different classmates contributing strengthens shared encounters.'},
 {id:'discovery',name:'Curious world',description:'More discoveries, bonus rooms and unusual visitors.'}
];
export const CHAPTERS=[
 {mode:'treasure',name:'The missing atlas',goal:24,story:'Recover fragments of an atlas to find the lost classroom archipelago.'},
 {mode:'fishing',name:'The lantern sea',goal:24,story:'Help the reef creatures light the route across the dark sea.'},
 {mode:'battle',name:'The mirror guardian',goal:24,story:'Defeat the guardian blocking the ancient bridge.'},
 {mode:'factory',name:'An unlikely airship',goal:24,story:'Build an airship from gears, cells and spectacularly questionable plans.'},
 {mode:'rally',name:'Above the thunder',goal:24,story:'Fly the expedition through the floating islands.'},
 {mode:'keep',name:'The crystal beacon',goal:24,story:'Rebuild the beacon and defend the island together.'},
 {mode:'word',name:'The library of stars',goal:24,story:'Forge the words that restore the island’s lost constellations.'},
 {mode:'sketch',name:'The living mural',goal:12,story:'Draw the final chapter and bring the island’s story to life.'}
];
export const HUB_BUILDINGS=[{id:'library',name:'Sky Library',icon:'▤'},{id:'aquarium',name:'Lantern Aquarium',icon:'≈'},{id:'hangar',name:'Cloud Hangar',icon:'➤'},{id:'festival',name:'Festival Plaza',icon:'✦'}];
export const AQUARIUM_DECOR=[{id:'reef',name:'Coral arch',need:0},{id:'kelp',name:'Kelp garden',need:2},{id:'wreck',name:'Tiny shipwreck',need:4},{id:'castle',name:'Sand castle',need:6},{id:'lantern',name:'Lantern cave',need:8},{id:'moon',name:'Moon gate',need:12}];
export const HANGAR_COLORS=[{id:'harbor',name:'Harbor mint',color:'#79e4c4',need:0},{id:'sunset',name:'Sunset coral',color:'#ffa6a0',need:0},{id:'sky',name:'Glacier blue',color:'#9bdcff',need:0},{id:'orchid',name:'Orchid dusk',color:'#c6a8ff',need:12},{id:'gold',name:'Solar gold',color:'#ffd887',need:40},{id:'nebula',name:'Nebula pink',color:'#ffafe7',need:100}];
export const HANGAR_TRAILS=[{id:'none',name:'No trail',need:0},{id:'cloud',name:'Cloud ribbon',need:0},{id:'stars',name:'Star trail',need:20},{id:'aurora',name:'Aurora stream',need:80}];
export const HANGAR_EMBLEMS=[{id:'star',name:'Star',symbol:'✦',need:0},{id:'wing',name:'Wing',symbol:'➤',need:0},{id:'duck',name:'Duck squad',symbol:'◉',need:30},{id:'crown',name:'Sky crown',symbol:'♛',need:100}];
export const COLLECTIONS=[
 {id:'classroom',name:'Classroom adventurer',items:['paper-boat','safety-goggles','magic-pencil','cardboard-wings']},
 {id:'kitchen',name:'Extremely prepared',items:['banana-hat','rubber-duck','pizza-shield','giant-spoon']},
 {id:'cosmic',name:'Cosmic nonsense',items:['star-shades','laser-eyes','sparkle-cloud','galactic-potatoes']},
 {id:'absurd',name:'Perfectly reasonable purchases',items:['million-stick','billion-party-hat','duck-council','portable-throne']},
 {id:'pocket-money',name:'Pocket money, enormous personality',items:['tin-foil-hat','googly-eyes','squeaky-hammer','backpack-snail','floating-spoons']},
 {id:'breakfast',name:'Breakfast has escaped',items:['toast-hat','baguette-mustache','baguette-saber','sandwich-jetpack','toast-satellites']},
 {id:'weather',name:'The forecast is deeply confusing',items:['satellite-dish','tiny-weather','pocket-tornado','tiny-tornado-engine','miniature-rain']},
 {id:'office',name:'This outfit could have been an email',items:['bureaucratic-beard','tiny-whiteboard','mailbox-of-mystery','tiny-office']},
 {id:'underwater',name:'The fish have formed a committee',items:['fishbowl-helmet','fish-tank-glasses','fish-on-a-stick','aquarium-backpack','cosmic-jellyfish']},
 {id:'questionable-engineering',name:'Questionable engineering society',items:['wizard-traffic-light','snorkeling-tuba','plunger-of-destiny','shopping-cart-wings','confetti-emergency']},
 {id:'long-way-home',name:'The very long way home',items:['origami-dragon','quest-snail','kindness-lantern','courier-cape','bookshelf-wings','curious-fireflies']},
 {id:'beyond-horizon',name:'Beyond the horizon',items:['library-castle','quest-cosmic-goose','all-seeing-toast','council-scepter','cloud-train','wandering-island','universe-in-a-jar','phoenix-of-revision']}
];
export const ACHIEVEMENTS=[
 {id:'first-steps',name:'First expedition',stat:'rounds',goal:1},
 {id:'steady-explorer',name:'Steady explorer',stat:'correct',goal:25},
 {id:'persistent',name:'Kept going',stat:'answered',goal:100},
 {id:'team-builder',name:'Team builder',stat:'support',goal:10},
 {id:'curious',name:'Curious mind',stat:'discoveries',goal:12},
 {id:'adaptable',name:'Many paths',stat:'modes',goal:8},
 {id:'improving',name:'A new personal best',stat:'improvements',goal:3},
 {id:'precise',name:'Accuracy streak',stat:'accurateRounds',goal:5}
];
export const PERSONAL_QUESTS=[
 {id:'explore',name:'Find something new',target:3,metric:'discoveries'},
 {id:'support',name:'Help the expedition',target:3,metric:'support'},
 {id:'solve',name:'Build a rhythm',target:5,metric:'correct'}
];
// Account goals use saved expedition totals across classes. No daily streak or deadline.
export const JOURNEY_TRACKS=[
 {stat:'correct',name:'The learning odyssey',unit:'correct answers',goals:[25,100,500,2500,10000,100000],titles:['A bright beginning','Finding your voice','Paper dragon keeper','Page turner','Walking encyclopedia','Keeper of the sky library']},
 {stat:'rounds',name:'A thousand adventures',unit:'finished rounds',goals:[5,20,50,200,500,2000],titles:['Passport ready','Frequent explorer','Bookshelf aviator','Beyond the map','Old hand at adventure','The wandering classroom']},
 {stat:'support',name:'Leave nobody behind',unit:'team contributions',goals:[10,50,100,500,2000,10000],titles:['A helping hand','Reliable teammate','Lantern bearer','The team remembers','Beacon of the class','Honorary duck councillor']},
 {stat:'discoveries',name:'A world of wonders',unit:'discoveries',goals:[12,40,100,500,1500,5000],titles:['What is over there?','Curiosity collector','Firefly friend','Map of mysteries','Very curious indeed','A universe of wonders']},
 {stat:'rescues',name:'The long way home',unit:'couriers rescued',goals:[5,20,50,250,1000,10000],titles:['First rescue route','Cloud patrol','Courier captain','Guardian of the skies','No courier forgotten','Conductor of the rescue express']},
 {stat:'accurateRounds',name:'Steady hands, sharp mind',unit:'accurate rounds',goals:[5,10,25,100,300,1000],titles:['A steady start','Finding focus','Spectacularly focused','Calm under pressure','Precision adventurer','The breakfast oracle']},
 {stat:'improvements',name:'Better than yesterday',unit:'personal bests improved',goals:[3,5,10,50,150,500],titles:['A little better','Another new best','A second wind','Rewriting the record','Never done learning','Phoenix of revision']},
 {stat:'quests',name:'Just one more side quest',unit:'personal quests completed',goals:[3,10,25,100,500,2500],titles:['An interesting detour','Quest notebook','The patient snail','Side quest specialist','The detour is the destination','The eternal quest goose']}
];
export const journeyUnit=stat=>JOURNEY_TRACKS.find(track=>track.stat===stat)?.unit||stat;
export function journeyMilestones(stats={}){
 return JOURNEY_TRACKS.flatMap(track=>track.goals.map((goal,i)=>({id:`${track.stat}-${goal}`,stat:track.stat,goal,name:track.titles[i],track:track.name,unit:track.unit,value:Math.max(0,Number(stats[track.stat])||0),reward:AVATAR_ITEMS.find(item=>item.quest?.stat===track.stat&&item.quest.goal===goal)?.id||null})));
}
export const BUILD_MOVES=[
 {id:'spark',name:'Spark',description:'Fire + wind combine into a storm strike.',element:'fire'},
 {id:'frost',name:'Frost',description:'Frost + wind combine into a protecting veil.',element:'frost'},
 {id:'gale',name:'Gale',description:'Wind links another element into a combo.',element:'wind'},
 {id:'mend',name:'Mend',description:'Support the class boss encounter and restore resolve.',element:'mend'},
 {id:'ward',name:'Ward',description:'Protect your position before the next hazard.',element:'ward'}
];
export const MODE_EVENTS={
 treasure:[['tidal-door','A tidal door opens','One fragment joins the shared atlas.'],['mimic-parade','Mimic parade','A mimic guards an extra cache.'],['compass-surge','Compass surge','Your next exploration costs less.'],['lantern-festival','Lantern festival','A lantern relic lights your expedition.'],['atlas-eclipse','Atlas eclipse','Two fragments join the shared atlas.'],['ghost-armada','The ghost armada','The atlas is assembled; a spectral ship moves nearby.']],
 fishing:[['silver-migration','Silver migration','A new school moves through the water.'],['bubble-trail','Follow the bubbles','Sonar discovers an underwater site.'],['kelp-bloom','Kelp bloom','Your next two habitat casts favor unusual species.'],['moon-jelly','Moon jelly lanterns','Your next two habitat casts favor unusual species.'],['ancient-song','An ancient song','The giant fish takes 15 class damage and enters its migration phase.'],['lantern-leviathan','Lantern Leviathan','The giant fish takes 15 class damage and enters its migration phase.']],
 battle:[['shifting-floor','The arena shifts','The next hazard moves to a different lane.'],['resonant-runes','Resonant runes','Store an extra spell element.'],['ally-beacon','An ally beacon','Your next lane hazard meets a 12-point ward.'],['mirror-rift','Mirror rift','A new objective opens.'],['titan-echo','Echo of the titan','The guardian exposes a weakness.'],['star-guardian','The star guardian','The guardian takes 15 class damage and changes its elemental weakness.']],
 factory:[['belt-jam','Conveyor jam','Choose a production line to repair.'],['odd-customer','An unlikely customer','A ridiculous order has arrived.'],['power-flicker','Power flicker','Repair a line to recover production.'],['cargo-fair','Cargo fair','New exchange offers are available.'],['rocket-inspector','The rocket inspector','Your next completed customer contract earns 20 extra cash.'],['clockwork-parade','Clockwork parade','One extra component joins the current megaproject stage.']],
 rally:[['cloud-crossroads','Cloud crossroads','A new branch of the course opens.'],['lost-courier','A lost courier','A rescue signal appears off the route.'],['gate-dance','Dancing gates','The moving gate pattern changes.'],['formation-call','Formation call','Your plane gains one stored boost.'],['cloud-whale','The cloud whale','A cloud whale crosses the route; the citadel takes 12 damage.'],['flying-citadel','The flying citadel','A flying fortress crosses the route; the citadel takes 12 damage.']],
 keep:[['tunnel-rumble','A rumble below','The attack front changes.'],['rune-alignment','Runes align','An existing class tower gains a level, up to level three.'],['scout-signal','Scout signal','Scouts strengthen the next four class attacks.'],['beacon-surge','Beacon surge','Crystal Nova gains a quarter of its required charge.'],['castle-awakens','The castle awakens','A new floor opens four more building squares.'],['crystal-dragon','Crystal dragon','A crystal dragon reveals a weakness for six class attacks.']],
 word:[['ink-river','A river of ink','One adventure token is restored.'],['crossing-stars','Crossing stars','A bonus library chamber opens.'],['broken-phrase','The broken phrase','Your workshop switches to sentence repair when the card supports it.'],['root-garden','The root garden','Your workshop switches to word recipes when the card supports them.'],['sealed-library','The sealed library','The constellation keeper takes 12 class damage.'],['constellation-keeper','Constellation keeper','The constellation keeper takes 12 class damage.']],
 sketch:[['palette-shift','The palette shifts','The next word uses a drawing constraint.'],['paper-bridge','A paper bridge','The mural gains another panel.'],['double-brush','Two brushes','The next word uses outline and color partners when enough students are present.'],['story-spark','A story spark','The next drawing can become a storyboard.'],['living-gallery','The living gallery','The class mural lights up.'],['ink-phoenix','The ink phoenix','A rare drawing celebration begins.']]
};
export const MODE_MISSIONS={
 treasure:{title:'Expedition atlas',unit:'rooms',icon:'◆'},fishing:{title:'Lantern lagoon',unit:'discoveries',icon:'≈'},battle:{title:'Guardian arena',unit:'combos',icon:'ϟ'},factory:{title:'Clockwork district',unit:'deliveries',icon:'▦'},rally:{title:'Cloud archipelago',unit:'checkpoints',icon:'➤'},keep:{title:'Living citadel',unit:'defenses',icon:'⬡'},word:{title:'Library of stars',unit:'seals',icon:'✦'},sketch:{title:'Living mural',unit:'panels',icon:'✎'}
};
