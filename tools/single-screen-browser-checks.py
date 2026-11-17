"""Every student live phase fits the viewport; test accounts and drawings are fake."""
from pathlib import Path
import json,os,re,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def account(browser,role):
 c=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844},reduced_motion='reduce');c.request.get(BASE+'/__test/login?role='+role);return c
def dismiss(page):
 for b in page.locator('.event-flash-dismiss:visible').all():b.click()
def fit(page,name):
 page.wait_for_timeout(50)
 d=page.evaluate('''()=>{const h=visualViewport.height,w=innerWidth,area=document.querySelector('.game-question');const buttons=[...document.querySelectorAll('.phase-shell button,.phase-shell input,.phase-shell select')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]'));return {w,h,dh:document.documentElement.scrollHeight,dw:document.documentElement.scrollWidth,area:area?{h:area.clientHeight,s:area.scrollHeight}:null,textOverflow:buttons.filter(e=>e.matches('.role-card,.gameplay-choice,.route-chest')&&e.scrollHeight>e.clientHeight+2).map(e=>e.textContent),scene:document.querySelector('.result-scene-slot canvas')?.getBoundingClientRect().height??null,off:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.top<-.5||r.left<-.5||r.bottom>h+1||r.right>w+1}).map(e=>({text:e.textContent.slice(0,60),r:e.getBoundingClientRect().toJSON()}))}}''')
 if d['off'] or d['area'] and d['area']['s']>d['area']['h']+2:
  page.screenshot(path=str(ROOT/'checks/screen-fit-failure.png'));(ROOT/'checks/screen-fit-failure.json').write_text(json.dumps(page.evaluate('''()=>[...document.querySelectorAll('.result-screen,.result-screen>*,.adventure-panel>*,.gameplay-choice,.word-screen,.word-screen>*,.word-prompt>*,.word-entry>*,#live-word-form>*,.sketch-board,.sketch-board>*')].map(e=>({class:e.className,text:e.textContent.slice(0,120),h:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top,display:getComputedStyle(e).display,flex:getComputedStyle(e).flex,min:getComputedStyle(e).minHeight}))'''),indent=2))
 check(d['dh']<=d['h']+1 and d['dw']<=d['w']+1 and not d['off'] and not d['textOverflow'] and (d['scene'] is None or d['scene']>=39) and (not d['area'] or d['area']['s']<=d['area']['h']+2),name+': '+json.dumps(d))
SIZES=[(320,568),(320,460),(390,844),(600,320),(667,375),(844,390),(768,1024),(1366,768)]
def matrix(page,label):
 page.bring_to_front()
 for w,h in SIZES:
  page.set_viewport_size({'width':w,'height':h});fit(page,f'{label} fits {w}x{h}')
  if (w,h) in [(320,568),(600,320),(1366,768)]:page.screenshot(path=str(ROOT/f'checks/fit-{label}-{w}x{h}.png'))
def answer(page,correct=True):
 text=page.locator('.phase-heading').first.inner_text();expected={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(text,'una biblioteca');page.wait_for_timeout(500)
 if page.locator('#live-word-answer').count():page.locator('#live-word-answer').fill(expected if correct else 'wrong');page.locator('#live-word-answer').press('Enter')
 else:
  choices=page.locator('.answer span').all_inner_texts();choice=expected if correct else next(c for c in choices if c!=expected);page.locator('.answer').filter(has=page.get_by_text(choice,exact=True)).click()
 page.wait_for_selector('[data-player-view=result]');dismiss(page)
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=account(browser,'teacher');sc=account(browser,'student');oc=account(browser,'other');t=tc.new_page();s=sc.new_page();o=oc.new_page();errors=[]
  for page in [t,s,o]:page.on('pageerror',lambda e:errors.append(str(e)))
  t.on('dialog',lambda d:d.accept());fix=tc.request.get(BASE+'/__test/fixture').json();t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  for page in [s,o]:page.goto(BASE+'/play.html?join='+pin);page.wait_for_selector('.game-shell')
  matrix(s,'lobby')
  for mode in os.environ.get('QUIZDOCK_TEST_MODES','treasure,fishing,battle,factory,rally,keep,word').split(','):
   t.locator('#round-mode').select_option(mode);t.locator('[data-act=start]').click();s.wait_for_selector('[data-player-view=roles],[data-player-view=question]')
   if mode in ['rally','keep']:
    matrix(s,mode+'-roles')
    for page in [s,o]:page.locator('[data-act=role]').first.click()
   s.wait_for_selector('[data-player-view=question]');matrix(s,mode+'-question');answer(s,False);matrix(s,mode+'-wrong');s.locator('[data-act=next]').click();s.wait_for_selector('[data-player-view=question]');answer(s)
   matrix(s,mode+'-reward')
   if mode=='treasure':s.locator('[data-act=chest]').first.click();s.wait_for_selector('[data-act=next]');dismiss(s);matrix(s,'treasure-opened')
   if mode=='word':
    s.locator('[data-act=next]').click();s.wait_for_selector('#live-word-answer');s.set_viewport_size({'width':390,'height':340});s.locator('#live-word-answer').focus();s.locator('#live-word-answer').fill('saved draft');fit(s,'Word Forge with software keyboard space')
   t.locator('[data-act=pause]').click();s.wait_for_selector('[data-player-view=paused]');matrix(s,mode+'-paused');t.locator('[data-act=resume]').click();
   if mode=='word':s.wait_for_selector('#live-word-answer');check(s.locator('#live-word-answer').input_value()=='saved draft','pausing Word Forge preserves the unsubmitted typed answer')
   t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');matrix(s,mode+'-finished')
  t.locator('#round-mode').select_option('sketch');t.locator('[data-act=start]').click();s.wait_for_selector('.drawing-canvas');o.wait_for_selector('.drawing-canvas');artist,guesser=(s,o) if s.locator('.drawing-tools').is_visible() else (o,s)
  matrix(artist,'sketch-artist');matrix(guesser,'sketch-guesser');guesser.set_viewport_size({'width':390,'height':340});guesser.locator('#sketch-guess-input').focus();fit(guesser,'Sketch Relay with software keyboard space')
  guesser.locator('#sketch-guess-input').fill('saved guess');t.locator('[data-act=pause]').click();matrix(guesser,'sketch-paused');t.locator('[data-act=resume]').click();guesser.wait_for_selector('.sketch-guess-form:not([hidden])');check(guesser.locator('#sketch-guess-input').input_value()=='saved guess','pausing Sketch Relay preserves the unsubmitted guess');word=artist.locator('[data-artist-word]').inner_text().split(': ',1)[1];guesser.locator('#sketch-guess-input').fill(word);guesser.locator('#sketch-guess-input').press('Enter');guesser.wait_for_selector('[data-artist-word]:visible');matrix(guesser,'sketch-solved')
  check(not errors,'all eight modes have no uncaught browser errors');browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/single-screen-results.json').write_text(json.dumps(RESULTS,indent=2))
