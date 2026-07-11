# Project Intelligence

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build a local-first, evidence-backed research-intelligence loop for this repo:
discover → acquire → snapshot → extract → ground → deduplicate → assess →
synthesize → publish → query → feedback, over the landscape that matters to it
(AI/agent frameworks, agent memory, knowledge graphs and ontologies,
Effect-based projects, agent tooling and MCP, legal AI, competitors, and
repositories that could improve this repo). First proof: a deterministic,
fixture-driven vertical — GitHub watchlist → immutable snapshots →
evidence-grounded observations/claims → daily Markdown brief — behind a typed
Effect API.

This is a program packet. Each `PLAN.md` phase ships as its own mergeable PR
per the completion gate; dependency packets are referenced, not duplicated.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/project-intelligence/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (locked decisions D1–D7,
   deferred gates G1–G7).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 research → P5 close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/recon-findings.md`](./research/recon-findings.md) - distilled
   4-area recon (packet mechanics, prior art + reuse map, net-new gaps,
   doctrine constraints).
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Dependency Packets

| Packet | Relationship |
| --- | --- |
| [`firecrawl-driver`](../firecrawl-driver/README.md) | `@beep/firecrawl` scrape/search + Monitor/Watcher — the discover/ingest brick and change-feed prior art. |
| [`epistemic-claim-lifecycle-gate`](../epistemic-claim-lifecycle-gate/README.md) | Shipped claim/evidence/provenance kernel (ClaimLifecycle, ClaimGate, ClaimProjection, EvidenceSpan) this packet consumes per the 2026-06-18 boundary decision. |
| [`provenance-shared-claim-kernel`](../provenance-shared-claim-kernel/README.md) | Substrate routing precedent: `@beep/provenance` TextAnchor, `@beep/schema` UnitInterval, shared ClaimLifecycle vocabulary. |
| [`official-data-sync-foundation`](../official-data-sync-foundation/README.md) | Snapshot + drift-detection + report-backed-PR pattern to generalize. |
| [`file-processing-capability`](../file-processing-capability/README.md) | Extraction substrate for later roadmap stages (local corpus ingestion). |
| [`agentic-professional-runtime`](../agentic-professional-runtime/README.md) | Deterministic runtime-data-loop fixture catalog — structural precedent for the first proof (gate G5). |

## Current Phase

P0 Research. Next concrete action: launch a P0 session via the `/goal`
command above — start from `research/recon-findings.md`, then close gates
G1–G7 (PLAN.md P0 checklist) beginning with the corpus reconnaissance and
interest taxonomy.

## Latest Evidence

Not started (packet authored 2026-07-11; P0 pending).

## Notes

- `bun run beep goals` (doctor/index/set-status) does not exist yet — it is
  the unbuilt deliverable of [`goals-doctor`](../goals-doctor/README.md). Use
  the manifest `verificationCommands` directly until it lands.
- The `beep research` CLI
  (`packages/tooling/tool/cli/src/commands/Research/`) is a working prototype
  of much of this loop (Firecrawl capture, vault cards, DuckDB dedup catalog,
  daily digest, repo cards, graph-memory clients). It is governing prior art;
  gate G3 decides promote/reuse/retire per mechanism — do not build a
  parallel copy of what it proves.
- Sanitization is binding on every committed artifact (SPEC D2): no personal
  metadata, no local absolute paths, no operator-corpus specifics.
- Adjacent explorations to cross-link, not duplicate:
  `ingestion-security-secret-governance` (threat-model baseline, D7),
  `rag-retrieval-projection`, `local-first-projection-sync`,
  `agent-memory-tiers-bitemporal-edges`,
  `citation-grounding-hallucination-guard`, `solo-firm-docketing`
  (watch-to-alert shape).
