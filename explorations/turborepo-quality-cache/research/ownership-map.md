# Ownership Map

This exploration graduated four implementation packets on 2026-09-08.
[MAP.md](../MAP.md) links their contracts and handoffs. The original ownership
review below still constrains implementation; graduation does not absorb
active contracts from adjacent initiatives.

| Surface | Current authority | This packet may | This packet must not |
| --- | --- | --- | --- |
| Turbo task census and cache-safety protocol | No durable qualification authority exists | Define census, states, experiments, and remediation candidates | Flip task cache policy before graduation |
| Exact-digest lane proof reuse | [`goals/time-to-certainty`](../../../goals/time-to-certainty/README.md) | Supply qualified Turbo computation facts and conformance receipts | Wire/replace `ProofLedger`, retire legacy stores, or change hosted-proof semantics |
| Required-context population, warm p95, and runner placement | [`goals/ci-lane-economics`](../../../goals/ci-lane-economics/README.md) | Consume its reproducible measurements and add reuse-layer attribution | Publish a competing lane census or move runners |
| CI operational/KPI ontology and planner semantics | [`explorations/beep-ci-operational-ontology`](../../beep-ci-operational-ontology/README.md) | Feed typed cache events and computation concepts | Create a second operational ontology or planner authority |
| Existing AWS cache authorization and infrastructure history | [`goals/ci-fleet-endgame`](../../../goals/ci-fleet-endgame/README.md), current Pulumi source | Audit topology and propose a disposable replica/lab | Mutate or probe-write production infrastructure in research |
| Historical remote-read and warmer enablement | completed [`goals/ship-velocity`](../../../goals/ship-velocity/README.md) | Reuse verified historical receipts after refreshing them | Reopen the completed initiative or copy stale posture claims |
| Yeet verification ordering, full-proof reuse, and hosted closeout | Yeet source plus `time-to-certainty` | Preserve invariants and identify pure prerequisite seams | Let cache hits satisfy required statuses or bypass exact-head proof |
| Turborepo skill | official `vercel/turborepo` skill tree plus `skills-lock.json` | Verify exact sync and document version scope | Fork repo-local guidance that drifts from upstream without a repo-specific extension need |
| Backend conformance lab | Proposed `turborepo-cache-conformance` goal | Freeze corpus/rubric and evidence schema | Deploy the lab before alignment/graduation |
| Signature, credential, tenant, and telemetry remediation | Proposed `turborepo-cache-trust-observability` goal | Define trust model and acceptance gates | Resolve or expose secrets, enable production signing, or turn on OTEL now |
| Task graph/cache adoption | Proposed `turborepo-quality-cache-adoption` goal | Define staged cohort and required evidence | Edit workflows, `turbo.json`, Yeet, or Quality in this research stage |
| Backend migration | Conditional `turborepo-cache-backend-migration` goal | Define the decision threshold and rollback window | Preselect a backend or create a migration goal before a passing comparison |

## Candidate handoff sequence after alignment

1. `turborepo-task-qualification` materializes the computation contracts,
   must-fail fixtures, and enforced qualification projection.
2. `turborepo-cache-conformance` builds the generated plus adversarial corpus
   and disposable lab against pinned stable/canary clients and backend releases.
3. `turborepo-cache-trust-observability` closes tag transport, tenant binding,
   signature epochs, typed receipts, redaction, and minimum stable telemetry.
4. `turborepo-quality-cache-adoption` changes task graph/configuration and then
   rolls qualified reuse local -> named hosted cohort -> broader profiles.
5. `turborepo-cache-backend-migration` is created only if the frozen rubric
   selects a replacement over an evolved incumbent.

The first three goals can research/implement independent fixtures in parallel
after their shared schemas are agreed, but adoption waits for qualification and
trust gates. Migration waits for the conformance verdict.

## Proposed code homes after the doctrine grill

The detailed placement review is in
[`architecture-grill.md`](./architecture-grill.md). The recommended first-slice
boundary is:

- pure reviewed qualification vocabulary/projections use an explicit
  `@beep/repo-configs/cache` facade;
- cache-specific discovery, experiments, transitions, conformance, receipts,
  and projection audits extend `@beep/repo-cli/commands/Cache`;
- Quality enforces, CI renders, and Yeet consumes through curated facades;
  none becomes the qualification-state writer;
- the incumbent and lab server/runtime adapters stay in
  `infra/lambda/turbo-cache` and `infra/src/CiTurboCache.ts`;
- generic digest/subject/receipt primitives may be reused from
  `@beep/skill-contract`, without moving cache-specific semantics there;
- no new tooling library or Remote Cache driver is created until a stable
  contract has two independent production consumers that cannot use these
  existing homes or a versioned JSON seam cleanly.

## Shared artifacts, single writers

| Artifact | Proposed writer | Consumers |
| --- | --- | --- |
| Computation qualification projection | Task qualification goal | Turbo config, Quality, Yeet, dashboards |
| Remote Cache conformance corpus/results | Conformance goal | Backend selection, upgrades, trust goal |
| Cache result/producer receipt schema | Trust/observability goal | Conformance lab, Quality, Yeet, ontology |
| Lane timing and required-context baseline | Existing lane-economics goal | Adoption and backend economics |
| Proof facts/ledger | Existing time-to-certainty goal | Yeet/Quality; cache projection is an input only |
| Backend selection decision | Alignment + conformance result | Conditional migration goal |

Any implementation prompt must name these writers explicitly. “Make everything
cacheable” is not authority to edit all five surfaces in one branch.
