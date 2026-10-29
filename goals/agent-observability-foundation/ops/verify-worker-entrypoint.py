#!/usr/bin/env python3
"""Synthetic proof of the actual paused worker entrypoint, not a test-only server.
No deliberate OOM, real sources, secret reads, or changes to held units.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', type=Path, required=True)
args = parser.parse_args()
workspace = args.workspace.resolve(strict=True)
entry = workspace / 'packages/tooling/tool/cli/src/commands/AIMetrics/ObservationWorker.entry.ts'
writer = workspace / 'packages/tooling/library/ai-metrics/test/fixtures/write-observation-launch.ts'
client_fixture = workspace / 'packages/tooling/library/ai-metrics/test/fixtures/observation-launch-client-process.ts'
managed_fixture = workspace / 'packages/tooling/library/ai-metrics/test/fixtures/managed-observation-process.ts'
owner_fixture = workspace / 'packages/tooling/tool/cli/test/fixtures/managed-observation-command.ts'
managed_peer = workspace / 'packages/drivers/ai-provider-cli/test/fixtures/managed-codex-peer.ts'
bun = Path(subprocess.run([shutil.which('bun'), '--no-env-file', '-p', 'process.execPath'], cwd=workspace, capture_output=True, text=True, check=True, timeout=15).stdout.strip()).resolve(strict=True)
root = Path(tempfile.mkdtemp(prefix='obs-entry-', dir='/tmp'))
root.chmod(0o700)
diagnostics = root/'diagnostics'
diagnostics.mkdir(mode=0o700)
env = dict(os.environ, XDG_RUNTIME_DIR=f'/run/user/{os.getuid()}', DBUS_SESSION_BUS_ADDRESS=f'unix:path=/run/user/{os.getuid()}/bus')
units = []
received = []
queries = []
canary = 'PRIVATE-ENTRYPOINT-CANARY'
evidence = {'recordedAt': datetime.now(timezone.utc).isoformat(), 'syntheticOnly': True, 'productionRollout': False,
            'deliberateMemoryExhaustion': False, 'goalComplete': False, 'runs': [], 'result': 'incomplete'}
properties = {'Slice':'agent-runs.slice','MemoryMax':'536870912','MemorySwapMax':'0','CPUQuota':'50%', 'TasksMax':'64',
              'LimitNOFILE':'256','LimitFSIZE':'2097152','LimitCORE':'0','RuntimeMaxSec':'60', 'TimeoutStopSec':'10',
              'KillMode':'control-group','OOMPolicy':'stop','Restart':'no','NoNewPrivileges':'yes','UMask':'0077',
              'SuccessExitStatus':'130','StandardOutput':'null','StandardError':'journal'}

class Backend(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        self.connection.settimeout(3)
        length = int(self.headers.get('Content-Length', '0'))
        if length < 1 or length > 262144:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        received.append(body)
        self.send_response(200)
        self.send_header('Content-Type','application/x-protobuf')
        self.send_header('Content-Length','0')
        self.end_headers()
    def do_GET(self):
        queries.append(self.path)
        body = b'{"data":[],"next_cursor":null}'
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)
backend = HTTPServer(('127.0.0.1',0),Backend)
backend_thread = threading.Thread(target=backend.serve_forever, daemon=True)
backend_thread.start()
origin = f'http://127.0.0.1:{backend.server_port}'

def command(argv, check=True, timeout=20):
    return subprocess.run(argv, env=env, cwd=workspace, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout, check=check)

def show(unit):
    keys = ['ActiveState','MainPID','Result','ControlGroup','MemoryPeak','ExecMainStatus']
    p = command(['/usr/bin/systemctl','--user','show',unit] + [f'--property={key}' for key in keys])
    return dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)

def write_config(directory, source_directory=None):
    directory.chmod(0o700)
    command([str(bun),'--no-env-file',str(writer),str(directory),origin,str(source_directory) if source_directory else "-"])
    assert (directory/'worker.json').stat().st_mode & 0o777 == 0o600

def start(directory, expected_refusal=None, lock=True, overrides=None):
    unit = f'beep-observation-entry-proof-{uuid.uuid4().hex[:12]}.service'
    units.append(unit)
    argv = ['/usr/bin/systemd-run','--user','--quiet','--service-type=exec',f'--unit={unit}', f'--working-directory={workspace}',
            '--setenv=PATH=/usr/bin:/bin','--setenv=BEEP_AI_METRICS_HASH_SALT=synthetic-launch-proof-salt',
            '--property=UnsetEnvironment=BEEP_OBSERVATION_PHOENIX_API_KEY']
    diagnostic_file=diagnostics/f'{unit}.stderr'
    diagnostic_file.touch(mode=0o600,exist_ok=False)
    launch_properties=dict(properties, **(overrides or {}))
    launch_properties['StandardError']=f'append:{diagnostic_file}'
    argv += [f'--property={key}={value}' for key,value in launch_properties.items()]
    if lock: argv += ['/usr/bin/flock','--nonblock','--no-fork','--conflict-exit-code','73',str(directory/'worker.lock')]
    argv += [str(bun),'--no-env-file','--max-http-header-size=16384',str(entry),str(directory)]
    command(argv)
    deadline = time.monotonic()+25
    while time.monotonic()<deadline:
        state=show(unit)
        if state['ActiveState'] in ('failed','inactive'):
            # Short-lived stderr may reach journald after its process metadata is gone.
            # This owned file binds diagnostics to this exact invocation without guessing by PID.
            with diagnostic_file.open('rb') as source:
                diagnostic_bytes=source.read(16385)
            assert len(diagnostic_bytes)<=16384, 'Unbounded startup diagnostic'
            log=diagnostic_bytes.decode('utf-8',errors='strict')
            assert expected_refusal and f"Observation worker refused: {expected_refusal}" in log, f'Unexpected entry refusal: {log[-1800:]}'
            evidence['runs'].append({'unit':unit,'refused':expected_refusal,'mainPid':int(state['MainPID']),'diagnosticSource':'owned-private-file','diagnosticBytes':len(diagnostic_bytes)})
            return unit
        if expected_refusal is None and (directory/'worker.sock').exists():
            try:
                status,body=request(directory,'GET','/health')
                if status==200 and json.loads(body)['runtime']['running']: break
            except (OSError,http.client.HTTPException): pass
        time.sleep(.1)
    else: raise AssertionError('Entry startup/refusal deadline')
    state=show(unit)
    cg=Path('/sys/fs/cgroup')/state['ControlGroup'].lstrip('/')
    limits={name:(cg/name).read_text().strip() for name in ['memory.max','memory.swap.max','pids.max','cpu.max']}
    assert limits=={'memory.max':'536870912','memory.swap.max':'0','pids.max':'64','cpu.max':'50000 100000'}
    assert (directory/'worker.sock').stat().st_mode & 0o777==0o600
    status,body=request(directory,'GET','/health')
    assert json.loads(body)['control']['accepting'] is False
    assert json.loads(body)['runtime']['sourceCoverage']=='unknown'
    contender=command(['/usr/bin/flock','--nonblock','--conflict-exit-code','73',str(directory/'worker.lock'),'/usr/bin/true'],check=False)
    assert contender.returncode==73
    evidence['runs'].append({'unit':unit,'startsPaused':True,'limits':limits,'secondOwnerExit':73,'socketMode':'0600'})
    return unit

class UnixHTTP(http.client.HTTPConnection):
    def __init__(self,directory):
        super().__init__('localhost',timeout=3)
        self.filename=str(directory/'worker.sock')
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.filename)

def request(directory,method,path,body=None):
    client=UnixHTTP(directory)
    try:
        client.request(method,path,body=body,headers={'Content-Type':'application/json'})
        response=client.getresponse()
        result=response.read(65537)
        assert len(result)<=65536
        return response.status,result
    finally: client.close()

def stop(unit,directory):
    command(['/usr/bin/systemctl','--user','stop',unit])
    state=show(unit)
    assert int(state['MainPID'])==0 and state['ActiveState'] in ('inactive','failed')
    assert not (directory/'worker.sock').exists(), 'Owned socket survived scoped shutdown'
    evidence['runs'][-1]['stopped']=True

def wait_until(predicate):
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        if predicate(): return
        time.sleep(.1)
    raise AssertionError('Bounded observation deadline')

try:
    source_directory=root/'inputs'
    source_directory.mkdir(mode=0o700)
    (source_directory/'rollout-source.jsonl').write_text(json.dumps({'timestamp':'2026-10-28T20:00:00Z','type':'response_item','payload':{'type':'message','content':canary}})+'\n')
    (source_directory/'rollout-tail.jsonl').write_text('{"type":"response_item"')
    write_config(root,source_directory)
    first=start(root)
    launch_config=json.loads((root/'worker.json').read_text())
    def launch_client(input_path='-'):
        reply=command([str(bun),'--no-env-file',str(client_fixture),str(root),
            launch_config['intake']['hostId'],launch_config['intake']['namespaceId'],str(input_path)],timeout=20)
        assert len(reply.stdout.encode())<=65536, 'Synthetic client output exceeded its bound'
        return json.loads(reply.stdout)
    paused_context=launch_client()
    assert paused_context['context']['accepting'] is False and paused_context['receipts']==[]
    assert paused_context['context']['evidenceEpoch']==0
    # The actual serve command runs while intake is paused. Its local lifecycle
    # must survive owner exit; recovery runs in a new process after worker restart.
    owner_root=Path(tempfile.mkdtemp(prefix='obs-command-',dir='/tmp'))
    owner_root.chmod(0o700)
    evidence['managedCommandFixture']=str(owner_root)
    def run_owner(mode):
        unit=f'beep-observation-owner-proof-{uuid.uuid4().hex[:12]}.service'
        units.append(unit)
        result=command(['/usr/bin/systemd-run','--user','--quiet','--wait','--pipe',
            f'--unit={unit}',f'--working-directory={workspace}',
            '--property=Slice=agent-runs.slice','--property=MemoryMax=1073741824',
            '--property=MemorySwapMax=0','--property=CPUQuota=200%','--property=TasksMax=64',
            '--property=RuntimeMaxSec=20','--property=TimeoutStopSec=5','--property=KillMode=control-group',
            '--property=UMask=0077','--setenv=PATH=/usr/bin:/bin',
            str(bun),'--no-env-file',str(owner_fixture),str(root),launch_config['intake']['hostId'],
            launch_config['intake']['namespaceId'],str(managed_peer),str(owner_root),mode],timeout=30,check=False)
        assert result.returncode==0, f'Synthetic owner command failed: {result.stderr[-2000:]} {result.stdout[-2000:]}'
        assert len(result.stdout.encode())<=32768
        assert int(show(unit)['MainPID'])==0
        # Logging may precede the single structured fixture report.
        return json.loads(result.stdout.strip().splitlines()[-1])
    owner_initial=run_owner('initialize')
    assert owner_initial['childLaunches']==1 and owner_initial['childStopped'] is True
    assert owner_initial['explicitSetupCommands'] is True
    assert len(owner_initial['population']['rows'][0]['started'])==1
    assert owner_initial['population']['rows'][0]['receiptedStarts']==[]
    assert owner_initial['report']['outbox']['receipts']==[]
    assert [r['fact']['_tag'] for r in owner_initial['report']['outbox']['submissions']]==['Prepared','Started','SessionBound','Finished']
    assert owner_initial['report']['outbox']['submissions'][-1]['fact']['outcome']=='cancelled'
    submissions=[]
    launch_replies=[]
    for digit,route,harness,surface in [('3','c','codex-cli','cli'),('4','d','chatgpt-desktop','desktop')]:
        unknown={'_tag':'Unknown'}
        attribution={'routeId':route*64,'harness':harness,'surface':surface,'root':unknown,
                     'repository':unknown,'clone':unknown,'worktree':unknown,'task':unknown,'attempt':unknown,'evidenceId':'e'*64}
        facts=[{'_tag':'Prepared','launchId':digit*64,'identity':attribution},
               {'_tag':'Started','launchId':digit*64,'processInstanceId':digit*64},
               {'_tag':'SessionBound','launchId':digit*64,'sourceSessionId':'f'*64},
               {'_tag':'Finished','launchId':digit*64,'outcome':'succeeded'}]
        for fact in facts:
            submissions.append(json.dumps({'version':'observation-launch-submission/v1',
                'hostId':launch_config['intake']['hostId'],'namespaceId':launch_config['intake']['namespaceId'],
                'evidenceEpoch':0,'fact':fact}).encode())
    assert request(root,'POST','/v1/launch-facts',submissions[0])[0]==503
    with sqlite3.connect(root/'journal.sqlite') as db:
        assert db.execute('select count(*) from observation_intake_pages').fetchone()==(0,), 'Paused startup read a source'
    payload=json.dumps({'resourceSpans':[{'scopeSpans':[{'spans':[{
        'traceId':'1'*32,'spanId':'2'*16,'name':canary,
        'startTimeUnixNano':'1793214000000000123','endTimeUnixNano':'1793214001000000123',
        'attributes':[{'key':'openinference.span.kind','value':{'stringValue':'AGENT'}},
                      {'key':'session.id','value':{'stringValue':'owned-thread'}},
                      {'key':'input.value','value':{'stringValue':canary}}]
    }]}]}]}).encode()
    assert request(root,'POST','/v1/traces',payload)[0]==503
    assert request(root,'POST','/__fixture/resume')[0]==404
    assert request(root,'POST','/control/resume')[0]==200
    client_input=root/'synthetic-launch-submissions.json'
    client_input.write_text(json.dumps([json.loads(submission) for submission in submissions]))
    client_input.chmod(0o600)
    client_result=launch_client(client_input)
    assert client_result['context']['accepting'] is True
    launch_replies=client_result['receipts']
    assert len(launch_replies)==8
    # Run a real managed child speaking a synthetic Codex protocol, under one
    # bounded process group. No provider executable, model request or credentials.
    claim_parent=Path(tempfile.mkdtemp(prefix='obs-claims-',dir='/tmp'))
    claim_parent.chmod(0o700)
    evidence['independentClaimFixture']=str(claim_parent)
    def run_managed(mode):
        managed_unit=f'beep-observation-managed-proof-{uuid.uuid4().hex[:12]}.service'
        units.append(managed_unit)
        result=command(['/usr/bin/systemd-run','--user','--quiet','--wait','--pipe',
            f'--unit={managed_unit}',f'--working-directory={workspace}',
            '--property=Slice=agent-runs.slice','--property=MemoryMax=1073741824',
            '--property=MemorySwapMax=0','--property=CPUQuota=200%','--property=TasksMax=64',
            '--property=RuntimeMaxSec=20','--property=TimeoutStopSec=5','--property=KillMode=control-group',
            '--property=UMask=0077','--setenv=PATH=/usr/bin:/bin',
            str(bun),'--no-env-file',str(managed_fixture),str(root),launch_config['intake']['hostId'],
            launch_config['intake']['namespaceId'],str(managed_peer),str(claim_parent/'claims'),mode],timeout=30)
        assert len(result.stdout.encode())<=16384
        assert int(show(managed_unit)['MainPID'])==0
        return json.loads(result.stdout)
    managed=run_managed('initialize')
    assert managed['childStopped'] is True and managed['syntheticOnly'] is True
    assert managed['lostAcknowledgment'] is True and managed['outboxReceipts']==3
    assert [r['fact']['_tag'] for r in managed['receipts']]==['Prepared','Started','SessionBound','Finished']
    assert managed['receipts'][-1]['fact']['outcome']=='cancelled'
    launch_replies.extend(managed['receipts'])
    submissions.extend(json.dumps({'version':'observation-launch-submission/v1',
        'hostId':r['hostId'],'namespaceId':r['namespaceId'],'evidenceEpoch':r['evidenceEpoch'],'fact':r['fact']}).encode()
        for r in managed['receipts'])
    client_input.write_text(json.dumps([json.loads(submission) for submission in submissions]))
    source_session_hash=managed['receipts'][2]['fact']['sourceSessionId']
    evidence['managedPeer']={'providerProtocol':'codex','syntheticOnly':True,'actualProviderSessions':0,
        'actualChildLaunches':1,'childStoppedBeforeFinished':True,'facts':4,'sourceSessionHash':source_session_hash}
    denied=json.loads(submissions[0]); denied['prompt']=canary
    assert request(root,'POST','/v1/launch-facts',json.dumps(denied).encode())[0]==400
    with sqlite3.connect(root/'journal.sqlite') as db:
        assert db.execute('select count(*) from observation_launch_facts').fetchone()==(12,)
    status,receipt=request(root,'POST','/v1/traces',payload)
    assert status==200
    wait_until(lambda: len(received)==2 and len(queries)>=2)
    assert source_session_hash.encode() in b''.join(received), 'Native export lost the managed source-session join'
    evidence['managedPeer']['nativeSourceSessionJoin']=True
    wait_until(lambda: json.loads(request(root,'GET','/health')[1])['runtime']['phase']=='degraded')
    metrics=request(root,'GET','/metrics')
    assert metrics[0]==200 and b'observation' in metrics[1]
    assert canary.encode() not in b''.join(received)+metrics[1]+request(root,'GET','/health')[1]
    (root/'metrics.prom').write_bytes(metrics[1])
    def source_waiting():
        health=json.loads(request(root,'GET','/health')[1])['runtime']['sources']
        return health['_tag']=='Configured' and health['phase']=='waiting'
    wait_until(source_waiting)
    source_health=json.loads(request(root,'GET','/health')[1])['runtime']['sources']
    assert canary not in json.dumps(source_health) and str(source_directory) not in json.dumps(source_health)
    # Capture actual source-cycle gauges, including partial tails across page boundaries.
    source_metrics=b''
    def source_metrics_ready():
        global source_metrics
        source_metrics=request(root,'GET','/metrics')[1]
        return b'beep_observation_sources_cycle_partial_files 1' in source_metrics
    wait_until(source_metrics_ready)
    (root/'metrics.prom').write_bytes(source_metrics)
    with sqlite3.connect(root/'journal.sqlite') as db:
        reconstructed_before=db.execute("select count(*) from observation_intake_pages where source_key like 'codex:%'").fetchone()[0]
        assert reconstructed_before==1
        event_ids=db.execute('select event_id from observation_delivery_events').fetchall()
        assert len(event_ids)==2 and len(set(event_ids))==2, 'Streams must retain distinct event identities'
    assert request(root,'POST','/control/pause')[0]==200
    assert request(root,'POST','/v1/traces',payload)[0]==503
    health_before=json.loads(request(root,'GET','/health')[1])
    assert health_before['runtime']['sourceCoverage']=='unknown'
    stop(first,root)
    with sqlite3.connect(root/'journal.sqlite') as db:
        assert db.execute('pragma integrity_check').fetchone()==('ok',)
        assert canary not in '\n'.join(db.iterdump())
    second=start(root)
    assert launch_client()['context']['accepting'] is False
    assert request(root,'POST','/control/resume')[0]==200
    owner_recovered=run_owner('recover')
    assert owner_recovered['childLaunches']==0 and owner_recovered['relaunchRefused'] is True
    assert owner_recovered['report']['outbox']['submissions']==owner_initial['report']['outbox']['submissions']
    assert len(owner_recovered['report']['outbox']['receipts'])==4
    assert owner_recovered['report']['backendVisibility']=='unknown'
    assert owner_recovered['report']['processLiveness']=='unknown'
    assert len(owner_recovered['population']['rows'][0]['started'])==1
    assert len(owner_recovered['population']['rows'][0]['receiptedStarts'])==1
    assert owner_recovered['population']['coverage']['routes'][0]['visibleEvents']=={'_tag':'Unknown'}
    # Disaster rehearsal is restricted to this synthetic owner. A cold snapshot
    # predates the launch and therefore cannot be restored as launch authority.
    def claim_files(directory):
        files=sorted(directory.iterdir())
        assert len(files)<=17 and all(p.is_file() and not p.is_symlink() and p.stat().st_size<=8192 for p in files)
        return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    claims_directory=owner_root/'claims'
    retained_claims=owner_root/'retained-claims-before-hold'
    cold_snapshot=owner_root/'cold-claims-snapshot'
    live_fingerprints=claim_files(claims_directory)
    cold_fingerprints=claim_files(cold_snapshot)
    assert list(cold_fingerprints)==['anchor.json']
    assert 'claim-0.json' in live_fingerprints
    claims_directory.rename(retained_claims)
    held_missing=run_owner('hold')
    assert held_missing=={'claimIntegrityRefusal':True,'childLaunches':0}
    assert not claims_directory.exists(), 'Missing claims were silently recreated'
    cold_snapshot.chmod(0o500)
    claims_directory.symlink_to(cold_snapshot,target_is_directory=True)
    held_quarantine=run_owner('hold')
    assert held_quarantine==held_missing and claims_directory.is_symlink()
    assert claim_files(cold_snapshot)==cold_fingerprints
    claims_directory.unlink()  # Only this proof's own link, never archive contents.
    shutil.copytree(retained_claims,claims_directory)
    (claims_directory/'claim-0.json').write_bytes(b'')
    torn_fingerprints=claim_files(claims_directory)
    held_torn=run_owner('hold')
    assert held_torn==held_missing and claim_files(claims_directory)==torn_fingerprints
    assert claim_files(retained_claims)==live_fingerprints
    evidence['claimRecoveryHold']={
        'syntheticOnly':True,'actualCommandRefusals':['serve','status','reconcile','population'],
        'scenarios':['missing-store','quarantined-stale-snapshot','torn-claim'],
        'childLaunches':0,'missingStoreNotRecreated':True,'partialStateNotRepaired':True,
        'originalOutboxPreserved':True,'snapshotNotInstalledAsAuthority':True,
        'snapshotClaimCount':0,'retainedClaimCount':1,
        'snapshotFilesSha256':cold_fingerprints,'retainedFilesSha256':live_fingerprints,
        'productionBackupQualified':False,'automaticClaimRestoreSupported':False}
    with sqlite3.connect(root/'journal.sqlite') as db:
        retained='\n'.join(db.iterdump()) + json.dumps(owner_recovered)
        for private_value in ['command-proof-owner','command-proof-endpoint','command-proof-repository',
                              'synthetic-launch-proof-salt',str(owner_root),'owned-thread']:
            assert private_value not in retained, 'Managed command exported raw private metadata'
    evidence['managedCommand']={'actualServeCommand':True,'actualRecoveryCommand':True,
        'actualInitializeClaimsCommand':True,'actualEnrollmentCommand':True,'actualPopulationCommand':True,'populationHumanAndJson':True,
        'independentStartsBeforeReceipts':True,'populationBackendVisibilityUnknown':True,
        'actualChildLaunches':1,'actualProviderSessions':0,'localCaptureWhileCollectorPaused':True,
        'childStoppedBeforeFinished':True,'facts':4,'recoveredAfterOwnerExitAndCollectorRestart':True,
        'independentClaimRefusedRelaunch':True,'recoveryChildLaunches':0,
        'backendVisibilityRemainsUnknown':True,'processLivenessRemainsUnknown':True,'privateMetadataAbsent':True}
    reconciled=run_managed('retry')
    assert reconciled['refused']=='claimed', 'Restart granted another process launch'
    assert reconciled['receipts']==managed['receipts'] and reconciled['outboxReceipts']==4
    evidence['managedPeer']['producerOutboxRecoveredLostAckAfterRestart']=True
    evidence['managedPeer']['independentClaimRefusedRelaunchAfterRestart']=True
    assert len(list((claim_parent/'claims').glob('claim-*.json')))==1
    client_replayed=launch_client(client_input)
    assert client_replayed['receipts']==launch_replies, 'Typed client retry after restart changed receipt'
    for submission,original_reply in zip(submissions,launch_replies):
        status,reply=request(root,'POST','/v1/launch-facts',submission)
        assert status==200 and json.loads(reply)==original_reply, 'Launch retry after restart changed receipt'
    with sqlite3.connect(root/'journal.sqlite') as db:
        assert db.execute('select count(*) from observation_launch_facts').fetchone()==(16,)
    evidence['launchFacts']={'cliMarkedFixtures':1,'desktopMarkedFixtures':1,'actualHarnessLaunches':0,
        'committedFacts':16,'exactReplayAfterRestart':True,'privateFieldRefused':True,'startsPaused':True,
        'typedClientVerifiedReceipts':True,'privateContextWhilePaused':True,'newClientAfterRestart':True}
    status,replayed=request(root,'POST','/v1/traces',payload)
    assert status==200 and replayed==receipt
    source_before=json.loads(request(root,'GET','/health')[1])['runtime']['sources']
    assert source_before['_tag']=='Configured'
    old_queries=len(queries)
    wait_until(lambda:len(queries)>old_queries)
    assert len(received)==2,'Accepted/missing readback was blindly resent'
    assert sum(b'native-export/v1' in body for body in received)==1
    assert sum(b'transcript-export/v1' in body for body in received)==1
    wait_until(source_waiting)
    with sqlite3.connect(root/'journal.sqlite') as db:
        assert db.execute("select count(*) from observation_intake_pages where source_key like 'codex:%'").fetchone()[0]==reconstructed_before, 'Restart duplicated accepted source pages'
    stop(second,root)
    evidence.update(sourceStartsPaused=True,sourceAutonomousRead=True,sourcePartialTailPersists=True,sourceCursorSurvivesRestart=True,sourceCoverageRemainsUnknown=True)
    evidence.update(startsPaused=True,autonomousSend=True,acceptedMissingReadbackDegraded=True, exactReceiptReplayAfterRestart=True,
                    noBlindResend=True, privateCanaryAbsent=True, scopedSocketCleanup=True, noFixtureRoutes=True,
                    databaseIntegrity=True, backendPostCount=len(received), nativeBackendPostCount=1, reconstructedBackendPostCount=1)
    # Refuse absent inherited ownership before opening the existing database.
    original_digest=hashlib.sha256((root/'journal.sqlite').read_bytes()).hexdigest()
    start(root,expected_refusal='ownership',lock=False)
    assert hashlib.sha256((root/'journal.sqlite').read_bytes()).hexdigest()==original_digest
    start(root,expected_refusal='resources',overrides={'UMask':'0022'})
    assert hashlib.sha256((root/'journal.sqlite').read_bytes()).hexdigest()==original_digest
    evidence['unsafeCreationModeRefused']=True
    # Refuse symlink databases and active sockets without touching unrelated state.
    symlink_root=Path(tempfile.mkdtemp(prefix='obs-link-',dir='/tmp'))
    evidence['symlinkFixture']=str(symlink_root)
    write_config(symlink_root)
    sentinel=symlink_root/'sentinel'
    sentinel.write_text('owned synthetic sentinel')
    sentinel.chmod(0o600)
    (symlink_root/'journal.sqlite').symlink_to(sentinel)
    start(symlink_root,expected_refusal='ownership')
    assert sentinel.read_text()=='owned synthetic sentinel'
    socket_root=Path(tempfile.mkdtemp(prefix='obs-socket-',dir='/tmp'))
    evidence['socketFixture']=str(socket_root)
    write_config(socket_root)
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as existing:
        existing.bind(str(socket_root/'worker.sock'))
        existing.listen(1)
        (socket_root/'worker.sock').chmod(0o600)
        inode=(socket_root/'worker.sock').stat().st_ino
        start(socket_root,expected_refusal='socket')
        assert (socket_root/'worker.sock').stat().st_ino==inode
        assert not (socket_root/'journal.sqlite').exists()
    evidence.update(missingLockRefused=True,symlinkDatabasePreserved=True,activeSocketPreserved=True,result='passed')
finally:
    for unit in units:
        command(['/usr/bin/systemctl','--user','stop',unit],check=False)
    evidence['cleanup']=[{'unit':unit,'mainPid':int(show(unit)['MainPID']),'activeState':show(unit)['ActiveState']} for unit in units]
    for unit in units:
        command(['/usr/bin/systemctl','--user','reset-failed',unit],check=False)
    backend.shutdown()
    backend.server_close()
    backend_thread.join(timeout=3)
    evidence['sourceSha256']={str(file.relative_to(workspace)):hashlib.sha256(file.read_bytes()).hexdigest() for file in [entry,writer,client_fixture,managed_fixture,managed_peer,owner_fixture,workspace/'packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts',workspace/'packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.command.ts',workspace/'packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.command.ts',workspace/'packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.runtime.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-launch-claims.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-claim-population.ts',workspace/'packages/drivers/ai-provider-cli/src/AiProviderCliSession.lifecycle.ts',workspace/'packages/drivers/ai-provider-cli/src/AiProviderCliSession.service.ts',workspace/'packages/drivers/ai-provider-cli/src/AiProviderCliSession.stdio.service.ts',workspace/'packages/drivers/ai-provider-cli/src/AiProviderCliSession.claude.service.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-launch-client.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-launch-http.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-launch-facts.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-worker.ts',workspace/'packages/tooling/library/ai-metrics/src/internal/observation-http-body.ts',workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-launch.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-runtime.ts',workspace/'packages/tooling/library/ai-metrics/src/observation-source-health.ts',workspace/'packages/tooling/library/ai-metrics/src/transcript-discovery.ts',workspace/'packages/tooling/library/ai-metrics/src/transcript-sweep.ts',Path(__file__).resolve()]}
    (root/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({'result':evidence['result'],'evidence':str(root/'evidence.json'),'productionRollout':False}))
