# Friction and opportunities

Record friction as it occurs: work, minimum command/error/file evidence,
impact, prevention and owner/disposition.
Record friction as it occurs: work, minimum
command/error/file evidence, impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

## 2026-10-29: request tags need their own captured evidence

The closed-producer source inspection found that `CacheFixtureEvent.tagPresent`
describes the returned tag and cannot establish which opaque tag arrived on a
request. Capture the incoming header's digest at the HTTP request boundary,
including absence; test a GET whose request and response tags differ. Retain
neither value. This closes a capture gap only: the synthetic fixture supplies
no actual adapter backend-result evidence, and no success status may be
translated into an asserted backend authorization. Owner: this goal. Protected
publication remains closed until the owned native summary and actual adapter
exchange are joined.

The first full Effect/Vitest scan found EV006 in the new compound Option
assertion. It is now expressed with the canonical `deepStrictEqual` helper,
preserving all three expected payloads and order. The detector baseline stays
unchanged; rerun the current tests and detector after this assertion repair.

The signed pilot previously retained only its selected-task projection,
dependency projections and original summary digest. The continuation retains
the complete minimal native task summary from those same supervised bytes,
using the existing schema moved into its schema role. This supplies the missing
input for a full-graph validation before single-task selection. A schema or
component-test pass is not actual native execution proof for this changed
capture, and no backend authorization or protected publication is inferred.

### Complete protocol checks at the supervisor boundary

While preparing accepted receipt import, source review found that
`Cache.protocol.runner.ts` checks transport-failure joins inside its worker but
only reruns the six-case observation validator in the outer supervisor. The current implementation now uses `validateCacheProtocolExecution` in the
worker, outer supervisor and producer acceptance boundary. Current protocol
tests cover relationship rejection; this historical lead is resolved in source.
It does not establish deployed trust or qualify a new computation.

## 2026-10-28: supervisor failure needs safe termination attribution

A current `cache protocol-run` attempt waited for capacity and then returned
`Protocol supervisor failed or exceeded its capture bound.` The admission gate
is already outside the runtime timeout; source inspection ruled out the initial
timeout diagnosis. Minimal namespace and no-credential protocol-module import
probes pass. The failure needs a bounded distinction between nonzero worker exit
and truncated capture, without publishing worker streams that may contain
synthetic credentials. Concrete team-ID requests are being tested against the
fixture's strict `teamId` selector contract. Owner: this goal. Repaired both supervisor diagnostics with separate bounded
exit/truncation results and private-stream regression checks. Current stable
2.11.10 and canary 2.11.9-canary.1 passed the isolated six signing and three
transport cases using concrete team IDs. Adding `--skip-infer` exposed a
zero-task fixture run; pairing it with `--single-package` restored actual
execution, and the existing no-task negative control remains enforced.
Current results are retained in `current-native-checkpoint.json`; production
trust and wrong-team native proof remain open.

## 2026-10-28: diagnostic guards must share the capture contract

The first publish preflight found two introduced complexity findings in the
controlled runner process seams and a six-line duplicated supervisor block.
The repeated synthetic private-stream conditions are consolidated through one
schema-derived fault guard. Both supervisors now consume one bounded capture
validator in the existing Cache evidence module, reusing the shared process
exit validator. No capture stream or cause is attached to these errors. The
behavioral suite and Fallow audit must pass again before publication.

## 2026-10-28: generated span catalog belongs in the source wave

The exact-head final check reported one stale CLI instrumentation shard after
adding `CacheEvidence.requireSupervisorCapture`. The protocol suite passed, but
its generated span catalog was omitted from the initial push. Regenerated the
existing catalog; the diff contains one span entry. Future span edits must run
`beep observability catalog --write` before publication. This is an introduced
metadata defect, not an inherited gate failure. Owner: this goal.

## 2026-10-28: package audit does not carry the caller's fixture opt-out

A second full package audit with the normal tool path passed 7,973 tests and
failed the same six command-plan fixtures that inherited the enrolled host's
cache references. Setting the opt-out only on the outer package audit did not
isolate its nested test process. The independent fixture-isolation PR moves
that default into the CLI Vitest configuration. The affected fixture suite
passes there; the complete package audit must be repeated after that fix lands.
The earlier missing ExifTool failures were caused by a reduced verification
path and did not recur with the normal path. No product-cache setting changed.

### Bind evidence after its final formatting

Final review found that two checkpoint hashes covered compact runner output,
while the committed native evidence was pretty-printed. Recomputed the bindings
over the actual retained file bytes. The source/test and retained conformance
bindings also verify. Hash retained evidence after formatting and recheck after
hooks; canonical object content is a separate contract from a raw artifact hash.
only reruns the six-case observation validator in the outer supervisor. There
is no accepted importer yet, and promotion remains closed. Extracting the full
relationship validator for worker, supervisor and importer use would prevent
validation rules from diverging and make edited transport evidence testable at
the actual import boundary. This is a source-review finding, not a demonstrated
escape or a new native failure.

## 2026-10-28: real native selection exposed inherited legacy flags

The signed reader fallback passed mocked spawn tests but an isolated real-runtime
control failed during native dry selection. Turbo rejects explicit `--cache`
combined with inherited `TURBO_REMOTE_ONLY` or `TURBO_REMOTE_CACHE_READ_ONLY`, even
for a dry run. Inspection now clears those legacy environment flags; forced local
execution also clears them. The real wrapper controls pass on both pinned native
channels, including a resolved-key remote-request positive control. Prevention:
retain native selection and execution proof alongside metadata/argument tests.
Owner: this goal. No production setting changed.

## 2026-10-28: schema compilation belongs at module scope

The signed-client publication preflight found three introduced
`no-inline-schema-compile` findings in access-mode and legacy-boolean parsing.
Hoisted named literal domains and their schema-derived guards to module scope.
Targeted Oxlint, 147 focused tests, package lint/type checks, and both seven-case
real native controls passed again on the corrected source. The unpublished
commit is corrected before pushing. No rule is waived. Owner: this goal.

### Effective cache mode must drive inferred signing role

Review found that role inference combined an explicit cache directive with an
inherited upload mode, even though the native directive outranks that mode. A
keyless local/read-only request was misclassified as a writer. The new boundary
test failed first; extraction of pre-task cache directives now follows that
precedence. Forwarded task arguments do not participate.148focused tests and
ten real native controls per channel pass; explicit writer/canary declarations
still require their signing key. The full default-root package audit/docgen
passed1125.9s/37.3s on the corrected source.
### Response header truncation does not provide receipt safety

Both direct-wire and proxy capture copied Content-Type response text into
conformance evidence, truncated to128characters. Two actual-server regressions
placed a synthetic credential, private path and artifact marker in parameters
and an invented subtype; both paths serialized the synthetic credential. Reuse
the registered MimeType schema to retain only a bounded canonical media type.
Drop parameters and unregistered subtypes before constructing receipts; preserve
the old receipt decode contract. Verify the two real capture paths and the
projection boundary before using them in a signed rollout.
### Reproducible source patch and native fixture boundary

The pinned 4.0.20 source release has root package version `0.0.0` in Cargo.lock
while Cargo.toml names `4.0.20`; `cargo test --locked` refuses that mismatch.
The reviewed patch synchronizes only the root metadata. No third-party dependency
version or checksum changes. The first full crate compile also caught a test
initializer missing the new optional policy field; that initializer is repaired.
Both failures preceded the passing crate and middleware tests. The expanded patch passes 45 crate and two middleware tests.

The standalone native conformance runner also omitted `--skip-infer` and
`--single-package`, although its fixture has no workspace packages. A separate
small CLI repair will align its invocation with the native protocol fixture.
Its regression must assert both flags; simulated cache responses alone cannot
prove the real binary entered that fixture. The adapter process lab uses both
flags and checks each pinned binary digest before invocation.

### Preserve storage faults through the adapter boundary

The initial passing process lab did not inject object-store faults. Source review
found that S3 throttling became a generic HTTP failure and a failed metadata HEAD
could become an untagged success. The patch now preserves explicit storage 429s,
reports ambiguous failed writes independently, and fails signed reads when
metadata cannot be read. Five injected-fault process controls pass. Adding the
settings parameter initially exposed an upstream tracing macro that wanted to
Debug-print the configuration; the parameter is explicitly skipped instead of
deriving a secret-bearing Debug implementation. No configuration entered logs.

A focused CLI test launched from the repository root with a package-relative
Vitest include found no tests. It was rerun from the package directory and all
16 cases passed. Use the package working directory for the existing config.

### Parent dotenv survives the host-default guard

The full CLI audit still had six environment failures after the host-default
fixture fix. A root Bun process had already loaded the checkout cache tuple;
the host guard could not remove those explicit values. Without signing changes,
the enrolled-root run reproduced six failures among437tests, while package-cwd
execution had no inherited tuple. PR #2346 clears only the test-worker cache
inputs; all561affected tests pass from the enrolled root. Run focused checks
through the same parent launch path as the full audit to expose this mismatch.

### Scan the adapter dependency closure independently

The repository security workflow scans bun.lock and did not cover the patched
Cargo lock. An exact-image Cargo scan found ten package names with findings.
Applicable updates and removal of unused server features cleared nine groups.
The remaining advisory describes an inline cursor and ReadBuffer absent from
the exact older block-buffer archive. Its source assessment has one expiring
advisory exception, an archive/version-set guard and an exhaustive256-value
caught-panic regression; changed or mixed locks get no exception. The configured
scan and all32 final-binary process controls pass. Make this independent Cargo
scan part of each candidate build. A first scan could not read a mode0600 public
lock through a capability-dropped container; copying only that public input to a
mode0444 read-only bind preserved the private source cache permissions.

### Decide strict startup before dotenv

Review found that cwd dotenv could introduce signed policy after the process
had already selected legacy telemetry. The new real-process control failed on
the previous executable, then passed after rejecting dotenv-only policy before
logger setup. Explicit signed startup still ignores the fatal dotenv trap and
emits zero logs. Legacy metadata fallback also retains its original static
warning without attaching an object-store error or request details.

A private verification driver initially lost a referenced source variable; it
never entered Cargo. A separate build guard then rejected the systemd child
compiler version. The corrected drivers use the tracked source preparation and
pin the actual installed compiler bin in child PATH, rather than relying on
RUSTUP_TOOLCHAIN across shim/default differences. Rust1.96.0 passes48tests and
the exact static executable passes all33process controls.

### Preserve backend fault causes beside transport outcomes

Actual wire controls showed that backend-unavailable response metadata was
discarded. A finite optional projection now retains the cause, validates its
method/status pairing, and records only invalid-evidence for unsafe claims.
Keep the independent never-written evidence: a known-written 404 must not become
a genuine miss because of a response label. Initial test assumptions incorrectly
required a header on exchanges without a response and treated a never-written
fixture as already written; corrected controls use observed responses and an
actual successful upload before the 404. Type checking also caught introduced
codec/opaque test construction mistakes; package-owned tests and lint/check pass
after fixing them. These are component controls, not production observability.
### Keep the plan summary aligned with retained proof

Review found stale focused-test/control counts and a pending-audit statement in
PLAN.md after the checkpoint was refreshed. The retained checkpoint already bound
148 tests, ten controls per native channel, and the passed default-root full audit
and docgen. Updated the summary from that source. A checkpoint refresh should
include its adjacent plan summary so readers see the same bounded claim.

### Use the package test runner and gate dependent steps

A post-merge replay was invoked with `bun test` against Vitest suites and failed
before collecting cases with “Vitest failed to find the current suite.” The
package-owned `beep:test` script then passed all 156 selected cases. A source-map
check also caught the inherited Cache barrel export; the old full-audit map was
preserved and a separate current integration map was added after focused tests
and lint/check. Driver verification failures must stop dependent commit steps;
use the package script and explicit subprocess exit checking. Neither failure
was a source regression or a passing proof.
### Reuse state after base integration

`yeet publish --push-only --reuse-verified` refused with “No reusable Yeet proof
state found” after the reviewed main integration changed the run-context path.
No push occurred. The retained full package proof, source bindings and current
package replay remain independently recorded. Use the existing constrained-
compute direct-push route after its ten-minute root-replay threshold, with exact
final-check skips and hosted proof retained; never manufacture a reusable state
file or copy an unrelated verdict into the new context.

### Compile test codecs once and refresh their canonical catalog

The collected publish wave found two introduced no-inline-schema-compile errors
and a stale CLI schema-catalog shard. All other collected cheap gates passed,
including Fallow with zero findings. The frozen full audit/docgen completed
first; its exact source map remains recorded. The repair reuses the existing
exchange codec, hoists historical JSON decoding and invokes the catalog writer.
Current-source focused tests, lint/type checks and both failed gates must pass
before publication. The initial detached submit also needed the documented
non-session user-bus environment; no fallback job or duplicate was launched.

The corrected tree passes both failed root gates, 236 integrated tests and
package lint/check. The canonical catalog writer changed only the CLI shard.
All four production source files and two other test/fixture files match the
frozen full audit; the
post-audit test-only change and imported main are recorded separately. Refreshed
the census after the shared source changes and verified all427 source digests.
The initial collected root replay lasted over ten minutes; publish through the
standing scoped-proof/direct-draft route with hosted broad proof retained.
- 2026-10-29 — The candidate runtime inherited host-dependent HTTP worker
  defaults, and an invalid ambient Tokio worker setting prevented startup.
  Source-pinned worker counts, an actual startup negative control, executable
  identity and measured cgroup caps now bind the synthetic fixture. The old
  candidate fails for the intended reason; the new one passes. The lab cleanup
  also skipped activating units when it only tested active state. It now stops
  every fresh owned unit and proves cleanup against an activating oneshot.
  These controls prevent fixture success from being mistaken for deployed
  launcher or R2 grant proof; no live service was changed.
### Refresh source-bound inventories after shared Cache changes

Integrating the signed-client and receipt-safety components left seven census
source digests different from the retained inventory, even though task counts
were unchanged. Reran the existing census/UTF-8 refresh recipe and checked all
427 source digests. The original native verification test snapshot also predates
the signing posture test change; preserved that exact proof separately, reran
240 integration tests and bound the current verification sources to this new
result. Native artifact bytes and protocol source hashes remain unchanged.
Source-bound evidence must be refreshed at its actual boundary after integration,
not treated as permanent qualification.

- 2026-10-29 — Existing proxy capture silently truncated after 5,000 events;
  an unreadable-body fallback could write an empty artifact upstream. The actual
  interrupted-request negative control observed one upstream tag with the old
  fallback and none with the repair. Explicit atomic request/byte/key budgets,
  bounded streamed replies and a sticky incomplete-capture failure now prevent
  truncated evidence from appearing complete. Seven actual controls and 256
  integrated tests pass. The proxy remains a lab tool, with production joining
  and transport-level completeness still outside this component's proof.

- 2026-10-29 — Hosted Fallow found introduced request-handler complexity after
  the capture controls were added (CC/cognitive14, CRAP56.3). A targeted current
  audit would have caught it before the push. Budget admission and recording
  now form a private local component, preserving transport behavior and all
  seven controls. Current tests and the zero-finding Fallow audit pass; no
  suppression or baseline waiver hides the finding.

- 2026-10-29 — Review found two historical evidence ambiguities: a shallow
  snapshot had carried current counts into the prior integration, and the red
  restoration digest did not name its uncommitted file state. The prior249-test
  result is restored from its immutable revision; the restoration now names its
  file/state and includes a digest-verified reconstruction without inventing a
  commit for that earlier working tree. Current implementation proof is separate.

## 2026-10-29: hosted assertion and interrupted-request repair

The completed Check run on PR #2352 found seven EV006 Boolean assertions in
`cache-conformance-lab.test.ts` and one interrupted-upload failure. The unit
aggregate and coverage guard failed because of that unit failure. Required
logs were read before any rerun. The Boolean assertions now use the canonical
polarity-preserving helper; no expected error payload was invented and no
baseline was enlarged.

The interrupted-upload control used fifty/one-hundred-millisecond sleeps. It
now observes the real request-body read and handler completion with bounded
Deferred signals. A capture snapshot must also reject admitted requests that
have no recorded event, including pending or interrupted handlers. The prior
count-only limit did not establish that completion invariant. Removing that
invariant or restoring the old empty-upload fallback separately makes the
synchronized control fail. Both counterfactuals restore exact source bytes.
Retain these controls in hosted and CPU-constrained native verification rather
than compensating with larger sleeps or retries.
- 2026-10-29 — PR #2353 cleanup review found that the first stop/show failure
  skipped other owned resources and fixture closure. Actual failure injection
  reproduced the remaining active unit. Cleanup now aggregates after all unit/
  process attempts; ExitStack closes logs, temporary data and storage even on
  failures. Three controls and the full current process replay pass. Success
  receipt publication follows teardown, preventing a later cleanup failure from
  publishing fresh passing evidence. No live R2 service was touched.


## 2026-10-29: Node CI cannot model a streaming Bun request lifecycle

The CI shard passed 4,164 tests but timed out the interrupted-upload handshake.
The Node Bun.serve shim buffers the body before dispatch, so waiting for handler
body-read before releasing the body deadlocks. Local Bun-only CPU controls did
not exercise this boundary. Reproduce using the actual Node entrypoint; run
this physical streaming assertion in a bounded real Bun child from Node rather
than changing the shim's declared behavior, skipping it, or increasing sleeps.
The repaired Node and Bun suites pass, V8 instrumentation passes, and guard
removals fail both the child control and its parent. Require both runtime paths
for future changes to this lifecycle control. No production proxy change.


## 2026-10-29: Successful unit shards did not settle response error-path coverage

PR #2352 passed its unit shards but failed Coverage Regression on conformance
wire lines/statements. The new streaming reply reader lacked a direct failed-
stream control; unusual HTTP statuses were also unexercised. Added focused
complete/empty/oversize/interrupted reply controls and unexpected-status tests.
Both runtimes pass; Node/V8 observes the previously uncovered paths. Keep the
committed floors and require the fresh hosted comparison. Do not infer coverage
acceptance from a unit-pass aggregate or lower the baseline to make it green.


## 2026-10-29: Post-format report bytes must be hashed after the commit hook

Review on PR #2352 caught two coverage-checkpoint references hashed before the
formatter collapsed a numeric array. The report data and source bindings were
unchanged, but the recorded byte digest was wrong. Both pointers now hash the
formatted report. Audit every path/digest reference in the current checkpoint
and completion audit against committed bytes after hooks, not merely source
file bindings or pre-format serialization. Preserve historical proof scopes.
## 2026-10-29: immutable hosted upload provenance preparation

The existing issuer authenticates owned isolated pilot bundles, but it does not
join production uploads to independently approved GitHub workflow identity.
The new bounded verifier is a component toward that join; no production
producer, signing activation or qualification is installed by it.

Local checks caught a complex orchestration function and a nested fixture
response selector. Separate metadata/binding checks and simpler fixture
responses restored zero Fallow findings without a suppression. The Effect
compiler also caught default-boolean inference and a missing named Effect
wrapper in the new test helper; both were fixed before publication.

ZIP listing text is an unsuitable file-type boundary. The implementation now
uses the standard ZIP parser with one literal member, regular-file metadata,
a bounded stream, strict ASCII, a ten-second child deadline and no extraction.
The parser normalizes embedded NULs in names, so original and normalized names
must agree. Real ZIP controls cover a valid JSON symlink target, overflow,
extra members and a NUL-normalized name. Prevent recurrence by retaining these
controls and immutable-digest red-first tests in the upgrade gate.

The existing GitHub text-content API decodes UTF-8 before returning text.
An exact workflow-byte approval must refuse lossy decoding. The first cohort
accepts only bounded ASCII workflow text. Even a matching hash over a
replacement-character string is rejected; removing the ASCII guard makes that
control fail. A Unicode profile requires raw-byte content verification.

The full package audit passed, then docgen rejected an invented `verification`
category. Use the canonical `validation` category already used by sibling
verifiers. The repaired code has identical comment-free syntax; current docgen
typechecks 3,551 CLI examples and package lint/type checking pass. Check the
canonical category vocabulary before a long audit to catch this earlier.

## 2026-10-29: preserve inherited decisions during unpublished replay

A prior documentation conflict resolution dropped inherited request-completion
and runtime section text while appending hosted-verifier notes. The code was
unchanged, but the packet must retain the complete governing decisions. The
unpublished replay now starts from the complete parent document and appends
only the original feature section. Prefix checks for SPEC, PLAN, SOURCES and
OPPORTUNITIES prove that no parent text is removed. Use explicit bounded
section extraction for append conflicts; never a DOTALL conflict-marker pattern
whose line wildcard can consume the body it is meant to preserve.


## 2026-10-29: Physical upload controls corrected a prototype result label

The unpublished hosted-upload model used `written`, but the adapter's actual
finite success vocabulary is `allowed`. Real HTTP upload controls rejected the
prototype rather than silently accepting a new label. Reuse the conformance
result domain; both pinned native clients now join their successful PUT bytes
to the exact executed task hash. Require a single settled upload, writer/tenant
attribution, successful coherent statuses and opaque tag presence; removing
three guards makes the intended negative assertions fail. A carried tag is
not proof of native signature validity or protected producer identity.


## 2026-10-29: Package audit also depends on committed goal manifests

The full CLI audit passed 8,093 tests but failed a Models eligibility timeout
and the knowledge-doctor HEAD/live manifest comparison; docgen passed. A focused
replay passed all Models tests and retained only the manifest mismatch. The
knowledge test compares committed HEAD with the live goal manifest, which was
being prepared in this worktree. Freeze the whole repository input profile,
commit the prepared manifests and replay both affected files without concurrent
edits. Preserve the original failure and do not call it a successful full run.

The clean-manifest replay passes all 35 tests in both affected files at the
committed component head, with unchanged package source. The original full-run
failure remains retained. The Models timeout did not recur in either isolated
replay; its cause beyond the observed elapsed-time failure is not claimed.


## 2026-10-29: Token ownership must not depend on an optional bucket-stack flag

A first draft added optional token resources to the bucket stack. Omitting that
flag on a later deployment could schedule their revocation. Before any deploy,
separated the token stack/stage from the existing bucket owner. The normal
plan still reports no changes; the explicit credential plan contains exactly
two tokens. No Worker or replacement bucket is needed. Missing, malformed,
past, excessive expiry and wildcard-bucket inputs fail before planning grants.
The resumed shell also lacked user-bus variables: restoring them made the
approved agent preflight pass without a desktop or human authentication path.


## 2026-10-29: A negative Git case does not need to initialize then delete a repository

The clean full CLI run passed 8,094 tests and docgen, including both earlier
failures, but one workflow test failed before its assertion while removing a
temporary `.git` directory that was already absent. Its disappearance is not
attributed without evidence. Start directly in a fresh owned non-repository
directory and require both real Git-backed checks to report the specific
Git-inventory failure. All twenty file tests pass in Bun and Node; removing
the production Git exit/truncation guard fails the intended assertion, and
exact production bytes are restored. Preserve both original broad-run failures.


The commit scanner treated public source/SPEC hashes as API keys when a JSON
map key contained credential-related words. Retain the same independently
computed hashes in explicit path/sha256 source records and name the prior SPEC
snapshot for its role-preparation phase. No scanner suppression or security
exception is added; post-hook verification still checks actual source bytes.


## 2026-10-29: Preview and credential creation have different authority

The bucket provisioning token can plan the bucket but Alchemy account-token
creation is Unauthorized. Stop that credential path rather than infer authority
from a successful plan. The existing authenticated Cloudflare CLI login has
account_api_tokens:create and can inspect its own created tokens; its OAuth
value reaches Alchemy only in memory. No new management token was requested.
Alchemy's interactive prompt cannot pass through the agent secret wrapper.
Retain default prompting, but accept an explicit reviewed-deploy --yes option;
plan/destruction and unknown flag forms reject it.

Cloudflare's live token API also rejects fractional-second expires_on values,
even though the date parses locally. Require whole-second UTC at the schema
boundary and keep the original failed requests. All six current configuration
negatives reject before planning. The new storage probe continues both cleanup
attempts after an injected delete or HEAD failure and never reports success for
those controls. Success receipts are written only after both real keys are
confirmed absent.

The full laboratory requirements include an uncached package; the storage
control needs only the already cached pinned boto3 dependency. Use that narrow
invocation rather than expanding the install or spending a new environment.


## 2026-10-29: Healthy vault reads do not establish item-creation authority

The approved agent item-creation command failed. A single required op-doctor
run passes on the service-account backend, and a fresh inventory confirms no
trial item exists. An inert template dry-run passes; it proves input shape,
not write authority. Stop that write path. The human-only bootstrap is prepared
outside the repository, resumes a matching item, refuses changed reference
files, and emits only a sanitized receipt. No desktop sign-in is attempted by
the agent. The already created Alchemy roles remain unassigned.


### Parent replay must stop on failed validation

- While replaying the unpublished producer work after PR2352 merged, a JSON
  union helper rejected an inserted parent report. The surrounding shell lacked
  immediate-error handling and continued into an unpublished replay commit.
- The rebase was aborted back to the saved clean tip; the complete patch backup
  remained intact. Replayed again with immediate-error handling, explicit
  preservation of all common reports and a staged conflict-marker check before
  every continuation. Both parent/own report sets and appended sections agree.
- Prevention: every mutation sequence must stop when its preceding validation
  fails. This recovery changed no cloud resource, credential or published ref.


### Reboot left the default GitHub credential route unavailable

- Bounded `gh api` and saved-credential lookups timed out, while direct public
  API reads succeeded. No credential value was emitted. An existing approved
  reference-only agent token passed the exact secret wrapper and repository
  push-permission query.
- A private process-scoped `gh` wrapper applies that reference only to GitHub
  children; raw credentials are not added to quality gates. The existing Yeet
  identity selector receives the same reference. Persistent GitHub settings
  remain unchanged. Remove the temporary PATH entry after its monitor ends.


### Schema-heavy tests and generated spans are publication inputs

- The collected cheap-gates run ended before pushing with two introduced reds:
  missing schema-derived property coverage in the two new producer test files,
  and a stale CLI instrumentation shard. Package audit and docgen alone do not
  establish these repository-level checks.
- Added generated hash/reference binding properties, proved each fails with
  its corresponding production guard removed, restored exact source, and used
  the canonical catalog writer. No schema-first inventory or baseline waiver.
- Read red lines as the collected run emits them; a tail showing later green
  steps is not evidence that earlier lanes passed. Retain all completed checks
  and attribute each red before repeating the publish wave.


### Base advancement during publication

- Publication correctly refused a stale base after PR2356 changed the shared
  CLI schema catalog. Merged current main, kept its Kimi account changes, and
  regenerated/checked the catalog from combined source. No own cache source
  or test byte changed. Package quick checks, instrumentation and cache audit
  pass; the current census is refreshed. No stale-base bypass was used.


### Effect property scopes and the collected publication gate

The next collected run found EV004 in both newly added schema-derived properties.
The first diagnosis incorrectly blamed their import; the exact detector identified
redundant whole-body scopes supplied by it.effect.prop already. Removed only
those wrappers, retained generated assertions, and verified both intended-failure
controls after the repair. The full policy scan has zero introduced findings.
Read the finding code before changing imports or weakening an inventory.

The dependency snapshot waited 392 seconds behind the publication lease, then
materialized and verified 213,133 files. Current code deliberately leases the
cheap gates because the schema catalog can peak near 12.6 GiB; push-first prose
does not justify deleting that memory guard. No admission bypass was added.


### Fresh full coverage exposes boundary and unreachable-path gaps

The final replay at `38415caaa5` passed every non-coverage gate and all
coverage test producers, then the new-file ratchet found two local gaps:
the hosted ZIP compressed-byte refusal was untested, and the upload join kept
an unreachable Option fallback after an exact-one length check. Added empty/
oversized archive refusals and use a tuple-schema guard to establish exactly
one exchange before destructuring it. Preserve both original coverage maps
and the complete failed receipt; do not add baseline rows to hide the gaps.


### GitHub child environments must isolate their credential references

The publication checks and push passed, then the private GitHub wrapper failed
while creating the PR: Bun had loaded unrelated op:// references from the
checkout, and op run attempted those references alongside the intended token.
The agent diagnostic and exact minimal GitHub route both passed. Restricting
the wrapper environment to the GitHub operation's required keys fixed the real
Bun-parent invocation, including a synthetic unrelated-reference control.
PR2358 was created through the already approved REST route and its canonical
monitor is healthy. No repository environment file or global credential setup
was changed. Preserve the original failure, doctor receipt and bounded child
environment probe.


### The root schema compiler rule is a separate gate

The first cardinality repair constructed its tuple inside Schema.is in the
upload function. The root linter correctly rejected that repeated compilation
with `beep(no-inline-schema-compile)`, although package quick checks and the
four focused policy/catalog checks passed. Hoist a named annotated tuple and
its derived guard to module scope, then replay the root linter directly. The
pre-push publisher was stopped with no push; retain its finding and source
identity instead of treating the earlier partial checks as complete policy proof.


### Assertion-dependent probes and internal verifier diagnostics

Review found that optimized Python could remove every grant-proof assertion.
The helper now refuses optimization before importing cloud clients. Hermetic
import-sentinel probes cover normal execution, -O and PYTHONOPTIMIZE=2 without
credential reads or network access. The verifier now uses the canonical error
mapper to retain typed internal causes. Auth, missing-resource, rate-limit and
identity-preservation tests cover it; runtime causes are not producer receipts.

CI hit HTTP408 during checkout before lint ran. GitHub refused the exact-job
retry while the workflow was running. This source repair will supersede that
head; keep the environmental attribution and do not hide it by restarting an
active proof.
### Contained native replay request

A native protocol replay refused an absolute request path outside the checkout
before execution: `Cannot read the bounded local experiment request.` The
request boundary intentionally accepts contained regular files only. Keep
requests and reports under the checkout-owned ignored proof directory, then
archive their bounded results privately. No native worker or cloud operation
ran in the refused attempt.


### Owned-graph negative fixture construction

The first new graph-dependency test failed before its assertion because it sent
already decoded `Option` values through a wire decoder: `Expected string` at
the cache-source field. Construct schema-derived typed task arrays with `.make`
for this internal fixture. The failed test log is retained; the implementation
guards and the original successful native protocol reports are unchanged.


### Pinned merge-gate invocation

An initial readiness command omitted the required PR and head arguments; it
returned usage before any merge. The canonical orchestrator gate requires
`yeet merge-gate <pr> <sha> --dry-run` for a read-only check. Supply the exact
verified head, then use the owner merge command only after that gate passes.
The unsuccessful invocation is retained privately; no merge bypass was used.


### Interrupted source commit hooks

The initial source commit stopped in pre-commit with `signal: terminated` from
the documentation and formatter hooks. Leak scanning and typo checks passed;
Git HEAD and source bytes were unchanged. Retain the first log and rerun the
normal hooks without disabling any hook, baseline or commit signing. Attribute
a repeated failure before changing code or retrying further.


### Full audit catches a stale native-summary fixture

The complete CLI audit passed 8,119 tests and failed one signed process-boundary
case because its fake native summary omitted `turboVersion`. Include the fake
executable's own pin in that observation, then assert the retained version and
all dependency task ids. Keep the production summary requirement unchanged.
The same package attempt's docgen exited 130 and supplies no passing result;
retain both logs and rerun the affected boundary and complete package proof.

The standalone CLI docgen replay also exits 130. All 3,560 generated examples
compile under direct Node and Bun launches, and the same compiler succeeds
through both Effect process backends. The default hosted Docgen gate passed at
the original head. Keep the local full-runner interruption unattributed while
checking executable resolution; do not change a compiler or platform service
on speculation, and do not report a whole-package pass.


### Resolve current Effect HTTP leaves before a transport prototype

- A disposable private-network transport probe selected two obsolete HTTP
  import locations and failed before sending any request. The pinned package
  exports use the dedicated `effect/http/HttpClient` and
  `effect/http/HttpClientRequest` leaves. Read the installed import map and
  implementation before writing the probe; guessing historical module paths
  added avoidable retries. Exact original errors remain in private diagnostics
  and are not attributed to the backend. The public ledger also enforces the
  retired-path policy in prose, so describe the mistake without repeating a
  prohibited import location.


### Docgen child interpreter compatibility

- While replaying the producer-capture package audit, full Docgen twice
  returned exit 130 at example typechecking. Direct compilation of all 3,560 generated
  examples and both Effect process backends passed. A complete launch without
  `bunx --bun` passed; a later default before/after pair both passed, retaining
  the intermittent nature of the failure. The CLI script now relies on the
  executable's Bun shebang and preserves the compiler's own Node interpreter.
  Prevent recurrence by qualifying actual full command launches, not only the
  generated compiler input or mocked child processes. No gate is disabled.


### Discover scheduling commands before a status probe

- A read-only `bun run beep scheduler status` probe returned
  `Unknown subcommand "scheduler"`. No scheduler state changed. Consult the
  root command list and the owning quality command's help before constructing
  a status command; command discovery would have avoided this interruption.
### Existing native-addon runtime warnings

Publication exposed two `no-global-process-runtime` warnings in the KG addon
bootstrap and its Windows-path test. The synchronous bootstrap uses the
existing sanctioned `currentHostPlatform` constant; the test pins that existing dependency through its scoped module
mock. The Windows test no longer mutates the process platform.
Keep this repair in a separate small PR; no cache configuration is changed.

The first package audit caught an introduced `missingPipeableSignature` error
from an extra installer argument. Remove that argument and keep the existing
one-argument API; pin the existing platform helper in the test instead. The
failed audit is retained and no diagnostic or hook is waived.

A subsequent audit rejected an async mock factory (`effect(asyncFunction)`).
Use the test framework's scoped module pin and lift the dynamic import through
`Effect.promise`; keep both failed audits and rerun the complete package check.

Hosted policy found EV011 on the direct `vi` import from `vitest`. Import the
same API through the pinned `@effect/vitest` export-star entrypoint and rerun
the policy check; do not add a baseline finding or waive the detector.
### Private socket test boundary attribution

- The first real socket test reached the upstream and preserved its rejection,
  but expected an absent result for a contradictory success header. The existing
  classifier correctly preserves `invalid-evidence`; the assertion now checks
  that finite failure rather than erasing its cause. The original failed run is
  retained privately. A nested client layer also failed the strict provision
  diagnostic; the fixture now acquires the platform agent in its own scope and
  supplies the service value, preserving the lifecycle boundary.

- The additional real-socket exhaustion assertion initially nested an Effect
  result inside predicate/assertion calls. The compiler required the equivalent
  Result pipe; the canonical helper form passed lint/check and the full package
  replay. Keep runtime refusal and evidence-invalidity assertions together.


## Current real-pilot preparation friction

- Reusing an older dependency snapshot because its lockfile and root manifest
  matched was insufficient: the actual installed tree differed. The existing
  guard correctly refused it; regenerate through the canonical dependency
  materialization command and compare the complete tree identity.
- The active verification checkout had210 additional native identity-lint inputs
  relative to a clean source worktree, including compiled utilities and coverage
  reports, although command and configuration matched. Use a clean registered
  runner for like-for-like comparisons. Any later input narrowing still needs
  semantic invalidation proof; no input was discarded here.
- The new activation fixture reserialized JSON and changed formatting. Because
  the selected command runs `biome check`, the proposed enabled config made the
  check fail. An actual formatter comparison identified this introduced fixture
  error. Preserve the original formatting, change only the cache literal and
  refresh the exact activation reference. Failed observations remain retained;
  the corrected proposed-launch diagnostic is running and grants no qualification.


### Native transport proof and in-process coverage

The existing native socket lifecycle passes through a Bun child during Node
coverage, leaving the new common listener function unexecuted in Node/V8.
Actual focused V8 evidence showed 34/35 functions and 118/129 lines. Add explicit
constructor-double controls for modes, wrong-address refusal, bind-cause
preservation and cleanup; keep the physical Bun lifecycle as transport proof.
The first controls tried to spy on an immutable ESM export and used a forbidden
native HTTP import. Use the framework's module replacement and existing Effect
server interface instead. Missing target options and the mock's filesystem
error channel were corrected before both runtimes passed the three controls.
Both runtime integration runs now pass 51 tests and package lint/check passes.
Include json-summary with LCOV to judge the statement metric explicitly;
function/branch/line counts alone are not the full committed ratchet. Preserve
the original failures, unchanged implementation and unchanged coverage floor.

Source-removal controls reject removal of the Unix-address guard and owner-only
socket chmod for the intended assertions; exact original bytes are restored.
Vitest truncates assertion strings in JSON failure messages, so the receipt
wrapper verifies the unique test plus identifying assertion prefixes rather
than requiring untruncated prose. Both providers now prove all four fixture
metrics at 100%, and the proxy exceeds its existing floors.


### Source aliases and owned upload execution

A synthetic filesystem probe reproduced a confinement gap: a private file under
source `.beep/cache/experiments` was absent at its original host path but readable
through `/fixture/.beep/cache/experiments`. Read-only mounts are not read denial.
Private supervisor and experiment storage now lives outside all input mounts;
the source-visible alias is refused before writing a request. Retain original
observations and require a fresh actual native boundary proof. Five current
qualification records are excluded; none grants reuse and no state was changed.
See `closed-producer-upload-checkpoint.json` for exact source bindings and limits.

The implementation check caught use of removed Effect v3 `Effect.if`; the current
Effect source and Option dispatch provide the supported equivalent. Five nested
Redacted calls were rewritten to their pipe form. A missing test value import was
fixed, and private storage preparation was extracted as its own resource concern
to meet the unchanged Fallow cognitive limit. No floor or suppression was added.
The first deliberate request-guard removal produced a null serialized Effect
failure in Vitest JSON. Assert that no worker started before matching the typed
result; both source-removal controls then fail with clear assertions and restore
the original source bytes exactly. These are controlled unit counterexamples,
not protected native producer proof.


## Current real-pilot preparation friction

- Reusing an older dependency snapshot because its lockfile and root manifest
  matched was insufficient: the actual installed tree differed. The existing
  guard correctly refused it; regenerate through the canonical dependency
  materialization command and compare the complete tree identity.
- The active verification checkout had210 additional native identity-lint inputs
  relative to a clean source worktree, including compiled utilities and coverage
  reports, although command and configuration matched. Use a clean registered
  runner for like-for-like comparisons. Any later input narrowing still needs
  semantic invalidation proof; no input was discarded here.
- The new activation fixture reserialized JSON and changed formatting. Because
  the selected command runs `biome check`, the proposed enabled config made the
  check fail. An actual formatter comparison identified this introduced fixture
  error. Preserve the original formatting, change only the cache literal and
  refresh the exact activation reference. Failed observations remain retained;
  the corrected proposed-launch diagnostic is running and grants no qualification.


### Native transport proof and in-process coverage

The existing native socket lifecycle passes through a Bun child during Node
coverage, leaving the new common listener function unexecuted in Node/V8.
Actual focused V8 evidence showed 34/35 functions and 118/129 lines. Add explicit
constructor-double controls for modes, wrong-address refusal, bind-cause
preservation and cleanup; keep the physical Bun lifecycle as transport proof.
The first controls tried to spy on an immutable ESM export and used a forbidden
native HTTP import. Use the framework's module replacement and existing Effect
server interface instead. Missing target options and the mock's filesystem
error channel were corrected before both runtimes passed the three controls.
Both runtime integration runs now pass 51 tests and package lint/check passes.
Include json-summary with LCOV to judge the statement metric explicitly;
function/branch/line counts alone are not the full committed ratchet. Preserve
the original failures, unchanged implementation and unchanged coverage floor.

Source-removal controls reject removal of the Unix-address guard and owner-only
socket chmod for the intended assertions; exact original bytes are restored.
Vitest truncates assertion strings in JSON failure messages, so the receipt
wrapper verifies the unique test plus identifying assertion prefixes rather
than requiring untruncated prose. Both providers now prove all four fixture
metrics at 100%, and the proxy exceeds its existing floors.


## Review deliberate resource lifetimes before changing a test baseline

The first socket draft publication stopped on a stale generated instrumentation
shard and seven new test-rule findings. Regenerate the catalog through its
owner. Replace the hand-written Option assertion with the canonical helper,
preserving its payload. The other findings concern four deliberate shorter
scopes and two physical filesystem subjects. Four scope-removal controls fail
the cleanup assertions, so retain those lifetimes with explicit source-bound
reasons. Preserve every existing inventory judgment and coverage floor.

The initial targeted replay guessed two nonexistent sibling filters and selected
only the four socket tests. Reuse the owner's recorded file list and assert the
actual four-file, 51-test scope before reporting a broader pass. The corrected
Node and Bun provider runs both meet that scope.


## Signed supervisor runtime discovery

- While refreshing the real signed pilot, the unchanged supervisor exited1 at
  toolchain discovery. A private observer retained only static error classes
  and source locations. Its pinned Bun file was named `bun.native`, with no
  `bun` command in the mounted search path. An actual private-network probe
  exited 127 with the original mounts and exited 0 with exact private binary
  aliases, reporting the expected Bun and Node versions. Keep aliases in the
  supervisor and test their complete mount arguments; never share a host tools
  directory or weaken the namespace. No current qualification was obtained.
- The first added assertion used an unavailable Array helper. The installed
  Effect declarations and canonical source expose `Array.window`; use that
  primitive and retain the failed tests as introduced harness evidence.

- The fixture's existing spy variable named `process` shadowed the runtime
  process used by the new assertion. The compiler and runtime tests exposed it;
  renaming the spy preserved the fixture API and restored the typed assertion.

- Distinguish an added tools directory from the existing read-only system and
  source mounts in evidence claims. Overbroad wording was corrected before the
  first push; the superseded publication wave is not passing proof. Describe
  additions relative to the reviewed mount baseline to prevent this ambiguity.


### Runtime-alias regression fixture complexity

Normal publication rejected the new test callback because repeated optional
argument fallbacks increased cognitive complexity. Decode required arguments
once through Option and reuse the resulting array; absent arguments now fail
the fixture explicitly. Both18-test runtime suites, quick package lint/check
and targeted Fallow audit/health pass. Retain the rejected publication and
unchanged baselines. The earlier full package replay covers the production
launcher and prior fixture bytes; fresh final proof must cover the new fixture.


### Checkpoint reference refresh after fixture edits

Main integration exposed an audit reference still bound to the earlier launcher
checkpoint bytes after its fixture proof was updated. Refresh that exact report
digest after formatting and retain both prior SPEC identities. Preserve the
landed graph/capture evidence and the launcher evidence independently; neither
component grants qualification or signed production authority.
## Deterministic contained-directory error coverage

- PR #2361's current final repeat passed 8,114 tests with 5 skips but lost the
  existing FsGuards file floors. Its implementation is identical to the passing
  producer-capture lane; actual lcov shows 0 executions of the parent-creation
  error callback versus 1 incidental execution in the passing lane. A controlled
  filesystem creation failure now proves the original platform cause, contained
  root/target/path, and refusal before writing. Both runtime suites pass 34 tests;
  targeted Node V8 records 1 execution of that callback. Retain the floor and use
  a deliberate error-path fixture rather than incidental concurrent filesystem
  behavior. The full package audit and documentation pass; fresh final and
  hosted acceptance remain in progress.


### Strict policy fields need an explicit exec lane

The ordinary adapter intentionally strips policy fields from its environment.
Reusing that entrypoint for a signed experiment would discard its strict mode,
namespace and role. Add an opt-in pinned exec lane and inspect the actual child
environment with inert credentials. Removing the checksum refusal or admitting
the artifact key fails the corresponding control. These checks cover the exec
boundary; preserve separate real-process, resource, grant and R2 proof.

## 2026-10-29: keep runtime capabilities independent from later fixture environments

The new owned-host lifecycle control initially failed with `KeyError` before
startup because a later native fixture had rebound the loop variable holding
the adapter environment. The adapter units and storage fixture were cleaned up.
The driver now snapshots each role's explicit environment at launch and passes
that snapshot to the host control. Separate capability snapshots prevent later
client fixture construction from changing backend launch inputs. This was an
introduced test-driver failure, not R2 grant or deployment evidence.

## 2026-10-29: keep controller probes on the supported command runtime

A bare-Node controller probe reached the existing admission runner and failed
with `Bun is not defined` before adapter startup. The command tools are owned
by the canonical Bun CLI; the controller's actual success, callback-failure and
interruption proof uses that route. Node Vitest supplies the repository's test
platform setup and passed the focused integration. The bare-Node invocation is
retained as an unsupported probe, not a Node deployment or native-client pass.
The controller documentation now states its Bun CLI owner explicitly.

## 2026-10-29: distinguish empty coverage output from measured coverage

The first focused coverage filter used a repository-relative path against the
project configuration and matched no files. Its summary contained only
`Unknown`, so it was not accepted as coverage evidence. A suffix filter matched
exactly `Cache.adapter.ts`; the report names that file and measures 98.14%
lines/statements, 94.44% branches and 100% functions. Always require an actual
file row before treating a successful coverage command as proof.

The schema policy scan also found two new codec-heavy tests without generated
coverage. Both now include schema-derived pin/storage properties and the scan
passes with no introduced advisory; no exception or floor was added.
### Combined prerequisite source and file-confinement repair

Repeated same-owner prerequisite merges conflicted only in appended goal
decisions, report lists and derived SPEC hashes. Preserve both sides and their
source-bound facts, then perform the expensive integrated proof once in PR2367.
The original branches and receipts remain recoverable until combined acceptance.
One normal publisher waited603seconds without admission, was interrupted through
its exact owning process, and exited130 before the prepared commit was pushed
through the standing constrained-compute route. That old-source escape is not
proof for the newer combined source; fresh normal and hosted acceptance remain
required. Four exact superseded pull-request runs were cancelled and verified
terminal, without changing runner capacity or touching unrelated runs.

The private-file probe found a real alias gap: absent original host paths did
not stop reads through the guest checkout. Move private scratch outside all
source mounts instead of weakening the probe. The current worker imports pass
in a real isolated bwrap/Bun process, supervisor controls cover the storage
refusal and cleanup, and removal of that guard fails the intended control.
These component observations do not replace a current native comparison matrix.
See `private-pilot-storage-checkpoint.json` for source bindings and exact scope.


### Include orchestration consumers after storage changes

The earlier76-test focused replay missed the orchestration file. The full
package audit and CI each reported15 introduced failures because its cleanup
checks still read `.beep/cache/experiments`. Include filesystem consumers when
a storage boundary moves. Observe the allocated private directories and test
their removal directly; do not restore source-visible storage to satisfy an
obsolete assertion. The deliberate scope-removal control fails the new cleanup
check. The first filesystem observer also needed a named Effect.fn, caught by
the package type check and repaired before publication. Existing floors and
qualification state remain unchanged.


### Exercise new containment refusals before full coverage

The current CI run passed its tests but lost three per-file coverage floors:
the new private-storage refusal had zero executions. Test a deliberately
source-visible allocation before starting a task, including cleanup after the
refusal. Its source-removal control fails as expected. Preserve the original
floors and use fresh canonical/hosted coverage as acceptance.

The first diagnostic tried an unavailable unscoped Istanbul package and raw-map
equality. Reuse the repo owner's `@vitest/istanbul-lib-coverage` fork and canonical
normalizer: derived line metadata and serialized infinite columns need that
normalization. Keep the diagnostic distinct from a new hosted proof.


### Integrated producer publication gate attribution, 2026-10-30

The current producer's normal cheap gates found four introduced inline schema
compilations (the approved storage-host guard and three test codecs), four new
Effect Vitest detector rows, and a stale repo-cli instrumentation shard. The
focused 142-test runtime replays and quick package lint/check did not cover
these root policy gates. Both owned source proofs were stopped before repairs;
the interrupted complete package audit is not a passing receipt. Hoist the
codecs/guard, review each detector row, and regenerate catalogs through their
canonical writers before a fresh publication/final proof. An initial catalog
invocation only checked drift; the documented writer requires `--write`.
Preserve every policy and coverage floor; no cache or runtime activation.


### Producer Fallow preflight and documentation feedback, 2026-10-30

The normal publication at `2e4f001e7f` completed the collected cheap tier with
only Fallow audit/health red: the upload validator had cyclomatic complexity
30, one preflight test had cognition 17, and dependency descriptor reads formed
one introduced clone group. Nothing was pushed. The complete package attempt
was stopped before editing and is not passing proof. Focused Fallow should run
immediately after adding approval predicates and scenario setup, before the
expensive inventory/full-package replay. Whole canonical URLs, one verified
dependency reader and independently named preflight cases remove the findings
without a threshold change. A generated valid-byte replacement property also
fails at its intended rejection assertion when the digest guard is removed;
exact source restoration is verified. The observer initially expected a Vitest
message, while the canonical helper uses Node strict equality; preserve the
actual failure and fix the observer, never count an unrelated failure.

The first regenerated documentation inventory found one newly introduced
example-import violation: `@beep/schema` was used instead of its stable
`@beep/schema/Sha256` leaf. Compilation alone did not check that policy. Fix the
example import and regenerate through the canonical writer; do not edit the
generated issue away.


## Coverage source and runtime fixture recovery, 2026-10-30

- Hosted coverage exposed two unreachable post-decode guards and absent owned
  upload/workflow paths. Use each trusted caller's exact schema decoder, and
  add meaningful transport, admission and refusal controls; retain every floor.
- An include filter prefixed with the repository path yielded empty reports
  because the workspace coverage owner uses a different root. Assert the exact
  three report members before comparing counters; a green test exit alone is
  not coverage proof.
- The first upload fixture used a native server factory; hosted directive
  policy subsequently rejected its scoped suppression (see the receipt below).
  ESM namespace exports cannot be redefined directly; hoisted Vitest spying
  needs its direct mocks import and the actual original implementation.
- Formatting removes an inferred Boolean parameter annotation that the Effect
  function diagnostic still needs. A schema-derived Boolean type retains an
  explicit typed boundary through formatting. An admitted-route fixture also
  supplies its declared MemoryStats service even when admission is controlled.
- The two previously opaque JSDoc child exits pass as exact serial commands.
  Preserve their failed full-final receipt; the cause of termination remains
  unproven and does not justify editing unrelated packages.


### Pre-push policy coverage for fixture edits

Quick package checks did not run root inline-schema or Fallow policy. A normal
publication spent 598 seconds before rejecting three repeated activation
codec compilations and one extended fixture exit rule. Run the narrow root
policy and changed-file Fallow controls during fixture editing, then retain
the normal publication gate. Module-scoped codec reuse and named match cases
fix the findings; no threshold, fixture assertion or coverage floor changes.


### Hosted directive policy catches a fixture interop exception, 2026-10-30

PR #2368 at ac7f passed the complete package audit and normal publication, but
Heavy / Lint Policy rejected the test-only `nodeBuiltinImport:off` directive.
The root directive collector rejects next-line exceptions even with an adjacent
reason; quick package checks did not cover it. This was introduced by this PR.
Use Effect's existing `NodeHttpServer.layerTest` for the upload composition
fixture and route its agent to an ephemeral TCP port. Keep its fixed socket-path
assertion and actual PUT/failed-graph controls. The separate private-socket test
continues to prove native Unix transport and lifetime. Remove the import and
directive rather than exempting another file. Replay `beep quality tsgo-rules`
before the next normal publication; retain the failed hosted log and require
fresh source-bound proof. No production policy or coverage floor is relaxed.


### Quiet lint hides a source-owned warning, 2026-10-30

The successful normal publication at 001f summarized one root oxlint warning.
A nonquiet replay attributed it to this component's adapter fixture reading
`process.platform` at its Linux-only test gate. Reuse `currentHostPlatform`
instead; current Node/Bun suites pass 153 cases each and complete nonquiet
root oxlint reports zero warnings/errors. Read warning locations before calling
a component final even when a quiet gate exits zero. Preserve the successful
publication's attempt-start head separately from its actual pushed commit;
a post-commit full receipt remains required.


### Exact refusal assertions expose masked coverage, 2026-10-30

The full final at 401 passed every lane except coverage: one statement each in
Cache.adapter and Cache.workflow.github remained uncovered. Generic failure
assertions hid a hosted fixture encoding runtime Option values as unknown JSON.
Encode the wire schema before mutation and assert the intended provenance error.
Stream.mapEffect already emitted singleton chunks; replace the dead local tail
queue with the explicit upstream rechunk(1) contract and retain final-pull refusal.
The corrected 45-case suites pass on both runtimes, both modules measure 100%,
and removing either refusal guard fails its focused control. Full current-head
package/final/hosted proof is still required; coverage floors stay unchanged.
