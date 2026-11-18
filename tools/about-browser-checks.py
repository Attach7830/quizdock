"""Public About page: no account required, authentic scrolling art, motion preferences and CTAs."""
from pathlib import Path
import json,os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://localhost:9443';RESULTS=[]
def check(ok,name):
 RESULTS.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def run():
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or None,headless=True,args=['--no-sandbox']);ctx=b.new_context(ignore_https_errors=True,viewport={'width':1440,'height':900});s=ctx.new_page();errors=[];apis=[];s.on('pageerror',lambda e:errors.append(str(e)));s.on('request',lambda r:apis.append(r.url) if '/api/' in r.url else None)
  response=s.goto(BASE+'/about.html');s.wait_for_selector('[data-hero-avatar] svg');check(response.status==200 and 'A little practice.' in s.locator('h1').inner_text(),'About page opens without any student or teacher session');check(not apis,'public About does not request private account or class APIs');check(s.locator('.about-hero a[href="/play.html"]').count()==1 and s.locator('.about-nav a[href="/"]').count()>=1,'hero and navigation provide real join and sign-in destinations');check(s.locator('.about-beat[data-world]').count()==8,'all eight actual game worlds are introduced')
  s.screenshot(path=str(ROOT/'checks/about-desktop.png'))
  for mode in ['treasure','fishing','battle','factory','rally','keep','word','sketch']:
   s.locator('.about-beat[data-world="'+mode+'"]').scroll_into_view_if_needed();s.wait_for_function('(mode)=>document.querySelector(".about-stage").dataset.world===mode',arg=mode);check(s.locator('[data-preview-world="'+mode+'"]').get_attribute('aria-pressed')=='true','scrolling changes the artwork and accessible selection to '+mode)
   if mode=='sketch':check(s.locator('.about-sketch').is_visible(),'drawing world changes from the game canvas to a vocabulary mural')
  s.locator('[data-preview-world=treasure]').click();s.wait_for_function('document.querySelector(".about-stage").dataset.world==="treasure"');check(s.locator('.about-scene-mount').is_visible(),'world navigation returns to the original treasure artwork');s.locator('.about-stage .about-motion').click();check(s.locator('body').get_attribute('data-motion')=='off','visitor can pause page and scene animation');s.locator('[data-outfit=party]').click();check('billion points' in s.locator('.about-outfit-caption').inner_text() and 'Billion' in s.locator('[data-outfit=party]').inner_text(),'free outfit preview explains the real absurd trophy items');check(s.locator('[data-outfit=party]').get_attribute('aria-pressed')=='true','outfit selection is announced accessibly');s.locator('[data-outfit=duck]').click();check('Council of Tiny Ducks' in s.locator('.about-outfit-caption').inner_text(),'interactive outfit previews use existing original accessories')
  for width,height in [(320,568),(390,844),(768,1024),(1024,600),(1440,900)]:
   s.set_viewport_size({'width':width,'height':height});s.evaluate('scrollTo(0,0)');s.wait_for_timeout(100);check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'public About fits width '+str(width));s.locator('.about-beat[data-world=fishing]').scroll_into_view_if_needed();s.wait_for_timeout(120);check(s.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'sticky world graphics fit width '+str(width))
  s.set_viewport_size({'width':390,'height':844});s.evaluate('scrollTo(0,0)');s.screenshot(path=str(ROOT/'checks/about-phone.png'));check(not errors,'About page art and interactions have no uncaught browser errors');check(not apis,'exploring all game and avatar previews never accesses student data')
  reduced=b.new_context(ignore_https_errors=True,viewport={'width':390,'height':844},reduced_motion='reduce');r=reduced.new_page();r.goto(BASE+'/about.html');r.wait_for_selector('[data-hero-avatar] svg');check(r.locator('body').get_attribute('data-motion')=='off' and r.locator('.about-stage .about-motion').is_disabled(),'system reduced-motion preference disables animation');r.locator('.about-beat[data-world=word]').scroll_into_view_if_needed();r.wait_for_function('document.querySelector(".about-stage").dataset.world==="word"');check(r.locator('[data-world-title]').inner_text()=='Word Forge','reduced-motion visitors still get changing game illustrations');r.goto(BASE+'/');r.wait_for_selector('a[href="/about.html"]');check(r.locator('header a[href="/about.html"]').count()==1,'signed-out homepage offers a convenient About link');b.close()
 print(json.dumps({'checks':len(RESULTS),'passed':sum(x['passed'] for x in RESULTS)}))
if __name__=='__main__':
 try:run()
 finally:(ROOT/'checks/about-results.json').write_text(json.dumps(RESULTS,indent=2))
