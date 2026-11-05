# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-03 — D0 adopt-and-graduate (operator ruling, not grilled)

**Question:** Should beep-effect adopt `@alchemy.run/domain`, and does this packet decide go/no-go?

**Answer:** Adopt. Firm operator decision. The packet graduates; its job is research, implementation levers and full leverage of the module. Every `@beep/<slice>-domain` package migrates eventually, every listed module feature is in scope across the program, and `@beep/effect-drizzle` is replaced eventually. The first goal migrates one vertical slice chosen for maximum feature coverage.

**Rationale:** Operator capture 2026-11-03 (`CAPTURE.md`). The hand-rolled entity kit is a less faithful DDD substrate than alchemy's Model/Command/Event/Aggregate/View/Policy/Saga set.

## 2026-11-03 — D1 persistence platform

**Question:** Alchemy ships only InMemory and Cloudflare Durable Objects platforms; beep runs Postgres. Where do migrated slices persist?

**Answer:** Build a Postgres implementation of the alchemy `Platform` contract as a repo-level driver. InMemory serves tests and Stories. The first goal builds it.

**Rationale:** Keeps the system of record where it is today and is reusable by every later slice. Rejected: Cloudflare DO (moves product data off Postgres onto Cloudflare); InMemory-first with a deferred platform (hosting, local-first and HTTP would not be proven against real storage). Recommended answer accepted. Research: `research/01-astra-source-analysis.md` §1 (contract + design), `research/02-muse-deep-research.md` ("A Postgres Platform copies prior art").

## 2026-11-03 — D2 system of record

**Question:** For migrated slices, are event streams or state tables authoritative?

**Answer:** Event streams are the system of record. Existing drizzle tables become Views/Projections (read models); existing rows are imported as baseline/genesis events.

**Rationale:** Faithful to the event-sourced kernel; it is what gives Stream, Projection, Saga and Backfill their value. Rejected: keeping CRUD rows authoritative with alchemy as a decision layer only (fights the kernel). Recommended answer accepted.

## 2026-11-03 — D3 entity-kit retirement

**Question:** How is `packages/shared/domain/src/entity/*` (115 importing files) retired?

**Answer:** Strangler. Freeze now: the kit is forbidden in new work and recorded as transitional compatibility in doctrine. Each slice migration removes its own imports; the kit is deleted in the PR that migrates its last consumer.

**Rationale:** Avoids coupling every slice to goal 1. Rejected: deleting it in goal 1 (huge cross-slice PR set); a thin adapter re-implementing the kit over alchemy (keeps the smelly abstractions alive). Recommended answer accepted. Note (Astra §2): the kit's *semantics* that users rely on (principal, source kind, audit provenance, public ids) are preserved as explicit value/event schemas; only the inheritance/SQL kit retires.

## 2026-11-03 — D4 topology placement

**Question:** Where do alchemy constructs live in the slice topology?

**Answer:** Slice `domain` packages import `@alchemy.run/domain` directly, the way they import `effect/Schema`. No shared-kernel wrapper. The Platform implementation is a driver; hosting Layers live in `server` or app runtime. Recorded as an architecture-wide DECISIONS entry plus glossary terms when doctrine is amended.

**Rationale:** Rejected: a `@beep/shared-domain` facade (risks becoming the next smelly kit); moving Api/Model to use-cases/server (diverges from alchemy's layout and its client/MCP derivation). Recommended answer accepted. Open refinement (Astra §4 friction table): whether the assembled `Domain.Model` and `Api` declarations sit in `domain` or in `use-cases`, given that domain must not import SQL/HTTP/server requirements and that generated Api dispatch becomes a use-case boundary. Carried to round 2/3.

## 2026-11-03 — D5 first vertical slice

**Question:** Which slice migrates first, to exercise the most module features?

**Answer:** `documents` vault-sync (Box/Google Drive sync: destinations, leases, sync operations, Box as External System).

**Rationale:** Astra ranks it 25/25 (`research/01-astra-source-analysis.md` §3): it needs External System, Saga, Deadline, Unique value, Projection, Policy, MCP and local-first intents in one bounded context, and it has few consumers of the entity kit. Rejected: law-practice DocketIntake (Muse's pick; 34k LOC slice, lawyer-facing review surfaces raise the blast radius of a first migration); epistemic (strong fit, fewer External System / Deadline exercises). Operator chose in round 2.

## 2026-11-03 — D6 Saga durability

**Question:** `Domain.Saga` runs on `effect/workflow` `WorkflowEngine`; InMemory bundles one. What backs it on Postgres?

**Answer:** Reuse Effect v4's `effect/cluster` `ClusterWorkflowEngine` + `SqlMessageStorage` over the same Postgres. The Postgres Platform driver provides `Platform | WorkflowEngine`, mirroring what InMemory bundles.

**Rationale:** Already shipped in the pinned Effect; no second workflow runtime to own. Rejected: hand-rolled outbox-driven saga runner (reinvents durable execution); Cloudflare Workflows (off-Postgres). Recommended answer accepted.

## 2026-11-03 — D7 cutover strategy

**Question:** How does a slice move from drizzle CRUD rows to event streams without dual writes?

**Answer:** Single-writer cutover per slice: genesis import of existing rows as baseline events, then the alchemy Model becomes the only writer; drizzle tables are rebuilt as Projections from the stream. No period of dual-writing.

**Rationale:** Dual writes are the classic CRUD→ES failure (`research/02-muse-deep-research.md` "Strangling CRUD into aggregates without dual writes", KurrentDB recipe). Rejected: dual-write shadow period (two sources of truth); big-bang across slices (contradicts D3). Recommended answer accepted.

## 2026-11-05 — D8 local-first topology (revised after /teach lesson)

**Question:** Which local-first topology does the first goal target: offline intents (server decides), local replica + rebase, or CRDT (device decides)?

**Answer:** Topology 1+2: optimistic prediction for every command plus a persistent offline intent queue flushed on reconnect, with the server's `decide` the only authority. CRDTs are scoped to collaborative *content values* (brief text, canvas layout) embedded inside a server-owned aggregate, and belong to the later document-editor packet, not this one. Topology 3 (local replica + rebase, Replicache/Zero style) is revisited only if offline reads of derived state become a product requirement.

**Rationale:** Operator first answered "full replica sync" in round 2, asked for a `/teach` lesson comparing it with CRDTs (`~/YeeBois/teach/local-first-sync/`, artifact https://claude.ai/artifact/GG7dSXrmLj6zWTpH8rfVLg), then on 2026-11-05 chose this recommendation. Vault-sync invariants (destination-name uniqueness, sync-operation leases, Box as single-writer external) are not invariant-confluent, so no device-decides topology can hold them; alchemy ships topology 2 and no sync engine for topology 3. Rejected: CRDT-first (guarantees convergence, not invariants); replica + rebase now (needs a sync engine alchemy lacks, for a slice whose offline value is write intents, not derived reads).

## 2026-11-05 — D9 Model/Api placement (closes the D4 refinement)

**Question:** `Domain.Model` bundles declarations with policies, projections, sagas and a layer builder; beep's `domain` role must not import SQL/HTTP/server requirements. Where do the pieces live?

**Answer:** Split by purity. `domain`: states, events, commands, rejections, decide/evolve, Views as pure read contracts, Stories. `use-cases`: the assembled `Domain.Model` and `Api` (policies, projections, sagas, middleware contracts); alchemy's command dispatch is the use-case execution boundary and carries the repo's validation/error/span rules. `server`: Layer instantiation (Postgres Platform, Cluster workflow engine, HTTP/MCP hosting). Doctrine gets one note distinguishing declarative constructors from runtime hosting.

**Rationale:** Astra §4 friction table rows "Domain versus hosting", "Command placement", "Api can bypass use-case boundary". Rejected: whole Model in domain (requires ratifying policies/sagas as pure and weakening the domain-role rule); whole Model in server (client/MCP derivation would import from server). Recommended answer accepted.

## 2026-11-05 — D10 provenance representation

**Question:** The entity kit stamps principal, source kind and audit provenance on every row. How is that carried under alchemy?

**Answer:** Envelope via Session middleware. Session middleware resolves the caller and stamps principal, source kind and timestamp into command metadata; the kernel carries it into the event envelope. Payload fields only where the actor is business-meaningful (e.g. `approvedBy`). Audit reads come from the stream, not a column. `Principal` and `SourceKind` survive as explicit value schemas (D3).

**Rationale:** Keeps event payloads about the business fact; provenance is cross-cutting and belongs to the envelope the kernel already owns. Rejected: payload fields on every event (duplicated, easy to forget); both always (double bookkeeping). Recommended answer accepted. Verify in the goal spike that envelope metadata survives Backfill/CatchUp and the Postgres driver's storage shape.

## 2026-11-05 — D11 version pin

**Question:** beep pins alchemy / @alchemy.run/cloudflare beta.84; @alchemy.run/domain is beta.85 (breaking); 84 betas in 203 days.

**Answer:** Bump the lockstep group (alchemy, @alchemy.run/cloudflare, @alchemy.run/domain) to 2.0.0-beta.85 as the first task of goal 1, then freeze the trio for the whole goal. Later bumps are explicit goal tasks with a migration note.

**Rationale:** The research read beta.85 source and docs; one migration now avoids designing against stale shapes. Rejected: staying on beta.84 (research mismatch); tracking latest continuously (Grok: breaking changes accelerating, one-person merge). Recommended answer accepted.

## 2026-11-05 — D12 event schema versioning

**Question:** Stored events outlive their schemas (D2). Versioning strategy?

**Answer:** Upcasters at read. Each event carries a schema version in the envelope; the Model declares an upcaster chain (vN → current) applied on load and replay. Stored events are never rewritten; decide/evolve see only the current shape. Genesis-import events are tagged v1 from day one.

**Rationale:** Standard event-store practice; keeps domain code to one shape per event. Rejected: versioned unions handled in evolve (every version lives forever in domain code); deferring (genesis events would carry no version tag). Recommended answer accepted. Open implementation detail for the shape stage: whether alchemy's Event constructor admits a version annotation or the Postgres driver owns the upcast step.

## 2026-11-05 — D13 MCP scope for goal 1

**Question:** Alchemy derives an MCP server from the Api; generated tools can bypass use-case discipline. What does goal 1 expose?

**Answer:** Read-first. Goal 1 publishes a least-privilege Api whose MCP tools are the vault-sync Views (sync status, destinations, conflicts) under Session middleware. Commands stay HTTP/CLI only; command tools arrive once the Views-as-security-boundary tests (revoked membership after subscription, cross-tenant key guessing, stream history, CLI/MCP/HTTP against one policy) pass.

**Rationale:** Muse "MCP inherits the Api's discipline"; Astra §4 "Api can bypass use-case boundary". Rejected: Views + safe commands (more surface before the boundary tests exist); full Api (security rests entirely on middleware). Recommended answer accepted.

## 2026-11-05 — D14 stream keys and tenancy

**Question:** Key strategy for migrated aggregates (stream ids, uniqueness reservations, legacy SQL references)?

**Answer:** Keep existing branded public entity ids as stream ids; never regenerate. Unique-value reservations and tenant-local keys are org-qualified (orgId + name). Session middleware enforces org membership independently of key shape. A temporary numeric mapping table serves legacy SQL references until the last projection that needs it is dropped.

**Rationale:** Astra §6 item 4. Preserves bookmarks, URLs and external references; tenancy is enforced by the session, not inferred from the key. Rejected: org-prefixed composite stream ids (rewrites every stored public id); fresh alchemy-minted keys (breaks every external reference). Recommended answer accepted.

## 2026-11-05 — D15 projections in goal 1

**Question:** Which drizzle tables survive goal 1, and how?

**Answer:** Vault-sync's existing tables stay as Postgres read models rebuilt from the stream by alchemy Projections; the effect-drizzle write path is deleted for the slice. A replay-and-diff test proves projected rows identical to the legacy rows before cutover (D7).

**Rationale:** Keeps SQL consumers (reports, cross-slice joins) working while removing the second writer. Rejected: Views only (breaks SQL consumers); frozen legacy mirrors (two copies of every read model). Recommended answer accepted.

## 2026-11-05 — D16 upstream contribution and doctrine timing

**Question:** Contribute the Postgres Platform upstream? When do doctrine amendments land?

**Answer:** Repo-first. Build the driver in-repo against the Platform contract; once goal 1's conformance suite passes against InMemory and Postgres, open an upstream alchemy-run/alchemy issue or PR offering it. Doctrine amendments (standards/ARCHITECTURE, DECISIONS, GLOSSARY entries for Model, Command, Event, Aggregate, View, Projection, Saga, Platform, Session; the D9 declarative-vs-hosting note; the D3 kit freeze) land in goal 1's first PR so slice work follows the amended rules.

**Rationale:** Grok: one-person merge queue, Postgres PRs unreviewed; building upstream-first would block the goal. Rejected: upstream-first; never upstream with doctrine at closeout. Recommended answer accepted.

## 2026-11-05 — D17 observability mapping (agent-decided default, reversible)

**Question:** How do alchemy's kernel spans (command/view spans, correlation ids) map to the repo's span catalog and boundary-span rule?

**Answer:** Upstream kernel spans are library internals nested under the repo's boundary spans. The use-case dispatch adapter (D9) and the Postgres driver register their own named instruments in the span catalog; correlation ids are propagated through the outbox and workflow engine. Default event-payload attributes are audited for PII before the first deploy; View telemetry is disabled selectively where payloads are sensitive.

**Rationale:** Astra §4 "Observability" row; follows standards/architecture/12-observability.md without asking the operator (autonomy charter: not a money decision). Reverse by flipping the catalog registration to wrap kernel spans instead of nesting them.
