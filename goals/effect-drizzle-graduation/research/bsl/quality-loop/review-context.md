# Quality-Loop Review Context — @beep/effect-drizzle (scratchpad/bsl)

Shared constitution for every reviewer and fixer in this loop. Read this file
completely before reviewing anything.

## Initiative summary

`scratchpad/bsl` is the completed in-scratchpad phase of `@beep/effect-drizzle`
(rounds 1–7.5 on branch `experiment/bsl`, baseline commit `b1de679a91`): define
a domain in effect/Schema once, derive drizzle tables, DDL, and repositories.
Two dialects (pg, sqlite) behind a shared core; live gauntlets against real
Postgres (pglite) and real sqlite (bun:sqlite); optimistic repositories;
publication-shaped layout with zero runtime deps; documented to effect's
measured JSDoc grammar. The next step after this loop is graduation review —
this loop is the close-out quality gate.

## Review scope

- `scratchpad/bsl/src/**` (core, pg, sqlite, internal, kit, index)
- `scratchpad/bsl/test/**` (each lens also reviews the tests of its surface)
- `scratchpad/bsl/README.md`
- `research/` files are STANDARDS/context, not review targets.

## Priorities (operator-ordered)

1. **Bugs** — real defects: wrong behavior, unsound type-level claims vs
   runtime behavior, edge cases, SQL correctness, error-path mistakes.
2. **Issues** — API inconsistencies, cross-dialect asymmetries, misleading
   surfaces.
3. **Performance** — type-level (instantiations, conditional-type hotspots)
   and runtime (repeated AST walks, per-model work).
4. **Bundle size** — tree-shaking hazards, dead public surface, import weight.
5. **JSDoc** — accuracy against the measured conventions; wrong claims worse
   than missing sections.

## Source of truth (in authority order)

1. `scratchpad/bsl/research/publishing-standards.md` — import style, natives
   policy, schema-at-boundaries doctrine, JSDoc line-leading-`@` rule,
   `@internal` marking rule, tstyche-at-package-creation plan.
2. `scratchpad/bsl/research/effect-jsdoc-conventions.md` — the measured JSDoc
   grammar (section census, example style `// =>`, type-only patterns).
3. `scratchpad/bsl/research/round6-brief.md` §"Operator decisions" — locked:
   one package + subpath exports; zero runtime deps (`effect` + `drizzle-orm`
   peers; `@beep/pglite` is test-only); Data.TaggedEnum internal machinery;
   no "bsl" on public surfaces.
4. Standing module laws (round-3 brief lineage): ZERO runtime type assertions
   (`as`/`!`/`satisfies`); overload-with-broad-impl is the sanctioned seam;
   every compile-time invariant has a runtime mirror and vice versa;
   TaggedError classes constructed via `.make`.
5. `scratchpad/bsl/README.md` — public claims; claims must match behavior.

## Standards that do NOT apply here (do not flag these)

This module follows PUBLISHED-PACKAGE standards, not beep repo laws:

- Native `[..].map`/`Object.keys` etc. are CORRECT where equivalent — do not
  demand effect helper modules. Effect helpers are kept only where they carry
  type/semantic weight (that retention list is in round6.5-report.md §A).
- Named imports from effect module paths are the LAW — do not suggest
  namespace imports or `@beep/*` reuse.
- `LiteralKit`, `$ScratchpadId`, `@beep/schema`/`@beep/utils` are deliberately
  absent — do not suggest them.
- `bun:test` (not `@effect/vitest`) is the deliberate scratchpad harness.
- Internal descriptor machinery on `Data.taggedEnum` (not schemas) is
  doctrine, not a gap.

## Known deferred boundaries (documented — do NOT re-report as findings)

- PostgreSQL enum-ARRAY live parameter serialization (pglite boundary).
- Literal relation-name preservation through `Assembly.relations` (RQB tests
  decode via explicit schemas).
- drizzle-kit rc skew: `test/drizzle-kit-sqlite-rc-compat.cjs` preload and the
  sqlite CLI push path (graduation blockers, deliberately test-only).
- The `deterministicKeys` lsp suppression in one test fixture.
- No package.json / workspace registration (deliberate until graduation).
- Perf timing/RSS noise (budgets await pinned-machine repeated sampling).

## NEW convention entering via this loop

`@internal` marking: every module-`export`ed symbol NOT reachable from
`src/index.ts` / `src/pg/index.ts` / `src/sqlite/index.ts` must carry an
`@internal` JSDoc tag (everything under `src/internal/` is internal by
definition). The jsdoc lens inventories violations; fixers apply the tags.

## Finding format (required — one block per finding)

```md
### {{lens}}-{{n}}: {{title}}

- `label`: issue | suggestion | question | note
- `blockingStatus`: blocking | non-blocking | question | note
- `severity`: P0-critical | P1-high | P2-medium | P3-low
- `sourceRefs`: {{standard section or command output}}
- `affectedFiles`: {{repo-relative path:line}}
- `evidence`: {{concrete code path, reproduction, or measurement}}
- `impact`: {{why it matters}}
- `suggestedFix`: {{smallest actionable fix}}
- `acceptanceCommands`: {{focused proof commands}}
- `status`: open
```

Severity calibration: P0 = broken behavior/data loss; P1 = confirmed
defect/law violation in scope; P2 = should fix before graduation; P3 = polish.
`blockingStatus` (not severity) gates the loop. A blocker needs concrete
evidence AND a concrete fix. If your lens finds nothing blocking, say
`0 required findings` explicitly. Distinguish changed-scope findings from the
deferred list above. Reviewers are READ-ONLY: inspect and run non-mutating
commands only (`./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json
--noEmit`, `bun test scratchpad/bsl/`, greps) — never edit anything.
