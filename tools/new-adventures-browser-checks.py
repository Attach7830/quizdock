"""Fish journal/art, clear Word Forge, and a real graded crossword. Fake local accounts only."""
from pathlib import Path
import json,os,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,path,data={}):
 r=ctx.request.post(BASE+path,data=data,headers={'Origin':BASE})
 if not r.ok:raise AssertionError(path+': '+r.text()[:200])
 return r.json()
def dismiss(p):
 for b in p.locator('.event-flash-dismiss:visible').all():b.click()
def fit(p,label):
 p.wait_for_timeout(60)
 d=p.evaluate('''()=>({h:innerHeight,w:innerWidth,dh:document.documentElement.scrollHeight,dw:document.documentElement.scrollWidth,off:[...document.querySelectorAll('.assignment-practice button,.assignment-practice input,.assignment-practice select')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1}).map(e=>e.id||e.textContent.slice(0,30))})''')
 if d['off'] or d['dh']>d['h']+1:p.screenshot(path=str(ROOT/'checks/crossword-layout-failure.png'))
 check(d['dh']<=d['h']+1 and d['dw']<=d['w']+1 and not d['off'],label+': '+str(d))
def run():
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=b.new_context(ignore_https_errors=True,viewport={'width':1440,'height':1000},reduced_motion='reduce');sc=b.new_context(ignore_https_errors=True,viewport={'width':1366,'height':768},reduced_motion='reduce')
  tc.request.get(BASE+'/__test/login?role=teacher');sc.request.get(BASE+'/__test/login?role=student');t=tc.new_page();s=sc.new_page();errors=[]
  for p in [t,s]:p.on('pageerror',lambda e:errors.append(str(e)))
  fix=tc.request.get(BASE+'/__test/fixture').json()
  s.goto(BASE+'/');s.wait_for_selector('[data-act=tab]')
  s.evaluate('''async()=>{const {fishJournal}=await import('/js/fish-journal.js');document.querySelector('main').innerHTML='<section class="panel">'+fishJournal({'reef-skipper':{count:3,best:4.2,shinyCount:1,shinyBest:2.2},'the-last-aurora':{count:1,best:8}})+'</section>'}''')
  check(s.locator('.exp-fish-card').count()==24,'fish journal renders one page rather than 300 cards at once')
  all_ids=[]
  for page in range(13):
   all_ids+=s.locator('.exp-fish-card').evaluate_all('(es)=>es.map(e=>e.dataset.fishId)')
   if page<12:s.locator('[data-fish-page]').last.click()
  check(len(set(all_ids))==300,'journal pagination reaches all 300 species')
  s.locator('[data-fish-filter=rarity]').select_option('mythic');check(s.locator('.exp-fish-card').count()==6,'six Mythics can be explored without catching one')
  s.locator('[data-fish-filter=water]').select_option('shallows');check(s.locator('.exp-fish-card').count()==2,'water and rarity filters combine')
  s.locator('[data-fish-filter=owned]').select_option('caught');check(s.locator('.exp-fish-card h4').inner_text()=='The Last Aurora','owned fish retain their counts across filters')
  s.locator('[data-fish-filter=search]').fill('LAST');check('1 caught' in s.locator('.exp-fish-card').inner_text(),'species search preserves saved catch metadata')
  s.locator('[data-fish-filter=search]').fill('');s.locator('[data-fish-filter=variant]').select_option('shiny');s.locator('[data-fish-filter=water]').select_option('all');s.locator('[data-fish-filter=rarity]').select_option('all');check(s.locator('.exp-fish-card h4').inner_text()=='✦ Shiny Reef Skipper' and s.locator('.shiny-fish').count()==1,'shiny collection has its own saved counts and distinctive original art')
  s.set_viewport_size({'width':320,'height':568});check(s.evaluate('document.documentElement.scrollWidth<=innerWidth'),'journal controls fit a small phone');s.screenshot(path=str(ROOT/'checks/fish-journal-phone.png'),full_page=True)
  s.set_viewport_size({'width':1440,'height':1000})
  art=s.evaluate('''async()=>{const {FISH_SPECIES}=await import('/js/fish-catalog.js'),{fishMarkup,drawFish}=await import('/js/fish-art.js');const root=document.querySelector('main');root.innerHTML='<canvas id="all-fish" width="1400" height="3000"></canvas><div id="fish-svg-check"></div>';const c=document.querySelector('canvas').getContext('2d');c.fillStyle='#17263f';c.fillRect(0,0,1400,3000);const svg=document.querySelector('#fish-svg-check');let bounds=0,painted=0,shinies=0;for(const [i,f] of FISH_SPECIES.entries()){const x=i%10*140,y=Math.floor(i/10)*100;drawFish(c,x+70,y+42,.85,f.id);c.font='9px system-ui';c.fillStyle='#edf7ff';c.textAlign='center';c.fillText(f.name,x+70,y+86,135);svg.innerHTML=fishMarkup(f.id);const box=svg.querySelector('svg').getBBox();if(box.x>=-1&&box.y>=-1&&box.x+box.width<=131&&box.y+box.height<=79)bounds++;const p=c.getImageData(x,y,140,78).data;if(p.some((v,j)=>j%4===0&&v!==23))painted++;svg.innerHTML=fishMarkup(f.id,{shiny:true});const shinyBox=svg.querySelector('svg').getBBox();c.fillStyle='#17263f';c.fillRect(x,y,140,78);drawFish(c,x+70,y+42,.85,f.id,0,{shiny:true});if(shinyBox.x>=-1&&shinyBox.y>=-1&&shinyBox.x+shinyBox.width<=131&&shinyBox.y+shinyBox.height<=79&&fishMarkup(f.id,{shiny:true})!==fishMarkup(f.id))shinies++;}svg.remove();return {bounds,painted,shinies,total:FISH_SPECIES.length}}''')
  check(art['bounds']==300,'all 300 SVG fish fit their view boxes');check(art['shinies']==300,'all 300 prismatic shiny variants differ from the originals and render in SVG/canvas');check(art['painted']==300,'all 300 species also draw successfully on game canvas');s.locator('#all-fish').screenshot(path=str(ROOT/'checks/fish-art-contact-sheet.png'))
  # Create the week's assignment through the actual teacher form.
  words=['casa','perro','estrecho','zapatos','botas','bufanda','pantalones','sombrero','camisa','habló','aprender','grande','pequeño','cinturón','azul','verde','rojo','amarillo','negro','blanco','chico','lejos','cerca','aquel','aquellas','estas','ese','esos','cuero','algodón','lana','seda','vestido','falda','traje','abrigo','guantes','sudadera','calcetines','chaqueta']
  mapping={'Clue '+str(i):word for i,word in enumerate(words)};lid=str(uuid.uuid4())
  call(tc,'/api/library/save',{'id':lid,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Crossword review deck','cards':[{'type':'pair','prompt':k,'answer':v,'category':['grammar','vocabulary','culture'][i%3]} for i,(k,v) in enumerate(mapping.items())]}})
  t.goto(BASE+'/?view=assignments');t.locator('[data-act=new-assignment]').click();t.locator('#assignment-form [name=listId]').select_option(lid);t.locator('[name=title]').fill('This week’s Crossword Mode');t.locator('[name=minMinutes]').fill('5');t.locator('[name=minCards]').fill('100');t.locator('[name=crosswordWords]').fill('8');t.locator('#assignment-form button[type=submit],#assignment-form button.btn.primary').click();t.wait_for_function('!document.querySelector("#dialog").open')
  home=call(sc,'/api/academy/home');a=next(a for a in home['assignments'] if a['listId']==lid)
  check(a['rules']['crosswordWords']==8 and a['rules']['minCards']==100,'teacher publishes a crossword word count alongside the unchanged typed requirements')
  s.goto(BASE+'/?view=assignments');s.locator(f'[data-act=practice][data-id="{a["id"]}"]').click();s.locator('[data-act=practice-mode][data-mode=crossword]').click();s.wait_for_selector('.assignment-crossword');puzzle_id=s.locator('.assignment-crossword').get_attribute('data-puzzle-id')
  check(s.locator('.practice-prompt-number').inner_text()=='8-word crossword','crossword header shows its assigned word count rather than an unrelated deck counter');check(s.locator('#assignment-crossword-clue option').count()==8,'student gets exactly the teacher’s eight random deck clues');check(s.locator('#typed-answer').evaluate('(e)=>e===document.activeElement'),'crossword entry is focused automatically')
  for w,h in [(1366,768),(1024,600),(768,1024),(390,844),(320,568)]:s.set_viewport_size({'width':w,'height':h});fit(s,f'crossword and typed controls fit {w}x{h}')
  s.set_viewport_size({'width':1366,'height':768});s.locator('#typed-answer').fill('saved draft');s.locator('[data-act=practice-mode][data-mode=word]').click();s.locator('[data-act=practice-mode][data-mode=crossword]').click();check(s.locator('#typed-answer').input_value()=='saved draft','switching assignment formats keeps a crossword draft')
  s.reload();s.locator(f'[data-act=practice][data-id="{a["id"]}"]').click();s.locator('[data-act=practice-mode][data-mode=crossword]').click();s.wait_for_selector('.assignment-crossword');check(s.locator('.assignment-crossword').get_attribute('data-puzzle-id')==puzzle_id,'reopening resumes the same generated puzzle')
  for i in range(8):
   check(s.locator('#typed-answer').evaluate('(e)=>e===document.activeElement'),'clue '+str(i+1)+' is ready to type without clicking')
   text=s.locator('.crossword-clue').inner_text();s.keyboard.press('ControlOrMeta+A');s.keyboard.insert_text(mapping[text]);s.wait_for_timeout(520);s.keyboard.press('Enter');s.wait_for_selector('[data-act=crossword-next]')
   if i<7:s.keyboard.press('Enter');s.wait_for_selector('#typed-answer')
  check(s.locator('[data-act=practice-submit]').is_enabled(),'solving all clues enables explicit assignment submission');s.screenshot(path=str(ROOT/'checks/assignment-crossword-complete.png'))
  s.locator('[data-act=practice-submit]').click();s.wait_for_selector('.practice-submitted');check('Crossword' in s.locator('.practice-submitted').inner_text(),'submission identifies Crossword as the completion method')
  report=call(tc,'/api/academy/assignment-report',{'assignmentId':a['id']});row=next(r for r in report['students'] if r['email']=='alex@example.com')
  check(row['progress']['completionMethod']=='crossword' and row['progress']['crossword']['solved']==8 and row['progress']['creditPercent']==100,'real teacher grade report records all eight solved words and full assignment credit')
  for goal in [20,40]:
   large=call(tc,'/api/academy/create-assignment',{'classId':fix['classId'],'listId':lid,'title':str(goal)+'-word puzzle','dueLocal':'2026-12-18T23:59','rules':{'minMinutes':5,'minCards':100,'crosswordWords':goal}})['assignment'];s.goto(BASE+'/?view=assignments');s.locator(f'[data-act=practice][data-id="{large["id"]}"]').click();s.locator('[data-act=practice-mode][data-mode=crossword]').click();s.wait_for_selector('.assignment-crossword');check(s.locator('#assignment-crossword-clue option').count()==goal,'large crossword keeps all '+str(goal)+' required words')
   for w,h in [(1366,768),(320,568)]:s.set_viewport_size({'width':w,'height':h});fit(s,str(goal)+'-word crossword controls fit '+str(w)+'x'+str(h))
   s.set_viewport_size({'width':1366,'height':768})
  # Hosted Word Forge uses the same real typing/focus flow as private solo games.
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form select[name=mode]').select_option('word');t.locator('#host-form select[name=listId]').select_option(lid);t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text();s.goto(BASE+'/play.html?join='+pin);t.locator('[data-act=start]').click();s.wait_for_selector('#live-word-answer')
  for i in range(5):
   check(s.locator('#live-word-answer').evaluate('(e)=>e===document.activeElement'),'Word Forge prompt '+str(i+1)+' is automatically ready for typing');check(s.locator('.word-keyboard').count()==0,'Word Forge keeps the alphabet out of the typing screen '+str(i+1))
   prompt=s.locator('.phase-heading').inner_text();s.keyboard.insert_text(mapping[prompt]);s.wait_for_timeout(520);s.keyboard.press('Enter');s.wait_for_selector('[data-player-view=result]');dismiss(s)
   check(s.locator('.forge-meter').get_attribute('data-forge-step')==str(i+1),'real correct word advances the visible forge '+str(i+1))
   if i<4:s.locator('[data-act=next]').click();s.wait_for_selector('#live-word-answer')
  check(s.locator('.forge-awakened').count()==1,'five real correct typed answers awaken the first relic');s.screenshot(path=str(ROOT/'checks/word-forge-relic-awakened.png'))
  s.locator('[data-act=game-details]').first.click();s.wait_for_selector('.game-reader[open]');check('Play in three steps' in s.locator('.reader-pages').inner_text(),'one-click How to play explains the mode');s.keyboard.press('Escape');s.locator('[data-act=game-menu]').click();check(s.locator('.word-extra-challenge:not([open])').count()==1,'automatic boss and recipe bonuses stay in a collapsed optional section');check(s.locator('.word-helper-picker:not([open])').count()==1,'helper choices stay behind an explicit change control');s.locator('.word-helper-picker summary').click();t.locator('[data-act=pause]').click();s.wait_for_selector('[data-player-view=paused]');check(s.locator('.word-helper-picker[open]').count()==1,'room updates preserve an open helper section');t.locator('[data-act=resume]').click();s.wait_for_selector('[data-player-view=result]');s.locator('[data-act=return-to-word]').click();s.wait_for_selector('#live-word-answer');check(s.locator('#live-word-answer').evaluate('(e)=>e===document.activeElement'),'return-to-answer action advances from result and focuses the next word')
  s.locator('[data-act=word-clues]').click();check(s.locator('#dialog .word-keyboard button').count()==33,'optional clue panel shows the complete 33-letter Spanish/accents set');s.keyboard.press('Escape');s.wait_for_function('document.querySelector("#live-word-answer")===document.activeElement');check(s.locator('#live-word-answer').evaluate('(e)=>e===document.activeElement'),'closing letter clues restores the typed answer focus')
  call(tc,'/api/academy/share-list',{'classId':fix['classId'],'listId':lid})
  solo=call(sc,'/api/solo',{'classId':fix['classId'],'listId':lid,'mode':'word','category':'all'});s.evaluate('(v)=>sessionStorage.setItem("quizdock-session",JSON.stringify(v))',{'role':'student','pin':solo['pin'],'token':solo['playerToken'],'playerId':solo['playerId']});s.goto(BASE+'/play.html');s.locator('[data-act=start]').click();s.wait_for_selector('#live-word-answer');check(s.locator('#live-word-answer').evaluate('(e)=>e===document.activeElement'),'private solo Word Forge starts with an active text cursor');s.keyboard.insert_text(mapping[s.locator('.phase-heading').inner_text()]);s.wait_for_timeout(520);s.keyboard.press('Enter');s.wait_for_selector('[data-player-view=result]');dismiss(s);s.keyboard.press('Enter');s.wait_for_selector('#live-word-answer');check(s.locator('#live-word-answer').evaluate('(e)=>e===document.activeElement'),'Enter after a solo answer readies the next text field without a click')
  check(not errors,'new adventures have no uncaught browser errors: '+str(errors));b.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/new-adventures-results.json').write_text(json.dumps(RESULTS,indent=2))
