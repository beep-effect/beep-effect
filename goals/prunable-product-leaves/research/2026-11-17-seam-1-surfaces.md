# Seam 1: tolerant fixture surfaces, 2026-11-17

What seam 1 changed, how it was checked, and what it left. The rule is
[`decisions/2026-11-17-absent-subject-skipped-present-strict.md`](../decisions/2026-11-17-absent-subject-skipped-present-strict.md).

## The helper

`@beep/repo-cli-kit/CheckoutSubject` (`packages/tooling/library/repo-cli-kit/src/CheckoutSubject.ts`)
holds the rule once:

- `PacketRoot` (branded `goals/<slug>` or `explorations/<slug>`) and
  `packetRootOf` / `packetSubjectOf` derive a packet subject from a path.
- `CheckoutSubject` is a tagged union: `PacketSubject { root }` or
  `WorkspaceSubject { packageName }`. A workspace is named, never located.
- `PrunableLeaves` declares what a checkout may remove: workspaces by name
  and directory, and packet roots. `@beep/repo-cli-kit/ProductLeaves` holds
  the declaration for this repository: the product slices, drivers and
  dependent apps the SPEC lists, and the packets
  `goals/citation-extraction-engine`, `goals/claim-check-performance` and
  `explorations/legal-ontology-landscape`. Seam 2's boundary rule can read
  the same list.
- `CheckoutInventory` records the present packet roots, the workspace members
  discovery finds (name and directory), and the declared subjects the
  checkout pruned. A declared workspace counts as pruned only when its name
  is not discovered and its directory is gone; a declared packet, when its
  directory is gone. `loadCheckoutInventory(repoRoot, leaves)` reads it, and
  `isCheckoutSubjectPruned`, `prunedCheckoutSubjects`, `checkoutWorkspaceOf`
  and `prunedCheckoutSubjectsNote` answer the questions the surfaces ask.

So a check skips only for a pruned subject. An absent subject that nobody
declared (a typo, a renamed or archived packet, a renamed non-product
package) is not pruned, and its check fails as before. A product package
renamed in place is not pruned either, because its directory remains. The kit
test "places every present product leaf at its declared directory, and none
half removed" fails when a product leaf moves or is renamed without updating
the declaration. One case stays open: a product package that is renamed and
moved in one change reads as pruned until the declaration is updated, and its
skips name it.

Tests reach the rule through `packages/tooling/tool/cli/test/support/CheckoutSkip.ts`
(`skipWhenPruned`, `skipWhenCheckoutPruned`, `currentCheckoutInventory`,
`CurrentCheckoutLive` for a test whose ambient file system is in memory). A
skip is a Vitest skip whose note names each pruned subject.
`packages/tooling/tool/cli/test/checkout-skip.test.ts` proves that step with a
recording context: no skip while every subject is present or merely missing,
and one note naming each pruned subject otherwise.

## Surfaces covered

| Surface | Subject | Pruned-subject proof |
| --- | --- | --- |
| Goal-data consumer census rows, evidence, mutations, exclusions (`goal-data-consumer-census.test.ts`) | the row's packet and its consumer packages; an exclusion's owner package (checked against its source's package) and packet | per-item tests skip; the "checkout-subject rule for census rows" block proves the rule over a synthetic inventory, the stale-while-present and missing-name cases included |
| `PrivateHomePaths` exemption rows (`Laws/PrivateHomePaths.ts`) | the exemption file's packet, skipped only when it is a declared packet (`prunablePackets`, default from `ProductLeaves`) | `laws-private-home-paths.test.ts` scratch repository with a declared pruned packet and an undeclared missing one; the law prints `skipped_exemptions` and one line per skipped row |
| Law-practice integration shard plan (`ci-lane.test.ts`) | `@beep/law-practice-server`, read from its discovered directory | pruned run below |
| Committed partition plans (`ci-partitions.test.ts`) | `@beep/law-practice-server` | pruned run |
| Registry consumers and synthetic owners (`coverage-scope-goal-readers.test.ts`) | each consumer package | pruned run |
| Doctest include overrides (`doctest-lane.test.ts`) | each package, read from its discovered directory | pruned run |
| OIP plugin profile (`create-package.test.ts`) | `@beep/oip-web` | pruned run |
| Deprecated-APIs worker on the ciops lab (`lint-workers.test.ts`) | `@beep/ciops`, read from its discovered directory (not a product leaf, so it never skips) | pruned run |
| Live coverage shards (`quality-tasks.test.ts`) | `@beep/law-practice-server` | pruned run |
| Test-compiling build programs (`package-role-turbo-inputs.test.ts`) | each named witness; replaces the `>= 11` floor with twelve named witnesses, each required unless pruned | pruned run |
| Legal ontology manifest (`@beep/ontology` `SemanticFoundation.test.ts`) | packet `explorations/legal-ontology-landscape`, checked with `fs.exists` | pruned run |

`@beep/ontology` checks its one packet directly instead of importing the
helper: a foundation package's `check` waits on `^build`, and a test
dependency on `@beep/repo-cli-kit` would put that kit's whole build closure
on foundation's critical path for one existence check. The packet is a
declared product-leaf packet, and the census row for the same manifest uses
the full rule.

In the full checkout every one of these tests runs; none is skipped.

## Pruned run of the seam

A disposable worktree of the seam's head with the product leaves the SPEC
lists (four slices, thirteen drivers, twelve dependent apps) and their three
packets removed, sharing the lane's `node_modules`. Every surface above that
names a product leaf skipped with its note; the ciops worker and the
`runner-burst` record ran and passed; the law printed 13 skipped exemptions and
passed. The full repo-cli suite there ran 10,411 tests: 46 suites failed to
load (seam 2) and 29 tests failed in 11 more suites, each attributed in the
next section.

## Left for later seams or the rehearsal

- **Seam 2.** Suites that fail to load because `@beep/repo-cli` imports
  `@beep/m365`, `@beep/uspto` and `@beep/box` (Drawings, Corpus service
  programs, Files, Research library); `topo-sort.test.ts` spawns the CLI and
  fails the same way. The `SyncDataToTs` courts and reporters targets write
  law-practice vocabulary files; their tests use temporary repositories, and
  the targets belong with the legal command groups.
- **Seam 4.** `architecture-operation-plan.test.ts` (8 tests) reads the
  architecture-lab accepted proof; `TemplateRetarget.ts` maps that template.
- **CI tables in repo-cli source (new, outside the four seams).**
  `CiLanePartitions.ts` assigns `@beep/law-practice-server`, `@beep/pacer`
  and others, and `proveCiLanePartition` fails closed on an absent package (9
  `ci-lane.test.ts` tests); `CiLane.ts` runs `apps/professional-desktop`
  codegen and IPC steps (`ci-docs-policy.test.ts` "codegen roots are
  workspaces"); `CHECK_CENSUS_DEFAULT_TARGETS` names
  `@beep/law-practice-domain`. These are not fixtures: they are kept-package
  data whose guards are right to fail on an absent package. See
  [`decisions/2026-11-17-ci-tables-seam.md`](../decisions/2026-11-17-ci-tables-seam.md).
- **Regenerated by the rehearsal.** `standards/entity-kit-freeze.baseline.jsonc`
  (`laws-entity-kit-freeze-command.test.ts`), the policy fingerprint seals
  (`policy-fingerprint-turbo-inputs.test.ts`), and root `package.json` catalog
  entries left without a consumer (`catalog-usage.test.ts`,
  `quality-command-dispatch.test.ts`).
- **Run artifacts.** `knowledge-doctor-evaluators.test.ts` and
  `knowledge-doctor-grouping.test.ts` compare HEAD's tree with the working
  tree, and the run deleted without committing. Four `ci-runner-security.test.ts`
  tests read workflows older than the test file the run copied in from main.
- **Tooling packets, not product packets.** `ci-runner-security.test.ts`
  (`goals/speed-loop/ops/runner-burst`), `WaveOrder.ts`
  (`goals/time-to-certainty`), `RouteCorpus.ts` (`goals/verification-route`),
  `Cache.conformance.corpus.ts` (`explorations/turborepo-quality-cache`) and
  `gate-order-handoff.test.ts` read the tool's own packets. They are not
  declared prunable, so they stay strict and fail loudly when absent.
- **Already tolerant.** The lint-rule legacy baselines
  (`no-manual-effect-runtime-in-tests`, `no-direct-process-io`) are consulted
  only while linting their files, and `BunResolver.ts` checks
  `apps/oip-web/vercel.json` exists before reading it.
