"""Real demo import and reversible student access; isolated fake accounts only."""
from pathlib import Path
import csv,json,os,shutil,uuid
from playwright.sync_api import sync_playwright
from crossword_browser_helpers import start_crossword,choose_clue,fill_grid,word_value,check_grid
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,action,data={},section='academy'):
 r=ctx.request.post(BASE+'/api/'+section+'/'+action,data=data,headers={'Origin':BASE})
 if not r.ok:raise AssertionError(action+': '+r.text()[:200])
 return r.json()
def run():
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=b.new_context(ignore_https_errors=True,viewport={'width':1366,'height':768});sc=b.new_context(ignore_https_errors=True,viewport={'width':1366,'height':768});tc.request.get(BASE+'/__test/login?role=teacher');sc.request.get(BASE+'/__test/login?role=student');t,s=tc.new_page(),sc.new_page();errors=[]
  for page in [t,s]:page.on('pageerror',lambda e:errors.append(str(e)))
  fixture=tc.request.get(BASE+'/__test/fixture').json();file=ROOT/'public/examples/QuizDock-Demo-Unit-Ropa-Gramatica-Cultura.csv';mapping={r['Question Text']:r['Correct Answer'] for r in csv.DictReader(file.read_text(encoding='utf-8-sig').splitlines())}
  t.goto(BASE+'/library.html');t.locator('[data-do=new]').first.click();t.wait_for_selector('#list-title');t.locator('[data-do=import]').first.click()
  with t.expect_download() as download:t.locator('#import-dialog a[download]').click()
  check(Path(download.value.path()).read_bytes()==file.read_bytes(),'demo download is the exact UTF-8 uploadable unit')
  t.locator('#import-file').set_input_files(str(file));t.wait_for_selector('#import-apply:not([hidden])');check('30 valid cards' in t.locator('.import-summary').inner_text(),'actual demo file imports 30 valid cards');check('0 rejected rows' in t.locator('.import-summary').inner_text(),'demo has no rejected rows')
  t.locator('[data-do=apply-import]').click();t.locator('#list-title').fill('Demo Spanish unit');t.locator('[data-do=save]').click();t.wait_for_selector('#save-status.saved')
  lists=call(tc,'lists',section='library')['lists'];lid=next(x['id'] for x in lists if x['title']=='Demo Spanish unit');deck=call(tc,'get',{'id':lid},'library')['list'];check(len(deck['cards'])==30,'saving imported unit retains all 30 cards');check(set(x['category'] for x in deck['cards'])=={'grammar','vocabulary','culture'},'all three category tags survive saving')
  call(tc,'share-list',{'classId':fixture['classId'],'listId':lid});a=call(tc,'create-assignment',{'classId':fixture['classId'],'listId':lid,'title':'Demo crossword assignment','dueLocal':'2026-12-18T23:59','rules':{'minMinutes':0,'minCards':1,'minAccuracy':100,'crosswordWords':12}})['assignment'];aid=a['id'];card=f'[data-assignment-card="{aid}"]';visibility=f'[data-act=assignment-visibility][data-id="{aid}"]'
  def open_grid():
   s.goto(BASE+'/?view=assignments');s.locator(f'[data-act=practice][data-id="{aid}"]').click();s.locator('[data-mode=crossword]').click();start_crossword(s);s.wait_for_selector('[data-crossword-3d-input]:visible')
  open_grid();puzzle=s.locator('.crossword-direct').get_attribute('data-puzzle-id');check(s.locator('[data-cw=clue]').count()==12,'demo creates a twelve-word 3D assignment');first=s.locator('[data-cw=clue]').first.get_attribute('data-entry');choose_clue(s,first);answer=mapping[s.locator('[data-cw-current-clue]').inner_text()];s.keyboard.insert_text(answer);s.wait_for_function('document.querySelector("[data-cw-save]")?.textContent==="Letters saved"');draft=word_value(s,first)
  check(s.locator('.crossword-clue-mark').count()==0,'demo drafts remain unmarked until the whole puzzle is checked');s.screenshot(path=str(ROOT/'checks/demo-crossword-3d.png'))
  t.goto(BASE+'/?view=assignments');t.wait_for_selector(visibility);check(t.locator(visibility).count()==1,'teacher has Remove from students on each assignment');check(s.locator('[data-act=assignment-visibility]').count()==0,'students have no removal controls')
  requests=[];t.on('request',lambda r:requests.append(r.url) if '/api/academy/assignment-visibility' in r.url else None)
  t.once('dialog',lambda d:d.dismiss());t.locator(visibility).click();check(len(requests)==0 and t.locator(card).count()==1,'canceling removal makes no write request')
  t.once('dialog',lambda d:d.accept());t.locator(visibility).click();t.wait_for_selector(card,state='detached');check(len(requests)==1,'confirmed removal writes once and hides the assignment from the default teacher view')
  s.goto(BASE+'/?view=assignments');s.wait_for_selector('[data-assignment-card]');check(s.locator(card).count()==0,'removed assignment disappears from student assignments');s.goto(BASE+'/');s.wait_for_selector('[data-act=tab][data-tab=practice]');check(s.locator(card).count()==0,'removed assignment disappears from the student homepage')
  denied=sc.request.post(BASE+'/api/academy/practice-open',data={'assignmentId':aid},headers={'Origin':BASE});check(denied.status==404,'direct practice access is blocked while removed')
  t.locator('#show-removed-assignments').check();check('Removed from students' in t.locator(card).inner_text(),'Show removed assignments exposes a clearly labeled recovery card');check(t.locator(card+' [data-act=assignment-edit]').count()==0,'removed assignment must be restored before editing')
  t.locator(card+' [data-act=assignment-report]').click();t.wait_for_selector('[data-assignment-live-report]');check('1 / 12 correct' in t.locator('[data-report-students] tr').filter(has_text='Alex Rivera').inner_text(),'teacher retains private live crossword counts after removal');t.keyboard.press('Escape')
  t.once('dialog',lambda d:d.accept());t.locator(visibility).click();t.wait_for_function('(id)=>document.querySelector(`[data-assignment-card="${id}"]`)?.textContent.includes("Remove from students")',arg=aid);open_grid();check(s.locator('.crossword-direct').get_attribute('data-puzzle-id')==puzzle and word_value(s,first)==draft,'restoring preserves the personal puzzle and autosaved letters')
  s.locator('[data-cw=focus-word]').click();s.screenshot(path=str(ROOT/'checks/demo-crossword-focus.png'));check(s.locator('[data-cw=focus-word]').get_attribute('aria-pressed')=='true','Focus word isolates the selected entry while it remains typeable');s.locator('[data-cw=focus-word]').click();fill_grid(s,mapping);check_grid(s);s.locator('[data-act=practice-submit]').click();s.wait_for_selector('.practice-submitted');check('100% credit earned' in s.locator('.practice-submitted').inner_text(),'demo crossword can be completed for assignment credit')
  t.bring_to_front();t.once('dialog',lambda d:d.accept());t.locator(visibility).click();t.wait_for_function('(id)=>document.querySelector(`[data-assignment-card="${id}"]`)?.textContent.includes("Restore for students")',arg=aid);t.locator(card+' [data-act=assignment-report]').click();t.wait_for_selector('[data-assignment-live-report]')
  with t.expect_download() as download:t.locator('[data-act=assignment-csv]').click()
  grades=list(csv.DictReader(Path(download.value.path()).read_text().splitlines()));grade=next(x for x in grades if x['Email']=='alex@example.com');check(grade['Credit %']=='100' and grade['Correct']=='12','removed assignment still exports its submitted grade and counted answers');t.keyboard.press('Escape');t.once('dialog',lambda d:d.accept());t.locator(visibility).click();t.wait_for_function('(id)=>document.querySelector(`[data-assignment-card="${id}"]`)?.textContent.includes("Remove from students")',arg=aid)
  t.goto(BASE+'/');t.locator('[data-act=tab][data-tab=classes]').first.click();t.locator(f'[data-act=roster][data-class="{fixture["classId"]}"]').click();row=f'[data-class-list="{lid}"]';share=row+' [data-act=class-list-visibility]';t.wait_for_selector(row);check('Shared with students' in t.locator(row).inner_text(),'class roster lists each shared study deck')
  t.once('dialog',lambda d:d.dismiss());t.locator(share).click();check(any(x['listId']==lid for x in call(sc,'home')['sharedLists']),'canceling list removal keeps student access');t.once('dialog',lambda d:d.accept());t.locator(share).click();t.wait_for_function('(id)=>document.querySelector(`[data-class-list="${id}"]`)?.textContent.includes("Removed from students")',arg=lid)
  home=call(sc,'home');check(not any(x['listId']==lid for x in home['sharedLists']),'removed shared deck disappears from student solo study');check(any(x['id']==aid for x in home['assignments']),'removing solo study access keeps the independent assignment snapshot available');check(len(call(tc,'get',{'id':lid},'library')['list']['cards'])==30,'removing a shared deck keeps the private teacher list')
  t.set_viewport_size({'width':320,'height':568});t.locator(share).scroll_into_view_if_needed();check(t.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'class content removal fits a narrow phone');check(t.locator(share).is_visible(),'restore remains reachable through normal dialog scrolling');t.screenshot(path=str(ROOT/'checks/class-content-removal-phone.png'));t.once('dialog',lambda d:d.accept());t.locator(share).click();t.wait_for_function('(id)=>document.querySelector(`[data-class-list="${id}"]`)?.textContent.includes("Shared with students")',arg=lid);check(any(x['listId']==lid for x in call(sc,'home')['sharedLists']),'restoring the shared snapshot returns student study access')
  check(not errors,'demo import, removal, restore and 3D practice have no uncaught browser errors: '+str(errors));b.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/content-removal-results.json').write_text(json.dumps(RESULTS,indent=2))
