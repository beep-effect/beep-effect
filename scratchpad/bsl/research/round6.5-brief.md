# Round 6.5 Brief — Published Import Style and Native Relaxation

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Protocol as always:
only `scratchpad/bsl/`, proofs green with unmasked exits, write
`research/round6.5-report.md`, do not commit.

Read first: `research/publishing-standards.md` (the governing ledger for this
round), then `research/round6-report.md`. This is a STYLE conversion — zero
behavior change, zero type-strength change. Every existing test, negative
fixture, and call-site diagnostic must survive identically.

## Deliverables, in this order

### A. Natives-where-equivalent (do this FIRST — it shrinks B's import surface)

Across `src/` and `test/`: replace effect helper calls with native equivalents
ONLY where genuinely equivalent:

- Convert: `A.map`/`A.filter`/`A.some`/`A.every`/`A.appendAll`/`A.of`/`A.empty`
  on plain `ReadonlyArray`, `R.toEntries`/`R.keys` where `Object.entries`/
  `Object.keys` typing suffices, `Eq.equals` on PRIMITIVES → `===`,
  simple `Str` predicates where `String.prototype` is identical.
- Do NOT convert (these carry type or semantic weight):
  - `Eq.equals` on records/AST nodes/arrays — structural equality is load-bearing
    (spec comparison, enum value-set comparison, AST visited-set membership);
  - helpers that preserve `NonEmptyReadonlyArray` or refine types (`A.match`,
    `A.min` with Order, `A.findFirst`→Option flows feeding `O.match`);
  - all `Option`, `Match`, `flow`/`pipe`, `dual` machinery — public pipe
    ergonomics and exhaustive matching are product;
  - `SchemaAST` walkers and anything whose helper form encodes an invariant.
- When in doubt, keep the effect helper and note it; a wrong "equivalent" that
  drops emptiness/Option/ordering semantics is a correctness bug, not style.

### B. Named imports from effect module paths

Convert every `import * as X from "effect/Y"` in `src/` and `test/` to named
imports (`import { taggedEnum } from "effect/Data"`). Rules:

- Never the root `effect` barrel; module paths only (already true — keep it so).
- Name collisions across modules resolve by aliasing
  (`import { map as mapOption } from "effect/Option"`); A having already removed
  most array/record helpers, collisions should be rare — if a file still needs
  many aliased names, reconsider whether A missed a native conversion there.
- Type-only imports use `import type { ... }`.
- `drizzle-orm` imports are already named; leave them.
- Test files follow the same style (fixtures read like consumer code); the
  `@beep/pglite` harness imports stay as they are.

### C. effect-lsp reconciliation

If any inherited effect-lsp diagnostic fires against the converted style
(e.g. missedPipeableOpportunity on now-native call shapes), tune it in
`scratchpad/bsl/tsconfig.json` — per-diagnostic, narrowest possible override,
each one listed in the report with the triggering pattern. Do not blanket-disable
the plugin. If nothing fires, say so explicitly.

### D. Re-measure the perf fixture

Run the round-6 measurement commands on the converted tree (import style should
be invisible to the checker — this doubles as the second sample for round 6's
noise-flagged timing question). Record numbers alongside round 6's in the report.

### E. Report

`research/round6.5-report.md`: conversion counts (files touched, helper→native
conversions by kind, kept-with-reason list), lsp overrides (or none), perf
sample, assertion census, confirmation that no public type signature changed
(compare `src/index.ts` / `src/pg/index.ts` export surfaces before/after).

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Unmasked exits; 44/44 minimum with 74 negative fixtures intact; zero runtime
type assertions; import-boundary test still passing.
