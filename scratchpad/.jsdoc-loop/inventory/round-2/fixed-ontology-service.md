# Pack ontology-service — round 2 JSDoc fix report

- fixer: jsdoc-annotation-specialist
- owned surface: `scratchpad/effect-ontology/Service/**`
- domain left untouched (0 accepted findings)

## Changed files

- `scratchpad/effect-ontology/Service/PubSubClient.ts`
- `scratchpad/effect-ontology/Service/GraphRAG.ts`
- `scratchpad/effect-ontology/Service/Agent/CorrectorAgent.ts`
- `scratchpad/effect-ontology/Service/PromptCache.ts`
- `scratchpad/effect-ontology/Service/RelationLinker.ts`
- `scratchpad/effect-ontology/Service/EventBus.ts`

Runtime code was not changed. Touched class docs that had `@category type-level` were recategorized to `models`.

## Items closed

| ID | Fix |
| --- | --- |
| R2-001 | Deleted the `PubSubClientConfig` interface `typeof` Example. Config value now `Effect.provide(PubSubClientConfig, ConfigProvider.layer(ConfigProvider.fromUnknown({})))` and logs default `projectId` / `eventsTopicId`. Category `configuration`. |
| R2-002 | `ScoredNode` retitled to construction; `EntityId` imported from `@effect-ontology/Model/shared`; types use `IRI.make`. `RetrievalResult` / `GroundedAnswer` / `ReasoningStep` / `ReasoningTrace` construct fixtures and log hop distance, citations, or path entities. Deleted the `GraphRAGService` `keyof` Example. |
| R2-003 | Deleted the `Correction` type-companion unused-binding Example; kept lead + `@see` to the runtime union. |
| R2-004 | Module Details now describe two-message Prompt construction and state that caching flags are ignored. `makeCachedPrompt` Example still passes `true` and logs that `cache_control` is absent. |
| R2-005 | `LinkedRelation.make` with remapped canonical subject; logs `subjectRemapped` / `canonicalSubjectId`. Recategorized to `models`. Kept `LinkingResult`. |
| R2-006 | `JobWithMetadata.make` with a `PromptCacheJob` and `attempts: 0`; logs attempts/`_tag` and a negative-attempts reject. `EventEntry` decodes a `ClaimCorrected` `OntologyEventEntry` and logs `event`. Recategorized `JobWithMetadata` to `models`. |

## Residual risk

- Type-level `GraphRAGService` / `PubSubClientConfig` interface / `Correction` companion have no Example (optional by kind split).
- `RelationLinker.Default` and `GraphRAGDefault` Examples still compose `Effect.provide` without `runSync` (network/LLM). Not unused-binding.
- Extra reject-only fences on OntologyAgent `ExtractionResult` / `ExtractWithClaimsResult` were not opened.
- This fixer session has no shell tool, so **`bun run docgen:local` and `check:effect-ontology` were not executed here**. Operator should run:

```bash
bun run docgen:local
# scratchpad is outside workspace-package src/; if planning skips it:
cd scratchpad && bun run docgen:effect-ontology
bun run --cwd scratchpad check:effect-ontology
```

If an Example fails the TypeScript gate, fix the Example — do not delete it.

## Commands run

- Documentation edits only; **docgen:local not run in this session** (no shell).
