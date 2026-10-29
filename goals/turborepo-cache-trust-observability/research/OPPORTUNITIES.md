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
