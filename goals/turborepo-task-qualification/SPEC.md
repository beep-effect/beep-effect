# Turborepo task qualification spec

## Objective

Make cache reuse an enforced, evidence-backed contract for each quality computation, reuse layer, environment profile and epoch.

Graduated 2026-09-08 after the user approved the complete
[brief](../../explorations/turborepo-quality-cache/BRIEF.md) and [goal map](../../explorations/turborepo-quality-cache/MAP.md).
The [decision record](../../explorations/turborepo-quality-cache/DECISIONS.md) supplies inherited trust,
qualification, rollout and ownership requirements.

## Non-goals

Out of scope: broad task-family activation, backend deployment, production credentials, and changes to Yeet proof ownership.
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

- [packages/tooling/policy-pack/repo-configs/src/index.ts](../../packages/tooling/policy-pack/repo-configs/src/index.ts): Existing pure policy pack; add a curated cache facade and its tests.
- [packages/tooling/tool/cli/src/commands/Cache/index.ts](../../packages/tooling/tool/cli/src/commands/Cache/index.ts): Existing command group; earn schemas, errors, services and experiment roles.
- [packages/tooling/tool/cli/src/internal/cli/TurboCache.ts](../../packages/tooling/tool/cli/src/internal/cli/TurboCache.ts): Reuse secret-safe posture logic, without duplicating credentials.
- [packages/tooling/tool/cli/src/commands/Quality](../../packages/tooling/tool/cli/src/commands/Quality): Scoped enforcement consumer only.
- [packages/foundation/modeling/identity/package.json](../../packages/foundation/modeling/identity/package.json): Real lint pilot; only evidence-required narrow configuration changes.
- [turbo.json](../../turbo.json): Effective config audit and pilot-scoped changes only; broad rollout belongs to adoption.

This goal owns tests beside its implementation and its packet evidence.
Record every additional touched workspace in the verification and ownership
list. Only change scripts/configuration where this contract names their role.

## Implementation contract

### Qualification and population

Join root/child Turbo configuration to actual workspace scripts and every
Quality/CI/Yeet entrypoint. Preserve graph-only nodes as graph structure.
Inventory nested commands and classify semantic file/env/toolchain/platform,
network/time/random inputs, output trees, logs, writes and fresh external
verdicts. Use the full population, not historical counts as a fixed denominator.

Implement the lifecycle `unassessed`, `excluded`, `candidate`, `shadow`,
`qualified`, `suspended` for computation/layer/profile/epoch. Pure policy lives
behind an explicit `@beep/repo-configs/cache` facade. Cache owns transition
validation and experiment execution; Quality only invokes its audit. The
reviewed projection must be checked against effective `cache`, `inputs`, `env`,
`outputs` and persistence settings. Root and child configuration participate.

Initial enforcement reports inherited unassessed cache settings and prevents
unreviewed expansion outside the pilot. It does not turn legacy cache settings
into qualifications or disable the whole repo without attributed evidence.
Confirmed unsafe behavior must be suspended at the narrowest affected boundary.

### Pilot evidence

Start with a synthetic fixture and `@beep/identity#lint` in one named profile.
Inspect the real script and root/dependency configuration before asserting
purity. Preserve normal execution as authority during shadow mode. Require
three isolated fresh/fresh pairs, three verified fresh/remote-hit pairs,
independent semantic-input perturbations, supported cross-root/concurrency
checks, safe output/log captures, and at least ten representative shadow
decisions with zero unexplained divergence. Stable and exact canary results
remain separate, and canary uses an isolated namespace.

Build all negative cases from the source protocol, including absent scripts,
changed root/child configuration, lockfile/runtime changes, orchestration-only
inputs, absolute paths and unsafe logs. Remote fault/signature cases consume
the conformance runner's authoritative results instead of duplicating it.
A rejected pilot needs a repair or a documented equally bounded replacement;
at least one real computation must qualify before this goal completes.

### Durable handoff

Adoption receives the census, governed policy API, candidate decomposition,
fixture runner and validated pilot. It owns broad cohort rollout and supplies
later evidence through the same transition mechanism. This goal's completion
establishes the mechanism and pilot; whole-program completion still requires
adoption's final disposition for every in-scope computation.

## Dependencies and ownership

P0/P1 can begin immediately when this goal is launched. Conformance and trust
may consume the early qualification contract without waiting for this entire
goal to close. P3 consumes a passing signed-fixture/lab boundary from those
siblings. Do not declare that dependency satisfied from a source-only review.
Continue local fixtures and discovery while remote proof is pending.

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

- [cache-qualification.md](../../explorations/turborepo-quality-cache/research/cache-qualification.md)
- [cache-qualification.json](../../explorations/turborepo-quality-cache/research/cache-qualification.json)
- [task-census.md](../../explorations/turborepo-quality-cache/research/task-census.md)
- [task-census.json](../../explorations/turborepo-quality-cache/research/task-census.json)
- [architecture-grill.md](../../explorations/turborepo-quality-cache/research/architecture-grill.md)
- [opportunity-disposition.md](../../explorations/turborepo-quality-cache/research/opportunity-disposition.md)

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

- [ ] Executable census is reproducible and covers actual CI/Quality/Yeet commands; missing scripts never count as executions or qualifications.
- [ ] Pure policy and operational transitions enforce the tuple/lifecycle, require evidence for promotion, and detect root/child config drift.
- [ ] The synthetic fixture proves success and mandatory failures, including invalidation and output/log comparison.
- [ ] At least one real pilot completes the full comparison/shadow matrix in its named profile with zero unexplained divergence and direct signed-remote evidence.
- [ ] Legacy entries remain honestly classified; confirmed unsafe entries are attributed and suspended, and no whole-family cache policy changes are hidden in the pilot.
- [ ] Adoption receives the population, policy API, decomposition leads, evidence references and invalidation rules.
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
| Launcher | `wc -m < goals/turborepo-task-qualification/GOAL.md` | At most 4,000 characters; target at most 3,500. |
| Package handoff | `bun run beep quality package-verify @beep/repo-configs` | Pass after editing this package; include every other edited workspace. |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Pass after editing this package; include every other edited workspace. |
| Behavioral proof | Acceptance-specific tests and experiments | Negative cases fail for the intended reason; source review cannot fabricate runtime proof. |
| Reflection and evidence | `bun run beep lint reflection-artifacts` and receipt review | Valid, safe evidence and a closeout reflection at completion. |
| Hosted acceptance | Yeet repair, verify, publish and monitor per current skill | Final head is merge-ready with required proof and handled reviews. |

For infra/Lambda edits, use its existing verification lane and inspect build/temp
targets first. A bundle build is not deployed conformance. Docs-only preparation
needs JSON/link/projection checks; actual implementation needs behavioral proof.

## Rollback

Suspend the affected tuple and restore its reviewed prior configuration.
Keep authoritative fresh execution available. Revoke only affected evidence
and preserve the reason/receipt; never mark a configuration revert as proof
that stale artifacts are safe. Use isolated fixture cache roots, not shared
cache deletion.

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
