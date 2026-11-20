"""Weekly league flows with isolated test accounts; no production data."""
from pathlib import Path
import json,os,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,action,data={}):
 r=ctx.request.post(BASE+'/api/academy/'+action,data=data,headers={'Origin':BASE})
 if not r.ok:raise AssertionError(action+': '+r.text()[:200])
 return r.json()
def seed(ctx,previous=False):
 r=ctx.request.post(BASE+'/__test/league-fixture',data={'previous':previous});assert r.ok,r.text();return r.json()
def open_leagues(page):
 page.goto(BASE);page.locator('[role=tab][data-tab=leagues]').click();page.wait_for_selector('.weekly-leagues')
def run():
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  sc=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':900},reduced_motion='reduce');tc=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':900},reduced_motion='reduce')
  sc.request.get(BASE+'/__test/login?role=student');tc.request.get(BASE+'/__test/login?role=teacher');s=sc.new_page();t=tc.new_page();errors=[]
  for page in [s,t]:page.on('pageerror',lambda e:errors.append(str(e)))
  fix=sc.request.get(BASE+'/__test/fixture').json();seeded=seed(sc)
  open_leagues(s);check(s.locator('.league-row').count()==5,'student sees classmates in the weekly standings');check(s.locator('.league-rank').first.inner_text()=='#1','standings use readable numeric ranks');check(s.locator('.league-row.is-self').count()==1,'own standing is highlighted');check('100' in s.locator('.league-personal h3').inner_text(),'weekly XP is shown separately');check(s.locator('.league-player .avatar').count()==5,'custom avatars appear beside all names');check(s.locator('.league-tiers button').count()==8,'eight leagues are visible');check(s.locator('.league-row.is-self').get_attribute('data-league-zone')=='promotion','top student sees the promotion zone');check('America/Los_Angeles' in s.locator('.league-reset').inner_text(),'reset shows the class timezone');check(s.locator('[data-league-countdown]').inner_text()!='','reset countdown is visible');check(s.locator('#league-settings-form').count()==0,'students cannot change league settings')
  data=call(sc,'league-home',{'classId':fix['classId']});check(data['leaderboard'][0]['appearance']['equipment']['hat']==seeded['accessory'],'standings retain owned avatar accessories');check('@' not in json.dumps(data),'league payload excludes classmate emails')
  s.locator('[data-act=league-tier][data-tier="7"]').click();s.wait_for_function('document.querySelector(".league-hero h2").textContent==="Diamond League"');check(s.locator('.league-empty').count()==1,'empty upper league explains the next climb');check('100' in s.locator('.league-personal h3').inner_text(),'viewing another tier keeps personal XP visible')
  s.locator('[data-act=league-tier][data-tier="0"]').click();s.wait_for_selector('.league-row');s.locator('.league-rules summary').click();check('10 XP per correct answer' in s.locator('.league-rules').inner_text(),'XP earning rules are available beside the standings');check('Flipping flashcards earns no league XP' in s.locator('.league-rules').inner_text(),'flashcard and graded-answer rules are clear')
  for width,height in [(1366,768),(768,1024),(390,844),(320,568)]:
   s.set_viewport_size({'width':width,'height':height});check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'league page fits width '+str(width));s.locator('[data-act=league-refresh]').scroll_into_view_if_needed();check(s.locator('[data-act=league-refresh]').is_visible(),'refresh remains reachable at '+str(width));s.locator('.league-row').last.scroll_into_view_if_needed();check(s.locator('.league-row').last.is_visible(),'all standings remain reachable at '+str(width))
  s.screenshot(path=str(ROOT/'checks/leagues-phone.png'),full_page=True);s.set_viewport_size({'width':1366,'height':900});s.screenshot(path=str(ROOT/'checks/leagues-desktop.png'),full_page=True)
  open_leagues(t);check(t.locator('#league-settings-form').count()==1,'teacher has the class league control');t.locator('#league-settings-form [name=enabled]').uncheck();t.locator('#league-settings-form button').click();t.wait_for_selector('.league-paused');check(call(sc,'league-home',{'classId':fix['classId']})['enabled']==False,'teacher can pause league XP');check(call(sc,'league-home',{'classId':fix['classId']})['me']['xp']==100,'pausing preserves saved XP');t.locator('#league-settings-form [name=enabled]').check();t.locator('#league-settings-form button').click();t.wait_for_function('!document.querySelector(".league-paused")');check(call(sc,'league-home',{'classId':fix['classId']})['enabled'],'teacher can resume the league')
  for width,height in [(390,844),(320,568)]:
   t.set_viewport_size({'width':width,'height':height});check(t.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'teacher league controls fit width '+str(width));t.locator('#league-settings-form button').scroll_into_view_if_needed();check(t.locator('#league-settings-form button').is_visible(),'teacher league settings remain reachable at '+str(width))
  t.set_viewport_size({'width':1366,'height':900})
  denied=sc.request.post(BASE+'/api/academy/league-settings',data={'classId':fix['classId'],'enabled':False},headers={'Origin':BASE});check(denied.status==403,'server rejects student league administration')
  # Credit comes through the real graded route, not a client-supplied XP field.
  deck=call(sc,'solo-open',{'classId':fix['classId'],'listId':fix['listId']})['deck'];card=deck['cards'][0];answer={'classId':fix['classId'],'listId':fix['listId'],'cardId':card['id'],'answer':card['answer'],'mutationId':str(uuid.uuid4())}
  call(sc,'solo-answer',answer);call(sc,'solo-answer',answer);s.locator('[data-act=league-refresh]').click();s.wait_for_function('document.querySelector(".league-personal h3").textContent.includes("110")');check(call(sc,'league-home',{'classId':fix['classId']})['me']['xp']==110,'a real typed answer awards XP once across retries');check('190 character points' in s.locator('.balance').inner_text(),'league XP leaves the spending balance intact')
  candy_before=call(sc,'home')['studyRewards'][0]['completed']
  # A real private Word Forge round banks game XP at completion, not mid-round.
  created=sc.request.post(BASE+'/api/solo',data={'classId':fix['classId'],'listId':fix['listId'],'mode':'word','category':'all'},headers={'Origin':BASE});assert created.ok,created.text();solo=created.json()
  s.evaluate('(v)=>sessionStorage.setItem("quizdock-session",JSON.stringify(v))',{'role':'student','pin':solo['pin'],'token':solo['playerToken'],'playerId':solo['playerId']});s.goto(BASE+'/play.html');s.locator('[data-act=start]').click();s.wait_for_selector('#live-word-answer')
  mapping={c['prompt']:c['answer'] for c in deck['cards']};s.keyboard.insert_text(mapping[s.locator('.phase-heading').inner_text()]);s.wait_for_timeout(520);s.keyboard.press('Enter');s.wait_for_selector('[data-player-view=result]')
  check(call(sc,'league-home',{'classId':fix['classId']})['me']['xp']==110,'an unfinished round does not bank league XP')
  for dismiss in s.locator('.event-flash-dismiss:visible').all():dismiss.click()
  s.locator('[data-act=game-menu]').click();s.on('dialog',lambda dialog:dialog.accept());s.locator('#dialog [data-act=end]').click();s.wait_for_function('''async id=>(await(await fetch('/api/academy/league-home',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({classId:id})})).json()).me.xp===120''',arg=fix['classId'],polling=200);open_leagues(s);s.wait_for_function('document.querySelector(".league-personal h3").textContent.includes("120")')
  check(call(sc,'league-home',{'classId':fix['classId']})['me']['xp']==120,'a finished Word Forge round banks its real correct-answer XP');check(call(sc,'home')['studyRewards'][0]['completed']==candy_before+1,'game banking retains existing typed-practice candy accounting')
  # Simulate a saved prior week and a client countdown reaching its boundary.
  cached=call(sc,'league-home',{'classId':fix['classId']});prior=seed(sc,previous=True)
  def nearly_ended(route):
   body={**cached,'resetAt':cached['now']+1200,'week':prior['week']};route.fulfill(status=200,json=body)
  s.route('**/api/academy/league-home',nearly_ended,times=2);s.locator('[data-act=league-refresh]').click();s.wait_for_selector('[data-league-week="'+prior['week']+'"]');s.wait_for_function('document.querySelector(".league-hero h2")?.textContent==="Silver League"',timeout=15000)
  check('0 XP this week' in s.locator('.league-personal h3').inner_text(),'an open page automatically receives the new zero-XP week');check('Promoted to Silver!' in s.locator('.league-recap').inner_text(),'the new week celebrates the saved promotion');check(s.locator('.league-history').inner_text().find('1 active week')>=0,'weekly result is saved once');check(call(sc,'league-home',{'classId':fix['classId']})['me']['history'][0]['xp']==100,'previous weekly XP remains in personal history')
  s.locator('[data-act=league-refresh]').click();s.wait_for_function('document.querySelector(".league-hero h2")?.textContent==="Silver League"');check(len(call(sc,'league-home',{'classId':fix['classId']})['me']['history'])==1,'refresh does not promote or settle a week twice')
  # Switching classes must not retain another class's standings or tier filter.
  second=call(tc,'create-class',{'name':'Second league crew','timezone':'Pacific/Kiritimati'})['class'];call(sc,'join-class',{'code':second['code']});open_leagues(s);s.locator('#league-class').select_option(second['id']);s.wait_for_function('(id)=>document.querySelector("#league-class")?.value===id',arg=second['id']);check(s.locator('.league-row').count()==0,'class switch does not leak the previous class standings');check('Pacific/Kiritimati' in s.locator('.league-reset').inner_text(),'class switch uses the selected timezone')
  check(not errors,'league navigation has no uncaught browser errors: '+str(errors));browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/leagues-results.json').write_text(json.dumps(RESULTS,indent=2))
