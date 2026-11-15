"""Real local UI, fake school Google identity; no production accounts or messages."""
from pathlib import Path
import json,os,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,path,data={}):
 response=ctx.request.post(BASE+path,data=data,headers={'Origin':BASE})
 if not response.ok:raise AssertionError(path+': '+response.text())
 return response.json()
def focused(page,selector):return page.locator(selector).evaluate('(el)=>el===document.activeElement')
def chord(page,letter):
 page.keyboard.press('g');page.keyboard.press(letter)
FAKE_GOOGLE='''window.google={accounts:{id:{initialize(c){window.__googleConfig=c},renderButton(container){const b=document.createElement('button');b.type='button';b.textContent='Sign in with Google';b.onclick=async()=>{const r=await fetch('/__test/google-credential',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nonce:window.__googleConfig.nonce,email:'keyboard.student@servitehs.org',name:'Servite Google Student'})});window.__googleConfig.callback(await r.json())};container.append(b)}}}};'''
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  teacher=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':900});teacher.request.get(BASE+'/__test/login?role=teacher')
  fix=teacher.request.get(BASE+'/__test/fixture').json();list_id=str(uuid.uuid4());cards=[{'type':'pair','prompt':'estrecho','answer':'tight; narrow'},{'type':'pair','prompt':'he spoke','answer':'habló'},{'type':'pair','prompt':'year','answer':'año'},{'type':'pair','prompt':'to learn','answer':'aprender'}]
  call(teacher,'/api/library/save',{'id':list_id,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Meaning and keyboard review','description':'Fake local browser fixture','cards':cards}})
  call(teacher,'/api/academy/share-list',{'classId':fix['classId'],'listId':list_id})
  assignment=call(teacher,'/api/academy/create-assignment',{'classId':fix['classId'],'listId':list_id,'title':'Meaning and keyboard review','dueLocal':'2026-11-20T23:59','rules':{'minMinutes':0,'minCards':4,'minAccuracy':100}})['assignment']
  t=teacher.new_page();errors=[];t.on('pageerror',lambda e:errors.append(str(e)));t.goto(BASE+'/');t.wait_for_selector('[data-act=host]')
  check(t.locator('[data-act=new-assignment],[data-act=assignment-report]').count()==0,'Arcade contains no assignment creation or submission cards')
  chord(t,'a');t.wait_for_selector('[data-act=new-assignment]');check(t.locator('h1').inner_text()=='Assignments' and 'view=assignments' in t.url,'G then A opens a separate top-level Assignments workspace')
  check(t.locator('[data-hub-view=assignments][aria-current=page]').count()==1,'Assignments has an active top navigation tab')
  t.locator('[data-act=new-assignment]').click();t.wait_for_selector('#assignment-form');check(t.locator('#assignment-form select[name=listId]').count()==1,'assignment creation remains available from Assignments');t.keyboard.press('Escape')
  t.go_back();t.wait_for_selector('[data-act=host]');check(t.locator('[data-act=new-assignment]').count()==0,'browser Back returns from Assignments to Arcade');t.go_forward();t.wait_for_selector('[data-act=new-assignment]')
  student=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844});student.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(content_type='application/javascript',body=FAKE_GOOGLE));s=student.new_page();s.on('pageerror',lambda e:errors.append(str(e)))
  s.goto(BASE+'/');s.get_by_role('button',name='Sign in with Google',exact=True).wait_for()
  check(s.locator('input[name=name],input[name=email],#student-class-code').count()==0,'school login asks for Google first without typed student identity')
  s.get_by_role('button',name='Sign in with Google',exact=True).click();s.wait_for_selector('#enroll-class-form')
  check('Servite Google Student' in s.locator('main').inner_text(),'verified school Google account supplies the student display name')
  home=call(student,'/api/academy/home');check(home['classes']==[] and home['assignments']==[],'new school sign-in grants no class or assignment access before enrollment')
  check(focused(s,'#enrollment-code'),'new student is prompted to enter a class code after Google sign-in')
  s.locator('#enrollment-code').fill('ZZZZZZZZZZ');s.locator('#enrollment-code').press('Enter');s.wait_for_function('document.querySelector("#notice").textContent.includes("unavailable")')
  check(s.locator('#enroll-class-form').is_visible(),'invalid class code keeps enrollment on screen for correction')
  s.locator('#enrollment-code').fill(fix['classCode']);s.locator('#enrollment-code').press('Enter');s.wait_for_selector('[data-act=tab]')
  member=next(m for m in call(teacher,'/api/academy/class-detail',{'classId':fix['classId']})['members'] if m['email']=='keyboard.student@servitehs.org')
  check(member['name']=='Servite Google Student','class roster name is collected automatically without teacher entry')
  check(s.locator('[data-act=practice]').count()==0,'student Arcade keeps graded assignments out of game and solo navigation')
  s.locator('h1').click();chord(s,'a');s.wait_for_selector('[data-act=practice]');s.locator(f'[data-act=practice][data-id="{assignment["id"]}"]').click();s.wait_for_selector('#typed-answer')
  requests=[];s.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1]) if '/api/academy/practice-' in r.url else None)
  prompts=[];meaning_count=0;previous=None;answers={c['prompt']:c['answer'] for c in cards}
  for i in range(8):
   prompt=s.locator('.study-prompt').inner_text();prompts.append(prompt);check(prompt!=previous,'graded shuffled card does not immediately repeat '+str(i+1))
   answer=answers[prompt]
   if prompt=='estrecho':answer=['tight','narrow'][meaning_count];meaning_count+=1
   if i==0:
    s.locator('#typed-answer').fill('');s.keyboard.type('g a?');check(s.locator('#typed-answer').input_value()=='g a?' and not s.locator('#keyboard-guide[open]').count(),'navigation chords and question marks remain ordinary text while typing')
    s.locator('#typed-answer').dispatch_event('keydown',{'key':'Enter','isComposing':True});check(requests.count('practice-answer')==0,'IME composition does not invoke a navigation shortcut')
   s.wait_for_timeout(550);s.locator('#typed-answer').fill(answer);s.locator('#typed-answer').press('Enter');s.wait_for_selector('[data-act=practice-next]')
   check('Correct.' in s.locator('.practice-feedback').inner_text(),'Enter checks the current shuffled answer on the server '+str(i+1))
   if i==0:
    s.keyboard.press('?');s.wait_for_selector('#keyboard-guide[open]');check('Assignments' in s.locator('#keyboard-guide').inner_text(),'question-mark shortcut opens a convenient navigation guide')
    s.locator('#keyboard-shortcuts-enabled').focus();s.keyboard.press('Enter');check(s.locator('#keyboard-guide[open]').count()==1 and requests.count('practice-next')==0,'Enter cannot advance graded work behind the guide')
    s.keyboard.press('Escape');check(focused(s,'.practice-feedback'),'closing the guide returns focus to the answer feedback')
    s.keyboard.down('Enter');s.wait_for_selector('#typed-answer');s.locator('#typed-answer').fill('kept draft');s.keyboard.down('Enter');s.wait_for_timeout(180);s.keyboard.up('Enter')
    check(requests.count('practice-answer')==1 and requests.count('practice-next')==1 and s.locator('#typed-answer').input_value()=='kept draft','held Enter advances once and cannot submit a restored next draft')
   else:s.keyboard.press('Enter');s.wait_for_selector('#typed-answer')
   check(focused(s,'#typed-answer'),'Enter after feedback focuses the next graded answer '+str(i+1));previous=prompt
  check(set(prompts[:4])==set(answers) and set(prompts[4:])==set(answers),'two graded shuffled passes each visit every card once')
  check(meaning_count==2,'both tight and narrow were accepted in real graded practice')
  report=call(teacher,'/api/academy/assignment-report',{'assignmentId':assignment['id']});row=next(r for r in report['students'] if r['email']=='keyboard.student@servitehs.org')
  check(row['progress']['answered']==8 and row['progress']['correct']==8 and row['progress']['accuracy']==100,'teacher assignment report retains exact graded totals after shuffled Enter navigation')
  check(not row['progress'].get('submittedAt') and s.locator('[data-act=practice-submit]').is_enabled(),'Enter progression never submits the whole assignment')
  check(all(c['correct']==2 and c['incorrect']==0 for c in report['cards']),'per-card grading follows original card IDs through shuffled passes')
  s.locator('#typed-answer').fill('draft survives navigation');s.locator('[data-act=back-home]').click();s.wait_for_function('document.querySelector("h1")?.textContent==="Assignments"')
  s.locator(f'[data-act=practice][data-id="{assignment["id"]}"]').click();s.wait_for_selector('#typed-answer');check(s.locator('#typed-answer').input_value()=='draft survives navigation','returning to Assignments preserves the active prompt and unsent draft')
  s.locator('[data-act=back-home]').click();s.wait_for_function('document.querySelector("h1")?.textContent==="Assignments"');s.locator('[data-keyboard-help]').click();s.locator('#keyboard-shortcuts-enabled').uncheck();s.keyboard.press('Escape');chord(s,'h');s.keyboard.press('?')
  check('view=assignments' in s.url and not s.locator('#keyboard-guide[open]').count(),'single-key shortcuts can be disabled from the guide')
  s.reload();s.wait_for_selector('[data-act=practice]');s.locator('[data-keyboard-help]').click();check(not s.locator('#keyboard-shortcuts-enabled').is_checked(),'shortcut preference persists on this device')
  s.locator('#keyboard-shortcuts-enabled').check()
  for width,height in [(320,568),(390,340),(667,375)]:
   s.set_viewport_size({'width':width,'height':height});s.locator('#keyboard-shortcuts-enabled').scroll_into_view_if_needed();box=s.locator('#keyboard-shortcuts-enabled').bounding_box();check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1') and box['y']>=0 and box['y']+box['height']<=height,'keyboard guide scrolls and fits '+str(width)+'x'+str(height))
  s.screenshot(path=str(ROOT/'checks/keyboard-guide-phone.png'),full_page=True);s.keyboard.press('Escape');s.set_viewport_size({'width':390,'height':844});s.locator('h1').click();chord(s,'h');s.wait_for_selector('[data-act=tab]')
  s.locator('[role=tab][data-act=tab][data-tab=practice]').click();s.locator(f'[data-act=solo][data-id="{list_id}"]').click();s.wait_for_selector('.flashcard');s.locator('h1').click();s.keyboard.press('Space');check(s.locator('.flashcard.answer-side').count()==1,'Space flips a solo flashcard without marking confidence')
  s.locator('[data-act=solo-mode][data-mode=type]').click();s.wait_for_selector('#solo-answer');prompt=s.locator('.study-prompt').inner_text();s.locator('#solo-answer').fill(answers[prompt].split(';')[0]);s.locator('#solo-answer').press('Enter');s.wait_for_selector('.solo-typed-feedback');s.keyboard.press('Enter');s.wait_for_selector('#solo-answer');check(focused(s,'#solo-answer'),'Enter also advances ungraded typed practice after feedback')
  check(call(student,'/api/academy/home')['user']['points']==0,'keyboard practice creates no wallet rewards')
  # A new school student arriving at a game PIN completes enrollment, then resumes that game.
  t.goto(BASE+'/');t.locator('[data-act=host]').first.click();t.locator('#host-form select[name=classId]').select_option(fix['classId']);t.locator('#host-form select[name=listId]').select_option(fix['listId']);t.locator('#host-form select[name=mode]').select_option('fishing');t.locator('#host-form button.btn.primary').click();t.wait_for_selector('.host-pin');pin=t.locator('.host-pin').inner_text()
  fresh=browser.new_context(ignore_https_errors=True,viewport={'width':320,'height':568});fresh.route('https://accounts.google.com/gsi/client',lambda route:route.fulfill(content_type='application/javascript',body=FAKE_GOOGLE.replace('keyboard.student@servitehs.org','pin.student@servitehs.org')));game=fresh.new_page();game.on('pageerror',lambda e:errors.append(str(e)))
  game.goto(BASE+'/play.html?join='+pin);game.locator('#join-form button').click();game.get_by_role('button',name='Sign in with Google',exact=True).click();game.wait_for_selector('#enroll-class-form');check(game.locator('#enrollment-code').is_visible(),'game PIN sign-in also prompts a new school student for a class code')
  game.locator('#enrollment-code').fill(fix['classCode']);game.locator('#enrollment-code').press('Enter');game.wait_for_selector('.game-shell');check('Servite Google Student' in game.locator('.player-hud').inner_text() and 'PIN '+pin in game.locator('.player-hud').inner_text(),'class enrollment automatically resumes the original game PIN with the Google name')
  t.locator('[data-act=start]').click();game.wait_for_selector('.answer');game.locator('[data-act=fullscreen]').click();game.wait_for_function('!!document.fullscreenElement');game.locator('[data-keyboard-help]').click();game.wait_for_selector('#keyboard-guide[open]');check(game.locator('#keyboard-guide-title').is_visible(),'shortcut guide is available during native mobile-sized fullscreen play');game.keyboard.press('Escape')
  if game.evaluate('!!document.fullscreenElement'):game.locator('[data-act=fullscreen]').click()
  game.locator('[data-keyboard-help]').focus();leave_dialogs=[]
  def stay_in_game(dialog):leave_dialogs.append(dialog.type);dialog.dismiss()
  game.once('dialog',stay_in_game);chord(game,'h');game.wait_for_timeout(150);check(leave_dialogs==['confirm'] and game.locator('.game-shell').count()==1,'Arcade hotkey retains the live game Leave confirmation')
  for path in ['/library.html','/reports.html','/data.html']:
   t.goto(BASE+path);t.bring_to_front();t.wait_for_selector('[data-keyboard-help]');t.keyboard.press('?');t.wait_for_selector('#keyboard-guide[open]');check('Assignments' in t.locator('#keyboard-guide').inner_text(),path+' has the shared shortcut guide and Assignments destination');t.keyboard.press('Escape');chord(t,'a');t.wait_for_function('document.querySelector("h1")?.textContent==="Assignments"')
  # Native link activation keeps the existing unsaved-editor beforeunload guard.
  t.goto(BASE+'/library.html');t.locator(f'[data-do=open][data-id="{list_id}"]').click();t.wait_for_selector('#auto-save');t.locator('#auto-save').uncheck();t.locator('#list-title').fill('Unsaved keyboard test draft');t.locator('header .brand').focus();dialogs=[]
  def cancel_leave(dialog):dialogs.append(dialog.type);dialog.dismiss()
  t.once('dialog',cancel_leave);chord(t,'a');t.wait_for_timeout(200)
  check(dialogs==['beforeunload'] and t.locator('#list-title').input_value()=='Unsaved keyboard test draft','navigation hotkeys respect unsaved library drafts')
  check(not errors,'practice, enrollment, navigation and guide have no uncaught browser errors');browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS)},indent=2))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/practice-navigation-results.json').write_text(json.dumps(RESULTS,indent=2))
