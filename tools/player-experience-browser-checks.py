"""Question/result, aircraft, typed flashcard and synthesized-score regressions.
Uses only the isolated fake-account harness; no production student data.
"""
from pathlib import Path
import os,json,shutil,re
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
ANSWERS={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}
def answer(page):return ANSWERS.get(page.locator('.game-question h2').inner_text(),'una biblioteca')
def choose(page,correct=True):
 page.wait_for_timeout(480)
 expected=answer(page)
 buttons=page.locator('.answer')
 target=buttons.filter(has_text=re.compile(re.escape(expected))) if correct else buttons.filter(has_not_text=re.compile(re.escape(expected)))
 target.first.click();page.wait_for_selector('[data-player-view=result]')
def next_question(page):
 if page.locator('[data-act=chest]').count():page.locator('[data-act=chest]').first.click()
 page.locator('[data-act=next]').click();page.wait_for_selector('[data-player-view=question]')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=account(browser,'teacher',1440,900);sc=account(browser,'student');oc=account(browser,'other')
  t=tc.new_page();s=sc.new_page();errors=[]
  for page in [t,s]:page.on('pageerror',lambda e:errors.append(str(e)))
  t.on('dialog',lambda d:d.accept())
  fix=tc.request.get(BASE+'/__test/fixture').json()
  # Ungraded typing is part of the existing shared deck, with server confidence saves.
  s.goto(BASE+'/');s.locator('[role=tab][data-act=tab][data-tab=practice]').click();s.locator('[data-act=solo]').first.click()
  s.locator('[data-act=solo-mode][data-mode=type]').click();s.wait_for_selector('#solo-answer')
  check(s.locator('[data-act=solo-flip]').count()==0,'typing mode requires an answer instead of flipping to reveal it')
  def solo_expected():
   prompt=s.locator('.solo-type-panel .study-prompt').inner_text()
   return ANSWERS.get(prompt,'una biblioteca')
  for i in range(8):
   if s.locator('.solo-type-panel .study-prompt').inner_text()=='He spoke yesterday.':break
   s.locator('#solo-answer').fill(solo_expected());s.locator('#solo-answer').press('Enter');s.wait_for_selector('[data-act=solo-typed-next]');s.locator('[data-act=solo-typed-next]').click()
  s.locator('#solo-answer').fill('hablo');s.locator('#solo-answer').press('Enter');s.wait_for_selector('.solo-typed-feedback')
  check('Not quite' in s.locator('.solo-typed-feedback').inner_text() and 'habló' in s.locator('.solo-typed-feedback').inner_text(),'typed solo feedback enforces accents and teaches the accepted answer')
  s.locator('[data-act=solo-typed-next]').click()
  for i in range(8):
   if s.locator('.solo-type-panel .study-prompt').inner_text()=='He spoke yesterday.':break
   s.locator('#solo-answer').fill(solo_expected());s.locator('#solo-answer').press('Enter');s.wait_for_selector('[data-act=solo-typed-next]');s.locator('[data-act=solo-typed-next]').click()
  check(s.locator('.solo-type-panel .study-prompt').inner_text()=='He spoke yesterday.','typing follows the same card after a reshuffled pass')
  s.locator('#solo-answer').fill('hablo');s.locator('#solo-accent-zone .accent').first.click()
  check(s.locator('#solo-answer').input_value()=='habló','typing practice contextual accent key preserves and replaces the typed letter')
  s.locator('#solo-answer').press('Enter');s.wait_for_selector('[data-act=solo-typed-next]')
  check('Correct!' in s.locator('.solo-typed-feedback').inner_text(),'accented typed flashcard answer is checked correctly')
  s.screenshot(path=str(ROOT/'checks/typed-solo-result-phone.png'),full_page=True)
  s.wait_for_function('document.querySelector("#solo-save").textContent==="Progress saved"')
  home=sc.request.post(BASE+'/api/academy/home',data={},headers={'Origin':BASE}).json()
  check(home['user']['points']==190 and home['assignments'][0]['progress'] is None,'typed solo practice changes neither reward currency nor assigned practice grades')
  saved=sc.request.post(BASE+'/api/academy/solo-open',data={'classId':fix['classId'],'listId':fix['listId']},headers={'Origin':BASE}).json()
  card=next(c for c in saved['deck']['cards'] if c['prompt']=='He spoke yesterday.')
  check(card['id'] in saved['progress']['known'] and card['id'] not in saved['progress']['again'],'typed confidence is saved by stable card ID')
  s.locator('[data-act=solo-mode][data-mode=flip]').click();check(s.locator('.flashcard').count()==1,'flip cards remain available alongside typing')
  # Create a class game without changing fixture question or grading data.
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  s.goto(BASE+'/play.html?join='+pin);s.wait_for_selector('.game-shell');t.locator('[data-act=start]').click();s.wait_for_selector('.answer')
  for w,h in [(1440,900),(1024,768),(390,844),(320,568),(844,390),(360,460)]:
   s.set_viewport_size({'width':w,'height':h});s.wait_for_timeout(80)
   tiles=s.locator('.answer');check(tiles.count()==4,f'four answer tiles at {w}x{h}')
   sizes=tiles.evaluate_all('(buttons)=>buttons.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))')
   check(all(b['w']>=110 and b['h']>=100 for b in sizes),f'large answer targets at {w}x{h}')
   check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'question has no horizontal overflow at {w}x{h}')
  check(not s.locator('canvas').is_visible(),'question screen hides the game and preserves space for answers')
  s.set_viewport_size({'width':390,'height':844});s.screenshot(path=str(ROOT/'checks/four-answers-phone.png'),full_page=True)
  s.set_viewport_size({'width':1440,'height':900});s.screenshot(path=str(ROOT/'checks/four-answers-desktop.png'),full_page=True)
  s.set_viewport_size({'width':320,'height':568});choose(s,False)
  check(s.locator('.answer').count()==0 and s.locator('canvas').is_visible(),'wrong answer transitions to a separate game result view')
  check(s.locator('.correct-answer').count()==1 and 'Not quite' in s.locator('.result-heading').inner_text(),'wrong result clearly shows the correct answer')
  check(s.evaluate('scrollY')==0,'new result screen starts at the top after a scrolled question')
  s.screenshot(path=str(ROOT/'checks/wrong-result-phone.png'),full_page=True)
  next_question(s);choose(s,True)
  check(s.locator('[data-act=chest]').count()==3 and s.locator('[data-act=next]').count()==0,'correct treasure result waits for a chest before continuing')
  s.locator('[data-act=chest]').first.click();s.wait_for_selector('[data-act=next]')
  check(s.locator('.result-reward').inner_text()!='Choose a mystery chest!','chest result displays the server-issued reward')
  s.screenshot(path=str(ROOT/'checks/reward-result-phone.png'),full_page=True)
  next_question(s)
  for _ in range(8):
   if s.locator('.question-screen h2').inner_text().startswith('Read this longer prompt'):break
   choose(s,False);next_question(s)
  check(s.locator('.question-screen h2').inner_text().startswith('Read this longer prompt'),'long prompt remains part of the same question deck')
  s.set_viewport_size({'width':320,'height':460});s.locator('.answer').last.scroll_into_view_if_needed();y=s.evaluate('scrollY')
  other=oc.new_page();other.goto(BASE+'/play.html?join='+pin);other.wait_for_selector('.answer');choose(other)
  s.wait_for_timeout(180);check(abs(s.evaluate('scrollY')-y)<2,'other player score updates preserve long-question document scrolling')
  choose(s);check(s.evaluate('scrollY')==0,'question-to-result transition resets only the new view scroll')
  s.reload();s.wait_for_selector('[data-player-view=result]');check(s.locator('.answer').count()==0,'reconnect resumes authoritative answer result without re-answering')
  # Every Rally role has matching preview, selected label and canvas aircraft.
  previews=set();canvases=set()
  for role,name in [('sprinter','Comet Racer'),('navigator','Harbor Twinwing'),('ace','Violet Kestrel')]:
   t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');t.locator('#round-mode').select_option('rally');t.locator('[data-act=start]').click();s.wait_for_selector('[data-act=role]')
   check(s.locator('.plane-preview').count()==3,'Rally shows all three aircraft before role selection: '+role)
   previews.add(s.locator(f'[data-act=role][data-role={role}] svg').evaluate('(el)=>el.outerHTML'))
   s.set_viewport_size({'width':390,'height':844});s.screenshot(path=str(ROOT/'checks/plane-choice-phone.png'),full_page=True)
   s.locator(f'[data-act=role][data-role={role}]').click();s.wait_for_selector('.answer');check(name in s.locator('.selected-plane').inner_text(),'selected aircraft appears in question HUD: '+role)
   choose(s);check(s.locator('.game-scene').get_attribute('data-plane')==role,'result scene uses selected aircraft: '+role)
   canvases.add(s.locator('canvas').evaluate('(c)=>c.toDataURL()'));s.screenshot(path=str(ROOT/f'checks/rally-{role}-result.png'),full_page=True)
  check(len(previews)==3 and len(canvases)==3,'all Rally plane silhouettes remain visually distinct in cards and flight')
  # A target-ending answer must still show its reward even without a question snapshot.
  t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');t.locator('#round-mode').select_option('fishing');t.locator('#round-kind').select_option('score');t.locator('#round-target').fill('1');t.locator('[data-act=start]').click();s.wait_for_selector('.answer');choose(s)
  check('Round complete' in s.locator('.result-screen').inner_text() and s.locator('[data-act=next]').count()==0,'final score-ending answer shows its result without a stale Next action')
  # Render complete original 16-bar scores with the actual Web Audio synth.
  audio=s.evaluate('''async()=>{const {CHIP_TUNES}=await import('/js/chip-score.js');const {createChipSynth}=await import('/js/chip-synth.js');const out=[];for(const [mode,score] of Object.entries(CHIP_TUNES)){const rate=22050,tick=15/score.bpm,duration=256*tick+.4,context=new OfflineAudioContext(1,Math.ceil(rate*duration),rate),gain=context.createGain();gain.gain.value=.12;gain.connect(context.destination);const synth=createChipSynth(context,gain);for(let i=0;i<256;i++)synth.play(score,i,.03+i*tick);const rendered=await context.startRendering(),data=rendered.getChannelData(0);let peak=0,sum=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}out.push({mode,peak,rms:Math.sqrt(sum/data.length),seconds:duration});}return out;}''')
  for rendered in audio:check(.004<rendered['rms']<.15 and rendered['peak']<.8 and rendered['seconds']>25,rendered['mode']+' full RPG score renders audibly without clipping')
  (ROOT/'checks/rpg-audio-results.json').write_text(json.dumps(audio,indent=2))
  check(not errors,'player and study screens have no browser JavaScript errors')
  browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/player-experience-results.json').write_text(json.dumps(RESULTS,indent=2))
