# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-03 (operator dump, verbatim intent)

I want to start using the Alchemy Domain module (https://alchemy.run/domain/what-is-ddd/) from alchemy (https://alchemy.run/llms.txt). Source cloned at `~/YeeBois/references/effect/alchemy` (also `.repos/alchemy`).

Reasoning:
- We use DDD in vertical slices.
- Remove the smelly abstractions in `packages/shared/domain/src/entity/`: AuditEntity.ts, BaseEntity.ts, EntityId.ts, EntityKit.ts, EntityRef.errors.ts, EntityRef.ts, index.ts, OrgEntity.ts, primitives.ts, Principal.ts, ProductEntity.ts, PublicEntityId.ts, SourceKind.ts.
- Alchemy's abstractions are much more faithful DDD primitives than beep-effect's.

Firm decision. This packet is about research, implementation, levers and how to properly leverage the module, not whether to graduate. It graduates.

- Every `@beep/<slice>-domain` package gets refactored onto this module.
- Use all abstractions: Domain Model, Command, Event, Aggregate, View, Projection, Stream, Policy, Saga, External System, Api, Story.
- Tests follow "Testing a model" and "Testing an Api".
- Frontend integrations: Optimistic Updates; Offline and local first.
- Agent features: MCP.
- Security: Sessions and middleware; Views as security boundaries.
- Consistency: Unique values; Deadlines.
- Hosting: Plain HTTP and OpenAPI; CLI; Observability.
- Eventually replace `@beep/effect-drizzle` entirely; for now choose a single vertical slice for the first graduated goal that exercises as many modules/abstractions/concepts as possible, to build understanding for later migrations.
- Research perspectives: gpt-6-astra medium; muse-wonder-1.0 xhigh (/deep-research); grok-4.7 xhigh (/deep-research).
- Use /grill-with-docs to ask clarifying questions, align, and lock decisions.

## 2026-11-03 (orientation facts gathered at intake)

- `@alchemy.run/domain` 2.0.0-beta.85 (Apache-2.0), reference HEAD d0b4a33 (2026-11-02). Peer deps: `alchemy` (uses `alchemy/Http`), `effect` 4.1.x, optional `foldkit`. Repo pins `alchemy` / `@alchemy.run/cloudflare` 2.0.0-beta.84 and effect 4.1.1.
- Model is event-sourced (decide/evolve aggregates, envelopes, catch-up, backfill). Platforms in source: `InMemory` (packages/domain/src/InMemory.ts) and Cloudflare Durable Objects (packages/cloudflare/src/Domain). No SQL/Postgres platform found.
- Domain packages today: agents, architecture-lab, documents, epistemic, law-practice (34k LOC), ontology, party (domain only), shared, workspace.
- 115 TS files import `@beep/shared-domain` (entity kit or barrel).
- Related packets: `explorations/domain-layer-hardening` (parked, mirrors paused `goals/domain-kernel-hardening`), `explorations/pulumi-to-alchemy` (align).

## 2026-11-03 (operator screenshot, 01:38)

Sam Goodwin on X (@samgoodwin89, status 2117367781444444417): "Alchemy Domain now supports event replay for when you deploy a new View/Projection or update a View and need to re-compute. Implemented as a fan-out workflow, supporting millions of Durable Objects orchestrated by `alchemy deploy`." Diagram: "Deploys roll out every change to a model" — backfill run → 6 relay levels (fan-out of six per Cloudflare Worker invocation) → instances → view keys. Relevance: Backfill/replay is Cloudflare-shaped upstream (packages/domain/src/Backfill.ts, 2230 lines); the Postgres platform (D1) needs its own replay path, likely a plain SQL scan rather than a fan-out tree.

Operator asked for a /teach lesson on "full replica sync" vs offline intents before re-answering round-2 Q3 (local-first). Teaching workspace: ~/YeeBois/teach/local-first-sync/.
