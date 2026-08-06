# Corpus census

Measured 2026-08-06 against `main` at **`dbbad11e15`**. Every number below is reproducible with
the command given. Nothing here is estimated.

## These counts decay, and that is not noise

The corpus shrinks on its own. Cleanup-on-touch forces every PR to migrate the full documentation
surface of any source file it touches, so ordinary work retires legacy carriers as a side effect.
Between `680a862a8e` and `dbbad11e15` — roughly one day, mostly #563 — the corpus lost **340**
legacy examples and **30** affected files without anyone targeting them.

Consequences for planning:

- Treat every count here as a snapshot stamped with its commit, never as a stable figure. A number
  quoted without its commit is not a measurement.
- The migration surface is a shrinking target. Re-measure before P3 rather than trusting this file.
- `beep quality jsdoc-migrate extract` supersedes this document in P1. Once `extract.jsonl` exists,
  regenerate these numbers from it instead of re-running ad-hoc scripts.
- The ratchet baseline moves too: #563 raised `multiple-description-paragraphs` from 1330 to 1338
  mid-session. Read the baseline file, do not quote it from memory.

## Headline

| metric | value |
| --- | --- |
| src `.ts`/`.tsx` files under `packages/**/src/**` | 2,565 |
| files carrying a legacy carrier | **1,935** (75.4%) |
| affected doc blocks | **13,265** |
| `@example` tags inside those blocks | 13,250 |
| blocks with exactly **1** example | 13,209 |
| blocks with **2+** examples (max 5) | **19** |
| blocks with `@remarks` | 501 |
| blocks with both `@remarks` and `@example` | 464 |
| `@example` already fenced | 13,224 (99.1%) |
| **unfenced** `@example` | **114** |
| blocks with a multi-paragraph lead | 872 |
| blocks with a clean single-paragraph lead | 12,393 |
| raw `@example` occurrences repo-wide | 13,338 |

Two figures have held constant across both measurements despite 340 examples retiring: the
**19** multi-example blocks and the **114** unfenced examples. Both are the pathological tails
the codemod must handle explicitly, and neither is being eroded by ordinary cleanup-on-touch
work — so neither will shrink on its own before P3.

The raw `@remarks` count (518) exceeds the inventory's `forbidden-remarks` total (467) because the
inventory scores a subset of symbols. Both are tracked; the codemod works from the raw corpus.

## Collision hazards — all zero

| check | count |
| --- | --- |
| `@remarks` + existing `**Details**` | **0** |
| `@remarks` + existing `**Gotchas**` | **0** |
| `@example` + existing `**Example** (` | **0** |

Consequences: inserting `**Details**` can never create a `duplicate-section`; no block mixes
carriers, so a generated title can never collide with an existing one. Title uniqueness binds on
**19 blocks** repo-wide, which makes it a quality question rather than a correctness one.

All three collision counts were zero at both `680a862a8e` and `dbbad11e15`. Re-check them before
P3 anyway — a single hand-written block that mixes a legacy tag with a section form would break
the "no collision" assumption the codemod is built on.

## Generated surface

18 files, **1,065** `@example`. All produced by **repo-owned** generators — no third-party
templates.

| package | generator |
| --- | --- |
| `drivers/{box,acp,runpod,ecfr,gov-legal-mcp}` | `bun run generate` |
| `foundation/primitive/data` | `bun run beep sync-data-to-ts` |
| `foundation/modeling/rdf` | `beep sync-data-to-ts --target vocab-terms` |
| `foundation/modeling/html` | `bun run generate` |
| `tooling/library/ai-sync` | package-local emitter |

**Asymmetry.** `isGeneratedSourceFile` (`JSDocRatchet.ts:452-455` — `.generated.ts`,
`/_generated/`, `/generated/`, plus a `GENERATED FILE` header probe) excludes these from the
cleanup-on-touch gate. `JSDocDocumentationInventory.ts` has **no** such exclusion, so they *are*
counted in tracked totals. Invisible to the gate that fails; visible to the ratchet.

## Ratchet baseline

`standards/jsdoc-totals.regression-baseline.jsonc`, comparison is fail-on-growth per metric.
Non-zero tracked totals in the committed baseline, snapshot `generated_at` 2026-08-06T03:34:34Z:

```
packagesNeedingRemediation        111
multiple-description-paragraphs  1338
forbidden-remarks                 467
empty-section                      85
malformed-example                  85
undescribed-see                    22
invalid-when-to-use-prefix          4
invalid-heading                     2
trailing-blank                      1
```

Live totals measured by the P0 pre-push proof run already sit below that baseline —
`forbidden-remarks` 460 and `multiple-description-paragraphs` 1326 — which is the decay described
above, not a migration effect. The ratchet reports these as `tighten-baseline` candidates.

Projected after migration: `forbidden-remarks` → 0, `undescribed-see` → 0,
`multiple-description-paragraphs` → ~450 (872 of the live 1,326 sit inside the migration surface),
legacy `@example` → 0. Treat the projection as an order of magnitude, not a target: both the
numerator and the denominator move between now and P3.

## Distribution

96 package-family buckets, long tail. Top six cover 1,098 of 1,935 files:

```
foundation/modeling    352
foundation/ui-system   214
tooling/tool           198
law-practice/domain    124
foundation/capability  118
tooling/library         92
```

Heaviest single files: `drivers/box/src/_generated/Box.models.gen.ts` (478),
`drivers/acp/src/_generated/schema.gen.ts` (342), `foundation/modeling/html/src/Html.model.ts`
(310), `drivers/firecrawl/src/Firecrawl.models.ts` (245).

## Reproduction

```bash
# affected files
rg -l '@example|@remarks' packages --glob '**/src/**/*.{ts,tsx}' | wc -l

# total src files
find packages -path '*/src/*' \( -name '*.ts' -o -name '*.tsx' \) ! -path '*/node_modules/*' | wc -l

# fenced vs total @example
rg -U --pcre2 -oN '@example[^\n]*\n(?:\s*\*\s*\n)*\s*\*\s*```' packages \
  --glob '**/src/**/*.{ts,tsx}' | grep -c '@example'
rg -oN '@example' packages --glob '**/src/**/*.{ts,tsx}' | grep -c '@example'

# family distribution
rg -l '@example|@remarks' packages --glob '**/src/**/*.{ts,tsx}' \
  | awk -F/ '{print $2"/"$3}' | sort | uniq -c | sort -rn

# generated subset
rg -l '@example|@remarks' packages --glob '**/src/**/*.{ts,tsx}' \
  | grep -E '\.generated\.ts$|/_generated/|/generated/'
```

Block-level distribution (blocks, multi-example, remarks overlap, lead shape) was measured with
throwaway Node scripts that walk `/\*\*[\s\S]*?\*\//g` per file. `beep quality jsdoc-migrate
extract` supersedes them in P1 — prefer regenerating these numbers from `extract.jsonl` once it
exists rather than re-running ad-hoc scripts.
