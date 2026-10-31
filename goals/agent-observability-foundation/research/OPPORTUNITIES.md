# Implementation friction and opportunities

These receipts describe development friction, not changes to acceptance gates.

## O1 — Distinguish initiative lifecycle from phase status at authoring time

While activating the packet, its initiative lifecycle was valid (`active`) but the P0/P1 phase statuses also used `active`. Full CLI tests rejected `phases[0].status`: the phase domain is `pending | in-progress | complete | superseded`. The packet now uses `in-progress` for those phases, with lifecycle still active. A cheap packet validation step or a phase-specific canonical writer would catch this before a broad package run. The existing `goals set-status` writer addresses initiative lifecycle, not phase transitions.

## O2 — Expensive package checks discover cheap packet errors late

The CLI package run took 1,326.09 seconds and reported 7,919 passing tests and seven failures. The failures included the phase error above and two inventory fixtures read while this work was still changing. Keep source stable during final proof and run the focused touched-boundary/packet checks first. The final exact-source package gate remains required; this is not a waiver.

## O3 — Live-filesystem/HEAD equality requires a committed packet

`test/knowledge-doctor-evaluators.test.ts` compares every live goal's manifest text with the `HEAD` tree. A newly authored local packet makes this assertion fail even when its schema is valid. The focused rerun passed seven assertions; the remaining assertion is the new packet's absence from HEAD. Staging alone does not satisfy it. Preserve this test and rerun it after the reviewed delivery commit; do not remove the packet or weaken the parity assertion to obtain a green working-tree result. A clearer precondition diagnostic would help local agents distinguish a dirty-tree precondition from a production code regression.

## O4 — Quality-step labels carry ambient credential-session decoration

The root lint-policy continuation test expected the raw `lint` label, while the runtime emitted `lint (op run)`. The same test module already owns `policyLabelKey` specifically for this ambient decoration. Reusing it in the failing assertion preserves the test's command, failure-code and continuation checks without requiring credentials or changing runtime behavior. The focused regression now passes.

## O5 — Kernel limit text is padded; refusal diagnostics must survive service logging

The first real launch rejected valid Linux resource limits because `/proc/self/limits`
pads its Units column with trailing spaces. Accept horizontal padding while still
requiring finite exact numeric limits. The default Effect error report went to
stdout, which the bounded proof intentionally discards, leaving no refusal reason
in the journal. Emit a content-free reason to stderr and disable automatic error
rendering at this private process boundary. Preserve typed safe errors, ownership
checks and ceilings. The actual entrypoint proof must cover startup, failure and
restart; a fixture-only server would miss both defects.

## O6 — A small typecheck scope can throttle itself into a deadline

The CLI source typecheck hit its 120-second deadline with about 3.13 GiB charged
peak memory under MemoryHigh=3 GiB, MemoryMax=4 GiB and CPUQuota=100%. It emitted
no diagnostics before timeout. Treat that result as incomplete, retain the log,
and admit one larger bounded verification after the preceding job is stopped.
Do not confuse a resource deadline with source success or a kernel OOM.

## O7 — An empty directory page can conceal an incomplete source cycle

While connecting the scanner to periodic collection, its latest page could contain
no file outcomes even though a preceding page encountered a partial tail, failed
read or unread backlog. Treating that page as idle would make health falsely
reassuring. Retain bounded read counters for each root's traversal, record outcomes
only for their matching page/cycle, and expose remaining sampled bytes for accepted
pages. Tests now carry partial/backlog evidence through a later directory-only
page. Durable accepted positions remain separate from volatile traversal health.


## O8 — Bounded delivery traversal cannot infer idle from an empty page

A reconstructed page can contain only rejected frames. Advancing past it without
an exportable event is progress, but it does not prove the retained population is
idle. The mixed scheduler now advances its checksummed cursor through such pages
with at most two page reads per selection. Runtime health reports `scanning` when
retained pages exist and the bounded pass has no event outcome. Native and
reconstructed pass observations share explicitly named delivery metrics; neither
is an independent fleet coverage denominator.


## O9 — A valid Phoenix filter can silently query the wrong JSON key

The actual-image aggregate check initially returned zero native records even
though REST and exact read-back verified all three. Phoenix returns flattened
REST keys but its filter language treats a dotted subscript as a literal key.
The nested `attributes["ai_metrics"]["stream"]` query returns the expected three.
The verifier now asserts both semantics. Use tested query contracts and explicit
legacy/unknown populations; do not interpret zero from an unqualified filter as
absence. Mixed native/reconstructed aggregates also reduced P50 from 100 ms to
zero and displayed 275 known tokens where complete records totalled 270. These
are interpretation hazards, not performance gains or complete usage evidence.

### Launch test isolation

Four lifecycle tests failed because a single `it.layer` scope shared one SQLite
journal and test clock across cases: missing-preparation checks saw an earlier
launch, capacity configuration conflicted, and retirement leaked into later cases.
Use a fresh scoped SQL layer per independent scenario, matching the existing
retention tests. Repaired cases plus worker/backup/retention regressions: 38 passes.
This was a test-isolation defect, not an OOM or evidence of runtime data loss.

### Verification friction: default parameters in Effect test factories

The launch HTTP fixture's default boolean parameter was treated as `any` by the
Effect strict-boolean diagnostic inside `Effect.fn`. An explicit boolean type
fixed that check but conflicted with Biome's noInferrableTypes rule. Comparing
`enabled === true` satisfies both without suppressions. An initial text edit
missed the formatter's single-line ternary; assert replacement matches before
starting another gate. Build and focused diagnostic checks should precede full
package reruns when correcting this class of failure.

### Short-lived process diagnostics lost service attribution

A repeated actual-entrypoint proof correctly refused the unsafe creation mode,
but `journalctl --user -u <unit>` did not contain its reason. A bounded time-window
query found the exact refusal message with PID metadata but no user-unit, cgroup
or invocation attribution. The verifier must not infer the intended refusal from
exit status alone. Each disposable invocation now writes stderr to a precreated
0600 file in an owned 0700 diagnostics directory; refusal checks read at most
16385 bytes and reject diagnostic overflow. The existing process file-size limit
also bounds the log. Production worker error handling was not changed.


### Private client proof: capture services and bound failure fixtures

The new context read initially leaked SqlClient into the HTTP handler's required
environment. Capture the journal service at factory construction and provide it
to the deferred read, matching the existing worker composition. A typecheck caught
this before execution. The lost-acknowledgment test then used an infinite response
that prevented the Bun server's graceful shutdown from completing. Holding the
response for one second (past the 250 ms client deadline) proves ambiguous delivery
and exact retry while allowing bounded fixture cleanup. The four focused files
now pass all 24 tests. Neither failure was a memory-limit kill.

The client imports the platform HTTP adapter at runtime. Move that existing
dependency from devDependencies to dependencies and regenerate the lockfile; do
not rely on a development-only install to conceal a runtime requirement.


### Acquired child lifetime must end on a failed open

Observing spawn before negotiation exposes an earlier failure point than the
adapter's normal initialized-session cleanup. A caller may catch open failure
while its parent scope remains alive. Own the entire acquisition in a child scope
and close it on failure/interruption, rather than relying only on eventual parent
shutdown. Actual subprocess tests assert isRunning=false before leaving the caller
scope for all four adapters, plus timeout and interruption. Observation errors may
still represent committed facts, so cleanup does not authorize another launch.


### Collector restore and producer acknowledgment are separate histories

An older collector backup can legitimately regenerate a receipt with the same
fact digest and a different local recorded-at value. Do not overwrite the producer's
original acknowledgment or call the event absent: retain the original receipt,
report a recovery conflict, and keep process launch permission consumed in the
independent store. The actual SQLite restore regression now exercises this case.
Lost acknowledgment without restore remains recoverable through exact replay.


### Acknowledgment corruption must not suppress process closure

A producer may be interrupted while persisting a transport acknowledgment. Reading
all receipt files as a prerequisite for appending local lifecycle facts made that
unrelated damage suppress later shutdown evidence. Read and validate local facts
separately for appends; keep receipt integrity strict for reconciliation. The new
regression preserves a torn receipt while recording SessionBound and Finished.

### An already-dead child can reject the adapter close protocol

Do not stop observation finalization merely because close fails on a killed child.
Attempt cleanup, verify isRunning=false, then retain an outcome supported by the
actual exit result. If the numeric result is unavailable, record unknown. A real
synthetic child killed with SIGKILL now exercises this path; no successful task
outcome is inferred from shutdown.

### Whole-CLI typechecking needs a measured resource envelope

The 6 GiB test-typecheck envelope was too small and caused a service-level OOM.
The resumed job used an external early-stop guard and larger emergency ceiling.
It ended at the five-minute deadline/12 GiB growth threshold without another OOM;
it is not a passing gate. Keep the focused passing source/runtime proof separate
from the still-unqualified full CLI check, and schedule its next broad run with
adequate measured host headroom rather than repeatedly triggering the same limit.


### Owner exit needs an explicit non-launch recovery surface

A live owner's periodic flush cannot reconcile after it exits. The actual-command
proof now creates four local facts with zero receipts while intake is paused, then
recovers them through a fresh CLI process after collector restart. Recovery is
limited to existing immutable facts; no profile, launch grant or claim creation
is available. Wrong epoch/enrollment and torn receipts refuse before recovery.

### Periodic transport acquisition needs a per-attempt scope

Review found Layer.build of the platform HTTP agent in every owner flush while
finalizers belonged to the entire session. The platform source registers agent
destruction on scope close. Wrap each flush in its own Effect.scoped so cleanup
does not accumulate with retries. This is a lifetime correction, not a measured
leak diagnosis or explanation of the earlier service-limit OOM notifications.


### The enclosing HTTP layer can contaminate a private socket client

The registered-command proof first passed without the full command group's HTTP
service. Adding that required service revealed a runtime failure before any
recovery receipt. A focused regression with NodeHttpClient.layerNodeHttp in the
enclosing layer reproduced the private client's unavailable context; the prior
four client scenarios passed. NodeHttpClient.layerNodeHttpOptions composes the
shared layerNodeHttpNoAgent, so its construction can reuse an enclosing layer's
client. Apply Layer.fresh to the complete options layer. The regression then
passes and also checks two private socket destinations with separate request
counters. The actual registered-command proof must be refreshed with the complete
service environment; a leaf-command fixture alone did not expose this defect.


### Synthetic setup bypassed the operator enrollment path

Earlier command fixtures constructed enrollment files and hashes themselves.
Explicit initialize-claims/enroll operations now own that behavior, and the actual
registered-command proof invokes them before serve. Keep initialization separate
from enrollment so an absent independent fence cannot be silently recreated by
startup or reconciliation. Preserve partial setup output as evidence, with sync
and refusal tests, rather than deleting it to make a retry appear successful.


### Publish independent starts without claiming all activity is measured

The enrolled claim store can now supply a bounded independent population for an
explicit claim-creation cohort. Preserve unresolved starts as unknown, and show
positive starts separately. Historical acknowledgments belong to a different
boundary from current collector and Phoenix state. Two agreeing scans make mutation
visible, but cannot detect administrative rollback; operational backup/recovery
ownership is the next qualification boundary. The real command proof now exercises
both default human output and JSON, catching an omitted boolean-flag default that
JSON-only verification missed.


### Host readiness did not prove container tailnet resolution

The first installed live canary received local acceptance but did not appear in
Phoenix. Collector metrics reported failed sends; an exact-image bounded network
probe reproduced `socket.gaierror: Name or service not known` in Docker while the
host health check succeeded. A container-only host mapping using the host-resolved
tailnet address repaired the probe with TLS verification intact. Preserve failed
journals/queues and never convert acknowledgment into visibility or blindly resend.
Future route qualification must test DNS/TLS from the exporting network namespace.
The final live-canary receipt records the corrected route and stopped rollback.

## 2026-10-29 — Encoded defaults and realistic transport recovery

Adding an optional decoded replay policy exposed a default expressed on the wrong
schema side: `withDecodingDefaultKey` needs an encoded value. The package gate
caught TS2379 before delivery; use `withDecodingDefaultTypeKey` when the default
is a constructed domain value. The repaired package audit and docgen passed.
The first dropped-request fixture also demonstrated that an absent Phoenix
project yields a query failure, not Missing. Establish a disposable project
before fault injection when testing replay eligibility; retain a separate refusal
case for missing/unreachable query targets. Both failed and successful fixture
runs removed their owned resources. These distinctions prevent green mocks from
claiming transport recovery that the actual route cannot perform.

## 2026-10-29 — Installed credential proof and entrypoint typecheck coverage

The first LoadCredential service failed before startup. Minimal user-service
probes isolated unsupported source-path whitespace; a second rendered attempt
revealed that this directive does not accept the shell-style quoting used for
ExecStart arguments. Restrict credential paths and emit the directive according
to its own grammar. Keep actual service proof after renderer unit tests.

The dedicated bundled worker was missing from the scoped CLI typecheck include.
An invalid Config API export therefore passed the scoped tests but produced a
bundler warning and failed installed startup. Include the real entrypoint in both
compiler checks and reject unresolved-import bundle warnings. The corrected
installed service and expanded scoped compiler checks passed. Failed proof runs
removed only their owned services; no shared systemd restart or weakened access
control was used.


### Private maintenance destination selection and verification

The first maintenance boundary reused host and salt namespace identity. Independent
review showed this could select a different journal on the same host using the
same salt. Added configured target plus fresh per-process instance binding and
cross-instance/target regression cases. Private context selection must distinguish
process ownership from source namespace and from authentication.

The first package check also caught introduced tagged-union Effect error inference,
a missing multiline JSDoc tag, and a strict-boolean diagnostic in the test fixture.
The repairs normalize content-free HTTP refusals at each operation, document the
type alias correctly and compare the fixture flag explicitly. Focused runtime
success is insufficient to establish package correctness; preserve each gate's
actual result and finish the full package verification.


### Live timestamp quantization and complete managed-key verification

The synthetic surface canary stored both records but could not write visibility
receipts. Exact source timestamps were intact; Phoenix rounded to microseconds
while the reader required truncation. Fixed-clock nanosecond fixtures ending in1
had concealed this behavior. Deliberately choose an870ns remainder in backend
proofs, retain integer comparisons and exact source annotations, and test that
point spans stay points and endpoint order cannot reverse. The failed proof was
retained; no ambiguous resend or legacy service restart was used.

Independent review also found that newly managed fixture attributes were checked
when present but not requested when expected absent. Extend the read-back managed
key inventory with every new optional attribute and test unexpected stored values.
Installed verifiers now snapshot source fingerprints before bundling and require
unchanged files after cleanup, preventing a later source edit from being mistaken
for the code that actually ran.


### Whole CLI verification ended in a runtime abort

The full package-verification driver on Bun 1.4.4 aborted after about 616 seconds
without delivering a complete package result. The owned service had about
5.82 GiB peak, no guard stop and at least 31.84 GiB host headroom; retained kernel
evidence contains no corresponding OOM. All 1,421 recorded CLI input hashes were
stable. Keep the passed package/scoped receipts, retain the failed gate as failed,
and use canonical delivery/hosted verification rather than repeatedly launching
the same broad check. A runtime failure must not be classified as memory
exhaustion merely because the diagnostic also prints memory statistics.
Receipt: ops/whole-cli-runtime-abort-verification.json.

## Verification process limits — 2026-10-29

The temporary verification guard capped tasks at 256. Kernel evidence identifies
`fork rejected by pids controller` in the corrective PR final-check service,
followed by analyzer launch failures and invalid envelopes. The earlier whole-CLI
abort also has an exact-service process-limit event. These are resource-envelope
failures; they are not valid quality results or evidence of kernel OOM. The
corrective retry retains the same memory, CPU, host-headroom and runtime limits,
raises only the temporary proof task allowance to 1024, and records peak task
count and pids-limit events. Future proof receipts should capture these counters
alongside memory so spawn failures cannot masquerade as source defects.

## Whole-package proof reserve stop — 2026-10-29

The full CLI package verification reached its docgen subprocess but the owned
guard observed host available memory below its 16 GiB reserve and stopped the
run. The service peaked near 7 GiB with zero PID-limit events; all 1,779 source
hashes remained unchanged. The five-second shutdown grace expired, so systemd
reported timeout/KILL. This is incomplete proof, not a kernel OOM or a failing
source assertion. Receipt: `../ops/whole-cli-protective-stop-verification.json`.

A phase-aware verifier should stream parent step results into durable receipts
so a reserve stop does not discard already completed proof. Descendant command
names alone cannot identify parent progress because test fixtures invoke the
same commands. Keep reserve protection and avoid immediate whole-run repeats;
use bounded focused verification while finishing the implementation.
