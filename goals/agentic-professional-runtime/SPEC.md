# Agentic Professional Runtime Specification

## Status

**ACTIVE**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-05-01
- **Updated:** 2026-06-11

## Mission

Define the first real product slice direction for beep-effect after the
architecture reset: a native-first, local-first agentic professional-services
runtime proven through an IP solo-practice product and a wealth-management
advisor product.

The runtime is the durable product spine. Law and wealth are vertical proofs,
not two separate platforms.

## Non-Negotiable Contract

- The runtime is organized around professional workspaces, not generic chat.
- Tenancy is organization-first. A solo practice is a one-person organization.
- The first end-to-end proof is the runtime data loop. The v1 trace starts with
  normalized incoming email fixtures:
  1. onboard organization, user, and workspace;
  2. ingest one synthetic email artifact with stable source spans;
  3. run a deterministic fixture agent;
  4. produce candidate claims, tasks, and one client-facing draft;
  5. create a strict human approval gate;
  6. expose bounded context through the internal SDK.
- Later proof loops may add calendar, document, assistant-thread, and connector
  execution paths after the email loop is stable.
- The canonical v1 scenario pair is:
  1. Law patent intake before a public-demo deadline.
  2. Wealth cash request before a payment deadline.
- Product fixture IDs are readable and stable. Evidence uses stable source span
  IDs, not whole-artifact-only citations or byte offsets.
- The v1 proof produces candidate records only:
  1. candidate claims;
  2. candidate tasks;
  3. candidate draft artifacts;
  4. attach evidence and provenance;
  5. pending approval gates;
  6. evidence-bounded context packets.
- Claim plus evidence plus provenance plus lifecycle is the authoritative record
  of what was asserted, evidenced, and decided — not of whether the underlying
  proposition is true. Search, graph views, retrieval packets, summaries, and
  MCP outputs are projections.
- The internal Effect/TypeScript SDK is the canonical integration contract.
  MCP, Claude Desktop, OpenClaw, and other clients wrap or consume that contract.
- Agents may read runtime context and propose candidate writes. Human or policy
  acceptance records a scoped disposition that makes candidate records eligible
  for scoped runtime use; it does not make their propositions true.
- Existing professional systems stay systems of record for their own data. This
  runtime connects to them and records its own claims, tasks, artifacts,
  approvals, activities, and usage.
- Product examples use synthetic fixtures in the repo. Real legal, financial,
  client, or private firm data stays outside the repository.

## Product Proofs

### Status Amendment (2026-06-11)

Law is the sole active product vertical. The wealth-management vertical is
demoted to a dormant proof fixture: its paired P3 fixture stays in-repo so the
runtime-spine proof keeps exercising two domain languages, but no
wealth-specific product work is planned. Roadmap and vision surfaces treat the
law practice as the only live vertical. The capability-lane vision map lives in
`docs/vision-map.html`.

### Agentic Solo Practice Law Firm

The law product optimizes for an IP attorney leaving a long-term firm to run a
solo practice. It must support the boring operational surface of a practice and
the high-leverage IP work:

- clients, contacts, matters, deadlines, and docket context
- patent, trademark, copyright, contract, and licensing work
- email, calendar, document, and thread memory
- drafting, review, research, and client communication assistance
- autonomous administrative support where safe
- professional approval for legal advice, filings, and client-facing judgment

### Todox.ai Wealth Management Runtime

The wealth product optimizes for advisor and team work inside a firm such as
AdvicePeriod or Mariner:

- households, clients, accounts, holdings, goals, meetings, and engagements
- meeting prep, email drafting, task extraction, research digesting, and
  compliance review
- advisor-specific skills and team/org-level shared capability promotion
- evidence-backed memory with bitemporal lifecycle
- usage, model, tool, and cost attribution
- local-first deployment that can later grow toward org sync

## Runtime Data Loop Proof

The active P2 proof lives in:

- `docs/runtime-data-loop.md`
- `docs/runtime-fixture-catalog.md`
- `docs/sdk-context-packet-contract.md`
- `docs/approval-and-autonomy-policy.md`
- `docs/runtime-proof-slice-map.md`
- `docs/p3-slice-implementation.md`
- `fixtures/runtime-data-loop`

The proof is intentionally deterministic. It uses synthetic fixture inputs and
expected snapshots so implementation can later prove schema, package, and SDK
contracts without depending on model nondeterminism.

The terminal output of each scenario is:

- candidate claims with evidence spans
- candidate project/task work
- one client-facing email draft
- one pending approval gate
- one SDK context packet

The Law scenario seeds an existing legal client, contact, matter, and patent
asset. The Wealth scenario seeds an existing household, client, party, and
account reference. Entity resolution from arbitrary email is deferred.

## Executable P3 Proof

The first executable package proof lives in:

- `packages/shared/domain`
- `packages/workspace/domain`
- `packages/epistemic/domain`
- `packages/agents/domain`
- `packages/agents/use-cases`
- `packages/law-practice/domain`
- `packages/agents/use-cases/test/ProfessionalRuntime.test.ts`

The proof keeps shared-kernel and slice domains schema-first, maps readable
fixture keys to repo-native entity IDs at the proof boundary, exposes SDK
candidate output and context-packet contracts from
`@beep/agents-use-cases/public`, and runs the paired fixtures through
`@beep/agents-use-cases/test`.

The package-local proof test composes both fixture scenarios without requiring
a dormant wealth package. Slice packages still do not import from other
product slices directly.

## Initial Slice Topology

The initial named slice map is:

| Slice | Owns |
|---|---|
| `tenancy` | future lifecycle authority for organization onboarding, user invitation, membership changes, roles, and policy scope |
| `workspace` | workspaces, threads, messages, artifacts, projects, tasks, approvals |
| `agents` | agents, skills, commands, connectors, model/provider bindings |
| `epistemic` | claims, evidence, subjects, provenance activities, lifecycle, usage records |
| `law-practice` | law-specific clients, matters, IP assets, filings, contracts, docket overlays |
| `wealth-management` | wealth-specific parties, households, accounts, holdings, goals, meetings |

`shared/domain` owns the canonical organization, user, membership, and actor
provenance language needed across the product proofs. Each real slice must
follow `standards/ARCHITECTURE.md`: domain, use-cases, config, server, client,
tables, and UI appear only when each role is needed. Direct slice-to-slice
imports are forbidden. Shared contracts are promoted through `shared/*` only
when both product proofs intentionally accept the coupling.

## Runtime Boundaries

### Shared Kernel

`shared/*` holds deliberate cross-slice product language, not live runtime
orchestration. Good shared-kernel candidates include organization identity,
principal references, source-kind vocabulary, base entity metadata, and
candidate/accepted lifecycle concepts used by both product proofs.

### Foundation

Domain-agnostic substrate such as schema helpers, identity composers, generic
observability helpers, and UI primitives belongs in `foundation/*`, not in
`shared/*`.

### Drivers

External infrastructure wrappers such as Drizzle, Postgres-compatible storage,
filesystem access, email/calendar APIs, local keychains, and native platform
capabilities belong in `drivers/*` or app/native adapters. Product language must
not leak into drivers.

### Native App

The product target is a native desktop app. Archived Tauri/editor apps on
`archive/pre-repo-architecture-automation-2026-04-27` are capability references
for the sidecar, editor shell, and native packaging patterns. They are not
active topology and should not be restored wholesale.

## Data Authority

The storage model is:

- versioned or immutable entity rows for current runtime-accepted state
- append-only `Activity` and provenance records for why and how that state
  changed
- evidence records that preserve source spans and source artifacts
- rebuildable read models for graph, search, timeline, inbox, compliance, and
  work queues

Data model documents stay storage-neutral. The likely first local adapter is a
Postgres-compatible Drizzle path such as PGlite, but domain language must not
depend on that decision.

## Autonomy Boundary

Administrative automation may become autonomous first: scheduling, reminders,
inbox triage, follow-up drafts, document organization, and internal task
creation.

Professional judgment remains approval-gated: legal advice, financial advice,
filings, recommendations, portfolio actions, binding client communications, and
records that carry compliance weight.

## Source-Of-Truth Order

When sources disagree, use this order:

1. this `SPEC.md`
2. `standards/ARCHITECTURE.md`
3. `standards/architecture/*`
4. `ops/manifest.json`
5. `PLAN.md`
6. docs in `docs/`
7. `history/sources.md`
8. referenced Notion pages and archived branch files
9. older initiative packets referenced by this initiative

## Out Of Scope

- restoring deleted pre-automation apps/packages as active topology
- replacing CRM, billing, accounting, email, calendar, custodian, or document
  systems of record
- realtime phone answering in the first proof
- multi-machine sync in the first proof
- autonomous legal or financial advice
- production compliance certification claims
- full generator-ready file scaffolding for every slice

## Acceptance Criteria

This packet is implementation-ready when a future engineer can answer, without
new architecture decisions:

- what runtime capability is being proven first
- which slice owns each initial concept family
- which data is authoritative versus projected
- how agents can read and write candidate work
- where shared-kernel promotion is allowed
- what is product-specific to law and wealth
- what is explicitly deferred
