import asyncio, json, os, pathlib, time, uuid

os.umask(0o077)
raw_root = os.environ.get('BEEP_SPIKE_ROOT')
if not raw_root:
    raise SystemExit('BEEP_SPIKE_ROOT must identify a fresh owned cache directory')
ROOT = pathlib.Path(raw_root).expanduser().resolve()
CACHE = (pathlib.Path.home() / '.cache/beep').resolve()
if not ROOT.is_relative_to(CACHE) or ROOT == CACHE:
    raise SystemExit('BEEP_SPIKE_ROOT must be strictly below ~/.cache/beep')
if ROOT == CACHE / 'agent-comms-spike/cursor':
    raise SystemExit('Refusing to overwrite the original captured spike directory')
ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
WORK = ROOT / 'workspace'
WORK.mkdir(exist_ok=True, mode=0o700)
COMMAND = ['cursor-agent', '--model', 'claude-opus-5-5', '--mode', 'ask', '--sandbox', 'enabled', '--workspace', str(WORK), 'acp']

class Client:
    def __init__(self, label):
        self.label=label; self.seq=0; self.pending={}; self.events=[]; self.reverse=[]
        self.log=open(ROOT/(label+'.private.jsonl'),'w'); self.tasks=[]
    async def start(self):
        self.proc=await asyncio.create_subprocess_exec(*COMMAND,cwd=WORK,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,start_new_session=True)
        self.tasks=[asyncio.create_task(self.read()),asyncio.create_task(self.stderr())]
    def record(self,direction,data):
        self.log.write(json.dumps({'t':time.monotonic(),'direction':direction,'data':data})+'\n');self.log.flush()
    async def stderr(self):
        while line:=await self.proc.stderr.readline(): self.record('stderr',line.decode(errors='replace'))
    async def read(self):
        while line:=await self.proc.stdout.readline():
            self.record('out',line.decode(errors='replace'))
            try: m=json.loads(line)
            except ValueError: continue
            if 'method' in m:
                self.events.append((time.monotonic(),m))
                if 'id' in m:
                    self.reverse.append(m['method'])
                    if m['method']=='session/request_permission':
                        r={'outcome':{'outcome':'cancelled'}}
                        await self.send({'jsonrpc':'2.0','id':m['id'],'result':r})
                    else: await self.send({'jsonrpc':'2.0','id':m['id'],'error':{'code':-32601,'message':'Disposable no-tools probe declines client operation'}})
            elif m.get('id') in self.pending:
                f=self.pending.pop(m['id'])
                if not f.done():f.set_result(m)
    async def send(self,m):
        self.record('in',m); self.proc.stdin.write((json.dumps(m)+'\n').encode());await self.proc.stdin.drain()
    async def request(self,method,params,timeout=45):
        self.seq+=1; ident=self.seq; f=asyncio.get_running_loop().create_future();self.pending[ident]=f
        await self.send({'jsonrpc':'2.0','id':ident,'method':method,'params':params})
        return await asyncio.wait_for(f,timeout)
    async def close(self):
        if self.proc.returncode is None:
            self.proc.terminate()
            try:await asyncio.wait_for(self.proc.wait(),5)
            except asyncio.TimeoutError:self.proc.kill();await self.proc.wait()
        for t in self.tasks:t.cancel()
        await asyncio.gather(*self.tasks,return_exceptions=True);self.log.close()

async def main():
    c=Client('handshake'); await c.start()
    try:
        r=await c.request('initialize',{'protocolVersion':1,'clientInfo':{'name':'beep-disposable-probe','version':'1'},'clientCapabilities':{}},30)
        (ROOT/'initialize.private.json').write_text(json.dumps(r,indent=2))
        result=r.get('result',{})
        summary={'stage':'initialize','response_error':r.get('error'),'protocolVersion':result.get('protocolVersion'),'agentInfo':result.get('agentInfo'),'agentCapabilities':result.get('agentCapabilities'),'auth_method_ids':[x.get('id') for x in result.get('authMethods',[])],'reverse_methods':c.reverse,'model_turns':0}
        (ROOT/'handshake.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
    except Exception as e:
        print(json.dumps({'stage':'initialize','failure_type':type(e).__name__,'model_turns':0}))
    finally:await c.close()

if __name__=='__main__':
    import argparse,runpy
    parser=argparse.ArgumentParser(description='Synthetic-only owned Cursor ACP capability probe')
    parser.add_argument('--authorized-model-probes',action='store_true',help='Explicitly enable bounded synthetic model exchanges; default performs initialize only')
    args=parser.parse_args()
    if args.authorized_model_probes:runpy.run_path(str(pathlib.Path(__file__).resolve().with_name('exchanges.py')),run_name='__main__')
    else:asyncio.run(main())
