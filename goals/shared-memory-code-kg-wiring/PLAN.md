# Shared Memory & Code-KG Wiring Plan

## Status

Status: `complete` (closed 2026-08-06; see history/ for evidence)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inventory current memory wiring: where cognee is referenced (`AGENTS.md`, `standards/memory-architecture/`, `.mcp.json`, skills), current MCP surfaces per CLI, and the bake-off wiring plan (`~/YeeBois/research/codebase_graph_and_memory/BAKEOFF.md` §Wiring). | Facts recorded in `research/`; no contradictions with `SPEC.md`, or blockers filed. |
| P1 Implement | pending | Create `beep-shared` store (git-init, conventions README, four folders); add `basic-memory` + `codegraph` to `.mcp.json`; register both in Codex/Grok/Cursor (machine-local); `codegraph init` + gitignore `.codegraph/`; write `standards/memory-architecture/07-shared-memory-adoption.md`, amend `04-decision-log.md` + `README.md`; update `AGENTS.md` Agent Memory section. | `SPEC.md` acceptance criteria for wiring + docs are met. |
| P2 Verify | pending | Run the verification matrix: cross-agent round-trip (two different CLIs, fresh sessions), codegraph symbol + callers queries, `basic-memory doctor`, `bun run beep yeet verify`, regenerate `goals/INDEX.md`. | Verification green with evidence archived in `history/`, or blockers documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection, flip packet state, and set the pilot review reminder (2026-08-20). | Packet status and evidence are updated; a closeout reflection exists. |

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**,
   the **implementation**, and the **goal/prompt**. Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Pilot (post-close, not a phase)

Two-week pilot ends **2026-08-20**. Judge by: (a) agents actually recall
cross-CLI decisions in real sessions; (b) codegraph replaces grep-storms in
real work; (c) zero store corruption (`basic-memory doctor` stays clean).
Outcome routes to either "standardize" or a rollback note in
`standards/memory-architecture/04-decision-log.md`, and feeds the future
Effect-native `@beep/memory` packet.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- The external bake-off collection is read-only evidence — never edit it from
  this packet.
- `AGENTS.md` is prompt-cache prefix: batch its edit, keep it lean.

## Verification Commands

```sh
test "$(wc -m < goals/shared-memory-code-kg-wiring/GOAL.md)" -le 4000
jq . goals/shared-memory-code-kg-wiring/ops/manifest.json
rg -n "shared-memory-code-kg-wiring|GOAL.md|agentLaunchers|packetAnchorDocument" goals/shared-memory-code-kg-wiring
git diff --check -- goals/shared-memory-code-kg-wiring
```
