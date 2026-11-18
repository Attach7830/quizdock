"""Expanded wardrobe, real quest unlocks and original art; isolated fake accounts only."""
from pathlib import Path
import json,os,shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def home(ctx):return ctx.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json()
def wardrobe(page):
 page.goto(BASE+'/?wardrobe=1');page.wait_for_selector('.wardrobe-studio');page.locator('#wardrobe-slot').select_option('all')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  sc=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':900},reduced_motion='reduce');sc.request.get(BASE+'/__test/login?role=student')
  tc=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':768},reduced_motion='reduce');tc.request.get(BASE+'/__test/login?role=teacher')
  s,t=sc.new_page(),tc.new_page();errors=[]
  for page in [s,t]:page.on('pageerror',lambda error:errors.append(str(error)));page.on('dialog',lambda dialog:dialog.accept())
  wardrobe(s)
  check(s.locator('[data-item-card]').count()==100,'the existing wardrobe offers one hundred accessories')
  s.locator('.journey-book summary').click();check(s.locator('[data-milestone]').count()==48 and s.locator('[data-journey-track]').count()==8,'quest book contains eight paths and forty-eight milestones')
  check('100,000' in s.locator('[data-milestone=correct-100000]').inner_text() and '10,000' in s.locator('[data-milestone=rescues-10000]').inner_text(),'long horizons show concrete goals and exclusive rewards')
  s.locator('#wardrobe-search').fill('duck');s.locator('#wardrobe-search').press('End');s.locator('#wardrobe-search').press('Backspace')
  check(s.locator('[data-item-card]').count()>1 and s.evaluate('document.activeElement.id==="wardrobe-search"') and s.locator('#wardrobe-search').input_value()=='duc','search updates cards without replacing the focused input')
  s.locator('#wardrobe-search').fill('no accessory has this name');check(s.locator('[data-item-card]').count()==0 and s.locator('[data-act=wardrobe-filters-reset]').is_visible(),'empty search has an accessible reset')
  s.locator('[data-act=wardrobe-filters-reset]').click();check(s.locator('[data-item-card]').count()==100 and s.locator('.journey-book').get_attribute('open') is not None,'reset restores all items and keeps the quest book open')
  s.locator('#wardrobe-availability').select_option('affordable');prices=s.evaluate('async()=>{const {AVATAR_ITEMS}=await import("/js/item-catalog.js");return [...document.querySelectorAll("[data-item-card]")].map(e=>AVATAR_ITEMS.find(i=>i.id===e.dataset.itemCard).price)}')
  check(len(prices)>=10 and all(price<=190 for price in prices),'within-reach filter includes only affordable shop items')
  s.locator('#wardrobe-availability').select_option('quests');check(s.locator('[data-item-card]').count()==16 and s.locator('[data-item-card] [data-act=item-buy]').count()==0,'sixteen quest rewards have no purchase shortcut')
  s.locator('[data-item-card=library-castle] [data-act=item-preview]').click();check('library-castle' in s.locator('.wardrobe-portrait .avatar').get_attribute('data-equipment') and home(sc)['user']['points']==190 and not home(sc)['user'].get('ownedItems'),'even distant quest rewards can be tried on without granting ownership')
  s.locator('[data-act=item-preview-reset]').click();s.locator('#wardrobe-availability').select_option('trophies');s.locator('#wardrobe-sort').select_option('expensive')
  check(s.locator('[data-item-card]').first.get_attribute('data-item-card')=='trillion-point-tophat','trophy filter sorts exact large prices without rounding')
  s.locator('[data-item-card=trillion-point-tophat] [data-act=item-goal]').click();s.wait_for_selector('[data-savings-goal=trillion-point-tophat]')
  check('1,000,000,000,000' in s.locator('[data-savings-goal]').inner_text() and home(sc)['user']['points']==190,'saved savings goal shows the exact trillion-point target without spending points')
  wardrobe(s);check(s.locator('[data-savings-goal]').get_attribute('data-savings-goal')=='trillion-point-tophat','savings target survives a full reload')
  s.locator('[data-savings-goal] [data-act=item-goal]').click();s.wait_for_function('!document.querySelector("[data-savings-goal]")');check(not home(sc)['user'].get('wardrobeGoal'),'clearing a goal is saved')
  for item in ['tin-foil-hat','googly-eyes']:
   s.locator('[data-item-card='+item+'] [data-act=item-buy]').click();s.wait_for_function('(id)=>document.querySelector(`[data-item-card="${id}"] [data-act=item-equip]`)?.disabled',arg=item)
  check(home(sc)['user']['points']==165 and set(home(sc)['user']['equipment'].values())=={'tin-foil-hat','googly-eyes'},'new inexpensive accessories charge their server prices and combine across slots')
  s.locator('#wardrobe-availability').select_option('owned');check(s.locator('[data-item-card]').count()==2,'owned filter reflects persisted purchases')
  s.locator('#wardrobe-availability').select_option('all');s.locator('.journey-book summary').click()
  for width in [320,390,768,1366]:
   s.set_viewport_size({'width':width,'height':844});check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'expanded shop and full quest book fit '+str(width)+'px');check(s.evaluate('document.documentElement.scrollHeight>innerHeight'),'wardrobe retains normal vertical scrolling at '+str(width)+'px')
  s.set_viewport_size({'width':390,'height':844});s.locator('[data-journey]').scroll_into_view_if_needed();s.screenshot(path=str(ROOT/'checks/journey-horizons-phone.png'))
  s.set_viewport_size({'width':1366,'height':900});s.locator('#wardrobe-search').fill('volcano');s.locator('[data-item-card=portable-volcano] [data-act=item-preview]').click();s.screenshot(path=str(ROOT/'checks/journey-wardrobe-desktop.png'))
  # Seed only historical fake progress; earn the threshold-crossing answer in an actual round.
  check(sc.request.post(BASE+'/__test/journey-progress',data={}).ok,'historical progress fixture loads locally')
  fix=tc.request.get(BASE+'/__test/fixture').json();t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form select[name=mode]').select_option('word');t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  s.goto(BASE+'/play.html?join='+pin);s.wait_for_selector('.game-shell');t.locator('[data-act=start]').click();s.wait_for_selector('#live-word-answer');q=s.locator('.phase-heading').inner_text();answer={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(q,'una biblioteca');s.locator('#live-word-answer').fill(answer);s.locator('#live-word-answer').press('Enter');s.wait_for_selector('[data-player-view=result]')
  check({'tin-foil-hat','googly-eyes'}.issubset(set(s.locator('.game-scene').get_attribute('data-equipment').split(','))),'new accessories reach the live canvas renderer')
  t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');wardrobe(s)
  s.wait_for_function('async()=>{const r=await fetch("/api/academy/home",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});return (await r.json()).user.ownedItems.includes("origami-dragon")}')
  user=home(sc)['user'];check(user['journey']['stats']['correct']==500 and user['journey']['stats']['rounds']==50,'finished server round advances historical account goals exactly once')
  check({'origami-dragon','bookshelf-wings'}.issubset(set(user['ownedItems'])) and user['points']==182,'crossing two milestones grants accessories without altering normal round point earnings')
  wardrobe(s);s.locator('[data-item-card=origami-dragon] [data-act=item-equip]').click();s.wait_for_function('document.querySelector("[data-item-card=origami-dragon] [data-act=item-equip]")?.disabled');check(home(sc)['user']['points']==182 and home(sc)['user']['equipment']['hat']=='origami-dragon','quest reward is wearable for free after it is earned')
  s.locator('.journey-book summary').click();check(s.locator('[data-milestone=correct-500]').get_attribute('class').endswith('earned') and 'In your wardrobe' in s.locator('[data-milestone=correct-500]').inner_text(),'earned quest has a visible completion badge and saved reward')
  s.goto(BASE+'/?view=expeditions');s.wait_for_selector('[data-journey]');s.locator('.journey-book summary').click();check('500' in s.locator('[data-journey-track=correct]').inner_text(),'the class island and wardrobe show the same account-wide quest progress');check(s.locator('.exp-home-link').count()==1,'class collections still link to the wardrobe')
  # Render the actual shared geometry, validate every path and inspect every prop's bounds.
  art=sc.new_page();art.goto(BASE+'/?wardrobe=1');art.wait_for_selector('.wardrobe-studio')
  audit=art.evaluate('''async()=>{
   const {AVATAR_ITEMS}=await import('/js/item-catalog.js'),{skinById}=await import('/js/catalog.js'),{characterMarkup,characterParts}=await import('/js/characters.js'),{extraItemParts}=await import('/js/extra-item-art.js');
   const bad=[],bounds=[],canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   document.body.innerHTML='<main id="art-sheet"></main>';document.head.insertAdjacentHTML('beforeend','<style>body{margin:0;background:#142137}#art-sheet{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));padding:12px;gap:8px}.art-tile{background:#23334a;border:1px solid #7082a9;border-radius:9px;text-align:center;padding:5px;min-width:0}.art-tile svg{width:100%;height:115px}.art-tile small{display:block;color:#d8e6ff;font:10px system-ui;min-height:30px}</style>');
   for(const item of AVATAR_ITEMS){
    const skin=skinById('mint',{[item.slot]:item.id});for(const part of characterParts(skin)){try{const p=new Path2D(part.d);ctx.fill(p);}catch(error){bad.push({id:item.id,error:String(error),d:part.d});}}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.innerHTML=extraItemParts(item.id).map(p=>`<path d="${p.d}"/>`).join('');document.body.append(svg);const b=svg.getBBox();if(b.width&&(b.x<-65||b.x+b.width>65||b.y<-83||b.y+b.height>55))bounds.push({id:item.id,x:b.x,y:b.y,width:b.width,height:b.height});svg.remove();
    document.querySelector('#art-sheet').insertAdjacentHTML('beforeend',`<article class="art-tile">${characterMarkup(skin)}<small>${item.name}</small></article>`);
   }return {bad,bounds,count:AVATAR_ITEMS.length};
  }''')
  check(not audit['bad'],'all one hundred accessories have valid paths in the actual canvas API: '+str(audit['bad'])[:500])
  check(not audit['bounds'],'all new props fit the shared avatar viewport: '+str(audit['bounds'])[:500])
  art.set_viewport_size({'width':1600,'height':1800});art.screenshot(path=str(ROOT/'checks/journey-accessory-contact-sheet.png'),full_page=True)
  check(not errors,'expanded wardrobe, quests and actual live game have no uncaught browser errors');browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(item['passed'] for item in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/journey-results.json').write_text(json.dumps(RESULTS,indent=2))
