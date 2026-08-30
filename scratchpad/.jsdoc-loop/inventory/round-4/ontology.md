# Round 4 inventory: effect-ontology

Independent editorial re-review of `scratchpad/effect-ontology/**`
(excluding `test/` and `docs/`) against `.patterns/jsdoc-documentation.md`.
Mechanical census is `openModuleCount: 0` / `openOwningExportCount: 0`.
Zero `@example` / `@remarks` / `@module` / `@template`. Round-3's three
accepted items were verified closed on disk.

This round does not re-open closed mechanical misses, R2-prescribed
observations (`Layer.provide` inequality, CLI `Command.runWith` + argv,
`activity.name`, RPC `_tag`, table-key `"uri" in fields`), extra
reject-only `S.is({})` fences beside a success decode, unrun
network/LLM/Postgres `console.log(program)` compositions, type-level
`Effect.isEffect` stubs, or barrel `export *` graph edges.

`drizzle.config.ts` is census-excluded and is not public API.

## R3 fix verification

| Round-3 item | Status |
| --- | --- |
| ontology-R3-001 ErrorRecoverySemantics | closed — `.make`s the Spec payload and logs `clientCancellation.streamEnds // true`. Unused accessor and `typeof` are gone. `ErrorRecoverySemanticsSpec` is unchanged. |
| ontology-R3-002 identifier / embeddings Examples | closed on the four named symbols — `MentionId.is("mention-a1b2c3d4e5f6")`, `CanonicalEntityId.is("entity-a1b2c3d4e5f6")`, `EventId.is("event-a1b2c3d4e5f6")` plus a failing input; `OntologyEmbeddings` logs `storagePathFor` (`ontology.ttl` → `ontology-embeddings.json`). Residual copy-paste on `TrackedEntity.isResolved` opened below. |
| ontology-R3-003 nineteen Service `S.Class` categories | closed — those 19 values are `models` or `configuration`; same-name `*Input` companions stay `type-level`. Repo-wide `S.Class` + `@category type-level` is now 0. |

## Rejected (not opened)

- `drizzle.config.ts` default export — Kit config, not public API. Module
  header already has a useful lead, `@packageDocumentation`, `@since 0.0.0`.
- `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`, and `scripts/*` — no
  owning exports. Module headers exist; they are process entry points, not
  the public surface.
- Census / local `export { Foo }` and `export *` barrel edges
  (`Domain/index.ts`, `Error/index.ts`, `Model/index.ts`, `Schema/index.ts`,
  `Rdf/index.ts`, service/runtime barrels). Document the owner.
- Extra `S.is({}) // false` on `ExtractionResult` / `ExtractWithClaimsResult`
  / `ClaimData` / `ConflictRecord` / `CorrectionChainEntry` / `ScoredExample`
  / `Embedding` that already have a success observation (REVIEW-BRIEF).
- `LlmAttributes` `typeof annotate // "object"` and repository
  `typeof counts` / `typeof similar` — R1/R3 residual: tracer and Postgres
  Effects stay composed, not executed.
- `EventBusServiceMethods` / `Agent` interface stubs that bind a realistic
  object then `Effect.isEffect` — type-level Example optional; R2/R3
  accepted the EventBus stub.
- `console.log(program)` / `console.log(layer)` on Default/Live service
  layers that require network, LLM, or storage — R2 residual: compose
  `Effect.provide`, do not `runSync`.
- Taste titles (`**Example** (Use X)`) when the fence already calls the
  symbol (`PathLayout`, Utils, Prompt generators, identifier values).
- `@see {@link https://… | Google Cloud Storage …}` on `GcsBucket` /
  `GcsObject` — link title describes the target; not a bare `@see`.
- Canonical `@category type-level` on same-name type companions and
  `.Encoded` aliases.
- Remaining `*Config` tagged `models` (`EmbeddingCacheConfig`) and
  `defaultCacheConfig` tagged `services` — not `type-level`; outside the
  R3-003 19-symbol list; not a new category sweep.
- `NomicNlpServiceMethods` `@param text Input text` (no hyphen) — nested
  tags on a type-level interface, not an owning value export.
  Cleanup-on-touch if that block is edited.
- Formulaic `@param … - Input consumed by this operation` /
  `@returns Result produced by this operation` on `AgentTask` statics and
  sibling getters — hyphen is present; tags add nothing. Omit on touch.
- R2-prescribed layer/CLI/activity observations; entry scripts without
  exports.

---

### ontology-R4-001: TrackedEntity.isResolved Example titled "Use EventId"

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Example titles unique and
  teaching; hover must show the symbol doing its job)
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:456
- `symbol`: TrackedEntity.isResolved
- `kind`: value
- `evidence`: R3-002 retitled EventId to `(Use EventId)` and left the same
  heading on the preceding `TrackedEntity` getter. Lead is "Whether at least
  one other entity was merged into this canonical form." Fence correctly
  decodes `TrackedEntity` (`id: "alice"`) and logs
  `value.isResolved // false`. Title names a different public identifier.
  The class Example at line 418 already logs `isResolved` on
  `bruce_harrell`.
- `impact`: Hover on `isResolved` teaches EventId. Callers looking for the
  merge-state getter land on the digest-id Example from the R3 identifier
  pass.
- `suggestedFix`: Retitle to observe merge state (for example
  `(Observe empty mergedFrom)`). Keep the single fence. Do not add a second
  Example. Do not change `EventId`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-R4-002: Embedding.ts Nomic re-export @deprecated has no {@link}

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Every @deprecated includes
  a {@link} replacement; tag order @deprecated → @category → @since)
- `affectedFiles`: scratchpad/effect-ontology/Service/Embedding.ts:299
- `symbol`: NomicNlpService, NomicNlpServiceLive (re-export from Embedding.ts)
- `kind`: value
- `evidence`: Compatibility alias
  `export { NomicNlpService, NomicNlpServiceLive } from "./NomicNlp.ts"` is
  documented `@deprecated Use EmbeddingServiceLive with EmbeddingProvider
  instead` with no `{@link}`. Tag order is `@deprecated` / `@since` /
  `@category`. Owner `NomicNlp.ts` is not deprecated; the alias path is.
  Sibling PromptGenerator / OutputType deprecations already link
  replacements. Local `scripts/audit-documentation.ts` flags
  `unlinked-deprecation`.
- `impact`: Hover on the Embedding.ts alias names replacements that do not
  navigate. Callers cannot jump to `EmbeddingServiceLive` /
  `EmbeddingProvider`.
- `suggestedFix`: `@deprecated Use {@link EmbeddingServiceLive} with
  {@link EmbeddingProvider} instead of importing Nomic NLP through this
  module.` Then `@category layers` / `@since 0.0.0`. Do not add an Example
  on the re-export. Do not deprecate the owner in `NomicNlp.ts`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-service
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Pack verdict

- files reviewed: 228 exporting modules (55 domain + 78 service + 40 runtime + 55 rest) plus `drizzle.config.ts`, `server.ts`, `cli.ts`, `Runtime/ActivityRunner.ts`, and four `scripts/*` (no owning exports)
- owning exports reviewed: 1590 (569 domain + 465 service + 202 runtime + 354 rest)
- confirmed mechanical items: 0
- editorial items: 2
- rejected false positives: drizzle default; barrel re-exports; extra `S.is({})`; LlmAttributes / repository unrun-Effect typeof; type-level stubs; R2-prescribed layer/CLI/activity observations; unrun Default-layer `program` logs; leftover Config category outside R3-003; NomicNlp hyphen-less interface `@param`; formulaic `@returns`; entry scripts without exports
- accepted findings: 2

Illegal headings: 0. Legacy carriers: 0. `Layer.isLayer` / `documented = [symbol, literal]`: 0.
`S.Class` tagged `@category type-level`: 0.
`drizzle.config.ts` is not public API.
