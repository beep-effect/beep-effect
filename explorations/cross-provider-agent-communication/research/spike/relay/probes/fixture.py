import json,sys,datetime
sequence=0
def send(kind,payload,request=None):
    m={'v':2,'type':kind,'payload':payload}
    if request:m['request_id']=request
    print(json.dumps(m),flush=True)
def event(kind,**extra):
    global sequence
    sequence+=1
    send('agent_event',{'protocol_version':1,'sequence':sequence,'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'event':{'kind':kind,**extra}})
send('worker_ready',{'name':'synthetic-fixture','runtime':'headless','readiness_proven':True})
for line in sys.stdin:
    try:m=json.loads(line)
    except:continue
    kind=m.get('type');p=m.get('payload',{})
    if kind=='init_worker':event('session.started')
    elif kind=='deliver_relay':
        event('delivery.accepted',messageId=p.get('event_id'),deliveryId=p.get('delivery_id'))
        send('delivery_ack',{'delivery_id':p.get('delivery_id'),'event_id':p.get('event_id')})
    elif kind=='native_harness_command':
        send('native_harness_command_response',{'protocol_version':1,'request_id':m.get('request_id'),'idempotency_key':p.get('idempotency_key'),'accepted':True,'active_turn':False},m.get('request_id'))
        event('synthetic.command_received',commandKind=p.get('kind'),nonce=p.get('text'))
    elif kind=='ping':send('pong',p)
    elif kind=='shutdown_worker':send('worker_exited',{'code':0});break
