import pathlib as _probe_pathlib, sys as _probe_sys
if "--run-model-probes" not in _probe_sys.argv:
 raise SystemExit("Explicit --run-model-probes is required; this consumes the existing subscription")
if not _probe_pathlib.Path(__file__).resolve().is_relative_to(_probe_pathlib.Path.home()/".cache/beep"):
 raise SystemExit("Copy this probe into an owned ~/.cache/beep directory before running; see ../README.md")
exec((_probe_pathlib.Path(__file__).resolve().parent/'handshake.py').read_text().split("p=subprocess.Popen")[0])
import signal,uuid
p=subprocess.Popen(args,cwd=root/'workspace',env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,start_new_session=True)
raw=root/'probe-private.jsonl';raw.touch(mode=0o600);os.chmod(raw,0o600)
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'stdout');sel.register(p.stderr,selectors.EVENT_READ,'stderr')
bufs={'stdout':b'','stderr':b''};events=[];session_ids=set();init_summary={};start=time.monotonic();receipts=[]
def send(o):
 p.stdin.write((json.dumps(o)+'\n').encode());p.stdin.flush()
def user(text):send({'type':'user','message':{'role':'user','content':text}})
def read(timeout=1):
 out=[]
 for key,_ in sel.select(timeout):
  data=os.read(key.fileobj.fileno(),65536)
  if not data:sel.unregister(key.fileobj);continue
  name=key.data;bufs[name]+=data
  while b'\n' in bufs[name]:
   line,bufs[name]=bufs[name].split(b'\n',1);log.write(line+b'\n');log.flush()
   try:o=json.loads(line);out.append(o);events.append(o)
   except:continue
   if o.get('session_id'):session_ids.add(o['session_id'])
   if o.get('type')=='system' and o.get('subtype')=='init':
    init_summary.update({'model':o.get('model'),'permissionMode':o.get('permissionMode'),'toolsCount':len(o.get('tools',[])),'mcpServerCount':len(o.get('mcp_servers',[])),'pluginCount':len(o.get('plugins',[])),'skillCount':len(o.get('skills',[]))})
 return out
def until_result(timeout=45):
 deadline=time.monotonic()+timeout;text=[]
 while time.monotonic()<deadline and p.poll() is None:
  for o in read():
   if o.get('type')=='assistant':
    for c in o.get('message',{}).get('content',[]):
     if c.get('type')=='text':text.append(c['text'])
   if o.get('type')=='result':
    if o.get('is_error'):raise RuntimeError('result-error: '+str(o.get('result',''))[:300])
    return o,'\n'.join(text)
 raise RuntimeError('result-timeout-or-process-exit')
summary={'requestedModel':'claude-opus-5-5','requestedEffort':'medium','authRoute':'existing first-party claude.ai Max subscription','cliVersion':'2.1.295','existingAppAttachment':'not probed','channels':'unverified; flag absent in installed help','receipts':receipts}
with raw.open('wb') as log:
 try:
  def bounded_timeout(signum, frame): raise TimeoutError('240-second probe deadline exceeded')
  signal.signal(signal.SIGALRM, bounded_timeout); signal.alarm(240)
  send({'type':'control_request','request_id':'probe-init','request':{'subtype':'initialize'}})
  deadline=time.monotonic()+15
  while time.monotonic()<deadline:
   rs=read()
   if any(o.get('type')=='control_response' for o in rs):break
  for i in range(5):
   nonce='idle-'+uuid.uuid4().hex[:12];t=time.monotonic();user('Reply with exactly this nonce and no other text: '+nonce)
   result,txt=until_result();receipts.append({'case':'idle','index':i+1,'nonce':nonce,'nonceEcho':nonce in (txt+' '+str(result.get('result',''))),'elapsedMs':round((time.monotonic()-t)*1000),'sameSession':len(session_ids)==1})
  for i in range(5):
   nonce='busy-'+uuid.uuid4().hex[:12];user('Write a neutral 300-word explanation of counting, without tools. End with BUSY_TASK_DONE.')
   deadline=time.monotonic()+40;busy=False;first_done=False
   while time.monotonic()<deadline:
    rs=read()
    if any(o.get('type')=='stream_event' and o.get('event',{}).get('type') in ('message_start','content_block_delta') for o in rs):busy=True;break
    if any(o.get('type')=='result' for o in rs):first_done=True;break
   t=time.monotonic();user('After your current response, reply with exactly this nonce and no other text: '+nonce)
   results=[]
   for j in range(1 if first_done else 2):results.append(until_result())
   alltxt=' '.join(txt+' '+str(r.get('result','')) for r,txt in results)
   receipts.append({'case':'busy-followup','index':i+1,'nonce':nonce,'sentDuringObservedStream':busy,'nonceEcho':nonce in alltxt,'resultCount':len(results),'elapsedMs':round((time.monotonic()-t)*1000),'sameSession':len(session_ids)==1,'deliveryMode':'queued followup; active steering not claimed'})
  user('Write a neutral 2000-word explanation of arithmetic without tools.')
  deadline=time.monotonic()+40;observed=False
  while time.monotonic()<deadline:
   rs=read()
   if any(o.get('type')=='stream_event' and o.get('event',{}).get('type')=='content_block_delta' for o in rs):observed=True;break
  send({'type':'control_request','request_id':'probe-interrupt','request':{'subtype':'interrupt'}})
  deadline=time.monotonic()+15;control=None;interrupted=None
  while time.monotonic()<deadline:
   for o in read():
    if o.get('type')=='control_response' and o.get('response',{}).get('request_id')=='probe-interrupt':control=o.get('response',{}).get('subtype')
    if o.get('type')=='result':interrupted=o.get('subtype')
   if control and interrupted:break
  receipts.append({'case':'interrupt','sentDuringObservedStream':observed,'controlResponse':control,'resultSubtype':interrupted})
 except Exception as e:summary['blocker']=str(e)
 finally:
  signal.alarm(0)
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except:os.killpg(p.pid,signal.SIGKILL);p.wait()
summary.update({'effectiveStartup':init_summary,'distinctSessionCount':len(session_ids),'elapsedSeconds':round(time.monotonic()-start,2),'ownedProcessStopped':p.poll() is not None,'result':'blocked' if summary.get('blocker') else 'completed'})
(root/'receipts.json').write_text(json.dumps(summary,indent=2)+'\n');os.chmod(root/'receipts.json',0o600)
print(json.dumps(summary))
