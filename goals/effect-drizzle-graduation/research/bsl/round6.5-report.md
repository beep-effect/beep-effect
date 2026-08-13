# BSL Round 6.5 Report — Published Import Style and Native Relaxation

Date: 2026-08-10  
Scope: `scratchpad/bsl/**` only  
Commit: none

## Outcome

Round 6.5 converted the experimental package to its locked publication style without changing
behavior or weakening its types. Plain arrays and records now use native operations where the
native typing is sufficient. Effect imports in `src/` and `test/`, including embedded consumer
examples, are named imports from module paths; no root `effect` barrel or Effect namespace import
remains.

The conversion touched 22 source/test files. Together with the local effect-lsp configuration and
this report, the round changes 24 files. The pre-existing untracked
`research/round6.5-brief.md` was read but not modified.

## A. Natives where equivalent

Twelve source/test files received native-equivalent call-site conversions.

| Former helper | Native form | Conversions |
|---|---|---:|
| `A.map` | `array.map(...)` | 16 |
| `A.filter` | `array.filter(...)` | 5 |
| `A.some` | `array.some(...)` | 5 |
| `A.every` | `array.every(...)` | 4 |
| `A.appendAll` | array spread | 2 |
| `A.empty` | `[]` / `() => []` | 6 |
| `R.keys` | `Object.keys(...)` | 20 (19 executable, 1 example) |
| `R.toEntries` | `Object.entries(...)` | 8 |
| primitive `Eq.equals` | `===` / `!==` | 32 |
| simple `Str` predicates | native string predicates / length | 10 |

No `A.of` call was converted: all three occurrences belong to encoded-AST classification and
walking code.

### Kept with reason

- Encoded-AST walkers retain 3 `A.map`, 2 `A.filter`, 7 `A.some`, 5 `A.every`,
  4 `A.appendAll`, 3 `A.of`, and 11 `A.empty` uses. These calls participate in recursive visited
  sets, Option-producing folds, or AST classification invariants.
- Eight structural `equals` calls remain: five compare AST nodes or AST visited-set entries, one
  compares PostgreSQL enum value arrays, one compares carrier records, and one proves structural
  equality for schema-backed tagged errors.
- `A.match`, `A.min`, `A.findFirst`, `A.head`, `A.get`, non-empty-array guards, `Option`, `Match`,
  `flow`, `pipe`, and `dual` remain because they preserve non-empty, ordering, absence, exhaustive
  matching, or public pipe ergonomics.
- `camelCase`, `snakeCase`, `capitalize`, `slice`, and `split` remain named Effect helpers. The
  brief only relaxed simple string predicates, and the casing seam remains deliberate.

## B. Named Effect imports

- Converted 101 executable `import * as X from "effect/Y"` declarations across 22 files.
- Converted 57 namespace imports in embedded TypeScript examples so published examples match
  consumer style.
- Removed 11 root-barrel imports (10 executable and one embedded example) by importing the needed
  symbols from `effect/Effect`, `effect/Match`, `effect/Function`, `effect/DateTime`, and the other
  owning module paths.
- Split Effect imports used only as types into `import type` declarations.
- Used explicit aliases only for collisions or global-name ambiguity, including array/Option
  `some`, array/Option `match`, array/Option `flatMap`, array/record `get`, and schema constructors
  such as `StringSchema` where necessary.

Final census: zero Effect namespace imports and zero imports from the root `effect` barrel in
`src/` or `test/`. Existing named `drizzle-orm` imports and the `@beep/pglite` harness boundary were
left intact.

## C. effect-lsp reconciliation

One narrow override was required in `tsconfig.json`:

```json
{
  "diagnosticSeverity": {
    "missedPipeableOpportunity": "off"
  }
}
```

The converted tree produced five instances of that diagnostic: four direct named
`formatIso(value)` calls and one direct named `runSync(effect)` call. Rewriting them to namespace
or pipe style would oppose the package's named-import standard. No other effect-lsp diagnostic
fired, and the plugin remains enabled.

## D. Performance sample

The round-6 post-migration sample is the comparison baseline. Round 6.5 used the same project and
consumer fixture with installed `tsc --extendedDiagnostics`, followed by `/usr/bin/time` around
tsgo.

### TypeScript extended diagnostics

| Metric | Round 6 after | Round 6.5 | Delta |
|---|---:|---:|---:|
| Files | 1,249 | 1,249 | 0 |
| Lines | 544,795 | 544,083 | -712 |
| Identifiers | 415,116 | 414,343 | -773 |
| Symbols | 1,144,788 | 1,139,805 | -4,983 (-0.4%) |
| Types | 591,802 | 588,264 | -3,538 (-0.6%) |
| Instantiations | 2,376,293 | 2,358,347 | -17,946 (-0.8%) |
| Memory | 739,166 K | 737,958 K | -1,208 K (-0.2%) |
| Check time | 1.018 s | 0.919 s | -0.099 s |
| Total time | 1.123 s | 1.002 s | -0.121 s |

### tsgo process measurement

| Metric | Round 6 after | Round 6.5 | Delta |
|---|---:|---:|---:|
| Wall time | 1.01 s | 1.00 s | -0.01 s |
| Maximum RSS | 841,936 K | 861,960 K | +20,024 K (+2.4%) |

The type graph is slightly smaller, while process RSS moved in the opposite direction. This
second sample confirms round 6's warning that the short wall-time and RSS measurements are noisy;
neither timing nor RSS should become a threshold from these two samples.

## E. Proof, assertion census, and public surface

Final proofs ran with unmasked exits:

```text
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
exit 0

bun test scratchpad/bsl/
44 pass, 0 fail, 192 expect() calls
exit 0
```

Additional census and surface proof:

- 74 `@ts-expect-error` negative fixtures remain, unchanged from round 6.
- AST census across all 26 source/test TypeScript files finds zero `as`, angle-bracket assertion,
  `satisfies`, or non-null assertion expressions.
- `test/import-boundary.test.ts` remains part of the passing suite.
- `src/index.ts` and `src/pg/index.ts` are byte-for-byte identical to their pre-edit snapshots;
  no public export or type signature changed.
- `git diff --check -- scratchpad/bsl` is clean.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0, 44/44 tests / 192 assertions, zero
effect namespace imports remaining in src/test, structural `equals` retained at
the load-bearing sites (enum value sets, AST visited sets), census clean, 74
negatives intact, public surfaces byte-identical. The single lsp override is
accepted as the narrowest possible reconciliation. No reviewer changes needed.
