# Round 4 fix report — effect-ontology

JSDoc-only pass over the two accepted round-4 findings in
`scratchpad/effect-ontology/**` (excluding `test/`, `docs/`, and
`drizzle.config.ts`). Runtime behavior was not changed. `EventId` and
`NomicNlp.ts` were left as-is.

## Changed files

**ontology-R4-001**

- `scratchpad/effect-ontology/Domain/Model/CoreOntology.ts`

**ontology-R4-002**

- `scratchpad/effect-ontology/Service/Embedding.ts`

## Items closed

| ID | Status | What changed |
| --- | --- | --- |
| ontology-R4-001 | closed | `TrackedEntity.isResolved` Example retitled from `(Use EventId)` to `(Observe empty mergedFrom)`. Fence unchanged: decodes `id: "alice"` and logs `value.isResolved // false`. `EventId` still uses `(Use EventId)`. |
| ontology-R4-002 | closed | Embedding.ts compatibility re-export of `NomicNlpService` / `NomicNlpServiceLive` now deprecates with `{@link EmbeddingServiceLive}` and `{@link EmbeddingProvider}`. Tag order is `@deprecated` / `@category layers` / `@since 0.0.0`. No Example on the re-export. Owner in `NomicNlp.ts` is not deprecated. |

### Extra same-file residual (on-touch)

`TrackedEvent.hasTemporalGrounding` in the same `CoreOntology.ts` file was
titled `(Use CoreOperationErrorFields)` — the private field bag immediately
below the getter. Retitled to `(Observe unspecified EventTime)` so hover
matches the fence (`hasTemporalGrounding // false` on the default
`Unspecified` time). Fence unchanged.

## Residual risk

- `isResolved` and `hasTemporalGrounding` still omit `@category` / `@since` on
  the class members (pre-existing; parent class carries those tags). `@returns`
  kept because it names the merge-collection / `Unspecified` contract.
- `{@link EmbeddingProvider}` resolves through the value import in
  `Embedding.ts` to `Service/EmbeddingProvider.ts`. If a later barrel split
  drops that import, the deprecation link would go stale.
- Taste titles of the form `(Use X)` on other CoreOntology symbols were
  rejected in this round and were not retitled.
- `drizzle.config.ts`, `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`,
  `scripts/*`, tests, and docs were not touched.

## Commands run

This fixer session has no shell, so Example compilation and package `check`
were not proven here. Parent should run from repo root (`mise` is not on the
unadorned tool PATH):

```bash
zsh -ic 'bun run --cwd scratchpad docgen:effect-ontology -- --include "Domain/Model/CoreOntology.ts,Service/Embedding.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
zsh -ic 'bun run --cwd scratchpad check:effect-ontology'
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
```

`@beep/scratchpad` has no generic `check` script; `check:effect-ontology` is
the owning typecheck. The `isResolved` / `hasTemporalGrounding` fences were
not rewritten; if docgen fails, it is inherited, not introduced. If an Example
fails the TypeScript gate, fix the Example — do not delete it.

## Symbols that could not be documented further

None of the two accepted findings were blocked. The Nomic NLP owner remains
the documented, non-deprecated implementation; only the Embedding.ts alias
path is deprecated.
