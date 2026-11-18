// Character points only. Prices, ownership and slot permissions are enforced by
// the server; previewing an item never grants it or changes an account balance.
export const ITEM_SLOTS={hat:'Hats',face:'Face',hand:'Held items',back:'Back items',aura:'Auras'};
export const AVATAR_ITEMS=[
 {id:'paper-boat',name:'Paper Boat Hat',slot:'hat',price:25,rarity:'Classic',description:'Ready to sail the classroom carpet.'},
 {id:'banana-hat',name:'Emergency Banana',slot:'hat',price:125,rarity:'Rare',description:'A snack? A crown? An important decision.'},
 {id:'traffic-cone',name:'Royal Traffic Cone',slot:'hat',price:50000,rarity:'Mythic',description:'The road to greatness is temporarily closed.'},
 {id:'billion-party-hat',name:'Billion Point Party Hat',slot:'hat',price:1000000000,rarity:'Absurd',description:'One billion points. One extremely festive hat.'},
 {id:'safety-goggles',name:'Questionable Safety Goggles',slot:'face',price:70,rarity:'Classic',description:'For dangerously difficult vocabulary.'},
 {id:'tiny-mustache',name:'Mustache of Authority',slot:'face',price:180,rarity:'Rare',description:'Instantly in charge of absolutely nothing.'},
 {id:'star-shades',name:'Superstar Shades',slot:'face',price:1000,rarity:'Epic',description:'Every entrance deserves a soundtrack.'},
 {id:'laser-eyes',name:'Overqualified Laser Eyes',slot:'face',price:25000,rarity:'Mythic',description:'Still cannot do your homework for you.'},
 {id:'rubber-duck',name:'Emotional Support Duck',slot:'hand',price:90,rarity:'Classic',description:'Excellent listener. Limited grammar advice.'},
 {id:'pizza-shield',name:'Emergency Pizza Shield',slot:'hand',price:500,rarity:'Rare',description:'Protects your style. Does not block game damage.'},
 {id:'magic-pencil',name:'Grand Pencil of Revision',slot:'hand',price:2500,rarity:'Epic',description:'For making extremely dramatic corrections.'},
 {id:'giant-spoon',name:'Suspiciously Large Spoon',slot:'hand',price:10000,rarity:'Legendary',description:'Nobody asked for this much spoon.'},
 {id:'million-stick',name:'Million Point Stick',slot:'hand',price:1000000,rarity:'Absurd',description:'A stick. It costs a million points. It is a very nice stick.'},
 {id:'patchwork-cape',name:'Heroic Laundry Cape',slot:'back',price:200,rarity:'Rare',description:'Fresh from the dryer. Ready for destiny.'},
 {id:'cardboard-wings',name:'Cardboard Wings',slot:'back',price:300,rarity:'Rare',description:'Certified for looking like you can fly.'},
 {id:'portable-throne',name:'Portable Throne',slot:'back',price:100000,rarity:'Mythic',description:'Your Majesty has brought a chair.'},
 {id:'duck-council',name:'Council of Tiny Ducks',slot:'back',price:250000,rarity:'Absurd',description:'They have discussed your outfit and approve.'},
 {id:'sparkle-cloud',name:'Unnecessary Sparkles',slot:'aura',price:1000,rarity:'Epic',description:'Adds sparkle to literally standing there.'},
 {id:'orbiting-homework',name:'Orbiting Homework',slot:'aura',price:2000,rarity:'Epic',description:'Your unfinished work has achieved orbit.'},
 {id:'galactic-potatoes',name:'Galactic Potatoes',slot:'aura',price:50000,rarity:'Mythic',description:'The universe is mostly potatoes. Probably.'}
];
export const itemById=id=>AVATAR_ITEMS.find(item=>item.id===id);
export function cleanEquipment(value){
 const equipment={};if(!value||typeof value!=='object')return equipment;
 for(const slot of Object.keys(ITEM_SLOTS)){const item=itemById(value[slot]);if(item?.slot===slot)equipment[slot]=item.id;}
 return equipment;
}
export function ownedEquipment(profile={}){
 const owned=new Set(Array.isArray(profile.ownedItems)?profile.ownedItems:[]);
 return Object.fromEntries(Object.entries(cleanEquipment(profile.equipment)).filter(([,id])=>owned.has(id)));
}
