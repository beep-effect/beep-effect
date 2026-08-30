# Round 3 fix report — effect-ontology

JSDoc-only pass over the three accepted round-3 findings in
`scratchpad/effect-ontology/**` (excluding `test/`, `docs/`, and
`drizzle.config.ts`). Runtime behavior was not changed.

## Changed files

**ontology-R3-001**

- `scratchpad/effect-ontology/Contract/ProgressStreaming.ts`

**ontology-R3-002**

- `scratchpad/effect-ontology/Domain/Model/CoreOntology.ts`
- `scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts`

**ontology-R3-003**

- `scratchpad/effect-ontology/Service/Claim.ts`
- `scratchpad/effect-ontology/Service/ClaimPersistence.ts`
- `scratchpad/effect-ontology/Service/CurationJobProcessor.ts`
- `scratchpad/effect-ontology/Service/EmbeddingCircuitBreaker.ts`
- `scratchpad/effect-ontology/Service/EmbeddingFallback.ts`
- `scratchpad/effect-ontology/Service/EmbeddingProvider.ts`
- `scratchpad/effect-ontology/Service/EmbeddingRateLimiter.ts`
- `scratchpad/effect-ontology/Service/ImageFetcher.ts`
- `scratchpad/effect-ontology/Service/JinaReaderClient.ts`
- `scratchpad/effect-ontology/Service/ProgressStreaming.ts`
- `scratchpad/effect-ontology/Service/Storage.ts`
- `scratchpad/effect-ontology/Service/VoyageEmbeddingProvider.ts`

## Items closed

| ID | Status | What changed |
| --- | --- | --- |
| ontology-R3-001 | closed | `ErrorRecoverySemantics` Example now `.make`s the Spec payload and logs `clientCancellation.streamEnds // true`. Deleted the unused `streamEnds` accessor and `typeof` observation. `ErrorRecoverySemanticsSpec` is unchanged. |
| ontology-R3-002 | closed | `MentionId` / `CanonicalEntityId` / `EventId` Examples guard the branded form (`mention-` / `entity-` / `event-` plus 12 lowercase hex) and a failing input. Dropped `Effect.isEffect`. `OntologyEmbeddings` logs `storagePathFor` (`ontology.ttl` → `ontology-embeddings.json`) via `O.getOrThrow`; dropped `isEffect` on `computeVersion`. |
| ontology-R3-003 | closed | Recategorized the 19 `S.Class` values: `*Config` / `*Options` → `configuration`; the rest → `models`. Type companions (`FetchOptionsInput`, `ImageFetchOptionsInput`, `VoyageProviderConfigInput`, and other `*Input` / same-name aliases) stay `@category type-level`. Examples were not rewritten. |

### Category map (R3-003)

| Symbol | `@category` |
| --- | --- |
| CreateClaimInput | models |
| DeprecationResult | models |
| ArticleMetadata | models |
| PersistenceResult | models |
| JobProcessingStats | models |
| ProviderCircuitConfig | configuration |
| CircuitStatus | models |
| FallbackChainConfig | configuration |
| ActiveProviderInfo | models |
| EmbeddingRequest | models |
| ProviderMetadata | models |
| EmbeddingRateLimiterConfig | configuration |
| ImageFetchOptions | configuration |
| FetchOptions | configuration |
| JinaResponse | models |
| ProgressBuilderState | models |
| BackpressureState | models |
| ObjectWithGeneration | models |
| VoyageProviderConfig | configuration |

## Residual risk

- `MentionId.fromCoordinates` / `CanonicalEntityId.fromSeed` / `EventId.fromSeed` still are not run. They go through `Effect.fn` + `Sha256HexFromBytes.decodeEffect` (`Crypto.Crypto`). The fences now teach the branded form the statics exist to produce, not the digest pipeline.
- `OntologyEmbeddings.computeVersion` is still described in Details but not executed. Running it needs `Crypto.Crypto` and `Effect.withSpan`. The Example observes `storagePathFor` instead.
- Other Service `S.Class` values tagged `@category type-level` were outside the accepted 19-symbol list and were not retagged.
- `drizzle.config.ts`, `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`, `scripts/*`, tests, and docs were not touched.

## Commands run

This fixer session has no shell, so Example compilation was not proven here.
Parent should run from repo root (`mise` is not on the unadorned tool PATH):

```bash
zsh -ic 'bun run --cwd scratchpad docgen:effect-ontology -- --include "Contract/ProgressStreaming.ts,Domain/Model/CoreOntology.ts,Domain/Model/OntologyEmbeddings.ts,Service/Claim.ts,Service/ClaimPersistence.ts,Service/CurationJobProcessor.ts,Service/EmbeddingCircuitBreaker.ts,Service/EmbeddingFallback.ts,Service/EmbeddingProvider.ts,Service/EmbeddingRateLimiter.ts,Service/ImageFetcher.ts,Service/JinaReaderClient.ts,Service/ProgressStreaming.ts,Service/Storage.ts,Service/VoyageEmbeddingProvider.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
zsh -ic 'bun run --cwd scratchpad check:effect-ontology'
```

`@beep/scratchpad` has no generic `check` script; `check:effect-ontology` is the owning typecheck. If an Example fails the TypeScript gate, fix the Example — do not delete it.

## Symbols that could not be documented further

None of the three accepted findings were blocked. The identifier constructors and `computeVersion` remain intentionally unrun for the Crypto requirement noted above.
