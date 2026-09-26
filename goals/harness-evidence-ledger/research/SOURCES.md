# Harness Evidence Ledger: Sources and Provenance

- **Source exploration:** none. This goal was authored directly from the
  2026-09-25 grill-with-docs session. Its locked decisions (D1 to D14) live in
  [`../SPEC.md`](../SPEC.md).
- **Discovered from:** `goals/coding-agent-effectiveness-evidence-loop`.

## 1. Relation to the literature

RRSI is convergent prior art, not a source this repo derived from. The repo
packets in section 4 were written two to eleven weeks before the paper
appeared. What the paper adds is concrete acceptance and retention rules. None
of those rules existed as code here. This packet ports three of them and
declines the rest (see `SPEC.md`, Relationship To RRSI).

## 2. External research sources

| Source | Identifier | What we take | Disposition |
| --- | --- | --- | --- |
| RRSI: regularized recursive self-improvement of agent harnesses (Google Cloud AI Research) | arXiv 2609.24972 v2, 2026-09-23 | Typed per-edit record (component, hypothesis, diff, score delta, cost delta, accepted); evidence-driven pruning target set; cosine-annealed edit budget. | Port three mechanisms: ledger row, fingerprint expiry, retention pruning. Use the annealed budget only in the rerun. |
| SkillOpt (Yang et al., Microsoft) | arXiv 2605.23904 | The skill-training loop the parked pilot used; `lr_scheduler: cosine` with `learning_rate` / `min_learning_rate` as edit budgets; `env.workers` for parallel gate evaluation. | Reuse as the rerun tool. No vendoring beyond what the pilot shipped. |
| Generalization in Adaptive Data Analysis and Holdout Reuse (Dwork et al. 2015) | arXiv 1506.02629 | Why reusing a finite evaluation set adaptively overfits; why falsified hypotheses stay recorded. | Reference. Grounds keeping rejected rows as negative evidence. |
| HarnessCompass: guiding automatic harness evolution toward generalizable and effective agent harnesses | arXiv 2608.01918 | Component-wise tracks; a pre-evaluation generalization gate; clean held-out split. | Reference for `MechanismClass` comparison and future leakage screening. |
| Evo-Bench: can language models improve agent harness? | arXiv 2608.09096 | "One falsifiable mechanism per iteration"; experiment ledger of hypotheses and closed insights. | Reference. Supports one hypothesis per row. |

## 3. Session research maps (tracked copy)

Written by the four research lanes and three exploration lanes of the
2026-09-25 session. Tracked copies live in
`research/2026-09-25-rrsi-deep-research/` inside this packet, with home paths
rewritten to `$HOME`. Their conclusions are carried by `SPEC.md`.

| File | Content |
| --- | --- |
| `concepts.md` | RRSI core concepts: failure modes, proposal-side and selection-side regularizers, evaluation discipline. |
| `repo-prose-map.md` | Where repo packets and docs already state each RRSI idea, with dates. |
| `repo-code-map.md` | Existing schemas and code adjacent to a ledger row, fingerprint, and pruning. |
| `refs-evolution.md` | Survey of harness-evolution papers; "Cross-cutting patterns" section. |
| `refs-rsi-memory.md` | Survey of RSI and memory papers, including SkillOpt and Dwork et al. |
| `explore-packets.md` | Packet states, locked constraints, and overlaps that shaped D7. |
| `explore-code.md` | AgentEffectiveness schemas, ai-metrics config snapshot, SkillOpt scheduler and workers, corpus and scorer facts. |
| `explore-telemetry.md` | Hook-pulse stream, fingerprint candidates, research tombstone format, pruning doctrine, observability rules. |
| `bootstrap-plan.json` | `goals bootstrap` materialization plan for this packet. |

## 4. In-repo precedents

| Packet | Date | What it already held |
| --- | --- | --- |
| `goals/agent-effectiveness-loop` | 2026-05-20 | First agent-effectiveness command family and Phoenix substrate. |
| `goals/skillopt-training-pilot` | 2026-07-06 | Gated skill-training loop; PARK verdict; FINDINGS name bigger edit budgets and parallel workers as rerun levers. |
| `goals/coding-agent-effectiveness-evidence-loop` | 2026-07-31 | Disposition policy, instrument-before-treat, "never automate AGENTS/skill changes", P7 improvement portfolio. |
| `explorations/context-rent-telemetry` | 2026-07-31 | Always-loaded context charges rent; prune empirically. Parked until a pruning-proposal consumer exists. |
| `goals/knowledge-surface-automation` | 2026-08-17 | Pruning proposals are never applied unilaterally. |
| `goals/nightly-research-routine` and `research/README.md` | 2026-08-08 | Append-only ledger laws, single writer, machine proposes and human admits, tombstones. |
| `goals/knowledge-freshness-audit` | 2026-09-24 | A changed evaluator, prompt, or model invalidates reuse of prior outputs. |

## 5. In-repo capability references

- `packages/tooling/library/ai-metrics/src/config-snapshot.ts`: harness
  session and baseline hashes reused by `HarnessFingerprint` (D10).
- `packages/tooling/library/ai-metrics/src/hook-pulse.ts` and
  `.claude/hooks/hook-pulse.sh`: the surface observation point (D8).
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`: `EvalRecord`
  and `EvalLawLanes`, the scorer fixes.
- `tools/skillopt/configs/beeplaw.template.yaml`: the pilot config the rerun
  derives from.
- `standards/architecture/12-observability.md` and
  `goals/harness-otel-adoption/research/p0-attribute-contract.md`: the
  no-paths telemetry doctrine.

## 6. Cross-links

- Provides capability `tooling/harness-ledger`, required by
  `goals/coding-agent-effectiveness-evidence-loop`.
- Resume trigger for `explorations/context-rent-telemetry`.
- Expiry semantics shared with `goals/knowledge-freshness-audit`.
