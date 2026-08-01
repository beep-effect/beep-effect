# UsageRecord provider capture design and status

Date: 2026-07-31

Status: implemented and targeted proof is green. The credentialed real-Anthropic E2E was intentionally not run.

## Decisions

- `AgentTurnKernel.streamTurn` now emits a schema-first `AssistantTurnEvent`: completed block events followed by one
  `AssistantTurnFinalization`. Its `ProviderUsageMetadata` carries input/output tokens, provider, returned model id,
  and an optional stop reason encoded as JSON `null` via `S.OptionFromNullOr`.
- Effect AI already aggregates Anthropic `message_start` and `message_delta` usage into its terminal `finish` part and
  exposes the returned model through `response-metadata`. The Anthropic kernel now consumes the full provider stream,
  captures those parts, emits repaired blocks first, and emits finalization last. No driver fork was needed.
- The fixture emits exact usage (`fixture`, model `fixture`, 12 input tokens, 8 output tokens, stop `stop`) so the
  app-level and PgLite contracts can assert persisted values without an LLM.
- `ChatOrchestrator` records latency from turn start to the kernel finalization event using `Clock`. Approximate cost
  comes from a small schema-backed data table: the driver-owned default Anthropic rate and a zero-cost fixture row.
  Unknown provider-model pairs stay explicitly unpriced (`None`/SQL `null`).
- Usage public ids reuse the real persisted assistant-turn CUID under the UsageRecord prefix, and the row inherits the
  turn's real organization id, making retries stable and avoiding old constant identity fields.

> **Activity linkage is not fabricated.** `Epistemic.Activity` has a domain model, but this repository currently has
> no Activity table, migration, repository, or desktop persistence port. `UsageRecord.activityId` is therefore an
> explicit `Option` encoded as SQL/JSON `null`; a migration drops the old `NOT NULL`. Metadata records
> `activityLinkStatus: "unavailable_no_activity_store"` and the real assistant-turn public id. A genuine Activity link
> still requires a separately designed Activity persistence surface.

## Files touched

- Agents contract and implementations: `packages/agents/use-cases/src/processes/AssistantTurn/*`, its public proof
  barrel/test, and `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts`.
- Desktop orchestration and proof: `apps/professional-desktop/src/chat/{ChatOrchestrator,UsagePricing}.ts`, chat/pricing
  tests, and the two UsageRecord/PgLite integration tests.
- Activity-link truth: `packages/epistemic/domain/.../UsageRecord.model.ts`, epistemic domain/table tests,
  `packages/_internal/db-admin/drizzle/20260801021411_usage_record_optional_activity/`, and the regenerated desktop
  migration bundle.
- Packet/release metadata: `goals/desktop-chat-surface/SPEC.md` and
  `.changeset/usage-record-provider-capture.md`.

## Verification

- `npx vitest run` over the touched agents server/use-cases, epistemic domain/tables, and desktop chat/pricing suites:
  10 files, 64 tests passed.
- Desktop PgLite integration config over `UsageRecordSink.pglite.test.ts` and `chat-persist.pglite.test.ts`: 2 files,
  2 tests passed. This proves the nullable migration and the persisted fixture usage columns.
- Package checks passed for `@beep/agents-use-cases`, `@beep/agents-server`, `@beep/epistemic-domain`,
  `@beep/epistemic-tables`, and `@beep/db-admin`; migration drift and desktop migration-bundle checks passed.
- Package Biome lint passed for all six touched packages. The focused Epistemic UsageRecord dtslint target passed with
  17 assertions, and `bun run docgen:local` passed all 74 expanded tasks after validating the new public metadata.
- Full `@beep/professional-desktop` check reaches only unrelated existing diagnostics in untouched
  `browser-failure-atoms.test.ts`, `intake-refusal.test.ts`, and `PgliteDataDirCompatibility.test.ts`; no touched file
  reports a type error. Targeted desktop unit and integration suites compile and pass.
- Cancel remains contract-proven: it persists only the stopped marker, no partial model content, and no usage row.

## Remaining

- Run `apps/professional-desktop/test/integration/chat-real-anthropic.e2e.test.ts` from the credentialed orchestrating
  session to prove live returned model/token values.
- A non-null `activityId` requires a real Epistemic Activity table/repository/sink and an atomic Activity + UsageRecord
  append design; that architecture is not present in this slice today.
