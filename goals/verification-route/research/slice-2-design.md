# Slice-2 design (2026-11-07)

The working contract for P1, lane `verification-route-s2`, branch
`feat/verification-route-slice-2`. `SPEC.md` stays normative; each call below
also has a decision file under `decisions/`.

## Three work packages, disjoint files

| Package | Files | What it lands |
| --- | --- | --- |
| R: route refinement | `commands/Ci/Route*.ts`, `test/ci-route-*.test.ts` | Taxonomy refinement, the first footprint refinement, the refinement registry, mutation fixtures, replay at the refined record |
| L1: turbo layer | `commands/TsconfigSync/**`, `turbo.json`, package-local `turbo.json`, the generated projection file, a dry-run test | Root `package.json` field projections and the global-input negation |
| FC: final-check | `commands/Yeet/internal/FinalCheck*.ts`, its tests | Route section of the receipt, shadow, per-refinement enforcement, sentinel |

## Soundness findings that shaped the choice

Read from the checkout on 2026-11-07, before any refinement was picked:

1. **`src:test` out of `build` is unsound.** Several app builds run
   `tsrs -p tsconfig.check.json` (for example `apps/docket-intake`,
   `apps/labs/ciops`), and those configs include `test/`, so a test-only edit
   can turn the build red. Their package-local `turbo.json` re-includes `test/`
   in `build` inputs, which is correct; the root `!test/**` is only sound for
   packages whose build reads `src` alone. Census rank 3 is rejected as stated.
2. **The `src:test` path rule is too broad.** It matches any path with a `test`
   directory, so `packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts`
   (compiled into `dist`) and `goals/**/test/items.json` (packet data) are
   `src:test`. Harmless while every lane names every kind; unsound the moment a
   lane drops `src:test`.
3. **Packet markdown reaches no build or check task.** `goals/`,
   `explorations/`, `research/` and `docs/_internal/` sit outside every
   workspace glob, so they are root-owned; turbo has no `//#build` or
   `//#check`, and no non-test source imports a `.md`/`.mdx` (`?raw`,
   `import.meta.glob`, `from "*.md"`; the only packet globs are in
   `packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts`, which reads
   `goals/*/ops/**` `.json`/`.ts`, not markdown, and only in tests).

## R: route refinement

### Taxonomy (census rank 1, no footprint claim)

New kinds, each added to every lane's footprint (unrefined), so the change is
sound by construction:

- `packet:data`: a non-markdown file under a packet root. Ordered before the
  `src:test` rule, so `goals/**/test/items.json` is packet data.
- `cfg:baseline`: `standards/**/*.json` and `*.jsonc`.
- `scratchpad`: a path under `scratchpad/` outside `scratchpad/src/`.
- `src:test` narrows to the owner's `test/` directory, a test file suffix, or
  (rootless paths) a `test` directory; a path under the owner's `src/` that is
  not a test file is `src:module`, whatever its sub-directories are called.

### First refinement: `packet` out of `build` and `check`

- Footprint: `build` and `check` drop `packet` (packet markdown only). They
  keep `packet:data`, because `goals/tsconfig.ops.json` and `goals/*/ops/**/*.ts`
  are TypeScript a check can someday read.
- Mutation fixtures (production path: `classifyChangedPaths` then
  `requiredLanes`): a packet-markdown edit skips `build` and `check`; a
  packet-data edit, a docs-markdown edit, and a mixed packet+source edit still
  select both.
- The file-grain half is already compiled: no build or check task's inputs
  contain a packet path. L1's dry-run test pins it: editing a packet markdown
  file invalidates zero `build` and `check` tasks.
- Replay: `beep ci route replay` at the refined record over the pinned corpus
  must print recall 100%; the figure and the footprint digest go into the PR.

### Refinement registry

A schema'd `RouteRefinement` list beside `ROUTE_FOOTPRINTS`: id, lanes,
removed kinds, fixture test names, recall evidence (corpus sha, footprint
digest, recall), and `mode: shadow | enforced`. The footprint record stays the
total record; the registry says which removals the route may act on.
`requiredLanes` stays pure over the record; an `enforcedRequiredLanes` view
re-adds the kinds of every refinement that is not enforced or is revoked.

### Revocation sentinel

`standards/verification-route.sentinel.json`, tracked: refinement ids revoked
with a reason. A revoked refinement is treated as shadow everywhere. Revoking is
a one-line commit, no code change.

## L1: turbo layer

- tsconfig-sync gains a writer for the root `package.json` field projections:
  every top-level field except `catalog` goes into one tracked generated file,
  `standards/root-package.projection.generated.json` (keys sorted, `scripts`
  included). `config-sync:check` drift-checks it.
- `turbo.json` `global.inputs`: replace `package.json` with
  `!package.json`-equivalent behaviour plus the projection file. Catalog edits
  reach tasks through `bun.lock`, which turbo already hashes per package. The
  negation and the projection land in one commit, never apart.
- Sweep the package-local `turbo.json` files: every override that names root
  `package.json` or repeats root inputs follows the same rule.
- Dry-run test under the pinned turbo (2.11.10): a biome catalog bump with the
  matching `bun.lock` change invalidates no `build` or `check` task, and only
  tasks of packages that depend on Biome; a packet markdown edit invalidates no
  `build` or `check` task.

## FC: final-check

- `FinalCheckReceipt` gains an optional `route` section: footprint digest,
  atoms by kind, per gate `selected | skipped | shadow-skipped` with the
  refinement id and the reason, and a `proofKey: "key-change"` note on each
  skipped gate (the proof ledger misses these as a key change, not as
  disagreement).
- Gate-to-lane map: `lint-policy`, `lint`, `repo-sanity`, `check`, `docgen`,
  `fallow` and `coverage` map to their lane ids; `expectation-rewrite` and
  `cheap-gates` are never routed.
- Shadow: a gate the route would skip under a shadow refinement still runs;
  when it fails, the receipt records the miss and the inbox gets a sentinel row
  naming the refinement. Enforced: the gate is recorded `skipped` with the
  route reason and does not run.
- Revocation reads the sentinel file at the head.

## Out of this slice

Propagation stays a label: no lane is selected from affected packages in
slice 2, so the head-graph read in SPEC's slice-2 list is not exercised. The
acceptance row is answered by a decision file, not by code.
