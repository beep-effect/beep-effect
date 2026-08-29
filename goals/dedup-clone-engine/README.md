# Dedup Clone Engine

## Status

Lifecycle: `completed-retained`

**Complete (V1).** Phase 1 (detector + `beep reuse clones`), Phase 2 (baseline +
`lint:clones` CI gate), tests + threshold tuning, and Phase 3 Type-3 fuzzy
(`--fuzzy`, report-only) are all shipped and merged (PRs #180, #183, #187). All
`SPEC.md` completion conditions are met. The only owned follow-up is the deferred
`--include-intra` toggle (intra-package near-misses); inbound-edges and codemod
extraction are redirected to `repo-codegraph` and `tooling/tool`. See
[PLAN.md](./PLAN.md) "Status — V1 COMPLETE".

On-demand reflection:
[`history/reflections/2026-08-29-codex.md`](./history/reflections/2026-08-29-codex.md).

## Mission

Give the repo a real instrument for **finding and removing code duplication**,
then keep duplication from returning by gating it in CI. The engine detects
declaration-level clones across packages, records a committed baseline, and
graduates to a blocking gate using the repo's existing ratchet pattern.

This packet exists because duplication reduction is the one quality goal that
has **not** stuck across three prior attempts (`beep reuse`, `repo-codegraph`,
`repo-exports.catalog`). The verified reason is narrow: the repo already
enforces redundant-wrapper laws (`beep laws terse-effect/dual-arity/...` run in
`bun run lint`), but it has **no detector for general copy-paste** — the only
duplication detector is three hand-coded regexes
(`packages/tooling/library/repo-utils/src/Reuse/Reuse.service.ts`), and it is the
one quality tool absent from the lint policy group. You cannot reduce what you
cannot measure.

## Approach (detect → baseline → enforce)

1. **Detect** — declaration-anchored structural hashing. Walk exported
   declarations via `TSMorphService.inspectProject`, normalize each body
   (whitespace/comments stripped, identifiers alpha-renamed, literal values
   blanked → catches exact + renamed copies, i.e. Type-1/Type-2 clones), and
   cluster identical normalized bodies that recur across ≥2 packages.
2. **Baseline** — emit clusters as `ReuseCandidate` (the existing model, new
   `structural-clone` kind), surfaced via `beep reuse clones`. Commit a
   `standards/clone.inventory.jsonc` baseline using the proven
   generate→diff→fail-on-drift idiom from `Lint/SchemaFirst.ts`.
3. **Enforce** — `beep reuse clones --check` fails on *new* clones above the
   baseline, wired as one step into `rootRepoLintPolicySteps`
   (`Quality/Tasks.ts`). Land warn-first; graduate to error after the baseline
   is triaged down — the same ratchet the laws already use.

## Non-Goals (V1)

- No near-miss (Type-3) fuzzy matching yet — exact-after-normalization only,
  so the gate stays deterministic and false-positive-free.
- No automated refactoring/codemod execution yet (reachable later via
  `TSMorphService.updateSourceFile`).
- Does not replace `repo-codegraph` lookup or the `repo-exports.catalog`.

## Relationship To Existing Packets

- **`repo-codegraph`** — owns agent-facing deterministic *lookup*. Its Phase 3
  plans ts-morph extraction of exported-declaration facts; this engine shares
  that declaration-walking concern. To avoid re-duplicating AST extraction (in a
  dedup goal, no less), the engine reuses `@beep/repo-utils` ts-morph
  infrastructure now and should converge on a shared extraction layer when
  codegraph Phase 3 lands.
- **`repo-context-topology`** — owns the generated export catalog. A later phase
  here may add `importedBy` edges to that catalog for blast-radius ranking.
- **Lint-policy harness** (`rootRepoLintPolicySteps`) — owns enforcement; this
  engine adds one gate step to it.

## Reading Order

- [SPEC.md](./SPEC.md) — binding contract and completion condition
- [PLAN.md](./PLAN.md) — phased delivery plan
