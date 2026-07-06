# @beep/lint-rules Agent Guide

## Purpose & Fit
- Repo-local Biome GritQL lint rules (later: oxlint plugins) for effect-smol-aligned
  quality enforcement. Tooling family, `policy-pack` kind. No slice/product imports.

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `VERSION`, `RULES`, `RULE_NAMES`, `rulePath`, `rulesDir` | canonical rule registry |
| rules | `rules/*.grit` | one anti-pattern per rule, diagnostics-only |
| presets | `configs/{core,services,schema}.jsonc` | documented groupings |

## Laws
- GritQL is diagnostics-only — never silent rewrites.
- New rule = add `.grit` + `src/index.ts` registry entry + a `SOURCES[<rule>]` entry
  (inline `invalid`/`valid` strings) in `test/sources.ts`; the harness writes them to a
  temp file at test time (no on-disk fixture files).
- Ship advisory (`severity = "warn"`); flip to `"error"` only when the subsystem is clean.
- Keep rules fast: avoid `within`/deep-ancestor operators on hot patterns.

## Quick Recipes
```ts
import { RULES, rulePath } from "@beep/lint-rules"
```

## Verifications
- `bunx turbo run test --filter=@beep/lint-rules`
- `bunx turbo run check --filter=@beep/lint-rules`
- `bunx turbo run lint --filter=@beep/lint-rules`

## Contributor Checklist
- [ ] New rule registered in `src/index.ts` and `biome.jsonc` (top-level `plugins` or an `overrides` entry)
- [ ] `SOURCES[<rule>]` invalid/valid pair added to `test/sources.ts`
- [ ] `bun run check` / `bun run test` / `bun run lint` pass
