# Grok Bot automation: hosted judgment, local proof — Sources & Provenance

- **Cluster / origin:** Five-lane research fan-out, repo audit, design pass, and
  two-round operator grill completed on 2026-09-03.
- **Provenance:** The preserved lane reports below are sanitized copies of the
  handoff record. `RESEARCH.md` is the packet-owned synthesis.

## 1. Research lanes

| Lane | Artifact | Model | Date | Turns / provenance |
| --- | --- | --- | --- | --- |
| G1 product facts | [`g1-grok-bot-facts.md`](./lanes/g1-grok-bot-facts.md) | Grok 4.6 with GPT-5.6 Luna orchestration | 2026-09-03 | 146 turns reported by stream |
| G2b use cases and practices | [`g2-use-cases-and-practices.md`](./lanes/g2-use-cases-and-practices.md) | Grok 4.6 with GPT-5.6 Luna orchestration | 2026-09-03 | 83 turns reported by stream |
| G3 prior art | [`g3-prior-art.md`](./lanes/g3-prior-art.md) | Grok 4.6 with GPT-5.6 Luna orchestration | 2026-09-03 | 194 turns reported by stream |
| C1 repo audit | [`codex-c1-automation-audit.md`](./lanes/codex-c1-automation-audit.md) | Codex Sol, xhigh | 2026-09-03 | Turn count not reported |
| C2 pack design | [`codex-c2-botpack-design.md`](./lanes/codex-c2-botpack-design.md) | Codex Sol, xhigh | 2026-09-03 | Turn count not reported |
| C3 synthesis | [`SYNTHESIS.md`](./lanes/SYNTHESIS.md) | Codex Sol, xhigh | 2026-09-03 | Cross-lane synthesis |
| Operator grill | [`GRILL.md`](./lanes/GRILL.md) | Codex Sol, xhigh | 2026-09-03 | Two rounds; decisions locked by operator |

The lanes are evidence, not independent doctrine. Packet decisions resolve
their contradictions and uncertainty.

## 2. Upstream repositories and license discipline

| Source | License posture | Use in this packet |
| --- | --- | --- |
| [`DexHorthy/pstack`](https://github.com/DexHorthy/pstack) | MIT; reference-only here | Evidence, role, autonomy, and promotion precedent via `beep-mode` |
| [`Effect-TS/effect`](https://github.com/Effect-TS/effect) | MIT; reference-only here | Subject of the first proposed upstream-watch pack |

No upstream code is copied into this docs-only packet.

## 3. External research sources

The lane files retain the complete URL inventory and confidence annotations.
The product framing rests first on these official sources, verified 2026-09-03:

- [Introducing Grok Bot](https://x.ai/news/introducing-grok-bot)
- [Grok Bot is now available on more plans](https://x.ai/news/grok-bot-more-plans)
- [Cursor plans and usage](https://cursor.com/help/grok-bot/plans)
- [Approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy)

Field reports and forum incidents are preserved with lower confidence in the
G1, G2b, and G3 lane reports.

## 4. In-repo capability references

| Capability | Location | Disposition |
| --- | --- | --- |
| Evidence and recovery receipts | `packages/foundation/modeling/skill-contract` | Reuse |
| Repo operational CLI | `packages/tooling/tool/cli` | Extend in a later goal |
| Yeet publisher and closeout | `packages/tooling/tool/cli` | Reuse locally |
| Nightly research goal | `goals/nightly-research-routine` | Amend to observed topology |
| Vendor/evidence precedent | `explorations/beep-mode` | Bind selected decisions |
| Authored bot pack root | planned top-level `bots/` | NET-NEW; do not create here |

## 5. Cross-links and provenance

- [`RESEARCH.md`](../RESEARCH.md) distills the lane record.
- [`DECISIONS.md`](../DECISIONS.md) records the locked grill outcomes.
- [`explorations/beep-mode/`](../../beep-mode/) provides the sibling precedent.
- [`goals/nightly-research-routine/`](../../../goals/nightly-research-routine/)
  receives the doctrine amendment.
- [`standards/architecture/DECISIONS.md`](../../../standards/architecture/DECISIONS.md)
  records ownership of the future top-level root.
