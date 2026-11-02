# Generated Standards Artifacts — Refresh Policy

Decision (2026-07-25, from the `epistemic-bitemporal-edge-core` closeout
reflection, todo #5): whole-repo generated artifacts under `standards/` are
refreshed **only in dedicated chore PRs**, never on feature branches.

## Scope

| Artifact | Regenerator | Character |
| --- | --- | --- |
| `standards/schema-catalog/<package>.generated.jsonc` | `bun run beep lint schema-catalog --write`; the `schema-catalog` pre-commit hook runs it scoped to the staged sources' packages and stages the shards | one shard per owning package; gated by the `lint:schema-catalog` cheap gate and hosted Repo Sanity, so a PR refreshes the shards it changes |
| `standards/instrumentation-catalog/<package>.generated.jsonc` | `bun run beep observability catalog --write`; the `instrumentation-catalog` pre-commit hook runs it scoped the same way | one shard per owning package; gated by the `observability:catalog-check` cheap gate and hosted Repo Sanity |
| `standards/jsdoc-documentation.inventory.jsonc` | `bun run beep quality jsdoc-inventory` | whole-repo snapshot; regen absorbs every package's drift |
| `standards/jsdoc-documentation.inventory.md` | same lane | small totals file; updating it in a feature PR is fine |

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
  checkout first, then rebase the feature branch.

## Evidence

On the `epistemic-bitemporal-edge-core` branch (PR #452), mid-flight
regeneration produced a ~27,790-line `jsdoc-documentation.inventory.jsonc`
diff of which only 416 lines belonged to the branch, and a ~2,246-line
schema catalog diff (then one file, now sharded) of which ~10 entries did. Both regens
were reverted; the full local proof and all 25 hosted checks passed without
them, proving the staleness is not gating
(`goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md`).

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

## Standing posture

Regen *tooling* (a single `beep quality regen-generated` operator command) was
evaluated and deliberately deferred: `goals/one-round-loop` C5 is `wont_fix`
until median PR CI round-trips exceed one (`goals/one-round-loop/ops/progress.json`).
A changed-files-scoped `jsdoc-inventory` refresh is the wished-for improvement
recorded in the reflection; adopt it there if that packet reopens.
