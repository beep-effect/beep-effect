# Sweeps at `e62411d63f` (2026-10-09)

Read-only sweeps that refresh the brief's head-dependent facts before any
lane edits (SPEC.md operating contract item 5). Each sweep ran at
`e62411d63f` (= `main`) from lane `rsc-packet` and records its own commands
and `file:line` evidence. [`INDEX.md`](./INDEX.md) is the orchestrator's
summary of all fourteen sweeps plus the critic's gap list (sanitized copy).

Placement (SPEC.md Decision Log, 2026-10-09 sweep evidence placement):
repository-facing sweeps are committed here, sanitized (`~` paths, no session
ids, credentials, or mailbox addresses). Workstation-facing sweeps are kept as
private operational receipts in the orchestrator briefs directory, outside
any repository; they are listed below by name only.

## Sweeps

| Key | Workstream | Headline counts (from INDEX.md) | Location |
| --- | --- | --- | --- |
| A-retire | A | Tracked removals: `tools/skillopt` 54 files, `plugins/*` 135, Impeccable payloads 154 + 149 (about 7 MB), `.ai` 1 empty file; Knip live references in about 60 non-history files; `Knip` is a required ruleset check | [`A-retire.md`](./A-retire.md) |
| A-patches | A | 5 retained patches, all applied; 2 with focused regression tests (platform filesystem, ONNX), 3 without (effect, xstate, drizzle) | [`A-patches.md`](./A-patches.md) |
| A-retained-tools | A | 9 surfaces checked; 6 pass live checks; Semgrep not run (needs Docker) and has no rule fixtures; `beep-effect.iml` 181 `excludeFolder` entries, 140 packet folders uncovered; harness ledger 32 KB, 19 rows | [`A-retained-tools.md`](./A-retained-tools.md) |
| B-standards | B | 129 files classified (56 `standards/`, 6 `.patterns/`, 67 `docs/`); `effect-vitest` 1,879 findings (741 open, 1,138 exceptions); schema-first 115 exceptions, backlog 0 | [`B-standards.md`](./B-standards.md) |
| C-scripts | C | 22 rows (21 checklist entries plus `scripts/graft`): 8 retain, 10 port or move, 3 retire or remove; 40 prunable graft patch files | [`C-scripts.md`](./C-scripts.md) |
| D-changesets | D | 941 tracked changesets, 939 pending notes; 152 workspaces, all private, all 404 on npm; no release tags | [`D-changesets.md`](./D-changesets.md) |
| E-github | E | 33 findings (1 P0, 5 P1, 10 P2, 17 P3); 11 workflows, 27 lane descriptors mapped | [`E-github.md`](./E-github.md) |
| F-agent-config | F | 37 skills, 7 agents, 21 Claude and 14 Codex hook commands, 11 `.mcp.json` servers; 4 clients share one Docker gateway (46 live tools); 12 model-default drifts | private operational receipt, orchestrator briefs directory (`F-agent-config.md`) |
| G-storage | G | 192 of 277 checkouts have `.beep` (6,706 MiB, 59,478 files); shared Turbo cache 2.37 GiB, 23,349 artifacts; 0 recorded remote hits | private operational receipt, orchestrator briefs directory (`G-storage.md`) |
| H1-catalog | H1 | 16 candidates: 13 removal candidates (plus dependent `pdfjs-dist`, 14 catalog lines; removed only after `rsc-h1-catalog`'s consumer check), 3 retained live `scratchpad/effect-ontology` consumers; 41 overrides, 6 patches, 11 overrides without a recorded reason; 3 OSV exceptions expire 2026-10-16 [erratum 2026-10-09] | [`H1-catalog.md`](./H1-catalog.md) |
| H2-goal-completion | H2 | Doctor: 211 packets, 0 blocking, 4 advisories; 110 non-grandfathered completed packets (73 / 29 / 5 pass by route, 3 fail) | [`H2-goal-completion.md`](./H2-goal-completion.md) |
| H3-telemetry | H3 | Stamped sessions 09-25..10-09: Claude 187 of 332, Codex 0 of 527, Cursor 0 of 10; Junie and Grok unsupported | private operational receipt, orchestrator briefs directory (`H3-telemetry.md`) |
| H4-desktop-permissions | H4 | 522 Codex rollouts scanned, 0 mid-session policy changes; 262 Claude Desktop session records | private operational receipt, orchestrator briefs directory (`H4-desktop-permissions.md`) |
| V-vitest-canon | V | 6 lanes; continuation holds 16 unpublished commits, 53-file delta (31 overlap `main`); 6 unstaged detector-resources files | [`V-vitest-canon.md`](./V-vitest-canon.md) |

## Critic gaps and follow-ups

The critic named 19 gaps; each got a read-only follow-up sweep, named by its
gap key.

| # | Gap key | Brief anchor | Answered by |
| --- | --- | --- | --- |
| 1 | A-knip-dispositions | 2.A Knip; stage 2 exit; 7 named candidates | [`A-knip-dispositions.md`](./A-knip-dispositions.md) |
| 2 | H1-syncpack-held-back | 2.H1 retained holds | [`H1-syncpack-held-back.md`](./H1-syncpack-held-back.md) |
| 3 | H1-override-evidence | 2.H1 hold records | [`H1-override-evidence.md`](./H1-override-evidence.md) |
| 4 | B-detector-false-positives | 2.B items 2-4; 4 Detector repairs | [`B-detector-false-positives.md`](./B-detector-false-positives.md) |
| 5 | B-inline-suppressions | 2.B items 2-5 honest zero debt | [`B-inline-suppressions.md`](./B-inline-suppressions.md) |
| 6 | B-skills-stale-api | 2.B stale guidance; 7 canonical authorities | [`B-skills-stale-api.md`](./B-skills-stale-api.md) |
| 7 | C-ownership-facts | 2.C; 4 Script ports | [`C-ownership-facts.md`](./C-ownership-facts.md) |
| 8 | F-measured-baseline | 2.F measure before and after | private operational receipt, orchestrator briefs directory (`F-measured-baseline.md`) |
| 9 | F-owned-fields-and-routes | 2.F items 2-3; 1 model assignments; 4 Global configuration | private operational receipt, orchestrator briefs directory (`F-owned-fields-and-routes.md`) |
| 10 | F-junie-grok-other-clients | 1 model assignments (Junie); 2.F client coverage | private operational receipt, orchestrator briefs directory (`F-junie-grok-other-clients.md`) |
| 11 | F-ledger-interview-link | 2.F item 7 | private operational receipt, orchestrator briefs directory (`F-ledger-interview-link.md`) |
| 12 | G-remote-artifact | 2.G Turbo step 2; 4 Cache | private operational receipt, orchestrator briefs directory (`G-remote-artifact.md`) |
| 13 | G-harness-cache-env | 2.G Turbo step 1 | private operational receipt, orchestrator briefs directory (`G-harness-cache-env.md`) |
| 14 | G-retention-preconditions | 2.G dry run and recoverable apply; 3 retention interface; 4 Storage | private operational receipt, orchestrator briefs directory (`G-retention-preconditions.md`) |
| 15 | H3-codex-lane-trust-and-drops | 2.H3 | private operational receipt, orchestrator briefs directory (`H3-codex-lane-trust-and-drops.md`) |
| 16 | H3-phoenix-read | 2.F evidence sources; 2.H3 | private operational receipt, orchestrator briefs directory (`H3-phoenix-read.md`) |
| 17 | H2-timeline-and-inherited-reds | 2.H2; 3 Goal completion | [`H2-timeline-and-inherited-reds.md`](./H2-timeline-and-inherited-reds.md) |
| 18 | H4-codex-config-and-rollout | 2.H4 | private operational receipt, orchestrator briefs directory (`H4-codex-config-and-rollout.md`) |
| 19 | V-other-worktrees-and-detector-delta | 1 existing work boundaries; 2.B item 6 | [`V-other-worktrees-and-detector-delta.md`](./V-other-worktrees-and-detector-delta.md) |

These sweeps are immutable research evidence for their recorded head. A lane
that relies on a head-dependent fact re-checks it at its own head.

## Errata

Corrections applied inline before the packet was first committed, each
marked `[erratum 2026-10-09]` at the corrected line.

1. `A-patches.md` "Documentation drift found": `osv-scanner.toml` does exist
   at the root (tracked at `e62411d63f`; SPEC.md and `H1-catalog.md` rely on
   its three exceptions expiring 2026-10-16). Only the claim that it holds no
   exception for the ONNX advisory stands.
2. `H1-override-evidence.md` commands list: the raw OSV JSON is a private
   operational receipt, not in this packet.
3. H1 headline counts: 13 of the 16 candidates are removal candidates (removed only after `rsc-h1-catalog`'s consumer check), plus the
   dependent `pdfjs-dist` catalog line and override (14 catalog lines); the
   other 3 candidates are retained as live `scratchpad/effect-ontology` consumers
   (consumer, owner, and reconsideration condition recorded).
4. `A-retire.md` hook rows for `.github/hooks/impeccable.json` and
   `.codex/hooks.json:60-70`: formatting-only fix; the `|` characters inside
   the matcher code spans are escaped so each row keeps its two cells (the
   `remove` disposition is unchanged).
