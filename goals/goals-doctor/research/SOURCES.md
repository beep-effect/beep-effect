# Sources — Goals Doctor & Index

Provenance ledger for the audit evidence and external patterns behind
`SPEC.md`'s locked decisions. Gathered 2026-07-10/11 via a 10-agent research +
repo-analysis workflow during the goals-system upgrade session; re-verify the
in-repo numbers at P0 (they age with every merge).

## In-repo evidence (audited 2026-07-10, spot-corrected 2026-07-11 post-PR #365)

These figures move with every merge — the 2026-07-10 survey counted 20
`initiative.status` tokens; after PR #365 an adversarial re-census counted 14
in-field tokens plus 7 packets using a bare top-level `status` field (~20
distinct tokens across both fields). Treat P0's fresh census as the
migration's ground truth, not this note.

- **Status sprawl (post-#365 census):** 77 of 82 `goals/*` dirs (excluding
  `_template`) have `ops/manifest.json`; `initiative.status` holds 14
  distinct tokens (active 17, completed-retained 29, plus one-offs like
  `active-p3-ready`, `v2-active`,
  `p0-p6-implemented-runpod-10-packet-evidence-complete`); 7 packets use a
  bare top-level `status` field instead (agent-governance-control-plane,
  ip-law-knowledge-graph, nlp-adjunct-port, oip-web-launch,
  oip-web-production-hardening, repo-quality-convergence,
  trustgraph-doc-ontology); 57 carry a third field (`lifecycle`) that can
  disagree (yeet-pr-closeout-loop is `superseded`/`active` on main today).
  Phase statuses use 12 distinct tokens (`completed`, `complete`, `done`,
  `pending`, `PENDING`, `planned`, `seeded`, `in_progress`, `in-progress`,
  `DONE`, `selected`, `active`).
- **Manifest-less packets (5):** agentic-cad-patent-tooling,
  dedup-clone-engine, knowledge-workspace, repo-codegraph-jsdoc,
  trustgraph-port — invisible to every gate; `ReflectionArtifact.ts`
  `continue`s on missing manifest.
- **Launcher-rule violations:** 7 active packets missing `GOAL.md`
  (agentic-professional-runtime, ai-metrics-stack, beep-schema-topology,
  canvas, file-processing-capability, repo-codegraph, stack-installer);
  an 8th, repo-context-topology, left the set when PR #365 marked it
  superseded.
- **Reflection-gate hole:** the completed-status allowlist in
  `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts` is
  `[completed-retained, complete, completed, v1-closed]` — misses
  `superseded`, `DONE`, `local-proof-complete`, etc.
- **YAML frontmatter traps (found during PR #365):** three reflections failed
  `ReflectionFrontmatter` decode — unquoted plain scalars containing `: `
  (e.g. `` `module: ESNext` ``) hard-fail Bun.YAML, and a todo beginning
  `Convention: ...` silently parsed as a map instead of a string. Only
  completed packets are checked today, so these hid for weeks. Fix pattern:
  `>-` block scalars.
- **Index gap:** `goals/README.md` carries a stale hand-written "Current Goals
  Snapshot" that contradicts its own Index Policy; explorations/ has ATLAS.md
  but goals/ has no generated equivalent; zero tooling reads `completionGate`,
  `agentLaunchers`, or `packetAnchorDocument`.
- **The manual proof:** PR #365 (merged 2026-07-11 as a718c21e8a) closed nine
  packets whose work had merged weeks earlier (PRs #272, #269, #229, #210,
  direct merges 8dbd778313/d22d97bb29) — a hand-run of exactly the
  reconciliation this packet automates.

## External patterns (mid-2026 survey; adopted-from notes per decision)

- **OpenSpec** (Fission-AI) — directory-location-as-lifecycle and
  archive-as-merge; `validate --strict` machine-checks spec artifacts.
  Informs D6 (truthful index) and the follow-up archive packet.
  https://github.com/Fission-AI/OpenSpec
- **GitHub Spec Kit** — `/speckit.converge`: assess reality vs spec/plan and
  append remaining work; drift is checked, not assumed. Informs D5 doctor.
  https://github.com/github/spec-kit
- **Kiro (AWS)** — specs' "Sync Files" reconciles task lists against the
  codebase automatically. Informs D5 (evidence reconciliation, not
  bookkeeping). https://kiro.dev/docs/specs/
- **beads (Steve Yegge)** — ready/stalled as computed queries, `bd doctor`,
  decay/compaction, ~25k-token active-set budget, claim/lease fields.
  Informs D2, D3 optional fields, and the INDEX size budget.
  https://github.com/steveyegge/beads
- **Anthropic engineering** (context engineering; Claude Code best
  practices) — "give Claude a check it can run"; oracle-authored-at-shaping
  (this packet's PLAN oracles); lean always-loaded surfaces. Informs the
  phase-oracle discipline and INDEX budget.
- **Fallow (in-repo)** — baseline ratchet: inherited findings advisory, new
  findings blocking, baseline only shrinks. Informs D4.

## Session artifacts

- Goals-system upgrade recommendations (2026-07-11):
  claude.ai artifact `goals-system-upgrade` — TL;DR stack, workspace verdict,
  quick-win verification, blind spots.
- Goal Portfolio Pulse (2026-07-10, refreshed 07-11):
  claude.ai artifact `goal-portfolio-pulse` — 81-packet status board.
