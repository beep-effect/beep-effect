# @beep/lint-rules

Repo-local **Biome GritQL** lint rules for effect-smol-aligned quality enforcement.
Each rule is a single `.grit` file under `rules/`, registered by beep's root
`biome.jsonc` so it runs inside the one Biome lint pass — no bespoke `ts-morph` Project
loads. The package also owns the root oxlint custom plugin for repository-specific rules.

## Layout

| Path | Purpose |
| --- | --- |
| `rules/*.grit` | the GritQL rules (one anti-pattern each, diagnostics-only) |
| `src/index.ts` | canonical rule registry (`RULES`, `RULE_NAMES`, `rulePath`) |
| `configs/*.jsonc` | `core` / `services` / `schema` presets (documented groupings) |
| `test/harness.ts` | spawns Biome over a fixture and returns plugin diagnostics |
| `test/rules.test.ts` | data-driven invalid/valid fixture assertions |
| `test/registry.test.ts` | registry ↔ `rules/` ↔ metadata drift guard |
| `docs/rule-guidance.md` | authoring conventions + rule table |

## Verifications

- `bunx turbo run test --filter=@beep/lint-rules`
- `bunx turbo run check --filter=@beep/lint-rules`
- `bunx turbo run lint --filter=@beep/lint-rules`

## Notes

- GritQL is **diagnostics-only**; remediation uses Biome safe-fix, `ts-morph --write`
  codemods, or hand edits.
- Rules ship advisory (`severity = "warn"`, Biome exits 0) and flip to `"error"`
  (mandatory, Biome exits 1) once their subsystem is clean.
- See `goals/lint-toolchain-modernization/` for the initiative contract and the
  decisions on which checks stay in `ts-morph`.
