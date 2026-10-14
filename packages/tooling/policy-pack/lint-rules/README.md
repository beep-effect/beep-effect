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
| `src/rules/*.ts` | custom oxlint rules for path-aware or precisely fixable policies |
| `test/oxlint-sources.ts` | inline invalid/valid cases and expected fixed output |
| `test/oxlint-harness.ts` | runs the custom plugin through the oxlint subprocess |
| `docs/rule-guidance.md` | authoring conventions + rule table |

## Verifications

- `bunx turbo run test --filter=@beep/lint-rules`
- `bunx turbo run check --filter=@beep/lint-rules`
- `bunx turbo run lint --filter=@beep/lint-rules`

## Notes

- GritQL is **diagnostics-only**; remediation uses Biome safe-fix, `ts-morph --write`
  codemods, or hand edits.
- Oxlint owns repository-specific policies that need filesystem context or a precise normal
  fix. Register new rules in `src/rules/index.ts`, cover diagnostics and fixed output in the
  oxlint fixtures, and enable them in the root `.oxlintrc.json`.
- Rules ship advisory (`severity = "warn"`) and flip to `"error"` once their subsystem is
  clean. Rules introduced with zero violations may be mandatory immediately.
- See `goals/lint-toolchain-modernization/` for the initiative contract and the
  decisions on which checks stay in `ts-morph`.

## Effected profile exclusions

The root `.oxlintrc.effected.json` extends `.oxlintrc.json` for its plugin and rules.
Oxlint 1.87.0 replaces the inherited `ignorePatterns` array. The Effected profile
therefore repeats the root exclusions, replacing only `scratchpad/**` with
`!scratchpad/**`. Keep that admission first so the generated, build, and cache
exclusions below it still apply inside scratchpad.

The Effected profile tests in `test/oxlint-rules.test.ts` copy both profiles into
a disposable tree and run the installed Oxlint binary with the runner's `--disable-nested-config`
flag. Every fixture contains the same inline-schema violation. Ordinary source,
ordinary scratchpad source, and the explicit canary must be reported; generated,
build, cache, and other excluded paths must remain absent. With the previous
single-pattern profile on 1.87.0, this fixture reported 13 violations instead of
three. The corrected profile reports exactly the three admitted paths. A separate
test runs the repository's actual law canary alone and requires a failing exit
with the inherited `beep(no-inline-schema-compile)` diagnostic.
