# USPTO MCP — Sources & Provenance

Inherited 2026-07-01 at graduation from
[`explorations/mcp-auth-gated-registration`](../../../explorations/mcp-auth-gated-registration/README.md),
scoped to the USPTO proving-host slice.

- **Source exploration:** `explorations/mcp-auth-gated-registration` — primary
  ledger:
  [`explorations/mcp-auth-gated-registration/research/SOURCES.md`](../../../explorations/mcp-auth-gated-registration/research/SOURCES.md)
  (full corpus; this file reproduces only the entries this host implements
  against).
- **Kit contract:** [`goals/mcp-kit/SPEC.md`](../../mcp-kit/SPEC.md) and its
  ledger [`goals/mcp-kit/research/SOURCES.md`](../../mcp-kit/research/SOURCES.md)
  — this host is a consumer of the kit, not an independent implementation of
  the same patterns.

## 1. Mined source corpus (this host's implementation view)

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `uspto_pfw_mcp#4` | Named field tiers minimal/balanced/complete (`documentBag` 100x warning) | uspto_pfw_mcp | `field_configs.yaml:12-42` | field tiers | port-with-attribution (MIT) — consumed via `@beep/mcp-kit`'s `FieldTier`, not reimplemented here |
| `mcp-uspto#2` | `keyMissingResponse` — `api_key_required` as structured content | mcp-uspto | `src/lib/config.ts:32-50` | envelope | port-with-attribution (MIT) — consumed via `@beep/mcp-kit`'s `ApiKeyRequired`, not reimplemented here |

**How these inform this host:** both patterns are already built into
`@beep/mcp-kit` (kit deliverables #3 and #5); this goal's implementation work
is wiring/composition, not re-porting the upstream shapes.

## 2. Upstream repositories & licenses

See `goals/mcp-kit/research/SOURCES.md` §2 for the full license ledger — this
host does not port any upstream source directly; it composes the kit's
already-ported deliverables.

## 3. External research sources

- MCP spec, server/tools `2025-06-18` —
  <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- USPTO Open Data Portal (ODP) API documentation (credential signup surface
  for the `SourceAuth` entry's `signupUrl`).

## 4. In-repo capability references

| Capability | Path | Role |
|------------|------|------|
| `@beep/uspto` driver | `packages/drivers/uspto/src/Uspto.service.ts` | **reuse** — the driver this host wires through the kit |
| Optional-secret idiom | `packages/drivers/uspto/src/Uspto.service.ts:398` | **reuse** — `SourceAuth` entry's credential resolution |
| Same-origin key scoping | `packages/drivers/uspto/src/Uspto.service.ts:249-255` | **reuse** — confirms `soft`-gate call-time-degradation shape |
| `documentBag`/`patentFileWrapperDataBag` shapes | `packages/drivers/uspto/src/Uspto.service.ts:116` | **target shape** for the `FieldTier` projector fixture |
| `nlp-mcp` `Layer.mergeAll` seam | `packages/drivers/nlp-mcp/src/Server.ts:101-107` | **mirror** — stdio server bootstrap shape |
| `nlp-mcp` server test precedent | `packages/drivers/nlp-mcp/test/Server.test.ts` | **mirror** — toolkit-surface test shape |
| `uspto` fixture-mocked `HttpClient` test precedent | `packages/drivers/uspto/test/Uspto.service.test.ts` | **mirror** — no-real-credential test shape |
| `@beep/mcp-kit` `SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/`FieldTier` | `packages/foundation/capability/mcp-kit/src/*.ts` | **consume** — this host's only dependency for kit-pattern logic |

## 5. Cross-links & provenance

- Exploration manifest ↔ this goal: `links.goals` ↔ `provenance.exploration`
  (wired 2026-07-01).
- Sibling goal: [`mcp-host-retrofit`](../../mcp-host-retrofit/README.md) —
  jointly discharges `@beep/mcp-kit`'s `≥2-consumer` gate.
- Depends on: [`mcp-kit`](../../mcp-kit/README.md) (`complete`, PR #288).
- Decision rationale:
  [`DECISIONS.md`](../../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q2, Q5, Q6).
