# Grounding facts — 2026-09-12

Measured on main `23f3919` in the primary checkout, the effect clone at
`$HOME/YeeBois/dev/effect` (`4.0.0-rc.115`, head `51d4a2f08a`), and the tsgo
clone at `$HOME/YeeBois/dev/effect-tsgo` (`0.45.0`, head `223f9fa4`). Re-run
the commands before trusting a number; the tree moves daily.

## 1. Directive census

```sh
rg -o --no-filename -g '!node_modules' -g '!graft' -g '!.repos' -g '!**/dist/**' \
  '@effect-diagnostics(-next-line)?\s+[A-Za-z]+:(skip-file|off)' | sed -E 's/\s+/ /g' | sort | uniq -c | sort -rn
```

| Directive | Count | Where |
| --- | --- | --- |
| `-next-line missingPipeableSignature:off` | 60 | scratchpad |
| `strictEffectProvide:skip-file` | 12 code (11 scratchpad + FileSystemConformance) | |
| `-next-line strictEffectProvide:off` | 5 | scratchpad |
| `nodeBuiltinImport:skip-file` | 1 | vitest.setup.ts |
| `-next-line nodeBuiltinImport:off` | 2 | vitest.shared.ts |
| `-next-line schemaNumber:off` | 2 | scratchpad |
| `asyncFunction`, `newPromise`, `processEnv`, `globalTimers`, `globalRandom` skip-file | 1 each | vitest.setup.ts |

44 code files. Markdown mentions in `goals/**/history` and `AGENTS.md` are
prose, not directives.

Gate today (`Quality.command.ts` at main): scanned roots
`["apps","packages","tooling","infra"]`; extensions `.cts .mts .ts .tsx`;
`isRejectedEffectDiagnosticsDirectiveForTesting` rejects every directive except
the single FileSystemConformance `strictEffectProvide:skip-file` line.
`bun run beep quality tsgo-rules` reports `verified 103 installed @effect/tsgo
rule(s) are configured as error` and discovers installed rules from
`node_modules/@effect/tsgo/README.md`.

## 2. tsgo 0.39.1 → 0.45.0

Rule ids in the 0.45.0 catalog (`internal/diagnostics/effectDiagnosticMessages.json`,
extract `effect(<id>)`): 116. Configured at main: 103. New:

`catchAllTagDispatchToCatchTag catchIfTagToCatchTag flatMapIgnoredParamToAndThen
importFromBarrel matchEffectToMapBoth matchEffectToMatch obsoleteMatchImport
obsoleteSchemaImport provideLayerSucceedToProvideService raceFirstWithSleepToTimeout
runOfExitToRunExit schemaSync timeoutCatchTagToTimeoutOrElse`

Changelog highlights 0.40–0.45 (`_packages/tsgo/CHANGELOG.md`): 0.43 extends
`nodeBuiltinImport` to `console`, `timers`, `stream`, and for v4 `crypto`
(recommends `Crypto` from `effect`); 0.44 adds `obsoleteMatchImport`,
`obsoleteSchemaImport`, `timeoutCatchTagToTimeoutOrElse`; 0.45 adds the
opt-in `schemaSync`; 0.40 reclassifies `acquireReleaseDisposable` as style
and `unsafeEffectTypeAssertion` as correctness; `schemaNumber` no longer
fires on `isFinite`/`isInt` refinements.

Plugin config keys read by 0.45.0 (`internal/effectconfigraw/hooks.go`):
`allowedDuplicatedPackages barrelImportPackages diagnosticSeverity effectFn
extendedKeyDetection ignoreEffect*InTscExitCode importAliases
includeSuggestionsInTsc keyPatterns layerGraphFollowDepth namespaceImportPackages
noExternal overrides pipeableMinArgCount skipDisabledOptimization strings
topLevelNamedReexports` plus capability toggles (`completions goto inlays maps
quickinfo refactors renames`). Set at main: `namespaceImportPackages`,
`ignoreEffect*InTscExitCode`, `includeSuggestionsInTsc`,
`skipDisabledOptimization`, `effectFn`, `importAliases`, `diagnosticSeverity`.

Compatibility: 0.45.0 `peerDependencies.typescript` is `^5.9.2`; the repo
pins `@typescript/native` to `typescript@^7.0.2` and `.bin/tsc` is the
patched Effect tsgo binary (`prepare` runs `effect-tsgo unpatch && ... &&
effect-tsgo patch`). Prove the patch step in P2 before any lane depends on it.

Blast radius at error (rough `rg` counts, src+test, packages+apps+scratchpad):

| Rule | Sites |
| --- | --- |
| schemaSync (`S.decode*Sync`, `S.encode*Sync`) | 1,887 src + 1,020 test |
| matchEffectToMatch / matchEffectToMapBoth (`Effect.match(Cause)?Effect(`) | 55 |
| nodeBuiltinImport extension (`node:crypto|console|timers|stream`) | 42 |
| provideLayerSucceedToProvideService (`provide(Layer.succeed|effect(`) | 31 |
| flatMapIgnoredParamToAndThen (`flatMap(() =>`) | 30 |
| timeoutCatchTagToTimeoutOrElse (`catchTag("TimeoutError"`) | 6 |
| runOfExitToRunExit | 4 |
| obsoleteMatchImport / obsoleteSchemaImport | 0 |

schemaSync by family: foundation/modeling 909 (schema 714, rdf 109, html 25,
lexical 18, nlp 14, identity 14), foundation/capability 178, tooling/library
161, tooling/tool 142, scratchpad 276 (claudecode 105, ontoskills 68,
effect-ontology 39, beep-docs 38, codemode 26), law-practice/domain 101,
epistemic 149, documents 164, drivers/govinfo 74, agents/domain 53,
shared/domain 52, ontology/use-cases 44, architecture-lab 60, workspace 29.

## 3. TaggedError equivalence

Upstream `84864bc30c` "Fix Schema class equivalence derivation, closes #7450
(#7451)", 2026-08-25, in `effect@4.0.0-rc.113` (not rc.112). `makeClass`
installs `toEquivalence: ([from]) => from` (Schema.ts:13940 in rc.115). Test
`packages/effect/test/schema/toEquivalence.test.ts` "Class" sets a non-schema
own property and asserts equal.

Repo hook: `packages/foundation/modeling/identity/src/Id.ts` line 96 defines
`adoptDeclaredFieldsEquivalence`; line 118 (`annoteError`) and line 1910
(`annoteClass`) install it. Call sites: `$I.annoteError` 503, `$I.annoteClass`
4. Lint: `SchemaFirstDetectors.ts:1149` rule `SFV4-tagged-error-equivalence`
demands the hook.

`Schema.Defect` remains `interface Defect extends decodeTo<Unknown, typeof
Json>` (Schema.ts:8686); `declarationEquivalence` has no Defect
representation case, so payload equivalence is `Equal.equals`. The
`@beep/schema` `Opaque.Defect` always-true wrapper stays.

Proof harness: `packages/drivers/doc-text/test/DocText.service.test.ts`
property cases; the 2026-08-17 measurement was 60 seeds × 400 runs under Bun,
682/24,000 unequal on rc.109. Re-run the same shape after the hook deletion
and require 0/24,000.

## 4. Match regression in PR #1060

Merge commit `6b1ebc8d33`, 2026-09-10, 836 files. Match churn
(`git diff 6b1ebc8d33^1 6b1ebc8d33 -- '*.ts' '*.tsx'`):

| Removed | Added |
| --- | --- |
| tagsExhaustive 63, discriminatorsExhaustive 33, type 23, tags 15, discriminators 8 | tag 314, discriminator 194, exhaustive 76, typeTags 20 |

66 files. Sample: `apps/labs/api-docs/src/Docs.routes.ts` turned a two-arm
`Match.tagsExhaustive({...})` into two `Match.tag` calls plus
`Match.exhaustive`. The Match contextual-typing fix for `Effect.fn` handlers
(`8d1e97a`, 2026-08-26) was already in snapshot `c8349ed` (2026-09-09), so
nothing forced the rewrite.

Current repo usage (src only): when 974, value 315, tag 313, orElse 225,
exhaustive 177, discriminator 171, type 93, whenOr 28, withReturnType 24,
typeTags 21; tagsExhaustive 0; discriminatorsExhaustive 0.

rc.115 Match exports: `any bigint boolean date defined discriminator
discriminators discriminatorsExhaustive discriminatorStartsWith exhaustive fn
instanceOf instanceOfUnsafe is nonEmptyString not number option orElse
orElseAbsurd record result string symbol tag tags tagsExhaustive tagStartsWith
type typeTags value valueTags when whenAnd whenOr withReturnType`.

## 5. Compute pools

- Anthropic: four Max 20x seats.
- Codex: second ChatGPT subscription added 2026-09-12; `codex login status`
  = logged in; `$HOME/.codex/config.toml` model `gpt-6-astra`, effort `medium`.
- Cursor: `cursor-agent` 2026.x installed at `$HOME/.local/bin`, logged in;
  headless flags `-p --output-format stream-json --model --trust --force
  --sandbox`; catalog includes `claude-fable-5-thinking-xhigh` (NO ZDR),
  `claude-opus-5-thinking-*`, `gpt-5.6-sol-xhigh`, `gpt-5.3-codex-xhigh`,
  `cursor-grok-4.6-xhigh`, `composer-2.5`. CLIProxyAPI has no Cursor provider.
- Grok: build balance exhausted (2026-09-11).
