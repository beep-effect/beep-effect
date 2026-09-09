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

## Sibling handoff and remaining gates

Conformance/trust may consume this contract before full qualification closes.
Their versioned receipt formats remain owned by those packets; qualification
will validate imported references through their public contracts when present.
P3 stays pending until passing executable signed-fixture/lab receipts exist.
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
