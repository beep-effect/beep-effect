# Tstyche removal — inventory and coverage-loss assessment

Captured 2026-08-03 on `chore/improve-speed-of-things` (clean tree + this
packet). Static analysis only; the timed lane runs in §6 were executed after
the instantiation census finished so they would not contend with it. Full
detail lives in the committed data files:

- [`data/tstyche-surface-inventory-full.md`](./data/tstyche-surface-inventory-full.md)
  — the complete surface inventory (every file, config key, lane, generator,
  and doc hit, with line references and bulk lists A–D).
- [`data/tst-coverage-assessment.tsv`](./data/tst-coverage-assessment.tsv) —
  per-file verdicts for all 142 `*.tst.ts` files (origin, assertions, runtime
  coverage, evidence, verdict).

## 1. Surface size (verified counts)

| Surface | Count |
| --- | ---: |
| `*.tst.ts` files (all import tstyche except one plain probe) | 142 |
| `dtslint/.gitkeep` sentinels (semantically load-bearing — tsconfig-sync uses directory existence as its coverage signal) | 101 |
| Package `tsconfig.test.json` files including `dtslint` | 57 |
| Package manifests with `dtslint`/`type-test` scripts | 22 |
| Extra non-tstyche dtslint artifacts (`Path.test-d.ts`, `md/dtslint/tsconfig.exports.json`, `infra/dtslint/*`, `scratchpad/codemode/*`) | 7 |
| Generators that emit/maintain the surface (`create-package`, `tsconfig-sync`, `architecture`) | 3 |
| Root configs (`tstyche.json`, `tsconfig.dtslint.json`, root `tsconfig.json` includes, `turbo.json` `type-test` task) | 4 |

Dependency edges: exactly one declared tstyche edge (root
`devDependencies.tstyche = catalog ^7.2.2`). Removal fallout:
`@microsoft/microsoft-graph-types` in `@beep/m365` becomes statically orphaned
(only import is `M365.tst.ts`), and three package-local `@lexical/*` edges in
`@beep/lexical-schema` lose their only importer. Details and retained-edge
caveats: full inventory §4.

## 2. Where the cost actually runs (lane wiring)

Neither tstyche nor dtslint-tsgo appears as a named CI job — both hide inside
other lanes:

- **Hosted `Test Unit`** runs tstyche: `ci lane test-unit` passes
  `--unit --types`, and `--types` maps to the Turbo `type-test` task
  (`CiLane.ts:848`, `Quality/Tasks.ts:207-220,1536-1550`, `turbo.json:141-145`).
- **Local root `check`** (and therefore **yeet verify pre-push**) runs
  `quality dtslint-tsgo` — a synthetic-tsconfig tsgo pass over every dtslint
  file — plus the tstyche `type-test` tasks through root `test`
  (`Quality/Tasks.ts:1245-1258`, `GithubChecks.ts:191-211`). The hosted Check
  lane bypasses the dtslint-tsgo extra (it runs only Turbo `check`), so
  dtslint-tsgo is a **local-only** cost.
- Yeet repair/dev/review-fix add `--types` to test feedback
  (`Yeet/internal/Planner.ts:284-288`, `Quality.command.ts:687,762`).

## 3. Measured cost of the surface (fleet + hosted evidence)

- `@beep/repo-cli#type-test` is the **#2 cumulative Turbo task sink in the
  fleet**: 27 recorded executions, p50 35.1s, p95 38.7s, 3.7% cache-hit
  ([`data/fleet-turbo-task-timings.tsv`](./data/fleet-turbo-task-timings.tsv)).
  Cause: `packages/tooling/tool/cli/package.json:130` runs
  `cd ../../../.. && bunx tstyche` — re-running the **root** config from one
  workspace task.
- Fleet-wide `type-test`: 546 recorded executions, 38.9 min total task time,
  21% cache-hit; typical miss ~4s/package, p95 21s.
- Prior art already shrank this surface once (`repo-quality-throughput`:
  type-test participation 87 → 34 tasks, tstyche invalidation 356 → 13); the
  remaining cost above is *after* those wins.
- Timed single runs on this workstation (32c/64t/128GB, quiesced, after the
  census; single samples, labeled estimates): see §6.

## 4. Coverage-loss assessment (all 142 files)

Verdicts (conservative — uncertainty ⇒ `review`): **25 safe-delete,
117 review**. Origin split: 19 generated/scaffold-shaped, 123 handwritten.

- **Safe-delete groups**: all 14 architecture-lab/proof codegen instances
  (marked `writer: "template"` in `AcceptedProofManifest.ts`), the db-admin
  migration-target scaffold, smoke-only files (AgentsServer, HubSpot, Sanity,
  EpistemicConfig, RDF, Number, RootBarrel), and three ontology/workspace
  server smoke files identical in shape to generated scaffolds.
- **Tier 1 — irreplaceable loss (27 files)**: the `@beep/schema` generic-helper
  contracts (LiteralKit, EntitySchema, SchemaUtils, VariantSchema, Fn,
  TaggedErrorClass, StatusCauseTaggedErrorClass, CauseTaggedError, JSONSchema,
  Topology import-boundary guard), `@beep/utils` Struct/Errors inference,
  Identity composer generics, Lexical 0.48 declaration-compat guard, Md/Html
  overload+proof matrices, M365's 22 Graph key-drift guards, EntityTable
  projection generics, EntityKernel/LawPracticeDomain decoded-vs-wire
  matrices, repo-cli `Files.tst.ts` command contracts, VaultSyncEngine Layer
  channels, ExecutionAuthority security invariants, EpistemicTables bitemporal
  storage invariants.
- **Tiers 2–3 (90 files)**: substantial but portable — codec Type/Encoded
  relations, table derivations, service Effect channels, finite literal
  datasets. Ranked lists: `data/tst-coverage-assessment.tsv` and the two
  synthesis sections in the full inventory.

What runtime tests can and cannot absorb: runtime twins exist for nearly every
package, but they pin *behavior*; brands, overload matrices, exact
`Type`/`Encoded` relations, Effect error/requirement channels, negative
assignability (`@ts-expect-error` probes), and export-boundary prohibitions
are type-only and vanish with the files. The porting recommendation per
`review` row is in the TSV; the top targets are the Tier-1 list above.

## 5. Removal order plan

The 12-step ordered plan (generators first, then lanes, then files/sentinels,
then configs/deps, then docs, then residue gate) is in the full inventory §5.
Two invariants it protects:

1. `tsconfig-sync --check` must return 0 post-removal — today the planner
   unconditionally reads `tstyche.json` (`TsconfigSync.plan.ts:755-765`), so
   deleting the file without deleting the planner would fail check, and
   deleting tests without sentinels would regenerate empty matches.
2. The lane is deleted, not no-op'd: `dtslint-tsgo` command, root-check
   adapter step, `--types` parsing, Turbo task, and their tests all go.

Hazards (full inventory §6): dictionary terms guard immutable prose (keep
`_typos.toml`/cspell entries while history cites tstyche); six lexical
`type Test*` false positives must not be edited; JSDoc inventory is generated
fallout (regenerate, don't hand-edit); pending changesets that promise type
tests need their claims edited.

## 6. Measured win

Single timed runs on the quiesced workstation after the census completed
(single samples — labeled estimates; the durable before-evidence is the fleet
TSV in §3):

| Measurement | Before removal | After removal |
| --- | --- | --- |
| `bun run beep quality dtslint-tsgo` (local-only lane) | **49.9s wall** (205s CPU, 423%), 141 files | lane deleted |
| `bunx turbo run type-test --force --concurrency=3` (lane-equivalent) | **59.9s wall**, 21/21 tasks | task deleted |
| Hosted Test Unit lane (p50 of last 92 runs; runs on a 4vcpu runner) | 635s | expected to shed the type-test portion (measured post-merge) |
| `bun run beep yeet verify` wall time | fleet mean for timed `full:pre-push`: ~17 min | 15:02 green on the removal PR itself (huge diff, 94/181 turbo tasks cached; includes the one-time full-docgen escalation from touching turbo.json) — steady-state warm verifies shed the ~110s of deleted serial lanes plus their cache churn |

Honest framing: the direct saving is ~**110s of serial lane time per full
local verify** (check runs dtslint-tsgo; test runs type-test) plus type-test
cache churn — real but under two minutes warm. Hosted Test Unit is dominated
by vitest, not tstyche. The larger win is structural: 22 per-package scripts,
one Turbo task, three generator code paths, one dependency, and ~330 tracked
files stop existing, and repo-cli's 35s root-config re-run (fleet #2 task
sink) disappears with them. Both timings are single samples on a quiesced
32c/128GB workstation.

## 7. Decision required (grill agenda)

The gate before deletion — pick one, informed by §4:

1. **Delete all 142** and accept the documented loss (fastest; Tier-1 loss is
   real and recorded here for a future port).
2. **Delete all 142, port Tier-1 (27 files)** to a compile-only surface
   colocated with ordinary tests (e.g. vitest-adjacent `*.test-d.ts` checked
   by the existing per-package `check`, or `@ts-expect-error` fixtures) —
   keeps the crown jewels at a fraction of the lane cost, but the port is
   real work and re-adds some check time.
3. **Shrink the lane to Tier-1 only** — smallest diff, but keeps tstyche,
   both hidden lane wirings, the dep, and all three generators alive for 27
   files (worst maintenance-to-value ratio).
