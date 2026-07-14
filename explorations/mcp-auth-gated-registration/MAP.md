# Map

<!--
Stage 4. Decomposed 2026-07-01 from BRIEF.md + the resolved DECISIONS.
Capability citations verified by Codex sub-agents against current HEAD
(reviews/2026-07-01-codex-verification.md).
-->

## Candidate Goal Packets

**Lifecycle annotation (2026-07-14):** `mcp-kit`, `uspto-mcp`, and
`mcp-host-retrofit` are completed-retained. `mcp-write-wall` remains held for
a named genuinely write-capable host. The shipped USPTO ODP host's `soft` gate
is read-only and therefore does **not** clear the write-wall gate.

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `mcp-kit` | Build `@beep/mcp-kit` (`packages/foundation/capability/mcp-kit`): credential-keyed `Toolkit` composition (`Config.option`-gated, folded `Layer.merge`), `api_key_required` envelope, `SourceAuth` gate registry (schemas inline), progressive field-tier projector + columnar reshaper, sanitized-span wrapper, four-hint annotation helper, `tools/call` tier-gate dispatch wrapper (`ClaimGate`-shaped, refusal-as-value), `EnabledWhen` list-filter helper. | none | NET-NEW on `effect/unstable/ai` `{Tool,Toolkit,McpServer}` (beta.92); reuse `@beep/schema` `$I` identity composer (`packages/foundation/modeling/identity/src/Id.ts`), `ClaimGate` pattern (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:42-47`), `UsageRecord.metadata` jsonb (`packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:95-97`) |
| `uspto-mcp` | Minimal `*-mcp` host wiring `@beep/uspto` through the kit; proves credential-gating, `api_key_required`, and field tiers against real ODP data + the 25k `documentBag` ceiling. Seeds the future dedicated gov-legal MCP host. | `mcp-kit` | `@beep/uspto` Shape-C key-optional (`Uspto.service.ts:249-255,398`); `nlp-mcp` `Layer.mergeAll` seam (`packages/drivers/nlp-mcp/src/Server.ts:101-107`) |
| `mcp-host-retrofit` | Adopt the kit's sanitized-span wrapper + four-hint annotation helper in `@beep/nlp-mcp` and `@beep/m365-mcp`; fixes the live span leak (`Toolkit.ts:263-265` vs `12-observability.md` §3) and the hint asymmetry; satisfies the `foundation/capability` ≥2-consumer gate. | `mcp-kit` | `@beep/nlp-mcp`, `@beep/m365-mcp`, `@beep/nlp-processing` `Tools/` |
| `mcp-write-wall` (follow-on) | Prove the tier-gate / candidate→approved wall against a real write-capable host, with `UsageRecord.metadata` audit end-to-end. | `mcp-kit` + a write-capable host | `ClaimGate` (`@beep/epistemic-use-cases`); kit dispatch wrapper |

## Sequencing

`mcp-kit` first — it is the shared substrate. `uspto-mcp` and
`mcp-host-retrofit` land together as the first proving slice: they jointly
satisfy the ≥2-consumer gate (Q4b), so the kit README's consumer list is only
honest once both are in. `mcp-write-wall` is deferred until a write-capable
host exists — the USPTO host is read-only, so goal-1 proves the tier-gate by
fixture only (deliberate, recorded in Q7).

## First Vertical Slice

`mcp-kit` + `uspto-mcp` + `mcp-host-retrofit`, provable end-to-end:

1. The USPTO search tool **degrades** with an `api_key_required` content
   result when `USPTO_API_KEY` is absent, and **works** when present.
2. A `>25,000`-token `documentBag` response is **reshaped under the ceiling**
   via a named field tier (minimal/balanced).
3. `nlp-mcp` raw `text` **no longer reaches span attributes** (proof test).
4. **≥2 real packages import `@beep/mcp-kit`**, named in its README (gate
   satisfied).

These four bullets become the graduated goals' executable acceptance tests.

## Open Risks Inherited From The Brief

- `effect/unstable/ai` beta churn — pin beta.92; re-verify
  `McpServer.ts:717-728` / `Toolkit.ts:263-265,364-366` / `McpServer.ts:336-341`
  at implementation time.
- CourtListener auth contradiction — locked `soft`; do not hard-code either
  reading.
- USPTO ODP `fields` projection semantics unverified — decide API-side vs
  client-side tier projection after verification.
- `check-api-status` probe underspecified — per-source probe matrix required
  before it ships.
- MCP `2025-11-25` not spoken by the bundled server — any reliance gates on an
  effect upgrade + reverification task.
- License discipline — clean-room for AGPL/NOASSERTION/unresolved upstreams;
  reimplement-to-idiom for MIT (ledger: `research/SOURCES.md`).
