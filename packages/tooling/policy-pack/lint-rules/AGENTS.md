# @beep/lint-rules Agent Guide

## Purpose & Fit
- Repo-local Biome GritQL and oxlint plugin rules for effect-first quality enforcement.
  Tooling family, `policy-pack` kind. No slice/product imports.

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `VERSION`, `RULES`, `RULE_NAMES`, `rulePath`, `rulesDir` | canonical rule registry |
| rules | `rules/*.grit` | one anti-pattern per rule, diagnostics-only |
| presets | `configs/{core,services,schema}.jsonc` | documented groupings |
| oxlint plugin | `src/rules/{index,*.ts}` | path-aware or precisely fixable custom oxlint rules |
| oxlint fixtures | `test/oxlint-{sources,harness}.ts` | diagnostics and fixed-output subprocess coverage |

## Laws
- GritQL is diagnostics-only — never silent rewrites.
- New GritQL rule = add `.grit` + `src/index.ts` registry entry + a `SOURCES[<rule>]` entry
  (inline `invalid`/`valid` strings) in `test/sources.ts`; the harness writes them to a
  temp file at test time (no on-disk fixture files).
- New oxlint rule = add `src/rules/<rule>.ts` + plugin registration in `src/rules/index.ts`
  + invalid/valid fixtures in `test/oxlint-sources.ts`; fixed-output cases run through
  `test/oxlint-harness.ts`. Enable it in the root `.oxlintrc.json`.
- Ship advisory (`severity = "warn"`); flip to `"error"` only when the subsystem has zero
  violations. A rule introduced with zero violations may be mandatory immediately.
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
- [ ] GritQL rule registered in `src/index.ts` and `biome.jsonc`, with fixtures in `test/sources.ts`
- [ ] Oxlint rule registered in `src/rules/index.ts` and `.oxlintrc.json`, with diagnostic and fix fixtures
- [ ] `bun run check` / `bun run test` / `bun run lint` pass
