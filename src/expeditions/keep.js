import {bonus,celebrate,contribute,requireChoice,spend} from './shared.js';
const FRONTS=['north gate','east wall','tunnel'],TYPES=['bolt','ward','lens'];
export function createKeep(w,size){w.keep={grid:Array(16).fill(null),front:0,wardBonus:0,ultimate:0,ultimateGoal:Math.max(8,size*2),ultimateContributors:[],ultimates:0,scout:null,scoutFor:0,floor:1,openCells:8};}
export function keepPlayer(){return {front:0,scouts:0,scoutSteps:0,placed:0};}
function adjacent(a,b){return Math.abs(Math.floor(a/4)-Math.floor(b/4))+Math.abs(a%4-b%4)===1;}
export function keepAnswer(room,p){
 const w=room.expedition.keep,k=room.gameplay.keep;
 w.ultimate++;if(!w.ultimateContributors.includes(p.id))w.ultimateContributors.push(p.id);if(room.expedition.tick%4===0)w.front=(w.front+1)%3;
 w.wardBonus=Math.min(10,w.grid.reduce((n,t,i)=>n+(t?.type==='ward'&&Math.floor(i/4)%3===w.front?t.level*2:0),0));
 let synergy=0;for(let i=0;i<16;i++)if(w.grid[i])for(let j=i+1;j<16;j++)if(w.grid[j]&&adjacent(i,j)&&w.grid[i].type!==w.grid[j].type)synergy++;
 const upgrades=w.grid.reduce((n,t)=>n+(t?.type==='bolt'||t?.type==='lens'?(t.level-1)*2:0),0),extra=Math.min(12,synergy*2+upgrades)+(w.scoutFor>0?4:0);k.enemyHp=Math.max(1,k.enemyHp-extra);if(w.scoutFor>0)w.scoutFor--;
 const floor=1+Math.floor(k.cleared/3);if(floor>w.floor){w.floor=floor;w.openCells=Math.min(16,8+(floor-1)*4);celebrate(room,'castle','The castle awakens!',`Floor ${floor} opens new building ground.`);}
}
export function keepAction(room,p,action,value){
 const w=room.expedition.keep,s=p.expedition.modeState,k=room.gameplay.keep,a=p.adventure;
 if(action==='front'){requireChoice(/^[0-2]$/.test(String(value)));s.front=+value;return `Defending the ${FRONTS[s.front]}.`;}
 if(action==='tower'){const [cell,type]=String(value).split(':');requireChoice(/^\d{1,2}$/.test(cell)&&+cell>=0&&+cell<w.openCells&&TYPES.includes(type),'Choose open building ground and a tower type.');const old=w.grid[+cell];requireChoice(!old||old.type===type&&old.level<3,'Upgrade the same tower or choose an empty square.');requireChoice(a.supplies>=(old?2:3),'Earn building supplies with correct answers first.');requireChoice(old||k.towers.bolt+k.towers.ward<8,'The shared tower limit is eight. Upgrade an existing tower.');spend(p);a.supplies-=old?2:3;w.grid[+cell]={type,level:(old?.level||0)+1,playerId:p.id};if(!old){k.towers[type==='ward'?'ward':'bolt']++;s.placed++;}contribute(p,'support');return `${old?'Upgraded':'Placed'} ${type} tower. Adjacent different towers combine their effects.`;}
 if(action==='ultimate'){const active=Object.values(room.players).filter(x=>!x.deleted).length;requireChoice(w.ultimate>=w.ultimateGoal&&(w.ultimateContributors.length>=Math.max(1,Math.ceil(active/2))||w.ultimate>=w.ultimateGoal*2),'Build the ultimate together through correct answers.');spend(p);const damage=Math.min(70,Math.max(0,k.enemyHp-1));k.enemyHp-=damage;k.crystal=Math.min(300,k.crystal+25);w.ultimate=0;w.ultimateContributors=[];w.ultimates++;contribute(p,'support');bonus(room,p,20);celebrate(room,'ultimate','Crystal nova!',`${damage} enemy damage · up to 25 crystal health restored.`);return 'The class ultimate bursts across the battlefield.';}
 if(action==='scout'){spend(p);s.scoutSteps++;if(s.scoutSteps%2===0){s.scouts++;w.scout=k.enemy==='swarm'?'Ward towers scatter the swarm.':k.enemy==='golem'?'Bolt towers crack the golem’s armor.':'Lens towers reveal the wyvern’s path.';w.scoutFor=4;contribute(p,'discoveries');contribute(p,'support');return `Scouting report: ${w.scout}`;}return 'Your scout reaches the outlook. One more scouting step uncovers the weakness.';}
 throw new Error('Choose a citadel defense action.');
}
export function keepView(room,p){const w=room.expedition.keep;return {...p.expedition.modeState,...w,ultimateContributors:undefined,contributors:w.ultimateContributors.length,frontName:FRONTS[w.front]};}
