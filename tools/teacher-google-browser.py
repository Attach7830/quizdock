"""Teacher Google UI regression checks with a fake Google SDK/API. No external account access."""
from pathlib import Path
import json, os, shutil, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RESULTS=[]

def check(ok,name):
    RESULTS.append({'check':name,'passed':bool(ok)})
    if not ok: raise AssertionError(name)

HOME='''<div class="panel login-panel"><h2>Welcome to QuizDock</h2><div class="hub-tabs"><button data-act="login-kind" data-kind="student" aria-selected="false">Student</button><button data-act="login-kind" data-kind="teacher" aria-selected="true">Teacher</button></div><form id="login-form" class="stack"><label>Teacher email<input name="email" type="email"></label><button>Email me a sign-in code</button></form></div>'''
STUDENT='''<div class="panel login-panel"><div class="hub-tabs"><button data-act="login-kind" data-kind="student" aria-selected="true">Student</button><button data-act="login-kind" data-kind="teacher" aria-selected="false">Teacher</button></div><div id="google-signin"></div></div>'''
LIBRARY='''<main class="library-login"><section class="card login-card"><h2>Teacher sign-in</h2><form id="login-form"><label>Authorized teacher email<input id="teacher-email" type="email"></label><button>Send sign-in code</button></form></section></main>'''
SDK='''window.__googleCallbacks=[]; window.google={accounts:{id:{initialize(config){window.__googleConfig=config;window.__googleCallbacks.push(config.callback)},renderButton(container,options){window.__buttonOptions=options;const b=document.createElement('button');b.textContent='Sign in with Google';b.className='mock-google-button';b.style.maxWidth='100%';b.style.width=options.width+'px';b.onclick=()=>window.__googleConfig.callback({credential:'fake-signed-test-credential'});container.append(b)}}}};'''

def newpage(browser,body=HOME,role='home',sdk=True,error=None):
    state={'calls':[], 'loggedIn':False, 'error':error}
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_default_timeout(5000)
    page.errors=[];page.on('pageerror',lambda e:page.errors.append(str(e)))
    def request(path,data):
        state['calls'].append((path,data))
        if path.endswith('google-start'):
            response={'clientId':'test.apps.googleusercontent.com','nonce':'server-nonce','challenge':'server-challenge'}
            return {'status':503 if state['error']=='setup' else 200,'body':{'error':'Google setup unavailable. Use email-code sign-in.'} if state['error']=='setup' else response}
        if path.endswith('google-signin'):
            if state['error']=='denied':return {'status':403,'body':{'error':'This Google email is not an authorized teacher.'}}
            state['loggedIn']=True
        return {'status':200,'body':{'ok':True}}
    page.expose_function('__request',request)
    css=(ROOT/'public/styles.css').read_text()+'\n'+re.sub(r'@import[^;]+;','',(ROOT/'public/platform.css').read_text())+'\n'+(ROOT/'public/google-teacher.css').read_text()
    page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body></body></html>')
    if sdk:page.evaluate(SDK)
    source={name:(ROOT/'public/js'/name).read_text() for name in ['catalog.js','item-catalog.js','extra-item-art.js','avatar-item-art.js','characters.js','shortcut-settings.js','shortcuts.js','ui.js','google-signin.js','teacher-google-ui.js']}
    page.evaluate(r'''async ({source,body,role,sdk})=>{
      window.fetch=async(path,init)=>{const r=await window.__request(path,JSON.parse(init.body));return new Response(JSON.stringify(r.body),{status:r.status,headers:{'content-type':'application/json'}})};
      if(!sdk){const append=document.head.append.bind(document.head);document.head.append=(...nodes)=>{for(const node of nodes){if(node.tagName==='SCRIPT'&&node.src==='https://accounts.google.com/gsi/client')queueMicrotask(()=>node.dispatchEvent(new Event('error')));else append(node);}};}
      const urls={};for(const [name,original] of Object.entries(source)){const text=original.replace(/from\s+(['"])\.\/([^'"]+)\1/g,(m,q,path)=>{if(!urls[path])throw new Error(`Missing fixture module ${path} imported by ${name}`);return `from ${q}${urls[path]}${q}`;});urls[name]=URL.createObjectURL(new Blob([text],{type:'application/javascript'}));}
      const mod=await import(urls['teacher-google-ui.js']);
      const root=document.createElement('div');root.id=role==='library'?'library-root':'app';root.className='wrap';root.innerHTML=body;document.body.append(root);
      mod.installTeacherGoogleSignIn(root,{onSuccess:()=>{root.innerHTML='<h1>Teacher dashboard</h1>';}});
    }''',{'source':source,'body':body,'role':role,'sdk':sdk})
    return page,state

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
        page,state=newpage(browser)
        page.wait_for_selector('.mock-google-button')
        check(page.locator('#login-form').count()==1,'teacher email form preserved')
        check(state['calls'][0]==('/api/library/google-start',{}),'teacher uses dedicated library endpoint without student class input')
        check(page.locator('.teacher-google-options').count()==1,'one teacher Google section')
        check(page.evaluate('window.__googleConfig.auto_select') is False,'no automatic account sign-in')
        for w in [320,390,768,1366]:
            page.set_viewport_size({'width':w,'height':844});page.wait_for_timeout(30)
            check(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'teacher screen horizontal fit at {w}px')
        page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT/'checks/teacher-google-phone.png'),full_page=True)
        page.locator('.mock-google-button').click();page.wait_for_selector('h1')
        check('Teacher dashboard' in page.locator('body').inner_text(),'Google success invokes the authenticated-screen callback')
        calls=[c for c in state['calls'] if c[0].endswith('google-signin')]
        check(calls==[('/api/library/google-signin',{'challenge':'server-challenge','credential':'fake-signed-test-credential'})],'teacher callback sends only credential and bound challenge')
        check(not page.errors,'home has no browser errors');page.close()

        page,state=newpage(browser,body=LIBRARY,role='library');page.wait_for_selector('.mock-google-button')
        check(page.locator('#teacher-email').count()==1,'My lists email-code fallback retained')
        check(state['calls'][0][0]=='/api/library/google-start','My lists uses teacher sign-in')
        page.locator('.mock-google-button').click();page.wait_for_selector('h1')
        check(state['loggedIn'],'My lists Google callback works');page.close()

        page,state=newpage(browser,error='denied');page.wait_for_selector('.mock-google-button');page.locator('.mock-google-button').click();page.wait_for_selector('.teacher-google-button [role=status]')
        check('not an authorized teacher' in page.locator('.teacher-google-button').inner_text(),'unauthorized teacher error is readable')
        check(page.locator('#login-form input').is_enabled(),'email-code fallback remains usable after Google rejection')
        check(not state['loggedIn'],'rejected Google login never navigates as logged in')
        state['error']=None;page.get_by_role('button',name='Retry Google sign-in').click();page.wait_for_selector('.mock-google-button')
        check(len([c for c in state['calls'] if c[0].endswith('google-start')])==2,'retry starts a fresh teacher challenge');page.close()

        for error,sdk in [('setup',True),(None,False)]:
            page,state=newpage(browser,error=error,sdk=sdk);page.wait_for_selector('.teacher-google-button [role=status]')
            check(page.locator('#login-form').is_visible(),f'email login remains usable when Google {"unconfigured" if error else "script blocked"}')
            check(page.get_by_role('button',name='Retry Google sign-in').is_visible(),'controlled retry is shown')
            check(not page.errors,'Google failure produces no unhandled browser error');page.close()

        page,state=newpage(browser,body=STUDENT);page.wait_for_timeout(60)
        check(len(state['calls'])==0,'teacher module does not request teacher challenges on Student tab')
        page.evaluate('(html)=>document.getElementById("app").innerHTML=html',HOME);page.wait_for_selector('.mock-google-button')
        page.evaluate('(html)=>document.getElementById("app").innerHTML=html',STUDENT);page.wait_for_timeout(20)
        page.evaluate('window.__googleCallbacks[0]({credential:"stale-popup"})');page.wait_for_timeout(30)
        check(not any(c[0].endswith('google-signin') for c in state['calls']),'detached teacher popup callback cannot sign in after role switch')
        page.evaluate('(html)=>document.getElementById("app").innerHTML=html',HOME);page.wait_for_selector('.mock-google-button')
        page.evaluate('document.querySelector("#login-form input").value="typed@example.com"');page.wait_for_timeout(30)
        check(page.locator('.teacher-google-options').count()==1,'rerenders never duplicate teacher Google section')
        check(page.locator('#login-form input').input_value()=='typed@example.com','teacher Google does not erase typed email')
        page.close();browser.close()
    print(json.dumps({'checks':len(RESULTS),'passed':sum(c['passed'] for c in RESULTS)}))

if __name__=='__main__':
    (ROOT/'checks').mkdir(exist_ok=True)
    try:run()
    finally:(ROOT/'checks/teacher-google-results.json').write_text(json.dumps(RESULTS,indent=2))
