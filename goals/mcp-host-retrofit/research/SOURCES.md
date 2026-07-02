# MCP Host Retrofit — Sources & Provenance

Inherited 2026-07-01 at graduation from
[`explorations/mcp-auth-gated-registration`](../../../explorations/mcp-auth-gated-registration/README.md),
scoped to the `nlp-mcp`/`m365-mcp` retrofit slice.

- **Source exploration:** `explorations/mcp-auth-gated-registration` — primary
  ledger:
  [`explorations/mcp-auth-gated-registration/research/SOURCES.md`](../../../explorations/mcp-auth-gated-registration/research/SOURCES.md)
  (full corpus; this file reproduces only the entries this retrofit
  implements against).
- **Kit contract:** [`goals/mcp-kit/SPEC.md`](../../mcp-kit/SPEC.md) and its
  ledger [`goals/mcp-kit/research/SOURCES.md`](../../mcp-kit/research/SOURCES.md)
  — this goal is a consumer of the kit's already-built `SanitizedSpan` and
  `ToolAnnotations` helpers, not an independent implementation of the same
  patterns.
- **P0 verification evidence:**
  [`goals/mcp-kit/history/2026-07-01-p0-verification.md`](../../mcp-kit/history/2026-07-01-p0-verification.md)
  claim (c) — `Toolkit.ts:263-265` raw-`parameters` span annotation confirmed
  against resolved `effect@4.0.0-beta.92`.

## 1. Mined source corpus (this goal's implementation view)

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `patent-search-mcp-server#5` | Four annotation hints + dual content/structuredContent | patent-search-mcp-server | `src/tools/claimChart.ts:39-45` | annotations | port-with-attribution (MIT) — consumed via `@beep/mcp-kit`'s `ToolAnnotations`, not reimplemented here |

**How this informs the retrofit:** the four-hint pattern is already built
into `@beep/mcp-kit` (kit deliverable #7); this goal's work is
adoption/migration in two existing hosts, not re-porting the upstream shape.

## 2. Upstream repositories & licenses

See `goals/mcp-kit/research/SOURCES.md` §2 for the full license ledger — this
goal does not port any upstream source directly; it migrates two existing
hosts onto the kit's already-ported deliverables.

## 3. External research sources

- MCP tool-annotations design blog ("annotations are untrusted hints") —
  <https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/>
- MCP spec, server/tools `2025-06-18` —
  <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>

## 4. In-repo capability references

| Capability | Path | Role |
|------------|------|------|
| `NlpToolkit` | `packages/foundation/capability/nlp-processing/src/Tools/NlpToolkit.ts` | **audit at P0** — confirm four-hint annotation status |
| `StreamingToolkit` | `packages/drivers/nlp-mcp/src/StreamingTools.ts` | **retrofit target** — zero four-hint annotations today |
| `nlp-mcp` server wiring | `packages/drivers/nlp-mcp/src/Server.ts:101-107` | **retrofit target** — `Layer.mergeAll` seam, span-wrapper insertion point |
| `m365-mcp` tool annotations | `packages/drivers/m365-mcp/src/M365Tools.ts:100-103` (and repeated per tool) | **retrofit target** — inline `.annotate(...)` chains to migrate to the kit helper |
| Raw-`parameters` span leak | `node_modules/effect/src/unstable/ai/Toolkit.ts:263-265` | **doctrine violation this goal fixes** (`12-observability.md` §3) |
| `@beep/mcp-kit` `SanitizedSpan`/`ToolAnnotations`/`TierGate` | `packages/foundation/capability/mcp-kit/src/*.ts` | **consume** — this goal's only dependency for kit-pattern logic |

## 5. Cross-links & provenance

- Exploration manifest ↔ this goal: `links.goals` ↔ `provenance.exploration`
  (wired 2026-07-01).
- Sibling goal: [`uspto-mcp`](../../uspto-mcp/README.md) — jointly discharges
  `@beep/mcp-kit`'s `≥2-consumer` gate.
- Depends on: [`mcp-kit`](../../mcp-kit/README.md) (`complete`, PR #288).
- Deferred follow-on: `mcp-write-wall` (not created — named in
  [`MAP.md`](../../../explorations/mcp-auth-gated-registration/MAP.md), proves
  the tier-gate wrapper against a real write-capable host).
- Decision rationale:
  [`DECISIONS.md`](../../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q4b, Q7).
