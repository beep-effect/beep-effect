# Qualification acceptance audit

This audit is incomplete by design: it records the remaining work against the
nine SPEC acceptance criteria. A scoped pass is not whole-goal completion.
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

1. Qualification continues local semantic-input, read/write and capture closure,
   and maps mandatory negative cases to retained evidence. The current source
   review and a handful of external-file perturbations do not prove closure.
2. Conformance and trust own the signed receipt formats, producer/auth/signature
   verdicts and passing signed fixture/lab boundary. Both local packets remain
   paused. Starting those goals is a separate pending operator decision; this
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
