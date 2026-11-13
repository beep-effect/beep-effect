# @beep/lint-rules

Repo-local **Biome GritQL** lint rules for Effect-aligned quality enforcement.
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

## GritQL rules

| Rule | Severity | Scope | Summary |
| --- | --- | --- | --- |
| `no-file-url-pathname` | error | all | Use `fileURLToPath`, not `.pathname`, to turn a module-relative file URL into a path. |
| `no-native-error` | error | `packages/tooling/**/src/**` | No native `Error` construction in tooling source; use `S.TaggedError`. |
| `no-bigint-literals` | warn | `**/src/**`, `infra/**` | No bigint literals; use `BigInt(value)`. |
| `no-empty-named-blocks` | error | all | No `import {} from "..."`. |
| `prefer-array-flat-map` | error | all | `.flatMap(f)`, not `.map(f).flat()`. |
| `prefer-identity-annote-pipe` | error | all | Pipe identity annotations: `X.pipe($I.annoteSchema(...))`, not `.annotate($I.annote(...))`. |
| `no-hand-built-identity-annotation` | error | all | No annotation object whose `identifier` is built from a `$I` composer; use `$I.annote(...)`. |
| `prefer-exact-optional-key` | error | all | Schema fields use exact optional keys (EF-40). |
| `no-hand-rolled-canonical-json` | error | `**/src/**` except `@beep/jsonc` | No JSON object text built as braces around a join of members; canonical bytes come from `JsoncFingerprint.canonicalizeResult` (`goals/canonical-digest-owner`). |

Scope is set where the root `biome.jsonc` registers the rule: the top-level
`plugins` array for `all`, an `overrides` entry otherwise. The presets in
`configs/` list every rule flat.

## Authoring GritQL rules

- A new rule lands in five places: the `.grit` file, its entry in
  `src/index.ts` (`RULE_NAMES`, `RuleRegistrySchema`, `RULES`), its `SOURCES`
  fixture in `test/sources.ts`, the presets in `configs/`, and the root
  `biome.jsonc`. The registry test fails when the root config misses a rule.
- Messages read `Rule: … Why: … Fix: …`, and the fix names the replacement
  API or the command that migrates to it.
- Exceptions: path scope lives in the root override, whose `includes` takes
  negated globs (`"!packages/foundation/modeling/jsonc/**"`). A single site is
  suppressed with `// biome-ignore lint/plugin/<rule-name>: <reason>` on the
  line directly above the line where the diagnostic starts; a comment higher
  up suppresses nothing, and Biome reports a suppression that matches nothing
  as `suppressions/unused`. The reason names the record that allows it.
- Biome's GritQL, checked against 2.5.6 with fixtures: node patterns with
  list fields under `some` work, a regular expression matches a node's source
  text as written (a template's backticks and `\n` escapes included), and a
  spread before one element matches (`pipe($..., $last)`). A spread before
  two adjacent elements (`flow($..., $a, $b, $...)`) matched only when `$a`
  was the first argument; check adjacency with `some` over the argument list.
- Keep `within` and `contains` behind a rare match. Measure a rule with a
  config that loads only its plugin over `packages apps infra`, against the
  same config with no plugins.

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
