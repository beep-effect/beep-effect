# Candor Gate Follow-Ups Closeout Spec

## Objective

Retire all five unowned follow-ons named by `patent-citation-candor-gate` and
the closeout handoff's Lint Policy divergence. Each item must end as shipped
behavior, a measured no-build decision, or a demonstrated already-fixed
finding; nothing may be merely renamed or re-deferred.

## Non-Goals

- Computing legal materiality, Rule 56 judgment, or practitioner authority.
- Treating one application's unrelated identifiers as equal by heuristic.
- Adding a database index before representative-volume planner evidence.
- Promoting a shared test helper solely to delete a small amount of fixture code.
- Reworking unrelated agent-runtime, database, or quality-policy surfaces.
- Merging the final PR without explicit operator authorization.

## Source Hierarchy

1. User request to complete all parked follow-ups.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and package-local agent guides.
4. Primary USPTO and WIPO identity specifications.
5. This `SPEC.md`.
6. `PLAN.md`, `GOAL.md`, `research/`, and predecessor evidence.

## Target Surfaces

- `packages/law-practice/{domain,use-cases,server,tables}` and focused tests.
- `packages/shared/use-cases` if the gate contract meets its promotion bar.
- The narrow agent candidate-output acceptance path that constitutes promotion.
- `packages/_internal/db-admin` only if measured planner evidence requires a migration.
- `packages/tooling/tool/cli` only if the current Lint Policy implementation or
  proof remains incomplete.
- Predecessor and successor goal evidence.

## Constraints

- Preserve the candor gate's derived, fail-closed behavior and human-only legal judgment.
- Identity equality must be traceable to primary authority. Because the USPTO
  series code does not determine ST.13's filing-year field, the two
  representations remain distinct instead of fabricating a conversion.
- Direct slice-to-slice imports remain forbidden. The cross-slice gate contract
  follows current shared-package law, superseding the predecessor's older
  `foundation/capability` exception proposal.
- Planner evidence must cover all three candor tables at representative tenant
  and filing cardinality and must record the chosen physical-design disposition.
- Shared Crypto promotion is decided from a live duplication/semantics census,
  not the predecessor's stale count.
- The Lint Policy finding is closed only when current code and tests explain the
  formerly divergent changed-scope and hosted full-scope behavior.

## Acceptance Criteria

- [x] Candidate output promotion consults a shared cross-slice gate and refuses a blocked verdict; a law-practice adapter maps `CandorPolicy` without leaking law vocabulary into the shared contract.
- [x] Examiner-observed current events enter the quantified gate set on their own and require a recorded human disposition; focused tests pin the widened behavior.
- [x] ST.13 identities carry an ST.3 office code, reject `US`, and remain distinct from USPTO-normalized identities; tests prove that no unsupported cross-representation equality is invented.
- [x] Representative-volume `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence exists for each candor read shape and the index/no-index decision follows that evidence.
- [x] The test-Crypto census ends in either an earned shared layer with multiple equivalent consumers or a documented no-build decision proving the abstractions differ or remain below threshold.
- [x] The Lint Policy divergence is reproduced or explained from current planner modes and pinned by focused tests; the old receipt is marked resolved with exact evidence.
- [x] The predecessor README routes all five items to this packet and, at close, contains no unowned candor follow-up.
- [x] Focused package checks and tests, the quality baseline, reviewer loop, and Yeet proof pass.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Domain | `cd packages/law-practice/domain && bun run check && bun run test` | Passes |
| Candor use cases | `cd packages/law-practice/use-cases && bun run check && bunx --bun vitest run test/CandorPolicy.test.ts` | Passes |
| Candor server | `cd packages/law-practice/server && bun run check && bun run test:integration` | Passes |
| Shared gate | Focused shared and agent checks/tests named by the implementation | Passes |
| Planner evidence | Successor research receipt plus focused PGlite test | All three read shapes measured |
| Lint planner | Focused repo-cli quality-task tests | Changed/full modes explicit |
| Packet | `bun run beep goals doctor && bun run beep lint reflection-artifacts` | Passes |
| Quality baseline | `bun run lint:fix && bun run audit:github quality` | Passes |
| End-to-end | `bun run beep yeet verify` then publish/monitor | Merge-ready, zero threads |

## Stop Conditions

- Primary authority does not establish a deterministic identity conversion.
- The only available integration would compute legal judgment or import one product slice from another.
- Planner evidence is unavailable or materially unlike the production query shape.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| First `shared/use-cases` product port, if implemented | Cross-slice promotion gate contract only | User request + PR review | Current architecture reserves this role for promoted cross-slice contracts; law-practice and agents are two real consumers | Remove if either consumer migrates to an event/command contract that eliminates the shared port |
