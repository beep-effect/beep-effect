# Qualification contract v1

P0 implementation contract, 2026-09-09. This document specifies the shared
qualification boundary; it is not a passing experiment or a sibling receipt.

## Ownership and identity

`@beep/repo-configs/cache` owns pure schema/policy. Cache owns filesystem,
process execution, evidence verification, transitions and projection writes.
Quality invokes the audit through the Cache facade. Conformance supplies
signed transport/fault receipts; trust supplies signature, tenant, capability
and capture-safety verdicts. Neither source review nor a local cache hit can
satisfy those imports. The sole writer for the qualification source files and
this packet is this task; sibling source files remain outside its write scope.

## Consumer checkpoint — 2026-09-25

The source census was regenerated at `8caad510d2`: 144 workspaces, 3,473 graph
nodes and 1,970 executable computations. No nodes were added or removed.
Two repo-cli test configurations gained the D1 economics/handoff JSON inputs;
53 other nodes have changed input summaries. Root scripts and global
configuration are unchanged. This live census is not an atomic filesystem
snapshot. See [the D1 source review](./d1-entrypoint-review.json).

The validated attachment now binds 1,014 sources, six planner artifacts
and 51 reviews, retaining 14 broader obligations. Scoped npm tool paths are accepted
without relaxing containment, symlink rejection or digest checks. The pure
policy API remains `@beep/repo-configs/cache`; source attachment does not grant
qualification or authorize activation. The [D1 planner comparison](./d1-planner-review.json)
renews four finite local/hosted projections; the two other artifacts retain
their historical pins.

The [v23 receipt](./local-matrix-v23.md) keeps stable Turbo 2.11.3 and canary
2.11.5-canary.2 results separate at their frozen source. Each has 67 local
observations, 40 checks and ten shadow decisions. Separately, the
[ordinary real CLI replay](./ordinary-real-local-replay.json) proves one fresh
miss and two local hits at `8f11af6e49`, including exact task-log archive bytes.
The [source invalidation controls](./ordinary-real-invalidation.json) additionally
verify valid-source invalidation, failed-task non-reuse and restored local replay.
These source boundaries must not be collapsed into a current-head runtime claim.

Adoption can consume the population, policy API, decomposition leads and
retained invalidation evidence for preparation. Accepted signed conformance and
trust receipts, complete semantic/capture closure, a validated qualified pilot,
and final package/hosted closeout remain owed. No tuple is promoted by this
checkpoint. The older section below is historical context, not current pins.

## Historical consumer checkpoint: Git-exclusion repair

The implementation and refreshed runtime experiments are at `0dca998780`.
The latest operational census was refreshed at that same commit and accepted
the expanded command-boundary source attachment. Its regenerated nested graph
matches the retained post-main graph structure. Earlier censuses retain their
original revisions. The dated sections
below retain the initial contract and implementation history.

| Surface | Current evidence and disposition |
| --- | --- |
| Population | The post-main census records 143 workspaces, 1,957 executable computations and 1,492 graph-only nodes. `nested-commands-post-main.json` expands 3,317 reachable definitions from all executable roots; it preserves unsupported shell syntax. |
| Entrypoints | `entrypoint-review-tool-boundaries.json` binds 784 references: 765 source files, six snapshots and 13 reviews. The retained operational census accepts the attachment and records seven unresolved semantic/runtime obligations. Source integrity is not runtime authority. |
| Policy | The pure facade remains `@beep/repo-configs/cache`. Ledger revision 3 excludes identity lint in both recorded profiles and types lint in the current profile. No entry is qualified. The current operational cache-policy audit passes with zero blocking findings and reports 1,386 unassessed cached computations. |
| Execution | Ordinary Quality/CI planned Turbo execution uses Cache runtime identity enforcement. The caller cannot supply the governed digest. The repair additionally fingerprints bounded Git common-directory `info/exclude` bytes. This does not authorize activation or replace required hosted proof. |
| Local pilot | Separate stable 2.10.12 and canary 2.10.13-canary.1 v11 pilots each passed 67 observations, 40 checks and ten shadow comparisons. Their runtime identities reconstruct independently. The experiment profile remains `local-linux-x64-bun1.4.2`, epoch `qualification-v2`, on Linux 7.2.2-1-cachyos. |
| Targeted invalidation | Both exact clients now change identity's native task hash when exclusions change the lint result, with identical source bytes and own input maps. Separate raw reviews and before/after dependency/toolchain verification passed. Other Git configuration and concurrent mutation remain outside this proof. |
| Capture | Earlier separate native probes cover fresh/replay task text and rejection of control bytes, malformed UTF-8 and oversized logs. Those retain their original revision and provenance. The mixed-stream fixture varied in line order and remains ineligible under exact merged-log comparison. |
| Remaining authority | Full semantic input review, accepted signed-remote comparisons and conformance/trust imports remain outstanding. Local pilot metadata does not supply independently retained raw archives or a validated qualification handoff. |

The [runtime boundary receipt](./runtime-enforcement-boundary.json), especially
`gitExclusionRepair` and `toolBoundaryCensusAttachment`, binds current private observations and public source
attachments by hash. Adoption may use the population, policy API, decomposition
leads and invalidation rules for preparation. It must not treat this checkpoint
as permission to activate a tuple or broaden a cohort. Qualification still owes
the validated pilot and final acceptance evidence required by SPEC.

The key is computation × reuse layer × named profile × epoch. Cache records
bind an exact contract digest (command/subprocess graph and input/output/log
worksheet), effective root/child configuration digest, toolchain digest,
must-fail fixture digest and backend-contract digest. Changing any member
invalidates evidence; a new epoch does not inherit qualification.

Profile `local-linux-x64-bun1.4.1` is the initial experiment envelope. Its exact
Node, Biome, Turbo, OS/architecture and dependency pins must be attached to
each experiment. It does not claim portability to hosted or other platforms.
The stable and canary clients always have separate results and namespaces.

## Policy and transitions

Initial discovery reports executable and graph-only nodes separately. All
executable legacy settings are unassessed regardless of `cache` defaults.
Required hosted status is excluded from cache promotion; Quality and Yeet
proof layers keep their existing owners. This goal can promote Turbo task
results only. Archive restoration is transport evidence only.

Allowed transitions are unassessed → candidate/excluded; excluded → candidate;
candidate → shadow/excluded; shadow → qualified/excluded/suspended;
qualified → suspended/candidate; suspended → candidate. Each transition has a
review decision and evidence reference. Candidate requires an executable
finite command and a complete worksheet. Qualified requires the current key
and pins, three isolated fresh/fresh pairs, three independently verified signed
remote pairs, ten representative shadow decisions, semantic-input and
orchestration perturbations, output/log equivalence, supported cross-root and
concurrency checks, secret-canary safety and all applicable must-fail cases.
Any divergence, failed invalidation, unsafe capture or unsupported evidence
prevents promotion. Evidence must be read and validated, not accepted by count
or by a caller-provided `passed: true` alone.

## Census and reviewed projection

Discover the actual workspace population using Turbo and verify each manifest.
Preserve every script so nested `bun run` wrappers can be traced. Resolve
effective task settings through the exact Turbo dry plan, joining by workspace
and script presence. Record sources for all CI, Quality and Yeet entrypoints;
unknown dynamic branches remain explicitly unresolved until inspected.

Capture `cache`, `inputs`, `env`, `passThroughEnv`, `outputs`, dependencies,
persistence/interactive settings, and the root global environment and flags.
Retain source digests for root/child configuration, manifests and runtime/lock
pins. The baseline is a reviewed projection of inherited posture, not an
allowlist of qualifications. New executable caching or changes outside the
pilot need review. Narrowing legacy reuse is permitted; unsafe known tuples
must be suspended at their actual boundary.

The [current acceptance audit](./acceptance-audit-current.md) separates local
semantic/capture obligations from the sibling dependency and final closeout.

## Sibling handoff and remaining gates

Conformance/trust may consume this contract before full qualification closes.
Their versioned receipt formats remain owned by those packets; qualification
will validate imported references through their public contracts when present.
P3 stays pending until passing executable signed-fixture/lab receipts exist.

The current integration points are `Cache.service.ts`'s `audit` and
`validateTransitionContract`: both explicitly refuse `qualified` state. The
qualification owner must replace those refusals with validation against the
accepted sibling public contracts, not remove them merely because local checks
pass. That work has the following ordered acceptance obligations:

1. Consume the sibling-owned versioned result/producer and conformance formats;
   reject unknown versions and incompatible client/backend/profile/epoch pins.
2. Read referenced original bytes, verify their digests and provenance, and
   interpret transport, signature, tenant, capability and capture outcomes.
   A supplied pass flag or task-level hit string is insufficient.
3. Bind verified remote comparisons to this computation contract and its actual
   activation/configuration/toolchain digests. Keep stable and canary separate.
4. Combine that evidence with three fresh pairs, three wire-verified remote
   pairs, ten shadows and the applicable negatives; reject incomplete,
   contradictory or borrowed evidence.
5. Validate promotion and subsequent audit against the same evidence semantics,
   and validate the enabled configuration before applying any activation.
6. Exercise tampered/missing evidence, wrong identity, stale pins and unsafe
   captures through the operational boundary before accepting a real tuple.

The local runner intentionally removes scoped fixtures. Its retained
`cache-pilot-local/v5` metadata does not contain independently reviewable raw
archives. The signed integration must use the siblings' accepted retention and
receipt contract; it must not reinterpret a local receipt as signed proof.

Adoption receives the reproducible census, governed API, reviewed projection,
decomposition leads, invalidation rules and validated pilot receipt.

## Operational checkpoint, 2026-09-09

The curated facade now includes state-specific ledger models, exact stable
and canary client pins, reviewed baseline projections, and the pure audit.
Cache supplies `baseline`, `inspect`, `fingerprint`, `activation`, `transition`,
`synthetic` and `audit` commands through
an explicit service. The writer uses a directory mutex, atomic file promotion,
original-byte digest checks and optimistic revision/digest preconditions. Missing
or malformed ledgers fail closed; deleting state cannot restore legacy reuse.

The initial reviewed baseline lives in
`standards/cache-qualification-baseline.json`; the explicit zero-revision
ledger is `standards/cache-qualification.json`. The baseline recorded 928
cached executable computations as unassessed. The identity lint negative probe
has since exposed a synthetic source secret in successful warning output;
revision 1 records its exclusion, and its child Turbo configuration disables
only that task's cache flag. The named scope contains only
identity lint in `local-linux-x64-bun1.4.1`, epoch `qualification-v1`.

Quality consumes `runCachePolicyAudit` via the public Cache facade. The
cheap-gate and hosted repository-sanity plans include the audit, with direct
Quality and consuming Yeet planner regression coverage. Source/configuration drift, concrete task
dependency changes, nested script digest changes, duplicate identities,
unsupported tuple borrowing and suspended reuse have regression coverage.
The implementation never turns a supplied `qualified` label into accepted
evidence: transition and audit refuse that state until the accepted sibling
receipt importer is installed. Shadow references are byte-checked observations,
not interpreted as passing results.

Every transition is retained in the ledger history. Reads and audits check
contiguous revisions, legal lifecycle edges and exact reconstruction of the
current entries. Candidate/shadow admission and audit bind the live computation
dependency closure, complete root/child configuration, actual runtime/binary
digests and stable client pin. Configuration source ordering is deterministic;
ordinary source-content changes remain task-hash inputs rather than automatic
changes to the configuration contract.

## Remaining implementation obligations

- Complete the census integration for every dynamic CI/Quality/Yeet branch and
  workflow boundary. [Command decomposition](./command-decomposition.md) and
  the current planner snapshot identify the observed static groups.
- Run the final hosted repository-sanity path on the implementation PR; planner
  coverage does not establish a successful hosted run.
- Verify original receipt bytes, provenance, semantic outcomes, capture
  bounds and key/pin bindings before supplying observations to promotion.
  File digest equality by itself is not an experiment verdict.
- Extend the implemented local synthetic runner with its remaining mandatory
  runtime cases. Finish real-pilot capture repair, execution, shadow sampling
  and the full comparison matrix. Bind accepted observations to original
  runtime receipts before promotion.
- Consume the accepted conformance/trust runtime receipt contracts when
  available. P3 remains pending, with promotion closed.

P0/P1 remain in progress; exploratory P2 execution has started. Neither these APIs nor their synthetic policy tests
qualify the real pilot or establish final Yeet/hosted acceptance.

## Disabled source and proposed activation

`CacheActivationProjection` binds the entire disabled configuration fingerprint,
the live child configuration path, and separate immutable before/after artifact
references. The v1 projection accepts a child extending only `//` and changes
only the selected task's `cache` setting from false to true. It checks the
original artifact bytes, decoded configuration, workspace path and source
fingerprint. Changes to inputs, outputs, dependencies, environment, inheritance
or another task fail even when a caller supplies a matching new artifact hash.

`cache activation --request <request.json> --output <preview.json>` computes
both fingerprints without changing the live configuration or ledger. The
contract describes the proposed enabled task; its activation field records the
disabled source needed to admit and audit that contract. Candidate and shadow
entries must keep ordinary reuse disabled, including when the inherited
baseline previously allowed caching. Admission also checks the observed
command, task configuration, dependency closure and exact toolchain pins.

Each client channel needs an `activation-projection` orchestration-invariance
observation before promotion. A computed preview or matching native dry plan
does not establish output/log invariance. The runtime executor must apply the
reviewed target only in its isolated experiment, observe its actual fingerprint
and produce the required comparison evidence. Qualified-state import remains
closed until the sibling receipt interpreter is installed. The eventual
activation writer and qualified audit must validate the actual enabled target.

The [activation checkpoint](./activation-verification-2026-09-09.md) records
current tests and native-check status. Identity lint remains excluded at ledger
revision 1 with its original command and `cache: false`.
