# Atlas Synthesis — Current State ↔ Goals/Vision Grounding

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A synthesized **baseline-context** packet: ground us in (a) the current state of the
repository and (b) the goals/vision, so the next instruction lands on shared, aligned
ground. Built as a maximal multi-agent fan-out with adversarial verification. **Renamed
from `baseline-synthesis` to `atlas-synthesis` on 2026-06-17** — it is the
capability-inventory half of the grand-vision exercise in [`../ATLAS.md`](../ATLAS.md);
the outcome-decomposition half is the next stage.

## Next Open Question

What direction should this baseline ground (the next instruction)? The three
doctrine-hygiene calls the centerpiece teed up (`synthesis/00` §5) are now **done
(2026-06-17)**: the `standards/memory-architecture/` standard was amended ("L3 = moat"
retired), `effect-capability-kg` was **parked**, and this packet was **renamed**
`baseline-synthesis → atlas-synthesis`. The product-shaped open question remains: which
**first IP-law workflow** (office-action review / intake / drafting / contract review),
and should `law-practice` graduate from domain-only to a full slice now? **Resolved (2026-06-17):** dad-tool-first
(ambition ladder; rung-3 firm aggregation bracketed); migrate only the thin v3 slice
(`EvidenceSpan`). The office-action wedge is chosen and **graduated into two goal packets** —
[`goals/epistemic-claim-lifecycle-gate`](../../goals/epistemic-claim-lifecycle-gate/README.md)
(the reusable boundary) and
[`goals/law-practice-office-action-spike`](../../goals/law-practice-office-action-spike/README.md)
(the IP-law vertical + loop). **Next:** build them — the epistemic boundary first, then the
law-practice vertical that composes it.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state: stage, status, open questions.
2. `README.md` — this file.
3. [`synthesis/00-baseline-gap-map.md`](./synthesis/00-baseline-gap-map.md) — **the centerpiece**; read first.
4. [`synthesis/90-archaeology-pruned-repo-intel.md`](./synthesis/90-archaeology-pruned-repo-intel.md) — the framing (learning vehicle vs product); read second.
5. [`RESEARCH.md`](./RESEARCH.md) — the full index of all 25 synthesis artifacts (incl. the `30`-band assessment + `40`-band v3 prior art).
6. [`CAPTURE.md`](./CAPTURE.md) / [`DECISIONS.md`](./DECISIONS.md) — raw input (incl. the builder's background) + the align-grill decisions.

## Trail

- 2026-07-14: **Frontier re-drawn by the graduation campaign** — 16 exploration
  packets dispositioned in one run (~18 goals graduated, incl. the law-practice
  docketing/time/citation/doc-structure arc, the epistemic bitemporal core, the
  retrieval fusion core, and the workflow-engine spike). The gap map
  (`synthesis/00-baseline-gap-map.md`) is stale by design; the next synthesis
  pass fires after the first vertical loop turns (office-action wedge ships).
  Packet stays `active` as the standing synthesis vehicle.
- 2026-06-17: **Foundation-gaps analysis** (`synthesis/60-foundation-gaps.md`). Grilled the
  placement; recommends a shared **`@beep/provenance`** anchor (`TextAnchor`/`SourceRef`) in
  `foundation/modeling` as the keystone fill-in. Coordination: `epistemic-claim-lifecycle-gate`'s
  EvidenceSpan should **consume** it, not define char-offsets locally on `Evidence`. Embeddings /
  reasoner / grounded-ask = migrate-from-v3; the in-memory graph (`@beep/nlp/Graph`) + SHACL gate
  (`@beep/semantic-web`) already exist.
- 2026-06-17: **Graduated the first two goal packets** from the office-action wedge. Ran a
  workflow: deep-research (`synthesis/50` OA anatomy, `synthesis/51` OA data + ontology
  reality-check) → `BRIEF.md` + `MAP.md` (the decomposition) → scaffolded
  [`goals/epistemic-claim-lifecycle-gate`](../../goals/epistemic-claim-lifecycle-gate/README.md)
  (reusable boundary, build first) and
  [`goals/law-practice-office-action-spike`](../../goals/law-practice-office-action-spike/README.md)
  (IP-law vertical + loop). Both `PLAN.md`s enforce **schema → service-contract → implementation
  → verify**. Verified: GOAL.md ≤4000 chars, manifests valid JSON, capability-cited, slice-correct
  (new `use-cases`/`server` tiers within existing slices — no `knowledge-law/*` packages).
- 2026-06-17: Strategic & architectural **assessment** (branch `…_CHALLENGES_AND_SUGGESTIONS`).
  Ran two workflows: the assessment (`30`/`31`/`32` — steelman→red-team→verdict + a broad
  deep-research competitive/market/regulatory sweep) and a **v3 prior-art** exploration
  (`40`–`43`) of the pre-migration `beep-effect4` repo (its `@beep/knowledge-server` engine +
  specs + lessons). Verdict: build it, **dad-tool-first**, **office-action** wedge; provenance is
  a wedge, **`corpus + trust`** is the moat. The v3 finding **softened the integration-gap
  red-team** (a proven, test-backed KG engine to migrate, not greenfield) — amendments appended
  to `30`/`32`; new open questions logged (ambition fork; migrate-vs-rebuild). Stage: `research`.
- 2026-06-17: Doctrine-hygiene cleanup — amended the memory-architecture standard
  (retired "L3 = moat"), parked `effect-capability-kg`, fixed `file-processing-capability`
  status, softened the vision-map "moat" line, and **renamed this packet
  `baseline-synthesis → atlas-synthesis`**.
- 2026-06-17: Opened from a direct request. Ran an align grill up front (scope=maximal,
  layout=hybrid+`synthesis/`, research=focused law+memory, slug=`baseline-synthesis`).
  Executed a maximal fan-out workflow (~29 agents: census + git-archaeology → 13 synthesis
  → 13 adversarial verifiers → centerpiece). Added the builder's profile (`05`) and the
  local-codebase lineage (`23`, incl. the near-complete TrustGraph Effect-native TS port).
  Wrote `RESEARCH.md` index + this README; synced `ATLAS.md`. Stage: `research`. Stopped at
  the Next Open Question — awaiting the user's direction.
