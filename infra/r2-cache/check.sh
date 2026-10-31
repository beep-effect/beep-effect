#!/usr/bin/env bash
# Real-process lifecycle and cache-only enrollment/rollback checks. No cloud access.
set -euo pipefail
set +x
root="$(cd "$(dirname "$0")" && pwd)"
"$root/adapter.sh" install
python3 - "$root" <<'PY'
import hashlib,http.server,json,os,pathlib,re,shutil,socket,subprocess,sys,tarfile,tempfile,threading,time,uuid
source=pathlib.Path(sys.argv[1]);parent=pathlib.Path.home()/'.cache/beep/r2-cache-check';parent.mkdir(parents=True,exist_ok=True)
def run(args,env,ok=True,cwd=None):
    p=subprocess.run(args,env=env,capture_output=True,text=True,timeout=30,cwd=cwd)
    if ok and p.returncode:raise AssertionError('Subprocess failed: '+pathlib.Path(args[0]).name)
    return p
with tempfile.TemporaryDirectory(dir=parent) as directory:
    base=pathlib.Path(directory);config=base/'config';state=base/'state';checkout=base/'checkout';checkout.mkdir()
    env={**os.environ,'XDG_CONFIG_HOME':str(config),'XDG_STATE_HOME':str(state)}
    run(['git','init','-q',str(checkout)],env)
    cfg=config/'beep/r2-cache';cfg.mkdir(parents=True)
    (cfg/'workstation.env').write_text('TURBO_TOKEN=op://fixture/item/bearer\nTURBO_TEAM=fixture\nR2_ADAPTER_PORT=9427\n')
    original='UNRELATED=fixture\nTURBO_API=https://original.invalid\nTURBO_TOKEN=op://fixture/item/old\nTURBO_TEAM=fixture\nTURBO_CACHE=local:rw,remote:r\n'
    dotenv=checkout/'.env';dotenv.write_text(original)
    run([str(source/'workstation.sh'),'enable',str(checkout)],env)
    enrolled=dotenv.read_text();assert 'BEEP_TURBO_TRUSTED_WRITER=true' in enrolled
    receipt=next((state/'beep/r2-cache').glob('enrollment-*.json'))
    saved=json.loads(receipt.read_text());assert 'UNRELATED' not in saved['before']
    dotenv.write_text(enrolled+'LATER_EDIT=retained\n')
    run([str(source/'workstation.sh'),'rollback',str(checkout)],env)
    assert dotenv.read_text()==original+'LATER_EDIT=retained\n'
    # The direct launcher keeps its own options before the task-argument boundary.
    launcherbin=base/'launcher-bin';launcherbin.mkdir()
    launcherop=launcherbin/'op';launcher_capture=base/'launcher-argv.json'
    launcherop.write_text('#!/usr/bin/python3\nimport json,os,sys\nfrom pathlib import Path\nPath('+repr(str(launcher_capture))+').write_text(json.dumps({"args":sys.argv[1:],"unrelated_present":"APPLICATION_REFERENCE" in os.environ}))\n')
    launcherop.chmod(0o700);(cfg/'client.env').write_text('TURBO_TOKEN=op://fixture/item/bearer\n')
    run(['git','-C',str(checkout),'remote','add','origin','https://github.com/beep-effect/beep-effect.git'],env)
    native=checkout/'node_modules/.bin/turbo';native.parent.mkdir(parents=True);native.write_text('inert fixture')
    launcher_env={**env,'PATH':str(launcherbin)+os.pathsep+env['PATH'],'APPLICATION_REFERENCE':'op://fixture/app/secret','TURBO_CACHE_DIR':str(base/'shared cache')}
    run([str(source/'turbo.sh'),'build','--','--task-flag'],launcher_env,cwd=checkout)
    capture=json.loads(launcher_capture.read_text());assert not capture['unrelated_present']
    assert capture['args'][-5:]==['build','--cache-dir='+str(base/'shared cache'),'--summarize','--','--task-flag']
    assert capture['args'][capture['args'].index('--')+1]==str(native)
    cli=checkout/'packages/tooling/tool/cli/src/bin.ts';cli.parent.mkdir(parents=True);cli.write_text('inert fixture')
    runtime=cli.parent/'commands/Cache/Cache.runtime.ts';runtime.parent.mkdir(parents=True);runtime.write_text('inert fixture')
    run([str(source/'turbo.sh'),'build','--cache-dir=explicit','--summarize=false','--','--cache-dir=task'],launcher_env,cwd=checkout)
    modern=json.loads(launcher_capture.read_text())['args']
    assert modern[modern.index('--')+1:][:7]==['bun','--no-env-file',str(cli),'cache','execute','--','run']
    assert json.loads(launcher_capture.read_text())['args'][-5:]==['build','--cache-dir=explicit','--summarize=false','--','--cache-dir=task']
    previous=launcher_capture.read_text()
    run(['git','-C',str(checkout),'remote','set-url','origin','https://github.com/private/fork.git'],env)
    assert run([str(source/'turbo.sh'),'build'],launcher_env,False,cwd=checkout).returncode!=0
    assert launcher_capture.read_text()==previous
    exported=original.replace('TURBO_','export TURBO_').replace('export TURBO_API=','  export TURBO_API  =').replace('export TURBO_TOKEN=op://fixture/item/old','export TURBO_TOKEN="op://fixture/item/old" # retain reference comment')
    dotenv.write_text(exported)
    run([str(source/'workstation.sh'),'enable',str(checkout)],env)
    assert '  export TURBO_API  =http://127.0.0.1:9427' in dotenv.read_text()
    dotenv.write_text(dotenv.read_text()+'LATER_EDIT=retained\n')
    run([str(source/'workstation.sh'),'rollback',str(checkout)],env)
    assert dotenv.read_text()==exported+'LATER_EDIT=retained\n'
    dotenv.write_text(original+'TURBO_CACHE=local:rw\n')
    assert run([str(source/'workstation.sh'),'enable',str(checkout)],env,False).returncode!=0
    dotenv.write_text(original+'export TURBO_TOKEN=op://fixture/item/duplicate\n')
    assert run([str(source/'workstation.sh'),'enable',str(checkout)],env,False).returncode!=0
    dotenv.write_text(original.replace('op://fixture/item/old','fixture-raw-token'))
    assert run([str(source/'workstation.sh'),'enable',str(checkout)],env,False).returncode!=0
    dotenv.write_text(original)
    run([str(source/'workstation.sh'),'enable',str(checkout),'local:rw,remote:r'],env)
    assert 'BEEP_TURBO_TRUSTED_WRITER=false' in dotenv.read_text()
    assert 'TURBO_CACHE=local:rw,remote:r' in dotenv.read_text()
    # Re-enrollment upgrades only cache fields and retains the original AWS rollback.
    assert 'BEEP_TURBO_HOST_CACHE_MANAGED=true' in dotenv.read_text()
    dotenv.write_text(dotenv.read_text()+'LATER_EDIT=retained\n')
    run([str(source/'workstation.sh'),'enable',str(checkout)],env)
    assert 'TURBO_CACHE=local:rw,remote:rw' in dotenv.read_text()
    run([str(source/'workstation.sh'),'rollback',str(checkout)],env)
    assert dotenv.read_text()==original+'LATER_EDIT=retained\n'
    # A failed CI bootstrap leaves the AWS environment file untouched.
    jobenv=base/'github.env';jobenv.write_text('ORIGINAL_CACHE=retained\n')
    ci={**os.environ,'GITHUB_ENV':str(jobenv),'RUNNER_TEMP':str(base)}
    run([str(source/'adapter.sh'),'start-ci'],ci)
    assert jobenv.read_text()=='ORIGINAL_CACHE=retained\n'
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    # Inert credentials: health and lifecycle checks do not call R2.
    ci.update({'R2_ENDPOINT':'https://'+'0'*32+'.r2.cloudflarestorage.com','R2_BUCKET':'fixture','R2_ACCESS_KEY_ID':'fixture','R2_SECRET_ACCESS_KEY':'fixture','TURBO_TEAM':'fixture','R2_ADAPTER_PORT':str(port),'OP_FIXTURE_SECRET':'fixture','APPLICATION_FIXTURE_SECRET':'fixture','RUNNER_TRACKING_ID':'fixture-runner'})
    fakebin=base/'fakebin';fakebin.mkdir();curl=fakebin/'curl'
    curl.write_text('#!/bin/sh\nexit 1\n');curl.chmod(0o700)
    failed_env={**ci,'PATH':str(fakebin)+os.pathsep+ci['PATH'],'XDG_CACHE_HOME':str(base/'empty-cache')}
    run([str(source/'adapter.sh'),'start-ci'],failed_env)
    assert jobenv.read_text()=='ORIGINAL_CACHE=retained\n'
    class ExistingService(http.server.BaseHTTPRequestHandler):
        def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'healthy')
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),ExistingService)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        run([str(source/'adapter.sh'),'start-ci'],{**ci,'R2_ADAPTER_PORT':str(server.server_port)})
        assert jobenv.read_text()=='ORIGINAL_CACHE=retained\n'
        assert not (base/'beep-r2-adapter.pid').exists()
        assert thread.is_alive()
    finally:server.shutdown();server.server_close();thread.join(timeout=5)
    pid=None
    try:
        run([str(source/'adapter.sh'),'start-ci'],ci)
        pid=int((base/'beep-r2-adapter.pid').read_text())
        names={row.split(b'=',1)[0].decode() for row in pathlib.Path('/proc',str(pid),'environ').read_bytes().split(b'\0') if row}
        assert 'OP_FIXTURE_SECRET' not in names and 'APPLICATION_FIXTURE_SECRET' not in names
        assert 'S3_SECRET_KEY' in names and 'RUNNER_TRACKING_ID' in names
        assert 'TURBO_API=http://127.0.0.1:'+str(port) in jobenv.read_text()
        run([str(source/'adapter.sh'),'stop-ci'],ci)
        for _ in range(50):
            try:actual=pathlib.Path('/proc',str(pid),'exe').resolve(strict=True)
            except (FileNotFoundError,PermissionError):break
            time.sleep(.1)
        else:raise AssertionError('Adapter process remained after cleanup')
    finally:
        if pid:
            try:os.kill(pid,15)
            except ProcessLookupError:pass
    # Exercise the signed exec boundary with an inert executable, not storage.
    signed=base/'signed-adapter-spy'
    signed.write_text('#!/usr/bin/python3\nimport json,os,sys\nrole=os.environ.get("BEEP_CACHE_ACCESS_ROLE")\nprint(json.dumps({"names":sorted(os.environ),"policy":os.environ.get("BEEP_CACHE_POLICY"),"role":role,"namespace":os.environ.get("BEEP_CACHE_NAMESPACE"),"storageMatches":os.environ.get("S3_ACCESS_KEY")=="fixture" and os.environ.get("S3_SECRET_KEY")=="fixture","bearerMatches":os.environ.get("TURBO_TOKEN")=="synthetic-"+(role or "writer")+"-bearer","fixedRuntime":os.environ.get("TOKIO_WORKER_THREADS")=="2" and os.environ.get("OTEL_SDK_DISABLED")=="true","argc":len(sys.argv)}))\n')
    signed.chmod(0o700);signed_hash=hashlib.sha256(signed.read_bytes()).hexdigest()
    signed_env={'PATH':os.environ['PATH'],'HOME':str(base),'LANG':'C.UTF-8','RUNNER_TRACKING_ID':'fixture-runner',
        **{name:ci[name] for name in ['R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_ADAPTER_PORT']},
        'R2_SIGNED_ADAPTER':str(signed),'R2_SIGNED_ADAPTER_SHA256':signed_hash,'TURBO_TOKEN':'synthetic-writer-bearer',
        'BEEP_CACHE_POLICY':'legacy','BEEP_CACHE_NAMESPACE':'team_beep_fixture_signed','BEEP_CACHE_ACCESS_ROLE':'writer',
        'TURBO_REMOTE_CACHE_SIGNATURE_KEY':'synthetic-artifact-key-not-for-backend','APPLICATION_FIXTURE_SECRET':'fixture',
        'TOKIO_WORKER_THREADS':'99','OTEL_SDK_DISABLED':'false'}
    ordinary_names={'PATH','HOME','LANG','RUNNER_TRACKING_ID','HOST','PORT','S3_ENDPOINT','S3_REGION','S3_BUCKET_NAME','S3_ACCESS_KEY','S3_SECRET_KEY','S3_USE_PATH_STYLE','TOKIO_WORKER_THREADS','OTEL_SDK_DISABLED','TURBO_TOKEN'}
    policy_names={'BEEP_CACHE_POLICY','BEEP_CACHE_NAMESPACE','BEEP_CACHE_ACCESS_ROLE'}
    for role in ['reader','writer']:
        observed=json.loads(run([str(source/'adapter.sh'),'serve-signed'],{**signed_env,'BEEP_CACHE_ACCESS_ROLE':role,'TURBO_TOKEN':'synthetic-'+role+'-bearer'}).stdout)
        assert set(observed['names'])==ordinary_names|policy_names,'Signed backend inherited unrelated environment'
        assert observed['policy']=='signed-v1' and observed['role']==role and observed['namespace']=='team_beep_fixture_signed'
        assert observed['storageMatches'] and observed['bearerMatches'] and observed['fixedRuntime'] and observed['argc']==1
    for invalid in [
        {**signed_env,'R2_SIGNED_ADAPTER_SHA256':'0'*64},
        {**signed_env,'R2_SIGNED_ADAPTER_SHA256':'not-a-sha256'},
        {**signed_env,'R2_SIGNED_ADAPTER':'relative-adapter'},
        {**signed_env,'R2_SIGNED_ADAPTER':str(base/'absent-adapter')},
        {**signed_env,'BEEP_CACHE_ACCESS_ROLE':'admin'},
        {key:value for key,value in signed_env.items() if key!='BEEP_CACHE_NAMESPACE'},
        {key:value for key,value in signed_env.items() if key!='BEEP_CACHE_ACCESS_ROLE'},
    ]:
        rejected=run([str(source/'adapter.sh'),'serve-signed'],invalid,False)
        assert rejected.returncode!=0 and rejected.stdout=='','Invalid signed launch executed the candidate'
    signed.chmod(0o600)
    assert run([str(source/'adapter.sh'),'serve-signed'],signed_env,False).returncode!=0
    signed.chmod(0o700)
    # Substitute only the ordinary release pin in a private fixture copy.
    ordinary_launcher=base/'ordinary-adapter-fixture.sh'
    ordinary_text,count=re.subn(r'^checksum=[a-f0-9]{64}$','checksum='+signed_hash,(source/'adapter.sh').read_text(),flags=re.M)
    assert count==1;ordinary_launcher.write_text(ordinary_text);ordinary_launcher.chmod(0o700)
    ordinary_cache=base/'ordinary-cache';ordinary_binary=ordinary_cache/'beep/turbo-r2/4.0.20/decay';ordinary_binary.parent.mkdir(parents=True)
    shutil.copyfile(signed,ordinary_binary);ordinary_binary.chmod(0o700)
    ordinary=json.loads(run([str(ordinary_launcher),'serve'],{**signed_env,'XDG_CACHE_HOME':str(ordinary_cache),'BEEP_CACHE_POLICY':'signed-v1','BEEP_CACHE_ACCESS_ROLE':'admin'}).stdout)
    assert set(ordinary['names'])==ordinary_names and ordinary['policy'] is None and ordinary['role'] is None and ordinary['namespace'] is None
    assert ordinary['storageMatches'] and ordinary['bearerMatches'] and ordinary['fixedRuntime'] and ordinary['argc']==1
    print('PASS: explicit pinned signed reader/writer exec; invalid pins/roles refused; artifact key and unrelated environment excluded; ordinary mode ignores signed policy.')
    # Render install with an inert op executable; no vault operation is performed.
    real_systemctl=shutil.which('systemctl');fixturebin=base/'bin space % dollar$';fixturebin.mkdir()
    cfgroot=base/'config space % dollar$';dataroot=base/'data space % dollar$'
    fixturecfg=cfgroot/'beep/r2-cache/workstation.env';fixturecfg.parent.mkdir(parents=True)
    fixturecfg.write_text('R2_ACCESS_KEY_ID=op://fixture/item/key\nR2_SECRET_ACCESS_KEY=op://fixture/item/secret\nTURBO_TOKEN=op://fixture/item/bearer\nTURBO_TEAM=fixture\n')
    argsfile=base/'op-argv.jsonl';fakeop=fixturebin/'op';fakecontrol=fixturebin/'systemctl'
    fakeop.write_text('#!/usr/bin/python3\nimport json,sys\nfrom pathlib import Path\nwith Path('+repr(str(argsfile))+').open("a") as out:out.write(json.dumps(sys.argv[1:])+"\\n")\n')
    fakeop.chmod(0o700);fakecontrol.write_text('#!/bin/sh\nexit 0\n');fakecontrol.chmod(0o700)
    install_env={**os.environ,'PATH':str(fixturebin)+os.pathsep+os.environ['PATH'],'XDG_CONFIG_HOME':str(cfgroot),'XDG_DATA_HOME':str(dataroot),'XDG_STATE_HOME':str(base/'install-state'),'BEEP_R2_BIN_HOME':str(base/'installed-bin')}
    run([str(source/'workstation.sh'),'install'],install_env)
    client=(fixturecfg.with_name('client.env')).read_text();assert 'R2_SECRET_ACCESS_KEY' not in client
    rendered=cfgroot/'systemd/user/beep-turbo-r2.service'
    manager_env={**os.environ,'XDG_RUNTIME_DIR':'/run/user/'+str(os.getuid()),'DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/'+str(os.getuid())+'/bus'}
    if real_systemctl and run([real_systemctl,'--user','is-active','default.target'],manager_env,False).returncode==0:
        unit='beep-turbo-r2-fixture-'+uuid.uuid4().hex+'.service'
        runtime=pathlib.Path(manager_env['XDG_RUNTIME_DIR'])/'systemd/user';runtime.mkdir(parents=True,exist_ok=True)
        unitfile=runtime/unit;unitfile.write_text(rendered.read_text())
        try:
            run([real_systemctl,'--user','daemon-reload'],manager_env)
            started=run([real_systemctl,'--user','start',unit],manager_env,False)
            if started.returncode:
                detail=run([real_systemctl,'--user','show',unit,'--property=Result,ExecMainStatus,ExecStart'],manager_env,False)
                raise AssertionError('Inert fixture service failed: '+detail.stdout)
            expected=['run','--env-file='+str(fixturecfg),'--',str(dataroot/'beep/r2-cache/adapter.sh'),'serve']
            for _ in range(100):
                calls=[json.loads(line) for line in argsfile.read_text().splitlines()]
                if expected in calls:break
                time.sleep(.05)
            else:raise AssertionError('Rendered user service did not preserve exact arguments')
            print('PASS: installed user-service argument parsing with spaces, percent and dollar characters; inert op only.')
        finally:
            run([real_systemctl,'--user','stop',unit],manager_env,False)
            unitfile.unlink(missing_ok=True);run([real_systemctl,'--user','daemon-reload'],manager_env,False)
    else:print('SKIP: live user-service parsing requires an active systemd user manager.')
    # Real state-copy/archive operations with inert git/bun boundaries, never a cloud call.
    archivebin=base/'archive-bin';archivebin.mkdir();cache_root=base/'archive-cache';state_root=base/'archive-state'
    script=(source/'alchemy.sh').read_text()
    pins={name:re.search(r'^'+name+r'=([a-f0-9]{40})$',script,re.M).group(1) for name in ['revision','distilled']}
    fakegit=archivebin/'git';fakebun=archivebin/'bun'
    fakegit.write_text('#!/usr/bin/python3\nimport sys\npins='+repr(pins)+'\nkey=sys.argv[-1]\nassert key in ["HEAD","HEAD:submodules/distilled"]\nprint(pins["revision" if key=="HEAD" else "distilled"])\n')
    fakegit.chmod(0o700);fakebun.write_text('#!/bin/sh\nexit 0\n');fakebun.chmod(0o700)
    tool=cache_root/'beep/alchemy-r2-pilot-95f1581';(tool/'.git').mkdir(parents=True)
    (tool/'node_modules').mkdir();(tool/'submodules/distilled').mkdir(parents=True);(tool/'submodules/distilled/.git').touch()
    (tool/'.alchemy').mkdir();(tool/'.alchemy/state.json').write_text('{"version":1}')
    archive_env={**os.environ,'PATH':str(archivebin)+os.pathsep+os.environ['PATH'],'XDG_CACHE_HOME':str(cache_root),'XDG_STATE_HOME':str(state_root)}
    run([str(source/'alchemy.sh'),'plan'],archive_env)
    assert (tool/'pilot/alchemy.run.ts').read_bytes()==(source/'alchemy.run.ts.template').read_bytes()
    durable=state_root/'beep/r2-cache/alchemy';(durable/'state.json').write_text('{"version":2}')
    run([str(source/'alchemy.sh'),'plan'],archive_env)
    archives=list(durable.parent.glob('state-before-plan-*.tar.gz'));assert len(archives)==2
    versions=[]
    for archive in archives:
        with tarfile.open(archive) as saved:versions.append(json.load(saved.extractfile('alchemy/state.json'))['version'])
    assert sorted(versions)==[1,2]
    assert (tool/'.alchemy.before-durable-state/state.json').read_text()=='{"version":1}'
    print('PASS: repeated Alchemy plans retain distinct pre-operation archives and the original recovery state; inert tool boundaries only.')
    # Execute the actual source-bound exception guard against adversarial locks.
    # The end-to-end OSV run separately verifies the positive scanner invocation.
    marker="    if python3 - \"$run/Cargo.lock\" <<'PY'\n"
    policy=(source/'policy.sh').read_text();assert policy.count(marker)==1
    guard=policy.split(marker,1)[1].split('\nPY\n',1)[0]
    reviewed={'name':'block-buffer','version':'0.10.4','checksum':'3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71'}
    guard_lock=base/'guard-Cargo.lock'
    for packages,allowed in [([reviewed],True),([],False),
        ([{**reviewed,'version':'0.11.0'}],False),
        ([{**reviewed,'checksum':'0'*64}],False),
        ([reviewed,{**reviewed,'version':'0.11.0'}],False)]:
        guard_lock.write_text(''.join('[[package]]\n'+''.join(f'{k} = {json.dumps(v)}\n' for k,v in package.items()) for package in packages))
        checked=subprocess.run([sys.executable,'-',str(guard_lock)],input=guard,text=True,capture_output=True,timeout=5)
        assert (checked.returncode==0)==allowed,'Security exception admitted an unreviewed dependency'
    print('PASS: exact-archive advisory guard; absent, changed-version, changed-checksum and mixed-version inputs get no exception.')
print('PASS: enrollment/export-line rollback preservation, duplicate/raw-token refusal, occupied-port/startup fallback, secret isolation, runner tracking and exact-process cleanup.')
PY
