# Qualification acceptance audit

This audit is incomplete by design: it records the remaining work against the
nine SPEC acceptance criteria. A scoped pass is not whole-goal completion.
The earlier audit table is the historical checkpoint at
`0dca9987807d3ac2e4ae842f712522198a4ec965`. Later dated sections record
subsequent source and runtime evidence; none promotes the pilot.


## Latest local checkpoint: 2026-09-25

The [v23 local matrix receipt](./local-matrix-v23.md) records frozen source
`ed2742ff4ff0c837e01df0cc38b452762c9a4d89`, stable Turbo 2.11.3 and canary
2.11.5-canary.2. Both completed 67 observations, 40 passing checks and ten
shadow decisions. Independent receipt reconstruction passed; both report
hashes were checked again when the compact receipt was authored.

This advances the local portion of real-pilot evidence. Native scalar I/O and
archived-source input reviews passed, with hashes retained in the v23 receipt.
Ring I/O remains uninterpreted. Both clients passed five synthetic capture
controls with independent retained-byte and production-parser review; repeated
mixed-stream observations found two output orderings per client at unchanged
task hashes. This synthetic fixture is ineligible for exact-log determinism;
the quiet real pilot retains its separate evidence.
Semantic input closure, accepted signed comparisons and sibling receipt
integration remain incomplete. Existing entrypoint enforcement is not newly
classified as unimplemented merely because historical report strings still
list it: the v23 receipt now includes ordinary CLI execution, caller-override
rejection and profile-drift recovery checks at `8f11af6e49`. Synthetic native key injection and declaration invalidation also passed with
cache I/O bypassed. A subsequent isolated ordinary-CLI fixture also passed
local miss/hit pairs before and after runtime declaration invalidation. The full
entrypoint population and real-computation runtime evidence remain separate
obligations. No real tuple qualifies, and no acceptance criterion is
promoted to complete by this checkpoint.

Checkpoint PRs #1233 and #1250 merged on 2026-09-25. PR #1250's full
local publish verdict passed at `0b072273c4`, and its separate canonical
monitor exited zero with `merge-ready: yes`. PR #1233's saved publish verdict
failed at `monitor:01-pr-context`; that terminal job is not a full publish
success, even though the PR subsequently merged. The unexpected-dependency
fixture repair passed all 20 focused tests, and package lint/type checks
passed in both worktrees. These checkpoint PRs do not constitute the final
implementation PR or same-PR lifecycle closeout.

## Earlier audit baseline

Source revision: `0dca9987807d3ac2e4ae842f712522198a4ec965`.

Runtime refresh on 2026-09-21 found a changed kernel and runtime linker at the
same source revision. The installed dependency archive is unchanged. The
`toolchain-drift-2026-09-21.json` receipt binds the refreshed activation. Earlier
pilot matrices remain evidence for their recorded runtime. Both full refreshes completed with 67 observations, 40 passing checks and
ten shadows per channel; independent metadata reconstruction passed.
`lts-pilot-review.json` records the current channel-specific boundary. Neither
raw archive validation nor signed transport validation is established.
The separate `git-config-input-review.json` covers only the completed stable
`core.excludesFile` control and cannot replace those matrices.

The current Git-exclusion repair, tool-boundary census and cache-policy audit
contain 34 distinct file references. All 34 original files were readable and
matched their recorded SHA-256 values during this audit. Each stable/canary
pilot contains 67 runs, 40 passing checks and ten shadow decisions. This check
verifies retained metadata; it cannot reconstruct deleted temporary archives.

| Criterion | Status | Evidence and limitation | Next required work |
| --- | --- | --- | --- |
| census | partial | `toolBoundaryCensusAttachment`: Population and 784 attached references accepted; seven semantic/runtime obligations remain. | Complete dynamic command and semantic classifications required by SPEC; preserve unknowns. |
| policy-and-transitions | partial | `qualification-contract.md`: Policy and rejection boundaries exist; qualified transition remains deliberately closed. | Integrate accepted sibling receipt validation into audit and transition paths, then test valid and adversarial imports. |
| synthetic-fixture | partial | `runtime-enforcement-boundary.json`: Refreshed synthetic receipts pass 30 checks across 60 runs per client; independent metadata review passes (`synthetic-post-repair-review.json`). Signed cases and raw archive validation remain absent. | Local cases explicitly named in SPEC:77-80 are mapped in `synthetic-mandatory-case-coverage.json`; obtain accepted remote fault/signature evidence and preserve raw-evidence limitations. |
| real-pilot | partial | `gitExclusionRepair`: Both exact clients pass local matrices; signed remote pairs and complete semantic input/capture coverage remain absent. | Refresh semantic/capture closure after the current native-map review, and consume three verified signed remote pairs per qualified profile. |
| legacy-posture | scoped-pass | `currentCachePolicyAudit`: Current audit passes with zero blocking findings and 1386 unassessed cached computations; no entry qualified. | Retain honest classification and rerun gate after implementation changes. |
| adoption-handoff | partial | `qualification-contract.md`: Population, API and decomposition leads available; validated pilot unavailable. | Deliver accepted pilot and invalidation evidence through the governed transition contract. |
| package-and-protocol-checks | partial | `gitExclusionRepair.packageVerification`: Latest Git exclusion repair has CLI package audit/docgen proof; final protocol integration is pending. | Run all affected package checks and protocol checks after remaining implementation. |
| final-pr | not-established | `SPEC.md`: No final implementation PR with exact-head Yeet merge-ready evidence is established by this audit. | Run Yeet repair, verify, publish and monitor after acceptance work is ready. |
| same-pr-closeout | pending | `SPEC.md`: Final reflection and completed-retained lifecycle are intentionally not claimed. | Land final evidence, reflection and lifecycle in the final implementation PR. |

## Merged profile refresh: 2026-09-22

Checkpoint PR #1182 merged as `f25286554f`. Its interrupted full local proof
is not recorded as a pass. The resumed source is `0be1f13d62`; the installed
stable client is now 2.11.2. Historical matrices retain their exact old pins.

[Current native input review](./profile-closure-refresh-2026-09-22.json)
verified all 789 input blob hashes (761 identity, 28 types). Actual governed
execution passed both tasks with zero cached tasks, and profile freshness
passed. Four independent file additions (alternate compiler configuration,
alternate Biome configuration, utils source and root Vitest support) entered
the input map and changed identity's hash. Removing them restored the original
hash and map.

The current explicit maps cover 422 repository read paths from the retained
historical candidate trace; `.git` remains separately attributed by the Git
routing review. This supersedes the old explicit-map gap for that historical
path set. It does not prove current semantic closure: fresh read/write/capture
observations, alternate paths, concurrency, current-version replay matrices
and signed remote evidence remain necessary. Both tasks retain `cache: false`.

PR #1189 merged as `02f8084070`. Its hosted readiness monitor passed; its full
local proof was cancelled during coverage after the merge and is not a pass.
Retirement removed ignored local proof logs and some temporary raw plans from
that worktree. Published digests retain their historical meaning, but the
missing original bytes cannot now be independently rechecked. The surviving
capture worktree has a fresh native plan at `3f1d2a8a08`: both task input maps
and hashes match the retained baseline, and all 789 input blobs match source.
This establishes plan/content parity only. The retention correction is recorded
in `OPPORTUNITIES.md`.

[Fresh isolated capture](./current-profile-capture-2026-09-22.json) then passed
actual lint execution and dependency/toolchain verification before and after.
Its independent reviewer verified the original capture hashes and reconstructed
31,259 positive scalar reads with no unmatched unfinished calls or captured
read-buffer contents. Of 428 repository paths read, 427 occur in the native
input map; `.git` remains separately attributed. No repository-backed memory
mappings were detected. The recorded write-related operations concern a private
`/tmp/biome` directory and device opens. An expanded socket-call inventory found
three local Unix socket pairs, twelve successful socket-option changes, one
shutdown and two failed peer-name queries. The initial reviewer omitted those
operation names; its empty network list was incomplete.

A supplemental lifetime review joined all 21 explicit writes. Nineteen are
attributed to captured stderr, pipes, Unix sockets, the null device or an eventfd.
Two one-byte child writes remain unattributed because their preceding `pipe2`
return arrays were abbreviated. This is a captured-syscall attribution, not a
complete descriptor or indirect-I/O proof. No vectored-read or vectored-write
calls were found in this trace.

Five successful `io_uring_setup` and five `io_uring_enter` calls remain undecoded.
Raw write arguments and vectored I/O also prevent a complete destination claim.
The network namespace and read-only mounts constrain this execution, but they do
not prove ordinary execution has no external effects. This observation therefore
does not establish semantic closure, replay correctness or signed transport.
Sixteen original capture, preparation and review files were copied outside the
worktree and verified byte-for-byte; the receipt records hashes and retention.

## Supplemental descriptor and ring observations: 2026-09-22

[A separate capture](./descriptor-capture-2026-09-22.json) retained complete pipe and socket-pair descriptor arrays while
keeping string payload suppression. All 21 observed scalar writes are attributed:
eleven pipe writes, five Unix-socket writes, two stderr writes, two null-device
writes and one eventfd write. The two one-byte child writes have immediately
preceding pipe-creation records. This resolves attribution in this execution;
it does not rewrite the original trace's two unknown destinations.

Both captures read the same 428 repository paths and produced identical stdout
and stderr. Their repository read-call counts differ (448 versus 447), so path-set
agreement is not presented as identical execution. No tuple is promoted.

[A separate focused stack capture](./ring-attribution-2026-09-22.json) resolves all five ring-enter calls to Node's
`uv__epoll_ctl_flush` using the exact installed binary and its ELF load base.
The retained reviewer reproduces all ten setup/enter events and stream equality.
This supplies runtime caller attribution for that capture. Queue contents remain
undecoded, and semantic-input completeness and signed transport remain open.

## Execution order and ownership

### Current census and replay boundary

The refreshed census at `3f1d2a8a087d845ff53b17498270b8086d7fc40a`
uses Turbo 2.11.2 and contains 143 workspaces, 3,449 graph nodes and 1,957
executable nodes. The canonical attachment accepted 778 source identities,
six embedded artifacts and 22 reviews. Its SHA-256 is
`bba55aa472a35460127e48ec9727668ffa28b0b150853cc1b381c16e83b2e139`.
All 48 changed historical source identities have review coverage. Negative
controls rejected stale source hashes, stale artifact hashes, a missing command
group family and a repeated source path. This verifies attachment validation;
the eight unresolved semantic and runtime obligations remain open.

The current stable pilot stopped at its initial comparison gate after detecting
divergence. It produced no completed matrix receipt, and further reuse
experiments stopped. A bounded diagnostic retained eleven observations: all
three fresh pairs, concurrent fresh execution and cross-root execution agree.
The cache-enabled producer and replay both exit 1, and the replay is another
fresh execution rather than a cache hit. Their selected task emits 138 log
bytes, compared with 53 bytes in successful uncached runs. The dependency exits
0 throughout, and all observations retain unchanged package sources. These
results located the failure in cache-enabled selected-task execution. The retained
log then identified `biome check .` as the failing command. The enabled fixture
had reformatted compact JSON arrays as well as changing the cache flag. A
corrected projection changes only that flag, has identical decoded JSON, and
matches Biome's formatter output exactly. The canonical activation preview
accepted it. With that correction, all seven initial checks pass across eleven
observations: the producer exits 0, replay is a local hit with exit 0, and both
retain the same 53-byte task log as the uncached runs. This attributes the
observed failure to fixture formatting. The diagnostic deliberately stops at
the initial gate.

Recovery review on 2026-09-24 found the completed corrected stable receipt at
that recorded source revision: 67 observations, 40 passing checks and ten shadow
decisions. Independent review reconstructed the runtime identity and verified
fresh/replay, perturbation and non-execution relationships. The receipt SHA-256 is
`5fd5c37eff9e784406a069b8b17796b8df374f05d1c67bb03960e5fd80fac6a8`.
The original process exit is unavailable; the retained receipt and its independent
review supply the evidence. Raw archives and signed transport were not validated.
The matching canary completed with exit 0. Combined independent review passed
for stable 2.11.2 and canary 2.11.3-canary.3: each has 67 observations, 40 passing
checks and ten shadow decisions, with separate reconstructed runtime identities.
The canary receipt SHA-256 is
`b063583e0273882b55d29a007ddefffa15289b939fd99284a49a15f8ca1975c7`.
The review validates retained comparison relationships; it does not validate raw
archives or signed transport. Ten original input/result/reviewer files were
archived and hash-verified outside the worktree.
These results describe the recorded source and toolchain, not newer main commits.

The follow-up CLI test repairs passed full package verification: audit 835.9s
and docgen 22.7s, exit 0. Exact-head Yeet and hosted coverage acceptance remain
pending for this branch. Main subsequently incorporated PR #1201, whose hosted
Coverage Regression check passed. It includes the same error-path tests and a
recorded baseline row for the source-only runtime module. After fast-forwarding
to `28a7045c9b`, this lane retains those upstream tests and drops its duplicates;
no local baseline change or new compiled-execution claim is made. Frozen-lockfile
installation passed. The earlier package proof describes its pre-sync source.

### Next dependency steps

1. Qualification continues local semantic-input, read/write and capture closure,
   and maps mandatory negative cases to retained evidence. The current source
   review and a handful of external-file perturbations do not prove closure.
2. Conformance and trust own the signed receipt formats, producer/auth/signature
   verdicts and passing signed fixture/lab boundary. Both local packets remain
   paused. A 2026-09-24 search inspected 133 local Beep clones/worktrees and
   found 128 sibling packet copies, all paused, with no receipt or acceptance
   artifact candidates in those packets. The recent Codex task list supplied no
   identified sibling producer. This is a bounded search, not proof that no
   private receipt exists elsewhere. Starting those goals is a separate pending operator decision; this
   packet must not fabricate their contracts or evidence.
3. Once those accepted milestones exist, qualification validates original bytes,
   provenance and exact tuple/pin bindings, completes signed comparisons, and
   tests transition acceptance and rejection.
4. Only a validated real pilot can complete the adoption handoff and unlock
   final Yeet publication and same-PR closeout.

The historical `remaining` strings inside pilot receipts are immutable run
metadata. They are not a live task list: later entrypoint enforcement has its
own evidence. This audit and the current qualification contract state the
current boundary without rewriting historical receipts.

## External read-path disposition: 2026-09-24

The retained positive scalar-read inventory contains twenty paths outside the
repository. Nine are the linker detector and shared-library targets present in
the recorded runtime fingerprint. One is the governed Git exclusion input;
one is the worktree `commondir` routing file. The remaining nine are procfs
paths: process mappings, cgroups, memory information, overcommit policy and CPU
statistics. They remain unresolved runtime-state dependencies. Fingerprint
membership proves a recorded binding, not live byte equality or semantic closure.

A fresh streaming pass verified the original compressed trace digest and
correlated successful exec and procfs-open events. Bun opens overcommit policy
and process maps; the Node launcher opens process maps, cgroup and memory
information; native Biome opens overcommit policy, maps and cgroup state.
Additional task IDs open CPU statistics; this pass does not reconstruct their
thread ancestry or establish why those values are used. No buffer payloads are
published. The private disposition digest is
`7f36bf87b3a57b5c5bb1b05c357dccf57397c77c4d853e1832d3fe5a9796e312`;
four input/review files are retained in the verified external evidence archive.

Next, correlate these runtime reads with pinned runtime sources and run bounded
resource-state perturbations before classifying any procfs value as non-semantic.
Stable replay agreement alone cannot discharge that obligation.

### Pinned runtime source attribution

The exact Biome 2.5.6 tag is `@biomejs/biome@2.5.6`, resolving to
`1139f1ca8a0f11b5d84dc7b415c2a4ab6fc0ef03`. Its CLI selects jemalloc on
Linux with glibc; mimalloc is conditional on Windows. The lockfile-pinned
`tikv-jemalloc-sys` archive passed its recorded SHA-256 check. Its
`os_overcommits_proc` implementation reads overcommit policy and its initialization
uses the result to select `MAP_NORESERVE`. This is source-correlated allocator
behavior, not a captured call-stack attribution or semantic-invariance proof.

Node v24.20.0 initialization derives V8 defaults from total and cgroup-constrained
memory. Six fresh-run controls completed through admission with ordinary,
512 MiB and 64 GiB sandbox-visible memory metadata, two runs per case. They did
not alter host limits. All six executions exited 0 with empty stdout and identical
53-byte stderr. The wrapper completed with exit 0 after dependency and full
toolchain postchecks. Independent review verified twelve raw streams, both
memory files, six unique case/repeat identities and the script digest. The
receipt SHA-256 is
`d96d51cf056cfee01fad20a6b8f4c72402f575c8b53dcfb3cdcaf1d98f547219`.
Twenty-one raw/input/review files are retained in a hash-verified archive.
The controls do not trace consumption of each injected value and do not change
cgroup or physical memory limits, CPU state or process mappings. Those limits
remain explicit; this bounded agreement does not establish semantic closure.
The canary matrix also completed; its independent review is recorded above.

Fourteen source and attribution files are hash-verified in the private archive.
The attribution digest is
`6a12f04d3baa5a112b207d06b30932a87494b0bc802d6a168ae30cac39a46fdc`.
Pinned sources: [Biome allocator selection](https://github.com/biomejs/biome/blob/1139f1ca8a0f11b5d84dc7b415c2a4ab6fc0ef03/crates/biome_cli/src/main.rs),
[Biome lockfile](https://github.com/biomejs/biome/blob/1139f1ca8a0f11b5d84dc7b415c2a4ab6fc0ef03/Cargo.lock),
and [Node initialization](https://github.com/nodejs/node/blob/v24.20.0/src/api/environment.cc).

The exact fingerprinted glibc binary supplies a candidate CPU-read attribution.
Its `get_nprocs` first tries `/sys/devices/system/cpu/online`; a zero helper result
branches to a helper that opens `/proc/stat`. The capture sandbox does not mount
`/sys`. Direct disassembly and referenced string bytes establish this binary
path. The completed stack capture below connects it to the observed calls.
The installed package's source revision did not resolve through the queried
mirror; no nearby source is substituted. Five retained binary-review artifacts
have attribution digest
`a7d07fdc31c6686c93c48b717964e7a082cc5b14742a98e79cda322e0e1b75dc`.

### Completed procfs stack capture

The path-filtered capture completed with exit 0 and passed dependency/toolchain
postchecks. Independent byte review verified the compressed and expanded trace
and both streams, joining ten unfinished calls with no unmatched remainder.
It records six CPU-statistics opens, five process-map opens, 76 cgroup opens,
one memory-information open and three overcommit-policy opens.

All six captured `/proc/stat` opens carry `get_nprocs+0x25` at the disassembled
return address and `pthread_getattr_np+0x10b`. Four of five map opens also carry
`pthread_getattr_np`. This confirms those observed caller paths; it does not
classify their effects as semantically irrelevant. Sixty-seven event stacks
reach the frame cap. Unvalidated nearest-symbol labels in stripped Node and
Biome frames must not be treated as resolved function identities.

The full stderr is 211 bytes: 158 bytes of exact strace path-resolution notices
followed by the expected 53-byte task log. The reviewer validates that complete
sequence and records that full stderr differs from an untraced run. No unknown
lines are discarded. Twelve raw/input/reviewer artifacts are archived and
hash-verified; review digest:
`9872ec860455d38796054b9cf40a0f23ef8477c27d0cf3487e83c509c5f96857`.

Ten retained Node trace offsets now resolve inside exact ELF function bounds
using its recorded load base and fingerprinted binary. They connect memory reads
to `node::NewIsolate`, `uv_get_constrained_memory`, `uv_get_total_memory` and
`uv__read_proc_meminfo`; the mapping paths resolve to V8 stack-start discovery
and `ParseProcSelfMaps` / `OS::RemapPages`. These bounded symbol matches replace
misleading nearest-symbol labels in the trace. They establish function identity,
not semantic invariance. Biome's binary exposes no symbol table, and five sampled
Bun offsets have no bounded symbol match. Their caller names remain unresolved.

### Completed overcommit-policy controls

Six admitted fresh executions used sandbox-visible overcommit-policy values
`0`, `1` and `2`, each against valid source and a private syntax-error mutation.
All three valid cases exited 0; all three invalid cases exited 1. Within each
group, stdout and stderr matched byte-for-byte. Stdout was empty throughout;
valid stderr was 53 bytes and invalid stderr was 138 bytes. Host overcommit
policy and physical memory limits were unchanged.

The wrapper completed with exit 0 and verified dependency materialization and
the full observed toolchain before and after. Independent review checked twelve
raw streams, six trace digests, all three injected metadata files and the probe
script digest. Every case contains three positive reads of the policy path by
three distinct process IDs, returning five bytes in total. No unfinished trace
calls remained. The reviewer also rejected four synthetic corruptions, including
an empty trace with a matching digest; those controls test the reviewer and are
not runtime evidence.

Twenty-eight raw/input/review files are retained in a hash-verified private
archive. Receipt SHA-256:
`2efc4fbf13e80e2c30733d1830400f5d2362b6c27167f1056494dbacd1df8839`.
Review SHA-256:
`a27e3ae7cb4bfcb3a9b86f9392ea557184b8f458b257a5651aab5d61d5ce0904`.
These controls establish bounded agreement with verified policy reads. They do
not prove every allocator branch, actual host-policy behavior, complete runtime
input closure or signed remote replay. No qualification tuple is promoted.

### Follow-up census obligation disposition

The immutable census attachment lists eight unresolved obligations. One is the
specific stop for the initial pilot divergence; the corrected stable and canary
matrices above resolve that stop for their recorded profile. It is no longer
current work to re-attribute that same formatting failure. A separate disposition
binds the original census digest and both corrected receipt digests, preserving
the original attachment. Its SHA-256 is
`1854b69d7285246ca41263de64ca210b65142dd49dbe68174deb548e41bf0f4d`.

Seven broader obligations remain open: candidate semantic/capture and signed
comparisons; nested-command semantics; candidate runtime evidence beyond source
identity; hosted workflow/action/status ownership; dynamic entrypoint branches
and external verdicts; downstream parser interpretation; and dynamic planner
runtime outcomes. The completed controls narrow these obligations but do not
discharge them. Five disposition and supporting evidence files are retained in
a hash-verified private archive.

### Static shell-expression classification

The nested-command inventory's 21 uninterpreted definitions now have a bounded
shell review, with every command checked against its manifest at the fixed
source revision. Eight Fallow definitions expand a quoted `BEEP_PROOF_BASE`
argument and name report destinations; eight Portless definitions launch
persistent shell children. The remaining definitions comprise the identity
check's output suppression, infra's literal-output build placeholder, a Lambda
working-directory and short-circuit chain, and two Storybook definitions using
Git-root substitution and cross-workspace globbing (one requests source writes).
These are nested definitions, not 21 newly discovered executable graph nodes.

The review records input and effect obligations for each definition. It does not
execute services, install Lambda dependencies, equate literal output with a
build artifact, or infer downstream runtime closure from shell syntax. Thirteen
review/input files are archived with verified hashes. Review SHA-256:
`ccc3ced91fd0cf0b5c549e4f1add0115d484d5d1786f2bbd3c50f954e7058eb7`.
The broader nested-command obligation remains open pending its downstream
semantic evidence; the original inventory is unchanged.

### Standalone Lambda command boundary

The infra test chain changes into its standalone Lambda workspace, installs with
a frozen lockfile, then runs type checking, Bun tests, bundle smoke and ZIP
checking in a short-circuit sequence. The reviewed compiler config requests
no emit and includes source and test TypeScript. Bundle checking deletes the
local build directory, emits three CommonJS bundles and imports each to check
that its handler export is a function. It does not invoke those handlers; module
import effects and individual test effects still need their owning evidence.

ZIP checking deletes a fixed `turbo-cache-zip-check` directory under `TMPDIR`
(default `/tmp`), copies three bundle files to handler names, sets timestamps,
creates an archive and checks its size before printing its digest. Concurrent
checks require isolated temp roots. These source observations do not establish
archive determinism across environments, deployed behavior or signed replay.
No part of the chain was executed for this review. Six review/source files are
archived with verified hashes; review SHA-256:
`37353cfd13052e1d7d2601fac515cc055e63e94c8da8fc5405ade76f36ce2c51`.
