# Turborepo quality cache brief

Approved 2026-09-08. The user accepted the complete scope, existing-home
architecture, four-goal map and first slice in
[`DECISIONS.md`](./DECISIONS.md). Implementation packets are linked from
[`MAP.md`](./MAP.md).

## Problem

Beep repeats quality computations across worktrees, Yeet tiers, and hosted CI.
Some tasks enable caching, some disable it, and others inherit the default.
Those settings do not establish which results are safe to replay, which
machines can share them, or why a remote request failed. The September 4 census
found 1,503 executable scripts across 142 workspaces. Its 2,840 configured
Turbo nodes include missing scripts and cannot measure completed work.

The intended result is evidence-backed reuse for every eligible quality
computation, with complete inputs, portable outputs, safe logs, and signed
remote artifacts. Every exclusion needs a reason. Every optimization needs a
measured effect on time, reliability, or cost. Compare the incumbent AWS cache,
a minimally improved incumbent, Bruno, and Ducktors under the same protocol
before selecting a backend.

See the [`task census`](./research/task-census.md) and the
[`September 8 refresh`](./research/refresh-2026-09-08.md). Source inspection is
not deployed-parity proof, and the original September 4 pins remain historical.

## Appetite

The bound is scope and evidence, not an invented delivery estimate.

- Prepare four goals: task qualification, cache conformance, trust and
  observability, and quality-cache adoption. Backend migration is a conditional
  fifth goal after the comparison passes the selection gate.
- Audit the entire current task population and all CI/Yeet quality entrypoints.
  First prove the mechanism on one synthetic fixture and one real computation,
  chosen as `@beep/identity#lint`, in one named environment profile. Expand by
  task family and measured benefit once that mechanism works.
- Compare the four named backend topologies using immutable release digests.
  The Vercel SDK is client reference material; unpublished Turbo main is an
  appendix. Additional candidates need a concrete gap in this comparison.
- Give every applicable stable/canary feature a versioned disposition and a
  bounded experiment where it could change correctness or measurable value.
  Reopen broad ideation only for a new unresolved decision branch.
- Preserve the backend rollout windows: seven days in non-production, seven
  days in a named hosted cohort, then fourteen days of broader observation.
  Synthetic runs in one session cannot satisfy representative observation.

The lab goal must produce a numeric cost ceiling, expiration, measured load
bound, deployment preview, and teardown plan before deployment. Values remain
deferred because the packet has no measured artifact distribution or
incremental AWS cost estimate. Existing fleet constraints still apply.

## Solution sketch

### Establish and enforce a computation contract

Join the Turbo graph to package scripts and the commands reached from Quality,
CI, and Yeet. Record semantic inputs, nested commands, observed writes,
outputs, logs, environment profiles, and fresh external verdicts. Split mixed
wrappers at their lowest pure children.

Qualification is specific to a computation, reuse layer, profile, and cache
epoch. Apply the lifecycle and full experiment matrix in the
[`qualification protocol`](./research/cache-qualification.md). Initial
enforcement should report inherited unassessed settings, detect drift, and
prevent expansion outside the reviewed pilot. Existing `cache: true` entries
do not become qualified by grandfathering. Confirmed unsafe entries get a
specific suspension/remediation decision.

Completion requires a final evidence-backed disposition for every in-scope
entry. Eligible computations must be qualified and adopted in proven profiles.
Ineligible boundaries need reasons and any viable decomposition recorded.
Remaining candidates, suspended entries, and temporary exceptions remain
explicit unfinished work.

### Extend the existing code homes

Pure reviewed policy and its immutable projection belong behind the proposed
`@beep/repo-configs/cache` facade. Discovery, experiments, transitions,
conformance, receipts, and projection audits belong in the repo CLI Cache group.
Quality enforces, CI renders, and Yeet consumes through curated facades. Infra
owns the deployed adapter and exchanges versioned JSON Schema/OpenAPI across
the standalone Lambda build boundary.

Reuse generic evidence types where their semantics fit. Extract a tooling
library only after a stable contract has two independent production consumers
that cannot use existing homes or versioned JSON cleanly. A Remote Cache driver
also needs a reusable external client boundary independent of the Turbo binary.
The [`architecture grill`](./research/architecture-grill.md) supplies the
source references and doctrine; this proposal changes no architecture-wide law.

### Prove the protocol and trust boundary

Build a reusable corpus from pinned OpenAPI plus semantic and adversarial cases.
Report strict OpenAPI, exact stable-client, and exact canary-client verdicts
separately. Require direct wire/backend results because Turbo can collapse
remote authorization, signature, and transport errors into apparent misses.

Use native Turbo artifact HMAC verification, opaque tag transport, independent
read/write bearer capabilities, tenant binding, protected producer receipts,
and namespace epochs for rotation. The backend does not need the artifact
signing key. Approved readers have the shared key, so the MAC alone cannot
identify a protected producer. Follow the detailed
[`trust model`](./research/trust-model.md).

Start with local fixtures. The graduated conformance goal then deploys a
bounded disposable AWS comparison lab. Run identical cases and the measured
load envelope against each eligible topology. A backend earns a pass through
executable evidence and the frozen
[`selection rubric`](./research/backend-rubric.md).

### Optimize the whole task graph and workflow

Audit root and child configurations, task descriptions, dependencies, transit
nodes, entrypoint selection, affected/filter behavior, global and task inputs,
environment hashing/passthrough, outputs, persistence/watch, and concurrency.
Include compiler state, coverage shards, generated checks, documentation,
browser prerequisites, worktree portability, Actions archive transport,
pruning/deployment workflows, boundaries, and demand-based warming.

Evaluate stable/canary flags individually. Each relevant feature gets a
version, prerequisites, Beep use case, correctness experiment, expected benefit,
disposition, and owner. Retain semantic inputs and broad environment
declarations until evidence proves they are irrelevant.

Compose the existing mechanisms while preserving the proof authority of
[`time-to-certainty`](../../goals/time-to-certainty/README.md), timing and
placement authority of [`ci-lane-economics`](../../goals/ci-lane-economics/README.md),
and the CI operational ontology's ownership.

### Adopt with attributable evidence

Promote only after the fresh/fresh, fresh/remote-hit, input perturbation,
portability, concurrency, log-safety, and shadow requirements pass. Adopt local
first, then a named hosted cohort, then broader proven profiles. Every required
hosted job still starts and emits its own source/workflow-specific status.

Measure correctness/security, critical-path time, reliability, cost, then hit
rate. Stable Turbo summaries and typed backend receipts are the initial signal
set. Experimental OpenTelemetry needs captured-payload safety and cost proof.
Keep high-cardinality identities in bounded receipts, not metric labels.
Separate genuine misses from remote faults. Warm only qualified computations
with measured demand and explicit resource budgets.

## First reviewable result

Show one actual computation, its complete contract, effective Turbo settings,
qualification state, and the reason reuse is allowed or denied. Deliberate
source/config changes must invalidate it. A configured task without a script
must never appear as executed or qualified work.

The current [`@beep/identity` manifest](../../packages/foundation/modeling/identity/package.json)
runs `lint` through `beep:lint` to `biome check .`. It is a bounded candidate,
not prequalified. A failed pilot must produce an attributed exclusion or a
specific repair; it cannot be counted as an adopted optimization.

## Rabbit holes

- New cache platforms, generic evidence frameworks, or SDKs without consumers.
- Broad research or ADHD repetition without a newly unresolved branch.
- Proving every test, coverage, integration, and browser family in the pilot.
- Backend selection before authorization, tenant, signature, payload, logging,
  and teardown gates pass.
- Hit-rate improvements that do not help the critical path or reliability.
- Treating branch-local Heavy workflow source as the actual hosted definition.
- Reusing qualification after toolchain, lockfile, or profile changes.

Carry the full [`risk register`](./research/risks-and-rabbit-holes.md).

## No-gos

- No cache enablement from task-name heuristics or current configuration alone.
- No whole-task replay of fixers, persistent services, or required external and
  security verdicts. Qualify their pure prerequisites separately.
- No cache hit or archive substitutes for hosted status, proof identity, or
  protected producer evidence.
- No unsigned downgrade, broad writer credentials, tenant escape, or secrets
  in artifacts, logs, traces, or git.
- No deployment, production uploads, credential changes, or cutover from this
  exploration. Those belong to scoped implementation contracts.
- No preselected migration or incumbent retirement before rollback observation.
- No duplicate proof ledger, lane baseline, ontology, scheduler, or reopening
  of completed ship-velocity work.
