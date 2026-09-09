# Turborepo quality cache adoption spec

## Objective

Adopt every eligible quality computation in its proven profiles and optimize the full Turbo/CI/Yeet workflow with measured benefits and fresh hosted statuses.

Graduated 2026-09-08 after the user approved the complete
[brief](../../explorations/turborepo-quality-cache/BRIEF.md) and [goal map](../../explorations/turborepo-quality-cache/MAP.md).
The [decision record](../../explorations/turborepo-quality-cache/DECISIONS.md) supplies inherited trust,
qualification, rollout and ownership requirements.

## Non-goals

Out of scope: replacement backend cutover, new proof ledger or scheduler, runner-placement ownership, and whole-task caching of external/security verdicts.
Preserve adjacent proof, timing/placement and ontology ownership. A new package
requires the approved consumer test and canonical generator. A cache hit never
substitutes for fresh required hosted proof.

## Source hierarchy

1. User objective and approved exploration decisions.
2. AGENTS.md, CLAUDE.md and required skills.
3. Binding architecture and package standards.
4. This SPEC.md.
5. PLAN.md, then GOAL.md.
6. Supporting evidence and the [source ledger](./research/SOURCES.md).

Higher sources govern conflicts. Refresh materially stale evidence without
reopening settled design decisions.

## Target surfaces

- [turbo.json](../../turbo.json): Root graph and exact-version schema/config policy.
- [package.json](../../package.json): Root delegation and package-manager/tool configuration where proven necessary.
- [.github/workflows](../../.github/workflows): Named quality callers, protected warmer and resolved workflow-aware cohort changes.
- [.github/actions/setup-monorepo-ci/action.yml](../../.github/actions/setup-monorepo-ci/action.yml): Actions archive key, restore/save timing and transport contract.
- [packages/tooling/tool/cli/src/commands/Cache/index.ts](../../packages/tooling/tool/cli/src/commands/Cache/index.ts): Measured warming/dashboard consumer of shared result and qualification contracts.
- [packages/tooling/tool/cli/src/commands/Quality](../../packages/tooling/tool/cli/src/commands/Quality): Qualified policy enforcement and lane reporting.
- [packages/tooling/tool/cli/src/commands/Ci](../../packages/tooling/tool/cli/src/commands/Ci): Hosted summaries and workflow identity.
- [packages/tooling/tool/cli/src/commands/Yeet](../../packages/tooling/tool/cli/src/commands/Yeet): Curated cache-fact bridge while preserving the existing proof owner.

This goal owns tests beside its implementation and its packet evidence.
Record every additional touched workspace in the verification and ownership
list. Only change scripts/configuration where this contract names their role.

## Implementation contract

### Comprehensive audit

Refresh the entire executable computation population across root/child Turbo
config, workspace scripts, nested commands, Quality, CI and Yeet. Reconcile
historical OPPORTUNITIES.md and misspelled opportunity-file leads with current
source, disposition and owner. Keep actual executions distinct from configured
nodes, and required hosted contexts tied to a current ruleset/run receipt.

For stable and exact published canary, inventory graph/dependencies/transit,
entrypoint/affected/filter semantics, global/task config, inputs, env and
passthrough, outputs, descriptions, persistence/watch, concurrency, worktrees,
artifacts, summaries/query tooling, pruning/deployment workflows, boundaries,
future/experimental flags, archive transport and warming. Record exact
availability, prerequisites, Beep use case, correctness test, expected benefit,
disposition and owner for each applicable feature. Unsupported/non-applicable
features need a reason. Main stays a non-scoring research appendix.

### Governed task changes

Use the qualification policy and transition API for all promotion and
suspension. Adoption supplies evidence and owns rollout, not a parallel state
store. Qualify each computation/layer/profile/epoch with the full comparison,
input perturbation, portability, concurrency, safe-log and shadow requirements.
Preserve real semantic inputs even when they reduce hit rate.

Inspect build compiler state and portable outputs; lint/check dependencies and
transit alternatives; property seeds/run counts; docgen discovery/order/writes;
coverage shard/aggregate/ratchet boundaries and shared paths; browser and
integration prerequisites; and separate no-write checks for mutating generators.
Fixers, services and required external/security verdicts remain fresh at their
current whole-task boundary. Cache eligible pure prerequisites separately.

Audit Actions cache keys/save timing including child configuration and output
ownership. Archive restore is transport, not a qualified task hit. Correct
schema/version alignment and config descriptions as part of the exact-version
review. Experimental flags change individually with regression evidence.

### Hosted and Yeet adoption

Prove local use first, then supported cross-worktree directions. Name the
hosted workflow/runner/source cohort before enabling remote reuse and consume
trust's production-ready signing/tenant/credential receipt. Preserve fork
isolation and protected writers. Record the reusable Heavy definition actually
resolved by the run; branch-local edits are not execution proof.

Required jobs must start and produce their own exact-source or merge-ref
status even when pure prerequisites hit. Quality lane reuse, Yeet full proof
and the time-to-certainty ProofLedger remain distinct authorities. Integrate
through curated facades and existing owners, never private Yeet imports or
new proof/lease/scheduler stores.

### Value and completion

Consume ci-lane-economics' baseline rather than publishing a competing timing
or runner-placement authority. Measure correctness/security, critical-path
seconds, reliability, compute/storage/transfer/operations cost, then hit rate.
Attribute real hits and remote faults using the conformance/trust result model.
Rank warming by measured protected-source demand and qualified profile, with
explicit time, byte, request and concurrency bounds and selection receipts.

Complete named local/hosted/broader cohorts inside proven profiles. Preserve
the seven-day nonproduction, seven-day cohort and fourteen-day broader backend
observation when the trust/backend change is rolled out; cite the owning
receipt rather than rerunning an already valid observation window. Do not
manufacture elapsed representative time from synthetic samples.

Every in-scope entry needs a final evidence-backed disposition. Eligible work
must be qualified and adopted; exclusions need reasons and pure decomposition
where viable. Unassessed/candidate/shadow/suspended entries and temporary
exceptions are unfinished work, unless a new explicit scope decision removes
them with rationale. A lower hit rate never justifies a correctness regression.

## Dependencies and ownership

P0 and feature/source inventory can start independently. P1 consumes the
qualification contract; broad promotion waits for its validated runner/pilot.
P3 requires passing protocol and current production trust readiness. Coordinate
cohort execution with trust's rollout rather than introducing a cycle between
whole-goal completion gates. Replacement cutover, if selected, stays in the
conditional migration goal; keep safe independent local improvements moving.

The [program map](../../explorations/turborepo-quality-cache/MAP.md) defines cross-goal handoffs. Assign one
writer to each shared file/artifact before concurrent work. A pending sibling
goal does not justify duplicating its schema, state or evidence.

## Constraints and governing references

- [Architecture constitution](../../standards/ARCHITECTURE.md) and
  [placement rationale](../../standards/architecture/07-non-slice-families.md).
- [Agent laws](../../AGENTS.md), schema-first/Effect-first skills for relevant
  implementation, and Yeet for quality/publishing work.
- [Remote-cache operator contract](../../standards/turbo-remote-cache.md).

Detailed contracts for this goal:

- [task-census.md](../../explorations/turborepo-quality-cache/research/task-census.md)
- [cache-qualification.md](../../explorations/turborepo-quality-cache/research/cache-qualification.md)
- [opportunity-disposition.md](../../explorations/turborepo-quality-cache/research/opportunity-disposition.md)
- [observability-and-economics.md](../../explorations/turborepo-quality-cache/research/observability-and-economics.md)
- [ownership-map.md](../../explorations/turborepo-quality-cache/research/ownership-map.md)
- [architecture-grill.md](../../explorations/turborepo-quality-cache/research/architecture-grill.md)

Use schema-first models, typed errors/tagged outcomes, Effect helpers/services,
explicit config boundaries and curated exports. Search live source/barrels
before adding helpers. Keep the standalone Lambda build boundary explicit;
exchange versioned JSON instead of CLI implementation imports. Reuse generic
evidence vocabulary only where it fits.

Artifact HMAC does not prove complete task inputs or a protected producer.
Separate task reuse, archive transport, lane proof, Yeet full proof and hosted
status. Keep raw artifacts/logs/traces out of git; store bounded sanitized
receipts and retention-controlled raw references. Resolve op from PATH and
follow the approved agent lane. Never reveal secret values or repair an agent
secret failure through desktop sign-in.

## Acceptance criteria

- [ ] Current executable/lane population and applicable stable/canary feature matrix are complete, source-backed and assigned to owners.
- [ ] Every adopted computation has valid tuple-specific qualification, semantic invalidation, output/log safety and supported portability/concurrency evidence.
- [ ] Root/child graph, scripts, env, outputs, persistence and Actions transport match the reviewed qualification projection.
- [ ] Named hosted cohorts preserve fork/read/write policy and emit fresh required statuses tied to the source and resolved workflow actually executed.
- [ ] Demand-based warming and result attribution have bounded costs and demonstrable critical-path/reliability value using the owning baseline.
- [ ] Every in-scope computation has a final disposition, eligible work is adopted, and representative observations and rollback evidence are complete.
- [ ] Relevant package/protocol checks pass; failures are attributed and no
  introduced regression remains.
- [ ] The final implementation PR reaches Yeet `merge-ready: yes`, with
  required checks and reviews handled.
- [ ] Final evidence, reflection and lifecycle closeout land in that same PR.

Packet creation satisfies no implementation criterion. A partial or blocked
result remains active/paused with receipts, not completed-retained.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet conventions | `bun run beep goals doctor`; `bun run beep explore --check` | No new findings; attribute inherited fleet findings. |
| Launcher | `wc -m < goals/turborepo-quality-cache-adoption/GOAL.md` | At most 4,000 characters; target at most 3,500. |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Pass after editing this package; include every other edited workspace. |
| Behavioral proof | Acceptance-specific tests and experiments | Negative cases fail for the intended reason; source review cannot fabricate runtime proof. |
| Reflection and evidence | `bun run beep lint reflection-artifacts` and receipt review | Valid, safe evidence and a closeout reflection at completion. |
| Hosted acceptance | Yeet repair, verify, publish and monitor per current skill | Final head is merge-ready with required proof and handled reviews. |

For infra/Lambda edits, use its existing verification lane and inspect build/temp
targets first. A bundle build is not deployed conformance. Docs-only preparation
needs JSON/link/projection checks; actual implementation needs behavioral proof.

## Rollback

Suspend the affected qualification tuples, disable their remote use and
revert the smallest graph/consumer change to the reviewed prior policy.
Recompute authoritative results, preserve required job startup/status, and
record the fault and cost. Stop the warmer before it propagates a bad epoch;
do not purge a shared cache or relax inputs to conceal a regression.

## Stop conditions

- Semantic divergence, failed invalidation, sensitive capture or unauthorized
  read/write/tenant access appears. Stop affected reuse and preserve a receipt.
- Required exact-version or dependency evidence is missing. Continue independent
  work but do not cross the gate.
- A concrete deployment/rollout exceeds scope or an unresolved numeric budget.
  Prepare the change/preview before requesting a missing material decision.
- A change would overwrite another owner's artifacts, weaken required statuses,
  or bypass the approved secret or runner-admission paths.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None approved | This goal | Goal executor | Record real exceptions before using them. | Every temporary exception needs a bounded removal condition. |
