# P2 telemetry-v2 contract foundation

Date: 2026-09-03
Status: contract and durable service milestones complete; emitter work remains

## Decision

The telemetry-v2 write contracts belong in the existing
`@beep/repo-ai-metrics` tooling library. The architecture review rejected a new
package, the shared schema package, and Yeet internals as canonical homes. The
implementation is split across three public modules:

- `telemetry-v2.ts` owns the shared lifecycle and evidence vocabularies.
- `flight-record.ts` owns the semantic/mechanical record contract and durable
  invalid or quarantine events.
- `ingest-manifest.ts` owns the pre-read enumeration and final coverage
  attestation.

No hook or transcript emitter was wired in these milestones.

## Durable service boundary

`TelemetryV2Store` is an Effect service over the validated absolute AI metrics
data root. It writes private-mode, content-addressed JSON artifacts through the
shared path-safety atomic writer. Artifact receipts expose only a fixed
relative directory, a SHA-256 digest, and a byte count. Repeating identical
input selects the same artifact path instead of creating another fact.

The ingest API accepts a lazy callback. It commits `IngestEnumeration` before
invoking that callback, which is the source-reading boundary. If reading fails,
the denominator remains while no final manifest is created. A returned
manifest is refused unless its enumeration id, run id, configuration, count,
and complete subject records match the initial denominator.

The flight-record API accepts `FlightRecordCompositionInput`, where semantic
and mechanical projections remain separate and record-wide evidence tier and
OIP taint are absent. The service derives those fields by weakest-link and
most-restrictive propagation before it appends an accepted write event. The
same append surface durably accepts the content-free invalid and quarantine
variants.

## Real fixture basis

The flight-record fixture is hand-written from one completed Codex hook-pulse
session recorded on 2026-09-03. Its privacy-safe ledger contained 37 events,
one user turn, 17 tool starts, 17 successful terminal tool events, no failed
tool events, no measured wait bracket, and a terminal `SessionEnd`. The fixture
retains only hashes, bounded literals, timestamps, and counts. It does not read
or retain the transcript. The available configuration snapshot predates the
session, so the record labels it `last-known` with `evidenceTier: heuristic`
instead of presenting it as observed session configuration. The missing
semantic objective and OIP classification remain `unknown`.

The ingest fixtures come from the canonical identity registry generated on
2026-09-03. That registry enumerated two canonical roots and six source
instances: two each for Claude, Codex, and OpenClaw. The pre-read enumeration
contains all six pseudonymous source-instance identities. The final manifest
also contains all six and marks them `skipped` with `reason: dry-run` because
the schema milestone did not open source content. This is an honest six-of-six
accounted denominator, not a claim that six sources were ingested.

No secret was resolved and no additional 1Password operation ran while making
either fixture.

## Contract properties

- Lifecycle state, active phase, wait reason, terminal outcome, and evidence
  tier are independent `LiteralKit` domains. Tombstoning is provenance, not a
  terminal outcome.
- `FlightRecordSemantic` cannot hold timestamps, durations, event counts, tool
  counts, or computed waits. `FlightRecordMechanical` owns those fields.
- Objectives, sessions, roots, source instances, configurations, evidence, and
  ingest subjects use SHA-256 references. No schema field can hold prompt,
  command, tool-argument, tool-result, or absolute path content.
- Evidence tiers propagate by weakest link. OIP taint propagates by the most
  restrictive input.
- Hook-pulse/v1 keeps its exact evidence and wait subsets. It does not begin
  accepting telemetry-v2-only `reconstructed` or scheduler wait values.
- `IngestEnumeration` is a separate pre-read wire record. `IngestManifest`
  links to it by run and enumeration identifiers.
- Final manifest dispositions are a tagged union. Read, tombstoned,
  unreachable, skipped, and unemittable cases cannot borrow fields from one
  another. Every final manifest has one unique disposition per denominator
  subject, and its summary must equal that partition.
- Invalid and unattributed flight-record candidates have content-free durable
  event cases, so a decoder failure need not become a silent drop or a guessed
  identity.

## Verification

The first contract pass is green on the package-local lane:

- `bun run --filter @beep/repo-ai-metrics check`
- `bun run --filter @beep/repo-ai-metrics test -- telemetry-v2.test.ts`
  with 10 tests
- `bun run --filter @beep/repo-ai-metrics test -- telemetry-v2-store.test.ts`
  with 6 tests
- `bun run --filter @beep/repo-ai-metrics test` with 320 tests
- `bun run --filter @beep/repo-ai-metrics lint`
- `bun run --filter @beep/repo-ai-metrics docgen`
- `bun run beep lint schema-first` with zero missing or advisory entries
- `bun run beep quality package-verify @beep/repo-ai-metrics`
- `bun run coverage -- --filter=@beep/repo-ai-metrics --write-baseline`
  with 25 files and 320 tests
- `git diff --check`

## Remaining P2 work

Claude and Codex emitters, heartbeat leases, tombstone reconciliation,
self-report divergence, and the seven-day coverage gate remain open.
