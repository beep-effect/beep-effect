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
