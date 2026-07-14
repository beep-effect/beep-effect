# USPTO Patent Driver Depth — Map

## Candidate Goal Packets

| Slug | Disposition | Mission | Depends on / feeds |
| --- | --- | --- | --- |
| [`uspto-prosecution-read`](../../goals/uspto-prosecution-read/README.md) | **GRADUATED 2026-07-14** | Deliver the known-application, provenance-bearing prosecution observation and deterministic generated artifacts for all four native vocabularies. P0 proves the OA endpoint/envelope, the vocabulary retrieval route, and the `PTMNFEE2` implementation unknowns needed to keep one generation mechanism honest. | Reuses shipped `goals/mcp-kit` and `goals/uspto-mcp`; feeds `goals/law-docketing-patent-spine`; exposes technical retry hints consumed by `goals/law-docketing-reliability`. |
| [`uspto-ptmnfee2-ingest`](../../goals/uspto-ptmnfee2-ingest/README.md) | **GRADUATED 2026-07-14** | Discover and checksum-pin the weekly cumulative release, full-replace parse it into typed native maintenance events, and emit attributed network-free fixtures and provenance. | Reuses the first goal's generation/vocabulary mechanism; feeds `goals/law-docketing-patent-spine`; scheduling remains in `goals/law-docketing-reliability`. |
| `uspto-search-structured` | **SPIKE-GATED** | Prove the applications endpoint's structured POST contract, then expose an honest schema for method/body/fields/pagination/errors and filter/range/sort asymmetry. | Independent follow-on to `uspto-prosecution-read`; extends shipped `goals/uspto-mcp` only after live proof. |
| `epo-driver` | **GATED SIBLING** | Add an EPO OPS wrapper and hard-gated MCP toolkit only when a named product consumer pulls it. | Consumer pull required; reuse `goals/mcp-kit`; future driver/MCP work is NET-NEW. |
| `google-patents-bigquery-driver` | **GATED SIBLING** | Add a cost-authorized, attribution-preserving BigQuery wrapper and hard-gated MCP toolkit only when a named product consumer pulls it. | Consumer pull and cost authorization required; reuse `goals/mcp-kit`; future driver/MCP work is NET-NEW. |
| `serpapi-google-patents` | **PARKED** | No goal until a named pull justifies paid scraping and terms risk. | None while parked. |
| `uspto-ppubs-experiment` | **PARKED EXPERIMENT** | Best-effort live probe of the version-sensitive full-text/session surface; never blocks the official prosecution read. | Separate approval required. |

## Judgment: Keep `PTMNFEE2` Separate

Do not fold `uspto-ptmnfee2-ingest` into the first goal. Both slices reuse one
generated-vocabulary mechanism, so the first goal's P0 must verify the remaining
`PTMNFEE2` unknowns and ensure that mechanism fits all four vocabularies. Delivery
should still be separate: a single-application API observation and a weekly
cumulative bulk replacement have different credentials, failure modes, fixture
shapes, freshness semantics, and acceptance proof. The sibling can follow
without expanding the first vertical slice.

## Sequencing and Dependency Edges

1. `uspto-prosecution-read` establishes the driver-promised intake record,
   endpoint authority, native vocabulary generation, and typed error/retry
   contract.
2. `uspto-ptmnfee2-ingest` reuses that deterministic generation substrate for
   the weekly bulk source, while preserving a separate release/replace proof.
3. `uspto-search-structured` proceeds only after its live applications-endpoint
   spike; it is not a prerequisite for either docketing read.
4. EPO OPS and Google Patents BigQuery remain independent consumer-pulled goals.
   SerpApi and ppubs remain parked.

The first two goals provide official technical records to
`goals/law-docketing-patent-spine`. That consumer owns driver-neutral ports,
legal interpretation, and attorney-reviewed rule versions.
`goals/law-docketing-reliability` consumes retry/freshness signals but owns the
15-minute sequential scheduler, durable cursor, daily sweep, heartbeat, and
recovery. `goals/mcp-kit` and `goals/uspto-mcp` are completed-retained shipped
dependencies: new USPTO operations extend the existing host, while matter
consent is enforced at MCP dispatch and the law-practice server adapter.

## First Vertical Slice

Given a known application number, call the current authoritative USPTO OA/PFW
surface and decode one observation containing:

- normalized identifiers;
- numeric application status and generated native description;
- ordered `eventDataBag` transaction events with authoritative event/mail dates;
- an authoritative office-action/document code, identifier, date, and source
  reference;
- source, operation class, retrieval time, freshness, source cursor, upstream
  identity, and parser/vocabulary versions;
- typed technical failures and retry hints.

The proof is a network-free contract test that decodes provenance-bearing
fixtures into the exact record expected by the patent-spine intake port. A
credentialed capture may refresh fixture evidence but is optional acceptance.
P0 must first settle the endpoint/envelope and transaction-source reconciliation.

## Capability Check

| Component | Existing capability or gap | Disposition |
| --- | --- | --- |
| Known-application reads, document listing/download, normalization, same-origin key scoping, typed errors | `packages/drivers/uspto/src/Uspto.service.ts`, `Uspto.models.ts`, and `Uspto.errors.ts` | **EXTEND** the live `@beep/uspto` service; do not restart it. |
| USPTO MCP host | `packages/drivers/uspto-mcp`; `UsptoSourceAuthRegistration` is shipped with `gate: "soft"` and `Server.ts` composes the existing toolkit | **EXTEND** this host; no second package. |
| Credential gates and dispatch policy | `packages/foundation/capability/mcp-kit/src/SourceAuth.ts` ships `none/soft/hard`; `TierGate.ts` ships fail-closed dispatch and audit records | **REUSE** from completed `goals/mcp-kit`. |
| Driver-neutral patent-spine intake and legal meaning | `goals/law-docketing-patent-spine` plus law-practice domain/use-cases/server boundaries | **CONSUMER-OWNED**; server is the sole translation boundary. |
| Reliability orchestration | `goals/law-docketing-reliability` | **CONSUMER-OWNED** scheduler, cursor, sweep, heartbeat, recovery. |
| OA retrieval and prosecution-observation decoding | No current joined native observation | **NET-NEW** inside `@beep/uspto`. |
| Four-vocabulary deterministic artifacts and drift report | No current USPTO generator/artifact | **NET-NEW**, package-private, reviewable, checksum-pinned. |
| `PTMNFEE2` discovery, parser, full-replace manifest, and fixtures | No current parser or refresh path | **NET-NEW** inside `@beep/uspto`. |
| Technical source-capability metadata and matter-consent schema/enforcement | Current `SourceAuthRegistration` covers name/env/gate/signup, not operation, matter, cost, or attribution policy | **NET-NEW EXTENSION** across driver/MCP metadata and law-practice-owned authorization, enforced at both dispatch boundaries. |
| EPO OPS and Google Patents BigQuery wrappers | `packages/drivers/epo` and `packages/drivers/google-patents-bigquery` are absent | **NET-NEW, GATED** until consumer-pulled. |

## Open Risks Inherited From The Brief

- OA Text Retrieval versus Patent File Wrapper authority and response-envelope
  shape must be proven in the first goal's P0.
- One authoritative retrieval route and stable checksums for all four native
  vocabularies must be proven before generated artifacts become decode authority.
- `PTMNFEE2` exact 2026 layout, archive members, complete code list, current
  size, numeric rate limits, and anonymous-download behavior remain unknown and
  must be captured honestly in P0.
- Matter authorization must remain independent from credential resolution and
  must carry approver, scope, expiry/revocation, provenance, and audit evidence.
- Routine acceptance remains network-free; optional credentialed captures must
  not become a hidden CI dependency.
- `searchStructured` remains outside the public contract until its live spike
  proves the applications endpoint.
