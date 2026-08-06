# Corpus census

Measured 2026-08-06 against `main` at `680a862a8e`. Every number below is reproducible with the
command given. Nothing here is estimated.

## Headline

| metric | value |
| --- | --- |
| src `.ts`/`.tsx` files under `packages/**/src/**` | 2,553 |
| files carrying a legacy carrier | **1,965** (77.0%) |
| affected doc blocks | **13,605** |
| `@example` tags inside those blocks | 13,590 |
| blocks with exactly **1** example | 13,549 |
| blocks with **2+** examples (max 5) | **19** |
| blocks with `@remarks` | 509 |
| blocks with both `@remarks` and `@example` | 472 |
| already-migrated `**Example** (Title)` sections | 1,005 (~7%) |
| `@example` already fenced | 13,564 (99.2%) |
| **unfenced** `@example` | **114** |
| `@example` carrying an inline title already | 22 |
| blocks with a multi-paragraph lead | 929 |
| blocks with a clean single-paragraph lead | 12,676 |
| `@template` / `@module` occurrences | 5 / 12 |
| raw `@remarks` occurrences (286 files) | 518 |

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
Non-zero tracked totals as of 2026-08-04:

```
packagesNeedingRemediation        111
multiple-description-paragraphs  1330
forbidden-remarks                 467
empty-section                      85
malformed-example                  85
undescribed-see                    22
invalid-when-to-use-prefix          4
invalid-heading                     2
trailing-blank                      1
```

Projected after migration: `forbidden-remarks` → 0, `undescribed-see` → 0,
`multiple-description-paragraphs` → ~401 (929 of the 1,330 live inside the migration surface),
legacy `@example` → 0.

## Distribution

91 package-family buckets, long tail. Top six cover 1,112 of 1,965 files:

```
foundation/modeling    354
foundation/ui-system   214
tooling/tool           209
law-practice/domain    124
foundation/capability  118
tooling/library         93
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
