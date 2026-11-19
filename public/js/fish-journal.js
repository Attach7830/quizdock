import {esc} from './ui.js';
import {FISH_SPECIES,FISH_RARITIES,fishRarity} from './fish-catalog.js';
import {fishMarkup} from './fish-art.js';
export const FISH_PAGE_SIZE=24;
const states=new Map();
export const fishArt=(id,size=80,options={})=>`<span class="journal-fish" style="width:${size}px;height:${Math.round(size*.65)}px">${fishMarkup(id,options)}</span>`;
export function journalPage(records={},state={}){
 const shiny=state.variant==='shiny',has=f=>shiny?records[f.id]?.shinyCount>0:records[f.id]?.count>0;
 const search=String(state.search||'').trim().toLocaleLowerCase(),water=state.water||'all',rarity=state.rarity||'all',owned=state.owned||'all';
 const matches=FISH_SPECIES.filter(f=>(water==='all'||f.water===water)&&(rarity==='all'||f.rarity===rarity)&&(owned==='all'||owned==='caught'&&has(f)||owned==='missing'&&!has(f))&&(!search||`${f.name} ${f.water} ${f.rarity}`.toLowerCase().includes(search))).sort((a,b)=>Number(has(b))-Number(has(a)));
 const pages=Math.max(1,Math.ceil(matches.length/FISH_PAGE_SIZE)),page=Math.max(0,Math.min(pages-1,Number(state.page)||0));
 return {items:matches.slice(page*FISH_PAGE_SIZE,(page+1)*FISH_PAGE_SIZE),total:matches.length,page,pages};
}
const options=(rows,value)=>rows.map(([id,name])=>`<option value="${id}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
function results(records,state){
 const {items,total,page,pages}=journalPage(records,state);
 return `<p class="fish-page-status" role="status">${total} species · Page ${page+1} of ${pages}</p><div class="exp-journal">${items.map(f=>{const raw=records[f.id],shiny=state.variant==='shiny',rec=shiny&&raw?{count:raw.shinyCount||0,best:raw.shinyBest||0}:raw,caught=rec?.count>0,tier=fishRarity(f.rarity);return `<article class="exp-fish-card ${caught?'':'undiscovered'}" data-fish-id="${f.id}" data-fish-rarity="${f.rarity}">${fishArt(f.id,80,{shiny})}<div><small class="fish-rarity" style="--rarity:${tier.color}">${tier.name} · ${f.water}</small><h4>${shiny?'✦ Shiny ':''}${esc(f.name)}</h4><p>${caught?esc(f.description):'Not caught yet'}</p><small>${caught?`${rec.count} caught · best ${Number(rec.best||0).toFixed(1)} kg`:'Keep exploring these waters.'}</small></div></article>`;}).join('')||'<p>No fish match these filters. Try another water or rarity.</p>'}</div><div class="fish-pagination"><button type="button" class="btn ghost small" data-fish-page="${page-1}" ${page===0?'disabled':''}>← Previous species</button><button type="button" class="btn ghost small" data-fish-page="${page+1}" ${page===pages-1?'disabled':''}>Next species →</button></div>`;
}
export function fishJournal(records={},scope='collection'){
 const state={water:'all',rarity:'all',owned:'all',search:'',page:0,variant:'normal',...states.get(scope)},caught=FISH_SPECIES.filter(f=>records[f.id]?.count>0).length;
 return `<section class="fish-journal" data-fish-journal="${esc(scope)}" data-fish-records="${esc(JSON.stringify(records))}" aria-label="Illustrated fish journal"><h3>${caught} / ${FISH_SPECIES.length} species discovered</h3><p class="form-note">Six rarity tiers. Mythics appear on about 1 in 20,000 casts across all waters. Each of the six Mythic species is rarer still. Habitats, moon tides and discovery help improve other catches; they never guarantee a Mythic. Each cast is independent. Shiny variants have an independent 1 in 8,192 chance; any species can be shiny, including Mythics.</p><div class="fish-journal-filters"><label>Appearance<select data-fish-filter="variant">${options([['normal','Standard fish'],['shiny','Prismatic shinies']],state.variant)}</select></label><label>Search species<input type="search" class="field" maxlength="100" data-fish-filter="search" value="${esc(state.search)}" placeholder="Fish name…"></label><label>Water<select data-fish-filter="water">${options([['all','All waters'],['reef','Coral reef'],['deep','Deep water'],['shallows','Moonlit shallows']],state.water)}</select></label><label>Rarity<select data-fish-filter="rarity">${options([['all','Every rarity'],...FISH_RARITIES.map(r=>[r.id,r.name])],state.rarity)}</select></label><label>Collection<select data-fish-filter="owned">${options([['all','All species'],['caught','Caught'],['missing','Still to discover']],state.owned)}</select></label></div><div data-fish-results>${results(records,state)}</div></section>`;
}
if(typeof document!=='undefined'){
 const refresh=(root,patch)=>{const key=root.dataset.fishJournal,state={...states.get(key),...patch};states.set(key,state);root.querySelector('[data-fish-results]').innerHTML=results(JSON.parse(root.dataset.fishRecords),state);};
 document.addEventListener('input',e=>{const input=e.target.closest('[data-fish-filter="search"]');if(input)refresh(input.closest('[data-fish-journal]'),{search:input.value,page:0});});
 document.addEventListener('change',e=>{const select=e.target.closest('select[data-fish-filter]');if(select)refresh(select.closest('[data-fish-journal]'),{[select.dataset.fishFilter]:select.value,page:0});});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-fish-page]');if(!b||b.disabled)return;const root=b.closest('[data-fish-journal]');refresh(root,{page:Number(b.dataset.fishPage)});root.querySelector('h3')?.scrollIntoView({block:'nearest'});root.querySelector('[data-fish-results] .exp-fish-card h4')?.setAttribute('tabindex','-1');root.querySelector('[data-fish-results] .exp-fish-card h4')?.focus({preventScroll:true});});
}
