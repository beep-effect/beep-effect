# Alchemy Vault-Sync Slice Spec

## Objective

Migrate the `documents` vault-sync bounded context onto `@alchemy.run/domain` end to end: a Postgres Platform driver with the Effect Cluster workflow engine, aggregates/sagas/policies/views for destinations, sync operations and conflicts with Box as External System, one Api (HTTP + OpenAPI, CLI, MCP limited to Views) behind Session middleware, an optimistic + offline-intents client, legacy tables rebuilt as Projections after a single-writer cutover, and the doctrine amendments that let every later slice follow.

Graduated from `explorations/alchemy-domain-adoption` (brief: `explorations/alchemy-domain-adoption/BRIEF.md`; decisions D0–D17: `explorations/alchemy-domain-adoption/DECISIONS.md`). This is the first vertical slice of the alchemy adoption program and the proving ground for the migration recipe, the driver and the conformance suite that the queued slices in `explorations/alchemy-domain-adoption/MAP.md` reuse.

## Non-Goals

- Any CRDT or local-replica sync engine (D8); CRDT content values belong to the document-editor packet.
- Migrating any slice other than `documents` vault-sync; deleting the entity kit before its last consumer migrates (D3). The kit is frozen (forbidden in new work) in this goal.
- Cloudflare Durable Objects as product storage (D1).
- A dual-write shadow period (D7).
- MCP command tools (D13); MCP exposes Views only.
- Regenerating public entity ids (D14).
- A `@beep/shared-domain` facade over alchemy (D4).
- Tracking alchemy betas past 2.0.0-beta.85 inside this goal (D11).
- Upstream acceptance of the Postgres driver as a dependency of completion (D16).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `package.json` root catalog and `bun.lock`: lockstep bump of `alchemy`, `@alchemy.run/cloudflare`, `@alchemy.run/domain` to `2.0.0-beta.85` (D11).
- `packages/documents/domain/src/**`: states, events, commands, rejections, decide/evolve, Views as pure read contracts, Stories (D9).
- `packages/documents/use-cases/src/**`: the assembled `Domain.Model` and `Api`, policies, projections, sagas, middleware contracts; command dispatch as the use-case boundary (D9).
- `packages/documents/server/src/**` (`aggregates/Sync/*`): Postgres Platform + Cluster engine Layers, Box External System adapter, Projections into the legacy sync tables, genesis import and replay-and-diff (D1, D6, D15).
- A new driver package created with `bun run beep create-package` for the Postgres `Platform` implementation and its conformance suite (location fixed in P0; candidate name `alchemy-postgres` under the shared or `_internal` family per `standards/ARCHITECTURE.md`).
- `packages/documents/tables/**`: drizzle tables retained as read models; write path removed.
- Frontend package that hosts the vault-sync UI: optimistic prediction + persisted offline intent queue (D8).
- `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`, `standards/architecture/GLOSSARY.md` (and the numbered `standards/architecture/` chapters where the rows live): entries for Model, Command, Event, Aggregate, View, Projection, Saga, Platform, Session; declarative-vs-hosting note; entity-kit freeze (D16).
- `packages/shared/domain/src/entity/**`: freeze marker and lint guard forbidding new imports; no deletion.
- This packet.

## Constraints

- Design order: schema → `Context.Service` contract → implementation. Effect v4 only; validate every alchemy and Effect API against `.repos/alchemy` and `.repos/effect`, never priors.
- Event streams are the system of record (D2); stored events are never rewritten; every event carries a schema version and upcasters run at read (D12). Genesis-import events are v1.
- Single-writer cutover (D7): the drizzle write path for the slice is deleted in the same PR that makes the alchemy Model the writer; a replay-and-diff test proves projected rows equal legacy rows first.
- Provenance (principal, source kind, timestamp) rides the envelope via Session middleware (D10); payload fields only when the actor is business-meaningful. `Principal` and `SourceKind` survive as explicit value schemas.
- Stream ids are the existing branded public ids; unique-value reservations are org-qualified; Session middleware enforces org membership independently of key shape; a temporary numeric mapping serves legacy SQL references (D14).
- Views are security boundaries: tests cover revoked membership after subscription, cross-tenant key guessing, stream history, and CLI/MCP/HTTP against one policy (D13).
- Local-first is topology 2: prediction per command, persisted intent queue, server `decide` is the only authority (D8).
- Observability: kernel spans nest under registered boundary spans; correlation ids propagate through outbox and workflow; payload attributes audited for PII before deploy (D17).
- Rabbit holes from the brief are P0 spikes, not assumptions: LiteralKit/`$I` annotation propagation through alchemy constructors; envelope metadata survival through CatchUp/Backfill and Postgres storage; where the event version slot lives; `ClusterWorkflowEngine` + `SqlMessageStorage` crash-and-resume on Postgres; a Postgres-owned replay path (upstream Backfill is Cloudflare-shaped).
- Doctrine amendments land in the goal's first PR (D16). Secrets stay `op://` references. Corpus and client documents never enter the repo or a lane.

## Acceptance Criteria

- [ ] Lockstep group at `2.0.0-beta.85`; `apps/beep-effect-web` still deploys.
- [ ] Postgres Platform driver passes the conformance suite, and the same suite passes against `Domain.InMemory`.
- [ ] Sagas run on `ClusterWorkflowEngine` over Postgres; the scan → push → reconcile saga survives a forced process restart (crash-and-resume test).
- [ ] Vault-sync aggregates (destination, sync operation with lease + Deadline, conflict), Box External System, org-qualified Unique destination names, Policies and Projections are implemented in the D9 split; the slice no longer imports `packages/shared/domain/src/entity/*`.
- [ ] Genesis import of existing rows as v1 events; replay-and-diff proves projected rows equal legacy rows; the drizzle write path for the slice is deleted.
- [ ] One Api serves HTTP + OpenAPI, CLI and an MCP server exposing Views only, all under Session middleware that stamps principal and source kind into the envelope; Views-as-security-boundary tests pass.
- [ ] Frontend: optimistic prediction and a persisted offline intent queue; a `bun run beep qa` recording shows an intent queued offline, replayed on reconnect, and a server rejection reverting a prediction.
- [ ] Observability: boundary spans registered in the span catalog with kernel spans nested; PII audit of event payload attributes recorded in `history/`.
- [ ] Doctrine: ARCHITECTURE/DECISIONS/GLOSSARY amendments and the entity-kit freeze (lint guard) merged in the first PR.
- [ ] `goals/alchemy-vault-sync-slice/research/` holds the P0 spike results (annotation propagation, envelope survival, version slot, replay path).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/alchemy-vault-sync-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/alchemy-vault-sync-slice/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/alchemy-vault-sync-slice` | Passes |
| Touched packages | `bun run beep quality package-verify @beep/documents-domain @beep/documents-use-cases @beep/documents-server <driver package>` | Green |
| Conformance suite | driver package tests, InMemory and Postgres projects | Green on both |
| Crash-and-resume | saga test that kills and restarts the runtime mid-flow | Saga completes exactly once |
| Replay-and-diff | genesis import then projection rebuild compared with legacy rows | Zero diff |
| View security | boundary tests (revoked membership, cross-tenant keys, history, CLI/MCP/HTTP) | All deny correctly |
| Browser QA | `bun run beep qa` recording of offline intent → replay → rejection revert | Judge: zero required findings |
| Doctrine | `bun run beep architecture` and docs lint on the amended standards | Green |
| Hosted gate | `bun run beep yeet final-check`, `yeet ready`, `yeet monitor --until-ready` | `merge-ready: yes` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-05 | Inherit D0–D17 from `explorations/alchemy-domain-adoption/DECISIONS.md` as binding | Grilled and locked with the operator over rounds 1–4 | Reopen the exploration at `align` and amend the entry there |
| 2026-11-05 | Driver and doctrine ship inside this goal, not a separate goal | Operator shape check 2026-11-05: one vertical slice | Split the driver into a separate alchemy-postgres-platform goal at P0 if the conformance suite outgrows the slice |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
