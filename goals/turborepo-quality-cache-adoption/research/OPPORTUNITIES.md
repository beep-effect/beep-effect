# Friction and opportunities

## Global-input exclusion control, 2026-11-02

The first native configuration experiment expected a child task to reuse after
a synthetic shared file changed under the `globalConfiguration` layout. The
pinned stable client recomputed it instead. The driver stopped at that assertion
and wrote no passing report; original source and bounded logs are retained.
Inspect the resolved task inputs before changing the expected result. Capturing
the native run summary before assertions would have made this distinction
visible in the first failure. No repository input exclusion or cache setting
was changed.


Record friction as it occurs: work, minimum command/error/file evidence,
impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

## 2026-11-02: default package verification skipped its removed audit wrapper

After PR #2526 removed `beep:audit` from workspace manifests, default
`beep quality package-verify` treated the missing script as a successful skip.
The command could report success after docgen alone. Three regression cases
reproduced that omission in `Quality/internal/PackageVerify.ts`.

Delegate the audit to the existing root `audit` command with the selected
workspace filter. Keep its execution plan and failure-capsule command together;
a missing root command or a nonzero audit exit must fail verification. All 24
focused tests pass, including real root-directory and argument forwarding.
The actual default identity-package command now passes audit and docgen, and
the edited CLI passes lint, type checks and bounded docgen.

Default package-verification timings from the wrapper removal until this repair
do not measure a complete audit. Exclude those samples from complete-verification
and cache-savings claims. Earlier measurements retain their recorded command,
source and time scope. This repair restores the existing composed audit without
reintroducing per-package wrappers or granting task qualification.

## 2026-10-28: current population exceeds the retained handoff

`cache census` observes 190 workspaces and 2,571 executable computations,
compared with 145 and 1,984 in the retained qualification handoff. Of the
current computations, 638 have no node in the retained population and 1,923
retain the same command text. Matching command text does not renew the old
runtime or semantic review. The current register preserves the prior review
leads and keeps every final disposition open. Owner: this goal.

## 2026-10-28: native client inference can invalidate a comparison

Launching the published canary binary from this checkout without
`--skip-infer` reports the installed stable version. With that flag, the
integrity-verified binary reports its pinned canary version. The existing pilot
already owns this control. All refreshed probes use that same selection rather
than treating two stable executions as a stable/canary comparison. Owner: this
goal; resolved for the refreshed pin observation, runtime comparisons pending.

## 2026-10-28: workstation timers are not cloud-enforced burst expiry

The earlier temporary runner cap was scheduled to return from eight to two at
12:54:43 UTC. Its local guard recorded restoration at 15:16:41 UTC, 2h21m58s
late. A fresh AWS read confirms cap two. The earlier 3.5-hour compute estimate
is not an actual billing receipt. Do not reuse this local-only procedure as a
hard expiry guarantee; prepare an independently available expiry control before
another bounded burst. Runner-cap control belongs to CI operations, not cache
qualification. The restored cap and original private launch receipts are retained.

### Refresh after source integration

Review found that the population receipt still held pre-integration census
source hashes. Re-ran the existing census and refresh recipe after main
integration; all retained census-source digests now match. Counts remain190
workspaces and2571 executable computations. The recipe now reads explicit UTF-8
and writes UTF-8 with LF under an ASCII locale. Source refresh is inventory
maintenance and grants no qualification or adoption.


## 2026-10-29: Census-source drift survived a later proxy repair

Review on PR #2352 found the population snapshot still retained an earlier
proxy digest. A proof that current census inputs are internally consistent did
not establish that the checked-in derived population had been regenerated.
Re-ran the canonical census and retained refresh recipe, verified every retained
source digest, and compared all population counts. Counts and qualification
states are unchanged. Future source-changing waves must regenerate the derived
population as well as inspecting a newly emitted private census.
## 2026-10-29: Native feature evidence needs the invoked runtime identity

The private controls were initially tied to local absolute paths. The retained
driver removes those paths, checks both client digests and the pinned Bun, and
cleans owned fixtures before success publication. Resolving the multiplexer
symlink and invoking its target directly changes argv-based tool selection;
that failed the Bun-pin preflight before any fixture execution. Resolve the
actual native executable through the selected Bun's `process.execPath` instead.
Both pinned clients now complete all eighteen executions. Description-only
configuration edits also change hashes here, so preserve this observation and
avoid promising metadata-only reuse without a supported implementation.


## 2026-10-29: Current pin blocked by a historical observation domain

The actual collector rejects Bun1.4.4 before qualification because the snapshot
schema permits only1.4.1/1.4.2. Expand observation support for the exact current
pin, while retaining the declared-pin and historical-key barriers. Current
native collection and a real wrong-pin fixture now pass/refuse respectively.
The first scratch driver had an incorrect export and omitted FsUtils; neither
result was accepted as runtime evidence. The retained driver uses curated test
APIs and provides the real platform/admission services.

A known encoded test fixture initially used decodeUnknownEffect. The type check
requires decodeEffect; retain the failed check and its repair. The2.5MiB census
exceeds Biome's default file limit. Keep the retained recipe's JSON serialization
and validate JSON/source hashes directly. Forcing a larger formatting limit
introduced unrelated array-layout churn, which was removed without changing
the observed data or the repository-wide limit.


## 2026-10-29: Ignored non-workspace metadata enters the real lint hash

Both exact pinned clients include an owned Git-ignored tmp/package.json fixture
in the real identity lint dry plan. The selected input count rises1153to1154
and its task hash changes; cleanup restores the exact original hash in both
clients. No quality task executes and no remote cache is used. Root-wide
metadata globs are a narrowing candidate, but exclusion still requires tracing
the wrapper's real reads and proving actual output/verdict equivalence. The
current task remains cache:false. Keep that work in this active adoption goal.


### Current runtime whole replay and resume overhead

- The committed Bun1.4.4 observation change passes the whole CLI package audit
  in1118.9seconds and docgen in36.4seconds; frozen source and manifests match.
- Resume friction: the scheduler status command emitted over two thousand
  historical quarantine rows while inspecting live admission. Future status
  consumption should request a bounded projection where supported. No runtime
  or cache behavior was changed for this observation.


### Runtime observation and reviewed baseline must advance together

- Historical refusal: the public fingerprint command rejected Bun1.4.4 while
  its reviewed baseline still named Bun1.4.2. Collector support alone did not
  authorize that new tuple; the guard behaved as designed.
- The [baseline checkpoint](current-runtime-baseline-checkpoint.json) records
  the completed Bun1.4.4 review, qualification-v3 epoch and current-profile
  public fingerprint. Effective configuration, cache flags, scope and ledger
  stayed unchanged. Existing qualification remains bound to its original tuple.
- Publication was stopped before its push stage while that review was prepared;
  the reviewed observation path subsequently landed in this source wave.


### Research controls must preserve evidence checks

Review found assert-dependent plan and native-invariant checks that Python
optimization could erase. Both drivers now refuse that mode before runtime
state is created; the ignored plan also explicitly rejects nonzero exits,
duplicate or missing targets and reported execution. A fresh report directory
is created before writing. The new control receipt separates unit excerpts
from actual synthetic stable/canary replay and retains all historical source
bindings. Owner: the active Turbo goals. No qualification or rollout changed.


### Fixer classification must follow delegated scripts

The census command digest binds the complete sorted script map, not just the
visible task command. The first direct-command digest comparison was therefore
inapplicable; use the owner's existing encoding. All 136 current source-fixer
script maps match, and their delegated `--write` implementations have separate
read-only counterparts. A native control initially probed canary version without
`--skip-infer` and selected local stable. Preserve that failed harness check;
explicit inference suppression validates the exact canary and six native runs.
Keep source-review dispositions separate from qualification and runtime proof.

The population file exceeds Biome's default one-MiB read limit. Format this
existing large evidence file with a one-command five-million-byte limit and
verify structural diffs; do not change the repository's shared limit.


### Historical profile leads are not the current semantic population

The first source-fixer review selected 136 historical source-fix profile leads.
The current population also contains 50 unreviewed `lint:fix` commands. Exact
current source shows 49 use the same write implementation and Storybook writes
shared story sources. Review current executable rows directly; a historical
profile label cannot establish complete classification. All 186 whole-command
fixers stay fresh, with separate read-only lint qualification still unfinished.


### Cheap publication still holds a memory admission lease

Three normal publication attempts after the directory-coverage repair showed
that the second and third waited behind the first local gate wave. The current
`runPushFirstPublishPhases` source explicitly holds weighted admission because
the schema-catalog scan peaks near 12.6 GiB, and `yeet-command-wiring.test.ts`
covers cheap-gates admission. The Yeet skill still claimed no ticket was taken.
Correct that wording and preserve the resource guard. A local queue is distinct
from a Turbo miss or hosted runner queue; cache hit-rate cannot explain it away.
Use the existing ten-minute constrained-compute route when its real threshold
is reached, recording completed local checks and relying on current hosted
proof rather than lowering test floors or forcing overlapping memory-heavy jobs.


### Refresh source absence before final applicability, 2026-10-30

A prepared Go-workspace review named an unpublished producer source tree.
Refresh it against the accepted tree before changing the feature matrix:
43,760 tracked paths contain no Go files or manifests; 4,544 declared manifest
scripts have no enumerated direct Go build/module command. Keep the superset
script count distinct from executable computation population, preserve disabled
configuration and reopen when a real consumer appears. Do not infer Go support
from missing canary documentation or extend this absence result to Cargo/Python.


### Missing documentation is not missing configuration support, 2026-10-30

The pinned canary docs omit several future-flag names. Exact native dry runs
accept all 14 flags false/true on both pins while rejecting an unknown key on
both. Record this stronger availability evidence without calling syntax
acceptance a semantic regression pass. The marker command never executes;
production configuration and feature-acceptance states stay unchanged.


### Retain reproducible observation drivers, 2026-10-30

PR #2369 review found that the sixty-case native availability report recorded
an executed-script digest without retaining that driver in the packet. Retain
a portable driver, bind its exact bytes in the regenerated report and document
the reproduction command in SOURCES.md. Re-run the observations from that
retained driver; keep the previous report in Git history. This closes evidence
reproduction, not feature semantics, task qualification or production adoption.


### Revalidate older retained-driver bindings, 2026-10-30

A source-binding audit found that the older native input and real ignored-input
reports also named driver digests that differ from their retained files. Re-run
those exact retained drivers and bind the new observations to their bytes before
using either report for current feature review. Preserve the old observations in
Git history; do not relabel an old run with the current script's hash. Both
replays pass: eighteen synthetic runs plus both real-computation dry-only
perturbations, with exact owned cleanup and baseline restoration.

### Publication context can precede its generated commit, 2026-10-30

The normal publisher pushed commit `1ed7bfa943` but its successful verdict still
named the earlier `07db932b41` context captured before it committed the staged
index. Retain that mismatch and refuse to call it same-head proof. An explicit
commit before the next publication avoids this attribution defect while its
owner fixes context refresh; do not weaken the exact-head acceptance gate.

### Generated report binding drift, 2026-10-30

- Doing: make the retained native-input report reproducible on replay.
- Evidence: PR #2369 review found that the generator emitted `driverSha256`
  without the report's added `driver` path/digest object. The actual ignored
  input generator had the same postprocessing gap.
- Repair: generate bindings before writing either report, capture real source
  metadata in the ignored-input driver, replay both and copy generated bytes
  unchanged. Preserve prior reports in Git history.
- Prevention: compare the retained JSON directly with generated output before
  publication, in addition to checking each digest against retained source.

### Constrained evidence-repair publication, 2026-10-30

- Doing: publish the completed report-generator repair.
- Evidence: the canonical publisher spent more than thirteen minutes in
  admission and local gates while available memory constrained the host.
- Action: cancel only that owned publisher after preserving its logs, then use
  the existing hosted escape. Retain eighteen native executions, six dry plans,
  Ruff and packet checks; disclose unfinished broad gates in the PR.
- Prevention: qualify reusable policy phases and keep publication admission
  separate from broad local proof; do not widen memory capacity or lower gates.
### Preserve actual publication identity separately, 2026-10-30

While publishing the feature evidence repair, Yeet pushed `1ed7bfa943` but its
verdict retained the starting `07db932b41` head. The attempt identity is useful
and immutable; it cannot by itself name the new commit produced in the run.
Add an optional, independently recorded published commit identity, bound around
the successful Git push. Refuse a head that changes during that phase, retain
unknown identity on a failed push, and keep starting proof facts unchanged.

### Attribute full-check worker termination before retry, 2026-10-30

The producer component's full final check at `e9866c4c4ea7` ended with SIGTERM
errors in two Vitest coverage workers: CLI coverage-artifact tests and cli-kit.
Their sources match accepted main. Focused Node replays pass all 114 affected
CLI artifact cases and all 1,396 cli-kit tests. The signal's sender and cause
remain unproven. Preserve that failed run and permit one unchanged-head full
retry; investigate the lifecycle before a further retry if termination recurs.
No coverage floor, expectation, source or required status is relaxed.


The system journal subsequently identifies the two victims: `earlyoom` sent
SIGTERM to two Node/Vitest workers from the producer checkout at 11:14:52-53
UTC. No later earlyoom signal appeared in the subsequent journal observation.
The unchanged-head canonical retry then passed every final gate with no skips
or lowered floors. Keep the original failed run and sender attribution; order
additional heavy local checks around the active proofs instead of changing the
workstation's memory protection policy.

### Publication repair duplication gate, 2026-10-30

- Doing: publish the attempt/publication identity repair through Yeet.
- Evidence: the collected cheap-gate wave identified one introduced Fallow
  duplication group in the two publication tails. The canonical publisher
  stopped before pushing. The old-source whole-package audit was interrupted
  deliberately before repair; it is not a passing proof.
- Repair: move upstream warning and push-step selection into the existing shared
  push phase, keeping both before/after head guards and all original behavior.
  Replay focused tests, both guard-removal controls and the unchanged Fallow
  gate before publishing. Preserve the original failed result.
- Prevention: exercise the existing duplication gate during the focused edit
  loop when consolidating a shared phase, before the broader publication wave.


### Direct prove-first publication coverage, 2026-10-30

- Doing: close review of the publication-identity repair in PR #2370.
- Evidence: the real Git fixtures initially drove only the push-first tail,
  leaving the standard tail's prepared-head capture unexercised directly.
- Repair: expose the existing standard tail through the source-only test kit
  and reuse the same disposable bare remote for its success and proof-time
  drift cases. Moving the capture after proof fails the selected new case
  under both Node and Bun; restore exact source bytes after each control.
- Prevention: exercise each independently ordered publication route, even
  when the final push guards are shared. Production phase behavior is unchanged.

### Review-request Git transport recovery, 2026-10-30

- Doing: push the generated review-request commit for PR #2368 after full proof.
- Evidence: SSH refused the available public-key route. The scoped HTTPS
  consumer authenticated, but GitHub repeatedly returned `fatal error in
  commit_refs`. The commit object was already uploaded with the expected parent.
- Recovery: verify that exact object and parent through GitHub, then update the
  existing branch forward with `force=false`. Retain each failed transport
  result separately; the recovery grants no new proof or merge authority.
- Prevention: distinguish authentication failure from an uncertain ref update,
  inspect the actual remote object/ref, and preserve forward-only updates.

### Do not infer execution or dependency closure from selection switches

- Work: establish the pinned task-selection contract. A first broad expectation
  treated graph-only plans as identical across strict false/true; the native
  assertion exposed two extra commandless entrypoints in default mode.
  Both pins also preserve same-name dependencies under `--only`, and sixteen
  fixture zero exits have no selected execution record.
- Prevention: retain complete task/edge and actual execution-summary controls
  before changing selection. Count real selected commands, and classify empty
  or dependency-only results explicitly; do not equate zero exit with proof.
- Local tooling: Ruff was absent from PATH; use the existing cached 0.17.2
  binary for this driver rather than fetching another tool. Its standard UTC
  formatting rule was applied before the final source-bound replay.

### Root discovery absence is not ecosystem absence

- Work: review the experimental Python workspace flag. The tracked tree has
  no root uv workspace, but the Beep CLI owns a nested `beep-photo-face` project
  and explicit `beep:lint:python`/`beep:test:python` audit steps.
- Prevention: inventory nested manifests and generated command ownership before
  declaring an ecosystem inapplicable. Preserve those quality computations in
  decomposition/qualification even when root discovery remains disabled.

### Tree-exact evidence cannot refresh external security data

- Work: review the existing root Bun audit boundary. The command also applies
  wall-clock expiry to OSV ignores and package overrides, so even an unchanged
  lockfile and config can require a different current verdict.
- Prevention: preserve both the existing Turbo cache exclusion and local proof
  exclusion. A future pure parsing optimization must not suppress the fresh
  network verdict or freeze expiry policy. No audit or cache setting changed.

- Report formatting friction: the generated population JSON exceeds the default
  formatter one-MiB limit. An explicit four-MiB process bound formats the full
  report; repository formatter settings and all correctness floors stay intact.

### Preserve module isolation around native coverage witnesses

- Work: finish the occupied-port repair's full proof.
- Evidence: all Markdown tests passed, but the root ratchet measured two uncovered
  default-metadata branches. The existing direct test and standalone full-package
  replays cover those branches; the original measurement is retained privately.
- Response: follow the shared harness's existing rule for registry-mocking
  packages and isolate each file during coverage. Both native full suites and
  default package verification pass without lowering any floor.
- Limit: standalone controls do not reproduce the original failure or establish
  an exact V8 cause. Retain the extra measured coverage runtime and require fresh
  whole-proof/hosted evidence before closure.

### Cross-check evidence references after extending retained drivers

- Work: review the expanded native input controls. The driver/report had moved
  to22 cases while the completion audit still named the older18-case digest.
  A prose summary also lagged the structured feature counts.
- Prevention: derive current references from the retained driver/report bytes
  and count actual results. Pin the prior replay to its immutable source revision
  instead of reusing a current path for old bytes. Keep numeric totals in
  reviewCounts and row statuses rather than duplicating them in limits prose.
- The superseded local proof was stopped through its exact owned launcher
  before changing tracked files. No current full pass or cache qualification
  is inferred from its completed gates.

### Protect the quality harness from competing stale-port reclaimers

- Work: attribute a coverage failure in the existing forty-server identity test;
  one response belonged to another server. The original failure is retained
  privately and its exact cause remains unproven.
- Evidence: a controlled interleaving at the real filesystem unlink boundary
  makes the original allocator return the same reserved port to two servers.
  The regression fails on duplicate port identity; existing request assertions
  and server counts remain intact.
- Response: pin the inspected inode with a hard link until acquisition finishes.
  Reclaim only the matching inode with no other live reclaimer link; remove
  abandoned staging/reclaimer links only after their owning process exits.
- Prevention: keep a failing-original control, real HTTP response checks, and
  explicit abandoned/live reclaimer cases. A focused pass is not whole-proof,
  hosted, cache-performance, or goal-acceptance evidence.

- Publication review caught the allocator function's complexity and a plain
  Vitest import in the added test. Separate inode reclamation from intent
  ownership, and use the existing Effect-aware Vitest entry point. The native
  boundary control needs no policy exception or lowered threshold. Current
  Fallow audit and health checks pass; retain the interrupted package attempt
  as unproven and complete the normal proof and hosted review before closure.

- Additional source review found fixture setup could overwrite another job's
  reservation. Publish complete marker files with an exclusive hard link;
  atomically retire only markers still owned by this live test process. Keep
  a direct occupied-marker refusal control and wrap fixture offsets within
  the allocator range. This repairs the test setup without weakening the
  server-identity assertions.

### 2026-10-31: real Cargo applicability graphs exceed the synthetic capture cap

The initial, superseded dry graph was 1,199,745 bytes, exceeding the synthetic
selection helper's one-MiB output bound. The native process had completed; its
fixture was cleaned. A separate applicability capture retains the ten-second
process deadline and caps stdout at eight MiB and stderr at one MiB. It records
actual retained byte counts of 1,194,393 and 1,194,401 bytes and both
original/adapted invoke hashes; no canonical verifier
or production policy changed.

The first applicability assertion also wrongly expected only the two selected
apps. Native `--only` preserves same-name prerequisites: the real graph has
ninety build nodes. Preserve that entire graph and compare its full inputs,
commands and configuration across the Cargo flag contrast. Four current-source
calls now pass with identical graphs. The failed attempts remain in private
evidence; this correction does not remove prerequisites or claim execution.


### 2026-10-31: fresh CI exposed a virtual-clock/native-I/O test race

The content-final dependency-repair head has the identical tree as its passing
pre-flip head. Its fresh Property Laws job failed at the DuckDB held-message
case: expected one reply, received zero. The test and storage implementation
are unchanged from accepted main. Source inspection shows a reply assertion
immediately after virtual clock adjustment, without waiting for the native
asynchronous reply write. Keep cache and performance conclusions separate from
this failure; do not retry it blindly or relax the assertion/timeout.

Prepare a separate small main repair using the suite's existing reply-handler
latch pattern and explicit layer-start readiness. Retain both zero-before/
one-after assertions and the original timing contract. The failing job log and
source comparison are retained privately; fresh hosted proof remains required.


### 2026-10-31: setup descriptions are weaker than exact-runtime evidence

The packaged stable schema and native help describe experimental setup as not
implemented, but both pinned executables reach provisioning preconditions when
the flag is enabled. A first empty fixture had no Bun lock: Bun removes an
empty lockfile. A local workspace dependency produces a real lock offline and
reaches the next checks. Do not classify early refusals as setup implementation
or non-implementation proof.

Private network-isolated probes, with only the selected executables, libraries,
fixture and shell mounted, retain six exact-client refusals without changing
fixture files or running the task sentinel. Stable requires resolution data or
a Turbo lock; canary reports a system-configuration refusal. These are exploratory
results, not a completed setup feature decision or a diagnosed upstream defect.
The partial first isolation omitted the shell needed for libc detection; the
corrected isolation includes it. Continue from those actual preconditions and
pinned source before proposing a bootstrap change. No repository bootstrap,
cache setting, feature disposition or qualification status changed.


### 2026-10-31: current heavy waiting is runner capacity

PR2374's required heavy contexts remain queued after admission. The Check job
has no assigned runner and selects the heavy label. The organization inventory
shows one online busy runner and one offline runner, with no idle online runner;
the repository-only inventory is empty. The workflow depends on admission,
not on the earlier quality lanes. Keep this queue time distinct from computation
and cache time. The exact API job and runner-inventory receipts are retained
privately. No runner-cap change, cancellation, pending-check waiver or scaler
defect conclusion follows from this observation.


### 2026-10-31: a reply count does not prove held-message delivery succeeded

PR2374 review found that the completion latch opens for a failure reply as well
as a successful reply. Preserve both original count assertions and the virtual
clock/15-second timeout, then require the final decoded reply to be WithExit
with a successful void result and join the reply-reader fiber to propagate its
failure. The current fix passes Node29 tests,20 Bun whole-file replays580 tests,
and the complete DuckDB package audit/docgen.

An initial handler-defect control restarted the entity and hit the watchdog;
it was restored exactly and is not success-assertion evidence. The corrected
control changes only the decoded exit after a real stored response: the new
assertion rejects failure, and removing only that assertion lets the former
count-only behavior pass. Both bounded cases restore the source exactly. This
is synthetic decoded-reply fault injection, not a reproduced registration-timeout
defect. Publish/prove the new source and answer the review before acceptance.

### Quiet-log probe portability, 2026-10-31

- Preparing the pinned native output-log controls exposed a report-directory
  variable colliding with the existing command-list variable (`TypeError`).
  The first presentation pass and failed cache attempt remain private; the
  shared invocation helper and native semantics were unchanged. Rename only
  the report directory and rerun both drivers before retaining accepted evidence.
- A registry refresh used the wrong package-relative `dist-tags` endpoint and
  returned HTTP404. Use the registry package-tag endpoint; the failed request
  establishes no version freshness. Exact executable digest checks still ran
  before each attempted native control.
- The successful registry refresh found canary 2.11.11-canary.1 while the
  retained baseline is 2.11.9-canary.1; stable remains 2.11.10. Preserve those
  historical receipts. Freeze separate feature-local pins for the fresh replay;
  this does not upgrade a repository consumer or grant current protected
  producer authority to the older canary.
- The fresh canary archive uses `turbo-linux-x64/`, rather than the assumed
  `package/` prefix. The first member lookup failed before writing an executable.
  Inspect the exact integrity-verified archive; validate package name/version
  and read only the named regular executable. No broad extraction is needed.
- Committing before this fresh worktree installed its dependencies printed
  `Can’t find lefthook in PATH`; that commit is not a hook pass. The frozen
  install completed, an explicit scan of the committed change found no secrets,
  and commit-message validation passed. Install before committing a new lane.
  The source-only follow-up uses the installed normal hooks.

- A base-ref fixture initially assumed an invalid explicit `TURBO_SCM_BASE`
  behaved like missing implicit GitHub inference. Stable returned an SCM-query
  refusal instead. Preserve this stronger boundary, retain the failed attempt,
  and re-execute the corrected source rather than relabeling the old run.

- 2026-11-02: The existing population refresh would replace199 reviewed dispositions with pending rows without retaining their evidence. Require an exclusive sibling archive, verify the bounded prior-history digest chain, and keep changed-source review separate from historical facts. Eleven isolated controls include the reproduced old replacement and altered-ancestor refusal. The actual199-row archive is byte-identical; the qualification ledger remains unchanged.


### Native setup metadata and runtime front door, 2026-11-02

The exact stable and current canary help/schema describe setup as parsing-only,
but isolated invocations reach managed storage, lockfile and offline resolution
checks; explicit schema-defined skip policies execute successfully. Do not mark
the feature unavailable from descriptive text alone. The new setup control
driver reuses the existing bounded capture and freezes actual native binaries.
An initial disposable fixture accidentally mounted the Vite-plus front door,
which tried to fetch CLI metadata and was denied by the empty network namespace.
Use the already installed Bun runtime reported by `process.execPath`, check its
version inside the sandbox, and retain the failed fixture receipt separately.
No production setup flag, bootstrap owner or cache policy changed.

The first portable replay stopped at its flag-refusal assertion: one multiline
case assignment still targeted the old collector namespace, so it repeated
fixture lock preparation instead of invoking Turbo setup. The intended negative
control rejected that false success. Bind every invocation to the shared
collector's command slot, commit the correction and replay the complete matrix;
the failed attempt is not setup evidence.

### Read-only generator drift diagnostics, 2026-11-02

The shared generator staged unified-diff input beside its installed source.
Under a read-only checkout, changed or missing generated output therefore
returned `CodegenFormatError` instead of the intended `CodegenDriftError`.
Three focused cases reproduced that failure before the fix. Use the scoped
system temporary directory for diff staging; preserve cleanup and output
comparison. All 43 package tests, lint/check and docgen pass after the fix.
An actual ACP check also passes with network access denied and all repository
source read-only; a stale-output overlay reports drift without changing source.
This removes a prerequisite defect, but does not qualify a Turbo task.

The native probe initially named `biome.json` instead of the real
`biome.jsonc` and stopped before executing the generator. Its next assertion
looked for the typed error in stderr, while the actual Effect runtime logs it
to stdout and prints the diff to stderr. Both original failures are retained;
the corrected three-case probe checks each real stream and source integrity.
The checkpoint records the successful behavior separately from those failures.
### Revalidate population source before batching semantic reviews, 2026-11-02

The retained census still described 2,621 executable computations, while 231 of
its 438 bound files had changed in the later phase-runner checkout, including
189 manifests. Accepted PR2526 had removed 188 package audit wrappers and added
one root check. A fresh census finds 2,434 executable computations. Preserve the
reviewed snapshot byte-identically and verify its history before refreshing;
do not relabel historical counts or reviews as current-source evidence.

An initial private prioritization grouped `commandDigest` values as if they
represented individual commands. Source inspection shows that digest covers the
whole workspace script map. Correct the private analysis before using it: group
by the actual task and resolved literal operation, then review source, env,
outputs and profile per member. All 198 retained fresh-operation rows have new
workspace-map digests after the audit-wrapper removal, but their exact literal
operation and disabled-cache policy still match. The new review proves only that
whole-task freshness; all pure counterparts and 2,236 other reviews remain open.


### Keep summary views synchronized with refreshed evidence, 2026-11-02

PR2572 refreshed the source census and report index but left the manifest status
note and README on older counts. The review caught the stale summary. Derive the
source revision, executable/review counts and accepted/pending feature totals
from the current population and feature rows, and check both entry views before
publication. Preserve versioned native evidence rather than calling an older
shared pin observation current. No acceptance or qualification is inferred from
this documentation repair.

### Signature-key safeguard calibration, 2026-11-02

The first synthetic native invocation combined mutually exclusive `--force`
and `--cache` options and was refused before task execution. Preserve that
receipt as an argument failure, not signature evidence. Use an empty cache per
case instead. A local-only calibration then correctly performed no remote key
validation; explicitly enable synthetic remote settings inside denied networking
to exercise the native minimum. The full 168-case matrix confirms a supplied
short key is rejected, but an absent key may execute and warn later. Retain the
separate Beep role policy and actual transport/provenance proof requirements.

The normal commit hook rejected a non-secret driver checksum because its
filename was a JSON map property containing `signature-key`. Use the existing
source-binding representation with named `path` and `sha256` fields rather than
filenames as property names. Preserve the failed hook and original report,
re-execute the same cases against the revised driver, and keep scanner rules
unchanged. Checksums are provenance metadata, not credentials.


## Feature review counter missed an accepted status, 2026-11-02

Before the global configuration decision, the existing cargo integrity test
failed because its status mapping omitted `accepted-retain-current-default`,
which was already present in the accepted feature matrix. The failure is
inherited from main. Extend that explicit mapping for the existing default
status and this retained enabled setting; keep exact count and known-status
assertions. A shared status domain would prevent later feature decisions from
leaving this integrity check stale. No runtime or cache policy changes.

The full seven-case integrity suite also detected a stale SPEC digest in the
current working completion audit. It was already stale against the accepted
base SPEC before this decision. Every existing acceptance and implementation
requirement still appears in the normative SPEC; preserve the prior digest,
refresh the working audit binding and keep all nine acceptance criteria
unproven. Historical runtime and qualification digests are unchanged.


## Superseded queued workflows block current heads, 2026-11-02

The old Check runs for [PR2562](https://github.com/beep-effect/beep-effect/actions/runs/41458892594)
and [PR2596](https://github.com/beep-effect/beep-effect/actions/runs/41462399317)
remained queued after their reviewed replacement heads were pushed. The current
runs had zero jobs and stayed pending. In contrast, PR2576's old run was already
cancelled and its current run had 28 queued jobs with no runner assigned. These
are different waits; absent check contexts do not establish a missing workflow
or a successful check. Verify the PR's current head and the obsolete run's exact
head before requesting cancellation, then observe termination and current-run
progress. Do not create a second workflow to work around the queue. Existing
convergence should surface and clear an obsolete queued predecessor.

Shared GraphQL quota also prevented the ready transition and a metadata read
from 14:30 until the 14:36 reset. Same-account REST supplied supported metadata
operations, and the ready transition succeeded after reset. Review state was
unknown during failed reads. Longer bounded polling and a shared census would
reduce duplicate API demand; no alternate identity or quota purchase was used.

Both obsolete runs reached terminal `cancelled` after the normal cancellation
requests; their current runs advanced from pending to queued. A later force
request for the first run raced with its completion and returned HTTP409; the
follow-up read confirmed cancellation, so no retry was needed. The requests
were scoped to obsolete heads and no workflow was re-dispatched. This clears
the stale predecessor without claiming the remaining runner queue has cleared.


### Native selector composition versus CI rationale (2026-11-02)

- Work: current selection-consumer review in `CiLane.ts`.
- Friction: two full-labs comments claimed positive filters plus `--affected` widen scope, while the Storybook probe depends on intersection. The pinned enabled configuration proves intersection in 56 asserted native plans.
- Correction: retain the full-labs execution contract and correct its rationale; publish the bounded native oracle and five intended refusals/counterfactuals. Do not infer a runtime speedup from the comment repair.
- Calibration: the first fixture put `remoteCache` outside the enabled global namespace and was refused before selection. A report-variable shadowing error also prevented an initial report; neither was treated as passing evidence. Fixed source is bound to the successful fresh report.
- Prevention: use the accepted global namespace, keep parsed arguments distinct from selector argv, and require exact-client behavioral evidence before deciding lane scope.
### 2026-11-02 — selection evidence must follow the current native pin

The retained selection report covers canary `2.11.9-canary.1`; the current
trial uses `2.11.11-canary.1`. The driver also hardcoded the older cache path.
Historical feature evidence cannot establish behavior on the new pin. Accept an
explicit reviewed pin manifest and a new report destination, preserve the original
report and its immutable Git source, and replay both the current and historical
pairs. Reuse the existing streaming collector instead of checking output size
after unbounded collection. Preserve the ten-second process and three-minute
observation limits with an owned process wrapper, and refuse existing reports.
This refresh grants no real computation qualification or production flag change.

### 2026-11-02 — native driver path and source snapshot review

Review found an unresolved research path beside a resolved repository root and
a second harness read after the function had already been parsed. A real symlink
invocation reproduced the path failure. Canonicalize both paths and bind harness
and pin digests to the exact captured bytes used for parsing. Real controlled
mutations of each file now fail before native controls; both files are restored
byte-identically. Forty-four alias-path cases match the canonical invocation.
Outside-checkout pin manifests fail explicitly. Keep these observations separate
from the earlier published source and preserve that proof through immutable Git.


### Selection helper extraction compatibility (2026-11-02)

- Work: current-pin selection driver review, PR #2617.
- Friction: changing the extracted `invoke` function added globals missing from five sibling loaders. Actual loader regressions reproduced `NameError: capture` and the Cargo applicability source-adaptation assertion.
- Correction: preserve the exact historical helper contract, name the streaming selection helper separately, and exercise all five real AST-loading preludes with process/stream/deadline controls. Keep historical report source pins immutable.
- Prevention: search both path references and extracted-symbol consumers before changing an evidence helper; run the sibling compatibility regression with the selection replay.


### Preserve selection evidence envelopes (2026-11-02)

- Work: PR #2617 source-binding report regeneration.
- Friction: copying the regenerated payload dropped the earlier report's schema version and observation timestamp.
- Correction: restore the version and actual capture completion time, refresh the checkpoint digest, and make the exporter emit both fields. The driver and observation payload remain unchanged; no fresh native execution is claimed.
- Prevention: check the evidence envelope together with payload/source hashes before publishing a regenerated report.
### 2026-11-02 — formatter rewrote sealed baseline during integration

The normal merge-commit hook rewrote `goals/knowledge-doctor.baseline.jsonc`
without changing its decoded entries. The actual canonical text verifier returned
`KnowledgeSealBroken`; a semantic comparison alone missed this. Restore accepted
main bytes and exclude only this CI-minted file from Biome. A direct formatter
write must preserve the canonical hash, and normal commit hooks stay enabled.
The same introduced correction is required in each of this chat's five affected
PRs; the first merge establishes the identical repository exclusion. This does
not copy either declared shared CI unblocker or change the sealed data, mint,
coverage floor, production cache, or whole-goal acceptance.

The narrow Biome exclusion also requires its generated `biome.identity.jsonc`
projection. Review caught the omitted regeneration before current-head validation.
`bun run beep cache profile --write` regenerates it; the freshness command then
passes. Both configuration files remain a projection, without a cache qualification
or runtime activation. Keep the generated profile in the same config-edit wave.


### 2026-11-02 — exporter gate documentation and native behavior

The first offline observability control expected a missing feature flag to
reject configured export before task execution, as the pinned documentation
states. Stable 2.11.10 instead returned success and executed the synthetic
task with the global namespace shape. The failed expectation is retained.
Resolve configuration placement and exact parser behavior before finalizing
the control or feature decision. No repository exporter or runtime flag was
changed; these fixtures have no host network or real credential.

The exact-tag review resolved the mismatch: file settings are deliberately
dropped before the run-builder guard; CLI/environment settings are guarded. The
revised controls assert both paths on stable and current canary. Keep the initial
failed receipt and source separately; generated schema omission is also not an
availability test because this experimental block is intentionally hidden.


### Keep feature counters aligned with accepted evidence, 2026-11-02

The manifest status note still counted eight scoped feature decisions while its
accepted matrix counted nine. This no-change prune review updates both to ten
with 25 pending rows. Matrix counts must be derived from row dispositions before
publishing; an accepted optional absence is not computation or goal completion.


### 2026-11-03: watch caller and declaration ownership

A broad native-watch search also matched historical package prose and declared
Yeet `WatchStream.ts` input paths. Keep every hit and classify it before treating
text as an invocation. The config loader and raw model delegate flag declarations
to `future_flags.rs`; the initial module probes did not establish availability
and remain retained locally. Follow the import boundary and pin the owning
module before making a feature claim. No runtime configuration changed.

The collector now accepts Git exit 1 only for a no-match grep. Other Git errors
and a truncated NUL-delimited inventory fail before applicability classification.
The source-only replay and three early collector refusals remain separate from
repository quality or native behavior proof.


### Aggregate client pins hid a canary-only feature, 2026-11-03

The matrix's aggregate pins still named 2.11.9-canary.1 while later feature-local
experiments had frozen 2.11.11-canary.1. Fresh SRI-verified published package
inspection found a concrete inventory gap: `hashFilePermissions` is declared
only by the current canary, increasing its future-flag surface to 15 versus
stable's 14. Assuming the stable list covered both clients missed this flag.

Preserve historical source/version envelopes and add current-pair availability
separately. Inventory the union of both published schemas; check unsupported
stable cases as negatives rather than silently dropping canary-only features.
Do not enable a hash-changing flag or transplant earlier semantic results.
Source review initially asserted parity and stopped before publication; the
observed schema difference changed the matrix and next qualification work.
### 2026-11-03 — keep native population distinct from package counts

- Evidence: accepted `fae5b2098c` removes T3, adds Party and replaces root
  fingerprint commands. Workspace count stays 191 while executable graph
  entries fall from 2,434 to 2,400. Subtracting one package would be incorrect.
- Prevention: use the existing Cache-owned query/dry-plan census and its
  manifest/source joins; distinguish root scripts, executable graph entries and
  graph-only nodes. Preserve the retired review and all prior snapshot bytes.
- An initial freshness join assumed a single Biome write command. Four existing
  manifest-specific write scopes refused that assumption. Inspect and preserve
  each exact implementation; no broader command substitution or runtime proof
  was used. The corrected join revalidates 198 keep-fresh boundaries only.


### 2026-11-03 — distinguish regular modes from alias behavior

- During permission-hash qualification, private calibration caught an omitted
  stable non-Git symlink input, the unsupported stable flag even when false,
  and alias expectations that varied with native version and index state.
  Failed captures remain retained; none is labeled a passing product test.
- The source-bound driver asserts only regular-file invariants and records
  alias inclusion/relationships separately. All 132 dry runs execute no tasks.
  Its report includes the three omitted stable non-Git alias cases.
- Before activation, require supported-platform and real-profile alias/output
  controls. A schema description and a successful plan cannot supply that proof.


### 2026-11-03 — prevent a repeated source-binding race

- #2679 review found a parsed pin/collector followed by a second digest read,
  repeating the earlier selection-driver defect. The same pattern existed in
  permission availability, and shared availability re-read its schema digest.
- Reuse the selection/filter drivers' captured-byte pattern. Parse and hash the
  same bytes and refuse source movement before native client selection. Six
  deterministic source-change prefix probes show the missing legacy refusal
  and the fixed early refusal, with zero native processes or task bodies.
- Keep the unchanged bounded collector AST and immutable original evidence.
  Fresh observations record the repaired driver bytes rather than re-hashing
  an older observation onto them. A new source binding requires its own replay.


### 2026-11-03 — Generator dependency changes need their generated configuration

The first hosted run for #2686 rejected the new CodegenKit formatter for an
unannotated boolean default and a non-pipeable stream expression. Its shared
build failure stopped multiple downstream jobs. Repo Sanity separately reported
five stale dependency configuration files. Apply `beep tsconfig-sync --write`
when adding the workspace edge; repairing package scripts alone does not update
references or generated boundaries. The canonical repair applied those five
files in about nine seconds; no local verification suite was run.

Fallow's retained hosted artifact identified a further visibility problem:
HTML's authored generator was globally excluded, hiding its real CodegenKit
import. Restore that script to dependency analysis while retaining its existing
clone and complexity scoring exclusions. Do not globally suppress CodegenKit's
dependency findings. Hosted checks remain the proof for all three repairs.

### 2026-11-03 — Two generator checks rewrote source before comparing it

The entrypoint census found `@beep/html#generate:check` and
`@beep/technical-drawing#generate:check` calling their writing `generate`
commands before `git diff`. A check could replace dirty generated source and
silently create an untracked output. Their scripts now select an explicit check branch
before any target write, reusing CodegenKit drift reports and stdin formatting
with the repository's Biome configuration. The formatter also checks its child
exit status before accepting output. Regression cases for current, dirty,
missing and invalid generated content are authored for hosted CI; no local
quality suite or generator execution is claimed. The writing commands and
generated source bytes are unchanged. Qualification remains a separate gate.
