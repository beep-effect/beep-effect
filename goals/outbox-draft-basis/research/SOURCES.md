# Outbox Draft Basis — Sources & Provenance

- **Source exploration:** `explorations/semantic-agent-graph-stack` — primary ledger:
  `explorations/semantic-agent-graph-stack/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| beep-send-guard | Restate, re-read, compare | beep-effect | `packages/drivers/m365-mcp/src/OutboxSendGuard.ts` | pure guard over two schemas | pattern to follow |
| beep-send-refusal | `version-unbound` after every check | beep-effect | `packages/drivers/m365-mcp/src/OutboxHandlers.ts` | send is closed | unchanged |
| beep-audit-log | `draft-created` and outcome records | beep-effect | `packages/drivers/m365-mcp/src/OutboxAuditLog.ts` | append-only journal | extend |
| beep-graph-reads | `getEvent`, `getMessage`, `listMessages`, `updateMessageCategories` | beep-effect | `packages/drivers/m365/src/M365.service.ts` | Graph reads and the category write | reuse |
| beep-event-schema | `changeKey` changes on every edit | beep-effect | `packages/drivers/m365/src/M365.schemas.ts` | why a digest of named fields | constraint |
| beep-stub-world | Scripted Graph for handler tests | beep-effect | `packages/drivers/m365-mcp/test/OutboxWorld.fixture.ts` | test world | extend |
| beep-review-staleness | `Stale` with reason `basis-changed` | beep-effect | `packages/foundation/modeling/epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts` | vocabulary precedent | word reused, no import |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| <https://github.com/ontogr/agentic-graphrag> | Apache-2.0 | reference only; nothing ported | the idea that a changed source flags what depended on it |

## 3. External research sources

- Liu et al., graph-mediated LLM systems, <https://arxiv.org/abs/2611.05953>:
  correct retrieval does not ensure a correct action. The operator-change
  example is this goal's scenario.
- Sergey Vasiliev, knowledge, memory and context graphs,
  <https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and-b78>:
  a correction does not rewrite the past, and the release step rechecks.

The full ledger, with licenses and fetch gaps, is the exploration's.

## 4. In-repo capability references

| Brick | Path | Mark |
| --- | --- | --- |
| Outbox server | `packages/drivers/m365-mcp` | extend |
| Microsoft 365 driver | `packages/drivers/m365` | reuse |
| Driver boundary rule | `standards/architecture/03-driver-boundaries.md` | binding |
| Registration runbook | `docs/runbooks/m365-agent-outbox-registration.md` | extend |
| Pin and report schemas, pure comparison, check-drafts tool | — | NET-NEW |

## 5. Cross-links & provenance

- Brief: [`BRIEF.md`](../../../explorations/semantic-agent-graph-stack/BRIEF.md).
- Map and gated follow-ons: [`MAP.md`](../../../explorations/semantic-agent-graph-stack/MAP.md).
- Alignment log: [`DECISIONS.md`](../../../explorations/semantic-agent-graph-stack/DECISIONS.md).
- Research, including the 2026-11-10 re-baseline: [`RESEARCH.md`](../../../explorations/semantic-agent-graph-stack/RESEARCH.md).
- Neighbour packet: [`m365-agent-outbox`](../../m365-agent-outbox/README.md).
