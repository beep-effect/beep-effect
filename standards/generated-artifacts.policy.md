# Generated Standards Artifacts — Refresh Policy

Decision (2026-07-25, from the `epistemic-bitemporal-edge-core` closeout
reflection, todo #5): whole-repo generated artifacts under `standards/` are
refreshed **only in dedicated chore PRs**, never on feature branches.

## Scope

| Artifact | Regenerator | Character |
| --- | --- | --- |
| `standards/schema-catalog/<package>.generated.jsonc` | `bun run beep lint schema-catalog --write`; the `schema-catalog` pre-commit hook runs it scoped to the staged sources' packages and stages the shards | one shard per owning package; gated by the `lint:schema-catalog` cheap gate and hosted Repo Sanity, so a PR refreshes the shards it changes |
| `standards/instrumentation-catalog/<package>.generated.jsonc` | `bun run beep observability catalog --write`; the `instrumentation-catalog` pre-commit hook runs it scoped the same way | one shard per owning package; gated by the `observability:catalog-check` cheap gate and hosted Repo Sanity |
| `goals/<slug>/ops/manifest.json` `researchReports` | `bun run beep goals manifest --write` | per-packet projection of `research/`; gated by the `research-reports-drift` finding of `goals:doctor`; the file sits on the `regenerate` merge driver, so a concurrent edit is left conflicted and the writer resolves it after the merge |

The JSDoc documentation inventory and the effect-vitest census used to sit in
this table. They are no longer committed; see "Uncommitted scans" below.

Hand-maintained files (e.g. `standards/effect-laws.allowlist.jsonc`) are out of
scope — they are edited, not regenerated.

## The rule

- The two sharded catalogs are the exception: their gates fail on drift, so a
  feature branch commits the shards its own change touched (see "Per-package
  shards" below). The pre-commit hooks in `lefthook.yml` do this for every
  commit that stages a source file: each writer accepts the staged paths and
  `--stage`, regenerates only the owning packages' shards (seconds, not the
  full scan) and adds them to the index. Shard text never mixes packages, so
  the scoped write equals the full writer's output byte for byte, and two
  branches that regenerate independently stay identical. Three main reds on
  2026-11-02 (#2522, #2526, #2540, each fixed by a separate regeneration PR)
  came from PRs pushed with package-scoped checks only, which the hosted gate
  caught after the S11 merge had carried the stale shard to `main`.
- A feature branch must carry **only its own delta**. If `bun run beep yeet
  verify` and CI pass without regenerating a snapshot artifact, do not
  regenerate it — the gates on these artifacts are delta/ratchet-based, and
  staleness at `HEAD` is not gating.
- If a gate genuinely fails without a regen, stop: that means the artifact has
  become gating for unrelated drift. Land a dedicated
  `chore: refresh generated standards artifacts` PR from a clean `main`
  checkout first. After that PR merges, merge `origin/main` into the feature
  branch, preserving any published branch history.

## Evidence

On the `epistemic-bitemporal-edge-core` branch (PR #452), mid-flight
regeneration produced a ~27,790-line `jsdoc-documentation.inventory.jsonc`
diff of which only 416 lines belonged to the branch, and a ~2,246-line
schema catalog diff (then one file, now sharded) of which ~10 entries did. Both regens
were reverted; the full local proof and all 25 hosted checks passed without
them, proving the staleness is not gating
([goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md)).

## Per-package shards (2026-10-15)

Decision: the schema catalog and the instrumentation catalog are committed as
one shard per owning package instead of one whole-repo file each, and the
observability standard's generated section no longer carries span counts.

- Reason: both catalogs became merge gates (the schema catalog in hosted
  Repo Sanity since #1820, the instrumentation catalog in cheap gates since
  #1762), so every PR that added a schema or span regenerated one shared file
  and a shared count table. Each merge then made the other open PRs DIRTY and
  restarted their 20-minute review windows (six such events in one morning;
  #1590 was re-finalled four times). With shards, PRs that change different
  packages edit different files and merge cleanly; changes in the same
  package still merge line by line unless their sorted entries touch.
- Rejected: a `.gitattributes` regenerate merge driver (GitHub computes
  mergeability server-side and ignores local drivers, so PRs stay DIRTY) and
  generating the catalogs only on `main` (`main` is PR-only, and the committed
  per-package diff is how a reviewer sees which schemas or spans a PR adds).
- Both writers delete shards no package owns and the retired single files;
  both checks report them as orphaned, so a branch that resurrects a retired
  file while merging `main` fails until it runs the writer.
- Reverse: restore the single-file writers in
  `packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts` and
  `packages/tooling/tool/cli/src/commands/Observability/` from the commit
  before this change, delete `standards/schema-catalog/` and
  `standards/instrumentation-catalog/`, drop their `biome.jsonc` excludes
  (then `bun run beep cache profile --write`), and run both writers.

## Uncommitted scans (2026-11-14)

Decision: `bun run beep quality jsdoc-inventory` writes the JSDoc inventory
JSONC and its Markdown report under .beep/ci/, and
`bun run beep lint effect-vitest --census` writes the census under
.beep/effect-vitest/. Both directories are gitignored. The committed copies
that used to sit in standards/ (the JSDoc inventory pair and the effect-vitest
census) are deleted.

- Reason: no gate read the committed copies. Hosted `jsdoc-ratchet`
  regenerates into `.beep/ci/` and compares totals with the committed
  `standards/jsdoc-totals.regression-baseline.jsonc`. Nothing read the census.
  But `beep:preflight`, `delete-package` and the yeet staleness hint all ran
  the whole-file writers into `standards/`, so any lane that ran one picked up
  every other lane's drift. Measured on `main` at `e051bd152f3`: the JSDoc
  writer rewrote +38,526/−19,318 lines. It added 929 export and module rows and
  removed 80 (25 of them in deleted files). Of the 31,780 rows on both sides,
  1,607 differed only in `line`/`anchor` and 46 changed content, and 185 of
  202 packages had a shifted `topoOrder`. The census rewrote +10,816/−4,124 lines: 1,031 new
  files, 71 deleted files, 4 gitignored `dist/*.d.ts` rows from an earlier
  build, and 1,642 rows whose byte or line counts changed. Neither writer is
  nondeterministic apart from the JSDoc `generatedAt` stamp. All of that
  drift was ordinary content change, which per-row checks do not see because
  nothing checks these rows. The committed copy was a projection that went
  stale on every merge.
- Rejected: a row-scoped writer (it keeps a 717k-line file that nothing reads
  and still conflicts when two PRs touch one package's rows) and refresh-only
  chore PRs (the drift returns with the next merge, as it did after the
  2026-07-25 decision above).
- The small committed gate input stays: `jsdoc-totals.regression-baseline.jsonc`.
  Refresh it with `bun run beep quality jsdoc-inventory && bun run beep quality
  jsdoc-ratchet --write-baseline`; the ratchet's default `--inventory` is now
  the `.beep/ci/` copy.
- Reverse: set `outputJsonRelativePath` and
  `defaultJSDocDocumentationInventoryMarkdownPath` in
  `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`,
  `defaultJSDocInventoryPath` in `JSDocRatchet.ts` and `EffectVitestCensusPath`
  in `Lint/Lint.schemas.ts` back to their `standards/` paths. Restore the
  `jsdoc-inventory` surface and writer step in `delete-package`, the
  `FinalCheckRefresh` and `CoverageScope` rows and the `biome.jsonc` exclude
  (then `bun run beep cache profile --write`). Then run both writers.

## Standing posture

Regen *tooling* (a single `beep quality regen-generated` operator command) was
evaluated and deliberately deferred: `goals/one-round-loop` C5 is `wont_fix`
until median PR CI round-trips exceed one ([goals/one-round-loop/ops/progress.json](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/one-round-loop/ops/progress.json)).
The changed-files-scoped `jsdoc-inventory` refresh wished for in that
reflection is moot now that the inventory is not committed.
