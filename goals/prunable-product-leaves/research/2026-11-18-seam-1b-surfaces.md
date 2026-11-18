# Seam 1b: a checkout declares its own prunes, 2026-11-18

What the first seam 1b pull request built, which surfaces read it, how the
full checkout stays as strict as before, and what the second pull request
covers. The contract is
[`decisions/2026-11-18-checkout-prune-declaration.md`](../decisions/2026-11-18-checkout-prune-declaration.md);
the calls made while building it are the 2026-11-18 decision files it links.

## The declaration

`@beep/repo-cli-kit/CheckoutPrune`
(`packages/tooling/library/repo-cli-kit/src/CheckoutPrune.ts`) holds the
file's schema and reader. The file is checkout-prune.jsonc under standards/,
which this repository does not ship.

- `CheckoutPrunePathspec`: a repository-relative git `:(glob)` pathspec. No
  leading slash or magic prefix, no backslash, no empty, . or .. segment,
  no trailing slash, and `**` only as a whole segment
  ([`decisions/2026-11-18-checkout-prune-pathspec-subset.md`](../decisions/2026-11-18-checkout-prune-pathspec-subset.md)).
- `CheckoutPruneEntry` `{ path, why, packageName? }`, with
  `matches(repoPath)`: equal, under the literal directory, or a glob match,
  as git matches. An entry with `packageName` must name a literal directory.
- `CheckoutPruneDeclaration` `{ version: 1, prune, keep, owned }`; a missing
  list is empty. `decodeCheckoutPruneDeclaration` reads JSONC, so strict JSON
  decodes too, and an unknown key fails. `loadCheckoutPruneDeclaration`
  returns the empty declaration when the file is absent and
  `CheckoutPruneDeclarationError` when a present file does not decode.
- `isCheckoutPathKept`, `isCheckoutPathDeclaredPruned` (prune or owned, no
  keep) and `isCheckoutPathOwned` are the path predicates. Entries with
  `packageName` declare workspaces, not paths.
- `checkoutPruneFindings` and `CheckoutPruneFindingsError`: a prune entry that
  matches a live path outside every keep entry, or names a discovered
  workspace. `liveCheckoutPruneFiles` expands the prune entries against the
  working tree, files only, skipping node_modules and .git, not following
  symbolic links, and leaving out files git ignores (build output a clone
  keeps after pulling a deletion)
  ([`decisions/2026-11-18-live-prune-entry-refused.md`](../decisions/2026-11-18-live-prune-entry-refused.md)).

## The subject rule

`@beep/repo-cli-kit/CheckoutSubject` gains:

- `RepositoryPathSubject { path }` and `repositoryPathSubject(path)`: a path
  outside every packet and workspace that a prune or owned entry matches.
- `CheckoutInventory.declaration`, defaulting to the empty declaration.
- `isCheckoutSubjectPruned` now also answers for a packet a prune glob
  matches and whose directory is gone, a workspace a prune entry names by
  `packageName`, an owned packet, workspace or path (pruned although it
  exists), and a declared repository path. A keep entry that names a
  workspace by package or matches its directory, or matches a packet root,
  removes that subject from every route, product leaves included.
- `checkoutSubjectOfPath` and `isCheckoutPathPruned`: the subject a path
  belongs to (its packet, a present or declared workspace, or a declared
  path) and whether a check of that path skips. A keep entry on the path
  keeps the check strict.
- `CheckoutFacts` and `checkoutInventoryOf(facts, leaves)`: the rule as a
  pure resolution over what a checkout holds, refusing a declaration whose
  prune entries name live paths. `loadCheckoutInventory` reads the facts
  from the working tree, `loadCheckoutInventoryWith` for a caller that
  already discovered the workspaces, and the knowledge doctor from the tree
  it checks. A checkout without a root `package.json` has no workspaces.

The partial case, a pruned packet whose directory survives only through a
kept file, stays present and strict
([`decisions/2026-11-18-present-packet-through-kept-file.md`](../decisions/2026-11-18-present-packet-through-kept-file.md)).

## Surfaces in this pull request

Each surface reads the inventory only when it has something to judge (a
missing link, an ownerless registration, drift, an unconsumed entry), so a
clean run in the full checkout reads nothing more. Each skip is counted on
the surface's own output.

| Surface | What skips | Tests |
| --- | --- | --- |
| `lint identity-registry` (`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts`) | `orphan-registration` and `labs-segment-extra` rows whose workspace is pruned or owned; a summary line counts and names them | `lint-identity-registry.test.ts`, "identity-registry lint in a trimmed checkout" |
| `lint policy-fingerprint` (`packages/tooling/tool/cli/src/commands/Lint/PolicyFingerprint.ts`) | committed inputs and package task ids that name a pruned or owned subject, on both sides of the drift comparison | `lint-workers.test.ts`, "ignores fingerprint drift on a pruned or owned workspace, and on nothing else" |
| `quality catalog-usage` (`packages/tooling/tool/cli/src/commands/Quality/CatalogUsage.ts`) | entries and overrides consumed only by the bun.lock record of a pruned or owned workspace, listed as `prunedConsumers` ([`decisions/2026-11-18-catalog-usage-lockfile-evidence.md`](../decisions/2026-11-18-catalog-usage-lockfile-evidence.md)) | `catalog-usage.test.ts`, "skips entries consumed only by pruned or owned workspaces, and reports every other" |
| `lint roadmap-refs` (`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts`) | a missing link target in a pruned or owned packet (`skipped_pruned`) | `roadmap-refs.test.ts`, the two trimmed-checkout cases |
| `goals doctor` (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts`) | every finding of a pruned or owned goal or exploration packet, and a link finding (`GoalDoctorFinding.target`, the exploration back-link) whose target is pruned (`skipped_pruned`) | `goals-doctor.test.ts`, "goals doctor in a trimmed checkout" |
| `knowledge doctor` (`packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.service.ts` and its domain module) | `broken-tracked-path` and `failed-assertion` rows whose path is pruned, and delegated goals-doctor findings of pruned or owned packets; the tree's own declaration is read and validated (`skippedPrunedCount`) | `knowledge-doctor.test.ts`, "knowledge doctor in a trimmed checkout" |
| `PrivateHomePaths` law (`packages/tooling/tool/cli/src/commands/Laws/PrivateHomePaths.ts`) | an untracked exemption row whose subject the checkout pruned or owns; the row lands in `skippedExemptions` | `laws-private-home-paths.test.ts`, "skips the rows of subjects the checkout's declaration prunes or owns, and no other" |

Every surface test covers the cases the contract names: absent and declared
skips with its count or note; absent and undeclared fails; a live owned
subject skips while the same subject without the owned entry stays strict; a
subject a keep entry carves out stays strict; a missing product leaf under a
keep entry fails. The kit tests
(`packages/tooling/library/repo-cli-kit/test/checkout-prune.test.ts` and
`checkout-subject.test.ts` beside it) cover the rule itself, the decode of a
valid, absent and invalid file, and the refusal of a declaration that names
live paths.

## The full checkout stays as strict

This repository ships no declaration, and every product leaf and packet is
present, so nothing is pruned and no surface skips. On the head of this pull
request:

- `bun run beep lint identity-registry`: OK, 210 workspace packages, no
  skipped line.
- `bun run beep lint roadmap-refs`: `blocking_findings=0`, no skipped line.
- `bun run beep quality catalog-usage`: `findings=0`, no skipped line; the
  live-checkout test asserts `prunedConsumers` is empty.
- `bun run beep goals doctor`: no new blocking findings, no skipped line.
- `bun run beep knowledge doctor --report --json`: 188 `broken-tracked-path`
  findings reported as before and no `skippedPrunedCount`, so the inventory
  was read and skipped nothing.
- `bun run beep lint policy-fingerprint --check`: current after the reseal
  for the new kit module.

## Left for the second pull request

The test-reader surfaces PLAN lists for seam 1b: the root `renovate.json`
read in `skills-relock.test.ts`, the `infra/r2-cache/policy-build-tools.txt`
and runner-burst packet reads in `ci-runner-security.test.ts`, the pilot
packet readers in `goals-bootstrap-plan.test.ts` and the `goals-graph.test.ts`
census, and the census exclusion rows in
`goal-data-consumer-census.test.ts`. They read the declaration through
`currentCheckoutInventory` already; the second pull request adds their
repository-path subjects and the per-surface tests.

## Not covered, with reasons

- `.fallowrc.jsonc` entries: nothing checks them against the checkout
  ([`decisions/2026-11-18-fallowrc-entries-need-no-tolerance.md`](../decisions/2026-11-18-fallowrc-entries-need-no-tolerance.md)).
- `beep delete-package` dropping a leaf: seam 5
  ([`decisions/2026-11-18-delete-package-leaf-owner.md`](../decisions/2026-11-18-delete-package-leaf-owner.md)).
- `merge=regenerate` for the remaining generated projections: seam 4
  ([`decisions/2026-11-18-regenerate-merge-driver-owner.md`](../decisions/2026-11-18-regenerate-merge-driver-owner.md)).
- The CI tables, workflow YAML, shard plans and partition data: seam 5 and
  the non-goals, unchanged here.
