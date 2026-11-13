"""Offline Chromium checks against real modules and QuizRoom, no production connection.
Run: python test/round-scene.browser.py (Python Playwright and Chromium required).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, json, subprocess, shutil
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; OUT=ROOT/'checks';OUT.mkdir(exist_ok=True)
checks=[]
def check(ok,label):
 assert ok,label
 checks.append(label)
bridge=subprocess.Popen(['node','--import','./test/register.mjs','test/round-browser-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
initial=json.loads(bridge.stdout.readline())
def act(role,msg):
 bridge.stdin.write(json.dumps(dict(role=role,message=msg))+'\n');bridge.stdin.flush()
 data=json.loads(bridge.stdout.readline());assert not data.get('bridgeError'),data;assert not data.get('errors'),data
 return data
MODULES={f.name:f.read_text() for f in (PUBLIC/'js').glob('*.js')}
BOOT=r"""({identity,modules})=>{
 for(const key of ['sessionStorage','localStorage']) Object.defineProperty(window,key,{value:new class {constructor(){this.data={};} getItem(k){return this.data[k]??null;} setItem(k,v){this.data[k]=String(v);} removeItem(k){delete this.data[k];}}});
 sessionStorage.setItem('quizdock-session',JSON.stringify(identity));
 window.sent=[];window.sockets=[];
 window.WebSocket=class{static OPEN=1;static CLOSED=3;constructor(url){this.url=url;this.readyState=1;window.sockets.push(this);queueMicrotask(()=>this.onopen?.({}));}send(text){window.sent.push(JSON.parse(text));}close(){this.readyState=3;}};
 window.deliver=s=>window.sockets.at(-1).onmessage({data:JSON.stringify(s)});
 const urls={};function load(n){if(urls[n])return urls[n];const source=modules[n.split('?')[0]].replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>"from '"+load(dep)+"'");return urls[n]=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));}
 return import(load('app.js'));
}"""
def boot(browser,role,width,height):
 page=browser.new_page(viewport=dict(width=width,height=height));errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.set_content('<div id="app"></div><div id="toast" class="toast" role="status"></div>')
 for css in ['styles.css','animations.css','library.css','reports.css','player-viewport.css']:page.add_style_tag(content=(PUBLIC/css).read_text())
 page.evaluate(BOOT,dict(identity=initial['identity'][role],modules=MODULES));return page,errors
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
 host,he=boot(browser,'host',1280,900);student,se=boot(browser,'student',390,844)
 def deliver(data):
  for role,page in [('host',host),('student',student)]:
   if data.get(role):page.evaluate('s=>deliver(s)',data[role])
  student.wait_for_timeout(20)
 def sent(page,kind):return page.evaluate('(kind)=>sent.filter(m=>m.type===kind).at(-1)',kind)
 deliver(initial)
 names=dict(treasure='Treasure Quest',fishing='Fishing Frenzy',battle='Battle Arena',factory='Factory Tycoon')
 round_no=0
 for before in names:
  for after in names:
   for mode in [before,after]:
    if round_no:
     host.locator('[data-action="end"]').click();deliver(act('host',sent(host,'end')))
    # Exercise input-only native selection and click-time value capture.
    host.locator('#next-mode').evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}',mode)
    host.locator('[data-action="start"]').click();request=sent(host,'start')
    check(request['mode']==mode,'teacher sends selected mode '+mode)
    if round_no:student.evaluate('window.oldScene=document.querySelector(".game-scene")')
    data=act('host',request);deliver(data);round_no+=1
    check(student.locator('.game-scene').get_attribute('data-mode')==mode,'scene switches '+str(round_no))
    check(student.locator('.room-title').inner_text()==names[mode],'visible game name '+str(round_no))
    check(data['student']['pin']=='123456' and data['student']['me']['id']==initial['identity']['student']['playerId'],'identity retained '+str(round_no))
    check(student.evaluate('sockets.length')==1,'no rejoin '+str(round_no))
    if round_no:check(student.locator('.game-scene').count()==1,'one scene '+str(round_no))
    if round_no>1:check(student.evaluate('oldScene!==document.querySelector(".game-scene")'),'new scene instance '+str(round_no))
    # Identical snapshots preserve scenes and do not replay outcomes.
    student.evaluate('window.currentScene=document.querySelector(".game-scene")');deliver(data)
    check(student.evaluate('currentScene===document.querySelector(".game-scene")'),'heartbeat preserves scene '+str(round_no))
 # Test resized chest at rest, shaking and each step of its lid animation.
 host.locator('[data-action="end"]').click();deliver(act('host',sent(host,'end')))
 host.locator('#next-mode').select_option('treasure');host.locator('[data-action="start"]').click();data=act('host',sent(host,'start'));deliver(data)
 q=data['student']['me']['question'];data=act('student',dict(type='answer',key=q['key'],choice=q['options'].index('To learn')));deliver(data)
 student.wait_for_timeout(700)
 data=act('student',dict(type='chest',index=0));deliver(data)
 student.evaluate("window.lidAnimation=document.querySelector('.scene-lid').getAnimations()[0];lidAnimation.pause();")
 for width,height in [(320,568),(360,640),(390,844),(430,932),(667,375),(844,390),(1366,768)]:
  student.set_viewport_size(dict(width=width,height=height));student.wait_for_timeout(35)
  for step in range(11):
   student.evaluate('(t)=>{lidAnimation.currentTime=t;}',step*100)
   bounds=student.evaluate('''()=>{const w=document.querySelector('.scene-world').getBoundingClientRect(),l=document.querySelector('.scene-lid').getBoundingClientRect(),b=document.querySelector('.scene-box').getBoundingClientRect();return {top:l.top-w.top,bottom:w.bottom-b.bottom,left:l.left-w.left,right:w.right-l.right};}''')
   check(min(bounds.values())>=-.75,f'chest in bounds {width}x{height} frame {step}: {bounds}')
  check(student.evaluate('document.documentElement.scrollWidth<=innerWidth'),'no horizontal overflow '+str(width))
  if width==390:
   student.evaluate('lidAnimation.currentTime=440');student.screenshot(path=str(OUT/'treasure-mobile-fixed.png'))
 # A later round closes an open mobile statistics drawer.
 student.set_viewport_size(dict(width=390,height=844));student.locator('[data-player-action="stats"]').click()
 host.locator('[data-action="end"]').click();deliver(act('host',sent(host,'end')))
 host.locator('#next-mode').select_option('fishing');host.locator('[data-action="start"]').click();data=act('host',sent(host,'start'));deliver(data)
 check(student.locator('#player-stats').get_attribute('hidden') is not None,'new round closes stats')
 student.screenshot(path=str(OUT/'fishing-next-round-fixed.png'))
 # Keep reduced motion preference on subsequent round switches.
 student.locator('.motion-toggle').click();check(student.locator('.motion-toggle').inner_text()=='Motion: off','motion off')
 host.locator('[data-action="end"]').click();deliver(act('host',sent(host,'end')))
 host.locator('#next-mode').select_option('factory');host.locator('[data-action="start"]').click();data=act('host',sent(host,'start'));deliver(data)
 check(student.locator('.motion-toggle').inner_text()=='Motion: off','motion preference survives switch')
 # Simulate old-connection message arriving after reconnection.
 student.evaluate('window.retired=sockets.at(-1);retired.readyState=3;retired.onclose({});');student.wait_for_timeout(1900)
 student.evaluate('s=>deliver(s)',data['student']);old=initial['student'];old['mode']='treasure'
 student.evaluate('s=>retired.onmessage({data:JSON.stringify(s)})',old)
 check(student.locator('.game-scene').get_attribute('data-mode')=='factory','retired socket cannot roll back mode')
 student.evaluate("window.dispatchEvent(new Event('online'))")
 check(sent(student,'sync')['type']=='sync','online requests fresh state')
 check(not he and not se,'no browser errors '+str(he+se))
 browser.close()
bridge.terminate();bridge.wait(timeout=5)
(OUT/'round-scene-results.json').write_text(json.dumps(dict(passed=len(checks),checks=checks),indent=2))
print(f'{len(checks)} browser assertions passed')
