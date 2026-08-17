# Goal: knowledge-surface-automation

Turn the agent-facing knowledge surfaces (`goals/`, `explorations/`, `.claude/skills/`,
`.agents/skills/`, `docs/`, `CLAUDE.md`/`AGENTS.md`, `.codex/`) into audited, gated,
self-proving infrastructure. Read `goals/knowledge-surface-automation/SPEC.md` (ratified
doctrine) and `PLAN.md` (phase map) before acting; check `ops/manifest.json` for the
current phase.

## Non-negotiable doctrine

- Schema → service contract → implementation, in that order.
- Phase 0 of every workstream is a READ-ONLY report command. No mutation pass runs until
  that report's false-positive rate has been eyeballed by Benjamin.
- Every finding class becomes a permanent gate: Stage 1 diff-scoped (no baselines),
  Stage 2 sealed ratchet baselines burned down over time. Gates outlive the audit.
- Open decisions listed in SPEC.md are grilled with Benjamin FIRST; grill outcomes land
  as their own docs-only PR before implementation PRs.
- Ratified decisions in SPEC.md are closed — do not reopen them.

## Workstreams (details in SPEC.md)

- **A** clone-agnostic references: mechanical path-rewrite pass via repo-shipped
  ast-grep/comby rules, then `beep knowledge refs|relink|rename` with typed URI buses
  (`repo://`, `host://`, `upstream://`), git-tree-resolved validation, hermetic byte gates.
- **B** vendored-skill warehouse: pristine snapshot + ordered patch series +
  reconstructed installs (`beep skills provenance|materialize`), one effective tree
  feeding both skill dirs, Renovate-driven bump PRs, hunk-decision ledger.
- **C** self-proving docs: Stage-1 semantic-delta embargo (paired merge-base/HEAD
  archives, path + `--help` command probes, INDEX regen diff, one assertion form) then
  Stage-2 `beep knowledge doctor` with sealed baseline, counterfactual evaluator tests,
  debt leases, causal grouping.
- **D** capability-derived roadmap: additive `provides`/`requires` manifest arrays,
  bun:sqlite projection with pure-TS differential reference, `beep goals next|explain`,
  evidence receipts, scout fog nodes, Mermaid INDEX block before HTML dashboard.
- **E** packet bootstrap: pure `compileMaterializationPlan`, `beep goals bootstrap` +
  `beep explore graduate` + adoption patches, `--plan --json` dry-run contract, atomic
  publish, PacketId lineage. This hand-rolled packet is adoption test case #1.

## Working rules

- This packet must itself stay clone-agnostic: repo-relative paths only, no
  machine-local paths in any tracked file (verificationCommands enforce this).
- Deposit research as files under `research/`; update `ops/manifest.json` phase statuses
  and `researchReports` in the same change.
- Heavy fan-out goes to Codex (`codex exec`, effort per session doctrine), with results
  written to files under `research/`, not chat.
- Quality path is yeet: `bun run beep yeet repair|verify|publish --message "..."`.
  `main` is PR-only; publish from this branch; do not merge without Benjamin's ask.
- Stop conditions live in `ops/manifest.json`; on hitting one, stop and report.

## Definition of done

New-violation gates for every landed finding class are green and standing; Stage-2
baselines sealed and burning down; bootstrap/graduate/adopt self-hosted (this packet
adopted); closeout reflection written; lifecycle flipped in the same PR as final work.
