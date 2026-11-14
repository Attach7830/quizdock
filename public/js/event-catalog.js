// Presentation only. The Worker chooses events and applies their game effects.
export const ARCADE_EVENTS = {
 treasure:[
  {kind:'coin-comet',name:'Coin comet',description:'A golden comet drops 24 bonus coins.'},
  {kind:'vault-echo',name:'Vault echo',description:'Your chest echoes: up to 30 extra coins.'},
  {kind:'compass-cache',name:'Compass cache',description:'A spinning compass reveals 18 hidden coins.'}
 ],
 fishing:[
  {kind:'lantern-shoal',name:'Lantern shoal',description:'Two glowing fish join your catch: +20 points.'},
  {kind:'pearl-dive',name:'Pearl dive',description:'A giant pearl surfaces: +35 points.'},
  {kind:'tidal-lift',name:'Tidal lift',description:'A curling wave lifts your catch: +25 points.'}
 ],
 battle:[
  {kind:'aegis-bloom',name:'Aegis bloom',description:'A shield flower restores up to 25 health.'},
  {kind:'meteor-volley',name:'Meteor volley',description:'Orbiting meteors award 30 bonus points.'},
  {kind:'repair-drone',name:'Repair drone',description:'A repair drone restores up to 15 health and adds 10 points.'}
 ],
 factory:[
  {kind:'overdrive',name:'Overdrive',description:'Gears surge: +$20, plus $8 per machine (up to 5).'},
  {kind:'cargo-airship',name:'Cargo airship',description:'An airship collects a special shipment: +$35.'},
  {kind:'golden-blueprint',name:'Golden blueprint',description:'A new design rolls off the line: +$28.'}
 ],
 rally:[
  {kind:'slipstream',name:'Slipstream',description:'Ride a spiraling air current for 28 bonus distance.'},
  {kind:'rainbow-gates',name:'Rainbow gates',description:'Thread three bright rings for 32 bonus distance.'},
  {kind:'cloud-trampoline',name:'Cloud trampoline',description:'Bounce off a springy cloud for 22 bonus distance.'}
 ],
 keep:[
  {kind:'aurora-bridge',name:'Aurora bridge',description:'An aurora connects the towers: +28 energy.'},
  {kind:'root-renewal',name:'Root renewal',description:'Crystal roots restore up to 25 health.'},
  {kind:'crystal-orbit',name:'Crystal orbit',description:'Three crystal satellites align: +32 energy.'}
 ]
};
export const eventByKind = kind => Object.values(ARCADE_EVENTS).flat().find(e => e.kind === kind);
