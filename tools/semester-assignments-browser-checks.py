"""Current-semester homepage and real late submissions, using isolated fake accounts."""
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
import csv,json,os,shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,action,data={}):
 response=ctx.request.post(BASE+'/api/academy/'+action,data=data,headers={'Origin':BASE});check(response.ok,action+' succeeds');return response.json()
def homepage(page):page.goto(BASE+'/');page.wait_for_selector('#home-assignments')
def answer(page):
 prompt=page.locator('.study-prompt').inner_text();expected={'How do you say “to learn”?':'aprender','He spoke yesterday.':'habló','Look at the picture. ¿Qué ves?':'una casa'}.get(prompt,'una biblioteca');page.locator('#typed-answer').fill(expected);page.locator('#typed-answer').press('Enter');page.wait_for_selector('[data-act=practice-next]');page.wait_for_function('!document.querySelector("[data-act=practice-submit]").disabled')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  def account(role):
   ctx=browser.new_context(ignore_https_errors=True,viewport={'width':1366,'height':900},reduced_motion='reduce');ctx.request.get(BASE+'/__test/login?role='+role);return ctx
  tc,sc=account('teacher'),account('student');t,s=tc.new_page(),sc.new_page();errors=[]
  for page in [t,s]:page.on('pageerror',lambda error:errors.append(str(error)))
  fix=tc.request.get(BASE+'/__test/fixture').json();today=datetime.fromtimestamp(call(tc,'home')['now']/1000,ZoneInfo('America/Los_Angeles')).date();day=lambda offset:(today+timedelta(days=offset)).isoformat()
  t.goto(BASE+'/');t.locator('[role=tab][data-tab=classes]').click();t.locator('[data-act=semester-settings]').first.click();t.wait_for_selector('#semester-form');check(t.locator('#semester-form [name=start]').input_value()=='2026-08-10' and t.locator('#semester-form [name=end]').input_value()=='2026-12-18','teacher sees the supplied August 10 to December 18 semester dates')
  t.locator('#semester-form [name=start]').fill(day(-30));t.locator('#semester-form [name=end]').fill(day(30));t.locator('#semester-form button').click();t.wait_for_function('!document.querySelector("#dialog").open');t.wait_for_function('(start)=>document.querySelector(".course-semester")?.textContent.includes(start)',arg=day(-30));check(day(-30) in t.locator('.course-semester').first.inner_text(),'teacher can save a class-specific assignment semester')
  def assign(title,offset,class_id=fix['classId']):return call(tc,'create-assignment',{'classId':class_id,'listId':fix['listId'],'title':title,'dueLocal':day(offset)+'T23:59','rules':{'minMinutes':0,'minCards':1,'minAccuracy':100}})['assignment']
  late=assign('Overdue typed review',-1);word=assign('Overdue Word Forge review',-2);upcoming=assign('Upcoming review',1);finished=assign('Complete this on time',2);old=assign('Previous semester review',-45);future=assign('Next semester review',45)
  private=call(tc,'create-class',{'name':'Private teacher class'})['class'];hidden=assign('Not linked to this student',1,private['id'])
  homepage(s);section=s.locator('#home-assignments')
  for a in [late,word,upcoming,finished]:check(section.locator('[data-assignment-card="'+a['id']+'"]').count()==1,'current semester lists '+a['title'])
  for a in [old,future,hidden]:check(section.locator('[data-assignment-card="'+a['id']+'"]').count()==0,'homepage excludes '+a['title'])
  check(all('half credit (50%)' in section.locator('[data-assignment-card="'+a['id']+'"]').inner_text() for a in [late,word]),'each overdue card explains the half-credit offer')
  ordered=section.locator('[data-assignment-card]').evaluate_all('(cards)=>cards.map(card=>card.dataset.assignmentCard)');check(ordered.index(word['id'])<ordered.index(late['id'])<ordered.index(upcoming['id']),'overdue and upcoming assignments are combined in due-date order')
  for width in [320,390,768,1366]:
   s.set_viewport_size({'width':width,'height':844});check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'homepage assignments fit '+str(width)+'px')
  s.set_viewport_size({'width':390,'height':844});section.evaluate('(el)=>el.scrollIntoView({block:"start"})');s.screenshot(path=str(ROOT/'checks/home-assignments-phone.png'));s.set_viewport_size({'width':1366,'height':900});section.evaluate('(el)=>el.scrollIntoView({block:"start"})');s.screenshot(path=str(ROOT/'checks/home-assignments-desktop.png'))
  section.locator('[data-act=practice][data-id="'+finished['id']+'"]').click();s.wait_for_selector('#typed-answer');check('view=assignments' in s.url and s.locator('[data-hub-view=assignments][aria-current=page]').count()==1,'homepage shortcut opens graded practice inside the Assignments workspace');answer(s);s.locator('[data-act=practice-submit]').click();s.wait_for_selector('.practice-earned-credit');check('100% credit earned' in s.locator('.practice-earned-credit').inner_text(),'on-time completion records full credit');homepage(s);check(s.locator('#home-assignments [data-assignment-card="'+finished['id']+'"]').count()==0,'submitted assignments leave the homepage to-do list')
  for a,mode in [(late,'type'),(word,'word')]:
   s.locator('#home-assignments [data-act=practice][data-id="'+a['id']+'"]').click();s.wait_for_selector('#typed-answer')
   if mode=='word':s.locator('[data-act=practice-mode][data-mode=word]').click();s.wait_for_selector('[data-practice-mode=word]')
   check('50% credit' in s.locator('.practice-due').inner_text(),'late-credit rule remains visible in '+mode+' practice');answer(s);s.locator('[data-act=practice-submit]').click();s.wait_for_selector('.practice-earned-credit');check('50% credit earned' in s.locator('.practice-earned-credit').inner_text(),'late '+mode+' completion records half credit');homepage(s);check(s.locator('#home-assignments [data-assignment-card="'+a['id']+'"]').count()==0,'late '+mode+' submission leaves the homepage list')
  report=call(tc,'assignment-report',{'assignmentId':late['id']});student=next(row for row in report['students'] if row['email']=='alex@example.com');check(student['progress']['accuracy']==100 and student['progress']['creditPercent']==50,'teacher report keeps accuracy and assignment credit separate')
  t.goto(BASE+'/?view=assignments');t.locator('[data-act=assignment-report][data-id="'+late['id']+'"]').click();t.wait_for_selector('#dialog[open] tbody');row=t.locator('#dialog tbody tr').filter(has_text='Alex Rivera').first;check(row.locator('td').last.inner_text()=='50%','teacher submission table shows the awarded credit')
  with t.expect_download() as download:t.locator('[data-act=assignment-csv]').click()
  rows=list(csv.DictReader(Path(download.value.path()).read_text().splitlines()));row=next(row for row in rows if row['Email']=='alex@example.com');check(row['Credit %']=='50' and row['Accuracy %']=='100.00','grade CSV exports half credit without overwriting answer accuracy');t.keyboard.press('Escape')
  s.goto(BASE+'/?view=assignments');s.wait_for_selector('[data-assignment-card]');check(s.locator('[data-assignment-card="'+old['id']+'"]').count()==1 and s.locator('[data-assignment-card="'+future['id']+'"]').count()==1,'full Assignments workspace retains previous and future semester records')
  t.goto(BASE+'/');t.locator('[role=tab][data-tab=classes]').click();t.locator('[data-act=semester-settings][data-class="'+fix['classId']+'"]').click();t.locator('#semester-form [name=end]').fill(day(60));t.locator('#semester-form button').click();t.wait_for_function('!document.querySelector("#dialog").open');homepage(s);check(s.locator('#home-assignments [data-assignment-card="'+future['id']+'"]').count()==1,'teacher date changes immediately control the homepage semester filter');check(next(row for row in call(tc,'assignment-report',{'assignmentId':late['id']})['students'] if row['email']=='alex@example.com')['progress']['creditPercent']==50,'semester changes preserve earned submission credit')
  check(not errors,'homepage, semester settings, both practice modes and export have no uncaught browser errors');browser.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(item['passed'] for item in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/semester-assignments-results.json').write_text(json.dumps(RESULTS,indent=2))
