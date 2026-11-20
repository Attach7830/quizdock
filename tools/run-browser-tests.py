"""Run offline UI checks against an isolated, fake-data TLS harness. No Cloudflare credentials."""
from pathlib import Path
import subprocess,ssl,time,urllib.request,sys,os
ROOT=Path(__file__).resolve().parents[1]
CHECKS=ROOT/'checks'
def server_ready():
 try:
  with urllib.request.urlopen('https://localhost:9443/__test/fixture',context=ssl._create_unverified_context(),timeout=1) as r:return r.status==200
 except Exception:return False

def run(scripts=None):
 CHECKS.mkdir(exist_ok=True)
 if server_ready():raise RuntimeError('Port 9443 is already serving a test instance. Stop it before running isolated checks.')
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(CHECKS/'dev-key.pem'),'-out',str(CHECKS/'dev-cert.pem'),'-days','1','-subj','/CN=localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 suites=['browser-checks.py','release-browser-checks.py','arcade-browser-checks.py','player-experience-browser-checks.py','event-character-browser-checks.py','distinct-gameplay-browser-checks.py','practice-navigation-browser-checks.py','semester-assignments-browser-checks.py','single-screen-browser-checks.py','study-features-browser-checks.py','practice-layout-browser-checks.py','wardrobe-browser-checks.py','journey-browser-checks.py','expedition-browser-checks.py','about-browser-checks.py','new-adventures-browser-checks.py','assignment-editing-browser-checks.py','leagues-browser-checks.py']
 selected=scripts or suites
 if any(script not in suites for script in selected):raise ValueError('Choose a known browser suite.')
 for script in selected:
  with (CHECKS/(script+'.server.log')).open('w') as log:
   proc=subprocess.Popen(['node','--import','./test/register.mjs','tools/dev-harness.mjs'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
   try:
    deadline=time.monotonic()+20
    while not server_ready():
     if proc.poll() is not None:raise RuntimeError('Local test server exited. See checks/*.server.log.')
     if time.monotonic()>deadline:raise RuntimeError('Local test server startup timed out.')
     time.sleep(.1)
    subprocess.run([sys.executable,str(ROOT/'tools'/script)],cwd=ROOT,check=True)
   finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
    time.sleep(.2)
 print('All browser suites passed. Fake-data screenshots are in checks/.')
if __name__=='__main__':run(sys.argv[1:] or None)
