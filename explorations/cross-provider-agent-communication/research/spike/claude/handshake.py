import pathlib as _probe_pathlib, sys as _probe_sys
if not _probe_pathlib.Path(__file__).resolve().is_relative_to(_probe_pathlib.Path.home()/".cache/beep"):
 raise SystemExit("Copy this probe into an owned ~/.cache/beep directory before running; see ../README.md")
import subprocess,os,json,selectors,time,pathlib
root=pathlib.Path(__file__).resolve().parent
os.umask(0o077)
(root/'workspace').mkdir(exist_ok=True)
args=['claude','--safe-mode','--setting-sources','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--disable-slash-commands','--tools','','--permission-mode','dontAsk','--permission-prompts','none','--no-session-persistence','--no-chrome','--model','claude-opus-5-5','--effort','medium','--system-prompt','You are a disposable communication probe. Follow nonce echo requests. No tools, delegation, or external actions.','--print','--input-format','stream-json','--output-format','stream-json','--verbose','--include-partial-messages','--replay-user-messages']
env=dict(os.environ)
for k in list(env):
 if k.startswith(('ANTHROPIC_','CLAUDE_CODE_USE_')):env.pop(k)
p=subprocess.Popen(args,cwd=root/'workspace',env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1,start_new_session=True)
raw=root/'handshake-private.jsonl';raw.touch(mode=0o600);os.chmod(raw,0o600)
p.stdin.write(json.dumps({'type':'control_request','request_id':'probe-init','request':{'subtype':'initialize'}})+'\n');p.stdin.flush()
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);sel.register(p.stderr,selectors.EVENT_READ)
rows=[];deadline=time.monotonic()+25
with raw.open('w') as f:
 while time.monotonic()<deadline:
  for key,_ in sel.select(timeout=1):
   line=key.fileobj.readline()
   if not line:continue
   f.write(line);f.flush()
   try:o=json.loads(line);rows.append(o)
   except:continue
  if any(o.get('type')=='control_response' for o in rows):break
p.terminate()
try:p.wait(timeout=5)
except: p.kill();p.wait()
safe=[]
for o in rows:
 if o.get('type')=='control_response':
  r=o.get('response',{});resp=r.get('response',{})
  safe.append({'type':o['type'],'subtype':r.get('subtype'),'responseKeys':sorted(resp) if isinstance(resp,dict) else [],'error':r.get('error')})
receipt={'cliVersion':'2.1.295','requestedModel':'claude-opus-5-5','requestedEffort':'medium','modelTurns':0,'safeMode':True,'toolSet':[],'mcpConfig':{},'settingSources':[],'handshake':safe,'exitCode':p.returncode}
(root/'handshake-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
