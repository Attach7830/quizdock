"""Assignment screen and sentence-clue regressions. All identities and work are fake."""
from pathlib import Path
import json,os,shutil,uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def call(ctx,path,data={}):
 r=ctx.request.post(BASE+path,data=data,headers={'Origin':BASE});check(r.ok,path+' succeeds'+(': '+r.text()[:160] if not r.ok else ''));return r.json()
def fit(page,label):
 page.wait_for_timeout(80)
 d=page.evaluate('''()=>{const h=visualViewport.height,w=innerWidth;return{w,h,dh:document.documentElement.scrollHeight,dw:document.documentElement.scrollWidth,off:[...document.querySelectorAll('.assignment-practice button,.assignment-practice input')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.left<0||r.bottom>h+1||r.right>w+1}).map(e=>e.textContent||e.id),panel:[...document.querySelectorAll('.study-panel,.practice-content,.practice-question,.practice-response')].map(e=>({name:e.className,h:e.clientHeight,s:e.scrollHeight}))}}''')
 if d['dh']>d['h']+1 or d['off'] or any(e['s']>e['h']+2 for e in d['panel']):page.screenshot(path=str(ROOT/'checks/practice-layout-failure.png'))
 check(d['dh']<=d['h']+1 and d['dw']<=d['w']+1 and not d['off'] and all(e['s']<=e['h']+2 for e in d['panel']),label+': '+json.dumps(d))
SIZES=[(1920,990),(1366,768),(1280,720),(1024,600),(960,560),(800,600),(768,1024),(390,844),(320,568)]
def run():
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
  tc=b.new_context(ignore_https_errors=True);tc.request.get(BASE+'/__test/login?role=teacher');sc=b.new_context(ignore_https_errors=True,viewport={'width':1920,'height':990},device_scale_factor=1,reduced_motion='reduce');sc.request.get(BASE+'/__test/login?role=student');s=sc.new_page();errors=[];s.on('pageerror',lambda e:errors.append(str(e)));fix=tc.request.get(BASE+'/__test/fixture').json()
  prompt='Corrige solo el demostrativo. «Ese zapatos son de cuero».';answer='Esos zapatos son de cuero.';list_id=str(uuid.uuid4())
  call(tc,'/api/library/save',{'id':list_id,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Sentence clue fixture','cards':[{'type':'pair','prompt':prompt,'answer':answer,'alternatives':['Esos zapatos son de cuero']}]}})
  a=call(tc,'/api/academy/create-assignment',{'classId':fix['classId'],'listId':list_id,'title':'Sentence review','dueLocal':'2026-12-18T23:59','rules':{'minMinutes':0,'minCards':1,'minAccuracy':100}})['assignment']
  s.goto(BASE+'/?view=assignments');s.locator(f'[data-act=practice][data-id="{a["id"]}"]').click();s.wait_for_selector('#typed-answer');s.locator('[data-act=practice-mode][data-mode=word]').click();s.wait_for_selector('.assignment-forge-clues')
  for w,h in SIZES:
   s.set_viewport_size({'width':w,'height':h});fit(s,f'Word Forge sentence fits at 100% zoom {w}x{h}')
   if w in [1920,1366,390]:s.screenshot(path=str(ROOT/f'checks/assignment-word-{w}x{h}.png'))
   if h>700:
    groups=s.locator('.assignment-forge-clues .word-word');check(groups.evaluate_all('(es)=>es.map(e=>Number(e.dataset.letterCount))')==[4,7,3,2,5],'sentence word lengths are 4/7/3/2/5 at '+str(w));check(groups.evaluate_all('(es)=>es.every(e=>{const ys=[...e.querySelectorAll(".word-slot")].map(c=>c.getBoundingClientRect().top);return Math.max(...ys)-Math.min(...ys)<1})'),'no word splits between clue rows at '+str(w))
  s.set_viewport_size({'width':1366,'height':768});s.locator('#typed-answer').fill('saved outfit-independent draft');s.locator('[data-act=practice-clues]').click();s.wait_for_selector('.practice-clue-dialog');check(s.locator('.practice-clue-dialog .word-slot').count()==21,'sentence has exactly 21 alphabetic blanks');check(s.locator('.practice-clue-dialog .word-punctuation').inner_text()=='.','punctuation is visible rather than becoming another letter blank');s.locator('[data-act=practice-letter][data-letter=E]').click();s.wait_for_function('document.querySelector(".practice-clue-dialog [data-letter=E]").disabled');s.keyboard.press('Escape');check(s.locator('#typed-answer').input_value()=='saved outfit-independent draft','opening and using clues preserves a typed draft')
  s.locator('[data-act=practice-read-question]').click();s.wait_for_selector('.game-reader[open]');check(prompt in s.locator('.reader-pages').inner_text(),'full prompt reader retains exact teacher text');s.keyboard.press('Escape');s.locator('#typed-answer').fill(answer);s.locator('#typed-answer').press('Enter');s.wait_for_selector('[data-act=practice-next]')
  for w,h in SIZES:s.set_viewport_size({'width':w,'height':h});fit(s,f'Word Forge feedback and Submit fit {w}x{h}')
  s.set_viewport_size({'width':1366,'height':768});s.locator('[data-act=back-home]').click();s.wait_for_function('document.querySelector("h1")?.textContent==="Assignments"');check(not s.locator('body.practice-body').count(),'leaving feedback restores normal page scrolling');s.locator(f'[data-act=practice][data-id="{a["id"]}"]').click();s.wait_for_selector('[data-act=practice-next]');s.keyboard.press('Enter');s.wait_for_selector('#typed-answer');s.locator('[data-act=practice-mode][data-mode=type]').click();fit(s,'ordinary typed assignment uses the same compact shell')
  s.set_viewport_size({'width':390,'height':340});s.locator('#typed-answer').scroll_into_view_if_needed();r=s.locator('#typed-answer').bounding_box();check(r['y']>=0 and r['y']+r['height']<=341,'software keyboard retains natural scrolling to the typed field')
  report=call(tc,'/api/academy/assignment-report',{'assignmentId':a['id']});row=next(x for x in report['students'] if x['email']=='alex@example.com');check(row['progress']['answered']==1 and row['progress']['correct']==1,'layout and clues preserve exact assignment grading');s.set_viewport_size({'width':1366,'height':768});s.locator('[data-act=practice-mode][data-mode=word]').click();s.locator('[data-act=practice-submit]').click();s.wait_for_function('document.querySelector(".practice-submitted h2")?.textContent==="Your practice is saved."');check(True,'explicit submission after using clues and switching modes completes without losing the assignment');  long_prompt=('Explica por qué esta respuesta es correcta. '*9).strip();long_answer=('Una respuesta larga para conservar cada espacio. '*3).strip();long_id=str(uuid.uuid4())
  call(tc,'/api/library/save',{'id':long_id,'revision':0,'mutationId':str(uuid.uuid4()),'list':{'title':'Long practice fixture','cards':[{'type':'pair','prompt':long_prompt,'answer':long_answer,'image':BASE+'/__test/image.svg','imageAlt':'Fake house illustration'}]}})
  long_a=call(tc,'/api/academy/create-assignment',{'classId':fix['classId'],'listId':long_id,'title':'Long prompt and answer','dueLocal':'2026-12-18T23:59','rules':{'minMinutes':0,'minCards':1,'minAccuracy':100}})['assignment']
  s.goto(BASE+'/?view=assignments');s.locator(f'[data-act=practice][data-id="{long_a["id"]}"]').click();s.wait_for_selector('#typed-answer');s.locator('[data-act=practice-mode][data-mode=word]').click()
  for w,h in [(1920,990),(1366,768),(1024,600),(390,844),(320,568)]:s.set_viewport_size({'width':w,'height':h});fit(s,f'long illustrated assignment retains answer controls {w}x{h}')
  s.set_viewport_size({'width':1366,'height':768});s.locator('[data-act=practice-read-question]').click();s.wait_for_selector('.game-reader[open]');check(long_prompt in s.locator('.reader-pages').inner_text() and s.locator('.reader-pages img').count()==1,'long prompt and illustration stay available in full reading pages');s.keyboard.press('Escape')
  check(not errors,'practice redesign has no uncaught browser errors');b.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/practice-layout-results.json').write_text(json.dumps(RESULTS,indent=2))
