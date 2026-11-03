"""Reuse the existing disposable-object controls with saved storage credentials only."""
from pathlib import Path
import argparse,ast,datetime,hashlib,json,os,re,secrets,signal,stat,sys
if not __debug__:raise SystemExit("Assertion checks are required.")
os.umask(0o077)
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError,ClientError
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output",type=Path,required=True)
args=parser.parse_args()
repo=Path(__file__).resolve().parents[3]
output=args.output.absolute()
intent=output.with_suffix(".intent.json")
try:
 parent=output.parent.lstat()
 assert stat.S_ISDIR(parent.st_mode) and parent.st_uid==os.getuid() and parent.st_mode&0o077==0
 assert output.parent.resolve()==output.parent and not output.parent.is_relative_to(repo)
 assert not output.exists() and not output.is_symlink() and not intent.exists() and not intent.is_symlink()
except (AssertionError,OSError):
 raise SystemExit("A private external output directory and unused report/intent paths are required.")
source=repo/"infra/r2-cache/trial-grants.py"
EXPECTED="71d91c11e6d9251c2a750c1d897a8e8a13ac4f3fbb9b13513bc91b166ee998c7"
report={"driverSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"schemaVersion":"cache-saved-trial-storage-grants/v1","recordedAt":datetime.datetime.now(datetime.UTC).isoformat(),"authority":"Actual saved-credential storage operations only. Current management API policy metadata is not reverified.","signedAdapterActivated":False,"secretValuesInReport":False,"payloadBytesRetained":False,"sourceSha256":EXPECTED,"referencesLoaded":4,"noArtifactKeyOrBearerLoaded":True}
stage="preflight"
try:
 assert boto3.__version__=="1.43.121"
 raw=source.read_bytes();assert hashlib.sha256(raw).hexdigest()==EXPECTED
 outer=next(n for n in ast.parse(raw).body if isinstance(n,ast.Try))
 operation=next(n for n in outer.body if isinstance(n,ast.Try))
 assert operation.lineno==166 and operation.end_lineno==228
 expiry=datetime.datetime.fromisoformat("2026-11-28T00:00:00+00:00");assert datetime.datetime.now(datetime.UTC)<expiry
 endpoint=os.environ["R2_ENDPOINT"];bucket=os.environ["R2_BUCKET"]
 match=re.fullmatch(r"https://([a-f0-9]{32})\.r2\.cloudflarestorage\.com/?",endpoint);assert match
 assert bucket=="beep-turbo-r2-pilot"
 account=match.group(1);clients={};rows=[]
 folder=Path.home()/".local/state/beep/r2-cache/alchemy/state/BeepTurboR2SignedCredentials/r2-signed-credentials"
 for role,logical in [("reader","SignedTrialReader"),("writer","SignedTrialWriter")]:
  statefile=folder/(logical+".json");info=statefile.lstat()
  assert stat.S_ISREG(info.st_mode) and info.st_uid==os.getuid() and info.st_mode&0o077==0
  saved=json.loads(statefile.read_text());assert saved["status"]=="created"
  attr=saved["attr"];assert attr["accountId"]==account
  key=os.environ["R2_"+role.upper()+"_ACCESS_KEY_ID"];secret=os.environ["R2_"+role.upper()+"_SECRET_ACCESS_KEY"]
  assert key==attr["tokenId"] and secret==hashlib.sha256(attr["value"]["__redacted__"].encode()).hexdigest()
  clients[role]=boto3.client("s3",endpoint_url=endpoint,region_name="auto",aws_access_key_id=key,aws_secret_access_key=secret,config=Config(signature_version="s3v4",s3={"addressing_style":"path"},retries={"total_max_attempts":1},connect_timeout=5,read_timeout=10))
  rows.append({"role":role,"matchesSavedAlchemyRole":True,"credentialIdSha256":hashlib.sha256(key.encode()).hexdigest()})
 report["roles"]=rows
 key="__beep_signed_trial_permission_probe/"+secrets.token_hex(16);other=key+"-reader-denial";payload=b"beep-scoped-grant-control\n";operations=[]
 with intent.open("x") as handle:json.dump({"createdAt":report["recordedAt"],"ownedObjectKeys":[key,other],"payloadBytes":len(payload),"state":"intent-recorded-no-automatic-retry"},handle,indent=2)
 def timeout(signum,frame):raise TimeoutError("Bounded storage probe expired.")
 signal.signal(signal.SIGALRM,timeout);signal.alarm(90)
 stage="storage-grants"
 exec(compile(ast.Module(body=[operation],type_ignores=[]),str(source),"exec"),globals())
 signal.alarm(0)
 report.update(result="passed",operations=operations,maximumProbeObjectBytes=len(payload)*2,objectNamespace="dedicated non-cache probe prefix",endpointValuesRetained=False)
 assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED
except BaseException as error:
 signal.alarm(0)
 report.update(result="failed",stage=stage,errorType=type(error).__name__)
 with output.open("x") as handle:json.dump(report,handle,indent=2);handle.write("\n")
 print(json.dumps({"result":"failed","stage":stage,"type":type(error).__name__,"ownedProbeObjectsCleaned":report.get("ownedProbeObjectsCleaned",False),"secretValuesInReport":False}));raise SystemExit(1)
with output.open("x") as handle:json.dump(report,handle,indent=2);handle.write("\n")
print("PASS: saved Alchemy roles match; writer PUT/cleanup and reader exact GET passed; reader PUT/DELETE denied; both owned probe keys absent. No signing or consumer activation.")
