# MCP Write Wall — Sources & Provenance

Inherited 2026-07-02 at graduation from
[`explorations/mcp-auth-gated-registration`](../../../explorations/mcp-auth-gated-registration/README.md),
scoped to the write-capable tier-gate proving slice.

- **Source exploration:** `explorations/mcp-auth-gated-registration` —
  primary ledger:
  [`explorations/mcp-auth-gated-registration/research/SOURCES.md`](../../../explorations/mcp-auth-gated-registration/research/SOURCES.md)
  (full corpus; this file reproduces only the entries this goal implements
  against).
- **Kit contract:** [`goals/mcp-kit/SPEC.md`](../../mcp-kit/SPEC.md) and its
  ledger [`goals/mcp-kit/research/SOURCES.md`](../../mcp-kit/research/SOURCES.md)
  — this goal wires the kit's already-shipped `TierGate` primitive; it does
  not re-implement tier-gate logic.
- **Prior grounding pass:** `goals/mcp-host-retrofit/PLAN.md`'s P0 row
  identified `NlpToolkit`'s four stateful tools and `TierGate`'s fail-closed
  default; this goal's own P0 must re-verify those facts, not re-derive them
  from scratch.

## 1. Mined source corpus (this goal's implementation view)

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `mike#7` | Confirmation gate + untrusted-context wrap + audit log | mike | `backend/src/lib/mcp/servers.ts:482-490` | tier gate / untrusted-context suffix | clean-room (AGPL-3.0-only) — the confirmation-gate and audit-log shapes are already built into `@beep/mcp-kit`'s `TierGate` (consumed, not reimplemented); the untrusted-context description-suffix idea (Deliverable #5, optional) would be a fresh clean-room implementation from the pattern description only, never copied source |
| `mike#2` | Metadata→find→read progressive ladder | mike | `backend/src/lib/legalSourcesTools/courtlistenerTools.ts:96-152` | tool-governance precedent | clean-room (AGPL-3.0-only) — reference only; not ported |

**How these inform this goal:** the tier-gate enforcement shape (`mike#7`) is
already built into `@beep/mcp-kit`'s `TierGate`/`dispatchWithTierGate`
(kit deliverables, see `goals/mcp-kit/SPEC.md`); this goal's implementation
work is wiring/composition plus per-tool annotation judgment, not re-porting
the upstream shape. The optional untrusted-context suffix (Deliverable #5)
is the one piece of `mike#7` not yet built anywhere in the kit or a
consumer — if attempted, it must be a clean-room implementation from the
documented pattern (`explorations/mcp-auth-gated-registration/research/tier-gating-and-tool-governance-ethical-wall.md`),
never copied from the AGPL source.

## 2. Upstream repositories & licenses

See `goals/mcp-kit/research/SOURCES.md` §2 for the full license ledger. This
goal does not port any upstream source directly; it composes the kit's
already-shipped `TierGate` deliverable and, if Deliverable #5 is attempted,
clean-room-implements the `mike#7` untrusted-context pattern from
description only (AGPL — no source copying).

## 3. External research sources

- MCP spec, server/tools `2025-06-18` (tool annotations are untrusted UX
  hints, not the security boundary) —
  <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- MCP tool-annotations design blog (`readOnlyHint`/`destructiveHint`
  semantics; "a server can claim `readOnlyHint: true` and delete your files
  anyway") — <https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/>
- `explorations/mcp-auth-gated-registration/research/tier-gating-and-tool-governance-ethical-wall.md`
  — the untrusted-context description-suffix research note (Deliverable #5
  source).

## 4. In-repo capability references

| Capability | Path | Role |
|------------|------|------|
| `TierGate`/`dispatchWithTierGate`/`fromApprovedToolsPolicy` | `packages/foundation/capability/mcp-kit/src/TierGate.ts` | **consume** — this goal's core dependency; zero consumers today (confirmed via repo-wide grep) |
| `sanitizedToolkit`/`registerSanitizedToolkit` | `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:170-278` | **reuse/extend** — the proven per-tool dispatch-interception seam (`built.handle(...)` at `:206-223`) this goal must compose `TierGate` into |
| `annotateFourHints`/`readOnlyToolHints` | `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:76-107` | **reuse** — mechanical annotation of `NlpToolkit`'s non-stateful tools |
| `NlpToolkit`'s four stateful tools | `packages/foundation/capability/nlp-processing/src/Tools/{CreateCorpus,LearnCorpus,DeleteCorpus,LearnCustomEntities}.ts` | **target** — judgment-graded annotation site |
| `NlpToolkit` assembly | `packages/foundation/capability/nlp-processing/src/NlpToolkit.ts:89-115` | **target** — full 25-tool inventory; confirm at P0 whether mechanical annotations land per-tool-file or here |
| `nlp-mcp` dispatch composition | `packages/drivers/nlp-mcp/src/Server.ts:102-108` | **target** — where the tier-gated toolkit(s) must mount |
| `nlp-mcp` fixture-test precedent | `packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts` | **mirror** — real-layer fixture dispatch test shape (no toolkit mocking) |
| `UsageRecord.metadata` | `packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:69,95-97` | **deferred** — Q7's original audit-persistence target; not wired this slice (see `SPEC.md` Exception Ledger) |

## 5. Cross-links & provenance

- Exploration manifest ↔ this goal: `links.goals` ↔ `provenance.exploration`
  (wired 2026-07-02).
- Sibling goals: [`mcp-kit`](../../mcp-kit/README.md) (`complete`, PR #288),
  [`uspto-mcp`](../../uspto-mcp/README.md) (`completed-retained`),
  [`mcp-host-retrofit`](../../mcp-host-retrofit/README.md)
  (`completed-retained` — its P0 finding is this goal's starting point).
- Decision rationale:
  [`DECISIONS.md`](../../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  Q7 (write-tool wall enforcement + audit sink); this goal's `SPEC.md`
  records the audit-sink deviation (log-only, not `UsageRecord.metadata`)
  as a new, explicit exception with a back-link to Q7.
- Sequencing: [`MAP.md`](../../../explorations/mcp-auth-gated-registration/MAP.md)
  names this as the `mcp-write-wall` follow-on, deferred until a
  write-capable host existed — `nlp-mcp` is that host.
