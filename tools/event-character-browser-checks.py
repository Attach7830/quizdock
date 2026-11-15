"""Event lifetimes, original character purchases, and mobile/fullscreen layout.
All accounts, balances, questions and rooms come from the isolated fake-data harness.
"""
from pathlib import Path
import json,os,re,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE='https://localhost:9443'
RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def account(browser,role,width=390,height=844):
 ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':height},reduced_motion='reduce')
 ctx.request.get(BASE+'/__test/login?role='+role)
 return ctx
def short_question(s):
 expected={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}
 for _ in range(4):
  prompt=s.locator('.phase-heading').inner_text()
  if prompt=='How do you say “to learn”?':break
  wrong=next(text for text in s.locator('.answer span').all_inner_texts() if text!=expected.get(prompt,'una biblioteca'))
  s.wait_for_timeout(470);s.locator('.answer span').get_by_text(wrong,exact=True).click();s.wait_for_selector('[data-act=next]');s.locator('[data-act=next]').click();s.wait_for_selector('.answer:not([disabled])')
 check(s.locator('.phase-heading').inner_text()=='How do you say “to learn”?','short mobile layout fixture is reached through shuffled questions')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=account(browser,'teacher',1440,900);sc=account(browser,'student');t=tc.new_page();s=sc.new_page();errors=[]
  for page in [s,t]:page.on('pageerror',lambda e:errors.append(str(e)))
  t.on('dialog',lambda d:d.accept())
  fix=tc.request.get(BASE+'/__test/fixture').json()
  s.goto(BASE+'/');s.locator('[role=tab][data-act=tab][data-tab=wardrobe]').click()
  check(s.locator('.skin-card').count()==13,'all eight existing characters and five new characters appear in the shop')
  check(s.locator('[data-skin-card=coral] button').inner_text()=='Equipped','existing equipped purchase survives the catalog expansion')
  check(s.locator('[data-skin-card=nebula] button').is_disabled(),'unaffordable new character cannot be purchased in the UI')
  s.set_viewport_size({'width':1280,'height':900});s.screenshot(path=str(ROOT/'checks/original-character-shop.png'),full_page=True)
  s.locator('[data-skin-card=stormwing] button').click();s.wait_for_function('document.querySelector("[data-skin-card=stormwing] button").textContent==="Equipped"')
  profile=sc.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json()['user']
  check(profile['points']==10 and profile['skin']=='stormwing' and set(profile['owned'])=={'mint','coral','stormwing'},'new character uses the real wallet once and preserves existing ownership')
  s.reload();s.locator('[role=tab][data-act=tab][data-tab=wardrobe]').click();check(s.locator('[data-skin-card=stormwing] button').inner_text()=='Equipped','new purchase and equipped art survive a page reload')
  s.set_viewport_size({'width':390,'height':844});s.screenshot(path=str(ROOT/'checks/character-shop-phone.png'),full_page=True)
  check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'expanded shop has no horizontal phone overflow')
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  s.goto(BASE+'/play.html?join='+pin);s.wait_for_selector('.game-shell');t.locator('[data-act=start]').click();s.wait_for_selector('.answer')
  short_question(s)
  def dimensions():
   return s.evaluate('''()=>{const a=document.querySelector('.answer-tiles'),r=a.getBoundingClientRect(),h=visualViewport.height;return{top:r.top+scrollY,height:r.height,h,tiles:[...a.children].map(b=>({h:b.clientHeight,scroll:b.scrollHeight,w:b.clientWidth})),overflow:document.documentElement.scrollWidth>innerWidth+1}}''')
  for w,h in [(390,844),(320,568),(844,390),(667,375),(600,320),(360,460),(768,1024)]:
   s.set_viewport_size({'width':w,'height':h});s.evaluate('scrollTo(0,0)');s.wait_for_timeout(80);d=dimensions();s.screenshot(path=str(ROOT/f'checks/mobile-answers-{w}x{h}.png'))
   check(d['height']>=d['h']*2/3-1 and d['height']<=d['h']*2/3+2,f'four answers fill two thirds of the viewport at {w}x{h}')
   check(abs(d['top']-d['h']/3)<3,f'short question places the answer block in the lower two thirds at {w}x{h}: {d}')
   check(not d['overflow'] and all(b['h']>=70 and b['scroll']<=b['h']+2 for b in d['tiles']),f'large uncut mobile answer targets at {w}x{h}')
  touch=sc.new_cdp_session(s);touch.send('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':1})
  s.set_viewport_size({'width':1024,'height':400});s.wait_for_timeout(100);d=dimensions()
  check(s.evaluate("matchMedia('(pointer:coarse)').matches") and abs(d['top']-d['h']/3)<3 and abs(d['height']-d['h']*2/3)<3,'wide touch-device landscape still reserves the lower two thirds for answers')
  touch.send('Emulation.setTouchEmulationEnabled',{'enabled':False});touch.detach()
  s.set_viewport_size({'width':320,'height':568});wide_font=s.add_style_tag(content='body,button{font-family:monospace!important}')
  s.evaluate("document.fonts.dispatchEvent(new Event('loadingdone'))");s.wait_for_timeout(80);d=dimensions();s.screenshot(path=str(ROOT/'checks/wide-font-answers.png'))
  check(abs(d['top']-d['h']/3)<3 and not d['overflow'],f'narrow question header fits wider fallback fonts and resizes after fonts load: {d}')
  s.locator('[data-act=fullscreen]').click();s.wait_for_function('!!document.fullscreenElement');s.wait_for_timeout(100);d=dimensions()
  check(abs(d['top']-d['h']/3)<3,'320-pixel fullscreen header still fits its longer Exit fullscreen label')
  s.locator('[data-act=fullscreen]').click();s.wait_for_function('!document.fullscreenElement');wide_font.evaluate('(el)=>el.remove()')
  s.set_viewport_size({'width':320,'height':568})
  s.evaluate("window.answerTexts=[...document.querySelectorAll('.answer span')].map(e=>e.textContent);document.querySelectorAll('.answer span').forEach(e=>e.textContent='A longer answer with accented vocabulary and a detailed explanation. '.repeat(5).slice(0,300));dispatchEvent(new Event('resize'))")
  s.wait_for_timeout(80);d=dimensions()
  check(d['height']>d['h']*2/3+100 and all(b['scroll']<=b['h']+2 for b in d['tiles']),'long answer text expands the grid without being clipped inside a fixed-height tile')
  s.locator('.answer').last.scroll_into_view_if_needed();check(s.evaluate('scrollY')>0,'the last long answer remains reachable with natural document scrolling')
  s.evaluate("document.querySelectorAll('.answer span').forEach((e,i)=>e.textContent=answerTexts[i]);scrollTo(0,0);dispatchEvent(new Event('resize'))")
  s.set_viewport_size({'width':390,'height':844});s.wait_for_timeout(80);s.screenshot(path=str(ROOT/'checks/mobile-lower-two-thirds.png'))
  s.locator('[data-act=fullscreen]').click();s.wait_for_function('!!document.fullscreenElement');s.wait_for_timeout(120);d=dimensions()
  check(abs(d['top']-d['h']/3)<3 and abs(d['height']-d['h']*2/3)<3,'native Chromium fullscreen recalculates the lower two-thirds answer layout')
  check(s.locator('[data-act=fullscreen]').get_attribute('aria-pressed')=='true','fullscreen control reflects the active native fullscreen state')
  s.screenshot(path=str(ROOT/'checks/mobile-fullscreen-answers.png'));s.locator('[data-act=fullscreen]').click();s.wait_for_function('!document.fullscreenElement')
  s.wait_for_timeout(450);s.locator('.answer span').get_by_text({'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(s.locator('.phase-heading').inner_text(),'una biblioteca'),exact=True).click();s.wait_for_selector('[data-player-view=result]')
  check(s.locator('.game-scene').get_attribute('data-character')=='stormwing','purchased character is used in the live game scene')
  check(s.locator('.result-scene-slot canvas').bounding_box()['height']>=280,'mobile game animation receives a substantially larger canvas')
  s.locator('[data-act=chest]').first.click();s.wait_for_selector('[data-act=next]');s.screenshot(path=str(ROOT/'checks/stormwing-game-reward.png'),full_page=True)
  # Exercise the actual flash controller on the game result page, with an isolated lifetime.
  s.evaluate('''async()=>{const {createEventFlash}=await import('/js/event-flash.js');window.flash=createEventFlash({duration:650});window.snapshot={pin:'123456',roundNumber:1,startedAt:1,mode:'battle',status:'playing',me:{lastEvent:{id:'old',kind:'aegis-bloom',health:25}}};flash.update(snapshot);window.showEvent=(id,extra={})=>{snapshot.me.lastEvent={id,kind:'aegis-bloom',health:25,...extra};flash.update(snapshot);};}''')
  flash=s.locator('.event-flash').last
  check(not flash.is_visible(),'initial/reconnected snapshot does not replay an old event')
  s.locator('[data-act=next]').focus();s.evaluate("showEvent('fresh')")
  check(flash.is_visible() and flash.locator('em').inner_text()=='Aegis bloom!' and flash.locator('p').inner_text()=='25 health restored','new event appears as an italic full-screen impact with actual reward')
  check(s.evaluate('document.activeElement.dataset.act')=='next','announcement preserves the existing keyboard focus')
  check(flash.locator('em').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=39,'event headline is large on a phone')
  check(flash.get_attribute('data-motion')=='off','reduced-motion preference removes the impact animation')
  s.screenshot(path=str(ROOT/'checks/aegis-bloom-event-phone.png'))
  s.wait_for_timeout(400);s.evaluate('flash.update(snapshot)');s.wait_for_timeout(300)
  check(not flash.is_visible(),'same-event synchronization cannot extend or restart the flash timer')
  s.evaluate('flash.update(snapshot)');check(not flash.is_visible(),'expired events remain dismissed on subsequent snapshots')
  s.evaluate("showEvent('capped',{health:4})");check(flash.locator('p').inner_text()=='4 health restored','capped health reward is announced truthfully')
  flash.locator('button').click();s.evaluate('flash.update(snapshot)');check(not flash.is_visible(),'explicit dismiss stays dismissed across score updates')
  s.evaluate("showEvent('escape')");s.keyboard.press('Escape');check(not flash.is_visible(),'Escape dismisses an event without leaving the game')
  s.emulate_media(reduced_motion='no-preference');s.wait_for_timeout(1250);s.evaluate("showEvent('moving')");check(flash.get_attribute('data-motion')=='on','normal motion preference enables the cinematic impact')
  s.evaluate("showEvent('rapid')");check(flash.get_attribute('data-motion')=='off','rapid host-style event arrivals cannot repeatedly animate screen impacts')
  s.evaluate("snapshot.status='paused';flash.update(snapshot)");check(not flash.is_visible(),'pause cancels an active announcement')
  s.evaluate("snapshot.status='playing';flash.update(snapshot)");check(not flash.is_visible(),'resume does not replay an event already seen')
  s.evaluate("showEvent('new-round');snapshot.roundNumber++;flash.update(snapshot)");check(not flash.is_visible(),'round transitions cancel stale announcements')
  s.evaluate("showEvent('question');flash.update(snapshot,{phase:'question'})");check(not flash.is_visible(),'a question phase clears an event so all answer choices remain available')
  s.evaluate("showEvent('background');Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
  check(not flash.is_visible(),'backgrounding the page immediately cancels a flash')
  s.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));flash.update(snapshot)");check(not flash.is_visible(),'foregrounding the page never replays a cancelled event')
  s.evaluate("snapshot.me.lastEvent=null;flash.update(snapshot)");check(flash.locator('*').count()==0 and flash.get_attribute('data-event-id') is None,'event purges clear retained announcement content')
  s.evaluate("snapshot.lastArcadeEvent={id:'host',kind:'repair-drone',health:3,amount:10,playerName:'<img src=x onerror=alert(1)>'};flash.update(snapshot,{host:true})")
  check(flash.is_visible() and flash.locator('img').count()==0 and '<img' in flash.locator('.event-flash-kicker').text_content(),'host actor text is escaped while the combined reward stays visible')
  check(flash.locator('p').inner_text()=='3 health restored · 10 bonus points','combined health and score awards appear in the same flash')
  s.evaluate('flash.dispose()');check(s.locator('.event-flash').count()==1,'controller disposal removes its announcement and listeners')
  # Draw each enlarged scene and every event through the real renderer in portrait.
  scene_data=s.evaluate('''async()=>{const {createScene}=await import('/js/scenes.js');const {ARCADE_EVENTS}=await import('/js/event-catalog.js');const out=[];const slot=document.querySelector('#scene-slot');for(const [mode,events] of Object.entries(ARCADE_EVENTS)){const scene=createScene();scene.mount(slot);const state={pin:'123456',roundNumber:1,startedAt:1,mode,status:'playing',settings:{target:1000},me:{id:'s',skin:'stormwing',roleType:mode==='rally'?'ace':'guardian',score:0,cash:0,coins:0,hp:75,answered:0,correct:0},players:[]};scene.update(state);const initial=scene.el.querySelector('canvas').toDataURL();for(const [i,event] of events.entries()){state.me.answered++;state.me.score+=25;state.me.lastEvent={id:mode+i,kind:event.kind,amount:25,health:4};state.me.feedback={correct:true,effect:{weight:4}};scene.update(structuredClone(state));out.push({mode,kind:event.kind,shown:scene.el.dataset.eventId===mode+i,changed:scene.el.querySelector('canvas').toDataURL()!==initial});}scene.dispose();}return out;}''')
  for d in scene_data:check(d['shown'] and d['changed'],'enlarged portrait canvas renders the distinctive event: '+d['kind'])
  s.set_viewport_size({'width':320,'height':568});s.add_style_tag(content='body,button{font-family:monospace!important}')
  for role in ['sprinter','navigator','ace']:
   t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');t.locator('#round-mode').select_option('rally');t.locator('[data-act=start]').click();s.wait_for_selector('[data-act=role]');s.locator(f'[data-act=role][data-role={role}]').click();s.wait_for_selector('.answer');short_question(s);s.wait_for_timeout(80);d=dimensions()
   check(s.locator('.selected-plane').is_visible() and abs(d['top']-d['h']/3)<3,'narrow Rally question preserves its selected plane and lower answer region: '+role+': '+str(d))
  check(not errors,'event, shop, fullscreen and enhanced scene flows have no browser JavaScript errors')
  browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/event-character-results.json').write_text(json.dumps(RESULTS,indent=2))
