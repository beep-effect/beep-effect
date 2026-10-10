import pathlib as _probe_pathlib, sys as _probe_sys
if "--run-model-probes" not in _probe_sys.argv:
 raise SystemExit("Explicit --run-model-probes is required; this consumes the existing subscription")
if not _probe_pathlib.Path(__file__).resolve().is_relative_to(_probe_pathlib.Path.home()/".cache/beep"):
 raise SystemExit("Copy this probe into an owned ~/.cache/beep directory before running; see ../README.md")
import json, os, pathlib, subprocess, socket, threading, queue, time, uuid, tomllib, statistics, signal
from websockets.sync.client import unix_connect
BASE=pathlib.Path(__file__).resolve().parent
os.umask(0o077)
WORK=BASE/'workspace';SOCK=BASE/'control.sock'
WORK.mkdir(exist_ok=True)
CONFIG=tomllib.loads((pathlib.Path.home()/'.codex/config.toml').read_text())
args=['codex','app-server','--listen','unix://'+str(SOCK)]
for key,value in {'model':'gpt-6.1-sol','model_reasoning_effort':'medium','forced_login_method':'chatgpt','project_doc_max_bytes':0,'features.plugins':False,'features.hooks':False,'features.apps':False,'features.memories':False,'features.multi_agent':False,'features.shell_snapshot':False}.items():
 args+=['-c',key+'='+json.dumps(value)]
for name in CONFIG.get('mcp_servers',{}):args+=['-c','mcp_servers.'+name+'.enabled=false']
env=dict(os.environ);env.pop('OPENAI_API_KEY',None)
log=open(BASE/'persistent-raw.private.jsonl','a',buffering=1);err=open(BASE/'persistent-stderr.private.log','w')
proc=subprocess.Popen(args,cwd=WORK,stdin=subprocess.DEVNULL,stdout=err,stderr=err,env=env,start_new_session=True)
results={'provider':'codex','version':'0.162.0','model':'gpt-6.1-sol','effort':'medium','mode':'owned standalone app-server, Unix socket','mcp_disabled_count':len(CONFIG.get('mcp_servers',{})),'plugins_hooks_apps_disabled':True,'samples':[]}
class Client:
 def __init__(self):
  self.ws=unix_connect(str(SOCK),open_timeout=10);self.f=self.ws;self.q=queue.Queue();self.counter=0;self.events=[];self.responses={};self.closed=False
  threading.Thread(target=self.read,daemon=True).start()
 def read(self):
  try:
   for line in self.f:
    msg=json.loads(line);log.write(json.dumps({'at':time.time(),'in':msg})+'\n');self.q.put(msg)
  except Exception:pass
 def send(self,m):self.ws.send(json.dumps(m))
 def consume(self,timeout=60):
  m=self.q.get(timeout=timeout)
  if 'id' in m and ('result'in m or 'error'in m):self.responses[m['id']]=m
  elif 'id'in m:
   self.send({'id':m['id'],'error':{'code':-32000,'message':'Probe forbids tool and permission requests'}})
   self.events.append({'method':'probe/reverse-request-denied','params':{'method':m.get('method')}})
  else:self.events.append(m)
  return m
 def call(self,method,params,timeout=60):
  self.counter+=1;i=self.counter;self.send({'id':i,'method':method,'params':params});deadline=time.monotonic()+timeout
  while i not in self.responses:
   self.consume(max(0.01,deadline-time.monotonic()))
  return self.responses.pop(i)
 def init(self):
  r=self.call('initialize',{'clientInfo':{'name':'beep-capability-spike','version':'0.1.0'},'capabilities':{'experimentalApi':True}});self.send({'method':'initialized','params':{}});return r
 def wait(self,predicate,timeout=60,start=0):
  deadline=time.monotonic()+timeout
  while True:
   for e in self.events[start:]:
    if predicate(e):return e
   self.consume(max(0.01,deadline-time.monotonic()))
 def close(self):
  self.closed=True
  self.ws.close()
def input_text(t):return [{'type':'text','text':t,'text_elements':[]}]
def getturn(r):return r.get('result',{}).get('turn',{}).get('id')
def final_text(events,turn):
 out=[]
 for e in events:
  p=e.get('params',{});item=p.get('item',{})
  if p.get('turnId')==turn and e.get('method')=='item/completed' and item.get('type')=='agentMessage':out.append(item.get('text',''))
 return '\n'.join(out)
def complete(c,turn,start):return c.wait(lambda e:e.get('method')=='turn/completed' and e.get('params',{}).get('turn',{}).get('id')==turn,start=start)
def wait_socket():
 for _ in range(100):
  if SOCK.exists():time.sleep(.3);return
  if proc.poll() is not None:raise RuntimeError('server exited')
  time.sleep(.1)
def snapshot(r):return {k:r.get('result',{}).get(k) for k in ['model','reasoningEffort','approvalPolicy','sandbox','permissions']}
def echo(c,tid,prefix):
 nonce=prefix+'_'+uuid.uuid4().hex[:12];start=len(c.events);r=c.call('turn/start',{'threadId':tid,'input':input_text('Reply exactly '+nonce),'model':'gpt-6.1-sol','effort':'medium'});turn=getturn(r);complete(c,turn,start);return nonce in final_text(c.events[start:],turn)
def stop_server():
 if proc.poll() is None:
  os.killpg(proc.pid,signal.SIGTERM)
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
results={'provider':'codex','test':'owned persistent session reconnect and permission continuity','model':'gpt-6.1-sol','effort':'medium','samples':[]}
tid=None;c=None
try:
 wait_socket();c=Client();c.init()
 r=c.call('thread/start',{'model':'gpt-6.1-sol','allowProviderModelFallback':False,'cwd':str(WORK),'sandbox':'read-only','approvalPolicy':'never','ephemeral':False,'environments':[],'dynamicTools':[],'baseInstructions':'Synthetic communication endpoint. Echo requested nonces only. No tools, files, delegation or external actions.','developerInstructions':'Do not use tools. This is an isolated protocol test.','config':{'model_reasoning_effort':'medium'}})
 if 'error'in r:raise RuntimeError(json.dumps(r['error']))
 tid=r['result']['thread']['id'];before=snapshot(r);results['before']=before;results['initial_nonce']=echo(c,tid,'INITIAL')
 c.close();c=Client();c.init();r=c.call('thread/resume',{'threadId':tid,'excludeTurns':True});after=snapshot(r)
 results['client_reconnect']={'accepted':'result'in r,'same_thread':r.get('result',{}).get('thread',{}).get('id')==tid,'permission_equal':all(before[k]==after[k] for k in ['approvalPolicy','sandbox','permissions']),'model_equal':before['model']==after['model'],'after':after}
 if not results['client_reconnect']['permission_equal']:raise RuntimeError('Permission continuity failure; no further inference')
 results['client_reconnect']['nonce']=echo(c,tid,'RECONNECTED')
 c.close();stop_server()
 if SOCK.exists():SOCK.unlink()
 proc=subprocess.Popen(args,cwd=WORK,stdin=subprocess.DEVNULL,stdout=err,stderr=err,env=env,start_new_session=True);wait_socket();c=Client();c.init();r=c.call('thread/resume',{'threadId':tid,'excludeTurns':True});after=snapshot(r)
 results['server_restart']={'accepted':'result'in r,'same_thread':r.get('result',{}).get('thread',{}).get('id')==tid,'permission_equal':all(before[k]==after[k] for k in ['approvalPolicy','sandbox','permissions']),'model_equal':before['model']==after['model'],'after':after}
 if not results['server_restart']['permission_equal']:raise RuntimeError('Permission continuity failure after server restart; no further inference')
 results['server_restart']['nonce']=echo(c,tid,'RESTARTED')
 # Queue behavior is covered only by the explicit-policy mitigation fixture.
 results['outcome']='completed'
except Exception as e:results['outcome']='failed';results['error_type']=type(e).__name__;results['error']=str(e)[:1000]
finally:
 if c and tid:
  try:results['owned_thread_archived']='result'in c.call('thread/archive',{'threadId':tid},timeout=10)
  except Exception:results['owned_thread_archived']=False
 if c:
  try:c.close()
  except Exception:pass
 stop_server();results['process_exit']=proc.returncode
 (BASE/'persistent-results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results),flush=True)
