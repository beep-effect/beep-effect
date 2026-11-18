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
- `CheckoutInventory` records the packet roots whose directories exist and
  the workspace members discovery finds, by name and directory.
  `loadCheckoutInventory(repoRoot)` reads it; `isCheckoutSubjectPresent`,
  `absentCheckoutSubjects`, `checkoutWorkspaceOf` and
  `absentCheckoutSubjectsNote` answer the questions the surfaces ask.

Tests reach it through `packages/tooling/tool/cli/test/support/CheckoutSkip.ts`
(`skipWhenAbsent`, `skipUnlessCheckoutHolds`, `currentCheckoutInventory`,
`CurrentCheckoutLive` for a test whose ambient file system is in memory). A
skip is a Vitest skip whose note names each absent subject;
`packages/tooling/tool/cli/test/checkout-skip.test.ts` proves that step with a
recording context: no skip while every subject is present, one note naming
each absent subject otherwise.

## Surfaces covered

| Surface | Subject | Absent-subject proof |
| --- | --- | --- |
| Goal-data consumer census rows, evidence, mutations, exclusions (`goal-data-consumer-census.test.ts`) | the row's packet and its consumer packages; an exclusion's owner package and packet | per-item tests skip; the "checkout-subject rule for census rows" block proves the rule over a synthetic inventory, stale-with-subject cases included |
| `PrivateHomePaths` exemption rows (`Laws/PrivateHomePaths.ts`) | the exemption file's packet | `laws-private-home-paths.test.ts` scratch repository with a pruned packet; the law prints `skipped_exemptions` and one line per skipped row |
| Law-practice integration shard plan (`ci-lane.test.ts`) | `@beep/law-practice-server`, read from its discovered directory | pruned rehearsal below |
| Committed partition plans (`ci-partitions.test.ts`) | `@beep/law-practice-server` | pruned rehearsal |
| Registry consumers and synthetic owners (`coverage-scope-goal-readers.test.ts`) | each consumer package | pruned rehearsal |
| `runner-burst` launcher record (`ci-runner-security.test.ts`) | packet `goals/speed-loop` | pruned rehearsal |
| Doctest include overrides (`doctest-lane.test.ts`) | each package, read from its discovered directory | pruned rehearsal |
| OIP plugin profile (`create-package.test.ts`) | `@beep/oip-web` | pruned rehearsal |
| Deprecated-APIs worker on the ciops lab (`lint-workers.test.ts`) | `@beep/ciops` | pruned rehearsal |
| Live coverage shards (`quality-tasks.test.ts`) | `@beep/law-practice-server` | pruned rehearsal |
| Test-compiling build programs (`package-role-turbo-inputs.test.ts`) | each named witness; replaces the `>= 11` floor with twelve named witnesses, each required while present | pruned rehearsal |
| Legal ontology manifest (`@beep/ontology` `SemanticFoundation.test.ts`) | packet `explorations/legal-ontology-landscape`, checked with `fs.exists` | pruned rehearsal |

`@beep/ontology` checks its one packet directly instead of importing the
helper: a foundation package's `check` waits on `^build`, and a test
dependency on `@beep/repo-cli-kit` would put that kit's whole build closure
on foundation's critical path for one existence check.

In the full checkout every one of these tests runs; none is skipped.

## Pruned rehearsal of the seam

A disposable worktree of the seam's head with the four product slices, the
thirteen drivers, the twelve dependent apps, `apps/labs/semantica`,
`apps/labs/ciops` and the packets `goals/citation-extraction-engine`,
`goals/claim-check-performance`, `goals/semantica-canary`, `goals/speed-loop`
and `explorations/legal-ontology-landscape` removed, sharing the lane's
`node_modules`. Every surface above skipped with its note; the law printed
13 skipped exemptions and passed. The full repo-cli suite there ran 10,405
tests: 46 suites failed to load and 25 tests failed in 10 more, every one
attributed below.

## Left for later seams or the rehearsal

- **Seam 2.** 50 suites fail to load because `@beep/repo-cli` imports
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
- **Rehearsal artifacts.** `knowledge-doctor-evaluators.test.ts` and
  `knowledge-doctor-grouping.test.ts` compare HEAD's tree with the working
  tree; the rehearsal deleted without committing.
- **Tooling packets, not product packets.** `WaveOrder.ts`
  (`goals/time-to-certainty`), `RouteCorpus.ts` (`goals/verification-route`),
  `Cache.conformance.corpus.ts` (`explorations/turborepo-quality-cache`) and
  `gate-order-handoff.test.ts` read the tool's own data; absent, they should
  fail loudly.
- **Already tolerant.** The lint-rule legacy baselines
  (`no-manual-effect-runtime-in-tests`, `no-direct-process-io`) are consulted
  only while linting their files, and `BunResolver.ts` checks
  `apps/oip-web/vercel.json` exists before reading it.
