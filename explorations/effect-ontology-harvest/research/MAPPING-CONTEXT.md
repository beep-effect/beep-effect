# Mapping Context — shared brief for inventory agents

Every effect-ontology-harvest inventory agent receives this brief verbatim.
It defines the routing vocabulary, the beep substrate to compare against, the
north-star goals, and the required per-item schema. Do not improvise routing
categories: use the table below.

## Task frame

- **Target root:** the checkout containing this packet, resolved with
  `git rev-parse --show-toplevel`. Resolve all target output paths from this
  root. You may READ anywhere in it, but WRITE only your assigned
  `explorations/effect-ontology-harvest/research/<area>.md`. Stage that area's
  source rows in its final `## Sources (to merge)` table; do not write
  `explorations/effect-ontology-harvest/research/SOURCES.md` concurrently.
- **Source root (read-only):** a checkout of `mepuka/effect-ontology` at the
  pinned revision recorded in [`SOURCES.md`](./SOURCES.md). Focus
  `packages/@core-v2/src` (plus `docs/` for the docs agent). MIT license —
  port-with-attribution. Resolve every mined-source `path:line` citation from
  this root; never record a machine-local absolute path.
- **Ledger coordinator:** after every inventory agent finishes, one coordinator
  serially merges and deduplicates all staged source rows into `SOURCES.md` §1,
  then replaces each staged table with a `## Sources appended` confirmation.
- **Intent:** harvest inventory, NOT a port plan. Each item = one valuable
  piece (model, capability, service, pattern, design idea) mapped to where it
  would live in beep, or to the existing beep package it should improve.
- **Honesty rules:** every claim about either repo carries a resolvable
  `path:line` cite. If beep already covers something, say so and compare the
  designs — do not inflate novelty. If you cannot find beep coverage, write
  `NOT FOUND` (a later verify gate checks these). Do not fabricate URLs.

## beep routing table (where things live)

| Home | What belongs there | Notes |
|------|--------------------|-------|
| `foundation/primitive/*` | dependency-free primitives (`@beep/data`, `@beep/types`) | rare target |
| `foundation/modeling/*` | domain-agnostic pure models/schemas — `@beep/schema`, `@beep/identity`, `@beep/rdf`, `@beep/ontology`, `@beep/provenance`, `@beep/nlp`, … | pure shapes, no live services |
| `foundation/capability/*` | domain-agnostic reusable behavior — `@beep/semantic-web`, `@beep/mcp-kit`, `@beep/langextract`, `@beep/observability`, … | service contracts + implementations |
| `drivers/<name>` (flat) | wrappers around external engines/SDKs/services — `oxigraph`, `shacl`, `n3`, `anthropic`, `openai-compat`, `xai`, `venice-ai`, `drizzle`, `postgres`, `pglite`, `tika`, … | one external boundary per package |
| product slices `packages/<slice>/{domain,use-cases,server,client,ui,config,tables}` | product behavior/language — slices: `ontology`, `agents`, `epistemic`, `documents`, `law-practice`, `workspace` | live Layer composition stays in `server`/`client`/app runtime, never `use-cases` |
| `shared/*` | deliberate cross-slice product language ONLY | high bar: ≥2 named consumers + README promotion record; never generic substrate |
| app runtime | `apps/*` entrypoints / `src/runtime/Layer.ts` | final Layer wiring |

Route "common/core/utils"-flavored items specific-home-first: if a more
specific home exists (driver, slice, existing foundation pkg), it wins over a
new generic package. Proposing a NET-NEW foundation package is allowed but
must be flagged `NET-NEW` with a one-line justification of why no existing
home fits.

## Existing beep substrate to compare against (read before claiming a gap)

- `@beep/schema` — `packages/foundation/modeling/schema` — canonical schema
  substrate (namespace-first concept modules, `LiteralKit`).
- `@beep/rdf` — `packages/foundation/modeling/rdf` — IRIs, RDF/JS terms,
  datasets, JSON-LD value shapes, vocab constants. Compare vs `Domain/Rdf/*`.
- `@beep/ontology` — `packages/foundation/modeling/ontology` — ontology
  modeling foundation. Compare vs `Domain/Model/Ontology.ts`.
- `@beep/identity` — `packages/foundation/modeling/identity` —
  `IdentityComposer`, branded ids. Compare vs `Domain/Identity.ts`.
- `@beep/semantic-web` — `packages/foundation/capability/semantic-web` —
  JSON-LD, SHACL/SPARQL service contracts, PROV-O, evidence anchors.
- `@beep/provenance` — `packages/foundation/modeling/provenance` — TextAnchor
  char-offset anchors, claim provenance.
- `@beep/mcp-kit` — `packages/foundation/capability/mcp-kit` — MCP host kit on
  `effect/unstable/ai` Tool/Toolkit/McpServer.
- Ontology slice agent surface + stateless fingerprint-CAS + budgets —
  `packages/ontology/use-cases/src/tools/{OntologyToolkit,OntologyToolService}.ts`,
  `packages/ontology/server/src/tools/OntologyToolHandlers.ts`. Compare vs
  `Utils/Hash.ts`, `Utils/IdempotencyKey.ts`, budget/session machinery.
- `epistemic` slice — `packages/epistemic/*` — claim/evidence/activity
  lifecycle (`ClaimGate`/`ClaimLifecycle`/`ClaimProjection`).
- LLM provider drivers — `packages/drivers/{anthropic,openai-compat,xai,venice-ai,ai-provider-cli}`.
- RDF drivers — `packages/drivers/{oxigraph,shacl,n3,rdf-canonize}`.
- Persistence — `packages/drivers/{drizzle,postgres,pglite}`,
  `packages/_internal/db-admin` (internal migration aggregation),
  `packages/shared/tables`.
- Known TRUE gaps going in (verify anyway): no generic foundation cache/CAS
  capability, no LLM-governance capability (rate limit/budget/circuit breaker
  as reusable substrate), no durable-workflow substrate (slice `use-cases`
  carry `.workflows.ts`/`.processes.ts` role files; no engine).

## North-star goals (primary scoring axis)

Score each item's relevance to these first; standalone value second.

| Goal | State | One-liner |
|------|-------|-----------|
| `goals/ontology-agent-surface` | active 1/4 | curated ontology MCP toolkit on the professional-desktop sidecar; stateless fingerprint-CAS sessions + budgets (P1 landed) |
| `goals/semantic-foundation` | active 0/6 | repo-owned SKOS concept schemes under `https://ns.beep.sh/`, FOLIO alignments, consumed by intake/filing/classification/docketing/party-role workflows |
| `goals/agentic-professional-runtime` | active 3/5 | local-first agentic professional runtime; every durable assertion carries evidence, provenance, lifecycle, and cost |
| `goals/unified-ai-toolchain` | paused 2/12 | schema + sync layer for repo-facing AI coding-agent configuration (`@beep/ai-sync`) |
| `goals/ip-law-knowledge-graph` | paused 0/5 | IP-law knowledge graph (ontology survey superseded by semantic-foundation; storage deferred) |
| `goals/trustgraph-port` | paused | selective TrustGraph kernel complementing repo-memory architecture |

## Required per-item schema

One `###` section per item in your `research/<area>.md`:

```markdown
### <item name>
- **Source:** `<path:line>` (effect-ontology)
- **What:** <1-3 sentences>
- **Category:** model | capability | service | pattern | design-idea
- **Proposed beep home:** <existing pkg path> | NET-NEW `foundation/<kind>/<name>` | `drivers/<name>` | `<slice>/<role>` | design-reference → <existing pkg>
- **beep overlap & design delta:** <existing beep cite + what theirs does better/worse> | NOT FOUND
- **Goal linkage:** <goal slugs + why> | none
- **v3→v4 notes:** <migration hazards: Effect.Service→v4 service pattern, @effect/ai→effect/unstable/ai, Schema API drift, platform deps>
- **Effort:** S | M | L
- **Verdict hint:** port-now | adapt-improve | design-reference | skip (advisory — final verdict happens in evaluation)
```

End the inventory file with a `## Sources (to merge)` table containing its
`eo-<area>-NN` rows. The ledger coordinator alone merges those rows into
SOURCES.md §1 and replaces that table with a `## Sources appended`
confirmation.

## beep repo laws that shape v3→v4 notes

Target is Effect **v4** with repo conventions: `S.Class` everywhere (schema
classes over interfaces), `S.OptionFromOptionalKey` for optional fields,
per-field `annotateKey`, `LiteralKit` over `S.Union` of literals, `Effect.fn`
/ `Effect.fnUntraced` for functions, `Effect.catch` (not `catchAll`), never
`node:http`, never `decodeUnknownSync` in product code, namespace-first
effect helper-module imports, match helpers over conditional chains, services
via `Context.Service` + explicit Layer composition (no God Layers), typed
errors as tagged classes at the right boundary (public action vs server-only
port vs driver-internal). Anything ported gets redesigned to these laws — the
v3→v4 note should flag where that redesign is nontrivial.
