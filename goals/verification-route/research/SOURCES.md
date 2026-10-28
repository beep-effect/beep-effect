# Verification Route — Sources & Provenance

- **Source exploration:** `explorations/verification-route` — primary ledger:
  `explorations/verification-route/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| none | No upstream code is mined; ideas only (see §2). | — | — | — | — |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Turborepo (pinned read at v2.11.10) | MIT | ideas only, no code | global-input semantics, `inputs` negation, `--affected` |
| Nx (pinned read at 24.0.2) | MIT | ideas only | `namedInputs`, per-target inputs |
| bazel-contrib/target-determinator | Apache-2.0 | ideas only | affected-target determination, unsoundness cases |

Details and URLs: the exploration's `RESEARCH.md` "External landscape
(2026-10-28)" and its `research/SOURCES.md` §External.

## 3. External research sources

Carried by reference from the exploration ledger (22 cited URLs there), among
them Elbaum, Rothermel & Penix (FSE 2014) and Machalica et al. (ICSE-SEIP 2019)
on regression test selection, and Addy Osmani's 2026-10-26 X article on the
Claude Code team's code review (the review-lane analogue; outside this goal).

## 4. In-repo capability references

The capability check table in `explorations/verification-route/MAP.md`
(verified `file:line` at main, 2026-10-27/28): `CiLaneId` and `ciLaneStep`,
`FinalCheck` receipt and skips, `WaveOrder`, `HeavyAdmission`, turbo dry-run
package graph, prepare-phase writers, `capture_hosted` and the hosted-runs
record shape, A1 lane costs, `LiteralKit`, `effect/Graph`, `ProofShadow`, the
`GateOrderSeedRow` pointer-verification pattern.

## 5. Cross-links & provenance

- `explorations/beep-ci-operational-ontology` (S7 replay technique; MAP gate
  `ciops-yeet-projection`, not fired).
- `goals/time-to-certainty` (A1 economics, `gate-order-handoff/v1`,
  ProofFact/ProofLedger, ruling 80).
- `goals/ciops-ontology-pipeline` (`research/kpi-verdict.md` §7, no route claim).
- `THE_AGENTIC_YOYO.md` (repo root).
