import asyncio,json
from probe import Client,ROOT,WORK

async def main():
    c=Client('session');await c.start()
    try:
        await c.request('initialize',{'protocolVersion':1,'clientInfo':{'name':'beep-disposable-probe','version':'1'},'clientCapabilities':{}},30)
        r=await c.request('session/new',{'cwd':str(WORK),'mcpServers':[]},40)
        (ROOT/'new.private.json').write_text(json.dumps(r,indent=2))
        v=r.get('result',{})
        if v.get('sessionId'):
            (ROOT/'session-identity.private.json').write_text(json.dumps({'sessionId':v['sessionId']}))
        models=v.get('models',{});modes=v.get('modes',{})
        print(json.dumps({'stage':'session/new','error':r.get('error'),'has_session_id':bool(v.get('sessionId')),'models':models,'modes':modes,'config_option_ids':[x.get('id') for x in v.get('configOptions',[])],'reverse_methods':c.reverse,'model_turns':0}))
    except Exception as e: print(json.dumps({'stage':'session/new','failure_type':type(e).__name__,'model_turns':0}))
    finally:await c.close()

asyncio.run(main())
