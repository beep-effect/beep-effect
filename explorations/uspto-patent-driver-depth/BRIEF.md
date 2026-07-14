# USPTO Patent Driver Depth — Brief

## Problem

The patent-docketing spine has graduated, but `@beep/uspto` does not yet provide
the minimum official, typed prosecution observation that its intake port can
consume. It can read application metadata and File Wrapper documents, yet the
spine still lacks one stable contract joining numeric application status,
transaction events, the authoritative office-action/document reference,
provenance, freshness, and typed technical failures.

Maintenance-fee evidence has the same substrate gap at bulk scale. `PTMNFEE2` is
an official weekly cumulative event feed, but its current release must be
discovered, checksum-pinned, schema-decoded, and replaced atomically before the
docketing domain can interpret payment, lapse, or reinstatement evidence.

The shape is deliberately driver depth, not a second docketing design. Native
USPTO facts belong in `@beep/uspto`; driver-neutral intake, legal meaning,
deadlines, scheduling, reconciliation, and attorney-reviewed rules remain with
the law-practice packages and their graduated goals.

## Appetite

**Proposed — ratify at shape sign-off:** fund a bounded first wave of in-place
`@beep/uspto` depth: first, the known-application prosecution read and its four
generated native vocabularies; second, a separately sequenced `PTMNFEE2` bulk
ingest sibling. Keep structured application search spike-gated and independent.
EPO OPS and Google Patents BigQuery do not enter this appetite unless a named
product consumer pulls them; SerpApi remains parked and ppubs remains an
explicitly best-effort experiment.

The first wave may add cohesive modules and fixtures inside the existing USPTO
driver and extend the shipped USPTO MCP host. It does not create another host,
another law-practice overlay, polling infrastructure, or cross-driver framework.

## Solution Sketch

### Known-application prosecution observation

```text
known application number
  -> @beep/uspto native read + schema decode
  -> provenance-bearing prosecution observation
  -> law-practice/server adapter (the only translation boundary)
  -> patent-spine driver-neutral intake port
```

The driver-promised observation is the smallest stable record the spine needs:

- normalized application and publication/patent identifiers when present;
- numeric application status code plus the generated native description;
- ordered `eventDataBag` events with authoritative event/mail date, event code,
  native description, and upstream record identity;
- authoritative office-action/document reference, including document code,
  identifier, date, and retrievable source reference;
- source identity and operation class, retrieval timestamp, source freshness,
  source cursor, upstream response/release identity, checksums when applicable,
  and parser/vocabulary version;
- typed failures for configuration, authentication, authorization/rate limiting,
  transport, response status, endpoint drift, and schema decoding.

P0 reconciles the two candidate OA surfaces: Patent File Wrapper transactions
and OA Text Retrieval. It proves the live endpoint/envelope and whether
transactions are read from a dedicated path or an aggregate projection before
the contract fixture is frozen.

Routine CI is network-free and decodes attributed, provenance-bearing fixtures.
Credentialed live contract captures are optional evidence, consistent with the
shipped `goals/uspto-mcp` policy; they are not routine acceptance gates.

### `PTMNFEE2` sibling flow

```text
weekly cumulative PTMNFEE2 release
  -> account/API-key-mediated discovery
  -> checksum-pinned staged download and validation
  -> full-replace schema parse in @beep/uspto
  -> typed native maintenance events + generated code vocabulary
  -> patent-spine interpretation and review
```

The refresh records product and release identity, resolved source, retrieval
time, compressed and uncompressed size, row counts, documentation and content
checksums, parser version, and vocabulary diff. It preserves unknown raw values
and fails closed on schema/code drift. It never computes payment windows,
expiration, reinstatement, family treatment, or legal status.

### Vocabulary and drift contract

One package-private generation mechanism covers four native vocabularies:
application status, OA transaction events, document codes, and `PTMNFEE2`
maintenance events. Each artifact records its authoritative source, retrieval
date, checksum, and refresh command. Runtime endpoints can detect drift and
report it, but cannot silently alter decode behavior. Reviewable refresh diffs
are distinct from attorney-reviewed patent-spine rule versions.

### Credentials and matter consent are independent axes

The technical source-capability record, owned by drivers and MCP `SourceAuth`,
describes source, operation class, public-identifier versus free-text use,
credential class, cost class, and attribution duty. The law-practice matter
authorization record contains approver, matter, source, operation class, scope,
expiry or revocation, consent provenance, and audit evidence.

Both are checked at the law-practice server adapter and MCP dispatch gate.
Credentials never imply consent. Public-identifier reads default allowed; every
external free-text operation needs explicit matter authorization. BigQuery also
needs cost authorization and CC BY attribution retention. Existing ODP MCP tools
keep the shipped soft gate; future credentialed toolkits default hard; keyless
sources use `none` plus the matter-consent policy.

### Request and scheduling ownership

`@beep/uspto` owns rate-limit-safe single-request behavior, bounded technical
retries, and typed retry hints. `goals/law-docketing-reliability` owns the
15-minute sequential scheduler, durable cursor, daily sweep, heartbeat,
recovery, and no-silent-failure proof. The driver neither polls nor decides when
a matter must be refreshed.

## Rabbit Holes

- **OA authority and envelope:** P0 must reconcile Patent File Wrapper
  transactions with OA Text Retrieval and prove the current authoritative
  document/event join.
- **Generated vocabulary drift:** prove one authoritative retrieval route and
  stable checksums for all four vocabularies; namespace collisions between
  event codes and document codes must remain explicit.
- **Structured POST:** `searchStructured` needs a live applications-endpoint
  proof for method, body, field list, pagination, errors, and the
  `name`/`value[]` versus `field` asymmetry.
- **ppubs:** endpoint/session behavior is version-sensitive. It remains a
  best-effort experiment, never a prerequisite for the official OA read.
- **Live proof:** routine acceptance uses network-free fixtures; credentialed
  captures are optional, sanitized, and provenance-bearing.
- **`PTMNFEE2` 2026 unknowns:** exact layout and archive members, complete event
  code list, current compressed/uncompressed size, numeric rate limits, and
  anonymous resolved-file download behavior all remain P0 verification gates.

## No-Gos

- No polling orchestration, durable scheduler, heartbeat, recovery loop, or
  daily sweep in `@beep/uspto`.
- No deadline calculation, legal status, prosecution phase, family/reissue
  interpretation, or attorney rule ownership in the driver.
- No second USPTO MCP host and no dependency on the superseded MCP exploration;
  extend shipped `@beep/uspto-mcp` and reuse shipped `@beep/mcp-kit`.
- No PatentsView endpoint or compatibility layer.
- No mega-goal fan-out, `drivers/_shared`, or competing law-practice overlay.
- No EPO OPS or Google Patents BigQuery implementation until a named consumer
  pulls it; no SerpApi commitment.
- No production ppubs tier in the first wave; only a separately approved,
  best-effort experiment.
- No committed `searchStructured` public contract before the live spike.
