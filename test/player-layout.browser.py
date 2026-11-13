"""Offline UI checks. Run with Python + Playwright Chromium installed.
Uses real app assets and mocked server snapshots; does not contact production.
"""
from pathlib import Path
from urllib.parse import urlparse
import json, time, shutil, os, re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'checks'
OUT.mkdir(exist_ok=True)
checks = []
errors = []

def check(value, name):
    assert value, name
    checks.append(name)

def state(mode='treasure', status='playing'):
    players = [dict(id=f'p{i}', name=f'Player {i+1}', score=200-i*13, correct=4, answered=6) for i in range(8)]
    me=dict(id='p0',name='Player 1',answered=6,correct=4,streak=2,score=200,coins=200,cash=200,fishCount=3,biggestFish=4.2,hp=80,rodLevel=1,machineLevel=1,pendingChests=False,feedback=None,
      question=dict(key='question1',number=1,text='¿Qué significa “aprender”?',options=['To learn','To sleep','To run','To write']))
    return dict(type='state',pin='123456',title='Spanish 2 · Vocabulary review',mode=mode,status=status,questionCount=12,startedAt=100,endsAt=int(time.time()*1000)+600000,remainingMs=500000,roundNumber=1,durationMinutes=10,players=players,online=[p['id'] for p in players],me=me)

MOCK = r"""
window.sent = []; window.connections = [];
class MockSocket {
 static OPEN = 1;
 constructor() { this.readyState=1; window.connections.push(this); setTimeout(()=>this.onopen?.(),0); }
 send(text) { window.sent.push(JSON.parse(text)); }
 close() { this.readyState=3; }
}
window.WebSocket=MockSocket;
window.emit = state => { window.lastState=state; window.connections.at(-1).onmessage({data:JSON.stringify(state)}); };
window.confirm=()=>true;
"""

def attach(context, role='student', fullscreen_kind=None):
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    css='\n'.join((ROOT/'public'/name).read_text() for name in ['styles.css','animations.css','library.css','reports.css','player-viewport.css'])
    page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>'+css+'</style></head><body><div id="app"></div><div id="toast" class="toast" role="status"></div></body></html>')
    page.evaluate("""() => {
      const makeStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
      Object.defineProperty(window,'sessionStorage',{value:makeStorage(),configurable:true});
      Object.defineProperty(window,'localStorage',{value:makeStorage(),configurable:true});
    }""")
    page.evaluate(MOCK)
    if fullscreen_kind=='unsupported':page.evaluate("Object.defineProperty(document,'fullscreenEnabled',{value:false});Object.defineProperty(document,'webkitFullscreenEnabled',{value:false})")
    elif fullscreen_kind=='rejected':page.evaluate("() => { Element.prototype.requestFullscreen=()=>Promise.reject(new Error('blocked')); }")
    page.evaluate("role=>sessionStorage.setItem('quizdock-session',JSON.stringify({role,pin:'123456',token:'test',playerId:'p0'}))",role)
    modules={}
    for file in (ROOT/'public/js').glob('*.js'):
      source=file.read_text()
      source=re.sub(r"(from\s*['\"])\./([^'\"]+)",r"\1quizdock/\2",source)
      modules['quizdock/'+file.name]=source
    page.evaluate("""modules=>{
      const imports={};for(const [name,source] of Object.entries(modules))imports[name]=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
      const main=document.createElement('script');main.type='module';main.textContent="import 'quizdock/app.js';";document.body.append(main);
    }""",modules)
    page.wait_for_function('window.connections.length === 1')
    return page

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None, args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1366,'height':768})
    page=attach(context)
    dimensions=[(1920,1080),(1366,768),(1024,768),(768,1024),(390,844),(360,640),(320,568),(844,390),(667,375)]
    for w,h in dimensions:
      page.set_viewport_size({'width':w,'height':h})
      for mode in ['treasure','fishing','battle','factory']:
       for status in ['lobby','playing','paused','finished']:
        s=state(mode,status);page.evaluate('s=>emit(s)',s)
        layout=page.evaluate('''()=>{
          const doc=document.documentElement, app=document.querySelector('#app'), area=document.querySelector('.question-scroll');
          const r=app.getBoundingClientRect(), q=area.getBoundingClientRect();
          const choices=[...document.querySelectorAll('[data-action="answer"]')].map(e=>e.getBoundingClientRect());
          return {width:doc.scrollWidth, height:doc.scrollHeight, appBottom:r.bottom, qHeight:q.height, qBottom:q.bottom,
            choicesFit:choices.every(e=>e.top>=q.top-1&&e.bottom<=q.bottom+1&&e.left>=0&&e.right<=innerWidth+1)};
        }''')
        name=f'{w}x{h} {mode} {status}'
        check(layout['width']<=w+1, name+' no horizontal overflow')
        check(layout['height']<=h+1 and layout['appBottom']<=h+1, name+' no document scroll')
        check(layout['qHeight']>50 and layout['qBottom']<=h+1, name+' question area reachable')
        if status=='playing':check(layout['choicesFit'],name+' all normal answer choices visible')
    page.set_viewport_size({'width':390,'height':844});page.evaluate('s=>emit(s)',state('fishing'))
    page.screenshot(path=str(OUT/'player-phone.png'))
    page.locator('[data-player-action="stats"]').click()
    check(page.locator('#player-stats').get_attribute('aria-modal')=='true','mobile statistics opens accessibly')
    check(page.locator('.player-question-card').evaluate('(e)=>e.inert'),'game inert while stats modal open')
    page.evaluate('emit(lastState)')
    check(page.locator('#player-stats').evaluate('(e)=>e.contains(document.activeElement)'),'stats focus survives server repaint')
    page.keyboard.press('Shift+Tab');check(page.locator('#player-stats').evaluate('(e)=>e.contains(document.activeElement)'),'stats keyboard focus trapped')
    page.keyboard.press('Escape');check(page.locator('#player-stats').is_hidden(),'Escape closes stats')
    check(page.locator('[data-player-action="stats"]').evaluate('(e)=>e===document.activeElement'),'stats button regains focus')
    # Long content remains readable rather than being truncated or scaled down.
    long=state();long['me']['question']['text']='Explica la frase en español. '*16
    long['me']['question']['options']=['A'*180,'B'*180,'C'*180,'D'*180]
    page.evaluate('s=>emit(s)',long)
    check(page.locator('.question-scroll').evaluate('(e)=>e.scrollHeight>e.clientHeight'),'long prompt uses internal scrolling')
    page.locator('.question-scroll').evaluate('(e)=>e.scrollTop=100')
    page.evaluate('emit(lastState)');check(page.locator('.question-scroll').evaluate('(e)=>e.scrollTop')==100,'internal scroll retained on heartbeat')
    long['me']['question']['key']='question2';page.evaluate('s=>emit(s)',long)
    check(page.locator('.question-scroll').evaluate('(e)=>e.scrollTop')==0,'new question resets internal scroll')
    page.locator('[data-action="answer"]').last.scroll_into_view_if_needed()
    check(page.locator('[data-action="answer"]').last.is_visible(),'long last answer reachable')
    # Outcome controls survive both normal and very short windows.
    for w,h in [(320,568),(667,375),(1366,768)]:
      page.set_viewport_size({'width':w,'height':h})
      s=state();s['me']['feedback']={'correct':True,'selected':0,'correctAnswers':['To learn'],'reward':'Choose your chest!'};s['me']['pendingChests']=True
      page.evaluate('s=>emit(s)',s)
      page.locator('[data-action="chest"]').last.scroll_into_view_if_needed();page.locator('[data-action="chest"]').last.click()
      check(page.evaluate("sent.at(-1).type==='chest'"),f'chest reachable {w}x{h}')
      s['me']['pendingChests']=False;page.evaluate('s=>emit(s)',s)
      page.locator('[data-action="next"]').click();check(page.evaluate("sent.at(-1).type==='next'"),f'next reachable {w}x{h}')
    page.set_viewport_size({'width':1366,'height':768});page.evaluate('s=>emit(s)',state('treasure'))
    page.screenshot(path=str(OUT/'player-desktop.png'))
    # Real Chromium fullscreen: stable document survives snapshots, then exits on Leave.
    page.locator('[data-player-action="fullscreen"]').click()
    page.wait_for_function('!!document.fullscreenElement')
    check(page.locator('[data-player-action="fullscreen"]').inner_text()=='Exit fullscreen','native fullscreen button label')
    page.evaluate('emit(lastState)');check(page.evaluate('document.fullscreenElement===document.documentElement'),'fullscreen survives snapshot repaint')
    page.locator('[data-action="leave"]').click();page.wait_for_function('!document.fullscreenElement')
    check(not page.locator('body').evaluate("e=>e.classList.contains('player-mode')"),'leaving restores ordinary page')
    check(page.locator('footer').is_visible(),'home footer restored')
    context.close()
    # Unsupported/rejected fullscreen, without interfering with gameplay.
    for kind in ['unsupported','rejected']:
      c=browser.new_context(viewport={'width':390,'height':844})
      q=attach(c,fullscreen_kind=kind);q.evaluate('s=>emit(s)',state());q.locator('[data-player-action="fullscreen"]').click()
      check(q.locator('#toast').inner_text().lower().find('browser' if kind=='unsupported' else 'blocked')>=0,kind+' fullscreen gives explanation')
      check(q.locator('[data-action="answer"]').count()==4,kind+' fullscreen leaves answers intact')
      c.close()
    # Teacher next-game choices persist during heartbeat and send correct mode/duration.
    c=browser.new_context(viewport={'width':1366,'height':768});q=attach(c,'host');s=state(status='finished');s['isHost']=True
    q.evaluate('s=>emit(s)',s);q.locator('#next-mode').select_option('factory');q.locator('#duration').select_option('5');q.evaluate('emit(lastState)')
    check(q.locator('#next-mode').input_value()=='factory','next game selection survives heartbeat')
    check(q.locator('#duration').input_value()=='5','duration survives heartbeat')
    q.screenshot(path=str(OUT/'teacher-next-game.png'))
    q.locator('[data-action="start"]').click();check(q.evaluate("sent.at(-1).mode==='factory' && sent.at(-1).minutes===5"),'teacher starts new mode in same room')
    check(q.evaluate('connections.length===1'),'changing mode does not reconnect teacher')
    c.close();browser.close()
check(not errors, 'no uncaught browser errors: '+repr(errors))
(OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2))
print(f'{len(checks)} browser assertions passed')
