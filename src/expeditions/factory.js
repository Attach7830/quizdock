import {bonus,celebrate,contribute,pick,requireChoice,spend} from './shared.js';
const PARTS=['gears','cells','bots'],DIRECTIONS=['right','down','left','up'];
const CUSTOMERS=['Clockwork Sandwich Club','The Homework Vacuum Society','One Very Demanding Duck','The Cloud-Kettle Committee'];
const STARTER={1:'right',2:'right',3:'down',5:'right',6:'right',10:'right'};
export function createFactory(w,size){w.factory={project:{name:'The improbable airship',stage:0,progress:0,goal:Math.max(6,size*2),launches:0},offers:[],visitors:0};}
export function factoryPlayer(){return {belts:{...STARTER},transit:[],delivered:0,contract:{stage:0,completed:0,customer:CUSTOMERS[0],quantities:[2,1,1]},incident:null,repairs:0};}
function next(cell,direction){const row=Math.floor(cell/4),column=cell%4;if(direction==='right'&&column<3)return cell+1;if(direction==='left'&&column>0)return cell-1;if(direction==='down'&&row<2)return cell+4;if(direction==='up'&&row>0)return cell-4;return null;}
export function factoryAnswer(room,p,rng){
 const s=p.expedition.modeState,a=p.adventure;
 if(s.incident?.kind!=='power'&&s.transit.length<32){for(let i=0;i<a.stations.press&&s.transit.length<32;i++)s.transit.push({cell:0,part:'gears'});for(let i=0;i<a.stations.cells&&s.transit.length<32;i++)s.transit.push({cell:4,part:'cells'});}
 const delivered=[],arrived=[];
 for(const parcel of s.transit){if(s.incident?.cell===parcel.cell){arrived.push(parcel);continue;}const direction=parcel.cell===0||parcel.cell===4?'right':parcel.cell===7?'down':s.belts[parcel.cell];const target=next(parcel.cell,direction);if(target===11){a.stock[parcel.part]++;s.delivered++;delivered.push(parcel);}else arrived.push({...parcel,cell:target??parcel.cell});}
 if(a.stations.assembler){const gear=arrived.findIndex(x=>x.cell===7&&x.part==='gears'),cell=arrived.findIndex(x=>x.cell===7&&x.part==='cells');if(gear>=0&&cell>=0){const remove=new Set([gear,cell]);s.transit=arrived.filter((_,i)=>!remove.has(i));s.transit.push({cell:7,part:'bots'});}else s.transit=arrived;}else s.transit=arrived;
 if(delivered.length)contribute(p,'deliveries',delivered.length);
 if(room.expedition.tick%8===0&&!s.incident)s.incident={kind:pick(['jam','power'],rng),cell:pick([1,2,5,6,10],rng)};
}
export function factoryAction(room,p,action,value,rng){
 const w=room.expedition.factory,s=p.expedition.modeState,a=p.adventure;
 if(action==='belt'){const [cell,direction]=String(value).split(':');requireChoice(/^\d{1,2}$/.test(cell)&&+cell>=0&&+cell<12&&![0,4,7,11].includes(+cell)&&DIRECTIONS.includes(direction));spend(p);s.belts[+cell]=direction;return 'Conveyor routed. Correct answers move your parts through the factory.';}
 if(action==='contract'){const part=PARTS[s.contract.stage],quantity=s.contract.quantities[s.contract.stage];requireChoice(a.stock[part]>=quantity,`Deliver ${quantity} ${part} to the warehouse first.`);spend(p);a.stock[part]-=quantity;s.contract.stage++;bonus(room,p,18+s.contract.stage*4);contribute(p,'deliveries',quantity);if(s.contract.stage===3){s.contract.stage=0;s.contract.completed++;if(s.inspector){bonus(room,p,20);s.inspector=false;}s.contract.customer=pick(CUSTOMERS.filter(x=>x!==s.contract.customer),rng);s.contract.quantities=[2+s.contract.completed%3,1+s.contract.completed%2,1];contribute(p,'discoveries');celebrate(room,'contract','Ridiculous order fulfilled!',`${s.contract.customer} has a new request.`);}return 'A real warehouse shipment completed the next contract stage.';}
 if(action==='repair'){requireChoice(s.incident,'Your factory lines are running.');spend(p);s.incident=null;s.repairs++;bonus(room,p,8);contribute(p,'support');return 'Production restored. The conveyor is moving again.';}
 if(action==='donate'){const part=PARTS[w.project.stage];requireChoice(a.stock[part]>=1,`The airship needs a delivered ${part} component.`);spend(p);a.stock[part]--;w.project.progress++;contribute(p,'support');bonus(room,p,12);if(w.project.progress>=w.project.goal){w.project.stage++;w.project.progress=0;if(w.project.stage===3){w.project.stage=0;w.project.launches++;w.project.goal+=2;celebrate(room,'launch','The class airship launches!','Every donated component helped it fly.');}else celebrate(room,'project','Airship stage complete!',`Next component: ${PARTS[w.project.stage]}.`);}return 'Your component joined the shared airship.';}
 if(action==='offer'){
  const choices={gearCell:{give:'gears',giveCount:2,want:'cells',wantCount:1},cellGear:{give:'cells',giveCount:1,want:'gears',wantCount:2},botGear:{give:'bots',giveCount:1,want:'gears',wantCount:3}};const trade=choices[value];requireChoice(trade&&!w.offers.some(o=>o.playerId===p.id),'Choose a trade and finish or cancel your current offer first.');requireChoice(a.stock[trade.give]>=trade.giveCount,'Deliver enough parts before offering them.');a.stock[trade.give]-=trade.giveCount;w.offers.push({id:`${p.id}:${++room.expedition.tradeSerial}`,playerId:p.id,...trade});return 'Offer posted. Your parts are held safely until accepted or canceled.';
 }
 if(action==='cancel'){const i=w.offers.findIndex(o=>o.id===value&&o.playerId===p.id);requireChoice(i>=0,'That offer is no longer active.');const [offer]=w.offers.splice(i,1);a.stock[offer.give]+=offer.giveCount;return 'Offer canceled and its parts returned.';}
 if(action==='trade'){const i=w.offers.findIndex(o=>o.id===value&&o.playerId!==p.id);requireChoice(i>=0,'That offer is no longer active.');const offer=w.offers[i],owner=room.players[offer.playerId];requireChoice((offer.npc||owner&&!owner.deleted)&&a.stock[offer.want]>=offer.wantCount,'Deliver the requested parts first.');spend(p);a.stock[offer.want]-=offer.wantCount;a.stock[offer.give]+=offer.giveCount;if(owner)owner.adventure.stock[offer.want]+=offer.wantCount;w.offers.splice(i,1);contribute(p,'support');return 'Both factories received their agreed parts.';}
 throw new Error('Choose a factory district action.');
}
export function factoryView(room,p){return {...p.expedition.modeState,...room.expedition.factory};}
