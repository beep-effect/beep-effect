# P0 Oracle — Research: inventory census

Date: 2026-07-11. Branch: `feat/goals-doctor` (from `main` @ 53f5bb53a2).

Oracle (from `PLAN.md`): `research/status-token-census.md` committed with the
jq census script and its output; census total equals packet-dir count.

## Actual output

Key totals from the committed census run (full output in
[`../research/status-token-census.md`](../research/status-token-census.md)):

```text
## 1. Packet directories (excluding _template)
total_packet_dirs=83

## 2. Manifest presence
with_manifest=78
without_manifest=5
  missing: goals/agentic-cad-patent-tooling
  missing: goals/dedup-clone-engine
  missing: goals/knowledge-workspace
  missing: goals/repo-codegraph-jsdoc
  missing: goals/trustgraph-port
```

Total check: 83 packet dirs = 78 with manifest + 5 without. ✔

## Deltas vs the 2026-07-10/11 audit in SOURCES.md

- 83 packet dirs (was 82) — `goals-doctor` itself joined the set.
- 78 manifests (was 77) — same cause; the 5 manifest-less packets unchanged.
- 14 `initiative.status` tokens + 7 bare-status packets confirmed exactly.
- 12 phase-status tokens confirmed exactly (503 phase entries).
- 10 status↔lifecycle disagreements (audit had highlighted
  yeet-pr-closeout-loop; the census lists all ten).
- 10 active-ish packets missing GOAL.md (audit counted 7 — the census's
  broader active-ish filter also catches `pending`/`bootstrapped-*` packets
  that D1 maps to `paused`, where the advisory will not fire).
- New ground truth beyond the audit: 34 READMEs lack a recognizable
  `Lifecycle:` line; 7 manifests have no `initiative` object; 3 have
  object-shaped `phases`; schemaVersion splits 65/6/7
  (v1 / `1.0.0` / absent).
