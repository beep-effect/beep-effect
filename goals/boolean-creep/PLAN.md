# PLAN — Boolean-Creep Eradication

Mutable execution plan. Contract: [`SPEC.md`](./SPEC.md); binding decisions:
[`DECISIONS.md`](./DECISIONS.md).

## Phases

| Phase | Name | Status | Exit |
| --- | --- | --- | --- |
| P0 | Bootstrap packet | complete | Packet on disk; inventory seeded (10 confirmed + 4 disqualified) and schema-valid; decisions seeded. |
| P1 | Inventory sweep (grok lanes) | complete | Corpus swept until dry (rounds 6+7 both zero-new); lane outputs merged; 100% of confirmed evidence-verified. |
| G1 | GATE 1 — inventory ratification | **passed 2026-08-17** | Benjamin ratified all 46; no strikes, Tier 2 included. |
| P2 | Design (codex Sol medium) | in progress | One design per confirmed instance under `designs/`, all schema-first-compliant. |
| P3 | Design review (orchestrator) | pending | Zero findings across all designs. |
| G2 | GATE 2 — design ratification | pending | Benjamin ratifies reviewed designs. |
| P4 | Apply + land (codex, yeet) | pending | Tiered PRs mergeable; inventory statuses advanced to `applied`. |
| P5 | Close | pending | Reflection landed; lifecycle flipped in the same PR as final work. |

## Current lane

P1 sweep rounds executed (2026-08-17):

- **Round 1** — 13 area-scoped grok lanes: 15 confirmed, 189 disqualified.
- **Round 2** — 5 residue-hunt lanes (useState/class-field/piped-boolean
  angles): 5 confirmed, 31 disqualified.
- **Round 3** — 5 lanes (let-latches, AsyncResult projections, tuples):
  9 confirmed, 18 disqualified.
- **Round 4** — single broad convergence lane: 0 confirmed, 2 disqualified.
- **Round 5** — exhaustive mechanical-residual triage (every remaining corpus
  file with a same-scope boolean cluster): 4 confirmed + orchestrator closed
  the exclusive-CLI-mode-flag family by exhaustive grep (3 more confirmed).
- **Round 6** — broad falsification pass, fresh angles: 0 confirmed,
  1 disqualified.
- **Round 7** — second consecutive dryness confirmation: 0 confirmed,
  0 disqualified ("DRY: nothing new"). Rounds 6+7 are the two consecutive
  empty rounds; P1 is dry.

Final inventory: **294 records — 46 confirmed, 248 disqualified**
(D1 207 / D2 41). Awaiting GATE 1.

Every confirmed entry was evidence-verified by the orchestrator (100%, not
the 20% minimum). The exclusive-CLI-mode-flag family's collapse
infrastructure already exists at
`packages/tooling/tool/cli/src/internal/cli/RunMode.ts` — designs should
reuse it.

## Sweep lane map (round 1)

| Lane | Areas | ~files |
| --- | --- | --- |
| tooling-tool | packages/tooling/tool | 447 |
| foundation-modeling | packages/foundation/modeling | 377 |
| law-practice | packages/law-practice | 304 |
| drivers | packages/drivers | 288 |
| foundation-ui-system | packages/foundation/ui-system | 196 |
| foundation-cap-prim | packages/foundation/capability + primitive | 189 |
| epistemic | packages/epistemic | 152 |
| shared-documents | packages/shared + packages/documents | 212 |
| tooling-rest | packages/tooling/library + policy-pack + test-kit | 155 |
| workspace-agents | packages/workspace + packages/agents | 144 |
| arch-eco-internal | packages/architecture-lab + ecosystem + _internal | 114 |
| ontology-mcp | packages/ontology + apps/practice-kg-mcp + apps/architecture-lab-proof | 78 |
| apps | apps/professional-desktop + apps/oip-web | 91 |

## Verification lane

```sh
bun goals/boolean-creep/ops/validate-inventory.ts
jq . goals/boolean-creep/ops/manifest.json
test "$(wc -m < goals/boolean-creep/GOAL.md)" -le 4000
```

## Blockers

None. Waiting on GATE 1.
