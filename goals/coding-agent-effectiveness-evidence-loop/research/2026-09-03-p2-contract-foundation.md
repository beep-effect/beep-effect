# P2 telemetry-v2 contract foundation

Date: 2026-09-03
Status: first P2 milestone complete; service and emitter work remains

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

No hook or transcript emitter was wired in this milestone.

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
- `bun run --filter @beep/repo-ai-metrics test` with 314 tests
- `bun run --filter @beep/repo-ai-metrics lint`
- `bun run --filter @beep/repo-ai-metrics docgen`
- `bun run beep lint schema-first` with zero missing or advisory entries
- `bun run beep quality package-verify @beep/repo-ai-metrics`
- `git diff --check`

## Remaining P2 work

The next milestone is the service contract. It must durably write
`IngestEnumeration` before opening source content, compose mechanical evidence
with the separately supplied semantic input, and append accepted, invalid, or
quarantined write events. Claude and Codex emitters, heartbeat leases,
tombstone reconciliation, self-report divergence, and the seven-day coverage
gate remain open.
