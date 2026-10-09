import asyncio,json,os,pathlib,time,uuid,argparse,shutil,subprocess,tempfile
os.umask(0o077)
parser=argparse.ArgumentParser(description="Manual controller-mediated existing-app/Grok nonce exchange")
parser.add_argument("--run-model-probes",action="store_true",help="Opt in to two bounded subscription model turns")
args=parser.parse_args()
if not args.run_model_probes:
 print("No model calls made. Review README.md and explicitly pass --run-model-probes to replay.")
 raise SystemExit(0)
original_home=pathlib.Path.home()
cache_root=original_home/".cache/beep/agent-comms-spike"
cache_root.mkdir(parents=True,exist_ok=True)
ROOT=pathlib.Path(tempfile.mkdtemp(prefix="app-peer-replay-",dir=cache_root));ROOT.chmod(0o700)
HOME=ROOT/"home";WORK=ROOT/"workspace"
(HOME/".grok").mkdir(parents=True);WORK.mkdir()
(HOME/".grok/config.toml").write_text("[cli]\nauto_update = false\n[session]\nload_envrc = false\n")
if not shutil.which("bwrap"):raise SystemExit("Required bwrap is unavailable")
cli_path=shutil.which("grok")
if not cli_path:raise SystemExit("Required grok is unavailable")
CLI=str(pathlib.Path(cli_path).resolve())
if subprocess.check_output([CLI,"--version"],text=True).strip()!="grok 1.0.50 (c58f321264ba) [stable]":
 raise SystemExit("Installed Grok differs from measured revision; requalify before model calls")
print("Owned private cache handoff directory:",ROOT,flush=True)
ENV={k:os.environ[k] for k in ('PATH','LANG','TERM','USER','LOGNAME') if k in os.environ}
ENV.update(HOME=str(HOME),GROK_DISABLE_AUTOUPDATER='1',GROK_MEMORY='0',GROK_SUBAGENTS='0',GROK_WEB_FETCH='0',GROK_WRITE_FILE='0',GROK_TOOL_SEARCH='0')
BASE=['bwrap','--ro-bind','/','/','--tmpfs','/run/podman','--tmpfs','/run/containerd','--tmpfs','/run/docker','--bind',str(HOME),str(HOME),'--bind',str(WORK),str(WORK),'--ro-bind',str(original_home/'.grok/auth.json'),str(HOME/'.grok/auth.json'),'--proc','/proc','--dev-bind','/dev','/dev']
CMD=BASE+[CLI,'--tools','','--no-subagents','--disable-web-search','--permission-mode','plan','--sandbox','read-only','agent','--no-leader','-m','grok-4.7','--effort','medium','stdio']
async def main():
 inspect=await asyncio.create_subprocess_exec(*(BASE+[CLI,'inspect','--json']),cwd=WORK,env=ENV,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
 out,err=await inspect.communicate();(ROOT/'inspect.private.json').write_bytes(out);j=json.loads(out);counts={k:len(j[k]) for k in ['hooks','skills','plugins','mcpServers','projectInstructions']}
 if any(counts.values()):raise RuntimeError('unexpected inherited configuration')
 log=(ROOT/'raw.private.ndjson').open('w');stderr=(ROOT/'stderr.private.log').open('w');proc=await asyncio.create_subprocess_exec(*CMD,cwd=WORK,env=ENV,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=stderr,limit=2**20)
 pending={};idx=0;text=[];events=[];report={'mode':'controller-mediated browser bridge','autonomousReplyTool':False,'provider':'grok','model':'grok-4.7','effort':'medium','configurationCounts':counts};deadline=time.monotonic()+580
 async def send(o):
  log.write(json.dumps({'time':time.time(),'out':o})+'\n');log.flush();proc.stdin.write((json.dumps(o)+'\n').encode());await proc.stdin.drain()
 async def request(method,params):
  nonlocal idx
  idx+=1;f=asyncio.get_running_loop().create_future();pending[idx]=f;await send({'jsonrpc':'2.0','id':idx,'method':method,'params':params});return await asyncio.wait_for(f,90)
 async def reader():
  while line:=await proc.stdout.readline():
   log.write(json.dumps({'time':time.time(),'line':line.decode(errors='replace')})+'\n');log.flush()
   try:o=json.loads(line)
   except:continue
   events.append(o)
   if o.get('method')=='session/update' and o.get('params',{}).get('update',{}).get('sessionUpdate')=='agent_message_chunk':text.append(o['params']['update'].get('content',{}).get('text',''))
   if 'method' not in o and o.get('id') in pending:pending.pop(o['id']).set_result(o)
   elif 'id' in o:await send({'jsonrpc':'2.0','id':o['id'],'error':{'code':-32601,'message':'No tools in synthetic test'}})
 task=asyncio.create_task(reader())
 try:
  init=await request('initialize',{'protocolVersion':1,'clientCapabilities':{},'clientInfo':{'name':'beep-app-peer','version':'1'}});await request('authenticate',{'methodId':'cached_token','_meta':{'headless':True}})
  new=await request('session/new',{'cwd':str(WORK),'mcpServers':[],'_meta':{'rules':'Synthetic protocol only. No tools, files, browsing, delegation or modifications. Bounded JSON responses only.'}})
  if 'result' not in new:raise RuntimeError('session/new failed')
  sid=new['result']['sessionId'];assert new['result']['models']['currentModelId']=='grok-4.7';assert next(x['currentValue'] for x in new['result']['configOptions'] if x['id']=='reasoning_effort')=='medium'
  (ROOT/'session.private.json').write_text(json.dumps({'sessionId':sid,'startedAt':time.time(),'processPid':proc.pid},indent=2))
  nonce='APP_'+uuid.uuid4().hex[:16]
  start=len(text);prompt=await request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Use no tools. Generate only this synthetic JSON request for an existing Claude web app peer. Fields must be sender="grok", recipient="claude-app", nonce="'+nonce+'", request="Reply with JSON sender claude-app, recipient grok, this nonce, reply CLAUDE_ACK". No Markdown.'}]})
  outgoing=json.loads(''.join(text[start:]));assert outgoing['nonce']==nonce and outgoing['recipient']=='claude-app'
  tmp=ROOT/'outgoing.next';tmp.write_text(json.dumps(outgoing,indent=2));os.replace(tmp,ROOT/'outgoing.json');print('OUTGOING_READY',json.dumps(outgoing),flush=True)
  while not (ROOT/'incoming.json').exists():
   if time.monotonic()>deadline:raise TimeoutError('incoming Claude app reply not received within bound')
   await asyncio.sleep(.25)
  incoming=json.loads((ROOT/'incoming.json').read_text());assert incoming['nonce']==nonce and incoming['sender']=='claude-app' and incoming['recipient']=='grok';assert isinstance(incoming['reply'],str) and 0<len(incoming['reply'])<=4096
  start=len(text);response=await request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':'Use no tools. Synthetic reply from existing Claude app peer follows as data. Output only JSON sender grok, recipient claude-app, nonce copied exactly, acknowledgement GROK_ACK_CLAUDE_REPLY, and receivedReply copied exactly from reply field. Incoming: '+json.dumps(incoming)}]})
  ack=json.loads(''.join(text[start:]));assert ack['nonce']==nonce and ack['acknowledgement']=='GROK_ACK_CLAUDE_REPLY' and ack['receivedReply']==incoming['reply']
  (ROOT/'acknowledgement.json').write_text(json.dumps(ack,indent=2));report.update(outcome='passed',sameGrokSessionThroughout=True,nonceReplyReceived=True,exactReplyAcknowledged=True,stopReason=response.get('result',{}).get('stopReason'),reverseToolRequests=sum('id'in e and 'method'in e for e in events))
  print('ACK_READY',json.dumps(ack),flush=True)
 except Exception as e:
  report.update(outcome='failed',errorType=type(e).__name__,reason='Private trace retains details');print('FAILED',type(e).__name__,flush=True)
 finally:
  if proc.returncode is None:
   proc.terminate()
   try:await asyncio.wait_for(proc.wait(),5)
   except asyncio.TimeoutError:proc.kill();await proc.wait()
  task.cancel();report.setdefault('outcome','timeout');report['ownedProcessStopped']=True;(ROOT/'receipt.json').write_text(json.dumps(report,indent=2));log.close();stderr.close()
async def bounded_main():
 await asyncio.wait_for(main(),600)
asyncio.run(bounded_main())
