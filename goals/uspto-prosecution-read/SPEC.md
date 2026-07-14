# USPTO Prosecution Read Spec

## Objective

Given a known application number, extend `@beep/uspto` to return a
schema-decoded, provenance-bearing prosecution observation containing the
driver-promised minimum official evidence:

- normalized application identity and publication/patent identifiers when present;
- numeric application status code and generated native description;
- ordered `eventDataBag` transaction events with authoritative event/mail date,
  event code, native description, and upstream record identity;
- an authoritative office-action/document code, identifier, date, and
  retrievable source reference;
- source and operation class, retrieval time, freshness, cursor/upstream
  identity, checksums when applicable, and parser/vocabulary versions; and
- typed configuration, authentication, authorization/rate-limit, transport,
  response-status, endpoint-drift, and schema-decoding failures with technical
  retry hints only.

Deliver the observation with one package-private deterministic generation
mechanism for application status codes, OA transaction event codes, document
codes, and `PTMNFEE2` maintenance event codes. Every artifact carries source
identity, retrieval date, checksum, and refresh command. Drift is detected and
reported; it never silently mutates decode semantics.

## Non-Goals

- Polling orchestration, durable scheduling/cursors, heartbeats, recovery, or
  daily sweeps in `@beep/uspto`.
- Deadline calculation, legal status, prosecution phase, family/reissue
  interpretation, or attorney-owned rules.
- A second USPTO MCP host or a competing law-practice overlay.
- EPO OPS, Google Patents BigQuery, SerpApi, PatentsView compatibility, a
  production ppubs tier, or a committed `searchStructured` contract.
- Implementing the weekly `PTMNFEE2` full-replace ingest owned by
  `goals/uspto-ptmnfee2-ingest`.

## Source Hierarchy

1. The user-ratified 2026-07-14 graduation objective.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. The exploration [`BRIEF.md`](../../explorations/uspto-patent-driver-depth/BRIEF.md),
   [`MAP.md`](../../explorations/uspto-patent-driver-depth/MAP.md),
   [`DECISIONS.md`](../../explorations/uspto-patent-driver-depth/DECISIONS.md),
   and [`research/SOURCES.md`](../../explorations/uspto-patent-driver-depth/research/SOURCES.md).

## Target Surfaces

- `packages/drivers/uspto` for native schemas, observation, typed failures,
  technical retry hints, generation/refresh/drift reporting, and fixtures.
- `packages/foundation/capability/api-transport` by adoption only; extend it
  only if P0 evidence proves a missing consumer-general transformer behavior.
- `packages/drivers/uspto-mcp` for new operations in the shipped host with its
  existing soft gate and technical `SourceAuth` metadata.
- Focused tests and sanitized, attributed, network-free fixtures.

## Constraints

1. A service call is sequential-rate-limit-safe and remains one logical remote
   request. Bounded technical retry may follow proven idempotency and upstream
   headers; sequential-per-key polling/orchestration stays above the driver in
   `goals/law-docketing-reliability` and the docketing workflow.
2. P0 must prove the current OA endpoint/envelope and reconcile Patent File
   Wrapper transactions with OA Text Retrieval before the fixture freezes.
3. One authoritative retrieval route and stable checksum policy must cover all
   four native vocabularies. Namespace collisions remain explicit. Refreshes
   create reviewable diffs and runtime drift checks never rewrite artifacts.
4. The same mechanism must honestly fit the current `PTMNFEE2` documentation,
   code companion, and release identity even though bulk ingestion is separate.
5. Adopt the promoted `@beep/api-transport` transformer for every
   `@beep/uspto` request. P0 verifies authenticated ODP `Retry-After` and other
   rate headers, retryable statuses, retry bounds, and read idempotency rather
   than assuming provider behavior.
6. Technical source capability (source, operation class, identifier/free-text
   class, credential class, cost class, attribution) belongs in the driver/MCP
   `SourceAuth` boundary. Matter authorization (approver, matter, scope,
   expiry/revocation, consent provenance, audit) remains law-practice-owned;
   credentials never imply consent.
7. Existing ODP MCP tools retain the shipped soft gate. Extend the current
   `packages/drivers/uspto-mcp`; do not create another host.
8. CI and routine acceptance are network-free. Credentialed captures are
   optional, sanitized, provenance-bearing evidence and never a hidden gate.
9. Unknown codes and schema drift preserve raw values and fail explicitly.

## Dependency and Consumer Edges

- `goals/uspto-ptmnfee2-ingest` depends on this goal's shared
  generation/vocabulary mechanism and must not fork it.
- Both goals feed `goals/law-docketing-patent-spine`; this goal's fixture is
  shaped for that packet's driver-neutral intake port.
- Scheduling, cursor, sweep, heartbeat, and recovery remain in
  `goals/law-docketing-reliability`.

## Decision Log

Full rationale and rejected options remain in the linked explorations.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-07-14 | Deepen `@beep/uspto` in place; keep EPO/BigQuery consumer-gated and ppubs/SerpApi parked. | [`Q1`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q1-driver-wave-scope) |
| 2026-07-14 | First slice is the known-application, provenance-bearing prosecution observation shaped for the patent spine. | [`Q2`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q2-first-vertical-slice) |
| 2026-07-14 | Structured application search remains spike-gated and outside this contract. | [`Q3`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q3-searchstructured) |
| 2026-07-14 | One deterministic, reviewable mechanism owns all four native vocabularies; drift never silently mutates decode authority. | [`Q4`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q4-native-vocabulary-lifecycle) |
| 2026-07-14 | Drivers own native facts; law-practice server is the sole legal translation boundary. | [`Q5`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q5-placement-and-translation-boundary) |
| 2026-07-14 | Technical source capability and matter authorization are independent controls. | [`Q6`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q6-credential-and-matter-consent-controls) |
| 2026-07-14 | Extend the shipped USPTO MCP host under its soft gate. | [`Q7`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q7-mcp-boundary-and-gate-defaults) |
| 2026-07-14 | `PTMNFEE2` is a separate full-replace sibling that reuses this generation mechanism. | [`Q8`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q8-ptmnfee2-ingestion) |
| 2026-07-14 | Adopt promoted `@beep/api-transport` in this consumer; do not create a transport goal or retry package. | [`effect-orchestration-patterns`](../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-uspto-transport-adoption-folds-into-its-sibling) |

## Acceptance Criteria

- [ ] A network-free contract test decodes a provenance-bearing fixture into
      the exact patent-spine intake shape, including normalized identity,
      numeric status plus description, ordered `eventDataBag` events, and an
      authoritative OA/document reference.
- [ ] Typed technical failures distinguish configuration, authentication,
      authorization/rate limit, transport, response status, endpoint drift,
      and decode failure, and expose only evidence-backed retry hints.
- [ ] One generation/refresh command deterministically produces all four
      source-identified, retrieval-dated, checksum-pinned vocabulary artifacts;
      pinned reruns are byte-stable and drift produces a report/reviewable diff.
- [ ] P0 archives the OA authority/envelope result, vocabulary retrieval and
      checksum result, current `PTMNFEE2` facts, and authenticated ODP
      header/status/idempotency result before P1 contracts freeze.
- [ ] Every `@beep/uspto` request uses the promoted transport transformer while
      the service preserves single-request semantics and same-key safety.
- [ ] `packages/drivers/uspto-mcp` exposes the shipped operation under the soft
      gate with technical `SourceAuth`; matter authorization remains outside.
- [ ] Focused driver/MCP tests, repo gates, reflection lint, and Yeet
      PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/uspto-prosecution-read/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/uspto-prosecution-read/ops/manifest.json` | Passes |
| Packet references | `rg -n "uspto-prosecution-read|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-prosecution-read` | Expected references present |
| Packet whitespace | `git diff --check -- goals/uspto-prosecution-read` | Passes |
| P0 evidence | Four archived spike reports | Each unknown resolved or P1 remains blocked |
| Observation contract | Focused `@beep/uspto` fixture tests | Driver-promised minimum fields and typed failures decode exactly |
| Vocabulary determinism | Pinned generator rerun plus drift fixture | Byte-stable rerun; drift reports without mutation |
| Transport/MCP | Focused transport and `@beep/uspto-mcp` tests | Proven retry/idempotency behavior; soft gate preserved |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- A P0 spike cannot establish an honest endpoint, vocabulary, bulk-layout, or
  retry/idempotency contract.
- The minimum observation cannot be shaped without legal interpretation or
  scheduler ownership entering the driver.
- A refresh would silently mutate decode authority or fork the shared mechanism.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
