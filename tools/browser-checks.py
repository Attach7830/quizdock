"""Offline Chromium UI with the real local Worker/DO test adapter.
No production calls. DOM runs in about:blank because navigation is restricted.
"""
from pathlib import Path
import re,json,ssl,urllib.request,urllib.error,time,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE='https://localhost:9443'
SSL=ssl._create_unverified_context()
RESULTS=[]

def http(path,data=None,cookie=''):
    req=urllib.request.Request(BASE+path,data=None if data is None else json.dumps(data).encode(),headers={'Origin':BASE,'Content-Type':'application/json',**({'Cookie':cookie} if cookie else {})})
    try:r=urllib.request.urlopen(req,context=SSL,timeout=15)
    except urllib.error.HTTPError as e:r=e
    return {'status':r.status,'body':r.read().decode(),'headers':dict(r.headers)}
COOKIES={role:http('/__test/login?role='+role)['headers'].get('Set-Cookie','').split(';')[0] for role in ['teacher','student','other']}
FIX=json.loads(http('/__test/fixture')['body'])

def check(ok,name):
    RESULTS.append({'check':name,'passed':bool(ok)})
    if not ok:raise AssertionError(name)

def sources(entry):
    out={}
    def load(name):
        if name in out:return
        text=(ROOT/'public/js'/name).read_text()
        for dep in re.findall(r"from\s+['\"]\./([^'\"]+)['\"]",text):load(dep)
        # Replace only navigation for the offline test harness, not business/UI logic.
        text=text.replace('location.assign(', 'window.__navigate(').replace('location.replace(', 'window.__navigate(')
        text=text.replace("history.replaceState({},'',location.pathname)","void 0")
        out[name]=text
    load(entry);return out

PRELUDE=r'''({session,source,entry})=>{
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>[...m.keys()][i],get length(){return m.size}}};
Object.defineProperty(window,'localStorage',{value:memory()});Object.defineProperty(window,'sessionStorage',{value:memory()});
if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));return [...b].map(n=>n.toString(16).padStart(2,'0')).join('');};
if(session)sessionStorage.setItem('quizdock-session',JSON.stringify(session));
window.__navigate=p=>window.__navigation=p;window.confirm=()=>true;
window.fetch=async(input,init={})=>{const path=typeof input==='string'?input:input.url;const res=await window.__request(path,init.body?JSON.parse(init.body):null,false);return new Response(res.body,{status:res.status,headers:res.headers});};
window.WebSocket=class {
 static OPEN=1; static CLOSED=3;
 constructor(url){this.readyState=0;this.closed=false;this.busy=false;this.pending=[];const pin=url.match(/room\/(\d+)\/socket/)?.[1];window.__request('/__test/ws/open',{pin},true).then(r=>{if(this.closed)return;this.sid=JSON.parse(r.body).sid;this.readyState=1;this.onopen?.({});this.poll=setInterval(()=>this.read(),100);});}
 async read(){if(this.busy||this.closed||!this.sid)return;this.busy=true;try{const r=await window.__request('/__test/ws/poll',{sid:this.sid},true);this.dispatch(JSON.parse(r.body));}finally{this.busy=false;}}
 dispatch(data){if(this.closed)return;for(const m of data.messages||[])this.onmessage?.({data:JSON.stringify(m)});if(data.closed){this.closed=true;this.readyState=3;clearInterval(this.poll);this.onclose?.({code:4001});}}
 send(text){if(this.readyState!==1)throw Error('Not open');window.__request('/__test/ws/send',{sid:this.sid,message:JSON.parse(text)},true).then(r=>this.dispatch(JSON.parse(r.body)));}
 close(){this.closed=true;this.readyState=3;clearInterval(this.poll);if(this.sid)window.__request('/__test/ws/close',{sid:this.sid},true);}
};
const urls={};for(const [name,original] of Object.entries(source)){let code=original.replace(/from\s+(['"])\.\/([^'"]+)\1/g,(match,q,path)=>`from ${q}${urls[path]}${q}`);urls[name]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));}
return import(urls[entry]);
}'''

def page_for(browser,entry,role='student',size=(390,844),session=None):
    page=browser.new_page(viewport={'width':size[0],'height':size[1]},reduced_motion='reduce')
    page.set_default_timeout(5000)
    page.errors=[]
    page.on('pageerror',lambda e:page.errors.append(str(e)))
    page.route('**/__test/image.svg',lambda route:route.fulfill(status=200,content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#dde8eb"/><path d="M170 150L300 45L430 150V275H170Z" fill="#c79b74"/></svg>'))
    page.expose_function('__request',lambda path,data,internal: http(path,data,COOKIES[role]))
    css=(ROOT/'public/styles.css').read_text()+'\n'+re.sub(r'@import[^;]+;','',(ROOT/'public/platform.css').read_text())
    page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><div id="notice" class="notice" role="status" hidden></div><dialog id="dialog"></dialog></body></html>')
    page.evaluate(PRELUDE,{'source':sources(entry),'entry':entry,'session':session})
    page.wait_for_timeout(400)
    return page

def overflow(page,label):
    x=page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    check(x,label+' horizontal fit')

def run():
 with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
    s=page_for(b,'academy-ui.js')
    s.wait_for_selector('[data-act=tab]')
    check('Welcome back, Alex' in s.locator('body').inner_text(),'Student homepage uses verified name')
    overflow(s,'student home phone')
    s.screenshot(path=str(ROOT/'checks/student-home-phone.png'),full_page=True)
    s.locator('[data-act=practice]').first.click();s.wait_for_selector('#typed-answer')
    s.locator('#typed-answer').fill('aprender');s.locator('#answer-form button[type=submit]').click()
    s.wait_for_selector('[data-act=practice-next]');check('Correct. Nicely done.' in s.locator('body').inner_text(),'typed answer server graded')
    s.locator('[data-act=practice-next]').click();s.wait_for_selector('#typed-answer')
    s.locator('#typed-answer').fill('hablo');s.locator('#typed-answer').press('ArrowLeft');s.locator('#typed-answer').press('ArrowRight')
    s.wait_for_timeout(120);check(s.locator('.accent-zone .accent').count()>0,'contextual accent popup')
    s.locator('.accent-zone .accent').first.click();check(s.locator('#typed-answer').input_value()=='habló','accent replaces preceding letter')
    s.screenshot(path=str(ROOT/'checks/typed-practice-phone.png'),full_page=True)
    s.wait_for_timeout(600)
    s.locator('#answer-form button[type=submit]').click();s.wait_for_selector('[data-act=practice-next]')
    check(s.locator('[data-act=practice-submit]').count()>0,'submit control exists')
    s.locator('[data-act=practice-submit]').click();s.wait_for_timeout(200)
    check('submitted' in s.locator('body').inner_text().lower(),'graded practice submitted')
    s.locator('[data-act=back-home]').click();s.wait_for_selector('[data-act=tab]')
    s.locator('[data-act=tab][data-tab=practice]').click();s.locator('[data-act=solo]').first.click();s.wait_for_selector('.flashcard')
    check('ungraded' in s.locator('body').inner_text().lower(),'solo is explicitly ungraded')
    prompt=s.locator('.flashcard span').inner_text();deck=json.loads(http('/api/academy/solo-open',{'classId':FIX['classId'],'listId':FIX['listId']},COOKIES['student'])['body'])['deck'];expected=next(c['answer'] for c in deck['cards'] if c['prompt']==prompt)
    s.locator('[data-act=solo-flip]').click();check(expected in s.locator('.flashcard').inner_text(),'solo shuffled card reveals its matching answer')
    s.locator('[data-act=solo-mark][data-mark=known]').click();s.wait_for_timeout(200)
    s.screenshot(path=str(ROOT/'checks/flashcards-phone.png'),full_page=True)
    s.locator('[data-act=back-home]').click();s.wait_for_selector('[data-act=tab]');s.locator('[data-act=tab][data-tab=wardrobe]').click()
    s.locator('[data-act=skin][data-id=solar]').click();s.wait_for_timeout(200)
    check('100 reward points' in s.locator('body').inner_text(),'server purchase deducts points')
    overflow(s,'shop phone')
    s.screenshot(path=str(ROOT/'checks/skins-phone.png'),full_page=True)
    t=page_for(b,'academy-ui.js','teacher',(1440,900));t.wait_for_selector('[data-act=host]')
    t.screenshot(path=str(ROOT/'checks/teacher-home.png'),full_page=True)
    t.locator('[data-act=host]').first.click();t.wait_for_selector('#host-form')
    t.locator('#host-form select[name=classId]').select_option(FIX['classId']);t.locator('#host-form select[name=mode]').select_option('treasure')
    t.locator('#host-form button.btn.primary').click();t.wait_for_function('window.__navigation')
    host_session=t.evaluate('JSON.parse(sessionStorage.getItem("quizdock-session"))');pin=host_session['pin'];check(bool(pin),'host creates class-linked game')
    t.close();t=page_for(b,'app.js','teacher',(1366,900),host_session);t.wait_for_selector('[data-act=start]')
    r=json.loads(http('/api/room/'+pin+'/join',{},COOKIES['student'])['body']);student_session={'role':'student','pin':pin,'token':r['playerToken'],'playerId':r['playerId']}
    g=page_for(b,'app.js','student',(390,844),student_session);g.wait_for_selector('.game-shell')
    t.locator('[data-act=start]').click();g.wait_for_selector('.answer')
    check('Treasure Quest' in g.locator('.player-hud h1').inner_text(),'class game reaches student')
    home_check=page_for(b,'academy-ui.js','student',(390,844))
    check(home_check.locator('a[href*="play.html?join="]').count()==1,'student homepage lists teacher class game')
    home_check.close()
    check(g.locator('.answer').count()==4 and not g.locator('canvas').is_visible(),'question shows four large answers without game scene')
    g.locator('.answer').filter(has_text='aprender').click();g.wait_for_selector('[data-player-view=result]')
    check(g.locator('.answer').count()==0 and g.locator('canvas').is_visible(),'answer opens a separate game result screen')
    g.emulate_media(reduced_motion='no-preference');g.wait_for_timeout(80)
    before=g.locator('canvas').evaluate('(c)=>c.toDataURL()');g.wait_for_timeout(120);after=g.locator('canvas').evaluate('(c)=>c.toDataURL()')
    check(before!=after,'live scene animation changes rendered frames')
    g.locator('[data-scene=motion]').click();g.wait_for_timeout(50)
    before=g.locator('canvas').evaluate('(c)=>c.toDataURL()');g.wait_for_timeout(120);after=g.locator('canvas').evaluate('(c)=>c.toDataURL()')
    check(before==after,'motion toggle freezes nonessential animation')
    g.locator('[data-scene=collapse]').click();check(not g.locator('canvas').is_visible(),'hide scene frees mobile space');g.locator('[data-scene=collapse]').click()
    g.locator('[data-act=stats]').click();check(g.locator('#dialog').is_visible(),'mobile Stats panel accessible');g.keyboard.press('Escape')
    g.wait_for_selector('[data-act=chest]');g.locator('[data-act=chest]').first.click();g.wait_for_selector('[data-act=next]')
    for index,answer in [(2,'habló'),(3,'una casa'),(4,'una biblioteca')]:
        g.locator('[data-act=next]').click();g.wait_for_selector('.answer:not([disabled])');g.wait_for_timeout(550)
        if index==3:check(g.locator('.question-image').count()==1,'image prompt renders with accessible fallback')
        if index==4:
            g.set_viewport_size({'width':320,'height':568});g.locator('.answer').last.scroll_into_view_if_needed();bb=g.locator('.answer').last.bounding_box();check(bb['y']+bb['height']<=569,'long mobile prompt leaves answers reachable')
            y=g.evaluate('scrollY');g.evaluate('document.dispatchEvent(new Event("visibilitychange"))');g.wait_for_timeout(220);check(abs(g.evaluate('scrollY')-y)<2,'heartbeat preserves mobile document scroll')
        g.locator('.answer span').filter(has_text=re.compile('^'+answer+'$')).click();g.wait_for_selector('[data-act=chest]');g.locator('[data-act=chest]').first.click();g.wait_for_selector('[data-act=next]')
    g.locator('[data-act=next]').click();g.wait_for_selector('.answer:not([disabled])')
    t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]')
    raffle_page=page_for(b,'academy-ui.js','teacher',(1366,900));raffle_page.locator('[data-act=tab][data-tab=raffle]').click();raffle_page.locator('#raffle-preview button').click();raffle_page.wait_for_selector('[data-act=draw-raffle]')
    check('3 tickets' in raffle_page.locator('body').inner_text(),'completed live round creates weighted raffle tickets')
    raffle_page.locator('[data-act=draw-raffle]').click();raffle_page.wait_for_selector('.raffle-winner');check('Alex Rivera' in raffle_page.locator('.raffle-winner').inner_text(),'raffle draws verified student and stores result')
    raffle_page.screenshot(path=str(ROOT/'checks/weekly-raffle.png'),full_page=True);raffle_page.close()
    t.locator('[data-act=start]').click();g.wait_for_selector('.answer:not([disabled])')
    for w,h in [(320,568),(360,640),(390,844),(430,932),(844,390),(360,460),(1024,768),(1366,768)]:
        g.set_viewport_size({'width':w,'height':h});g.wait_for_timeout(150);overflow(g,f'game {w}x{h}')
        box=g.locator('.game-question').bounding_box();check(box['height']>=90,f'question area usable {w}x{h}')
        g.locator('.answer').last.scroll_into_view_if_needed();bb=g.locator('.answer').last.bounding_box();check(bb['y']+bb['height']<=h+1,f'answer reachable {w}x{h}')
    g.set_viewport_size({'width':390,'height':844});g.wait_for_timeout(150)
    g.screenshot(path=str(ROOT/'checks/treasure-phone.png'),full_page=True)
    # Actual same-PIN transitions across all six modes.
    for mode in ['fishing','battle','factory','rally','keep','treasure']:
        if mode=='fishing':g.locator('[data-act=stats]').click()
        t.locator('[data-act=end]').click();t.wait_for_selector('[data-act=start]');t.locator('#round-mode').select_option(mode);t.locator('[data-act=start]').click()
        g.wait_for_timeout(300)
        title={'treasure':'Treasure Quest','fishing':'Fishing Frenzy','battle':'Battle Arena','factory':'Factory Tycoon','rally':'Sky Rally','keep':'Crystal Keep'}[mode]
        check(title==g.locator('.player-hud h1').inner_text(),f'{mode} switches without rejoin')
        if mode=='fishing':check(not g.locator('#dialog').is_visible(),'new round closes mobile Stats panel')
        if mode in ['rally','keep']:
            check(g.locator('[data-act=role]').count()==3,f'{mode} three distinct roles')
            g.locator('[data-act=role]').first.click();g.wait_for_selector('.answer')
        g.screenshot(path=str(ROOT/f'checks/{mode}-phone.png'),full_page=True)
    check(not g.errors,'game console errors absent');check(not s.errors,'student portal console errors absent');check(not t.errors,'teacher game console errors absent')
    b.close()
 try:pass
 finally:(ROOT/'checks/browser-results.json').write_text(json.dumps(RESULTS,indent=2))
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)},indent=2))

if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/browser-results.json').write_text(json.dumps(RESULTS,indent=2))
