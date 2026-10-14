# Review Verdict Envelope — Sources & Provenance

- **Source exploration:** `explorations/attorney-review-workspace` — primary ledger:
  [`explorations/attorney-review-workspace/research/SOURCES.md`](../../../explorations/attorney-review-workspace/research/SOURCES.md).
  The research itself (six facets with skeptics, synthesis, verdicts) stays there and is not
  copied here:
  [`SYNTHESIS-2026-10-14.md`](../../../explorations/attorney-review-workspace/research/SYNTHESIS-2026-10-14.md),
  [`FACET-VERDICTS-2026-10-14.md`](../../../explorations/attorney-review-workspace/research/FACET-VERDICTS-2026-10-14.md).

This file lists only what this goal's implementation and spikes need.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| Synthesis §5 spike table | Spikes S1–S7 with pass criteria | in-repo exploration | `explorations/attorney-review-workspace/research/SYNTHESIS-2026-10-14.md` (spike table, S1–S7 rows) | P0 spike definitions | Use as the P0 checklist; S8 and the Word check come from `DECISIONS.md` (source-rendering, draft-text-surface) |
| Brief solution sketch | Schema, service and projector shape | in-repo exploration | `explorations/attorney-review-workspace/BRIEF.md` (Solution Sketch) | P1/P2 shape | Seeds SPEC Objective |
| MAP first vertical slice | One `claim-finding` fixture end to end | in-repo exploration | `explorations/attorney-review-workspace/MAP.md` (First Vertical Slice) | S5 test script | Seeds the S5 acceptance criterion |
| Amendment | Review-queue phase + D9 widening for `practice-claude-mod` | in-repo exploration | `explorations/attorney-review-workspace/research/AMENDMENT-practice-claude-mod.md` (written in parallel) | P3 handoff | Linked, delivered as-is or as the row-only fallback |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Anthropic sample mods (`hello-tabs`, `token-weather`, `blast-radius`) | per the Claude Code distribution | Reference only; run as throwaway spike mods, never vendored | S1 pane placement, S4 selection probe |

No upstream code is ported.

## 3. External research sources

Cited in the exploration ledger; the ones the spikes and schema rely on:

- Claude Code desktop docs: code.claude.com/docs/en/desktop.md ("Arrange your workspace", "Ask a
  side question", "Browse external sites") — S1, S6, S8.
- Claude Code mod reference and the mod type declarations bundled with 2.1.295
  (`types/claude-code.d.ts`) — `$.mcp.call`, `$.ui.selection`, `$.prompt.fill`, desktop elements
  (S1, S2, S3, S4).
- Box connector tool schemas (`get_file_content`, `get_preview_page`, `get_file_preview`) — S3.
- Box Content Preview README (github.com/box/box-content-preview, `startAt` pages only) — why
  "Open in Box" is page level at best.
- W3C Web Annotation Data Model (w3.org/TR/annotation-model), TextQuoteSelector — `SourceRef.quote`.
- claude.com/claude-for-word (fetched 2026-10-14) — the one-hour Word check.

## 4. In-repo capability references

| Brick | Path | Use here |
|-------|------|----------|
| `DurableLocator` quote struct (W3C TextQuoteSelector shape) | `packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts` | Reuse or match for `SourceRef.quote` |
| `TextQuoteSelector` | `packages/foundation/modeling/rdf/src/Evidence.ts` (`@beep/rdf`) | Shape reference |
| `ClaimDisposition`, `ClaimDispositionStatus` (`active`, `rejected`, `superseded`) | `packages/epistemic/domain/src/entities/ClaimDisposition/`, `packages/epistemic/domain/src/values/ClaimDispositionStatus/` | Projection target |
| Use-case ports/service layout | `packages/law-practice/use-cases/src/DocketIntake/`, `packages/law-practice/use-cases/src/PatentClaimCandidate/` | Pattern for `ReviewQueue` and `VerdictProjector` |
| Practice MCP read tools | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` | Source of `kg-answer` items (not changed here) |
| Box driver | `packages/drivers/box` | Confirms no annotation read path; not changed here |

NET-NEW here: `ReviewItem`, `SourceRef`, `VerdictRow`, `ReviewQueue`, `VerdictProjector`.

## 5. Cross-links & provenance

- Exploration: [`explorations/attorney-review-workspace`](../../../explorations/attorney-review-workspace/README.md),
  decisions of 2026-10-14 seeded into [`SPEC.md`](../SPEC.md) Decision Log.
- Sibling goal: `goals/practice-claude-mod` (PR #1711), decisions D8, D9, D10, D12 — receives the
  amendment; never edited from here.
- Consumer: [`explorations/claim-element-graph`](../../../explorations/claim-element-graph/README.md)
  (finding-surface and verdict-storage decisions).
- Prior review attempts: `goals/practice-kg-mcp` (S15, D-29), `goals/practice-document-identification`
  (D8, D16), `goals/design-figure-review-loop` (T1/T2).
