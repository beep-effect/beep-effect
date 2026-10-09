import asyncio,json,time,uuid
from probe import Client,ROOT,WORK

results={'provider':'cursor','version':'2026.10.01-e373342','mode_requested':'ask','mcpServers_requested':[],'idle':[],'busy_queue':[],'cancel':[],'steer':{'status':'unknown','reason':'ACP does not document steering; SDK not installed/probed'},'existing_app_attach':{'status':'unknown','reason':'Owned ACP process only; no app touched'},'global_config_isolation':{'status':'partial','reason':'Empty cwd and mcpServers []; user MCP config contains 2 entries; CLI has no verified settingSources suppression'},'model_calls_attempted':0}
def save(): (ROOT/'results.json').write_text(json.dumps(results,indent=2))
def text_since(c,offset):
    return ''.join(m.get('params',{}).get('update',{}).get('content',{}).get('text','') for _,m in c.events[offset:] if m.get('method')=='session/update' and m.get('params',{}).get('update',{}).get('sessionUpdate')=='agent_message_chunk')
def chunks_since(c,offset):
    return [t for t,m in c.events[offset:] if m.get('method')=='session/update' and m.get('params',{}).get('update',{}).get('sessionUpdate')=='agent_message_chunk']
async def setup(c,new=True,sid=None):
    await c.start(); await c.request('initialize',{'protocolVersion':1,'clientInfo':{'name':'beep-disposable-probe','version':'1'},'clientCapabilities':{}},20)
    r=await c.request('session/new' if new else 'session/load',{'cwd':str(WORK),'mcpServers':[],**({} if new else {'sessionId':sid})},35)
    if 'error' in r:raise RuntimeError('session lifecycle RPC failed')
    v=r['result']; sid=v.get('sessionId',sid)
    results['model_observed']=v.get('models',{}).get('currentModelId')
    if results['model_observed']!='claude-opus-5-5[context=300k,effort=medium,fast=false]':raise RuntimeError('Model pin mismatch')
    r=await c.request('session/set_mode',{'sessionId':sid,'modeId':'ask'},20)
    if 'error' in r:raise RuntimeError('Ask mode RPC failed')
    results['set_mode_success']=True;save();return sid
async def prompt(c,sid,text):
    results['model_calls_attempted']+=1;save()
    return await c.request('session/prompt',{'sessionId':sid,'prompt':[{'type':'text','text':text}]},55)
async def wait_stream(c,offset,task):
    for _ in range(200):
        if chunks_since(c,offset):return True
        if task.done():return False
        await asyncio.sleep(.05)
    return False
async def main():
    c=Client('exchanges');sid=None
    try:
        sid=await setup(c);(ROOT/'session-identity.private.json').write_text(json.dumps({'sessionId':sid}));results['same_session_used']=True
        for i in range(5):
            nonce='IDLE_'+uuid.uuid4().hex;start=time.monotonic();offset=len(c.events)
            r=await prompt(c,sid,'Do not use tools, files, MCP, commands, or subagents. Reply with exactly '+nonce+'.')
            output=text_since(c,offset);ts=chunks_since(c,offset)
            row={'sample':i+1,'nonce_received':nonce in output,'exact_echo':output.strip()==nonce,'rpc_error':r.get('error'),'stopReason':r.get('result',{}).get('stopReason'),'first_text_ms':round((ts[0]-start)*1000,2) if ts else None,'completion_ms':round((time.monotonic()-start)*1000,2)}
            results['idle'].append(row);save();print(json.dumps({'stage':'idle',**row}),flush=True)
            if r.get('error') or not row['nonce_received']:results['halt_reason']='First failed idle receipt; no blind retries';return
        for i in range(5):
            nonce='BUSY_'+uuid.uuid4().hex;offset=len(c.events);start=time.monotonic()
            active=asyncio.create_task(prompt(c,sid,'Do not use tools, files, MCP, commands, or subagents. Output exactly 100 short numbered lines, each saying test, from 1 to 100.'))
            busy=await wait_stream(c,offset,active)
            if not busy:
                r=await active;results['busy_queue'].append({'sample':i+1,'busy_proven':False,'first_error':r.get('error')});save();break
            submitted=time.monotonic();follow=asyncio.create_task(prompt(c,sid,'Do not use any tools. Reply with exactly '+nonce+'.'))
            a,b=await asyncio.gather(active,follow);output=text_since(c,offset)
            row={'sample':i+1,'busy_proven':True,'nonce_received':nonce in output,'active_stopReason':a.get('result',{}).get('stopReason'),'followup_stopReason':b.get('result',{}).get('stopReason'),'active_error':a.get('error'),'followup_error':b.get('error'),'followup_completion_ms':round((time.monotonic()-submitted)*1000,2),'steer_proven':False}
            results['busy_queue'].append(row);save();print(json.dumps({'stage':'busy_queue',**row}),flush=True)
            if b.get('error'):break
        for i in range(5):
            offset=len(c.events);active=asyncio.create_task(prompt(c,sid,'Do not use tools, files, MCP, commands, or subagents. Output exactly 500 short numbered lines, each saying test, from 1 to 500.'))
            busy=await wait_stream(c,offset,active)
            start=time.monotonic();await c.send({'jsonrpc':'2.0','method':'session/cancel','params':{'sessionId':sid}})
            r=await active;row={'sample':i+1,'busy_proven':busy,'stopReason':r.get('result',{}).get('stopReason'),'rpc_error':r.get('error'),'cancel_to_prompt_settle_ms':round((time.monotonic()-start)*1000,2)}
            results['cancel'].append(row);save();print(json.dumps({'stage':'cancel',**row}),flush=True)
        results['reverse_methods']=c.reverse;await c.close()
        resumed=Client('resume')
        try:
            loaded=await setup(resumed,new=False,sid=sid);results['resume']={'status':'history-resumed','same_id':loaded==sid,'original_process_stopped':True,'live_attach_proven':False}
            nonce='RESUME_'+uuid.uuid4().hex;offset=len(resumed.events);r=await prompt(resumed,loaded,'Do not use tools. Reply with exactly '+nonce+'.')
            results['resume']['nonce_received']=nonce in text_since(resumed,offset);results['resume']['stopReason']=r.get('result',{}).get('stopReason');results['resume']['rpc_error']=r.get('error');save()
        finally:await resumed.close()
    except Exception as e:
        results['failure_type']=type(e).__name__;results['failure_message']=str(e) if isinstance(e,RuntimeError) else 'Bounded probe failure';save();print(json.dumps({'stage':'failure','type':type(e).__name__}),flush=True)
    finally:
        results['reverse_methods']=c.reverse;await c.close();results['owned_process_stopped']=c.proc.returncode is not None;save()

if __name__=='__main__':
    import sys
    if '--authorized-model-probes' not in sys.argv:
        raise SystemExit('Model exchanges require --authorized-model-probes and resolution of the captured access barrier')
    asyncio.run(asyncio.wait_for(main(),540))
