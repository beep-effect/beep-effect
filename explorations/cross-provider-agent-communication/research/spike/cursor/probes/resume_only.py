import asyncio,json
from probe import Client,ROOT,WORK

async def main():
    sid=json.loads((ROOT/'session-identity.private.json').read_text())['sessionId'];c=Client('resume-only');await c.start()
    row={'model_turns':0,'original_process_stopped':True,'live_attach_proven':False}
    try:
        await c.request('initialize',{'protocolVersion':1,'clientInfo':{'name':'beep-disposable-probe','version':'1'},'clientCapabilities':{}},20)
        r=await c.request('session/load',{'sessionId':sid,'cwd':str(WORK),'mcpServers':[]},35)
        row.update({'load_rpc_success':'result' in r,'load_error':r.get('error'),'history_update_count':sum(1 for _,m in c.events if m.get('method')=='session/update'),'model_observed':r.get('result',{}).get('models',{}).get('currentModelId'),'mode_observed':r.get('result',{}).get('modes',{}).get('currentModeId')})
        if 'result' in r:
            changed=await c.request('session/set_mode',{'sessionId':sid,'modeId':'ask'},20);row['set_mode_ask_success']='result' in changed
    except Exception as e:row['failure_type']=type(e).__name__
    finally:
        await c.close();row['owned_process_stopped']=c.proc.returncode is not None
        result_path = ROOT/'results.json'
        results=json.loads(result_path.read_text()) if result_path.exists() else {}
        results['resume']=row
        (ROOT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(row))

asyncio.run(main())
