# Code Style — beep vs effect-smol

beep's lint toolchain is aligned to **effect-smol**'s code style where it fits, but beep
keeps **Biome** as its formatter and primary linter and intentionally diverges in several
places. This file is the durable record of those decisions (see
`goals/lint-toolchain-modernization/` for the initiative that produced it). effect-smol's
own style is enforced by **oxlint + dprint**; beep maps the *intent* of those rules onto
Biome lint rules + repo-local GritQL rules, not a 1:1 port.

## Formatting (frozen — Biome owns it)

Biome formatting is **not** changed by this initiative. effect-smol uses dprint with
`semiColons: "asi"` and `trailingCommas: "never"`; beep keeps Biome's
`semicolons: "always"` and `trailingCommas: "es5"`. Biome cannot replicate dprint's ASI
exactly, and a whole-repo reformat is out of scope.

| Concern | effect-smol (dprint) intent | beep choice | Status | Rationale |
| --- | --- | --- | --- | --- |
| Semicolons | `asi` (omit) | Biome `semicolons: "always"` | kept | Biome can't replicate dprint ASI; avoid whole-repo reformat. |
| Trailing commas | `never` | Biome `trailingCommas: "es5"` | kept | Same; formatting frozen for this initiative. |
| Arrow parens | force parens | Biome `arrowParentheses: "always"` (formatter default) | aligned via formatter | Biome's formatter already forces single-param arrow parens, so no separate lint rule is needed. |
| Quote style / width / indent | double / 120 / 2 | same | aligned | beep already matched these. |

## Lint rules — divergences (intentionally NOT ported / deferred)

| Rule (effect-smol) | Intent | beep choice | Status | Rationale |
| --- | --- | --- | --- | --- |
| `consistent-type-imports` (inline) | inline `import type` | Biome `useImportType: "separatedType"` | kept | beep keeps separated type-import statements. |
| `no-import-from-barrel-package` | forbid barrel/root package imports | not ported | skipped | `CLAUDE.md` deliberately allows root `effect` imports for core combinators; `laws effect-imports` already owns beep's import discipline (with `--write` remediation). |
| `no-js-extension-imports` | mandate TypeScript extensions in relative imports | **implemented (oxlint, mandatory)** | done | `allowImportingTsExtensions` permits source-facing extensions and `rewriteRelativeImportExtensions` rewrites them for runtime output. The fixable `beep/no-js-extension-imports` rule migrated 2,178 imports and re-exports and now prevents regressions. |
| `jsdocs` | effect-smol JSDoc shape rule | not ported | skipped | beep has its own JSDoc tooling (`quality jsdoc-inventory`, jsdoc skills). |
| `no-opaque-instance-fields` | no instance members on `Schema.Opaque` classes | **implemented (P3 oxlint, mandatory)** | done | Ported to the P3 oxlint lane as `beep/no-opaque-instance-fields` (needs import-binding + static-vs-instance member scope that GritQL can't express). 0 violations across beep's 114 `S.Opaque` classes → `error`. See "oxlint lane" below. |
| `import/no-duplicates`, `import/no-self-import` | one import per module / no self-import | not enabled | skipped | These are oxlint's **native `import`-plugin** rules, not custom; enabling native oxlint rule categories would overlap/conflict with Biome (the primary linter). The P3 oxlint lane runs ONLY beep's custom plugin, so these stay disabled. |
| `no-bigint-literals` | forbid bigint literals | enabled, **advisory only** (src-scoped) | advisory (kept) | P2 verdict: the in-tree bigint literals are **intentional domain values** — `Match.when(1n, ...)` version discriminators, `1n << 32n` id seeds — not just test data. Forcing `BigInt(1)` is more verbose and less readable. Scoped to `**/src/**` (excludes test/`LiteralKit` data); kept `warn` because the literals beep writes are correct. |
| `noConsole` | disallow `console` | enabled, **advisory only** | advisory (kept) | P2 verdict: enforcing repo-wide as `error` is a large, separate effort (~118 sites) and much `console` use is legitimate (CLI output, scripts, diagnostics already allowlisted). Kept `warn` pending a dedicated logging-migration initiative. |
| `noUselessConstructor` | no useless constructors | enabled, **advisory only** | advisory (kept) | P2 verdict: the flagged constructors carry typed parameters / DI shape (e.g. `chalk` `ChalkValue(_options?: ...)`) that are not safely removable without changing call-site types. Kept `warn`. |

## beep checks kept in `ts-morph` (not migrated to GritQL)

These are type-aware, whole-file, or path-scoped and cannot be reproduced as single-file
GritQL patterns without coverage loss (SPEC Parity Gate / Stop Conditions):

| Check | Why it stays in `ts-morph` |
| --- | --- |
| `laws effect-fn --check` | A GritQL port produced 51 false positives in `packages/foundation` alone (the precise check finds 0) and a ~100× slowdown (~98s on `apps`) from `within`-ancestor traversal on the hot `Effect.gen` pattern. Needs direct-return-owner / nearest-owner / generator scope analysis. |
| `laws effect-imports --check`/`--write` | Whole-file import consolidation (moving named imports between root and submodules per an 8-entry alias table) is not a single-file pattern; the `--write` codemod is also required by `yeet` repair (`Yeet/internal/Planner.ts`). |
| `laws native-runtime --check` | Hybrid: path-scoped allowlist reconciliation + native method-call scope. GritQL could only detect `node:` imports, not the allowlist/scope logic. |
| `lint schema-first`, `lint circular`, `quality {turbo-config-proof,changeset-graph,jsdoc-inventory}` | Cross-file inventory / graph / governance validators — out of scope by design. |

## Lint rules — alignments (enabled by this initiative)

P1 shipped every rule advisory (`warn`). P2 flipped to **mandatory (`error`)** only the
rules that fit beep with zero violations; the rest stay advisory (see the divergence
table above for why).

| Concern | Mechanism | Status (post-P2) |
| --- | --- | --- |
| `no-var` | Biome `suspicious/noVar` | **mandatory** (0 violations) |
| tagged errors in tooling | GritQL `no-native-error` (`@beep/lint-rules`, tooling-src override) | **mandatory**; the superseded `lint tooling-tagged-errors` CLI check is **removed** (no dangling refs) |
| empty named imports | GritQL `no-empty-named-blocks` | **mandatory** (0 violations) |
| `.map().flat()` | GritQL `prefer-array-flat-map` | **mandatory** (0 violations) |
| `no-console` | Biome `suspicious/noConsole` | enabled, advisory (kept — see divergences) |
| `no-useless-constructor` | Biome `complexity/noUselessConstructor` | enabled, advisory (kept — see divergences) |
| bigint literals | GritQL `no-bigint-literals` (src-scoped) | enabled, advisory (kept — intentional domain values) |
| PascalCase tooling filenames | Biome `style/useFilenamingConvention` (scoped) | not migrated — the current `lint tooling-schema-first` filename check flags compound-extension files (`X.command.ts`) which `useFilenamingConvention` cannot reproduce without rewriting the convention; kept in ts-morph |

## oxlint lane (P3)

oxlint is added **lint-only** (Biome stays the formatter + primary linter). The root
`.oxlintrc.json` runs ONLY the `@beep/lint-rules` custom plugin (`jsPlugins`) — no native
oxlint rule categories, to avoid overlap with Biome. These 6 repository policy rules are
implemented as oxlint ESTree plugins under
`packages/tooling/policy-pack/lint-rules/src/rules/`, run via `bun run lint:oxlint`:

The lane runs native oxlint categories **off** (`categories: all off`) so only the custom
`beep/*` rules fire; `scripts/`, `goals/`, and `explorations/` are excluded (operational
code, not the rules' target). The plugin source (`src/rules/**`) is itself oxlint-linted
(no self-exclusion). `bun run lint:oxlint` exits 0 today.

Binding-sensitive detection is **binding-based** (post-review hardening): those rules resolve import bindings
(named / namespace / default / aliased) rather than matching literal identifier names, so
`import { Effect as E }`, `import * as S from "effect/Schema"`, and `import * as Effect from
"effect"` (`Effect.Schema.Opaque(...)`) are all handled and cannot bypass the rules.

| Rule | Source | beep violations | Severity |
| --- | --- | --- | --- |
| `no-js-extension-imports` | effect-smol v4, extended for dynamic/type imports | 0 after migration | **error** (mandatory; fixable terminal-suffix replacement across the existing oxlint scope) |
| `no-opaque-instance-fields` | effect-smol v4 | 0 | **error** (mandatory; binding-based — effect-root namespace + default/named/namespace Schema/Opaque imports) |
| `namespace-node-imports` | t3code | 53 | warn (advisory — `node:` import-style cleanup) |
| `no-inline-schema-compile` | t3code | ~880 | warn (advisory — binding-based Schema detection + non-IIFE in-function compiler bindings; large hot-path-hoisting backlog; exact count tracks the tree) |
| `no-manual-effect-runtime-in-tests` | t3code (full-tree baseline incl `infra/`) | 0 | warn (advisory — binding-based; 0 net-new, baseline covers `packages`/`apps`/`infra`) |
| `no-global-process-runtime` | t3code (host file re-pointed to `chalk/.../SupportsColor.ts`) | 5 | warn (advisory — skips lexically-shadowed `process`; distinct `process.x` vs `os.x()` diagnostics) |

`lint:oxlint` is wired into the **blocking Lint Policy CI lane** via `beep lint policy`
(`oxlint --quiet` — errors only, so mandatory custom rules are enforced on every PR while
the advisory backlog stays out of the gate output). oxlint custom
JS plugins are stable on Linux (spike confirmed; no alpha breakage), so the lane is real —
not "complete-with-exception." Promotion of the remaining advisory rules to `error` is
tracked by the SPEC exception ledger's **2026-09-20** re-assessment.
