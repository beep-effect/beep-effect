# LeJeune Knowledge Desk Lab — Sources & Provenance

- **Source exploration:**
  [`explorations/lejeune-bolt-agentic-demo`](../../../explorations/lejeune-bolt-agentic-demo/README.md)
- **Primary ledger:**
  [`research/SOURCES.md`](../../../explorations/lejeune-bolt-agentic-demo/research/SOURCES.md)
  in the source exploration. It wins if this goal-side mirror drifts.
- **Decision authority:**
  [`DECISIONS.md`](../../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md)
- **Carry-forward date:** 2026-08-26

The tables below reproduce the lab-relevant implementation subset of the exploration corpus.
Machine-local source locations are represented by their research reports, never by host paths.

## 1. Mined source corpus

| Source | Title | Location | Theme | Disposition |
| --- | --- | --- | --- | --- |
| L3 | Fastener distribution process | [`03-fastener-distribution-process.md`](../../../explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md) | RFQ, quote, RFI, offers, lots, tools, and human-stop boundaries | Story and copy authority; do not reproduce standards |
| L4 | In-repo capability inventory | [`04-in-repo-capability-inventory.md`](../../../explorations/lejeune-bolt-agentic-demo/research/04-in-repo-capability-inventory.md) | Labs, approval tools, Cosmos, Tailscale, and runtime gaps | Re-verify live source before implementation |
| L5 | Open-source references | [`05-open-source-references.md`](../../../explorations/lejeune-bolt-agentic-demo/research/05-open-source-references.md) | UI and temporal-memory patterns with license boundaries | Port only named permissive files with notices |
| L7 | Use-case evaluation | [`07-use-case-evaluation.md`](../../../explorations/lejeune-bolt-agentic-demo/research/07-use-case-evaluation.md) | Ranked cases and exact 30-minute storyline | Acceptance authority |
| L8 | Demo options | [`08-demo-options.md`](../../../explorations/lejeune-bolt-agentic-demo/research/08-demo-options.md) | Option C architecture, deployment, five-day plan | Architecture and sequencing authority |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What the lab may take |
| --- | --- | --- | --- |
| [trustgraph-ui](https://github.com/trustgraph-ai/trustgraph-ui) React root | Apache-2.0 | Named React files only with attribution; replace marks | Graph, source, and evidence interaction patterns |
| trustgraph-ui nested Python proxy | GPL-3.0-or-later | Clean-room only | Architecture reference; no code |
| [CogniWeave](https://github.com/CaptnRumpy/CogniWeave) | MIT | Port named files with MIT notice; replace name and icon | Tri-pane and approve/dismiss patterns if needed |
| [Graphnosis](https://github.com/nehloo/Graphnosis) | Apache-2.0 | Port with attribution | Source-line, `asOf`, and contradiction-review patterns |
| Local TrustGraph TypeScript port | Root license unverified in the source ledger | Reference-only until root license and attribution exist | No lunch code; no dependency |

Any port must remain inside the half-day governance budget and the fixed story. Existing in-repo
components are preferred.

## 3. External research sources

- LeJeune public company and product context: <https://lejeunebolt.com/> and
  <https://lejeunebolt.com/product-portfolio/>
- AISC bolting FAQ used by the cited clarification beat:
  <https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/>
- RCSC 2020 structural-joint specification:
  <https://www.boltcouncil.org/files/2020RCSCSpecification.pdf>
- Supplier-portal terms evidence and vendor claims remain in the
  [primary ledger](../../../explorations/lejeune-bolt-agentic-demo/research/SOURCES.md);
  none authorizes a connector or external write.

## 4. In-repo capability references

| Brick | Source evidence | Packet use or limit |
| --- | --- | --- |
| Lab lifecycle | [`L4 §E`](../../../explorations/lejeune-bolt-agentic-demo/research/04-in-repo-capability-inventory.md#e-lab-applications) and lab-app doctrine | Generator-only creation, deletion-dated charter, no public API |
| `@beep/acp`, `@beep/mcp-kit` | `packages/drivers/acp/src/AcpRpc.models.ts:28-343`; `packages/foundation/capability/mcp-kit/README.md:3-4,17-20,28-48` | Permission and elicitation primitives; no supplier-write connector |
| `@beep/cosmos` | `packages/drivers/cosmos/src/Cosmos.renderer.ts:331-587` | Half-day browser timebox; browser wiring unverified |
| `@beep/epistemic-*` | `packages/epistemic/domain/README.md:3-12`; `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:250-415` | Claims, evidence, contradictions, and fail-closed egress; procurement review remains lab-local |
| `@beep/tailscale` | `packages/drivers/tailscale/src/Tailscale.service.ts:134-216,297-443` | Status, Serve, HTTPS, and MagicDNS; live daemon/account unverified |
| Infrastructure precedent | `infra/src/AIMetrics.ts:144-222` | Service, Serve, and health-check shape; no lab resource exists |
| Bundle capability | [`lejeune-demo-corpus-and-ontology`](../../lejeune-demo-corpus-and-ontology/README.md) | Exact spans, rules, citations, replay, and deterministic projections |

## 5. Cross-links & provenance

- [Ratified brief](../../../explorations/lejeune-bolt-agentic-demo/BRIEF.md)
- [Ratified decisions](../../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md)
- [Decomposition map](../../../explorations/lejeune-bolt-agentic-demo/MAP.md)
- [Research synthesis](../../../explorations/lejeune-bolt-agentic-demo/RESEARCH.md)
- [Bundle goal](../../lejeune-demo-corpus-and-ontology/README.md)
