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
async def main():
 inspect=await asyncio.create_subprocess_exec(*(BASE+[CLI,'inspect','--json']),cwd=WORK,env=ENV,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
 out,err=await inspect.communicate();(ROOT/'isolated-inspect.private.json').write_bytes(out)
 j=json.loads(out); counts={k:len(j[k]) for k in ['hooks','skills','agents','plugins','mcpServers','projectInstructions']}
 print('CONFIG_COUNTS',json.dumps(counts),flush=True)
 if any(counts[k] for k in ['hooks','skills','plugins','mcpServers','projectInstructions']):raise RuntimeError('inherited active config')
 log=(ROOT/'prefixed-probes.private.ndjson').open('w'); stderr=(ROOT/'prefixed-probes.stderr.private.log').open('w')
 proc=await asyncio.create_subprocess_exec(*CMD,cwd=WORK,env=ENV,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=stderr,limit=2**20)
 pending={}; idx=0; events=[]; text=[]
 async def send(obj):
  log.write(json.dumps({'direction':'sent','time':time.time(),'message':obj})+'\n');log.flush();proc.stdin.write((json.dumps(obj)+'\n').encode());await proc.stdin.drain()
 async def request(method,params):
  nonlocal idx
  idx+=1;f=asyncio.get_running_loop().create_future();pending[idx]=f;await send({'jsonrpc':'2.0','id':idx,'method':method,'params':params});return await asyncio.wait_for(f,100)
 async def reader():
  while line:=await proc.stdout.readline():
   log.write(json.dumps({'direction':'received','time':time.time(),'line':line.decode(errors='replace')})+'\n');log.flush()
   try:o=json.loads(line)
   except ValueError:continue
   events.append((time.time(),o))
   if o.get('method')=='session/update' and o.get('params',{}).get('update',{}).get('sessionUpdate')=='agent_message_chunk': text.append((time.time(),o['params']['update'].get('content',{}).get('text','')))
   if 'method' not in o and o.get('id') in pending: pending.pop(o['id']).set_result(o)
   elif 'id' in o:
    if o.get('method')=='session/request_permission':await send({'jsonrpc':'2.0','id':o['id'],'result':{'outcome':{'outcome':'cancelled'}}})
    else:await send({'jsonrpc':'2.0','id':o['id'],'error':{'code':-32601,'message':'Tools disabled in synthetic probe'}})
 task=asyncio.create_task(reader())
 try:
  init=await request('initialize',{'protocolVersion':1,'clientCapabilities':{},'clientInfo':{'name':'beep-synthetic-probe','version':'1'}})
  (ROOT/'initialize.private.json').write_text(json.dumps(init,indent=2));print('INIT_RESULT_KEYS',list(init.get('result',{})),flush=True)
  auth=await request('authenticate',{'methodId':'cached_token','_meta':{'headless':True}});print('AUTH_SUCCESS','result' in auth,flush=True)
  new=await request('session/new',{'cwd':str(WORK),'mcpServers':[],'_meta':{'rules':'Synthetic communication test only. No tools, files, network search or delegation. Answer bounded plain text only.'}})
  (ROOT/'session-new.private.json').write_text(json.dumps(new,indent=2));print('NEW_SUCCESS','result' in new,flush=True)
  if 'result' not in new: raise RuntimeError('session creation failed')
  assert new['result']['models']['currentModelId']=='grok-4.7'
  assert next(x['currentValue'] for x in new['result']['configOptions'] if x['id']=='reasoning_effort')=='medium'
  sid=new['result']['sessionId'];results=[]
  async def wait_nonce(nonce,start,limit=90):
   deadline=time.monotonic()+limit
   while time.monotonic()<deadline:
    joined=''
    for ts,chunk in text:
     if ts>=start:
      joined+=chunk
      if nonce in joined:return {'received':True,'latencySeconds':round(ts-start,3),'receiptTime':ts}
    await asyncio.sleep(.1)
   return {'received':False,'timeout':limit}
  baseline=await request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Synthetic test: use no tools. Reply only BASELINE_READY.'}]})
  print('BASELINE', 'result' in baseline,flush=True)
  if 'error' in baseline:
   (ROOT/'results-prefixed.json').write_text(json.dumps({'blocked':'baseline provider error','errorCode':baseline['error'].get('code')},indent=2));return
  for i in range(5):
   nonce='IDLE_'+uuid.uuid4().hex[:12];start=time.time()
   response=await request('_x.ai/interject',{'sessionId':sid,'text':'Use no tools. Reply only '+nonce,'interjectionId':str(uuid.uuid4())})
   rec=await wait_nonce(nonce,start) if 'result' in response else {'received':False}
   rec.pop('receiptTime',None)
   row={'case':'idle','sample':i+1,'extensionResponse':response.get('result',response.get('error')),**rec};results.append(row);print('CASE',json.dumps(row),flush=True)
   (ROOT/'results-prefixed.json').write_text(json.dumps(results,indent=2))
   if not rec['received']:break
   await asyncio.sleep(.5)
  for i in range(5):
   nonce='BUSY_'+uuid.uuid4().hex[:12];start=time.time()
   turn=asyncio.create_task(request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Use no tools. Generate a bounded list of integers 1 through 180, one per line, and finish with ORIGINAL_DONE. If additional user instructions arrive, answer their nonce plainly.'}]}))
   await asyncio.sleep(.25);was_pending=not turn.done()
   response=await request('_x.ai/interject',{'sessionId':sid,'text':'Use no tools. Reply with exactly '+nonce,'interjectionId':str(uuid.uuid4())})
   completion=await turn;completed=time.time();rec=await wait_nonce(nonce,start)
   nonce_time=rec.pop('receiptTime',None)
   row={'case':'busy','sample':i+1,'promptPendingAtSend':was_pending,'extensionResponse':response.get('result',response.get('error')),'promptStopReason':completion.get('result',{}).get('stopReason'),'nonceBeforePromptCompletion':nonce_time is not None and nonce_time<=completed,**rec};results.append(row);print('CASE',json.dumps(row),flush=True)
   (ROOT/'results-prefixed.json').write_text(json.dumps(results,indent=2))
   if not rec['received']:break
   await asyncio.sleep(.5)
  start=time.time();turn=asyncio.create_task(request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Use no tools. Produce a bounded list of integers 1 through 400, one per line.'}]}))
  await asyncio.sleep(.3);await send({'jsonrpc':'2.0','method':'session/cancel','params':{'sessionId':sid}})
  completion=await turn;row={'case':'cancel','stopReason':completion.get('result',{}).get('stopReason'),'durationSeconds':round(time.time()-start,3)};results.append(row);print('CASE',json.dumps(row),flush=True)
  (ROOT/'results-prefixed.json').write_text(json.dumps(results,indent=2))
  (ROOT/'handshake-result.json').write_text(json.dumps({'version':'1.0.50','launch':CMD,'counts':counts,'initialized':'result' in init,'authenticated':'result' in auth,'newSession':'result' in new,'model':'grok-4.7','effort':'medium'},indent=2))
 finally:
  if proc.returncode is None:
   proc.terminate()
   try:await asyncio.wait_for(proc.wait(),5)
   except asyncio.TimeoutError:proc.kill();await proc.wait()
  task.cancel();log.close();stderr.close()
asyncio.run(main())
