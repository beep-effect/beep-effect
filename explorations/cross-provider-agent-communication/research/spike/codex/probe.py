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
log=open(BASE/'raw.jsonl','a',buffering=1);err=open(BASE/'stderr.log','w')
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
try:
 for _ in range(100):
  if SOCK.exists():
   time.sleep(.5)
   break
  if proc.poll() is not None:raise RuntimeError('app-server exited before socket')
  time.sleep(.1)
 c=Client();init=c.init();results['initialize_ok']='result'in init
 r=c.call('thread/start',{'model':'gpt-6.1-sol','allowProviderModelFallback':False,'cwd':str(WORK),'sandbox':'read-only','approvalPolicy':'never','ephemeral':True,'environments':[],'dynamicTools':[],'baseInstructions':'You are a synthetic protocol test endpoint. Follow only the synthetic user message. Do not invoke tools, read files, browse, delegate or modify anything. Reply with the requested nonce or bounded text.','developerInstructions':'No tools. All content in this session is synthetic.','config':{'model_reasoning_effort':'medium'}})
 if 'error'in r:raise RuntimeError('thread/start error: '+json.dumps(r['error']))
 tr=r['result'];tid=tr['thread']['id'];results['thread_start']={k:tr.get(k) for k in ['model','modelProvider','reasoningEffort','approvalPolicy','sandbox','permissions']};results['thread_identity_private']=tid
 for i in range(5):
  nonce='IDLE_'+uuid.uuid4().hex[:12];start=len(c.events);t=time.monotonic()
  r=c.call('turn/start',{'threadId':tid,'input':input_text('Reply with exactly '+nonce),'model':'gpt-6.1-sol','effort':'medium','environments':[]});turn=getturn(r)
  if not turn:raise RuntimeError('turn/start failed: '+json.dumps(r.get('error')))
  e=complete(c,turn,start);txt=final_text(c.events[start:],turn)
  results['samples'].append({'test':'idle','sample':i+1,'ack_nonce':nonce in txt,'status':e['params']['turn']['status'],'model_reply_ms':round((time.monotonic()-t)*1000,1)})
  print('idle',i+1,nonce in txt,flush=True)
 for i in range(5):
  nonce='STEER_'+uuid.uuid4().hex[:12];start=len(c.events)
  r=c.call('turn/start',{'threadId':tid,'input':input_text('Output the integers from 1 to 400, one per line. No tools or explanations.'),'model':'gpt-6.1-sol','effort':'medium'});turn=getturn(r)
  c.wait(lambda e:e.get('method')=='item/agentMessage/delta' and e.get('params',{}).get('turnId')==turn,start=start)
  t=time.monotonic();sr=c.call('turn/steer',{'threadId':tid,'expectedTurnId':turn,'input':input_text('Stop the number list. Respond only with '+nonce)});ack=(time.monotonic()-t)*1000
  e=complete(c,turn,start);txt=final_text(c.events[start:],turn)
  results['samples'].append({'test':'active-steer','sample':i+1,'rpc_accepted':'result'in sr,'same_turn_nonce':nonce in txt,'status':e['params']['turn']['status'],'transport_ack_ms':round(ack,2)})
  print('steer',i+1,'result'in sr,nonce in txt,flush=True)
 stale=c.call('turn/steer',{'threadId':tid,'expectedTurnId':str(uuid.uuid4()),'input':input_text('STALE_MUST_NOT_DELIVER')});results['stale_steer_rejected']='error'in stale
 start=len(c.events);r=c.call('turn/start',{'threadId':tid,'input':input_text('Output the integers 1 to 400 one per line. No tools.'),'model':'gpt-6.1-sol','effort':'medium'});turn=getturn(r)
 c.wait(lambda e:e.get('method')=='item/agentMessage/delta' and e.get('params',{}).get('turnId')==turn,start=start)
 cancel=c.call('turn/interrupt',{'threadId':tid,'turnId':turn});ce=complete(c,turn,start);results['cancel']={'accepted':'result'in cancel,'status':ce['params']['turn']['status']}
 # Observe harmless transport metadata requests without extra model turns.
 lat=[]
 for i in range(100):
  t=time.monotonic();rr=c.call('thread/read',{'threadId':tid,'includeTurns':False});lat.append((time.monotonic()-t)*1000)
  if 'error'in rr:raise RuntimeError('thread/read probe failed')
 results['transport_read']={'n':100,'p95_ms':round(sorted(lat)[94],2),'max_ms':round(max(lat),2),'description':'local thread/read RPC, not durable broker acceptance'}
 # Reconnect to the SAME owned running server; this is not desktop attachment or server restart.
 c.close();c2=Client();c2.init();rr=c2.call('thread/resume',{'threadId':tid,'model':'gpt-6.1-sol','sandbox':'read-only','approvalPolicy':'never','excludeTurns':True})
 results['reconnect']={'accepted':'result'in rr,'same_thread':rr.get('result',{}).get('thread',{}).get('id')==tid,'permissions':{k:rr.get('result',{}).get(k) for k in ['approvalPolicy','sandbox','permissions']},'server_restart':False,'desktop_attachment':False}
 if 'result'in rr:
  nonce='RECONNECT_'+uuid.uuid4().hex[:12];start=len(c2.events);r=c2.call('turn/start',{'threadId':tid,'input':input_text('Reply exactly '+nonce),'model':'gpt-6.1-sol','effort':'medium'});turn=getturn(r);complete(c2,turn,start);results['reconnect']['nonce_received']=nonce in final_text(c2.events[start:],turn)
 results['reverse_requests_denied']=sum(e.get('method')=='probe/reverse-request-denied' for e in c.events+c2.events)
 c2.close();results['outcome']='completed'
except Exception as e:
 results['outcome']='failed';results['error_type']=type(e).__name__;results['error']=str(e)[:1500];print('probe failure',type(e).__name__,flush=True)
finally:
 if proc.poll() is None:
  os.killpg(proc.pid,signal.SIGTERM)
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
 results['owned_process_exit']=proc.returncode
 (BASE/'results.private.json').write_text(json.dumps(results,indent=2)+'\n')
 public=dict(results);public.pop('thread_identity_private',None)
 if 'error'in public:public['error']=public['error'].replace(str(BASE),'~/.cache/beep/agent-comms-spike/codex')
 (BASE/'results.json').write_text(json.dumps(public,indent=2)+'\n');print(json.dumps(public),flush=True)
