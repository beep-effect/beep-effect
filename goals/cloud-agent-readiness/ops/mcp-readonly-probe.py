import os,sys,json,subprocess,selectors,time,signal,urllib.request,urllib.error,pathlib
# Transport qualification only. Tool calls are limited to inspected read-only operations.
repo=pathlib.Path(sys.argv[1]); name=sys.argv[2]; cfg=json.loads((repo/'.mcp.json').read_text())['mcpServers'].get(name)
if name=='graft':cfg={'command':str(pathlib.Path.home()/'.local/bin/graft'),'args':['mcp',str(pathlib.Path.home()/'YeeBois/projects/beep-effect')]}
report={'server':name,'ssh_agent_present':bool(os.environ.get('SSH_AUTH_SOCK'))};p=None;session=None;seq=0;errors=None
out=pathlib.Path.home()/'.cache/beep/mcp-qualification';out.mkdir(parents=True,exist_ok=True)
def rpc(method,params=None,notify=False):
 global seq,session
 seq+=1;msg={'jsonrpc':'2.0','method':method,'params':params or {}}
 if not notify:msg['id']=seq
 if p:
  p.stdin.write(json.dumps(msg)+'\n');p.stdin.flush()
  if notify:return {}
  deadline=time.monotonic()+35
  while time.monotonic()<deadline:
   if not sel.select(max(0,deadline-time.monotonic())):raise TimeoutError(method)
   line=p.stdout.readline()
   if not line:raise RuntimeError('stdio closed')
   try:r=json.loads(line)
   except ValueError:continue
   if r.get('id')==seq:
    if 'error' in r:raise RuntimeError('RPC '+str(r['error'].get('code')))
    return r.get('result',{})
  raise TimeoutError(method)
 headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'}
 headers.update({k:v.replace('${PWD}',str(repo)) for k,v in cfg.get('headers',{}).items()})
 if session:headers['Mcp-Session-Id']=session
 req=urllib.request.Request(cfg['url'],data=json.dumps(msg).encode(),headers=headers)
 with urllib.request.urlopen(req,timeout=25) as f:
  session=f.headers.get('Mcp-Session-Id',session)
  if notify:return {}
  if 'text/event-stream' in f.headers.get('Content-Type',''):
   while True:
    line=f.readline().decode()
    if not line:raise RuntimeError('SSE closed')
    if line.startswith('data:'):
     r=json.loads(line[5:]);
     if r.get('id')==seq:break
  else:r=json.load(f)
  if 'error' in r:raise RuntimeError('RPC '+str(r['error'].get('code')))
  return r.get('result',{})
try:
 if cfg.get('command'):
  errors=open(out/(name+'-stderr.log'),'w');os.chmod(errors.name,0o600)
  env=dict(os.environ);env.pop('SSH_AUTH_SOCK',None)
  p=subprocess.Popen([cfg['command']]+cfg.get('args',[]),cwd=repo,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True,bufsize=1,start_new_session=True)
  report['pid']=p.pid;sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
 init=rpc('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'beep-readiness-readonly-probe','version':'1.0.0'}})
 report['initialized']=True;report['serverInfo']=init.get('serverInfo');report['protocolVersion']=init.get('protocolVersion')
 rpc('notifications/initialized',notify=True)
 tools=rpc('tools/list').get('tools',[])
 report['tools']=[{'name':t['name'],'inputSchema':t.get('inputSchema',{}),'annotations':t.get('annotations',{})} for t in tools]
 report['tool_count']=len(tools)
 if len(sys.argv)>3:
  call=json.loads(sys.argv[3])
  allowed={'nlp':'WordCount','shadcn':'get_project_registries','next-devtools':'nextjs_index','phoenix-docs':'search_phoenix','phoenix':'getProjects','graft':'graft_find_all','fallow':'project_info'}
  if allowed.get(name)!=call.get('name'):raise RuntimeError('Tool is outside the read-only probe allowlist')
  result=rpc('tools/call',call)
  report['call']={'name':call['name'],'isError':bool(result.get('isError')),'content_types':[x.get('type') for x in result.get('content',[])],'content_bytes':len(json.dumps(result))}
  if call.get('arguments',{}).get('text')=='Beep worker validates portable tools.':report['synthetic_result']=result
  elif name=='graft':report['result_excerpt']=json.dumps(result)[:1500]
except Exception as e:report['failure']={'type':type(e).__name__,'message':str(e) if isinstance(e,(TimeoutError,RuntimeError)) else 'Transport or launch failed','http_status':getattr(e,'code',None)}
finally:
 if p:
  if name=='graft':
   env=dict(os.environ);env['XDG_RUNTIME_DIR']=f'/run/user/{os.getuid()}';env['DBUS_SESSION_BUS_ADDRESS']=f'unix:path={env["XDG_RUNTIME_DIR"]}/bus'
   subprocess.run(['systemctl','--user','stop',f'beep-graft-command-{p.pid}.scope'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20)
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:p.wait(timeout=8)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  report['owned_process_exited']=True
 if not p and session:
  try:
   req=urllib.request.Request(cfg['url'],method='DELETE',headers={'Mcp-Session-Id':session,'MCP-Protocol-Version':'2025-06-18'})
   with urllib.request.urlopen(req,timeout=10) as f:report['session_close_status']=f.status
  except urllib.error.HTTPError as e:report['session_close_status']=e.code
  except Exception:report['session_close_status']='transport failure'
 if errors:errors.close()
 path=out/(name+'-report.json');path.write_text(json.dumps(report,indent=2)+'\n');path.chmod(0o600)
 print(json.dumps({k:v for k,v in report.items() if k not in ['tools','synthetic_result','result_excerpt']},indent=2))
 print('tools:',', '.join(t['name'] for t in report.get('tools',[])))

sys.exit(1 if report.get("failure") or report.get("call",{}).get("isError") else 0)
