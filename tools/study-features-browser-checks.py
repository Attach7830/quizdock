"""Custom hotkeys, category imports, graded Word Forge, private solo games, and candy accounting."""
from pathlib import Path
import json,os,re,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,path,data={}):
 r=ctx.request.post(BASE+path,data=data,headers={'Origin':BASE})
 if not r.ok:raise AssertionError(path+': '+r.text())
 return r.json()
def account(browser,role):
 c=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844},reduced_motion='reduce');c.request.get(BASE+'/__test/login?role='+role);return c
def guide(page):page.locator('[data-keyboard-help]').click();page.wait_for_selector('#keyboard-guide[open]')
def dismiss(page):
 for b in page.locator('.event-flash-dismiss:visible').all():b.click()
def open_study(page,list_id):
 page.goto(BASE+'/');page.locator('[role=tab][data-act=tab][data-tab=practice]').click();page.locator(f'[data-act=solo][data-id="{list_id}"]').click();page.wait_for_selector('.flashcard')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=account(browser,'teacher');sc=account(browser,'student');t=tc.new_page();s=sc.new_page();t.on('dialog',lambda d:d.accept());errors=[]
  for page in [t,s]:page.on('pageerror',lambda e:errors.append(str(e)))
  fix=tc.request.get(BASE+'/__test/fixture').json();list_id=str(uuid.uuid4());answers={'to learn':'aprender','he spoke':'habló','estrecho':'tight','country':'España','legacy':'old'}
  t.goto(BASE+'/library.html');t.locator('[data-do=import]').first.click();t.locator('#import-format').select_option('csv');t.locator('#import-text').fill('Prompt,Answer,Category\nto learn,aprender,Vocabulary\nhe spoke,habló,Grammar\nestrecho,tight; narrow,Grammar\ncountry,España,Culture\nlegacy,old,');t.locator('[data-do=preview-import]').click();t.locator('[data-do=apply-import]').click();t.wait_for_selector('#card-category');check(t.locator('#card-category').input_value()=='vocabulary','CSV Category values appear in the existing card editor')
  # Save under a deterministic test list ID through the real API, retaining the imported category shapes.
  cards=[{'type':'pair','prompt':q,'answer':'tight; narrow' if q=='estrecho' else a,**({'category':c} if c else {})} for q,a,c in [('to learn','aprender','vocabulary'),('he spoke','habló','grammar'),('estrecho','tight','grammar'),('country','España','culture'),('legacy','old','')]]
  call(tc,'/api/library/save',{'id':list_id,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Study feature fixture','cards':cards}});call(tc,'/api/academy/share-list',{'classId':fix['classId'],'listId':list_id})
  a=call(tc,'/api/academy/create-assignment',{'classId':fix['classId'],'listId':list_id,'title':'Word Forge assignment','dueLocal':'2026-12-18T23:59','rules':{'minMinutes':0,'minCards':2,'minAccuracy':0}})['assignment']
  t.goto(BASE+'/');t.locator('[data-act=tab][data-tab=rewards]').click();t.wait_for_selector('#study-reward-policy');check(t.locator('input[name=cardsPerReward]').input_value()=='100' and t.locator('input[name=semesterEnd]').input_value()=='2026-12-18','teacher sees default threshold and the requested semester date');t.locator('input[name=cardsPerReward]').fill('2');t.locator('#study-reward-policy button').click();t.wait_for_function('document.querySelector("#notice").textContent.includes("settings saved")')
  open_study(s,list_id);s.locator('#solo-category').select_option('grammar');s.wait_for_function('document.querySelector("#solo-category").value==="grammar"&&document.querySelector(".pill")?.textContent.includes("/ 2")');check(' / 2' in s.locator('.study-shell .pill').inner_text(),'independent practice filters to just Grammar cards')
  guide(s)
  for action,key in [('next','n'),('flip','f'),('known','k'),('again','j'),('check','Ctrl+Shift+Enter')]:s.locator('#shortcut-'+action).fill(key)
  s.locator('#shortcut-settings button[type=submit]').click();check(s.locator('.shortcut-settings-saved').inner_text()=='Hotkeys saved.','custom hotkeys save from the convenient guide')
  s.locator('#shortcut-next').fill('f');s.locator('#shortcut-settings button[type=submit]').click();check('Two actions' in s.locator('.shortcut-settings-error').inner_text(),'duplicate bindings are rejected without replacing saved keys');s.keyboard.press('Escape');s.locator('h1').click();s.keyboard.press('f');check(s.locator('.flashcard.answer-side').count()==1,'custom flip key works in flashcard mode');s.keyboard.press('k');check(s.locator('.flashcard.answer-side').count()==0,'custom known key advances a shuffled flashcard');check(call(sc,'/api/academy/home')['studyRewards'][0]['completed']==0,'flashcard hotkeys cannot earn Jolly Ranchers')
  s.locator('[data-act=solo-mode][data-mode=type]').click()
  for i in range(2):
   s.wait_for_selector('#solo-answer');q=s.locator('.study-prompt').inner_text();s.wait_for_timeout(550);s.locator('#solo-answer').fill(answers[q]);s.locator('#solo-answer').press('Control+Shift+Enter');s.wait_for_selector('.solo-typed-feedback');check('Correct!' in s.locator('.solo-typed-feedback').inner_text(),'custom check key grades typed independent practice '+str(i+1))
   if i==0:s.keyboard.press('n')
  rewards=call(sc,'/api/academy/home')['studyRewards'][0];check(rewards['completed']==2 and rewards['available']==1 and rewards['points']==0,'two typed questions earn exactly one reward at the teacher threshold');check(rewards['awards'][0]['expiresAt']-rewards['awards'][0]['earnedAt']==30*86400000,'earned candy has an exact 30-day expiry')
  s.reload();s.wait_for_selector('[data-act=tab]');guide(s);check(s.locator('#shortcut-next').input_value()=='n','custom hotkeys survive reloads');s.locator('#keyboard-shortcuts-enabled').uncheck();s.locator('[data-restore-shortcuts]').click();check(s.locator('#shortcut-next').input_value()=='Enter' and s.locator('#shortcut-flip').input_value()=='Space' and s.locator('#keyboard-shortcuts-enabled').is_checked(),'Restore defaults restores next and flashcard keys');s.keyboard.press('Escape')
  s.locator('header [data-hub-view=assignments]').click();s.locator(f'[data-act=practice][data-id="{a["id"]}"]').click();s.wait_for_selector('#typed-answer');check(s.locator('#solo-category').count()==0,'assignment practice offers no category filter');s.locator('[data-act=practice-mode][data-mode=word]').click();s.wait_for_selector('.assignment-forge-clues');s.locator('[data-act=practice-letter]').first.click();s.wait_for_timeout(100);check(call(tc,'/api/academy/assignment-report',{'assignmentId':a['id']})['students'][0]['progress']['answered']==0,'Word Forge letter clues are not graded answers')
  q=s.locator('.study-prompt').inner_text();s.locator('#typed-answer').fill(answers[q]);s.locator('#typed-answer').press('Enter');s.wait_for_selector('[data-act=practice-next]');check(s.locator('#practice-game-scene canvas').is_visible(),'Word Forge assignment feedback shows the game animation');s.keyboard.press('Enter');s.wait_for_selector('#typed-answer');check(s.locator('.assignment-forge-clues').is_visible(),'Enter loads the next Word Forge assignment prompt')
  row=next(r for r in call(tc,'/api/academy/assignment-report',{'assignmentId':a['id']})['students'] if r['email']=='alex@example.com');check(row['progress']['answered']==1 and row['progress']['correct']==1,'alternative assignment presentation preserves exact server grading');check(call(sc,'/api/academy/home')['studyRewards'][0]['completed']==2,'graded Word Forge homework does not earn candy')
  # Browser focus boundaries send inactive heartbeats immediately.
  beats=[];s.on('request',lambda r:beats.append(r.post_data_json) if r.url.endswith('/practice-tick') else None);s.evaluate("window.originalHasFocus=document.hasFocus;document.hasFocus=()=>false;dispatchEvent(new Event('blur'))");s.wait_for_timeout(150);check(any(not b['focused'] and not b['active'] for b in beats),'a simulated browser focus loss sends an immediate inactive heartbeat');s.evaluate("document.hasFocus=window.originalHasFocus;dispatchEvent(new Event('focus'))");s.wait_for_timeout(200);timer=s.locator('#requirements .metric>b').first;start=timer.inner_text();s.wait_for_function("previous=>document.querySelector('#requirements .metric>b').textContent!==previous",arg=start,timeout=2500);check(True,'assignment active time visibly updates each second between saved heartbeats')
  t.reload();t.locator('[data-act=tab][data-tab=rewards]').click();t.wait_for_selector('[data-act=claim-study-reward]');t.locator('[data-act=claim-study-reward]').first.click();t.wait_for_function('!document.querySelector("[data-act=claim-study-reward]")');check(call(sc,'/api/academy/home')['studyRewards'][0]['claimed']==1,'teacher claim is saved in the student account')
  # Each solo-compatible game uses the existing game engine and its own private room.
  for mode in ['treasure','fishing','battle','factory','rally','keep','word']:
   s.goto(BASE+'/');s.locator('[role=tab][data-act=tab][data-tab=practice]').click();s.locator(f'[data-act=solo-game-picker][data-id="{list_id}"]').click();s.wait_for_selector('#solo-game-form');check(s.locator('#solo-game-form select[name=mode] option').count()==7,'solo picker includes seven compatible games: '+mode);s.locator('#solo-game-form select[name=mode]').select_option(mode)
   if mode=='word':s.locator('#solo-game-form select[name=category]').select_option('vocabulary')
   s.locator('#solo-game-form button').click();s.wait_for_selector('[data-act=start]');s.locator('[data-act=start]').click();s.wait_for_selector('[data-player-view=question],[data-player-view=roles]')
   if mode in ['rally','keep']:s.locator('[data-act=role]').first.click();s.wait_for_selector('.answer')
   if mode=='word':s.locator('#live-word-answer').fill('aprender');s.locator('#live-word-answer').press('Enter')
   else:
    q=s.locator('.phase-heading').inner_text();s.locator('.answer').filter(has=s.get_by_text('tight; narrow' if q=='estrecho' else answers[q],exact=True)).click()
   s.wait_for_selector('[data-player-view=result]');dismiss(s);check(s.locator('.game-scene canvas').is_visible(),'solo game rewards render through the existing engine: '+mode)
   s.locator('[data-act=game-menu]').click();s.locator('#dialog [data-act=pause]').click();s.wait_for_selector('[data-player-view=paused]');s.locator('[data-act=resume]').click();s.wait_for_selector('[data-player-view=result]');s.locator('[data-act=game-menu]').click();s.locator('#dialog [data-act=end]').click();s.wait_for_selector('[data-player-view=result] [data-act=start]')
   check('Play again' in s.locator('[data-player-view=result] [data-act=start]').inner_text(),'student controls pause, resume, end and replay: '+mode)
  final=call(sc,'/api/academy/home')
  check(final['studyRewards'][0]['completed']==3,'only the solo typed game adds candy progress')
  check(not final['liveGames'] and final['user']['points']==190,'solo games leave class rooms and game currency unchanged')
  s.screenshot(path=str(ROOT/'checks/solo-word-forge-phone.png'))
  long_id=str(uuid.uuid4())
  long_answers=[('Answer '+str(i)+' · '+('a detailed vocabulary definition with accents áéíóúñ. '*5))[:180].strip() for i in range(4)]
  long_prompt=('Read this full teacher-authored prompt carefully. '*9)[:400].strip()
  call(tc,'/api/library/save',{'id':long_id,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Long content fixture','cards':[{'type':'choice','prompt':long_prompt,'choices':long_answers,'correct':[0]}]}})
  call(tc,'/api/academy/share-list',{'classId':fix['classId'],'listId':long_id})
  solo=call(sc,'/api/solo',{'classId':fix['classId'],'listId':long_id,'mode':'treasure'})
  s.evaluate('(r)=>sessionStorage.setItem("quizdock-session",JSON.stringify({role:"student",pin:r.pin,token:r.playerToken,playerId:r.playerId}))',solo)
  s.goto(BASE+'/play.html')
  s.wait_for_selector('[data-act=start]')
  s.locator('[data-act=start]').click()
  s.wait_for_selector('.answer')
  s.set_viewport_size({'width':320,'height':568})
  s.wait_for_timeout(100)
  s.locator('[data-act=read-question]').click()
  s.wait_for_selector('.game-reader[open]')
  content=s.locator('.reader-pages').text_content()
  check(long_prompt in content and all(a in content for a in long_answers),'valid long prompts and all 180-character answers are available in the full reading view')
  s.locator('[data-reader-next]').click()
  check(s.locator('[data-reader-count]').inner_text().startswith('Page 2'),'long content has working reading-page controls')
  s.keyboard.press('Escape')
  wrong=next(a for a in s.locator('.answer span').all_inner_texts() if a!=long_answers[0])
  s.locator('.answer').filter(has=s.get_by_text(wrong,exact=True)).click()
  s.wait_for_selector('[data-player-view=result]')
  dismiss(s)
  s.wait_for_selector('[data-act=read-feedback]:visible')
  s.locator('[data-act=read-feedback]').click()
  check(long_answers[0] in s.locator('.reader-pages').text_content(),'a long correct answer remains fully readable after an incorrect submission')
  s.keyboard.press('Escape')
  guide(s)
  check(s.locator('#shortcut-next').bounding_box()['width']>=120,'custom hotkey text fields have readable full-width controls on a phone')
  s.screenshot(path=str(ROOT/'checks/custom-hotkeys-phone.png'))
  s.keyboard.press('Escape')
  check(not errors,'expanded study flows have no browser JavaScript errors')
  s.screenshot(path=str(ROOT/'checks/long-question-feedback-phone.png'))
  browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/study-features-results.json').write_text(json.dumps(RESULTS,indent=2))
