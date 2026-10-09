import pathlib as _probe_pathlib, sys as _probe_sys
if not _probe_pathlib.Path(__file__).resolve().is_relative_to(_probe_pathlib.Path.home()/".cache/beep"):
 raise SystemExit("Copy this probe into an owned ~/.cache/beep directory before running; see ../README.md")
"""Disposable fault-injection model of the proposed contract; not Beep production code."""
import sqlite3,json,hashlib,pathlib,subprocess,sys,os,time,threading,uuid
BASE=pathlib.Path(__file__).resolve().parent
os.umask(0o077)
def db(p):
 c=sqlite3.connect(p/'state.sqlite',timeout=5,isolation_level=None);c.execute('PRAGMA journal_mode=WAL');c.execute('PRAGMA synchronous=FULL');return c
def setup(p):
 p.mkdir(parents=True,exist_ok=True)
 with db(p) as c:
  c.executescript('CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, digest TEXT, target TEXT, state TEXT); CREATE TABLE IF NOT EXISTS role(id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, epoch INTEGER, state TEXT, operation TEXT); INSERT OR IGNORE INTO role VALUES(1,"old",1,"active",NULL); CREATE TABLE IF NOT EXISTS receipts(id TEXT, event TEXT, UNIQUE(id,event));')
 (p/'ledger.json').write_text(json.dumps({'owner':'old','epoch':1,'operation':None}))
def digest(payload):return hashlib.sha256(payload.encode()).hexdigest()
def accept(p,mid,payload,target='direct:test'):
 with db(p) as c:
  c.execute('BEGIN IMMEDIATE');r=c.execute('SELECT digest,target FROM messages WHERE id=?',(mid,)).fetchone()
  if r and r!=(digest(payload),target):c.rollback();raise ValueError('identity conflict')
  c.execute('INSERT OR IGNORE INTO messages VALUES(?,?,?,"accepted")',(mid,digest(payload),target));c.execute('INSERT OR IGNORE INTO receipts VALUES(?,"accepted")',(mid,));c.commit()
def claim(p,mid):
 with db(p) as c:
  c.execute('BEGIN IMMEDIATE');r=c.execute('UPDATE messages SET state="dispatched" WHERE id=? AND state="accepted"',(mid,));c.commit();return r.rowcount==1
def handoff(p,stage=None):
 c=db(p);c.execute('BEGIN IMMEDIATE');owner,epoch,state,op=c.execute('SELECT owner,epoch,state,operation FROM role').fetchone()
 if owner=='new' and state=='active':c.commit();c.close();return
 op=op or 'handoff-1'
 c.execute('UPDATE role SET state="reconciling",operation=? WHERE id=1',(op,))
 if stage=='before_intent_commit':os._exit(70)
 c.commit()
 if stage=='after_intent_commit':os._exit(71)
 tmp=p/'ledger.next';tmp.write_text(json.dumps({'owner':'new','epoch':2,'operation':op}));os.replace(tmp,p/'ledger.json')
 if stage=='after_ledger_write':os._exit(72)
 facts=json.loads((p/'ledger.json').read_text());assert facts=={'owner':'new','epoch':2,'operation':op}
 c.execute('BEGIN IMMEDIATE');current=c.execute('SELECT state,operation FROM role').fetchone()
 assert current==('reconciling',op)
 c.execute('UPDATE role SET owner="new",epoch=2,state="active" WHERE id=1');c.commit();c.close()
 if stage=='after_activation':os._exit(73)
def allowed(p,owner,epoch):
 with db(p) as c:r=c.execute('SELECT owner,epoch,state FROM role').fetchone()
 facts=json.loads((p/'ledger.json').read_text());return r==(owner,epoch,'active') and facts['owner']==owner and facts['epoch']==epoch
def resolve(p,target):
 if target.startswith('direct:'):return target
 with db(p) as c:r=c.execute('SELECT owner,epoch,state FROM role').fetchone()
 return r[:2] if r[2]=='active' and allowed(p,r[0],r[1]) else None
def worker():
 p=pathlib.Path(sys.argv[2]);kind=sys.argv[3]
 if kind=='handoff':handoff(p,sys.argv[4])
 elif kind=='accept_before':
  c=db(p);c.execute('BEGIN IMMEDIATE');c.execute('INSERT INTO messages VALUES("crash",?,"direct:test","accepted")',(digest('x'),));os._exit(74)
 elif kind=='accept_after':accept(p,'crash','x');os._exit(75)
if len(sys.argv)>1 and sys.argv[1]=='worker':worker();sys.exit(0)
run=BASE/('run-'+uuid.uuid4().hex[:8]);run.mkdir();tests=[]
def record(name,ok,**extra):tests.append({'test':name,'passed':bool(ok),**extra});assert ok,name
p=run/'dedupe';setup(p)
accept(p,'m1','hello');accept(p,'m1','hello')
with db(p) as c:count=c.execute('SELECT count(*) FROM messages').fetchone()[0]
record('duplicate acceptance gives one logical message',count==1)
try:accept(p,'m1','different');conflict=False
except ValueError:conflict=True
record('same ID different payload refused',conflict)
a=[]
ts=[threading.Thread(target=lambda:a.append(claim(p,'m1'))) for _ in range(2)]
for t in ts:t.start()
for t in ts:t.join()
record('concurrent dispatch claim single winner',sum(a)==1)
for where in ['accept_before','accept_after']:
 p=run/where;setup(p);r=subprocess.run([sys.executable,__file__,'worker',str(p),where],timeout=10)
 with db(p) as c:count=c.execute('SELECT count(*) FROM messages').fetchone()[0]
 record('crash '+where,count==(0 if where=='accept_before' else 1),child_exit=r.returncode)
 accept(p,'crash','x')
 with db(p) as c:count=c.execute('SELECT count(*) FROM messages').fetchone()[0]
 record('retry after '+where,count==1)
# Deliberately lose the acknowledgement after synthetic external consumption.
p=run/'ambiguity';setup(p);accept(p,'m1','x');assert claim(p,'m1');(p/'external-consumption.json').write_text(json.dumps({'m1':1}))
with db(p) as c:c.execute('UPDATE messages SET state="ambiguous" WHERE id="m1"');c.execute('INSERT INTO receipts VALUES("m1","ambiguous")')
record('unknown consumption held rather than redispatched',not claim(p,'m1'))
with db(p) as c:state=c.execute('SELECT state FROM messages').fetchone()[0]
record('non-reconcilable route retains ambiguous state',state=='ambiguous')
with db(p) as c:c.execute('UPDATE messages SET state="context-received" WHERE id="m1"');c.execute('INSERT INTO receipts VALUES("m1","context-received")')
record('reconciled receipt without duplicate external action',json.loads((p/'external-consumption.json').read_text())['m1']==1 and not claim(p,'m1'))
for stage in ['before_intent_commit','after_intent_commit','after_ledger_write','after_activation']:
 p=run/stage;setup(p);r=subprocess.run([sys.executable,__file__,'worker',str(p),'handoff',stage],timeout=10)
 both=allowed(p,'old',1) and allowed(p,'new',2);record('no dual authority at '+stage,not both,child_exit=r.returncode)
 if stage in ['after_intent_commit','after_ledger_write']:record('mismatch held at '+stage,not allowed(p,'old',1) and not allowed(p,'new',2))
 handoff(p);record('handoff recovered '+stage,allowed(p,'new',2) and not allowed(p,'old',1))
 record('role/direct address separation '+stage,resolve(p,'role:orchestrator')==('new',2) and resolve(p,'direct:old-run')=='direct:old-run')
# An accepted control action holds the executor transaction; handoff waits.
p=run/'inflight';setup(p);entered=threading.Event();release=threading.Event();done=threading.Event()
def control():
 with db(p) as c:
  c.execute('BEGIN IMMEDIATE');assert c.execute('SELECT owner,epoch,state FROM role').fetchone()==('old',1,'active');entered.set();release.wait(timeout=3);c.execute('INSERT INTO receipts VALUES("action","completed")');c.commit()
def transfer():handoff(p);done.set()
t=threading.Thread(target=control);t.start();assert entered.wait(timeout=2);h=threading.Thread(target=transfer);h.start();time.sleep(.1);record('handoff waits for accepted in-flight action',not done.is_set());release.set();t.join();h.join();record('handoff completes after action outcome',done.is_set() and allowed(p,'new',2))
record('stale predecessor action refused',not allowed(p,'old',1))
# Two distinct claimants cannot both advance an active handoff in this model.
p=run/'competing';setup(p);wins=[]
def contender(op):
 with db(p) as c:
  c.execute('BEGIN IMMEDIATE');r=c.execute('UPDATE role SET state="reconciling",operation=? WHERE state="active" AND epoch=1',(op,));c.commit();wins.append(r.rowcount)
ts=[threading.Thread(target=contender,args=(str(i),)) for i in range(2)]
for t in ts:t.start()
for t in ts:t.join()
record('competing handoff claims one accepted',sum(wins)==1)
p=run/'latency';setup(p);lat=[]
for i in range(100):
 t=time.monotonic();accept(p,str(i),'synthetic');lat.append((time.monotonic()-t)*1000)
record('100 durable local accepts',len(lat)==100)
result={'scope':'synthetic SQLite contract model, not implemented Beep service or provider evidence','tests':tests,'passed':sum(t['passed'] for t in tests),'failed':sum(not t['passed'] for t in tests),'latency':{'n':100,'p95_ms':round(sorted(lat)[94],3),'max_ms':round(max(lat),3),'scope':'this local SQLite FULL-sync fixture only'}}
(BASE/'results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='tests'}))
