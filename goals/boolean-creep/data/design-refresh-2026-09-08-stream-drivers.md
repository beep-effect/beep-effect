# Design refresh — stream and driver carriers

Date: 2026-09-08

## Source baseline

- Checkout HEAD inspected: `7440cb8c4302ce64b87860069a464bafbf65f576`.
- Frozen upstream corpus: `origin/main` at `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
- The audit did not fetch, merge, edit source/tests, change dependencies, or change inventory/status records.

## Scope

Refreshed these six implementation designs against declarations, every exact repository reference, service writers/readers, package exports, codec/property tests, and integration tests:

- `drivers-stream-state`
- `drivers-migration-journal-shape-row`
- `phoenix-prompt-read-exists`
- `venice-sse-done-payload`
- `xai-sse-done-payload`
- `xai-websocket-message-binary`

## Findings and design corrections

### OpenAI-compatible stream state

`StreamState` is private to `OpenAiCompatLanguageModel.service.ts`. The `textStarted`/`textEnded` correlation remains a valid 8-representable/6-legal carrier: `false/true` is unreachable, while `finished` is independent.

The design now preserves a subtle current behavior. `finishStreamParts` at lines 815-821 checks “started and not ended,” which maps to `textPhase === "open"`. The inline finish path at lines 881-887 checks only `textStarted`; its replacement must treat both `open` and `closed` as started. A finish-bearing choice after closure can therefore emit another `text-end` today. The carrier migration does not silently fix that behavior.

The new census record `r25-drivers-n-r-stream-state-finished-finish-reason` is correctly separate and D1. `finishReason` is updated when a choice reason arrives at lines 869-872, potentially before usage permits `finished`; empty-choice usage wrap-up can set `finished` without a reason at lines 894-910. The refreshed design explicitly excludes that pair.

### Postgres migration journal shape

The 4/3 qualification remains exact. The only producer is the one information-schema query at `PostgresDrizzle.service.ts:448-461`; PostgreSQL cannot expose the named column without the table. The single SQL `CASE` projection remains internal and preserves the existing missing, legacy, and current branch bodies. Test references were corrected to identify the existing first-run bundle test at lines 156-177 as coverage of the missing arm, alongside current and legacy migration paths.

### Phoenix prompt read

The 4/2 qualification remains exact for the production adapter. `Phoenix.service.ts:520-529` derives both fields from one nullable SDK result; a present prompt supplies its string `id`. Known constructors/readers are the Phoenix package test and one ai-metrics test fake; the similarly named production collection at `agent-effectiveness.ts:4030` contains `PhoenixPromptWriteResult`, not the read result.

The design now states the real compatibility boundary: `PhoenixPromptReadResult` is exported and has an internal schema codec, but the package is private and no repository path persists or transmits that codec. The decoded TypeScript/codec shape changes atomically under the decision rider; it is not Phoenix API wire data. The package's schema-derived arbitrary test at `Phoenix.service.test.ts:174-182` migrates to the two union cases.

### Venice and xAI SSE events

Both 4/2 qualifications remain exact. Their parsers map the provider `data:` line to either a terminal `[DONE]` event or a JSON data event, and their language-model adapters drop done and parse data. Exact searches found no other source/test producer or consumer.

Both designs previously said encoded impact was “none.” That was imprecise because the exported schema codecs and exact codec fixtures do change from `{ done, data?, index }` to a tagged internal form. The designs now distinguish this internal encoding from the provider wire. Both packages are private; neither event is persisted, sent over RPC, or encoded back to its provider. All known internal constructors, consumers, docs, and codec fixtures are listed for atomic migration. Venice's current optional-key `data` constructor default and missing-data guard are removed only when the data member makes the payload required.

### xAI WebSocket message

The live design was over-broad and the inventory cardinality is stale.

Current message members have optional `isBinary`, so that field has three states: absent, false, and true. Combined with bytes/text presence, the inventoried carrier represents `3 × 2 × 2 = 12` combinations, not 8. Three combinations have direct semantic evidence:

1. `isBinary: true` plus bytes from `parseWebSocketMessage` at `XAi.service.ts:703-710`;
2. `isBinary: false` plus text from the same parser at lines 712-721;
3. absent `isBinary` plus text in the exported model examples at `XAi.models.ts:456-463,518-522`.

Required inventory correction: `representable: 12`, `legal: 3`, with evidence for the documented third constructor. Schema-derived arbitrary round trips show codec permissiveness but do not establish that all 12 combinations have independent semantics.

The parser's text event also carries decoded-or-raw `data`, while the documented text constructor omits it. The repaired target therefore uses binary `{ bytes }` and text `{ text, data: Option<unknown> }` members. Text data uses `S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault)`, preserving omitted data as `None`, explicit `undefined` as `Some(undefined)`, and parser data as `Some(value)`.

The earlier design also tightened unrelated close/error cases by requiring their writer payloads and removing other optional fields. That was unsupported by this instance. The refreshed design leaves both non-message schemas and their accepted inputs unchanged. The existing exact close decode/encode fixture at `XAi.service.test.ts:305-309,361-365`, invalid close-code test at line 372, and live close/error objects at `XAi.service.ts:797-802` remain unchanged. Only the message member and parser construction migrate.

This is an internal Tier 1 codec change, not WebSocket wire data: `ws` supplies the external `(RawData, isBinary)` callback, `@beep/xai` is private, and exact search found no persistence, RPC, outbound serialization, or external-package consumer of `XAiWebSocketEvent`.

## Required inventory action for parent

- Update `xai-websocket-message-binary` cardinality from 8/2 to 12/3.
- Add evidence for the legitimate absent-`isBinary` text constructor at `packages/drivers/xai/src/XAi.models.ts:456-463` (also repeated at 518-522).
- Keep its exposure Tier 1/internal: the exported model is an in-process private-package stream type and its schema codec is exercised only by package tests.
- Keep `r25-drivers-n-r-stream-state-finished-finish-reason` disqualified separately; it does not change `drivers-stream-state`.

No other cardinality or qualification correction was found in this six-design scope.

## Validation

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` reached the repository-wide coverage check and failed only for two concurrently qualified designs outside this ownership: `html-link-imagesizes-disposition` and `tabstrip-overflow-disposition` are missing. No owned design was named.
- `git diff --check` passed for the six owned designs and this handoff.
