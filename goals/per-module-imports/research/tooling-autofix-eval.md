# Enforcement and autofix tooling evaluation

Status: complete. This report records executed experiments separately from documentation-based assessments.

## Scope and settled constraints

This lane evaluates ongoing enforcement and the one-shot rewrite for the `effect` package barrel and `@beep` foundation barrels. It accepts the packet's settled scope, phased package-family delivery, and warn-to-error rollout. Barrels remain public and available to docgen; consumers stop importing through them.

## Environment and method

Executed on 2026-08-23 from the repository root. The checked-in executable reports `Version: 2.5.6`; the mise Bun shim reports `1.4.0`. I used isolated source and config files under `.beep/research/per-module-imports/sandbox/`. Commands below use `node_modules/.bin/biome` so the result does not depend on a global binary.

The root config already loads repo-local GritQL plugins in the normal Biome pass (`biome.jsonc:9-16`), enables the recommended rules and local adjustments (`biome.jsonc:107-215`), and uses ordered `overrides` with path `includes` for scoped behavior (`biome.jsonc:217-255`). Those are the incumbent extension points this evaluation favors.

## Biome 2.5.6

### `noRestrictedImports`: suitable enforcement, no rewrite

**Executed result.** `node_modules/.bin/biome explain noRestrictedImports` identifies the stable rule as `lint/style/noRestrictedImports`, available since 1.6.0, with default severity `warn`, and states `No fix available.` The rule accepts exact `paths`, per-path messages, `importNames`, `allowImportNames`, and `patterns` with `importNamePattern`.

An exact-path configuration banned both tested barrels (`sandbox/biome-path-restrictions.jsonc:8-17`). The actual diagnostics from `biome check` were:

```text
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:55 lint/style/noRestrictedImports

  ! Import each binding from its effect/<Module> path.

  > 1 │ import { Effect, Schema as S, pipe, type Scope } from "effect";
      │                                                       ^^^^^^^^

.beep/research/per-module-imports/sandbox/restricted-imports.ts:2:40 lint/style/noRestrictedImports

  ! Import each binding from its @beep/utils/<Module> path.

  > 2 │ import { A, P, type StringTypes } from "@beep/utils";
      │                                        ^^^^^^^^^^^^^
```

Distinct binding guidance also works, but through repeated `patterns` entries rather than one `paths` entry. Each entry pairs an exact barrel group with an implicitly anchored `importNamePattern` and its own message (`sandbox/biome-per-name-patterns.jsonc:12-47`). Biome rejected explicit `^` and `$` anchors because it adds them itself. After removing the anchors, the same import emitted seven binding-level warnings. The output proves aliases and type-only specifiers are inspected by imported name:

```text
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:10 lint/style/noRestrictedImports

  ! Use `import * as Effect from "effect/Effect"`.

  > 1 │ import { Effect, Schema as S, pipe, type Scope } from "effect";
      │          ^^^^^^

.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:18 lint/style/noRestrictedImports

  ! Use `import * as S from "effect/Schema"`.

  > 1 │ import { Effect, Schema as S, pipe, type Scope } from "effect";
      │                  ^^^^^^

.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:31 lint/style/noRestrictedImports

  ! Use a named import from `effect/Function`.

  > 1 │ import { Effect, Schema as S, pipe, type Scope } from "effect";
      │                               ^^^^

.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:42 lint/style/noRestrictedImports

  ! Use a type import from `effect/Scope`.

  > 1 │ import { Effect, Schema as S, pipe, type Scope } from "effect";
      │                                          ^^^^^

.beep/research/per-module-imports/sandbox/restricted-imports.ts:2:13 lint/style/noRestrictedImports

  ! Use `import * as P from "@beep/utils/Predicate"`.

  > 2 │ import { A, P, type StringTypes } from "@beep/utils";
      │             ^

Checked 1 file in 2ms. No fixes applied.
Found 7 warnings.
```

There is no safe or unsafe fix. I disabled assists in the test config to isolate the lint rule, then ran the strongest write mode:

```text
before=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
$ node_modules/.bin/biome check --write --unsafe --config-path=.../biome-path-restrictions.jsonc .../restricted-imports.ts
Checked 1 file in 4ms. No fixes applied.
Found 2 warnings.
unsafe_write_exit=0
after=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
```

The unchanged SHA-256 rules out a hidden unsafe rewrite. Without disabling assists, `check --write` may still reorder the imports because the repository enables `organizeImports` (`biome.jsonc:84-105`); that is unrelated to `noRestrictedImports`.

**Assessment.** Biome can enforce exact barrel bans and give each mapped binding its destination. A generated `patterns` array could consume the census mapping table. It also needs a catch-all exact-path restriction, or a separately generated coverage check, so a newly exported binding cannot evade an enumerated set.

I tested the combined catch-all plus per-binding design. A known `Effect` binding received both its binding-level message and the path-level message; a mixed known/unknown declaration produced one binding diagnostic plus the catch-all. The known-only result was:

```text
restricted-imports-known-only.ts:1:10 lint/style/noRestrictedImports
  ! Use effect/Effect.

restricted-imports-known-only.ts:1:24 lint/style/noRestrictedImports
  ! Use per-module imports; consult the generated mapping.

Found 2 warnings.
```

Therefore do not combine both forms in production. The simpler choice is one path-level message per barrel plus a generated, linked mapping document. If inline per-name guidance is worth the larger config, generate only the binding patterns and add a separate mapping-coverage check; otherwise a newly introduced or missed export can evade enforcement.

The exact-path rule also covered all additional module-loading forms I tested: a static re-export from `"effect"`, dynamic `import("effect")`, and `require("@beep/utils")` produced three warnings in one file. This is broader than a declaration-only custom fixer and is another reason to keep native Biome as the permanent gate. The one-shot transform should inventory those forms separately because a binding-to-module rewrite is not necessarily defined for dynamic or whole-package loads.

### GritQL plugins: rewrites work when attached to a diagnostic

The repository currently describes its GritQL files as diagnostics-only and routes precise fixes to other tools (`packages/tooling/policy-pack/lint-rules/README.md:10-20`, `packages/tooling/policy-pack/lint-rules/README.md:29-37`). Existing rules match syntax and call `register_diagnostic`; they contain no rewrite (`packages/tooling/policy-pack/lint-rules/rules/no-native-error.grit:1-7`, `packages/tooling/policy-pack/lint-rules/rules/prefer-array-flat-map.grit:1-6`). That is a repository convention, not a Biome limitation.

**Executed result, negative control.** I first loaded this rewrite-only plugin through an isolated Biome config:

```grit
language js

`console.log($args)` => `console.error($args)`
```

Biome accepted the plugin and checked the matching input, but neither reported nor applied the rewrite:

```text
before=9158f0709a316a78a1b32a005650956c5f43440cf95d797ad6fb765544f76c31
Checked 1 file in 2ms. No fixes applied.
check_exit=0
Checked 1 file in 2ms. No fixes applied.
unsafe_write_exit=0
after=9158f0709a316a78a1b32a005650956c5f43440cf95d797ad6fb765544f76c31
export const logValue = (value: unknown): void => console.log(value);
```

As a load-control, I added a separate plugin that matched the same expression and called `register_diagnostic`. `--write --unsafe` emitted the control diagnostic while the independent rewrite still did nothing:

```text
before=9158f0709a316a78a1b32a005650956c5f43440cf95d797ad6fb765544f76c31
.beep/research/per-module-imports/sandbox/grit-rewrite-input.ts:1:51 plugin

  × control diagnostic: console.log matched

  > 1 │ export const logValue = (value: unknown): void => console.log(value);
      │                                                   ^^^^^^^^^^^^^^^^^^

Checked 1 file in 2ms. No fixes applied.
Found 1 error.
unsafe_write_exit=1
after=9158f0709a316a78a1b32a005650956c5f43440cf95d797ad6fb765544f76c31
```

That negative control does **not** establish that plugins are diagnostics-only. Biome associates a rewrite with the diagnostic registered by the same match. I then tested the documented shape (`sandbox/rewrite-console-with-fix.grit:1-12`):

```grit
`console.log($args)` as $call where {
  register_diagnostic(
    span=$call,
    message="Use console.info instead of console.log.",
    severity="warn",
    fix_kind="safe"
  ),
  $call => `console.info($args)`
}
```

Without `--write`, the repository binary reported the diagnostic as fixable and printed the patch:

```text
.beep/research/per-module-imports/sandbox/grit-rewrite-input.ts:1:51 plugin  FIXABLE

  ! Use console.info instead of console.log.

  i Safe fix: Rewrite suggested by plugin `rewrite-console-with-fix`

    1   │ - export·const·logValue·=·(value:·unknown):·void·=>·console.log(value);
      1 │ + export·const·logValue·=·(value:·unknown):·void·=>·console.info(value);

Checked 1 file in 2ms. No fixes applied.
Found 1 warning.
```

`check --write` then applied it:

```text
before=9158f0709a316a78a1b32a005650956c5f43440cf95d797ad6fb765544f76c31
Checked 1 file in 2ms. Fixed 1 file.
after=53635a75a1ec303e5609adb5d01a1544e8c414b11653873a8627f99ea804f140
export const logValue = (value: unknown): void => console.info(value);
```

This agrees with Biome's plugin documentation: `register_diagnostic` accepts `fix_kind`, safe rewrites apply under `--write`, and unsafe rewrites require `--write --unsafe` ([Biome linter plugins](https://biomejs.dev/linter/plugins/)). Conclusion: GritQL plugins can diagnose **and** rewrite in Biome 2.5.6. The important limitation for this migration is expressiveness, not fix availability: a rule still has to split a mixed import into several declarations, route each binding through a large lookup table, merge existing destinations, and avoid alias/comment collisions. The ast-grep comparison below tests the same tree-pattern class of solution before choosing it over ts-morph.

A second executed probe made that boundary concrete. An exact import rule (`sandbox/rewrite-effect-single.grit:1-11`) safely changed a single-binding declaration but did not match the mixed form:

```text
Checked 2 files in 2ms. Fixed 1 file.

single:
import * as Effect from "effect/Effect"

mixed:
import { Effect, Schema as S } from "effect";
```

This is not proof that a larger Grit program cannot handle mixed declarations. It is proof that the attractive one-rule-per-binding sketch is insufficient: the match/replacement unit is the import declaration, and production rules must reconstruct the unmatched specifiers or transform a captured list. That moves the design toward a generated rule program plus collision handling rather than a small declarative plugin.

### Warn-to-error package-family rollout

Biome's current config structure already demonstrates the needed path scoping: an override declares `includes` and then supplies plugin or rule changes (`biome.jsonc:217-255`). A migration rule can start as a root `warn`, then later overrides can set the same rule to `error` for clean package families.

**Executed result.** A sandbox config defined the complete rule and options once at root with level `warn`, then used only `"noRestrictedImports": "error"` in an override matching `**/family-green/**`. Biome preserved the root options. The migrated family produced an error and exit 1; the pending family produced a warning and exit 0:

```text
.beep/research/per-module-imports/sandbox/family-green/example.ts:1:24 lint/style/noRestrictedImports

  × Use per-module imports.

Found 1 error.
green_family_exit=1

.beep/research/per-module-imports/sandbox/family-pending/example.ts:1:24 lint/style/noRestrictedImports

  ! Use per-module imports.

Found 1 warning.
pending_family_exit=0
```

A representative production shape is therefore:

```jsonc
{
  "linter": {
    "rules": {
      "style": {
        "noRestrictedImports": {
          "level": "warn",
          "options": { "paths": { "effect": "Use per-module imports." } }
        }
      }
    }
  },
  "overrides": [
    {
      "includes": ["packages/foundation/**", "!packages/foundation/not-yet-migrated/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": "error"
          }
        }
      }
    }
  ]
}
```

This is compact enough for a package-family rollout: one canonical restriction table and one include list per promoted family. The sandbox config needs `**/family-green/**` because its config file lives below the repository root; root `biome.jsonc` can use the repository-relative family paths already used by incumbent overrides.

## ESLint lane

### Core `no-restricted-imports`

**Executed result.** ESLint 10.9.0 is already declared in the root (`package.json:155-157`). With `@typescript-eslint/parser`, core `no-restricted-imports` handled aliased, ordinary, and type-only TypeScript imports. Its array-form `paths` option permits repeated entries for the same package, so `Effect`, `Schema`, `pipe`, and `Scope` each received a different message. Actual output:

```text
.beep/research/per-module-imports/sandbox/restricted-imports.ts
  1:10  warning  'Effect' import from 'effect' is restricted. Use `import * as Effect from "effect/Effect"`          no-restricted-imports
  1:18  warning  'Schema' import from 'effect' is restricted. Use `import * as S from "effect/Schema"`               no-restricted-imports
  1:31  warning  'pipe' import from 'effect' is restricted. Use a named import from `effect/Function`                no-restricted-imports
  1:37  warning  'Scope' import from 'effect' is restricted. Use a type import from `effect/Scope`                   no-restricted-imports
  2:1   warning  '@beep/utils' import is restricted from being used. Use a per-module `@beep/utils/<Module>` import  no-restricted-imports

✖ 5 problems (0 errors, 5 warnings)
eslint_check_exit=0
```

It does not fix. `eslint --fix` repeated the same five diagnostics, returned 0 because they were warnings, and left the source hash unchanged:

```text
before=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
eslint_fix_exit=0
after=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
```

This matches Biome's diagnostic capability but loses on integration. The repository selects only `docs` and `deprecated-apis` ESLint profiles (`eslint.config.mjs:1-20`). `lint:jsdoc` runs `eslint . --max-warnings=0`, while deprecated APIs use a separate full-tree, cached, 25-shard ESLint run (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1835-1867`, `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:466-521`). Adding the import rule to `docs` would turn rollout warnings into CI failures because of `--max-warnings=0`. Adding it to `deprecated-apis` would couple a syntax-only rule to the policy lane's slowest, type-aware full-tree scan. A third profile and CI step would avoid both problems but add another parse of the TypeScript corpus.

### Custom ESLint fixer

The repo has a clear home for a custom rule: `@beep/repo-configs` already defines and registers a local ESLint rule (`packages/tooling/policy-pack/repo-configs/src/eslint/RequireCategoryTagRule.ts:106-165`). A correct import fixer would not need type information, but it would need substantially more machinery than `no-restricted-imports`:

- Load the census mapping and classify each imported binding as namespace, named, or type-only.
- Rewrite one barrel declaration into several declarations, merge with existing destination imports, and preserve aliases and attached comments.
- Detect local and namespace collisions. For ambiguous cases, report without fixing instead of inventing a rename.
- Handle multiple barrel declarations, mixed type/value specifiers, `export ... from`, and `pipe`/`flow`/`identity` as named `effect/Function` imports.
- Apply one whole-declaration replacement per source range and add fixed-output tests for idempotence, collision bailouts, and comment retention.

Estimate: about 180-300 lines for the rule and fixer, 180-300 lines of fixtures/tests, and 50-100 lines for profile, export, and quality-step wiring. That is roughly 410-700 maintained lines excluding the generated mapping. The implementation risk is moderate because ESLint fixes are text-range edits and multi-import merging can overlap across reports.

It should run as a new syntax-only `imports` profile in the existing root Lint Policy job, ideally file-scoped during ordinary runs and full-tree in the hosted full check. The current policy runner supports changed-file collection but labels ESLint JSDoc, deprecated APIs, and oxlint as full-state checks (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1936-1948`). Wiring a new scoped ESLint step would require explicit work. Even then, Biome already provides the same enforcement without another parser pass, while a one-shot ts-morph transform is easier to test and delete than a permanent ESLint fixer.

### Existing `effect-imports` law must be reversed or retired

This repository has a more immediate compatibility issue than ESLint. `bun run beep laws effect-imports` is an incumbent ts-morph migration/check command with `--write` and `--check` (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:208-231`). The root Lint Policy runs its check on changed files (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1847-1863`).

Its current policy conflicts with the settled migration. It converts most stable namespace imports such as `import * as Duration from "effect/Duration"` back into named imports from `"effect"` (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:230-295`); its test asserts that reverse rewrite (`packages/tooling/tool/cli/test/effect-imports.test.ts:93-128`). It permits only a small alias table as per-module namespace imports and excludes `effect/Function` from the reverse conversion (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:81-103`, `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:195-227`).

Any pilot must change or disable this law in the same delivery batch. Otherwise the lint gate will demand the old barrel form immediately after the new codemod writes the settled per-module form. The existing command is useful implementation prior art because it already has ts-morph loading, include/exclude scoping, dry-run summaries, persistence, and tests (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:117-145`, `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:298-323`). It is not usable unchanged.

## tsgo and `@effect/tsgo`

### Current repository integration

The repository pins `@effect/tsgo` plus every platform binary at 0.35.0 (`package.json:37-44`) and patches the compiler during `prepare` (`package.json:357-358`). Its base config enables the Effect language service, asks for namespace imports from `effect`, `@effect/*`, and `@beep/*`, and defines aliases (`tsconfig.base.json:38-55`). Every installed Effect diagnostic is explicitly set to `error`, including `missingPipeableSignature` (`tsconfig.base.json:56-157`).

That last point is enforced by repository code, not just convention. `beep quality tsgo-rules` discovers the installed rule set, requires an exact config-key match, rejects every root severity other than `error`, and fails on drift (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1691-1705`, `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1779-1838`). The check runs in both the root check and Lint Policy batteries (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1727-1739`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1862-1867`).

### Where diagnostics and codefixes live

The supplied read-only clone is newer than the repo pin: `~/YeeBois/dev/effect-tsgo/etscore/version_generated.go:1-5` reports 0.36.5. In that clone:

- A diagnostic is compiled Go code. `rule.Rule` carries its config name, group, default severity, supported Effect versions, diagnostic codes, and `Run` function (`~/YeeBois/dev/effect-tsgo/internal/rule/rule.go:11-38`). Every rule is explicitly registered in `rules.All` (`~/YeeBois/dev/effect-tsgo/internal/rules/rules.go:8-106`).
- `missingPipeableSignature` is implemented in `internal/rules/missing_pipeable_signature.go`; it declares metadata and scans exported symbols through the checker (`~/YeeBois/dev/effect-tsgo/internal/rules/missing_pipeable_signature.go:12-24`, `~/YeeBois/dev/effect-tsgo/internal/rules/missing_pipeable_signature.go:30-81`). Its diagnostic message and TS377101 code come from the generated diagnostic table (`~/YeeBois/dev/effect-tsgo/internal/diagnostics/effectDiagnosticMessages.json:398-400`).
- The checker hook executes the compiled registry after each source file is checked (`~/YeeBois/dev/effect-tsgo/etscheckerhooks/init.go:17-42`). The runner resolves configured severities and per-file overrides, skips disabled work, and invokes each selected rule (`~/YeeBois/dev/effect-tsgo/internal/rulerunner/diagnostics.go:39-91`, `~/YeeBois/dev/effect-tsgo/internal/rulerunner/diagnostics.go:118-168`).
- Codefixes are separate compiled providers in `internal/fixables`; the registry is explicit (`~/YeeBois/dev/effect-tsgo/internal/fixables/fixables.go:1-54`). The LSP hook routes a diagnostic code to those providers and returns their edits as code actions (`~/YeeBois/dev/effect-tsgo/etslshooks/init.go:84-123`). This is editor quick-fix support, not a repository-wide `tsgo --fix` command.

So an import-style diagnostic and codefix can be added to effect-tsgo. The closest diagnostic precedent is `nodeBuiltinImport`, which walks import declarations and reports on their module specifiers (`~/YeeBois/dev/effect-tsgo/internal/rules/node_builtin_import.go:58-81`, `~/YeeBois/dev/effect-tsgo/internal/rules/node_builtin_import.go:91-159`). A new rule would need a diagnostic-table entry, rule implementation and registration, tests and baselines, docs/schema regeneration, a fixable and registration, and likely a generic mapping option if it is to cover repo-specific `@beep` barrels.

It cannot be configured today. `diagnosticSeverity` only enables compiled rule names; the available import settings control auto-import style, not checker rules (`~/YeeBois/dev/effect-tsgo/etscore/options.go:79-93`, `~/YeeBois/dev/effect-tsgo/etscore/options.go:115-121`). The options support path-scoped diagnostic severity overrides (`~/YeeBois/dev/effect-tsgo/etscore/options.go:142-157`), but there is no user-supplied diagnostic or binding-to-module map.

### Auto-import prevention is useful but incomplete

The compiler already rewrites editor auto-import suggestions. Its namespace policy turns a named auto-import fix into a namespace import and qualifies the use site (`~/YeeBois/dev/effect-tsgo/internal/autoimportstyle/stylepolicy.go:98-131`, `~/YeeBois/dev/effect-tsgo/internal/autoimportstyle/stylepolicy.go:134-205`). A test proves `runPromiseExit()` becomes `import * as Effect from "effect/Effect"` plus `Effect.runPromiseExit()` (`~/YeeBois/dev/effect-tsgo/internal/effecttest/autoimport_style_consistency_test.go:18-62`). The `topLevelNamedReexports: "follow"` mode suppresses the barrel candidate so the direct module wins (`~/YeeBois/dev/effect-tsgo/internal/effecttest/autoimport_style_consistency_test.go:320-355`).

This can reduce recurrence after migration, but two details need upstream or configuration work:

1. The settled `pipe`/`flow`/`identity` form is a named import from `effect/Function`, while the package-wide namespace transformer has no module exception. Its code applies the namespace policy to every named fix for the package (`~/YeeBois/dev/effect-tsgo/internal/autoimportstyle/stylepolicy.go:111-129`).
2. The 0.36.5 clone stores configured package strings as exact lowercase map keys and looks them up by exact package name (`~/YeeBois/dev/effect-tsgo/internal/autoimportstyle/stylepolicy.go:69-90`, `~/YeeBois/dev/effect-tsgo/internal/autoimportstyle/stylepolicy.go:111-123`). On that evidence, the repo's literal `@beep/*` and `@effect/*` entries do not appear to implement wildcard matching. This is a source-based inference and should receive a focused upstream test before changing config.

### Verdict

Do not make tsgo the primary enforcement tool for this packet. A generic upstream rule could eventually provide excellent editor diagnostics and quick fixes with no separate lint pass, but carrying it locally means maintaining a Go compiler fork and publishing all platform binaries. The repo currently consumes upstream npm artifacts, so a private rule is a release-engineering dependency rather than a config change. The clone's 0.36.5 architecture is also ahead of the repository's installed 0.35.0.

Use Biome for enforcement now. Open an upstream effect-tsgo issue or contribution only for editor prevention: exact/wildcard package matching, direct-submodule preference, and a named-import exception for `effect/Function`. If upstream accepts a generic import-convention diagnostic later, the Biome rule can remain the cheap CI backstop.

## Oxlint 1.79.0

Oxlint is not a hypothetical new dependency in this checkout. The root pins `oxlint` and `@oxlint/plugins` at 1.79.0 (`package.json:84`, `package.json:183`), exposes `bun run lint:oxlint` (`package.json:349-352`), and runs `oxlint --quiet` in the blocking Lint Policy job (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1864-1867`). The checked-in binary reports `Version: 1.79.0`.

The current ownership rule is narrow: Biome remains the primary linter, native oxlint categories stay off, and oxlint runs only repo custom rules that require path state or a precise fix (`.oxlintrc.json:1-21`). The repo already has a TypeScript JS-plugin registry and fixed-output subprocess harness (`packages/tooling/policy-pack/lint-rules/README.md:18-20`, `packages/tooling/policy-pack/lint-rules/test/oxlint-harness.ts:186-237`).

### Native `no-restricted-imports`

**Executed result.** The installed schema exposes ESLint-compatible `paths`, `patterns`, `importNames`, `allowImportNames`, type-import controls, and custom messages (`node_modules/oxlint/configuration_schema.json:15447-15476`, `node_modules/oxlint/configuration_schema.json:18810-18880`). The sandbox run handled aliased, ordinary, and type-only imports and allowed repeated path entries with per-binding messages:

```text
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:10: warning eslint(no-restricted-imports): 'Effect' import from 'effect' is restricted. help: Use `import * as Effect from "effect/Effect"`.
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:18: warning eslint(no-restricted-imports): 'Schema' import from 'effect' is restricted. help: Use `import * as S from "effect/Schema"`.
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:31: warning eslint(no-restricted-imports): 'pipe' import from 'effect' is restricted. help: Use a named import from `effect/Function`.
.beep/research/per-module-imports/sandbox/restricted-imports.ts:1:42: warning eslint(no-restricted-imports): 'Scope' import from 'effect' is restricted. help: Use a type import from `effect/Scope`.
.beep/research/per-module-imports/sandbox/restricted-imports.ts:2:1: warning eslint(no-restricted-imports): '@beep/utils' import is restricted from being used. help: Use a per-module `@beep/utils/<Module>` import.
oxlint_check_exit=0
```

`--fix` did not change the file:

```text
before=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
oxlint_fix_exit=0
after=67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a
```

Native oxlint therefore matches ESLint's enforcement behavior and has no migration advantage over Biome. Its official rule matrix likewise lists `no-restricted-imports` without the fix marker ([Oxlint rules](https://oxc.rs/docs/guide/usage/linter/rules)); the CLI's `--fix` modes can only apply fixes a rule supplies ([Oxlint CLI](https://oxc.rs/docs/guide/usage/linter/cli)).

### Custom JS-plugin fixer

Oxlint's custom rule API can fix source. The repo's `no-js-extension-imports` declares `fixable: "code"` and returns a range replacement (`packages/tooling/policy-pack/lint-rules/src/rules/no-js-extension-imports.ts:48-70`, `packages/tooling/policy-pack/lint-rules/src/rules/no-js-extension-imports.ts:74-108`). I ran the repository's real custom plugin through the installed binary as a control:

```text
before=54df5d6f092311c6431d54ef6547c586bb7040b9b40221e3496b5cdda5ac39bb
$ node_modules/.bin/oxlint --no-ignore --fix --config .oxlintrc.json .../oxlint-custom-fix.ts
custom_fix_exit=0
after=6da6a1e015280af2a1b65718d95b6b2ceb651994ed39ab05042ac75cb1863224
import { target } from "./oxlint-custom-target.ts";
```

A purpose-built `beep/per-module-imports` rule could therefore combine diagnostics and a normal fix inside the existing oxlint pass. It would use the same ESTree import visitor and text fixer issues described for custom ESLint, but the repo already has plugin registration, JSON report decoding, and fixed-output test infrastructure. Estimate: 220-380 rule lines plus 180-300 fixture lines and 10-25 registration/config lines, excluding the mapping. This is lower integration effort than a new ESLint profile.

### Effect's upstream oxlint rule is close prior art, not a drop-in

The Effect v4 reference checkout already owns `effect/no-import-from-barrel-package`. It accepts package regexes, visits import declarations, and reports each namespace or named value specifier (`.repos/effect/packages/tools/oxc/src/oxlint/rules/no-import-from-barrel-package.ts:51-68`, `.repos/effect/packages/tools/oxc/src/oxlint/rules/no-import-from-barrel-package.ts:70-140`). Effect enables it for `effect` and `@effect` barrels (`.repos/effect/packages/tools/oxc/oxlintrc.json:9-20`) and disables it in test/example/script families (`.repos/effect/.oxlintrc.json:19-26`).

I loaded that exact TypeScript plugin through this repo's oxlint 1.79.0 and ran it against the shared sandbox fixture. Actual output:

```text
restricted-imports.ts:1:10: error effect(no-import-from-barrel-package): Use import * as Effect from "effect/Effect" instead
restricted-imports.ts:1:18: error effect(no-import-from-barrel-package): Use import * as S from "effect/Schema" instead
restricted-imports.ts:1:31: error effect(no-import-from-barrel-package): Use import * as pipe from "effect/pipe" instead
restricted-imports.ts:2:10: error effect(no-import-from-barrel-package): Use import * as A from "@beep/utils/A" instead
restricted-imports.ts:2:13: error effect(no-import-from-barrel-package): Use import * as P from "@beep/utils/P" instead
check_exit=1
```

Even with `--fix --fix-suggestions --fix-dangerously`, the hash stayed `67304d9d64776afa01234901b5fd0528f2a0fc3f1604e3e7189744971eff599a`. The source declares neither `fixable` metadata nor a fix callback. Its tests also explicitly expect no report for declaration-level and inline type-only imports (`.repos/effect/packages/tools/oxc/test/no-import-from-barrel-package.test.ts:68-83`) and prove only diagnostic behavior for multiple names and aliases (`.repos/effect/packages/tools/oxc/test/no-import-from-barrel-package.test.ts:47-66`, `.repos/effect/packages/tools/oxc/test/no-import-from-barrel-package.test.ts:86-95`).

The output exposes the mapping problem directly: `pipe` must be a named `effect/Function` import, while foundation aliases such as `A` and `P` do not equal their destination module names. The rule also deliberately omits the settled type-only scope. Reusing its visitor shape is sensible if oxlint wins, but adopting it unchanged would enforce the wrong convention.

The decisive advantage required to choose it is a proven, idempotent normal fix that covers the whole census, including mixed type/value imports, destination merging, comments, and collision bailouts. Speed alone is not decisive because Biome already runs and enforces the rule in its existing pass. A permanent auto-fixer also has little value after the backlog reaches zero. For those reasons, keep oxlint in its current custom-policy role and use a throwaway or existing ts-morph migration command for the bulk rewrite. Reconsider a permanent oxlint fixer only if developers need ongoing one-command remediation and the pilot proves that requirement.

## One-shot migration vehicle

### Prior art first: no Effect barrel-to-module codemod ships today

There are two distinct things named “codemod” in the available Effect sources:

1. The Effect v4 reference checkout has a root `codemod` script (`.repos/effect/package.json:5-10`), but it only runs `scripts/codemods/jsdoc.ts` across package sources (`.repos/effect/scripts/codemod.mjs:1-22`). That transform moves documentation comments onto nested signature/type nodes (`.repos/effect/scripts/codemods/jsdoc.ts:14-70`); it does not touch imports.
2. npm publishes [`@effect/codemod` 0.0.16](https://www.npmjs.com/package/%40effect/codemod). The live registry response reported 17 versions, one `jscodeshift` dependency, and a 2024-07-23 publication date. `effect-codemod` and `@effect/codemods` both returned registry 404s.

The published CLI's complete transform list is:

```text
effect-3.0.4 | effect-3.0 | minor-2.1 | minor-2.3 | minor-2.4 |
platform-0.49 | schema-0.65 | schema-0.69
```

Inspection of the installed package confirms these are version/API migrations. For example, `effect-3.0` renames `effect/ReadonlyArray` to `effect/Array`, renames two root exports, and updates API members; it never splits a root import (`sandbox/.bun-install/install/cache/@effect/codemod@0.0.16@@@1/codemods/effect-3.0.ts:8-51`). The package metadata points to the Effect codemod repository and declares only jscodeshift (`sandbox/.bun-install/install/cache/@effect/codemod@0.0.16@@@1/package.json:1-23`).

For an executed check rather than a name-based assumption, I ran `effect-3.0 --dry-run --print` against sandbox copies of three real repo files: `packages/foundation/capability/observability/src/internal/decode.ts:1-3`, `packages/tooling/library/repo-utils/test/TSMorph.test-support.ts:1-4`, and `packages/drivers/postgres/src/internal/PostgresDiagnosticGuards.ts:1-2`. Actual result:

```text
Processing 3 files...
Running in dry mode, no files will be written!
All done.
Results:
0 errors
3 unmodified
0 skipped
0 ok
Time elapsed: 0.197seconds
codemod_exit=0
```

Conclusion: Effect ships codemod infrastructure, but no codemod for this migration. There is therefore no upstream barrel-to-module diff to adopt. The three-file trial proves that the closest general Effect migration transform does not perform the requested rewrite.

### ts-morph: best one-shot vehicle

The repository already depends on ts-morph 28 (`package.json:213`) and already has the conflicting `effect-imports` law's file discovery, source loading, write/check modes, and summaries. I built a deliberately small 125-line prototype in the sandbox (`sandbox/ts-morph-prototype.ts:1-125`). It models each census entry as `{ barrel, imported binding } -> { destination, namespace | named }`, rejects unmapped bindings instead of guessing, preserves local aliases, carries type-only status, emits separate namespace imports, and groups named bindings such as `pipe` and `flow` into one `effect/Function` declaration (`sandbox/ts-morph-prototype.ts:22-43`, `sandbox/ts-morph-prototype.ts:55-121`).

**Executed result.** The prototype rewrote sandbox copies of the same three real files plus a synthetic mixed type/value and alias case, then Biome 2.5.6 formatted all four successfully. Representative actual diffs:

```diff
-import { A, P, thunkFalse } from "@beep/utils";
-import { Cause, flow, pipe, Result } from "effect";
-
+import * as A from "@beep/utils/Array";
+import * as P from "@beep/utils/Predicate";
+import { thunkFalse } from "@beep/utils/thunk";
+import * as Cause from "effect/Cause";
+import * as Result from "effect/Result";
+import { flow, pipe } from "effect/Function";
```

```diff
-import { Effect as Fx, pipe as p, type Scope } from "effect";
-import { P as Pred } from "@beep/utils";
-
+import * as Fx from "effect/Effect";
+import type * as Scope from "effect/Scope";
+import { pipe as p } from "effect/Function";
+import * as Pred from "@beep/utils/Predicate";
```

The four transformed files contained no remaining exact `effect`, `@beep/schema`, or `@beep/utils` barrel import. A second transform pass returned 0 and left the aggregate hash unchanged:

```text
before=4f8c5a4d6abbb7872567f9f8c442810d33415456a2cc2042ebb7910e74675963
second_exit=0
after=4f8c5a4d6abbb7872567f9f8c442810d33415456a2cc2042ebb7910e74675963
barrel_rg_exit=1
format_check_exit=0
```

Three transformed fixtures passed tsgo. The fourth surfaced one Effect-specific diagnostic:

```text
TSMorph.test-support.ts(12,17): error TS377050: This nested call structure has a pipeable form.
`NodePath.layer.pipe(...)` represents the same call sequence in pipe style and may be easier to read.
effect(missedPipeableOpportunity)
prototype_typecheck_exit=1
```

The unchanged barrel-import copy typechecked with exit 0, so this is introduced in the observable verification result even though the expression was not changed. The likely explanation is that direct imports let effect-tsgo recognize more Effect symbols than the barrel re-export did. This is a pilot finding, not a reason to weaken typecheck: capture newly exposed Effect diagnostics as migration work and measure their count before sizing each batch.

The prototype is not the production transform. It intentionally omits destination-import merging, attached comment transfer, static re-exports, collision analysis, and a structured dry-run report. A production implementation should:

1. Load and validate the census mapping as data, including destination specifier, import form, and destination export name.
2. Index existing imports and local bindings before editing. Resolve every barrel specifier first; if any mapping is absent or a local/destination collision is ambiguous, report the entire declaration and leave it unchanged.
3. Preserve imported and local names separately. Convert module namespace exports to `import [type] * as <local>`, while `pipe`, `flow`, `identity`, and other true named exports retain named-import syntax and aliases.
4. Group by destination and type/value form; merge compatible named imports, recognize an identical existing namespace import, and avoid overlapping edits.
5. Transfer leading/trailing comments deterministically, remove the barrel declaration only after all replacements are staged, and handle matching `export { ... } from` declarations if the final census includes them.
6. Save, run Biome's formatter/import organizer, parse again, assert zero forbidden specifiers in the target set, and prove idempotence.

Estimate for a production one-shot command: 300-500 implementation lines plus 250-450 focused fixture/test lines, excluding the generated census mapping. Extending and reversing the existing `EffectImports.ts` command should land near the low end because discovery, modes, summaries, and a test harness already exist; a separate throwaway script lands nearer the high end after rebuilding those safeguards. Risk is moderate and concentrated in comment fidelity, merging with existing destination imports, module/local name collisions, and newly activated compiler diagnostics. The actual namespace-vs-named rewrite is low risk.

### ast-grep: capable primitives, wrong abstraction for the mapping

No `ast-grep` or `sg` executable is on the current PATH, and neither the root manifest nor lockfile declares `@ast-grep/cli` or `ast-grep`. Per the lane's test boundary, I did not add it merely to run a toy rewrite.

Documentation shows that ast-grep can rewrite a matched node with `--rewrite` or a YAML `fix`, and its experimental `rewriters` transformation can apply different sub-rules within a captured list ([rewrite guide](https://ast-grep.github.io/guide/rewrite-code), [rewriter guide](https://ast-grep.github.io/guide/rewrite/rewriter)). It also states that an ordinary fix replaces one target node at a time, with range expansion available for list delimiters ([fix reference](https://ast-grep.github.io/reference/yaml/fix)).

That is enough to express a single exact transformation such as `import { Effect } from "effect"` to a namespace import, just as the executed Grit probe did. It is not a natural data-driven solution for this census. The destination is a lookup keyed by both source package and imported binding; mixed declarations must fan out into multiple statements; named imports must be regrouped; existing destination imports are elsewhere in the program; and collisions require whole-file state. YAML would need generated rewriters for every mapped binding plus a complex whole-declaration reconstruction, using an experimental feature. A JavaScript ast-grep API program could manage the state, but at that point it has no decisive advantage over the installed ts-morph API and incumbent command scaffold.

Verdict: do not add ast-grep for this packet. Reconsider only if the census collapses to a handful of uniform whole-declaration patterns or a generated-rule proof handles the hardest mixed/collision fixtures substantially more simply than ts-morph.

## Recommendation

### Ongoing enforcement architecture

Use Biome's stable `lint/style/noRestrictedImports` in `biome.jsonc`, under the existing `style` group (`biome.jsonc:195-214`). Configure one exact `paths` entry for `effect` and each in-scope `@beep` foundation barrel. Keep the message short and link to the generated mapping or migration guide; do not generate per-binding patterns into the live rule unless inline destinations prove materially more useful than the duplicate/coverage complexity demonstrated above.

Start the shared rule at `warn`. Add one override per migrated package family whose `includes` select all source, test, app, and tooling files in that family, and set only `noRestrictedImports: "error"`. The executed override probe proves Biome inherits the root options while changing severity. This fits the incumbent config's ordered override structure (`biome.jsonc:217-255`) and needs no new lint process. Package lint already routes through each workspace's `beep:lint` profile (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:227`); Biome warnings return 0, while promoted-family errors return 1.

The ratchet sequence for each batch is:

1. Keep the root warning active so untouched families receive editor/CLI feedback without blocking.
2. Run the migration command over exactly one package family and resolve all unmapped, collision, and newly surfaced tsgo findings.
3. Add that family's path to the error override in the same change. Do not maintain a long exclusion list under a global error; positive promoted-family includes make the migration state legible.
4. When the last family is clean, promote the root rule to `error` and delete the temporary family overrides.

The current `effect-imports` law must be reversed, replaced, or disabled in the first pilot change. Leaving its current check active would make the new Biome rule and the old law demand opposite forms.

Do not add an ESLint profile, a tsgo fork, ast-grep, or a second native oxlint rule for enforcement. ESLint duplicates an existing parse and has no fix; tsgo requires compiled upstream work and platform releases; ast-grep is absent and adds no stateful-transform advantage; oxlint is already present but its native restriction is no more capable than Biome. A custom oxlint fixer is the fallback only if the pilot establishes that permanent one-command fixes are valuable after the backlog is gone.

### Migration vehicle

Implement the one-shot rewrite with ts-morph, preferably by reversing and generalizing the existing `effect-imports` law into a temporary per-module migration command rather than creating an unrelated script. Feed it the census mapping as validated data, not heuristics derived from local names. Require dry-run/check/write modes, machine-readable counts, unmapped and collision inventories, whole-declaration bailouts, and an idempotence test. Delete or reduce the transform after the final ratchet; Biome owns the permanent convention.

GritQL's newly proven fix support is useful for small, local syntax rewrites, but it is not the recommended bulk vehicle. The production problem is a whole-file mapping and merge operation. Encoding that state machine as generated Grit rewriters would be harder to review and test than the already installed ts-morph API.

### Dry-run pilot: `@beep/oip-web`

Use `apps/oip-web` as the first measured workspace. It is small enough to review—an executed scan found 38 TypeScript/TSX files and 21 files using one of the four explicitly scanned barrels—yet it has real Next.js build and portless dev surfaces. Its package scripts provide portless dev, Turbopack build, tsgo check, Biome lint, and Vitest (`apps/oip-web/package.json:14-32`); its check config disables incremental compilation, which makes repeated typecheck timing more comparable (`apps/oip-web/tsconfig.check.json:1-13`).

Before writing imports:

1. Save the exact target-file list, per-barrel/specifier counts, mapping-table version, runtime/tool versions, and any unmapped forms.
2. Run five baseline trials each for package typecheck, `NEXT_DISABLE_PWA=1` production build, and portless dev cold start. For each cold trial, move the prior `.next` directory to a temporary artifact directory rather than deleting it. Record wall time plus median/range; for build output, record total `.next/static/chunks` bytes and the route-size table; for dev, measure process launch to the first HTTP 200 from `http://oip-web.beep.localhost:1355/`.
3. Run the ts-morph command in dry-run mode over only `apps/oip-web`. Require zero unmapped specifiers, zero ambiguous collisions, a stable planned-file count, and a printed before/after preview for every distinct transform shape.

Then write only that workspace and:

1. Run the transformer again in check mode and assert zero remaining planned edits; run the exact-barrel inventory and the promoted Biome error override, including tests and type-only imports.
2. Run Biome format, then Biome check, on the target workspace. Run `beep:check`, `beep:test`, and the production build through the package scripts. Attribute any new Effect diagnostics—the sandbox proved direct imports can expose diagnostics hidden by barrel re-exports—and fix them in the pilot rather than suppressing them.
3. Run root `bun run docgen:local` (`package.json:326-328`). An app-only change may legitimately select no docgen package, but the command's result is still the bounded documentation proof; later library batches must generate and verify their package docs.
4. Repeat the same five performance trials under the same machine load and cache procedure. Compare medians and preserve raw measurements. Do not generalize from a single run or proceed to mass migration before the bundle, typecheck, and dev-start deltas are recorded.
5. Promote `apps/oip-web/**` from warning to error only after code verification and the post-migration measurements are complete. The batch is ready to inform the next family when the transform is idempotent, every targeted barrel count is zero, package checks and docgen are terminal, and the metric comparison is attached to the packet.

### Evidence classification

| Finding | Basis | Confidence boundary |
| --- | --- | --- |
| Biome 2.5.6 restricts exact barrels, aliases, type-only imports, re-exports, dynamic imports, and `require`; per-binding messages work | Executed with the repo binary | Proven for the sandbox syntax/forms shown |
| Native Biome `noRestrictedImports` has no safe or unsafe fix | Executed with hashes and confirmed by [official rule docs](https://biomejs.dev/linter/rules/no-restricted-imports/) | Proven for 2.5.6 |
| Biome GritQL can safely rewrite when the rewrite and diagnostic share one match | Executed with a `FIXABLE` preview and changed hash; [plugin docs](https://biomejs.dev/linter/plugins/) agree | Proven for 2.5.6; migration-scale expressiveness is assessed |
| A root warning plus family error override inherits options and produces exit 0/1 respectively | Executed | Proven for the tested override shape |
| ESLint core and native oxlint restrict names but do not fix | Executed with unchanged hashes | Proven for installed ESLint 10.9.0 and oxlint 1.79.0 |
| Repo oxlint JS plugins can fix; Effect's upstream barrel rule does not fix and skips types | Executed against both real plugins, plus source/test inspection | Proven for the checked-out/plugin versions |
| A tsgo import diagnostic/codefix is implementable but not configurable today | Read-only 0.36.5 source inspection; repo integration inspected at 0.35.0 | Architecture assessment, not an implemented experiment |
| `@effect/codemod` has no barrel-to-module transform | Live npm metadata, installed source inspection, and three-file dry run | Proven for npm latest 0.0.16 on 2026-08-23 |
| ts-morph can perform the core mapping, aliases, type-only split, and Function exception idempotently | Executed 125-line prototype on three real-file copies plus one synthetic edge case | Core mechanics proven; merging/comments/collision handling still require production tests |
| ast-grep can rewrite nodes but is a poor fit for this data-driven whole-file transform | Local absence check plus [rewrite](https://ast-grep.github.io/guide/rewrite-code), [rewriter](https://ast-grep.github.io/guide/rewrite/rewriter), and [fix](https://ast-grep.github.io/reference/yaml/fix) documentation | Documentation-based assessment; no local binary experiment |
| Bundle/typecheck/dev-start impact | Not measured in this lane | Must be established by the pilot before mass migration |

## Final decision

Adopt **Biome `noRestrictedImports` for permanent enforcement** and a **temporary ts-morph command for the mechanical rewrite**. Express the rollout as root warning plus positive package-family error overrides, reverse the conflicting `effect-imports` law in the first pilot, and require package typecheck, Biome format/check, bounded docgen, idempotence, zero-barrel inventory, and recorded performance deltas before expanding the batch. No new permanent tool has demonstrated a decisive advantage.

Status: complete. All experimental writes and downloaded npm artifacts are confined to `.beep/research/per-module-imports/sandbox/`; no repository source/config file was modified.
