"""Local Chromium checks; Google is a test RSA issuer, never a real Google account."""
from pathlib import Path
import json,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE='https://localhost:9443'
RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
FAKE_GOOGLE='''window.google={accounts:{id:{initialize(config){window.__googleConfig=config},renderButton(container){const b=document.createElement('button');b.textContent='Sign in with Google';b.type='button';b.onclick=async()=>{const r=await fetch('/__test/google-credential',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nonce:window.__googleConfig.nonce,email:window.__googleEmail||'casey@example.com'})});window.__googleConfig.callback(await r.json())};container.append(b)}}}};'''
AUDIO_OBSERVER='''const Native=window.AudioContext;window.__chipNotes=0;window.AudioContext=class extends Native{createOscillator(){window.__chipNotes++;return super.createOscillator()}};'''
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  teacher=browser.new_context(ignore_https_errors=True,viewport={'width':1280,'height':900});teacher.add_init_script(AUDIO_OBSERVER)
  teacher.request.get(BASE+'/__test/login?role=teacher');t=teacher.new_page();errors=[];t.on('pageerror',lambda e:errors.append(str(e)));t.on('dialog',lambda d:d.accept())
  fix=teacher.request.get(BASE+'/__test/fixture').json();t.goto(BASE+'/');t.locator('[role=tab][data-act=tab][data-tab=classes]').click();t.locator('[data-act=roster]').first.click()
  invite=t.locator('input[aria-label="Class join link"]').input_value();check(invite==BASE+'/?class='+fix['classCode'],'teacher receives usable class join link')
  student=browser.new_context(ignore_https_errors=True,viewport={'width':360,'height':640});student.add_init_script(AUDIO_OBSERVER)
  student.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(content_type='application/javascript',body=FAKE_GOOGLE))
  s=student.new_page();s.on('pageerror',lambda e:errors.append(str(e)));s.goto(invite);s.get_by_role('button',name='Sign in with Google',exact=True).wait_for()
  check(s.locator('input[name=name],input[name=email]').count()==0,'Google student invitation requests no typed name or email')
  s.get_by_role('button',name='Sign in with Google',exact=True).click();s.wait_for_selector('[data-act=tab]')
  check('Welcome back, Casey' in s.locator('body').inner_text(),'Google account profile supplies student name')
  home=student.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json();check(len(home['classes'])==1,'new student self-enrolls from link without roster entry')
  s.goto(invite);s.locator('[data-act=accept-invite]').click();s.wait_for_selector('[data-act=tab]');check(len(student.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json()['classes'])==1,'existing student invitation is idempotent')
  s.locator('[role=tab][data-act=tab][data-tab=classes]').click();s.locator('[data-act=join-class]').click();check(s.locator('#join-class-form input[name=name]').count()==0,'join another class uses saved Google identity')
  s.keyboard.press('Escape');s.locator('[role=tab][data-act=tab][data-tab=practice]').click();s.locator('[data-act=solo]').first.click();s.wait_for_selector('.flashcard')
  prompts=[]
  for i in range(4):
   prompts.append(s.locator('.flashcard span').inner_text());s.locator('[data-act=solo-mark][data-mark=known]').click();s.wait_for_function('document.querySelector("#solo-save").textContent==="Progress saved"')
  check(len(set(prompts))==4,'solo shuffled pass covers every card exactly once')
  check(s.locator('.flashcard span').inner_text()!=prompts[-1],'next shuffled pass avoids immediate repeat')
  check('4 known' in s.locator('body').inner_text(),'confidence marks stay attached to original card IDs')
  check(student.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json()['user']['points']==0,'shuffled solo study awards no currency')
  # Host and join with real local WebSockets, including browser audio lifecycle.
  t.keyboard.press('Escape');t.locator('[data-act=host]').first.click();t.wait_for_selector('#host-form');t.wait_for_timeout(150)
  check(t.evaluate('window.__chipNotes>0'),'host action starts original chip music after gesture')
  t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('[data-act=start]')
  pin=t.locator('.host-pin').inner_text();s.goto(BASE+'/play.html?join='+pin);s.wait_for_selector('.game-shell')
  s.locator('[data-music=toggle]').click();s.wait_for_timeout(150)
  # Autoplay may already be permitted; toggle once more if the click muted it.
  if s.locator('[data-music=toggle]').inner_text()=='Music off':s.locator('[data-music=toggle]').click()
  s.wait_for_timeout(150);check(s.evaluate('window.__chipNotes>0'),'joined student can start chip music')
  s.locator('[data-music=toggle]').click();before=s.evaluate('window.__chipNotes');s.wait_for_timeout(280);check(s.evaluate('window.__chipNotes')==before,'music mute stops note scheduling')
  s.reload();s.wait_for_selector('.game-shell');check(s.locator('[data-music=toggle]').inner_text()=='Music off','music mute preference survives reload')
  s.locator('[data-music=toggle]').click();t.locator('[data-act=start]').click();s.wait_for_selector('.answer')
  t.locator('[data-act=pause]').click();s.wait_for_function('document.querySelector(".round-lobby h2")?.textContent.includes("paused")');s.wait_for_timeout(150);before=s.evaluate('window.__chipNotes');s.wait_for_timeout(250);check(s.evaluate('window.__chipNotes')==before,'teacher pause stops student music')
  t.locator('[data-act=resume]').click();s.wait_for_selector('.answer');s.wait_for_timeout(180);check(s.evaluate('window.__chipNotes')>before,'teacher resume restarts one music scheduler')
  # All event drawings differ in shape and move; reduced-motion stills are stable.
  visual=s.evaluate('''async()=>{const {drawArcadeEvent}=await import('/js/event-effects.js');const {ARCADE_EVENTS}=await import('/js/event-catalog.js');const canvas=document.createElement('canvas');canvas.width=500;canvas.height=200;const ctx=canvas.getContext('2d');const render=(kind,p,moving)=>{ctx.clearRect(0,0,500,200);drawArcadeEvent(ctx,kind,500,p,moving);return canvas.toDataURL()};return Object.values(ARCADE_EVENTS).flat().map(e=>({kind:e.kind,first:render(e.kind,.15,true),second:render(e.kind,.6,true),still:render(e.kind,.2,false),stillAgain:render(e.kind,.9,false)}))}''')
  check(len({e['still'] for e in visual})==18,'all 18 event effects have distinctive vector art')
  for e in visual:
   check(e['first']!=e['second'],e['kind']+' has changing animation frames');check(e['still']==e['stillAgain'],e['kind']+' respects reduced motion')
  # Exercise authoritative random events for every mode and round transition.
  answers={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}
  for mode in ['treasure','fishing','battle','factory','rally','keep']:
   if mode!='treasure':
    t.locator('[data-act=end]').click()
    t.wait_for_selector('[data-act=start]');t.locator('#round-mode').select_option(mode);t.locator('[data-act=start]').click()
   if mode in ['rally','keep']:s.locator('[data-act=role]').first.click()
   s.wait_for_selector('.answer:not([disabled])')
   for i in range(4):
    prompt=s.locator('.game-question h2').inner_text();answer=answers.get(prompt,'una biblioteca');s.wait_for_timeout(470);s.locator('.answer span').get_by_text(answer,exact=True).click()
    if mode=='treasure':s.locator('[data-act=chest]').first.click()
    s.wait_for_selector('[data-act=next]')
    if i<3:s.locator('[data-act=next]').click();s.wait_for_selector('.answer:not([disabled])')
   check(bool(s.locator('.event-flash').get_attribute('data-event-id')),mode+' receives a server-selected event flash')
   check(bool(s.locator('.game-scene').get_attribute('data-event-id')),mode+' event reaches scene animation')
   check(bool(t.locator('.event-flash').get_attribute('data-event-id')),mode+' event flash also reaches the host')
   check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),mode+' event and music controls fit phone width')
   s.screenshot(path=str(ROOT/f'checks/{mode}-result-phone.png'),full_page=True)
   s.emulate_media(reduced_motion='reduce');s.locator('[data-act=next]').click();s.wait_for_selector('.answer:not([disabled])');s.wait_for_timeout(2500)
   s.evaluate('document.dispatchEvent(new Event("visibilitychange"))');s.wait_for_timeout(180);before=s.locator('canvas').evaluate('(c)=>c.toDataURL()');s.evaluate('document.dispatchEvent(new Event("visibilitychange"))');s.wait_for_timeout(180);after=s.locator('canvas').evaluate('(c)=>c.toDataURL()')
   check(before==after,mode+' sync does not replay a completed event')
  s.screenshot(path=str(ROOT/'checks/arcade-events-phone.png'),full_page=True)
  # The logged-out game join screen also has no nickname/name form.
  fresh=browser.new_context(ignore_https_errors=True,viewport={'width':320,'height':568});j=fresh.new_page();j.goto(BASE+'/play.html');j.wait_for_selector('#join-form')
  check(j.locator('input[name=name]').count()==0 and 'Google' in j.locator('#join-form').inner_text(),'game join uses Google rather than a typed nickname')
  fresh.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(content_type='application/javascript',body=FAKE_GOOGLE));j.evaluate('window.__googleEmail="riley@example.com"');j.locator('#join-form input[name=pin]').fill(pin);j.locator('#join-form input[name=classCode]').fill(fix['classCode']);j.locator('#join-form button').click();j.get_by_role('button',name='Sign in with Google',exact=True).click();j.wait_for_selector('.game-shell');j.locator('[data-act=game-menu]').click();check('Casey Google' in j.locator('#dialog').inner_text(),'Google-only game join enrolls and uses the provider name')
  check(not errors,'new flows have no browser JavaScript errors')
  browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/arcade-browser-results.json').write_text(json.dumps(RESULTS,indent=2))
