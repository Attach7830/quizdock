"""Release regression checks. Fake local accounts, real application modules; no production writes."""
from pathlib import Path
import importlib.util,json,time,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base_checks',ROOT/'tools/browser-checks.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.PRELUDE=b.PRELUDE.replace("init.body?JSON.parse(init.body):{},false", "init.body?JSON.parse(init.body):null,false")
checks=[]
def check(ok,name):
 checks.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(path,p={},role='teacher'):
 r=b.http(path,p,b.COOKIES[role]);check(r['status']==200,path+' status');return json.loads(r['body'])

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  teacher=b.page_for(browser,'data-ui.js','teacher',(390,844));teacher.wait_for_selector('#backup-form')
  check('Automatic cleanup is off' in teacher.locator('body').inner_text(),'retention defaults to off')
  check(teacher.locator('a[href="/data.html"]').count()>0,'data controls discoverable in navigation')
  for width,height in [(320,568),(390,844),(844,390),(360,340),(1440,900)]:
   teacher.set_viewport_size({'width':width,'height':height});teacher.wait_for_timeout(50)
   check(teacher.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'data page horizontal fit {width}x{height}')
   teacher.locator('[data-do=diagnostics]').scroll_into_view_if_needed();box=teacher.locator('[data-do=diagnostics]').bounding_box()
   check(box['y']>=0 and box['y']+box['height']<=height+1,f'data controls reachable {width}x{height}')
  teacher.locator('[data-do=diagnostics]').click();teacher.wait_for_function('document.querySelector("#diagnostics").textContent.includes("classroom-release")')
  diag=json.loads(teacher.locator('#diagnostics').inner_text());check(diag['storageReadWrite'] is True,'storage diagnostics succeeds');check(diag['actualEmailDelivery']=='not-tested','diagnostics does not claim delivery')
  with teacher.expect_download() as event:teacher.locator('#backup-form button').click()
  file=event.value;file.save_as(ROOT/'checks/fake-workspace-backup.json');bundle=json.loads((ROOT/'checks/fake-workspace-backup.json').read_text(encoding='utf-8-sig'))
  check(bool(bundle.get('signature')),'backup download is signed');check(not any(k.startswith(('session:','code:','student-code:')) for k,v in bundle['payload']['records']),'backup excludes authentication records')
  teacher.locator('#restore-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(bundle).encode()});teacher.wait_for_selector('#restore-form:not([hidden])')
  check('missing records' in teacher.locator('#restore-preview').inner_text(),'restore previews before mutation')
  teacher.locator('#restore-form input').fill('RESTORE MISSING RECORDS');teacher.locator('#restore-form button').click();teacher.wait_for_timeout(200)
  check(teacher.locator('#restore-form').is_hidden(),'confirmed restore completes without overwrites')
  tampered=json.loads(json.dumps(bundle));tampered['payload']['createdAt']-=1
  teacher.locator('#restore-file').set_input_files({'name':'changed.json','mimeType':'application/json','buffer':json.dumps(tampered).encode()});teacher.wait_for_timeout(200)
  check('signature is invalid' in teacher.locator('#notice').inner_text(),'modified backup is refused')
  teacher.locator('[data-do=preview-retention]').click();teacher.wait_for_timeout(150)
  check('Nothing has been deleted' in teacher.locator('#retention-preview').inner_text(),'retention preview is non-destructive')
  teacher.locator('#retention-form input[name=confirm]').fill('SAVE RETENTION POLICY');teacher.locator('#retention-form button.btn.primary').click();teacher.wait_for_timeout(200)
  check(not teacher.locator('#retention-form input[name=enabled]').is_checked(),'saving disabled retention leaves cleanup off')
  teacher.set_viewport_size({'width':390,'height':844});teacher.screenshot(path=str(ROOT/'checks/data-privacy-phone.png'),full_page=True)
  # Distinct-card setting is a genuine teacher-facing option, not just an API field.
  portal=b.page_for(browser,'academy-ui.js','teacher',(390,844));portal.locator('header [data-hub-view=assignments]').click();portal.wait_for_selector('[data-act=new-assignment]');portal.locator('[data-act=new-assignment]').first.click();portal.wait_for_selector('select[name=cardCountMode]')
  check(portal.locator('select[name=cardCountMode] option').count()==2,'teacher can choose distinct cards or attempts');portal.keyboard.press('Escape');portal.close()
  # Keyboard-sized viewport: typed input and submit remain reachable, accent controls work.
  student=b.page_for(browser,'academy-ui.js','other',(390,844));student.locator('header [data-hub-view=assignments]').click();student.wait_for_selector('[data-act=practice]');student.locator('[data-act=practice]').first.click();student.wait_for_selector('#typed-answer');student.set_viewport_size({'width':390,'height':340});student.locator('#typed-answer').fill(b.practice_card(student)['answer']);student.locator('#answer-form button[type=submit]').scroll_into_view_if_needed();box=student.locator('#answer-form button[type=submit]').bounding_box();check(box['y']>=0 and box['y']+box['height']<=341,'keyboard-sized typed submit reachable');student.locator('#answer-form button[type=submit]').click();student.wait_for_selector('[data-act=practice-next]');student.locator('[data-act=practice-next]').click();student.wait_for_selector('#typed-answer');
  for _ in range(8):
   if b.practice_card(student)['answer']=='habló':break
   student.wait_for_timeout(600);student.locator('#typed-answer').fill(b.practice_card(student)['answer']);student.locator('#typed-answer').press('Enter');student.wait_for_selector('[data-act=practice-next]');student.locator('[data-act=practice-next]').click();student.wait_for_selector('#typed-answer')
  student.locator('#typed-answer').fill('hablo');student.locator('#typed-answer').press('ArrowLeft');student.locator('#typed-answer').press('ArrowRight');student.wait_for_timeout(100);student.locator('.accent-zone .accent').first.click();check(student.locator('#typed-answer').input_value()=='habló','contextual accent works at keyboard-sized viewport');student.screenshot(path=str(ROOT/'checks/typed-keyboard-height.png'),full_page=True);student.close()
  # Erasing a fake student's class data leaves that global account alive and removes the roster row.
  teacher.locator('#erase-class').select_option(b.FIX['classId']);teacher.wait_for_timeout(150);options=teacher.locator('#erase-student option').all_text_contents();check(any('Jordan' in name for name in options),'class-scoped deletion lists only selected class')
  user_id=teacher.locator('#erase-student option').filter(has_text='jordan@example.com').get_attribute('value');teacher.locator('#erase-student').select_option(user_id);teacher.locator('#erase-student-form input[name=confirm]').fill('wrong@example.com');teacher.locator('#erase-student-form button').click();teacher.wait_for_timeout(120);check('exact email' in teacher.locator('#notice').inner_text(),'incorrect deletion confirmation cannot erase data')
  teacher.locator('#erase-student-form input[name=confirm]').fill('jordan@example.com');teacher.locator('#erase-student-form button').click();teacher.wait_for_selector('#cleanup-state');check('complete' in teacher.locator('#cleanup-state').inner_text(),'deletion reports active-room cleanup result');teacher.keyboard.press('Escape')
  home=call('/api/academy/home',{},'other');check(len(home['classes'])==0 and home['user']['email']=='jordan@example.com','class erasure preserves student account')
  other=b.page_for(browser,'data-ui.js','other',(390,844));other.wait_for_selector('#erase-account-form');check(other.locator('#backup-form').count()==0,'student sees no teacher workspace backup controls')
  other.locator('#erase-account-form input').fill('jordan@example.com');other.locator('#erase-account-form button').click();other.wait_for_selector('#cleanup-state');check('Your account has been deleted' in other.locator('body').inner_text(),'student can erase own account');r=b.http('/api/academy/home',{},b.COOKIES['other']);check(r['status']==401,'erased account session revoked')
  check(not teacher.errors,'data page has no uncaught errors');check(not other.errors,'self-deletion page has no uncaught errors');browser.close()
 print(json.dumps({'checks':len(checks),'passed':sum(x['passed'] for x in checks)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/release-browser-results.json').write_text(json.dumps(checks,indent=2))
