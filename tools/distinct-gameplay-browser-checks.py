"""Exercise distinct strategies, vocabulary input and real shared drawing through fake accounts."""
from pathlib import Path
import json,os,re,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def account(browser,role,width=390,height=844):
 ctx=browser.new_context(ignore_https_errors=True,viewport={'width':width,'height':height},reduced_motion='reduce');ctx.request.get(BASE+'/__test/login?role='+role);return ctx
def dismiss(page):
 cinema=page.locator('.exp-cinema[open] [data-cinema-close]')
 if cinema.count():cinema.click()
 b=page.locator('.event-flash-dismiss')
 if b.count() and b.is_visible():b.click()
def expected(page):
 q=page.locator('.phase-heading').first.inner_text();return {'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(q,'una biblioteca')
def answer(page):
 page.wait_for_timeout(470);target=expected(page);page.locator('.answer').filter(has_text=re.compile(re.escape(target))).first.click();page.wait_for_selector('[data-player-view=result]');dismiss(page)
def advance(page):
 dismiss(page)
 if page.locator('[data-act=chest]').count():page.locator('[data-act=chest]').first.click();page.wait_for_selector('[data-act=next]');dismiss(page)
 page.locator('[data-act=next]').click();page.wait_for_selector('[data-player-view=question]')
def choose(page,choice):
 dismiss(page);page.locator(f'[data-act=play][data-choice="{choice}"]').click();page.wait_for_selector('.gameplay-receipt')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=account(browser,'teacher',1440,1000);sc=account(browser,'student');oc=account(browser,'other');t=tc.new_page();s=sc.new_page();other=oc.new_page();errors=[]
  for page in [t,s,other]:page.on('pageerror',lambda e:errors.append(str(e)))
  t.on('dialog',lambda d:d.accept());fix=tc.request.get(BASE+'/__test/fixture').json()
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  for page in [s,other]:page.goto(BASE+'/play.html?join='+pin);page.wait_for_selector('.game-shell')
  def start(mode):
   if t.locator('[data-act=end]').count():t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]')
   t.locator('#round-mode').select_option(mode);t.locator('[data-act=start]').click()
   if mode in ['rally','keep']:
    for page in [s,other]:page.wait_for_selector('[data-act=role]');page.locator('[data-act=role]').first.click()
   if mode not in ['sketch']:s.wait_for_selector('[data-player-view=question]')
  start('treasure');answer(s);check(s.locator('.route-chest').count()==3,'treasure offers three explicit risk/banking routes')
  s.locator('[data-act=chest][data-index="0"]').click();s.wait_for_selector('[data-act=next]');check('protected' in s.locator('.haul-split').inner_text().lower() or 'Protected vault' in s.locator('.haul-split').inner_text(),'banking produces an actual protected vault balance');s.screenshot(path=str(ROOT/'checks/strategy-treasure.png'),full_page=True)
  for mode in ['fishing','battle','factory','rally','keep']:
   start(mode);check(s.locator('.answer').count()==4 and not s.locator('.word-keyboard').count(),mode+' retains four multiple-choice question buttons');answer(s)
   check(s.locator(f'[data-gameplay="{mode}"]').count()==1,mode+' presents its own strategic game state')
   if mode=='fishing':
    check(s.locator('.adventure-row b').inner_text().startswith('1/'),'a catch discovers a named species');choose(s,'deep');check('Deep water' in s.locator('.gameplay-receipt').inner_text(),'water selection is accepted by the server');advance(s);answer(s);check(s.locator('.catch-reveal h3').inner_text() in ['Blue Grouper','Steel Marlin','Abyss Ray','Leviathan Koi'],'next fish comes from the selected deep-water species')
   if mode=='battle':
    choose(s,'charge');check('1/3 charges' in s.locator('.gameplay-receipt').inner_text(),'battle stores a real charge');advance(s);answer(s);choose(s,'strike');check('Charged strike' in s.locator('.gameplay-receipt').inner_text(),'charged strike is a distinct server-resolved attack')
   if mode=='factory':
    for _ in range(2):advance(s);answer(s)
    capital=s.locator('.hud-score').inner_text();choose(s,'build-cells');check(s.locator('.hud-score').inner_text()==capital,'station purchase preserves net worth while converting cash into assets');advance(s);answer(s)
    check('0 cells' in s.locator('.production-chain').inner_text(),'new cell lab routes its first parcel before warehouse delivery')
    for _ in range(5):
     s.locator('[data-act=game-menu]').first.click()
     repair=s.locator('[data-exp-action=repair]')
     if repair.count() and repair.is_enabled():repair.click();s.wait_for_timeout(120)
     s.keyboard.press('Escape');advance(s);answer(s)
    check(re.search(r'[1-9][0-9]* cells',s.locator('.production-chain').inner_text()) is not None,'real conveyor journey delivers cell inventory');choose(s,'ship');check('Order shipped!' in s.locator('.gameplay-receipt').inner_text(),'fulfilling an order consumes delivered inventory and pays the promised amount')
   if mode=='rally':
    check(s.locator('.selected-plane').is_visible(),'rally retains the chosen aircraft in its UI');choose(s,'glide');advance(s);answer(s);choose(s,'dive');advance(s);answer(s);check('Boost dive!' in s.locator('.result-reward').inner_text(),'stored boost drives a later racing leg')
   if mode=='keep':
    for _ in range(2):advance(s);answer(s)
    choose(s,'tower');s.locator('[data-act=game-menu]').click();s.locator('#dialog [data-act=game-details]').click();s.wait_for_selector('.game-reader[open]');check('1 bolt towers' in s.locator('.reader-pages').inner_text(),'building a tower changes the shared defense shown in the full field guide');s.keyboard.press('Escape');check(t.locator('[data-gameplay-host=keep]').count()==1,'teacher sees shared crystal, enemy and wave progress')
   check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),mode+' strategic controls fit phone width');s.screenshot(path=str(ROOT/f'checks/strategy-{mode}.png'),full_page=True)
  start('word');check(s.locator('.answer').count()==0 and s.locator('.word-keyboard button').count()>26,'Word Forge replaces four choices with letter clues and a typed answer')
  typed=expected(s);s.locator('#live-word-answer').fill(typed[:2]);other.locator('[data-act=word-letter]').first.click();s.wait_for_timeout(160);check(s.locator('#live-word-answer').input_value()==typed[:2],'peer updates preserve a partially typed word')
  letter=next(c.upper() for c in typed if c.isalpha());s.locator(f'[data-act=word-letter][data-letter="{letter}"]').click();s.wait_for_timeout(120);check(s.locator('.word-slot.revealed').count()>0,'letter guesses reveal real matching positions')
  s.locator('#live-word-answer').fill(typed);s.locator('#live-word-answer').press('Enter');s.wait_for_selector('[data-player-view=result]');check('Word forged!' in s.locator('.result-reward').inner_text(),'typed vocabulary is graded by the server and forges a word');s.screenshot(path=str(ROOT/'checks/word-forge-result.png'),full_page=True)
  start('sketch');s.wait_for_selector('.drawing-canvas');other.wait_for_selector('.drawing-canvas');t.wait_for_selector('.drawing-canvas')
  artist,guesser=(s,other) if s.locator('.drawing-tools').is_visible() else (other,s)
  check(artist.locator('.drawing-tools').is_visible() and not guesser.locator('.drawing-tools').is_visible(),'exactly the selected artist receives drawing tools')
  word=artist.locator('[data-artist-word]').inner_text().split(': ',1)[1]
  check(not guesser.locator('[data-artist-word]').is_visible() and word not in guesser.locator('.sketch-board').inner_text(),'artist word remains private before guessing')
  check(guesser.locator('.answer').count()==0 and guesser.locator('.sketch-guess-form').is_visible(),'Sketch Relay uses a canvas and spelling box instead of four answers')
  guesser.wait_for_function("document.querySelector('.drawing-canvas').getContext('2d').getImageData(0,0,1,1).data[3]===255");before=guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()');box=artist.locator('.drawing-canvas').bounding_box();artist.mouse.move(box['x']+box['width']*.2,box['y']+box['height']*.3);artist.mouse.down();artist.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.65,steps=16);artist.mouse.up();guesser.wait_for_timeout(400)
  after=guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()');check(before!=after,'artist strokes stream to a classmate’s real canvas')
  guesser.reload();guesser.wait_for_selector('.drawing-canvas');guesser.wait_for_timeout(200);check(guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()')==after,'a browser reload restores the authoritative drawing history')
  artist.locator('[data-ink="#ffffff"]').click();box=artist.locator('.drawing-canvas').bounding_box();artist.mouse.move(box['x']+box['width']*.2,box['y']+box['height']*.3);artist.mouse.down();artist.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.65,steps=16);artist.mouse.up();guesser.bring_to_front();guesser.wait_for_function('''()=>{const c=document.querySelector('.drawing-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-255)>2||Math.abs(d[i+1]-253)>2||Math.abs(d[i+2]-245)>2||d[i+3]!==255)return false;return true;}''');check(True,'eraser strokes restore the shared paper background')
  guesser.locator('#sketch-guess-input').fill('partially typed');artist.locator('[data-sketch-action=sketch-clear]').click();guesser.wait_for_timeout(200);check(guesser.locator('#sketch-guess-input').input_value()=='partially typed','teacher/artist drawing changes do not erase a live guess')
  check(guesser.locator('.drawing-canvas').evaluate('(c)=>c.toDataURL()')==before,'clearing the canvas reaches classmates')
  guesser.locator('#sketch-guess-input').fill('not-the-word');guesser.locator('#sketch-guess-input').press('Enter');guesser.wait_for_timeout(180);check('Not quite' in guesser.locator('.sketch-feedback').inner_text() and not guesser.locator('[data-artist-word]').is_visible(),'incorrect guesses give feedback without leaking the answer')
  guesser.wait_for_timeout(950);guesser.locator('#sketch-guess-input').fill(word);guesser.locator('#sketch-guess-input').press('Enter');guesser.wait_for_selector('[data-artist-word]:visible');check('decoded' in guesser.locator('.sketch-feedback').inner_text(),'correct word guesses score and reveal the completed word')
  guesser.screenshot(path=str(ROOT/'checks/sketch-relay-solved-phone.png'),full_page=True)
  t.locator('[data-sketch-action=sketch-next]').click();artist.wait_for_selector('.sketch-guess-form:not([hidden])');check(not artist.locator('.drawing-tools').is_visible() and guesser.locator('.drawing-tools').is_visible(),'the brush rotates to the next student')
  check(artist.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'shared drawing and letter clues fit the phone viewport without horizontal overflow')
  guesser.screenshot(path=str(ROOT/'checks/sketch-relay-artist-phone.png'),full_page=True)
  check(not errors,'all eight game experiences have no browser JavaScript errors');browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/distinct-gameplay-results.json').write_text(json.dumps(RESULTS,indent=2))
