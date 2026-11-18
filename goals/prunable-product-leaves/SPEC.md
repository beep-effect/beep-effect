# Prunable product leaves Spec

## Objective

A checkout that removes the product leaves (a downstream fork, a trimmed cloud
lane) must install, typecheck, lint and test without editing a kept package.

The architecture standard promises that slices stay removable, replaceable and
forkable (`standards/architecture/11-evolution-and-deprecation.md`, and the
isolation rule in `standards/architecture/08-testing.md`). For the product
leaves that promise does not hold today: kept tooling and generic slices import
them, aggregate their tables, or read their files from disk. This goal builds
four seams that make it hold, then a guard that keeps it holding.

## Definitions

- **Product leaves.** The slices `packages/law-practice/*`,
  `packages/documents/*`, `packages/workspace/*` and
  `packages/architecture-lab/*`; the drivers `eyecite`, `govinfo`, `ecfr`,
  `gov-legal-mcp`, `pacer`, `uspto`, `uspto-mcp`, `hubspot`, `freshbooks`,
  `box`, `box-provisioning`, `m365` and `m365-mcp` under `packages/drivers/`;
  and the apps that depend on them, listed in
  [`research/2026-11-17-product-leaf-couplings.md`](research/2026-11-17-product-leaf-couplings.md).
- **Kept packages.** Every workspace that is not a product leaf. The guarded
  subset is tooling (`packages/tooling/**`), foundation
  (`packages/foundation/**`) and the generic slices `agents`, `epistemic`,
  `party`, `execution-authority` and `shared` (`@beep/ontology` is foundation).
- **Their packets.** The `goals/` and `explorations/` packets whose files a
  kept package's test, law or fixture reads for a product leaf. The census in
  the research note names them; the prune rehearsal removes them.
- **Subject.** What a tolerant surface checks against. A path under
  `goals/<slug>/` or `explorations/<slug>/` belongs to that packet; a path
  under a workspace belongs to the nearest ancestor directory holding a
  tracked `package.json`; any other path belongs to the repository. A subject
  is present when the checkout tracks it. The repository is always present.
- **Prune rehearsal.** In a disposable worktree: delete the product leaves and
  their packets, regenerate the generated projections (root `package.json`
  workspaces, tsconfig references, the db-admin aggregation, the fallow
  boundary zones), install, then run check, lint and test for every remaining
  workspace.

## Non-Goals

- Deleting or moving any product leaf out of this repository. They stay here
  and keep their tests.
- Guarding drivers, apps or `_internal` packages that are not in the guarded
  subset. `packages/_internal/db-admin` aggregates product tables by doctrine.
- Making tooling runtime inputs that live in tooling packets optional
  (`goals/time-to-certainty`, `goals/verification-route`,
  `explorations/turborepo-quality-cache`). They are the tool's own data and
  must fail loudly when absent.
- Pruning hosted CI configuration (`CI_LANE_PARTITIONS`, workflow files) for a
  fork. A fork regenerates or edits its own CI.

## Source Hierarchy

1. Operator decisions of 2026-11-17 that created this packet (recorded under
   `decisions/`).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and `standards/architecture/*`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Seams

Built in payoff order, one PR each (`PLAN.md` tracks status).

1. **Tooling fixtures tolerate absent product paths.** Every repo-cli test,
   law and fixture that reads a product leaf's or a packet's files from disk
   checks the subject first. An absent subject skips that row, exemption or
   fixture and reports it as skipped; a present subject keeps today's
   assertion unchanged. One shared presence helper serves every surface.
   Surfaces: the goal-data consumer census (`ciGoalDataConsumers` rows, its
   `mutations` and `exclusions`), the law-practice integration shard plan in
   `ci-lane.test.ts`, the `PrivateHomePaths` exemption rows, the
   `runner-burst` fixture in `ci-runner-security.test.ts`, the
   `legal-ontology-landscape` manifest in `@beep/ontology`'s
   `SemanticFoundation.test.ts`, and any further disk read the seam's sweep of
   `packages/tooling/**` finds.
2. **Legal CLI command groups become their own prunable package.** The
   repo-cli command groups that import product drivers (`Drawings`, the
   `Corpus` service programs, `Files process`, the Box research library) move
   to a package that registers into the CLI, so `@beep/repo-cli` has no
   product-leaf manifest edge. The import-boundary rule ships here.
3. **Party is provider-neutral.** `@beep/party-server` takes contact evidence
   through a party-owned schema; the M365 Graph mapping moves to the M365 side.
   The scratchpad party script stops importing law-practice and M365 packages.
4. **Generated aggregation, re-homed proof, agents thread model.**
   `packages/_internal/db-admin`'s schema barrel and migration registry become
   a generated projection of the slices present in the workspace. The
   architecture-lab accepted-proof manifest leaves repo-cli. The agents slice
   owns (or takes from `shared`) the thread model it reads from `workspace`.
   The doctrine amendment and its `standards/architecture/DECISIONS.md` entry
   land with this seam.

## Target Surfaces

- `packages/tooling/tool/cli/**` (all seams) and any `packages/tooling/library/*`
  home for the presence helper.
- `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts`
  (seam 1).
- A new workspace package for the legal CLI command groups, created with
  `bun run beep create-package` (seam 2).
- The import-boundary rule's host in the existing boundary tooling
  (`beep fallow boundaries`, `standards/fallow.boundaries.generated.jsonc`, or a
  `beep lint` law), and its allowlist (seams 2-4).
- `packages/party/server/**`, `packages/drivers/m365/**`, `scratchpad/**`
  (seam 3).
- `packages/_internal/db-admin/**`, its generator, `packages/agents/**`,
  `packages/workspace/**`, `packages/architecture-lab/**`,
  `standards/ARCHITECTURE.md`, `standards/architecture/07-non-slice-families.md`
  and `standards/architecture/DECISIONS.md` (seam 4).

## Constraints

- **Nothing gets weaker in the full checkout.** Every tolerant surface skips
  only on an absent subject. In this repository every subject is present, so
  every existing assertion runs exactly as strict as before, and a row that
  goes stale while its subject exists still fails. Each tolerant surface has a
  test that simulates an absent subject and a test that proves a stale row on
  a present subject still fails.
- **Skips are reported, never silent.** A skipped row, exemption or fixture
  names its subject in the test or law output.
- **Import-boundary rule.** Tooling, foundation and the generic slices may not
  depend on a product leaf: no manifest edge (`dependencies`,
  `devDependencies`, `peerDependencies`) and no source or test import. The rule
  ships with seam 2 with an explicit allowlist of the edges seams 3 and 4
  remove; each seam deletes its rows, and seam 4 leaves the allowlist empty.
- **Doctrine amendment (seam 4).** `packages/_internal/db-admin` stays the
  single migration aggregation home, but its schema barrel and migration
  registry are a generated projection of the slices present in the workspace,
  like tsconfig references. The amendment edits
  `standards/ARCHITECTURE.md` (the `db-admin` paragraph in the non-slice
  families section) and `standards/architecture/07-non-slice-families.md`
  ("Internal Admin Packages"), and adds a `standards/architecture/DECISIONS.md`
  entry, all in seam 4's PR.
- Repo laws apply: schema-first, Effect-first, `effect/HashSet` and
  `effect/HashMap` over native collections, `Effect.fn`/`Effect.fnUntraced`
  for generator functions, `bun run beep create-package` for new workspaces.
- At most three open PRs for this packet at once; Yeet for every PR.

## Acceptance Criteria

- [ ] The prune rehearsal passes: with the product leaves and their packets
      removed and the generated projections regenerated, `bun install`, check,
      lint and test pass for every remaining workspace.
- [ ] The import-boundary rule is green with an empty allowlist.
- [ ] In the full checkout nothing got weaker: every tolerant surface's
      absent-subject and stale-row tests pass, and no assertion was removed or
      relaxed for a present subject.
- [ ] The db-admin doctrine amendment and its `DECISIONS.md` entry are merged.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Seam 1 surfaces | `bun run beep quality package-verify @beep/repo-cli` and `@beep/ontology` | Passes, absent-subject and stale-row tests included |
| Boundary rule | The rule's command (named in seam 2's PR) | Green; allowlist empty after seam 4 |
| Prune rehearsal | Procedure above, transcript under `history/` | Install, check, lint and test pass |
| Packet launcher size | `test "$(wc -m < goals/prunable-product-leaves/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/prunable-product-leaves/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/prunable-product-leaves` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add prunable-product-leaves --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug prunable-product-leaves`; add a `kind: decision` file there, never edit this block._

### An absent subject is skipped and reported; a present subject stays strict, 2026-11-17

Operator decision, 2026-11-17. A census row, law exemption or test fixture whose subject is absent from the checkout is skipped and reported as skipped, not failed. A subject is the packet (goals/<slug> or explorations/<slug>) or the workspace (nearest ancestor with a tracked package.json) a path belongs to; any other path belongs to the repository, which is always present. Keying on the owning packet or workspace, not on the path itself, keeps the full checkout exactly as strict as today: a renamed evidence file or a deleted fixture inside a present packet or workspace still fails, because its subject exists. Each tolerant surface carries a test that simulates an absent subject and one that proves a stale row on a present subject still fails. One shared presence helper serves every surface.

Lane feat/prunable-product-leaves

Reverse: Remove the presence check from each tolerant surface; every row, exemption and fixture is asserted unconditionally again.

### Four decoupling seams, built in payoff order, 2026-11-17

Operator decision, 2026-11-17. The product leaves become prunable through four seams, built in this order, one PR each: (1) tooling fixtures tolerate absent product paths; (2) the legal CLI command groups become their own prunable package; (3) party is provider-neutral; (4) generated db-admin aggregation, re-homed architecture proof, and the agents thread model out of workspace. Seam 1 comes first because it changes only tests and laws and unblocks a pruned checkout's repo-cli test run; each later seam removes a class of manifest edges (research/2026-11-17-product-leaf-couplings.md). All four are built in this repository.

Lane feat/prunable-product-leaves

Reverse: Reorder or merge seams with a new decision file; already-merged seams stay.

### db-admin aggregation becomes a generated projection of present slices, 2026-11-17

Operator decision, 2026-11-17, a doctrine amendment. packages/_internal/db-admin stays the single migration aggregation home (standards/ARCHITECTURE.md, the db-admin paragraph of the non-slice families section; standards/architecture/07-non-slice-families.md, Internal Admin Packages). Its schema barrel (src/schema.ts) and migration registry become a generated projection of the slices present in the workspace, regenerated like tsconfig references, so removing a slice removes its tables and migrations from the aggregation without a hand edit. The amended doctrine text and its standards/architecture/DECISIONS.md entry land with seam 4's PR, not before.

Lane feat/prunable-product-leaves

Reverse: Restore the hand-written schema barrel and migration registry and revert the doctrine text and its DECISIONS.md entry.

### Kept packages may not depend on product leaves; the rule ships with seam 2 and an allowlist, 2026-11-17

Operator decision, 2026-11-17. Tooling (packages/tooling/**), foundation (packages/foundation/**) and the generic slices agents, epistemic, party, execution-authority and shared may not depend on a product leaf: packages/law-practice/*, packages/documents/*, packages/workspace/*, packages/architecture-lab/* and the drivers eyecite, govinfo, ecfr, gov-legal-mcp, pacer, uspto, uspto-mcp, hubspot, freshbooks, box, box-provisioning, m365 and m365-mcp. The rule covers manifest edges (dependencies, devDependencies, peerDependencies) and source and test imports, so a test-only edge cannot hide behind a devDependency. Agent call on the ratchet: the rule ships with seam 2, the first seam that removes import edges, so no new edge lands while seams 3 and 4 are open. It carries an explicit allowlist of the remaining edges (party-server to m365 for seam 3; agents-use-cases to workspace-domain and workspace-use-cases, agents-client to workspace-use-cases for seam 4), each row naming its seam. Seams 3 and 4 delete their rows; seam 4 leaves it empty. packages/_internal/db-admin is outside the guarded set: it aggregates product tables by doctrine.

Lane feat/prunable-product-leaves

Reverse: Delete the rule and its allowlist; the seams stay merged.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Boundary-rule allowlist | Edges seams 3 and 4 remove | This goal | The rule ships before every edge is gone so no new edge lands meanwhile | Seam 4 merges with the allowlist empty |
