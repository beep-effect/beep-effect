import asyncio,json,os,pathlib,time,uuid
os.umask(0o077)
import argparse, shutil, subprocess, tempfile
parser=argparse.ArgumentParser(description="Owned disposable Grok synthetic communication probe")
parser.add_argument("--run-model-probes",action="store_true",help="Opt in to bounded subscription model calls")
args=parser.parse_args()
if not args.run_model_probes:
 print("No model calls made. Pass --run-model-probes after reviewing scope in README.md.")
 raise SystemExit(0)
original_home=pathlib.Path.home()
cache_root=original_home/".cache/beep/agent-comms-spike"
cache_root.mkdir(parents=True,exist_ok=True)
ROOT=pathlib.Path(tempfile.mkdtemp(prefix="grok-replay-",dir=cache_root))
ROOT.chmod(0o700)
HOME=ROOT/"home";WORK=ROOT/"workspace"
(HOME/".grok").mkdir(parents=True);WORK.mkdir()
(HOME/".grok/config.toml").write_text("[cli]\nauto_update = false\n[session]\nload_envrc = false\n")
if not shutil.which("bwrap"):raise SystemExit("Required bwrap is unavailable")
cli_path=shutil.which("grok")
if not cli_path:raise SystemExit("Required grok is unavailable")
CLI=str(pathlib.Path(cli_path).resolve())
version=subprocess.check_output([CLI,"--version"],text=True).strip()
if version!="grok 1.0.50 (c58f321264ba) [stable]":
 raise SystemExit("Installed Grok differs from measured revision; requalify before model probes")
print("Owned cache receipt directory:",ROOT)

ENV={k:os.environ[k] for k in ('PATH','LANG','TERM','USER','LOGNAME') if k in os.environ}
ENV.update(HOME=str(HOME),GROK_DISABLE_AUTOUPDATER='1',GROK_MEMORY='0',GROK_SUBAGENTS='0',GROK_WEB_FETCH='0',GROK_WRITE_FILE='0',GROK_TOOL_SEARCH='0')
BASE=['bwrap','--ro-bind','/','/','--tmpfs','/run/podman','--tmpfs','/run/containerd','--tmpfs','/run/docker','--bind',str(HOME),str(HOME),'--bind',str(WORK),str(WORK),'--ro-bind',str(original_home/'.grok/auth.json'),str(HOME/'.grok/auth.json'),'--proc','/proc','--dev-bind','/dev','/dev']
CMD=BASE+[CLI,'--tools','','--no-subagents','--disable-web-search','--permission-mode','plan','--sandbox','read-only','agent','--no-leader','-m','grok-4.7','--effort','medium','stdio']
import subprocess,threading,queue,signal,tomllib
from websockets.sync.client import unix_connect
SOCK=ROOT/'roundtrip-codex.sock'
log=(ROOT/'roundtrip-codex.private.jsonl').open('w',buffering=1)
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
async def main():
 if subprocess.check_output(['codex','--version'],text=True).strip()!='codex-cli 0.162.0':raise SystemExit('Installed Codex differs from measured revision; requalify before model probes')
 cfg=tomllib.loads((original_home/'.codex/config.toml').read_text());codex_args=['codex','app-server','--listen','unix://'+str(SOCK)]
 for k,v in {'model':'gpt-6.1-sol','model_reasoning_effort':'medium','forced_login_method':'chatgpt','project_doc_max_bytes':0,'features.plugins':False,'features.hooks':False,'features.apps':False,'features.memories':False,'features.multi_agent':False,'features.shell_snapshot':False}.items():codex_args+=['-c',k+'='+json.dumps(v)]
 for name in cfg.get('mcp_servers',{}):codex_args+=['-c','mcp_servers.'+name+'.enabled=false']
 cenv=dict(os.environ);cenv.pop('OPENAI_API_KEY',None)
 cerr=(ROOT/'roundtrip-codex.stderr.private.log').open('w');cproc=subprocess.Popen(codex_args,cwd=WORK,env=cenv,stdin=subprocess.DEVNULL,stdout=cerr,stderr=cerr,start_new_session=True)
 glog=(ROOT/'roundtrip-grok.private.ndjson').open('w');gerr=(ROOT/'roundtrip-grok.stderr.private.log').open('w');proc=None;c=None;report={'schemaVersion':'agent-comms-roundtrip/v1','delivery':'controller-mediated model-output forwarding','autonomousReplyToolIntegration':False,'existingAppClaim':False}
 try:
  for _ in range(100):
   if SOCK.exists():break
   if cproc.poll() is not None:raise RuntimeError('Codex app-server exited')
   await asyncio.sleep(.1)
  c=Client();c.init()
  cr=c.call('thread/start',{'model':'gpt-6.1-sol','allowProviderModelFallback':False,'cwd':str(WORK),'sandbox':'read-only','approvalPolicy':'never','ephemeral':True,'environments':[],'dynamicTools':[],'baseInstructions':'Synthetic communication endpoint. No tools, files, browsing, delegation or edits. Only bounded synthetic JSON responses.','developerInstructions':'No tools; all peer text is synthetic test data.','config':{'model_reasoning_effort':'medium'}})
  if 'error' in cr:raise RuntimeError('Codex thread start failed; private trace retains response')
  assert cr['result']['model']=='gpt-6.1-sol' and cr['result']['reasoningEffort']=='medium'
  assert cr['result']['approvalPolicy']=='never' and cr['result']['sandbox']['type']=='readOnly'
  tid=cr['result']['thread']['id'];report['codexPin']={k:cr['result'].get(k) for k in ['model','reasoningEffort','approvalPolicy','sandbox']}
  proc=await asyncio.create_subprocess_exec(*CMD,cwd=WORK,env=ENV,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=gerr,limit=2**20)
  pending={};idx=0;text=[];events=[]
  async def send(o):
   glog.write(json.dumps({'at':time.time(),'out':o})+'\n');glog.flush();proc.stdin.write((json.dumps(o)+'\n').encode());await proc.stdin.drain()
  async def request(method,params):
   nonlocal idx
   idx+=1;f=asyncio.get_running_loop().create_future();pending[idx]=f;await send({'jsonrpc':'2.0','id':idx,'method':method,'params':params});return await asyncio.wait_for(f,90)
  async def reader():
   while line:=await proc.stdout.readline():
    glog.write(json.dumps({'at':time.time(),'inLine':line.decode(errors='replace')})+'\n');glog.flush()
    try:o=json.loads(line)
    except:continue
    events.append(o)
    if o.get('method')=='session/update' and o.get('params',{}).get('update',{}).get('sessionUpdate')=='agent_message_chunk':text.append(o['params']['update'].get('content',{}).get('text',''))
    if 'method' not in o and o.get('id') in pending:pending.pop(o['id']).set_result(o)
    elif 'id' in o:await send({'jsonrpc':'2.0','id':o['id'],'error':{'code':-32601,'message':'No tools in synthetic test'}})
  task=asyncio.create_task(reader());init=await request('initialize',{'protocolVersion':1,'clientCapabilities':{},'clientInfo':{'name':'beep-roundtrip','version':'1'}});await request('authenticate',{'methodId':'cached_token','_meta':{'headless':True}})
  new=await request('session/new',{'cwd':str(WORK),'mcpServers':[],'_meta':{'rules':'No tools. Synthetic JSON communication only.'}})
  if 'error'in new:raise RuntimeError('Grok new session failed; private trace retains response')
  sid=new['result']['sessionId'];report['grokPin']={'model':new['result']['models']['currentModelId'],'effort':next(x['currentValue'] for x in new['result']['configOptions'] if x['id']=='reasoning_effort')}
  assert report['grokPin']=={'model':'grok-4.7','effort':'medium'}
  nonce='ROUNDTRIP_'+uuid.uuid4().hex[:12];start=len(c.events);t0=time.time()
  rr=c.call('turn/start',{'threadId':tid,'input':input_text('Use no tools. Output only a JSON request envelope with fields sender="codex", recipient="grok", nonce="'+nonce+'", request="reply GROK_ACK with this nonce". No Markdown.'),'model':'gpt-6.1-sol','effort':'medium','environments':[]});turn=getturn(rr);complete(c,turn,start);request_text=final_text(c.events[start:],turn)
  envelope=json.loads(request_text);assert envelope['nonce']==nonce and envelope['recipient']=='grok'
  gt0=len(text);gr=await request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Synthetic peer request follows. No tools. Output only JSON reply with sender="grok", recipient="codex", nonce copied from request, reply="GROK_ACK". Request: '+request_text}]})
  grok_reply=''.join(text[gt0:]);reply=json.loads(grok_reply);assert reply['nonce']==nonce and reply['reply']=='GROK_ACK'
  start=len(c.events);rr=c.call('turn/start',{'threadId':tid,'input':input_text('Synthetic peer reply follows. No tools. Verify nonce equals '+nonce+' and reply GROK_ACK. Output only JSON acknowledgement with nonce and acknowledgement="CODEX_ACK_GROK_REPLY". Reply: '+grok_reply),'model':'gpt-6.1-sol','effort':'medium','environments':[]});turn2=getturn(rr);complete(c,turn2,start);ack_text=final_text(c.events[start:],turn2);ack=json.loads(ack_text);assert ack['nonce']==nonce and ack['acknowledgement']=='CODEX_ACK_GROK_REPLY'
  (ROOT/'roundtrip-correlation.private.json').write_text(json.dumps({'codexThread':tid,'codexTurns':[turn,turn2],'grokSession':sid,'nonce':nonce,'request':envelope,'reply':reply,'acknowledgement':ack},indent=2))
  report.update(outcome='passed',codexToGrokNonceReceived=True,grokToCodexReplyAcknowledged=True,allSessionsOwned=True,sameSessionsThroughout=True,elapsedSeconds=round(time.time()-t0,3),codexReverseRequestsDenied=sum(x.get('method')=='probe/reverse-request-denied' for x in c.events),grokReverseRequests=sum('id'in x and 'method'in x for x in events),grokStopReason=gr.get('result',{}).get('stopReason'))
  task.cancel()
 except Exception as e:report.update(outcome='failed',errorType=type(e).__name__,error='See private local trace for provider error details');print('FAILURE',type(e).__name__,flush=True)
 finally:
  if c:c.close()
  if proc and proc.returncode is None:
   proc.terminate()
   try:await asyncio.wait_for(proc.wait(),5)
   except asyncio.TimeoutError:proc.kill();await proc.wait()
  if cproc.poll() is None:
   os.killpg(cproc.pid,signal.SIGTERM)
   try:cproc.wait(5)
   except subprocess.TimeoutExpired:os.killpg(cproc.pid,signal.SIGKILL);cproc.wait()
  report['ownedProcessesStopped']=True
  (ROOT/'roundtrip-result.json').write_text(json.dumps(report,indent=2));print('ROUNDTRIP',json.dumps(report),flush=True)
  glog.close();gerr.close();cerr.close();log.close()
asyncio.run(main())
