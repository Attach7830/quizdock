import {LEAGUE_MIN_FIELD,LEAGUE_SMALL_GOAL,LEAGUE_TIERS} from '../public/js/league-catalog.js';

// Competition ranks: equal XP shares the same rank. A tie across the lower
// boundary stays above demotion; promotion ties advance together.
export function leagueStandings(players,enabled=true){
  const sorted=players.filter(p=>Number.isSafeInteger(p.xp)&&p.xp>0).sort((a,b)=>b.xp-a.xp||a.userId.localeCompare(b.userId));
  const size=sorted.length,small=size<LEAGUE_MIN_FIELD,up=Math.max(1,Math.ceil(size*.2)),down=Math.max(1,Math.floor(size*.2));
  let rank=0;
  return sorted.map((p,i)=>{
    if(!i||p.xp!==sorted[i-1].xp)rank=i+1;
    const movement=!enabled?0:small?(p.xp>=LEAGUE_SMALL_GOAL?1:0):rank<=up?1:rank>size-down?-1:0;
    return {...p,rank,movement,zone:!enabled?'paused':movement>0?(p.tier===LEAGUE_TIERS.length-1?'summit':'promotion'):movement<0?(p.tier===0?'safe':'demotion'):'safe'};
  });
}
