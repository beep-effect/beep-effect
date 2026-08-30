# Round 3 seat H: post-grill delta attack

Date: 2026-08-27

Scope: post-grill application-pass delta only. Settled round-1 and round-2
dispositions are revisited only where current text may have regressed a claimed
repair.

## Baseline

The required command was attempted first:

```console
$ cd explorations/beep-ci-operational-ontology/research/scripts
$ uv run --with pyyaml,rdflib python validate_packet.py && uv run --with pyoxigraph python run_cq_suite.py
error: Could not acquire lock
  Caused by: Could not create temporary file
  Caused by: Read-only file system (os error 30) at path "~/.cache/uv/.tmp4ulrjp"
```

Pointing `UV_CACHE_DIR` at `/tmp` passed the filesystem boundary but could not
resolve packages because network access is disabled. I then ran the same two
scripts with the already cached PyYAML 6.0.3, RDFLib 7.6.0, pyparsing 3.3.2,
and pyoxigraph 0.5.9 archives on `PYTHONPATH`:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/R3O9atmNgFABYDTQ:$HOME/.cache/uv/archive-v0/ycTSDtY9NyNqVDD0:$HOME/.cache/uv/archive-v0/EBmnurdJTFAYTEfR python validate_packet.py && PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python run_cq_suite.py
OK: parsed 26 CQs, 5 use cases, 25 manifest entries
OK: 25 SPARQL files parsed

Suite: 26 CQs (18 must / 7 should), 25 tests, 40 classes / 69 properties / 4 individuals
RESULT: 0 blockers, 0 warns
...
RESULT: 0 failure(s) across 25 seed tests + 12 fixtures
```

The baseline is green. The review below attacks what those passing fixtures and
oracles may not cover.

## Findings

### BLOCKER H-01: CQ-019 still loses a schedule's narrowed scope when the derived proposal edge is absent

**Claim.** The new schedule-provenance arm does not close the round-2 Seat G
hole. CQ-020 obtains a proposal's effective scopes from
`hasStep/schedulesWorkUnit/hasScope`, but CQ-019 inspects only a separately
materialized `ScheduleProposal hasScope` edge. If that derived edge and the
provenance edge are both omitted, CQ-020 exposes the narrowed schedule while
CQ-019 returns zero violations. The antecedent ASK still passes on the seed's
other narrowed subject, so its existential population check cannot detect this
per-subject omission.

Locations:

- `ontology/docs/competency-questions.yaml:481-485` selects only direct
  `?subject ciops:hasScope ?scope` values in CQ-019 arm 2.
- `ontology/docs/competency-questions.yaml:508-515` says schedule scope comes
  from each scheduled WorkUnit and that the proposal-level edge is derived.
- `ontology/tests/cq-019.sparql:14-18` and
  `ontology/tests/cq-020.sparql:7-9` contain the executable mismatch.
- `ontology/docs/closed-world.yaml:84-90` closes only
  `scopedByComputation`; it does not make proposal `hasScope` derivation
  complete or testable.
- `research/reviews/pre-s4/round2-triage.md:62-65` records this exact
  circular-completeness class as the repair CQ-019 had to close.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
P='@prefix c: <https://oip.law/ontology/ci-ops#> .\n'
def rows(cq, ttl):
 s=Store(); s.load((P+ttl).encode(), format=RdfFormat.TURTLE)
 r=s.query(Path(f'ontology/tests/{cq}.sparql').read_text())
 return [{v.value: None if x[v] is None else str(x[v]) for v in r.variables} for x in r]
ttl='''
c:sp a c:ScheduleProposal; c:proposedFor c:ep-example; c:hasStep c:st.
c:st c:stepIndex 1; c:schedulesWorkUnit c:wu.
c:wu a c:WorkUnit; c:hasScope c:AffectedScope.
'''
print('CQ020 exposes narrowed schedule:', rows('cq-020', ttl))
print('CQ019 violations:', rows('cq-019', ttl))
PY
CQ020 exposes narrowed schedule: [{'step': '<https://oip.law/ontology/ci-ops#st>', 'idx': '"1"^^<http://www.w3.org/2001/XMLSchema#integer>', 'wu': '<https://oip.law/ontology/ci-ops#wu>', 'scope': '<https://oip.law/ontology/ci-ops#AffectedScope>'}]
CQ019 violations: []
```

**Minimal fix.** In CQ-019 arm 2, derive a `ScheduleProposal` scope through
`hasStep/schedulesWorkUnit/hasScope`; retain direct `hasScope` for
`VerificationEvidence`. Alternatively, make proposal-level scope
materialization a checked completeness precondition before this query runs.
Add a must-fail fixture with a narrowed scheduled WorkUnit, no proposal
`hasScope`, and no provenance edge. Do not let the dual-population ASK stand in
for per-subject completeness.

### BLOCKER H-02: plain-string quantities make CQ-010, CQ-023, and CQ-026 green on numeric overruns

**Claim.** All three post-grill numeric constraints compare RDF terms without
declaring or checking a numeric datatype. Their happy-path fixtures use Turtle
integer syntax, so the suite never exercises plain strings. Oxigraph compares
same-typed strings lexically: numeric `10 > 8` and `1000 > 900` become false,
and every constraint returns zero rows. This is a false green in the reshaped
Must CQ-010, the new Must CQ-023, and the new Should CQ-026.

Locations:

- `ontology/docs/competency-questions.yaml:247-250`, `:582-587`, and
  `:650-653` contain the unguarded comparisons.
- `ontology/tests/cq-010.sparql:6-10`, `cq-023.sparql:7-12`, and
  `cq-026.sparql:6-10` are the generated executable queries.
- `ontology/docs/pre-glossary.csv:69`, `:96`, `:99`, `:104`, and `:106`
  call the values data properties but assign no `xsd` range.
- `ontology/docs/competency-questions.yaml:22-24` protects substituted
  parameters only; none of these compared values is a harness-bound parameter.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
P='@prefix c: <https://oip.law/ontology/ci-ops#> .\n'
def n(cq, ttl):
 s=Store(); s.load((P+ttl).encode(), format=RdfFormat.TURTLE)
 return sum(1 for _ in s.query(Path(f'ontology/tests/{cq}.sparql').read_text()))
print('cq-010 string 10 > 8, rows =', n('cq-010','c:w c:admittedBy c:g. c:g c:admissionChargeTokens "10"; c:capacityAtAdmissionTokens "8".'))
print('cq-023 string 1000 > 900, rows =', n('cq-023','c:r a c:SeatRequest; c:observedQueueWaitMs "1000"; c:governedBy c:p. c:p c:starvationBoundMs "900".'))
print('cq-026 string 1000 > 900, rows =', n('cq-026','c:w c:admittedBy c:g; c:hasCostEstimate c:e. c:e c:p95Ms "1000". c:g c:hasBudget c:b. c:b c:softP95BudgetMs "900".'))
PY
cq-010 string 10 > 8, rows = 0
cq-023 string 1000 > 900, rows = 0
cq-026 string 1000 > 900, rows = 0
```

**Minimal fix.** Give all compared quantities explicit numeric ranges in the
frozen input and ETL contract. Make each constraint return a violation for a
non-numeric datatype as well as for a numeric overrun; a cast alone can still
drop an uncastable solution. Add plain-string and wrong-datatype must-fail
fixtures for all three queries.

### BLOCKER H-03: CQ-020 cannot identify the "current" proposal and merges proposal sequences

**Claim.** CQ-020 promises the ordered sequence of the current proposal for an
episode. The query matches every proposal for that episode, does not project
`?proposal`, and orders all steps together by `?idx`. With an old and a current
proposal, both index-1 steps appear as one indistinguishable result set. No
current-proposal relation exists in the admitted vocabulary.

Locations:

- `ontology/docs/competency-questions.yaml:493-515` contains the singular
  current-proposal promise and query.
- `ontology/tests/cq-020.sparql:5-10` matches all `proposedFor` records and
  omits `?proposal` from the projection.
- `ontology/docs/pre-glossary.csv:89-92` admits proposal/step relations but no
  current-proposal selector.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c: <https://oip.law/ontology/ci-ops#> .
c:old a c:ScheduleProposal; c:proposedFor c:ep-example; c:hasStep c:s1.
c:s1 c:stepIndex 1; c:schedulesWorkUnit c:w1. c:w1 c:hasScope c:FullRepoScope.
c:new a c:ScheduleProposal; c:proposedFor c:ep-example; c:hasStep c:s2.
c:s2 c:stepIndex 1; c:schedulesWorkUnit c:w2. c:w2 c:hasScope c:AffectedScope.
''', format=RdfFormat.TURTLE)
r=s.query(Path('ontology/tests/cq-020.sparql').read_text())
print('projected variables:', [v.value for v in r.variables])
for x in r: print([str(x[v]) for v in r.variables])
PY
projected variables: ['step', 'idx', 'wu', 'scope']
['<https://oip.law/ontology/ci-ops#s2>', '"1"^^<http://www.w3.org/2001/XMLSchema#integer>', '<https://oip.law/ontology/ci-ops#w2>', '<https://oip.law/ontology/ci-ops#AffectedScope>']
['<https://oip.law/ontology/ci-ops#s1>', '"1"^^<http://www.w3.org/2001/XMLSchema#integer>', '<https://oip.law/ontology/ci-ops#w1>', '<https://oip.law/ontology/ci-ops#FullRepoScope>']
```

**Minimal fix.** Parameterize CQ-020 by a given `ScheduleProposal`, or admit a
`currentScheduleProposal` relation from episode to proposal. Project
`?proposal` in either form. Add a two-proposal fixture so a merged result can no
longer satisfy the all-bound oracle.

### BLOCKER H-04: CQ-009 regressed from deployed origin exclusion back to checkout exclusion

**Claim.** Round 2 corrected the full-proof law to one active grant per origin.
The application pass instead asks whether two grants occupy the same checkout.
Those identities are independent in the deployed request: `originKey` comes
from the proof-lock path while `checkoutRoot` comes from `context.repoRoot`, and
the scheduler skips a ticket when another lease has the same nonempty
`originKey`. Two full-proof leases with one origin and different checkouts are
therefore precisely the prohibited deployed state, but CQ-009 returns no row.

Locations:

- `ontology/docs/competency-questions.yaml:217-231` asks for and joins on the
  same checkout.
- `ontology/docs/pre-glossary.csv:23` defines `Checkout` as the CQ's exclusion
  unit.
- `ontology/docs/scope.md:49-54` and
  `research/reviews/pre-s4/round2-triage.md:40` state the repaired invariant as
  one full-proof grant per origin.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:296-320`
  constructs separate `originKey` and `checkoutRoot` fields.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:614-628`
  enforces equality of `originKey`, not checkout root.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
q=Path('ontology/tests/cq-009.sparql').read_text()
def n(second_checkout):
 s=Store(); s.load(f'''@prefix c: <https://oip.law/ontology/ci-ops#> .
 c:g1 a c:SeatGrant; c:hasGrantState c:ActiveGrant; c:hasWorkKind c:FullProofWork;
   c:originKey "same-origin"; c:occupiesCheckout c:checkout-a.
 c:g2 a c:SeatGrant; c:hasGrantState c:ActiveGrant; c:hasWorkKind c:FullProofWork;
   c:originKey "same-origin"; c:occupiesCheckout c:{second_checkout}.
 '''.encode(), format=RdfFormat.TURTLE)
 return sum(1 for _ in s.query(q))
print('same origin, different checkout rows =', n('checkout-b'))
print('same origin, same checkout rows =', n('checkout-a'))
PY
same origin, different checkout rows = 0
same origin, same checkout rows = 2
```

**Minimal fix.** Admit the deployed origin identity as the carrier CQ-009
actually needs and compare active full-proof grants on that identity. Retain
checkout as a separate lease attribute. Add a same-origin/different-checkout
must-fail fixture.

### BLOCKER H-05: the deployed ticket-to-lease handoff destroys the provenance CQ-021 and CQ-023 claim to read

**Claim.** The new model says `grantedFrom` is a deployed ticket-to-lease link
and that granted wait is `admittedAt - enqueuedAt`. Deployed state cannot supply
either fact. Promotion writes a lease without the ticket's `nonce` or
`enqueuedAtMillis`, then deletes the ticket. Completion deletes the lease too.
An atomic scan consequently observes a ticket or a lease, not a durable linked
pair. The seed's simultaneous `req-2`/`grant-1` graph is not a state the named
carrier retains. This makes the claimed closure of `grantedFrom`, historical
queue calibration, and CQ-023's granted-request wait unimplementable from the
declared source.

Locations:

- `ontology/docs/competency-questions.yaml:519-544` calls `grantedFrom` the
  deployed handoff, and `:573-592` includes granted wait in the ETL promise.
- `ontology/tests/fixtures/seed.ttl:81-112` keeps a request and its grant
  together.
- `ontology/docs/closed-world.yaml:68-74` claims an atomic paired read makes
  `grantedFrom` complete.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:155-167`
  omits ticket identity and enqueue time from the lease, while `:216-230` puts
  them only on the ticket.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:925-967`
  removes the ticket after promotion; `:1071-1090` removes the lease after the
  admitted effect ends.

Executed deployed-state probe:

```console
$ bun - <<'TS'
import { mkdtempSync, rmSync } from "node:fs";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Layer } from "effect";
import { AdmissionConfig, AdmissionRequest, admissionStatus, admissionTokenWeight, MemoryStats, noAdmissionOriginGate, withQualityAdmission } from "./packages/tooling/tool/cli/src/internal/repo-run/index.ts";
const runtimeDir = mkdtempSync("/tmp/seat-h-handoff-");
process.env.XDG_RUNTIME_DIR = runtimeDir;
const config = AdmissionConfig.make({ heartbeatSeconds: 0.01, progressSeconds: 10 });
const request = AdmissionRequest.make({ kind:"full-proof", weightTokens:admissionTokenWeight("full-proof"), priority:"verify", originKey:"handoff", checkoutRoot:"/tmp/handoff", branch:"handoff", command:"seat-h" });
const memory = Layer.succeed(MemoryStats, MemoryStats.of({ availableGib:Effect.succeed(50), totalGib:Effect.succeed(128) }));
const program = Effect.gen(function* () {
  const during = yield* withQualityAdmission(request, noAdmissionOriginGate, Effect.gen(function* () {
    const snapshot = yield* admissionStatus(config);
    const lease = snapshot.leases[0];
    return { tickets:snapshot.tickets.length, leases:snapshot.leases.length, leaseHasEnqueuedAt: lease !== undefined && "enqueuedAtMillis" in lease, leaseHasNonce: lease !== undefined && "nonce" in lease };
  }), config);
  const after = yield* admissionStatus(config);
  console.log("during", JSON.stringify(during));
  console.log("after", JSON.stringify({tickets:after.tickets.length, leases:after.leases.length}));
}).pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, memory)));
try { await Effect.runPromise(program); } finally { rmSync(runtimeDir, {recursive:true, force:true}); }
TS
during {"tickets":0,"leases":1,"leaseHasEnqueuedAt":false,"leaseHasNonce":false}
after {"tickets":0,"leases":0}
```

**Minimal fix.** Add a durable admission-transition journal, or copy the
ticket identity and `enqueuedAtMillis` into the lease and retain terminal
admission events for the KPI window. If only live snapshots are in scope,
remove the invented `grantedFrom` negation from CQ-021 and limit CQ-023 to
currently queued tickets; do not promise granted-wait history.

### BLOCKER H-06: CQ-022 cancels later attempts because episode identity is too broad

**Claim.** A verification episode is a multi-attempt red streak, but CQ-022
declares every running execution in the episode obsolete after any committed
failure in that episode. It has no attempt identity or temporal relation. A
retry in attempt 2 is therefore returned as a cancel candidate because attempt
1 failed. The note's narrower promise, “can no longer improve this attempt's
verdict,” is not represented by the query.

Locations:

- `ontology/docs/competency-questions.yaml:548-569` joins failure and execution
  only through episode identity.
- `ontology/tests/cq-022.sparql:8-13` contains the executable join.
- `ontology/docs/scope.md:19-21` defines the verification episode across the
  red streak, not as one attempt.
- `research/kpi-measurement-rules.md:12-15` likewise makes episodes span
  attempts.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat,Store
s=Store(); s.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>.
c:fail-example a c:CommittedFailure;c:failsEpisode c:red-streak;c:inAttempt c:attempt-1.
c:retry a c:WorkUnitExecution;c:servesEpisode c:red-streak;c:inAttempt c:attempt-2;
 c:hasExecutionState c:RunningExecution;c:hasCancelClass c:CleanCancel.''',format=RdfFormat.TURTLE)
r=s.query(Path('ontology/tests/cq-022.sparql').read_text())
for x in r: print('returned=',x['exec'].value.rsplit('#',1)[-1],'cancelClass=',x['cancelClass'].value.rsplit('#',1)[-1])
PY
returned= retry cancelClass= CleanCancel
```

The extra `inAttempt` facts intentionally have no effect: the admitted model
has no such property and the query cannot use it.

**Minimal fix.** Admit `VerificationAttempt` plus failure/execution attempt
relations through CQ-022 and join on the attempt, or add a committed-failure
snapshot instant and require executions to have been in flight at that instant.
Add a later-attempt retry counterfixture.

### BLOCKER H-07: CQ-023 turns priority aging into a starvation service guarantee

**Claim.** `publishAgingSeconds` does not bound waiting time. It only changes a
verify ticket's sort rank. An aged ticket can remain queued indefinitely while
capacity is occupied, its origin is active, the review-fix cap is saturated,
or the hard memory floor prevents admission. The CQ nevertheless derives a
declared hard starvation bound from that setting and makes it a Must
invariant. The note itself concedes that aging promises promotion, not
admission. A live deployed run leaves a ticket waiting after five aging
windows, with no hard-floor exception.

Locations:

- `ontology/docs/competency-questions.yaml:573-592` declares the hard bound
  and names `publishAgingSeconds` as its carrier.
- `ontology/docs/pre-glossary.csv:104-107` repeats the derived-bound claim.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:268-279`
  defines the aging setting.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:600-608`
  uses it only in priority ranking; `:614-640` retains independent blocking
  conditions.

Executed deployed-state probe:

```console
$ bun - <<'TS'
import { mkdtempSync, rmSync } from "node:fs";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { AdmissionConfig, AdmissionRequest, admissionStatus, admissionTokenWeight, MemoryStats, noAdmissionOriginGate, withQualityAdmission } from "./packages/tooling/tool/cli/src/internal/repo-run/index.ts";
const runtimeDir = mkdtempSync("/tmp/seat-h-aging-"); process.env.XDG_RUNTIME_DIR = runtimeDir;
const config = AdmissionConfig.make({ heartbeatSeconds: 0.01, progressSeconds: 10, publishAgingSeconds: 0.02 });
const request = (originKey: string) => AdmissionRequest.make({ kind:"full-proof", weightTokens:admissionTokenWeight("full-proof"), priority:"verify", originKey, checkoutRoot:`/tmp/${originKey}`, branch:originKey, command:"seat-h-test" });
const memory = Layer.succeed(MemoryStats, MemoryStats.of({ availableGib:Effect.succeed(25), totalGib:Effect.succeed(128) }));
const program = Effect.gen(function* () {
  const releaseHolder = yield* Deferred.make<void>();
  const holder = yield* Effect.forkChild(withQualityAdmission(request("holder"), noAdmissionOriginGate, Deferred.await(releaseHolder), config));
  yield* Effect.sleep("40 millis");
  const waiter = yield* Effect.forkChild(withQualityAdmission(request("waiter"), noAdmissionOriginGate, Effect.succeed("admitted"), config));
  yield* Effect.sleep("100 millis");
  const snapshot = yield* admissionStatus(config);
  console.log(`after=5x-aging tickets=${snapshot.tickets.length} leases=${snapshot.leases.length} hardFloor=${snapshot.hardFloorEngaged} active=${snapshot.activeTokens}/${snapshot.capacityTokens}`);
  yield* Fiber.interrupt(waiter); yield* Deferred.succeed(releaseHolder, undefined); yield* Fiber.join(holder);
}).pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, memory)));
try { await Effect.runPromise(program); } finally { rmSync(runtimeDir, { recursive:true, force:true }); }
TS
[yeet] admission: waiting 0s for full-proof(3) — position 1, tokens 3/3, MemAvailable 25.0 GiB, holders: pid 2 full-proof(3) /tmp/holder @ holder
after=5x-aging tickets=1 leases=1 hardFloor=false active=3/3
```

**Minimal fix.** Do not derive a finite hard wait bound from priority aging.
Either implement and prove a real service bound in the scheduler, or rename the
fact to an observational queue-wait alert and remove the hard-invariant claim.
Keep starvation as a separately reported KPI if the policy cannot guarantee it.

### BLOCKER H-08: the repaired parameter-binding contract is prose-only

**Claim.** Round 2 recorded the one-row-only, datatype-preserving, and
multi-block substitution rules as fixed. The executing suite reads static
generated queries and never identifies or replaces `# harness binds` blocks.
Neither validator nor regeneration code enforces the marker contract. A caller
can replace only the outer CQ-012 block or bind two parameter rows; both
mutations produce plausible all-bound aggregates that satisfy the current
CQ-012 oracle. The green harness therefore does not guard the claimed repair.

Locations:

- `ontology/docs/competency-questions.yaml:15-27` declares the binding
  convention.
- `research/reviews/pre-s4/round2-triage.md:17-20` records its repair as fixed.
- `research/scripts/run_cq_suite.py:89-90` reads query text unchanged, and
  `:109-153` executes it without a binding phase.
- `research/scripts/validate_packet.py:5-10` delegates semantic enforcement to
  that runner, but neither script references the marker.

Executed mutations and source check:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
q=Path('ontology/tests/cq-012.sparql').read_text()
a='("2026-08-01T00:00:00Z"^^xsd:dateTime "2026-08-31T23:59:59Z"^^xsd:dateTime)'
s='("2026-09-01T00:00:00Z"^^xsd:dateTime "2026-09-30T23:59:59Z"^^xsd:dateTime)'
g=Store(); g.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>. @prefix xsd:<http://www.w3.org/2001/XMLSchema#>.
c:aug c:episodeStartedAt "2026-08-15T00:00:00Z"^^xsd:dateTime;c:queueWaitMs 0;c:lockWaitMs 0;c:executionMs 100;c:repairGapMs 0;c:ciWaitMs 0;c:timeToCertaintyMs 100.
c:sep c:episodeStartedAt "2026-09-15T00:00:00Z"^^xsd:dateTime;c:queueWaitMs 100;c:lockWaitMs 0;c:executionMs 0;c:repairGapMs 0;c:ciWaitMs 0;c:timeToCertaintyMs 100.''',format=RdfFormat.TURTLE)
def check(label,text):
 r=g.query(text); rows=[{v.value:(None if x[v] is None else x[v].value) for v in r.variables} for x in r]
 ok=bool(rows) and all(v is not None for v in rows[0].values()) and rows[0]['decomposedEpisodes']==rows[0]['windowEpisodes']
 print(label,rows,'current-oracle=',ok)
check('only first block replaced',q.replace(a,s,1))
check('two-row batch',q.replace(a,a+' '+s))
for f in ('run_cq_suite.py','validate_packet.py','regen_cq_artifacts.py'):
 print(f,'marker references =',(Path('research/scripts')/f).read_text().count('harness binds'))
PY
only first block replaced [{'queueShare': '1', 'lockShare': '0', 'execShare': '0', 'repairShare': '0', 'ciShare': '0', 'grandTotalMs': '100', 'decomposedEpisodes': '1', 'windowEpisodes': '1'}] current-oracle= True
two-row batch [{'queueShare': '0.5', 'lockShare': '0', 'execShare': '0.5', 'repairShare': '0', 'ciShare': '0', 'grandTotalMs': '200', 'decomposedEpisodes': '2', 'windowEpisodes': '2'}] current-oracle= True
run_cq_suite.py marker references = 0
validate_packet.py marker references = 0
regen_cq_artifacts.py marker references = 0
```

**Minimal fix.** Implement RDF-term binding in the runner: parse every marked
block, require exactly one parameter tuple, preserve datatype/language, and
replace all blocks for one CQ with the same canonical tuple. Add mutation tests
for multi-row input, datatype loss, and partial multi-block replacement.

### BLOCKER H-09: the validator does not enforce the two-kind admission law it reports green

**Claim.** The binding law licenses decision terms only from Must/Should CQs,
plus support terms reachable through exact `supports=` names. The validator
instead seeds `required` from all CQs, so the Could-only
`estimatedFailureProbability` is silently licensed. It also tests CURIE use by
substring, so `ciops:dependsOnTransitive` falsely licenses `dependsOn`. Any
remaining admission violation is only a warning, and warnings do not fail the
command. Finally, the validator never reads literal-domain members even though
their document applies the same admission law to each member.

Locations:

- `ontology/docs/competency-questions.yaml:2-5` and
  `ontology/docs/orsd.md:39-47` restrict decision roots to Must/Should CQs.
- `ontology/docs/competency-questions.yaml:120-122` uses only
  `dependsOnTransitive`; `:444-460` makes CQ-018 Could.
- `ontology/docs/pre-glossary.csv:53-54` contains the exact property pair, and
  `:80` contains `estimatedFailureProbability`.
- `research/scripts/validate_packet.py:145-161` collects required terms from
  every CQ and uses substring matching; `:179-183` emits only a warning;
  `:219-225` exits nonzero only for blockers.
- `ontology/docs/literal-domains.md:40-42` applies the law to domain members,
  while `research/scripts/validate_packet.py:132-183` audits only CSV rows.

Executed independent law audit:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/R3O9atmNgFABYDTQ python - <<'PY'
import csv, re, yaml
from pathlib import Path
D=Path('ontology/docs')
cqs=yaml.safe_load((D/'competency-questions.yaml').read_text())
rows=list(csv.DictReader((D/'pre-glossary.csv').open()))
gloss={r['term']:r for r in rows if r['category']!='individual'}
testable=[c for c in cqs if c['priority'] in {'must_have','should_have'}]
roots={t for c in testable for key in ('required_classes','required_properties') for t in c.get(key,[])}
qnames={m for c in testable for m in re.findall(r'ciops:([A-Za-z_][A-Za-z0-9_]*)',c.get('sparql',''))}
licensed=set(roots)|qnames
supports={r['term']:re.search(r'supports=([A-Za-z0-9_|]+)',r['notes'] or '').group(1).split('|') for r in rows if re.search(r'supports=([A-Za-z0-9_|]+)',r['notes'] or '')}
while True:
 add={t for t,names in supports.items() if any(n in licensed for n in names)}-licensed
 if not add: break
 licensed|=add
blob='\n'.join(c.get('sparql','') for c in testable)
substring_only=sorted(t for t in gloss if f'ciops:{t}' in blob and t not in qnames)
print('exact-QName audit unlicensed:', sorted(set(gloss)-licensed))
print('validator substring-only matches:', substring_only)
print('Could-only required terms:', sorted({t for c in cqs if c['priority']=='could_have' for k in ('required_classes','required_properties') for t in c.get(k,[])}-roots))
PY
exact-QName audit unlicensed: ['dependsOn', 'estimatedFailureProbability']
validator substring-only matches: ['dependsOn']
Could-only required terms: ['estimatedFailureProbability']
```

**Minimal fix.** Seed admission only from Must/Should required terms and exact
QName tokens. Make an unlicensed T-Box term a blocker. Add the honest
`supports=dependsOnTransitive` license for `dependsOn`; defer
`estimatedFailureProbability` unless it is promoted by a real Must/Should
decision CQ. Parse the literal domains into a machine-readable census and
apply the same reachability audit to every member.

### BLOCKER H-10: CQ-008 undoes the settled ticket/lease category split

**Claim.** The application pass defines `SeatRequest` as a queued ticket and
`SeatGrant` as an admitted lease. CQ-008 nevertheless calls Active and Waiting
objects “grants,” leaves `?grant` untyped, and retains `WaitingGrant` in the
grant-state domain. A node typed only as `SeatRequest` therefore satisfies the
Must grant query. The new split is prose, not query semantics.

Locations:

- `ontology/docs/pre-glossary.csv:18-20` defines request/ticket and grant/lease
  as separate kinds.
- `ontology/docs/literal-domains.md:15` retains `WaitingGrant`.
- `ontology/docs/competency-questions.yaml:194-213` does not require
  `rdf:type ciops:SeatGrant` and explicitly selects `WaitingGrant`.
- `ontology/docs/s4-lane-contract.md:162-165` makes the ticket/lease split a
  standing normalization mandate.

Executed against the generated query:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c: <https://oip.law/ontology/ci-ops#> .
c:resource a c:ContendedResource.
c:waiting-ticket a c:SeatRequest; c:contendsFor c:resource; c:hasGrantState c:WaitingGrant.
''', format=RdfFormat.TURTLE)
r=s.query(Path('ontology/tests/cq-008.sparql').read_text())
for x in r: print({v.value: str(x[v]) for v in r.variables})
PY
{'res': '<https://oip.law/ontology/ci-ops#resource>', 'grant': '<https://oip.law/ontology/ci-ops#waiting-ticket>', 'state': '<https://oip.law/ontology/ci-ops#WaitingGrant>'}
```

**Minimal fix.** Make CQ-008's holder branch require a `SeatGrant` in
`ActiveGrant`. Model queued waiters as typed `SeatRequest` objects in a
separate branch, or leave them to CQ-021. Rehome or remove `WaitingGrant` from
the lease-only lifecycle and add the ticket-only graph as a regression fixture.

### BLOCKER H-11: CQ-013 performs negation over undeclared `p50Ms` closure

**Claim.** The cheapest-lane argmin's `FILTER NOT EXISTS` reads three
predicates. `closed-world.yaml` declares `surfacedByLane` and
`hasCostEstimate`, but not `p50Ms`. A surfaced lane may therefore have a cost
estimate with no P50 and vanish from the competitor arm; the query then calls a
different, priced lane “cheapest.” This is the suite's uncovered negation
predicate.

Locations:

- `ontology/docs/competency-questions.yaml:325-348` promises the cheapest lane
  and runs the nested negation.
- `ontology/tests/cq-013.sparql:7-14` contains the executable argmin.
- `ontology/docs/closed-world.yaml:53-66` declares the first two predicates,
  but not `p50Ms`.
- `ontology/docs/pre-glossary.csv:47-51` contains the estimate vocabulary.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s = Store()
s.load(b'''@prefix c: <https://oip.law/ontology/ci-ops#> .
c:signal c:attributedDelayMs 500; c:surfacedByLane c:lane-a, c:lane-b.
c:lane-a c:hasCostEstimate c:cost-a. c:cost-a c:p50Ms 100.
c:lane-b c:hasCostEstimate c:cost-b.
''', format=RdfFormat.TURTLE)
r = s.query(Path('ontology/tests/cq-013.sparql').read_text())
print([{v.value: (None if row[v] is None else str(row[v])) for v in r.variables} for row in r])
PY
[{'sig': '<https://oip.law/ontology/ci-ops#signal>', 'delay': '"500"^^<http://www.w3.org/2001/XMLSchema#integer>', 'lane': '<https://oip.law/ontology/ci-ops#lane-a>', 'p50': '"100"^^<http://www.w3.org/2001/XMLSchema#integer>'}]
```

**Minimal fix.** Declare `p50Ms` closed for every surfaced candidate lane and
validate exactly one numeric P50 per attached cost estimate before the argmin.
If any candidate is unpriced, expose a coverage violation instead of asserting
a cheapest lane. Add a missing-P50 fixture and execute the closure precondition.

### BLOCKER H-12: any invented exception suppresses the CQ-023 hard invariant

**Claim.** `StarvationException` is a closed two-member domain, but CQ-023
accepts the mere existence of `hasStarvationException` with any object. An
invented IRI therefore hides a request that exceeds its bound. Closing edge
enumeration does not validate the edge's range, and the current suite executes
no shape before the query.

Locations:

- `ontology/docs/literal-domains.md:21` lists only `HardFloorException` and
  `QuarantineException`.
- `ontology/docs/competency-questions.yaml:571-592` claims the closed modeled
  exceptions while its negation leaves `?exc` unconstrained.
- `ontology/tests/cq-023.sparql:7-12` contains the executable hole.
- `ontology/docs/closed-world.yaml:76-82` closes edge enumeration, not domain
  membership.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>.
c:r a c:SeatRequest; c:observedQueueWaitMs 10000; c:governedBy c:p;
 c:hasStarvationException c:InventedException.
c:p c:starvationBoundMs 1000.''', format=RdfFormat.TURTLE)
print(list(s.query(Path('ontology/tests/cq-023.sparql').read_text())))
PY
[]
```

**Minimal fix.** Restrict the negated pattern to the two closed members, and
enforce the closed range in an executable pre-query shape. Add an
invented-exception must-fail fixture so the vocabulary is semantically
load-bearing.

### BLOCKER H-13: the binding KPI law and its only probe use different percentile estimators

**Claim.** The new ETL law mandates nearest-rank percentiles. The committed
probe labels `round(p / 100 * (n - 1))` nearest-rank, but nearest-rank uses the
one-based rank `ceil(p * n)`. They differ on small samples, including P50 of
four values. The law also calls the current probe v3.1 and then says “v2
conforms fully”; no separate conforming probe exists.

Locations:

- `research/kpi-measurement-rules.md:6-8`, `:57-60`, and `:79-80` make the
  version and estimator claims.
- `research/scripts/kpi_baseline_probe.py:2`, `:24-25`, and `:43-48` identify
  the v3 probe and implement `round(...)`.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 python - <<'PY'
from math import ceil
values=[1,2,3,4]
for p in (50,95):
 probe=values[round(p/100*(len(values)-1))]
 nearest=values[ceil(p/100*len(values))-1]
 print(f'p{p}: probe={probe}, nearest-rank={nearest}')
PY
p50: probe=3, nearest-rank=2
p95: probe=4, nearest-rank=4
```

**Minimal fix.** Implement `ceil(p*n)-1` with explicit boundary handling, add
small-sample estimator tests, and correct the version/conformance sentence. If
a new conforming probe is intended, commit and name it rather than attributing
conformance to a nonexistent version.

### BLOCKER H-14: S4's mandatory normalization gate depends on missing and unfrozen schemas

**Claim.** The new S4 contract requires every candidate to pass the
`ontology-foundational-auditor` schemas, but neither referenced
`_shared/schemas` directory exists in the available skill installation. Even
if restored, the frozen-input and telemetry digests omit the skill and schema
assets. Lanes could therefore normalize under different mutable contracts
while reporting identical packet hashes.

Locations:

- `ontology/docs/s4-lane-contract.md:8-20` defines frozen inputs.
- `ontology/docs/s4-lane-contract.md:72-77` hashes only five packet documents.
- `ontology/docs/s4-lane-contract.md:143-160` makes the external normalization
  schemas mandatory.
- `~/.agents/skills/ontology-foundational-auditor/SKILL.md:65-82` references
  the missing shared schema contracts.

Executed environment check (home path normalized for the public report):

```console
$ for p in ~/.agents/skills/ontology-foundational-auditor/_shared/schemas ~/.agents/skills/_shared/schemas; do if test -d "$p"; then echo "FOUND $p"; else echo "SCHEMAS_DIR_MISSING $p"; fi; done
SCHEMAS_DIR_MISSING ~/.agents/skills/ontology-foundational-auditor/_shared/schemas
SCHEMAS_DIR_MISSING ~/.agents/skills/_shared/schemas
```

A targeted search found references to `SourceObservation`,
`DenotationHypothesis`, `FoundationalAnalysis`, `IdentityCard`, and
`OntologyTermProposal`, but no corresponding schema files.

**Minimal fix.** Restore or vendor the exact schema contracts before S4 and
freeze the auditor skill version plus every schema, prompt, and validator
digest used by the gate. A packet-local immutable copy or versioned release
manifest avoids mutable workstation-state dependence.

### WARN W-01: reshaped CQ-019 narrows the NL while its first UNION arm intentionally remains universal

**Claim.** The NL says the subjects are verification evidence or schedule
proposals, but the fail-open arm returns any subject that trusts a fail-open
computation. Round 2 deliberately kept the arm untyped because a class guard
would create a loophole. The reshaped NL did not preserve that broader promise.
This is an output-fidelity warning, not a request to reintroduce the rejected
type restriction.

Locations:

- `ontology/docs/competency-questions.yaml:463-478` contains the narrowed NL
  and universal arm.
- `research/reviews/pre-s4/round2-triage.md:26-29` records the universal arm as
  an intentional sound disposition.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>.
c:x c:hasAffectedOutcome c:o. c:o a c:FailOpenOutcome.
c:unrelated a c:WorkUnit; c:scopedByComputation c:x.''', format=RdfFormat.TURTLE)
r=s.query(Path('ontology/tests/cq-019.sparql').read_text())
print([{v.value:str(x[v]) for v in r.variables} for x in r])
PY
[{'subject': '<https://oip.law/ontology/ci-ops#unrelated>', 'violation': '"fail-open-trust"'}]
```

**Minimal fix.** Widen the first clause of the NL to “does any subject trust a
fail-open computation,” while keeping the evidence/proposal restriction only
on the narrowed-scope arm. Do not narrow the query.

### WARN W-02: a dangling provenance edge launders narrowed scope

**Claim.** CQ-019 arm 2 checks only whether some `scopedByComputation` edge
exists. It does not require the object to be an `AffectedComputation` with a
closed, valid outcome. A narrowed evidence object pointing to an arbitrary IRI
therefore returns no violation. This is a prospective S6 range/shape duty, but
the current executable harness does not guard it.

Locations:

- `ontology/docs/competency-questions.yaml:481-491` contains the existential
  suppression and claims closed scope provenance.
- `ontology/docs/pre-glossary.csv:28-30` defines computations and their closed
  outcomes; `:82` defines the trust edge.
- `ontology/docs/closed-world.yaml:84-90` closes edge enumeration but does not
  validate the edge's target.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>.
c:e a c:VerificationEvidence; c:hasScope c:AffectedScope;
 c:scopedByComputation c:not-a-computation.''', format=RdfFormat.TURTLE)
print(list(s.query(Path('ontology/tests/cq-019.sparql').read_text())))
PY
[]
```

**Minimal fix.** Make a provenance edge valid only when its target is an
`AffectedComputation` with exactly one member of the closed outcome pair.
Execute that shape before CQ-019, and add dangling-target and missing-outcome
fixtures.

### WARN W-03: `QuarantineException` is not a deployed live-request degradation state

**Claim.** CQ-023 calls `QuarantineException` a modeled exception for a
“quarantined owner.” In the deployed scheduler, quarantine is a list of file
paths for malformed ticket/lease records that failed decoding. Such a record
cannot be joined to a live `SeatRequest`, and quarantine does not legalize an
over-bound request. The proposed domain assigns the carrier the wrong meaning.

Locations:

- `ontology/docs/pre-glossary.csv:40` and `:107`, plus
  `ontology/docs/literal-domains.md:21`, claim the request exception.
- `ontology/docs/competency-questions.yaml:592` calls it a quarantined owner.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:458-469`,
  `:515-565`, and `:1264-1278` implement quarantine as malformed state-file
  handling and expose paths on the status surface.

Executed targeted deployed test (irrelevant skip lines omitted):

```console
$ bun x vitest run packages/tooling/tool/cli/test/quality-scheduler.test.ts -t 'reaps dead-pid state, reaps start-time mismatches, and quarantines garbage' --reporter=verbose
[yeet] quarantined malformed admission state /tmp/n3J2RO/beep/admit/leases/garbage.lease.json (undecodable) -> /tmp/n3J2RO/beep/admit/quarantine/garbage.lease.json.1787889557424
 ✓ |@beep/repo-cli| test/quality-scheduler.test.ts > quality-scheduler > reaps dead-pid state, reaps start-time mismatches, and quarantines garbage 16ms
 Test Files  1 passed (1)
      Tests  1 passed | 22 skipped (23)
```

**Minimal fix.** Remove `QuarantineException` from the request-starvation
domain unless a real, identity-preserving live-request state is implemented.
Keep malformed-file quarantine as ingestion health telemetry, not a waiver of
the starvation invariant.

### WARN W-04: CQ-024 omits a deployed cache-plan state and puts invocation state on a WorkUnit specification

**Claim.** The CQ promises one of two postures for each WorkUnit and says every
other configuration fails closed to local-only. The deployed resolver also
returns `caller-controlled` for CI and explicit cache arguments. Moreover,
that plan is resolved per invocation, while `hasCachePosture` is attached to
the reusable WorkUnit specification. The query also silently drops a typed
WorkUnit with no posture, so “each” is not enforced.

Locations:

- `ontology/docs/competency-questions.yaml:594-611` contains the two-state,
  each-WorkUnit promise.
- `ontology/docs/literal-domains.md:22` closes the pair.
- `packages/tooling/tool/cli/src/internal/cli/TurboCache.ts:54-63`, `:428-435`,
  and `:599-627` define the plan union and caller-controlled branches.

Executed deployed resolver and query probes:

```console
$ bun -e 'import { resolveTurboCachePlan, TurboCacheEnvironment } from "./packages/tooling/tool/cli/src/internal/cli/TurboCache.ts"; const env = TurboCacheEnvironment.make({}); for (const [label, options] of [["ci", { args: [], ci: true }], ["explicit", { args: ["--cache=remote:rw"], ci: false }], ["fallback", { args: [], ci: false }]]) { const plan = resolveTurboCachePlan(env, options); console.log(`${label}: ${plan._tag}${"reason" in plan ? ` (${plan.reason})` : ""}`); }'
ci: caller-controlled (ci)
explicit: caller-controlled (explicit-cache-arg)
fallback: local-only (incomplete-remote-config)

$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
s=Store(); s.load(b'''@prefix c:<https://oip.law/ontology/ci-ops#>.
c:w1 a c:WorkUnit; c:hasCachePosture c:LocalOnly. c:w2 a c:WorkUnit.''', format=RdfFormat.TURTLE)
r=s.query(Path('ontology/tests/cq-024.sparql').read_text())
print([{v.value:str(x[v]) for v in r.variables} for x in r])
PY
[{'wu': '<https://oip.law/ontology/ci-ops#w1>', 'posture': '<https://oip.law/ontology/ci-ops#LocalOnly>'}]
```

**Minimal fix.** Model the resolved `TurboCachePlan`, including
CallerControlled, on `WorkUnitExecution` or another invocation record. If the
CQ intentionally covers only CLI-controlled local runs, narrow its population
in both NL and query. Add a missing-posture coverage fixture.

### WARN W-05: CQ-025 and CQ-026 cannot identify the estimate snapshot used at admission

**Claim.** CQ-025 promises the estimate that admitted a WorkUnit, but both new
queries join any `hasCostEstimate` currently attached to the WorkUnit. With an
old and a new estimate, CQ-025 emits two calibration pairs for one execution;
CQ-026 can flag an estimate that did not govern the grant. A second completed
execution with no estimate silently disappears despite “for each.”

Locations:

- `ontology/docs/competency-questions.yaml:615-638` makes the admission-time
  estimate promise but performs an unversioned join.
- `ontology/docs/competency-questions.yaml:640-658` repeats the same join for
  the advisory screen.
- `ontology/docs/pre-glossary.csv:47-49`, `:98-99`, and `:109-110` contain no
  estimate-version or grant-to-estimate carrier.

Executed counterexample:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/yL2SNLihoyZfaIMU python - <<'PY'
from pathlib import Path
from pyoxigraph import RdfFormat, Store
P='@prefix c:<https://oip.law/ontology/ci-ops#>. '
body='''c:e1 a c:WorkUnitExecution; c:hasExecutionState c:CompletedExecution; c:actualWallMs 900; c:ofWorkUnit c:w1.
c:w1 c:hasCostEstimate c:old, c:new. c:old c:p50Ms 700; c:p95Ms 800. c:new c:p50Ms 1000; c:p95Ms 1200.
c:e2 a c:WorkUnitExecution; c:hasExecutionState c:CompletedExecution; c:actualWallMs 100; c:ofWorkUnit c:w2.
c:w1 c:admittedBy c:g. c:g c:hasBudget c:b. c:b c:softP95BudgetMs 900.'''
s=Store(); s.load((P+body).encode(), format=RdfFormat.TURTLE)
for cq in ('cq-025','cq-026'):
 r=s.query(Path(f'ontology/tests/{cq}.sparql').read_text())
 print(cq,[{v.value:str(x[v]) for v in r.variables} for x in r])
PY
cq-025 [{'exec': '<https://oip.law/ontology/ci-ops#e1>', 'actual': '"900"^^<http://www.w3.org/2001/XMLSchema#integer>', 'p50': '"1000"^^<http://www.w3.org/2001/XMLSchema#integer>', 'p95': '"1200"^^<http://www.w3.org/2001/XMLSchema#integer>'}, {'exec': '<https://oip.law/ontology/ci-ops#e1>', 'actual': '"900"^^<http://www.w3.org/2001/XMLSchema#integer>', 'p50': '"700"^^<http://www.w3.org/2001/XMLSchema#integer>', 'p95': '"800"^^<http://www.w3.org/2001/XMLSchema#integer>'}]
cq-026 [{'wu': '<https://oip.law/ontology/ci-ops#w1>', 'p95': '"1200"^^<http://www.w3.org/2001/XMLSchema#integer>', 'softMax': '"900"^^<http://www.w3.org/2001/XMLSchema#integer>'}]
```

**Minimal fix.** Link each grant/execution to the exact immutable estimate
snapshot or version used at admission, and join through that relation. Add a
two-version fixture plus a completed-execution coverage check.

### WARN W-06: use-case law resurrects the rejected hard-duration budget

**Claim.** The application-pass CQs split admission charge, estimated P95, and
hard execution limits, with CQ-026 explicitly advisory. The binding use-case
text still asks for cost-bounded WorkUnits/grants, names `MaxGrantCost`, and
asserts that no WorkUnit occupies the machine beyond its budget. That is the
hard P95-budget interpretation the tri-split removed.

Locations:

- `ontology/docs/use-cases.yaml:7-16` calls UC-001's WorkUnits cost-bounded.
- `ontology/docs/use-cases.yaml:21-33` retains the cost-bounded goal,
  `MaxGrantCost`, and hard-budget postcondition.
- `ontology/docs/scope.md:28-32` retains “cost-bounded grants.”
- `ontology/docs/competency-questions.yaml:236-254` defines the deployed
  token-charge/capacity invariant, while `:640-658` disclaims a P95 guarantee.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:643-663`
  admits by token capacity, not predicted duration.

**Minimal fix.** Replace hard-duration language with admission-charge versus
capacity feasibility. Keep predicted-P95 screening explicitly advisory and
reserve any hard execution limit for the S7 projection contract.

### WARN W-07: `scope.md` contradicts the new KPI episode clock

**Claim.** The scope still starts time-to-certainty at the first failed attempt
or first attempt after an edit. The new binding ETL law and ORSD instead open a
post-#870 episode at the first admission ticket's `enqueuedAtMillis`, using
attempt start only for pre-#870 or no-ticket records. This changes whether
queue time is inside the single KPI.

Locations:

- `ontology/docs/scope.md:17-24` contains the stale generic attempt-start
  definition.
- `research/kpi-measurement-rules.md:10-25` defines ticket-time opening and its
  fallbacks.
- `ontology/docs/orsd.md:79-85` correctly includes post-#870 queueing.

**Minimal fix.** Make `scope.md` defer to the ETL law and state the post-#870,
pre-#870, and no-ticket clock cases explicitly.

### WARN W-08: the observational renames did not remove causal and truth overclaims

**Claim.** The glossary now distinguishes evidence from truth and renames the
event class to `OperationalChangeEvent`, observational by default. ORSD and
UC-005 still say a proof is a fact, frame events as control interventions, and
rank them by measured KPI “impact.” Those statements exceed the new evidence
and causal-identification law.

Locations:

- `ontology/docs/pre-glossary.csv:13` defines `VerificationEvidence`; `:25`
  makes `OperationalChangeEvent` observational by default.
- `ontology/docs/orsd.md:5-12` retains “proof is a fact” and control-
  intervention wording.
- `ontology/docs/use-cases.yaml:76-89` retains intervention evaluation and
  measured “impact.”
- `research/kpi-measurement-rules.md:40-44` forbids causal language without a
  supporting design.

**Minimal fix.** Describe evidence validity as tree-and-epoch scoped, propagate
`OperationalChangeEvent`, and call before/after results observational deltas or
associations unless a named design upgrades causal status.

### WARN W-09: closed literal-domain members bypass the admission checker

**Claim.** The literal-domain law applies the Must/Should-or-support gate to
every member, but the validator never reads that document. Concrete new
members `CancelledExecution` and `ReleasedGrant` have no exact Must/Should
query occurrence or named support license. The same is currently true for the
two CQ-023 exception members because the query uses an unconstrained variable;
H-12's repair would make those names decision-relevant.

Locations:

- `ontology/docs/literal-domains.md:15`, `:19`, and `:21` declare the members;
  `:40-42` declares their admission law.
- `ontology/docs/competency-questions.yaml:558-568` names only
  `RunningExecution`; `:627-637` names only `CompletedExecution`.
- `research/scripts/validate_packet.py:132-183` audits only pre-glossary rows.

Executed census:

```console
$ PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=$HOME/.cache/uv/archive-v0/R3O9atmNgFABYDTQ python - <<'PY'
from pathlib import Path
import re, yaml
cqs=yaml.safe_load(Path('ontology/docs/competency-questions.yaml').read_text())
text='\n'.join(c['sparql'] for c in cqs if c['priority'] in {'must_have','should_have'})
for member in ('ReleasedGrant','CancelledExecution','HardFloorException','QuarantineException'):
 print(member, 'exact Must/Should query references =', len(re.findall(rf'ciops:{member}(?![A-Za-z0-9_-])', text)))
validator=Path('research/scripts/validate_packet.py').read_text()
print('validator literal-domains references =', validator.count('literal-domains'))
PY
ReleasedGrant exact Must/Should query references = 0
CancelledExecution exact Must/Should query references = 0
HardFloorException exact Must/Should query references = 0
QuarantineException exact Must/Should query references = 0
validator literal-domains references = 0
```

**Minimal fix.** Make literal domains machine-readable and audit each member by
exact decision/support reachability. Add honest support licenses where a
member is required to complete a decision domain; otherwise defer it.

### WARN W-10: S4 candidates can cite a Could CQ and pass the written completion gate

**Claim.** S4 candidate records require a nonempty `cq_justification`, and the
completion rule checks that cited IDs exist. Neither requires those CQs to be
Must/Should. A decision candidate citing CQ-018 therefore passes the written
S4 gate while violating the two-kind admission law.

Locations:

- `ontology/docs/s4-lane-contract.md:90-107` defines candidate records.
- `ontology/docs/s4-lane-contract.md:191-196` checks ID existence only.
- `ontology/docs/competency-questions.yaml:444-460` makes CQ-018 Could.
- `ontology/docs/orsd.md:39-47` admits decision terms only from Must/Should CQs.

**Minimal fix.** Resolve every cited CQ and require priority in
`{must_have, should_have}` for decision candidates and CQ-rooted facts.

## Notes

### NOTE N-01: “FULL” normalization is ambiguous for half the candidate kinds

`ontology/docs/s4-lane-contract.md:90-112` permits class, property,
individual, and literal-domain-member candidates. Lines `143-161` say every
candidate, “classes AND properties,” must be analyzed, without saying whether
individuals and domain members are analyzed or exempt. Define a type-specific
normalization outcome for all four kinds or list explicit justified
exemptions.

### NOTE N-02: the frozen-input CQ census omits the Could CQ

`ontology/docs/s4-lane-contract.md:12` says “26 CQs (18 Must / 7 Should),” but
the parenthetical totals 25. The validator reports 26 = 18 Must + 7 Should + 1
Could. Append `/ 1 Could` to the census.

## Verdict

The post-grill delta is not ready to launch S4: **14 BLOCKERs, 10 WARNs, and 2
NOTEs**. The two supplied commands are green under the cached execution
environment, but their fixtures and oracles do not cover the counterexamples
above. Every blocker needs a focused executing regression (plus deployed-state
coverage where the claim names a deployed carrier) before another green suite
can be treated as semantic proof.
