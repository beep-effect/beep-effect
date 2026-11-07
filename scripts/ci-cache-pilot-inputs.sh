#!/usr/bin/env bash
# Operational adapter for the existing typed activation/dependency/pilot commands.
set -euo pipefail
mode="${1:-signed}"
computation="${2:-@beep/identity#lint}"
case "$mode" in signed|local) ;; *) echo 'Unsupported pilot input mode.' >&2; exit 64 ;; esac
case "$computation" in '@beep/identity#lint'|'@beep/types#lint') ;; *) echo 'Unsupported pilot computation.' >&2; exit 64 ;; esac
if [[ "$mode" == signed && "$computation" != '@beep/identity#lint' ]]; then
  echo 'Signed execution remains restricted to identity lint.' >&2
  exit 64
fi
export BEEP_CACHE_PILOT_MODE="$mode" BEEP_CACHE_PILOT_COMPUTATION="$computation"
if [[ "$mode" == signed ]]; then
  export BEEP_CACHE_PILOT_INPUTS='.beep/cache/protected-producer-trial'
else
  export BEEP_CACHE_PILOT_INPUTS='.beep/cache/local-pilot-observation'
fi
umask 077
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
git diff --quiet HEAD
python3 - <<'PY'
import base64,hashlib,io,json,os,pathlib,re,shutil,tarfile,urllib.parse,urllib.request
root=pathlib.Path.cwd()
private=pathlib.Path(os.environ['BEEP_CACHE_PRODUCER_PRIVATE_ROOT'])
channel=os.environ['BEEP_CACHE_PRODUCER_CHANNEL']
if channel not in ['stable','canary']:
    raise SystemExit('Only the two reviewed native channels are supported.')
pins=json.loads((root/'goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json').read_text())[channel]
executable=root/'node_modules/@turbo/linux-64/bin/turbo'
if channel=='canary':
    url=urllib.parse.urlsplit(pins['tarball'])
    if url.scheme!='https' or url.netloc!='registry.npmjs.org' or url.query or url.fragment:
        raise SystemExit('Native canary must use its reviewed public registry source.')
    with urllib.request.urlopen(pins['tarball'],timeout=30) as response:
        archive=response.read(64*1024*1024+1)
    if len(archive)>64*1024*1024 or 'sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode()!=pins['integrity']:
        raise SystemExit('Native canary archive differs from its reviewed integrity.')
    with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as package:
        members=package.getmembers()
        if len(members)>32 or sum(m.size for m in members)>128*1024*1024:
            raise SystemExit('Native canary archive exceeds its reviewed extraction bounds.')
        matches=[m for m in members if m.name==pins['archiveMember']]
        if len(matches)!=1 or not matches[0].isfile() or not 0<matches[0].size<=64*1024*1024:
            raise SystemExit('Native canary executable member is invalid.')
        with package.extractfile(matches[0]) as member:
            native=member.read(64*1024*1024+1)
    executable=private/'turbo-canary'
    with executable.open('xb') as output:
        output.write(native)
    executable.chmod(0o500)
if hashlib.sha256(executable.read_bytes()).hexdigest()!=pins['sha256']:
    raise SystemExit('Native client differs from its reviewed binary pin.')
folder=root/os.environ['BEEP_CACHE_PILOT_INPUTS']
folder.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
folder.mkdir(mode=0o700)
computation=os.environ['BEEP_CACHE_PILOT_COMPUTATION']
profiles={'@beep/identity#lint':'packages/foundation/modeling/identity/turbo.json',
          '@beep/types#lint':'packages/foundation/primitive/types/turbo.json'}
profile=profiles[computation]
before=(root/profile).read_bytes()
after=json.loads(before)
if after['tasks']['lint'].get('cache') is not False:
    raise SystemExit('The selected lint pilot source profile changed; renew its review.')
after['tasks']['lint']['cache']=True
(folder/'before.json').write_bytes(before)
(folder/'after.json').write_text(json.dumps(after,indent=2)+'\n')
def reference(name):
    file=folder/name
    return {'path':file.relative_to(root).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
(folder/'activation-request.json').write_text(json.dumps({'computation':computation,
    'path':profile,'before':reference('before.json'),'after':reference('after.json')})+'\n')
if not re.fullmatch('[1-9][0-9]*',os.environ['GITHUB_RUN_ID']) or not re.fullmatch('[1-9][0-9]*',os.environ['GITHUB_RUN_ATTEMPT']):
    raise SystemExit('Hosted run identity is invalid.')
prefix='cache-producer-'+os.environ['GITHUB_RUN_ID']+'-'+os.environ['GITHUB_RUN_ATTEMPT']
trees=[str(root)+'-worktrees/'+prefix+'-'+suffix for suffix in ['a','b']]
(folder/'tools.json').write_text(json.dumps({'executable':str(executable.resolve()),'client':{
    'version':pins['reportedVersion'],'sha256':pins['sha256'],'namespace':('team_beep_signed_canary_v1' if os.environ['BEEP_CACHE_PILOT_MODE']=='signed' else 'team_beep_local_observation_v1')},'worktrees':trees})+'\n')
with open(os.environ['GITHUB_OUTPUT'],'a') as output:
    output.write('source_inputs='+str(folder)+'\nworktree_a='+trees[0]+'\nworktree_b='+trees[1]+'\n')
PY
bun --no-env-file run beep cache dependencies --output "$BEEP_CACHE_PILOT_INPUTS/dependencies.json"
bun --no-env-file run beep cache activation --request "$BEEP_CACHE_PILOT_INPUTS/activation-request.json" --output "$BEEP_CACHE_PILOT_INPUTS/activation.json"
python3 - <<'PY'
import hashlib,json,os,pathlib,shutil,subprocess
root=pathlib.Path.cwd();folder=root/os.environ['BEEP_CACHE_PILOT_INPUTS']
tools=json.loads((folder/'tools.json').read_text())
pathlib.Path(tools['worktrees'][0]).parent.mkdir(mode=0o700,exist_ok=True)
for tree in tools['worktrees']:
    subprocess.run(['git','worktree','add','--detach',tree,os.environ['GITHUB_SHA']],check=True)
def reference(name):
    file=folder/name
    return {'path':file.relative_to(root).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
request={'sourceRoot':str(root),'pilot':{'channel':os.environ['BEEP_CACHE_PRODUCER_CHANNEL'],
    'client':tools['client'],'executable':tools['executable'],
    'biomeExecutable':str((root/'node_modules/@biomejs/cli-linux-x64/biome').resolve(strict=True)),
    'nodeExecutable':str(pathlib.Path(shutil.which('node')).resolve(strict=True)),
    'dependencies':reference('dependencies.json'),'worktrees':tools['worktrees'],
    'activation':reference('activation.json'),'selection':'full'}}
selected=request if os.environ['BEEP_CACHE_PILOT_MODE']=='signed' else request['pilot']
(folder/'request.json').write_text(json.dumps(selected)+'\n')
PY
git diff --quiet HEAD
