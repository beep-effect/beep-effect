# USPTO PTMNFEE2 Ingest Spec

## Objective

Discover the current weekly cumulative USPTO Patent Maintenance Fee Events
product (`PTMNFEE2`) through the authorized product-data path, checksum-pin its
release, documentation, and `MaintFeeEventsDesc`, and parse it in
`@beep/uspto` by validated atomic full replacement into typed, lossless native
maintenance events.

Ship a refresh manifest and small network-free fixtures attributed to USPTO
under the dataset's Public Domain Mark 1.0 metadata. The output feeds the
maintenance-fee acceptance case in `goals/law-docketing-patent-spine` but makes
no legal conclusion.

## Non-Goals

- Append-only ingestion, delta interpretation, per-record polling, or exposing a
  partially refreshed snapshot.
- Payment-window, deadline, expiration, reinstatement, current-status,
  continuity, family, reissue, terminal-disclaimer, or attorney-rule logic.
- Scheduling, durable cursors, daily sweeps, heartbeat, or recovery; these stay
  in `goals/law-docketing-reliability`.
- A second vocabulary generator, new USPTO MCP host, law-practice overlay, EPO,
  BigQuery, SerpApi, ppubs, or structured application search.

## Source Hierarchy

1. The user-ratified 2026-07-14 graduation objective.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. [`goals/uspto-prosecution-read/SPEC.md`](../uspto-prosecution-read/SPEC.md)
   for the shared generator contract.
7. The exploration [`BRIEF.md`](../../explorations/uspto-patent-driver-depth/BRIEF.md),
   [`MAP.md`](../../explorations/uspto-patent-driver-depth/MAP.md),
   [`DECISIONS.md`](../../explorations/uspto-patent-driver-depth/DECISIONS.md), and
   [`PTMNFEE2` research note](../../explorations/uspto-patent-driver-depth/research/ptmnfee2-maintenance-fee-dataset.md).

## Target Surfaces

- `packages/drivers/uspto` for product discovery, staged download/validation,
  schema-first parsing, typed failures, full-replace publication, and fixtures.
- The generation/vocabulary mechanism owned by
  `goals/uspto-prosecution-read`, consumed without duplication.
- Focused package tests, attributed fixtures, refresh manifests, and evidence.

## Constraints

1. Every weekly file is cumulative. Refresh stages the complete candidate,
   validates it, and atomically replaces the prior snapshot; it never appends.
2. P0 must download an authorized current release and record exact filenames,
   archive members/layout, delimiter or byte widths, encoding, null/date/header
   rules, row count, compressed/uncompressed sizes, response headers, and
   documentation/code-description checksums before schemas freeze.
3. P0 must enumerate and diff the complete current `MaintFeeEventsDesc`; fee
   schedule codes, PFW event codes, and document codes are distinct namespaces
   and cannot stand in for it.
4. P0 live-probes whether the resolved archive accepts anonymous download after
   the 2026 registration change and records numeric limits if published or
   observed. Discovery assumes account/API-key mediation; secrets remain redacted
   and signed/ephemeral URLs are never committed.
5. The refresh manifest records product/release identity, landing and resolved
   source identity, retrieval time, compressed/uncompressed size, row/rejected
   counts, source/documentation/code-list checksums, parser/generator version,
   and vocabulary diff.
6. Pinned-input reruns are byte-for-byte deterministic. Unknown codes and schema
   drift preserve raw values, fail explicitly, and cannot publish a partial or
   silently changed artifact.
7. Fixtures contain only small government-authored structured excerpts and
   record `source: USPTO`, product id, release date, source URL, full-source
   checksum, extraction method/record identities, access date, and Public Domain
   Mark 1.0 attribution. Do not include portal HTML, seals/logos, drawings, or
   third-party material.
8. Driver output is native event evidence only. The patent spine owns legal
   interpretation, date rules, family/reissue handling, and attorney review.
9. `goals/law-docketing-reliability` owns refresh scheduling, cursors, sweeps,
   heartbeat, recovery, and no-silent-failure behavior.

## Dependency and Consumer Edges

- Hard dependency: `goals/uspto-prosecution-read` supplies the single shared
  four-vocabulary generation/refresh/drift mechanism. This packet must reuse it.
- Consumer: `goals/law-docketing-patent-spine` receives one fixture-shaped
  maintenance-event observation for its acceptance case.
- Orchestrator: `goals/law-docketing-reliability` schedules refresh and recovery;
  it does not change this parser's full-replace semantics.

## Decision Log

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-07-14 | All four native vocabularies share one deterministic, checksum-pinned, reviewable mechanism. | [`Q4`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q4-native-vocabulary-lifecycle) |
| 2026-07-14 | Native decoding stays in `@beep/uspto`; legal meaning and translation stay in law practice. | [`Q5`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q5-placement-and-translation-boundary) |
| 2026-07-14 | `PTMNFEE2` is a weekly cumulative, checksum-pinned, validated full replacement with attributed fixtures. | [`Q8`](../../explorations/uspto-patent-driver-depth/DECISIONS.md#2026-07-14--q8-ptmnfee2-ingestion) |
| 2026-07-14 | Keep bulk ingest separate from the prosecution read but reuse its generation substrate. | [`MAP judgment`](../../explorations/uspto-patent-driver-depth/MAP.md#judgment-keep-ptmnfee2-separate) |

## Acceptance Criteria

- [ ] P0 evidence answers the exact current layout/archive members, complete
      code list, compressed/uncompressed size, row count, numeric rate limits,
      and anonymous resolved-file behavior without invented values.
- [ ] The refresh resolves and checksum-pins the release, documentation, and
      code descriptions; its manifest contains every required provenance/count/
      version field and no credential or ephemeral signed URL.
- [ ] A corrupt, partial, schema-drifted, or unknown-code candidate fails before
      publication while preserving raw diagnostic values; the prior complete
      snapshot remains available.
- [ ] A valid cumulative release replaces the prior snapshot atomically and
      cannot duplicate rows through append semantics.
- [ ] The parser and `MaintFeeEventsDesc` artifact reuse the prosecution goal's
      shared generation mechanism; pinned reruns are byte-identical and release
      drift yields reviewable diffs.
- [ ] Attributed network-free fixtures decode into typed native maintenance
      events shaped for the patent-spine intake, with no legal status/deadline.
- [ ] Focused package/full-replace tests, repo gates, reflection lint, and Yeet
      PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/uspto-ptmnfee2-ingest/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/uspto-ptmnfee2-ingest/ops/manifest.json` | Passes |
| Packet references | `rg -n "uspto-ptmnfee2-ingest|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-ptmnfee2-ingest` | Expected references present |
| Packet whitespace | `git diff --check -- goals/uspto-ptmnfee2-ingest` | Passes |
| P0 source proof | Authorized capture plus dated evidence | Every named current-layout/access unknown resolved or P1 blocked |
| Full replacement | Focused corrupt/partial/duplicate/atomic-publication tests | No append and no partial publication; prior good snapshot survives failure |
| Determinism/drift | Pinned rerun and next-release fixture | Byte-stable rerun and reviewable manifest/vocabulary diff |
| Attribution/intake | Fixture metadata audit plus patent-spine contract test | Attribution complete; typed native events only |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- The current release layout, code companion, access behavior, or licensing
  provenance cannot be verified honestly.
- The shared generation mechanism cannot represent `PTMNFEE2` without forking.
- Publication cannot be made atomic or raw unknown/drift evidence cannot survive.
- The work would require legal interpretation or scheduler ownership in driver.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
