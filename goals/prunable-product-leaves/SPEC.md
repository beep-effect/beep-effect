# Prunable product leaves Spec

## Objective

A checkout that removes the product leaves (a downstream fork, a trimmed cloud
lane) must install, typecheck, lint and test without editing a kept package.

The architecture standard promises that slices stay removable, replaceable and
forkable (`standards/architecture/11-evolution-and-deprecation.md`, and the
isolation rule in `standards/architecture/08-testing.md`). For the product
leaves that promise does not hold today: kept tooling and generic slices import
them, aggregate their tables, or read their files from disk. This goal builds
five seams that make it hold (the fifth found while building the first), then a
guard that keeps it holding.

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
- **Subject.** What a tolerant surface checks against, named independently of
  the files the checkout currently holds. A packet subject is a packet root,
  `goals/<slug>` or `explorations/<slug>`, derived from the path the surface
  reads. A workspace subject is a workspace package name (`@beep/<name>`),
  declared by the surface (a census row's consumers, the package that owns a
  fixture); it is never derived from a directory, so a package that moves
  keeps its subject. Any other path belongs to the repository, which is always
  present.
- **Presence.** Checked separately from identity. A packet is present when its
  root directory exists in the checkout; a workspace is present when workspace
  discovery finds a member with that package name. A present subject keeps
  every assertion strict, stale-file checks included: a fixture or evidence
  file missing from a present packet or workspace still fails.
- **Pruned.** What a skip needs, beyond absence. The product leaves and their
  packets are declared prunable in `@beep/repo-cli-kit/ProductLeaves`
  (workspaces by name and directory). From seam 1b, a trimmed checkout or fork
  may also declare its own prunes in `standards/checkout-prune.jsonc`
  (`CheckoutPruneDeclaration`), which this repository does not ship. A subject
  is pruned when it is declared and its directory is gone; only a pruned
  subject skips, and a declared entry whose directory remains is a finding. An absent subject
  nobody declared (a typo, a renamed or archived packet, a renamed kept
  package) fails as before, and so does a declared package whose name is gone
  while its directory remains (renamed in place).
- **Prune rehearsal.** In a disposable worktree, in this order:
  1. `bun install` on the full checkout, so the `beep` CLI and its
     dependencies resolve for the steps below.
  2. Delete the product leaves and their packets.
  3. Regenerate the generated projections: root `package.json` workspaces,
     tsconfig references through `bun run beep tsconfig-sync`, the db-admin
     aggregation and its manifest edges through seam 4's generator, and the
     fallow boundary zones.
  4. Rewrite the ratchet baselines and inventories that list product paths
     with their own `--write` commands (for example
     `standards/entity-kit-freeze.baseline.jsonc` through
     `bun run beep laws entity-kit-freeze --write`, and the policy fingerprint
     seals through `bun run beep lint policy-fingerprint --write`); they may
     only shrink. Drop the root `package.json` catalog entries that
     `bun run beep quality catalog-usage` reports without a consumer.
  5. `bun install` again, so the lockfile and workspace links name no removed
     package.
  6. Check, lint and test every remaining workspace.

  Hand edits to kept packages are not part of the rehearsal.

## Non-Goals

- Deleting or moving any product leaf out of this repository. They stay here
  and keep their tests.
- Guarding drivers, apps or `_internal` packages that are not in the guarded
  subset. `packages/_internal/db-admin` aggregates product tables by doctrine.
- Making tooling runtime inputs that live in tooling packets optional
  (`goals/time-to-certainty`, `goals/verification-route`,
  `explorations/turborepo-quality-cache`). They are the tool's own data and
  must fail loudly when absent.
- Workflow YAML under `.github/workflows/`. A fork edits its own workflows.
  The CI tables in repo-cli source are seam 5
  (`decisions/2026-11-17-ci-tables-seam.md`).

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
   `packages/tooling/**` finds. The surfaces covered and the ones left, with
   reasons: `research/2026-11-17-seam-1-surfaces.md`.
   - **1b. A checkout declares its own prunes.** An optional tracked
     `standards/checkout-prune.jsonc` (`CheckoutPruneDeclaration`: prune,
     keep and owned entries of git `:(glob)` pathspecs, each with a reason)
     lets a trimmed checkout or fork name what it removed without editing a
     kept package. The surfaces seam 1 left (repo-root config fixtures, the
     pilot-packet tests, the census exclusions, and the doctor and roadmap
     link checks) tolerate declared prunes as well
     (`decisions/2026-11-18-checkout-prune-declaration.md`).
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
   land with this seam. Every db-admin file group that names a product leaf
   leaves with that leaf:
   - **Manifest edges.** The generator writes db-admin's `dependencies` and
     `devDependencies` on slice tables and domain packages from the present
     slices, as `tsconfig-sync` writes references; the rehearsal runs it before
     `bun install`, so no edge names a removed workspace.
   - **Leaf migration modules** (`src/migrations/<Leaf>*.ts`) and the
     `test/**` and `test/integration/**` files that import them or a leaf's
     tables move into the owning slice (its `tables` package), so deleting the
     leaf deletes them. db-admin keeps the kept slices' modules (epistemic,
     execution-authority) and their tests, the slice-neutral modules and the
     generated registry; seam 4 may move every slice's modules the same way,
     and records that choice as a decision.
   - **Generated migration SQL** (`drizzle/`). The generator rebuilds the
     aggregate from the present slices' migration sources, or each slice owns
     its own migration folder that the registry aggregates; seam 4 records the
     choice as a decision. Either way the rehearsal's generator step leaves no
     SQL for a removed leaf, and db-admin's live migration tests read only the
     regenerated output.
5. **CI tables follow the present workspaces.** The lane partition table
   (`commands/Ci/CiLanePartitions.ts`), the Desktop codegen and IPC steps in
   `commands/Ci/CiLane.ts`, the sharded partition sources and the check-census
   default targets name product packages, and their proofs fail closed on an
   absent package. They are derived from, or filtered by, the present
   workspaces, so a pruned checkout proves them without an edit while the full
   checkout keeps every guard.

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
- `packages/tooling/tool/cli/src/commands/Ci/**` and
  `packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts` (seam 5).

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

Operator decision, 2026-11-17. A census row, law exemption or test fixture whose subject the checkout pruned is skipped and reported as skipped, not failed. Pruned means declared prunable (the product leaves and their packets, @beep/repo-cli-kit/ProductLeaves) and its directory gone; an absent subject nobody declared still fails, so a typo or a rename never reads as pruning (review of #3379). A subject is the packet (goals/<slug> or explorations/<slug>) a path lives in, or a workspace named by its package name, which the surface declares (a census row's consumers, the package that owns a fixture); any other path belongs to the repository, which is always present. Identity never comes from the files the checkout holds: a packet is present when its directory exists, a workspace when workspace discovery finds a member with that name. Keying on the owning packet or package name, not on the path itself, keeps the full checkout exactly as strict as today: a renamed evidence file, a deleted fixture inside a present packet or workspace, or the old path of a package that moved still fails, because its subject exists. Each tolerant surface carries a test that simulates an absent subject and one that proves a stale row on a present subject still fails. One shared presence helper serves every surface.

Lane feat/prunable-product-leaves

Reverse: Remove the presence check from each tolerant surface; every row, exemption and fixture is asserted unconditionally again.

### CI tables in repo-cli source become a fifth seam, 2026-11-17

Found while building seam 1 (research/2026-11-17-seam-1-surfaces.md). Kept repo-cli source names product packages in its CI tables: the lane partition table (commands/Ci/CiLanePartitions.ts), whose proof fails closed on an assigned package that is absent; the Desktop codegen and IPC steps in commands/Ci/CiLane.ts; the sharded partition sources in commands/Ci/CiPartitions.schemas.ts; and the check-census default targets in commands/Quality/CheckCensusGate.ts. These are not fixtures, so seam 1's skip rule does not fit them: in the full checkout a guard that fails on an absent package is right. A pruned checkout needs the tables derived from, or filtered by, the present workspaces instead. Agent call: they become seam 5, built after seam 4 with the same projection approach. Workflow YAML stays out of scope. Until seam 5 lands, the prune rehearsal fails ten ci-lane and ci-docs-policy tests for this reason alone.

Lane feat/prunable-seam-1

Reverse: Drop seam 5 and restore the CI-configuration non-goal; a fork then edits its own CI tables by hand.

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

### A trimmed checkout declares its own prunes in standards/checkout-prune.jsonc, 2026-11-18

Supersedes the absence rule in 2026-11-17-absent-subject-skipped-present-strict.md and extends the ProductLeaves catalog that #3379 shipped. The review of #3379 showed that a skip keyed on absence turns a stale or misspelled name into a silent skip, and #3379 now skips only for subjects listed in @beep/repo-cli-kit/ProductLeaves whose directory is gone. A code catalog has a limit: a trimmed checkout or fork can drop only what that kept file lists, and it cannot add its own drops without editing a kept package. Agent call: a checkout may carry one optional tracked declaration at standards/checkout-prune.jsonc. This repository ships none, so every assertion here stays as strict as #3379 left it. Its schema is CheckoutPruneDeclaration, in a new @beep/repo-cli-kit/CheckoutPrune module: { version: 1, prune: [CheckoutPruneEntry], keep: [CheckoutPruneEntry], owned: [CheckoutPruneEntry] }, where CheckoutPruneEntry is { path, why }, and path is a repository-relative git :(glob) pathspec (** crosses segments, * does not). A path is declared pruned when it matches a prune or owned entry and no keep entry. loadCheckoutInventory reads the declaration. A subject skips when its directory is gone and it is either in productLeaves or declared pruned. An absent subject that is not declared still fails. A declared entry whose matched directory still exists is a finding, so a declaration cannot hide a live path. Each tolerant surface class gets both tests: absent and declared skips with the note, absent and undeclared fails.

Lane feat/prunable-prune-declaration

Reverse: Delete the CheckoutPrune module and stop reading the file; ProductLeaves alone decides what may be pruned again.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Boundary-rule allowlist | Edges seams 3 and 4 remove | This goal | The rule ships before every edge is gone so no new edge lands meanwhile | Seam 4 merges with the allowlist empty |
