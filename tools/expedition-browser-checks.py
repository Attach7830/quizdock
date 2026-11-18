"""Real adventure choices, private drawing roles and persistent account views; fake data only."""
from pathlib import Path
import json,os,re,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,path,data={}):
 r=ctx.request.post(BASE+path,data=data,headers={'Origin':BASE});check(r.ok,path+' succeeds'+(': '+r.text()[:160] if not r.ok else ''));return r.json()
def dismiss(page):
 for selector in ['.exp-cinema[open] [data-cinema-close]','.event-flash-dismiss:visible']:
  for node in page.locator(selector).all():
   if node.is_visible():node.click()
def expected(page):
 q=page.locator('.phase-heading').first.inner_text();return {'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(q,'una biblioteca')
def answer(page):
 dismiss(page);page.wait_for_timeout(480);word=expected(page)
 if page.locator('#live-word-answer').count():page.locator('#live-word-answer').fill(word);page.locator('#live-word-answer').press('Enter')
 else:page.locator('.answer').filter(has=page.get_by_text(word,exact=True)).first.click()
 page.wait_for_selector('[data-player-view=result]');dismiss(page)
def advance(page):
 dismiss(page)
 if page.locator('[data-act=chest]').count():page.locator('[data-act=chest]').first.click();page.wait_for_selector('[data-act=next]');dismiss(page)
 page.locator('[data-act=next]').click();page.wait_for_selector('[data-player-view=question]')
def open_adventure(page):
 dismiss(page);page.locator('[data-act=game-menu]').first.click();page.wait_for_selector('#dialog[open] [data-expedition-body]')
def choose(page,action,value=None):
 node=page.locator('[data-exp-action="'+action+'"]'+('' if value is None else '[data-exp-value="'+str(value)+'"]')).filter(visible=True).first
 revision=int(page.locator('[data-exp-revision]').get_attribute('data-exp-revision'));node.click();page.wait_for_function('(revision)=>Number(document.querySelector("[data-exp-revision]")?.dataset.expRevision)>revision',arg=revision)
def run():
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  def account(role):
   c=b.new_context(ignore_https_errors=True,viewport={'width':1366,'height':768},reduced_motion='reduce')
   if role:c.request.get(BASE+'/__test/login?role='+role)
   return c
  tc,sc,oc,dc=account('teacher'),account('student'),account('other'),account(None);fix=tc.request.get(BASE+'/__test/fixture').json();errors=[]
  g=call(dc,'/api/academy/google-start',{'classCode':fix['classCode']});credential=call(dc,'/__test/google-credential',{'nonce':g['nonce'],'email':'drawing.partner@example.com','name':'Drawing Partner'})['credential'];call(dc,'/api/academy/google-signin',{'challenge':g['challenge'],'credential':credential})
  t,s,o,d=[c.new_page() for c in [tc,sc,oc,dc]]
  for page in [t,s,o,d]:page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda dialog:dialog.accept())
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form select[name=intensity]').select_option('calm');t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  for page in [s,o,d]:page.goto(BASE+'/play.html?join='+pin);page.wait_for_selector('.game-shell')
  open_adventure(s);s.locator('[data-exp-vote=discovery]').click();s.wait_for_timeout(140);check(s.locator('[data-exp-vote=discovery]').get_attribute('aria-pressed')=='true','student votes for a next-round modifier');s.keyboard.press('Escape')
  def start(mode,sketch='auto'):
   if t.locator('[data-act=end]').count():t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]')
   t.locator('#round-mode').select_option(mode);t.locator('#round-sketch-format').select_option(sketch);t.locator('[data-act=start]').click()
   for page in [s,o,d]:
    page.wait_for_timeout(80)
    if mode in ['rally','keep']:page.locator('[data-act=role]').first.click()
   if mode!='sketch':s.wait_for_selector('[data-player-view=question]')
  start('treasure');answer(s);open_adventure(s);check(s.locator('.exp-route-map .exp-node:not([disabled])').count()==2,'treasure offers two actual connected branches');s.locator('.exp-node:not([disabled])').first.click();s.wait_for_timeout(140);check(s.locator('.exp-node.current').count()==1 and '0' in s.locator('.exp-energy').inner_text(),'travel moves the map marker and spends a server token');s.screenshot(path=str(ROOT/'checks/expedition-treasure.png'));s.keyboard.press('Escape')
  for mode in ['fishing','battle','factory','rally','keep','word']:
   start(mode)
   for i in range(4):
    answer(s)
    if i<3:advance(s)
   open_adventure(s)
   if mode=='fishing':
    choose(s,'water','deep');choose(s,'cast','cast');check(s.locator('.exp-fish-card:not(.undiscovered)').count()>0,'habitat cast adds an illustrated journal record');choose(s,'sonar');check(s.locator('.exp-sonar [disabled]').count()>=1,'sonar reveals a real search square');choose(s,'reel');check(s.locator('.exp-boss progress').get_attribute('value')!=s.locator('.exp-boss progress').get_attribute('max'),'class reeling damages the shared giant fish')
   elif mode=='battle':
    choose(s,'cast','spark');choose(s,'cast','gale');check('Combos 1' in s.locator('.exp-content').inner_text(),'two distinct drafted elements make a real combo');check(s.locator('[data-save-loadout]').is_disabled(),'battle draft locks after casting');choose(s,'lane','2');check('YOU' in s.locator('[data-exp-action=lane][data-exp-value="2"]').inner_text(),'lane button moves the student away from a hazard')
   elif mode=='factory':
    s.locator('[data-exp-select=belt][data-prefix="1:"]').select_option('down');s.wait_for_timeout(140);check(s.locator('[data-exp-select=belt][data-prefix="1:"]').input_value()=='down','conveyor editor saves a real direction change');check(s.locator('.exp-conveyor .exp-belt').count()==12,'factory shows source, assembler and warehouse grid');check('Stage 1/3' in s.locator('.exp-content').inner_text(),'factory customer contract has real stages')
   elif mode=='rally':
    choose(s,'formation','tail');check('✓ tail' in s.locator('[data-exp-action=formation][data-exp-value=tail]').inner_text(),'squadron position changes and stays selected');gate=s.locator('[data-exp-action=gate]').filter(has_text='OPEN').first;gate.click();s.wait_for_timeout(140);check('1 gates cleared' in s.locator('.exp-content').inner_text(),'aligned moving gate awards a clearance');choose(s,'rescue','courier');check('waits at checkpoint' in s.locator('.exp-content').inner_text(),'rescue exposes the actual route destination')
   elif mode=='keep':
    s.locator('[data-exp-select=tower][data-prefix="0:"]').select_option('ward');s.wait_for_selector('.exp-tower:first-child b');check('ward 1' in s.locator('.exp-tower').first.inner_text(),'castle placement uses the selected square: '+s.locator('.exp-tower').first.inner_text()+' / '+s.locator('.exp-note').inner_text()+' / '+s.locator('#notice').inner_text());choose(s,'scout');choose(s,'scout');check('Scouting report' in s.locator('.exp-note').inner_text(),'two scouting actions uncover a real enemy weakness')
   elif mode=='word':
    choose(s,'activity','crossword');check(s.locator('.exp-crossword>span').count()>0,'Word Forge has a real crossing grid');check(s.locator('.exp-crossword .solved').count()>0,'correct shuffled answers reveal crossword letters');s.keyboard.press('Escape');advance(s);s.locator('#live-word-answer').fill('my saved draft');open_adventure(s);choose(s,'activity','affixes');s.keyboard.press('Escape');check(s.locator('#live-word-answer').input_value()=='my saved draft','changing word activities preserves typed answers')
   s.screenshot(path=str(ROOT/f'checks/expedition-{mode}.png'));s.keyboard.press('Escape');dismiss(s)
   for width,height in [(320,460),(390,844),(1366,768)]:
    s.set_viewport_size({'width':width,'height':height});s.wait_for_timeout(70);check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && document.documentElement.scrollHeight<=visualViewport.height+1'),mode+' main view retains one-screen layout at '+str(width))
   s.set_viewport_size({'width':1366,'height':768})
  # Distinct shared drawing constraints are visible on the actual pointer canvas.
  for format in ['duo','relay','constraint','story','compound']:
   start('sketch',format);s.wait_for_selector('.drawing-canvas');o.wait_for_selector('.drawing-canvas');d.wait_for_selector('.drawing-canvas');pages=[s,o,d];artists=[page for page in pages if page.locator('.drawing-tools').is_visible()];guesser=next(page for page in pages if not page.locator('.drawing-tools').is_visible());check(len(artists)==(2 if format in ['duo','compound'] else 1),format+' reserves guessing students and assigns drawing tools')
   artist=artists[0];before=guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()');box=artist.locator('.drawing-canvas').bounding_box();artist.mouse.move(box['x']+box['width']*.1,box['y']+box['height']*.2);artist.mouse.down();artist.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.55,steps=12);artist.mouse.up();guesser.wait_for_timeout(350);check(guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()')!=before,format+' pointer strokes stream to the guessing canvas');check(not guesser.locator('[data-artist-word]').is_visible(),format+' keeps the word private');artist.screenshot(path=str(ROOT/f'checks/expedition-sketch-{format}.png'));t.locator('[data-sketch-action=sketch-next]').click();guesser.wait_for_timeout(120)
  t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]')
  data=call(sc,'/api/academy/expedition-home',{'classId':fix['classId']});check(data['passport']['stats']['rounds']>=7,'completed games persist an expedition passport');check(data['passport']['fish'],'completed fishing saves catches to the account aquarium');check(data['gallery'],'revealed drawings persist in the shared class mural')
  s.goto(BASE+'/?view=expeditions');s.wait_for_selector('.exp-island');check(s.locator('.exp-chapter').count()==8,'class island shows the complete eight-mode campaign');check(s.locator('.island-building').count()==4,'class island has four buildable destinations');s.locator('[data-act=island-build]').first.click();s.wait_for_timeout(170);check('1/50' in s.locator('.island-building').first.inner_text(),'student supply builds the persistent class hub')
  s.locator('#aquarium-form [name=name]').fill('The Blub Club');s.locator('#aquarium-form button').click();s.wait_for_timeout(170);s.reload();s.wait_for_selector('.exp-aquarium');check('The Blub Club' in s.locator('h2').all_inner_texts(),'aquarium name survives a full reload');s.locator('#hangar-form [name=paint]').select_option('sunset');s.locator('#hangar-form button').click();s.wait_for_timeout(170);check(call(sc,'/api/academy/home')['user']['hangar']['paint']=='sunset','hangar paint saves on the account');s.screenshot(path=str(ROOT/'checks/expedition-class-island.png'),full_page=True)
  for width in [320,390,768,1366]:s.set_viewport_size({'width':width,'height':844});check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'island, aquarium and journal fit width '+str(width))
  s.goto(BASE+'/?wardrobe=1');s.wait_for_selector('#outfit-preset-form');s.locator('#outfit-preset-form input').fill('Sky Librarian');s.locator('#outfit-preset-form button').click();s.wait_for_selector('[data-act=outfit-preset][data-operation=equip]');s.reload();s.locator('[data-tab=wardrobe]').click();s.wait_for_selector('#outfit-preset-form');check('Sky Librarian' in s.locator('.exp-preset-row').inner_text(),'outfit presets survive a reload');check(not errors,'adventure, persistence and new drawing UI have no uncaught browser errors');b.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/expedition-results.json').write_text(json.dumps(RESULTS,indent=2))
