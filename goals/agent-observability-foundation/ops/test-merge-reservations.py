import hashlib,json,os,pathlib,subprocess,tempfile
sibling=pathlib.Path(__file__).with_name('merge-reservations.py')
helper=str(sibling) if sibling.exists() else '/home/elpresidank/.cache/beep/orchestrator/bin/merge-reservations.py'
sha='a'*40
with tempfile.TemporaryDirectory(prefix='beep-merge-guard-') as root:
 p=pathlib.Path(root);env=dict(os.environ)
 original_helper=pathlib.Path(helper).read_text()
 isolated=p/'merge-reservations.py'
 isolated.write_text(original_helper.replace('ROOT = Path(pwd.getpwuid(os.getuid()).pw_dir) / ".local/state/beep/merge-reservations"', 'ROOT = Path('+repr(str(p/'state'))+')'))
 helper=str(isolated)
 def run(args,ok,extra=None):
  r=subprocess.run(['python3',helper,*args],env=env|(extra or {}),capture_output=True,text=True)
  assert (r.returncode==0)==ok,(args,r.returncode,r.stderr)
 def private(path,data):
  path.write_text(json.dumps(data));path.chmod(0o600)
 run(['reserve','--pr','99999','--head',sha,'--owner','test-owner','--capability-file',str(p/'cap')],True)
 for args in [ ['pr','merge','99999'],['pr','ready','99999'],['pr','merge','99999','--auto'],['api','-X','PUT','repos/beep-effect/beep-effect/pulls/99999/merge'],['api','-XPUT','repos/beep-effect/beep-effect/pulls/99999/merge'],['api','graphql','-f','query=mutation{mergePullRequest(input:{pullRequestId:"opaque"}){clientMutationId}}'],['api','graphql','--input','-'] ]:
  run(['guard','--',*args],False)
  run(['guard','--',*args],args[:2]==['pr','ready'],{'BEEP_MERGE_CAPABILITY_FILE':str(p/'cap')})
 for args in [['pr','view','99999'],['pr','merge','88888'],['api','repos/beep-effect/beep-effect/pulls/99999'],['api','graphql','-f','query={viewer{login}}']]:
  run(['guard','--',*args],True)
 gate={'schemaVersion':'yeet-verdict/v2','head':sha,'resolvedHeadSha':sha,'outcome':'success','mode':'monitor','mergeReady':{'ready':True},'createdAt':'2026-01-01T01:00:01Z'}
 observer={'schemaVersion':'yeet-proof-job/v1','phase':'finished','prNumber':99999,'request':{'head':sha,'mode':'monitor','argv':['monitor','--until-ready']},'outcome':{'verdictOutcome':'success'},'systemd':{'serviceResult':'success','exitStatus':'0','finalizedAt':'2026-01-01T01:00:00Z'}}
 status={'head':sha,'mergeReady':{'ready':True},'remote':{'headSha':sha,'number':99999,'state':'OPEN','isDraft':False}}
 private(p/'gate',gate);private(p/'observer',observer);private(p/'status',status)
 (p/'log').write_text('[yeet] merge-ready: yes; every hard criterion is green\n');(p/'log').chmod(0o600)
 proof={'schema':'beep-owner-premerge/v1','repo':'beep-effect/beep-effect','pr':99999,'head':sha,'owner':'test-owner'}
 for kind,name in [('canonicalEvidence','gate'),('jobEvidence','observer'),('statusEvidence','status'),('logEvidence','log')]: proof[kind]={'path':str(p/name),'sha256':hashlib.sha256((p/name).read_bytes()).hexdigest()}
 private(p/'proof',proof)
 owner={'BEEP_MERGE_CAPABILITY_FILE':str(p/'cap'),'BEEP_MERGE_PROOF_FILE':str(p/'proof')}
 run(['check','--pr','99999','--head',sha],True,owner)
 run(['guard','--','pr','ready','99999'],True,{'BEEP_MERGE_CAPABILITY_FILE':str(p/'cap')})
 run(['check','--pr','99999','--head','b'*40],False,owner)
 run(['guard','--','pr','merge','99999','--match-head-commit',sha],True,owner)
 run(['guard','--','pr','merge','99999','--match-head-commit','b'*40],False,owner)
 proof['head']='b'*40;private(p/'proof',proof)
 run(['check','--pr','99999','--head',sha],False,owner)
 proof['head']=sha;private(p/'proof',proof);private(p/'observer',{'head':sha,'terminal':True,'ready':False,'exitCode':0})
 run(['check','--pr','99999','--head',sha],False,owner)
 private(p/'observer',observer)
 for name,content in [('gate',dict(gate,outcome='unknown')),('observer',dict(observer,phase='running')),('status',dict(status,remote=dict(status['remote'],state='MERGED'))),('log','[yeet] pull request is MERGED; the post-merge workspace sweep ran\n')]:
  original=(p/name).read_bytes()
  if name=='log': (p/name).write_text(content)
  else: private(p/name,content)
  key={'gate':'canonicalEvidence','observer':'jobEvidence','status':'statusEvidence','log':'logEvidence'}[name]
  proof[key]['sha256']=hashlib.sha256((p/name).read_bytes()).hexdigest();private(p/'proof',proof)
  run(['check','--pr','99999','--head',sha],False,owner)
  (p/name).write_bytes(original);proof[key]['sha256']=hashlib.sha256(original).hexdigest();private(p/'proof',proof)
 run(['check','--pr','99999','--head',sha],True,owner)
 for prefix in [ ['--subject','88888'],['--subject=88888'],['-t88888'],['--body','88888'],['--body','--disable-auto'],['--subject','--repo=other/repo'] ]:
  run(['guard','--','pr','merge',*prefix,'99999','--squash','--match-head-commit',sha],False)
 run(['guard','--','pr','merge','88888','99999','--squash'],False)
 run(['guard','--','pr','merge','--unknown','88888','99999'],False)
 run(['guard','--','pr','merge','--subject','88888','99999','--squash','--match-head-commit',sha],True,owner)
 run(['guard','--','pr','merge','99999','--disable-auto'],True)
 run(['guard','--','pr','merge','99999','--disable-auto=true'],True)
 run(['guard','--','pr','merge','99999','--disable-auto=false','--match-head-commit',sha],False,owner)
 run(['guard','--','pr','merge','99999','--auto','--disable-auto'],False,owner)
 run(['guard','--','pr','merge','99999','--auto','--match-head-commit',sha],False,owner)
 run(['guard','--','pr','merge','99999','--auto=true','--match-head-commit',sha],False,owner)
 run(['guard','--','api','graphql','-fquery=mutation{mergePullRequest(input:{pullRequestId:"opaque"}){clientMutationId}}'],False,owner)
 run(['guard','--','api','repos/beep-effect/beep-effect/pulls/99999/merge','-fmerge_method=squash'],False,owner)
 run(['guard','--','api','-XPUT','repos/beep-effect/beep-effect/pulls/99999/merge/'],False)
 run(['guard','--','api','https://api.github.com/graphql/','-fquery=mutation{mergePullRequest(input:{pullRequestId:"opaque"}){clientMutationId}}'],False)
 run(['advance','--pr','99999','--old-head',sha,'--head','b'*40],False)
 run(['advance','--pr','99999','--old-head','c'*40,'--head','b'*40],False,owner)
 run(['advance','--pr','99999','--old-head',sha,'--head','b'*40],True,owner)
 run(['check','--pr','99999','--head',sha],False,owner)
 run(['advance','--pr','99999','--old-head','b'*40,'--head',sha],True,owner)
 # A fake transport writes a receipt only when local guard allows invocation.
 fake=p/'fake-gh';fake.write_text('#!/bin/sh\nprintf called > "$FAKE_GH_RECEIPT"\n');fake.chmod(0o700)
 wrapper=p/'fake-ghapp';wrapper.write_text('#!/bin/sh\npython3 '+helper+' guard -- "$@" || exit $?\nexec '+str(fake)+' "$@"\n');wrapper.chmod(0o700)
 fakeenv=env|{'FAKE_GH_RECEIPT':str(p/'transport')}
 r=subprocess.run([str(wrapper),'pr','merge','99999'],env=fakeenv,capture_output=True);assert r.returncode==73 and not (p/'transport').exists()
 r=subprocess.run([str(wrapper),'pr','view','99999'],env=fakeenv,capture_output=True);assert r.returncode==0 and (p/'transport').exists()
 if os.environ.get('BEEP_MERGE_TEST_ARCHIVE'):
  # Original archive compatibility: its successful monitor legitimately followed
  # a later push; the new stricter reservation requires a fresh exact-head job.
  archive=pathlib.Path(os.environ['BEEP_MERGE_TEST_ARCHIVE'])
  positive=archive/'pr2621-premerge-terminal-ready'
  actual=json.loads((positive/'canonical-positive-verdict.json').read_text())
  actualjob=json.loads((positive/'f6a8ab42-92a3-42d0-b3bb-9741ea970a0b.json').read_text())
  assert actual['outcome']=='success' and actual['mergeReady']['ready'] is True
  assert actualjob['request']['head']!=actual['resolvedHeadSha']
  run(['reserve','--pr','2621','--head',actual['resolvedHeadSha'],'--owner','archive-test','--capability-file',str(p/'archivecap')],True)
  archiveproof={'schema':'beep-owner-premerge/v1','repo':'beep-effect/beep-effect','pr':2621,'head':actual['resolvedHeadSha'],'owner':'archive-test'}
  for key,name in [('canonicalEvidence','canonical-positive-verdict.json'),('jobEvidence','f6a8ab42-92a3-42d0-b3bb-9741ea970a0b.json'),('statusEvidence','status.json'),('logEvidence','f6a8ab42-92a3-42d0-b3bb-9741ea970a0b.log')]:
   target=p/('archive-'+name);target.write_bytes((positive/name).read_bytes());target.chmod(0o600)
   archiveproof[key]={'path':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
  private(p/'archiveproof',archiveproof)
  run(['check','--pr','2621','--head',actual['resolvedHeadSha']],False,{'BEEP_MERGE_CAPABILITY_FILE':str(p/'archivecap'),'BEEP_MERGE_PROOF_FILE':str(p/'archiveproof')})
  negative=json.loads((archive/'pr2649-unexpected-merge-20261103/verdict.json').read_text())
  assert negative.get('outcome')!='success' or negative.get('mergeReady',{}).get('ready') is not True
 print('PASS: local refusal/allowance, owner head CAS, fake transport and optional original receipt compatibility scenarios; no network')
