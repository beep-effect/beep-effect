# Lab Apps Lifecycle Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Census ratification and geometry schema design | pending | Re-verify the registration-surface census (`research/02` §19, `research/05` §7) against the live tree; design the `RegistrationSurface` geometry schema and the labs identity-segment mechanism (SPEC D6/D8); ratify the exact gate-scoping entry list from `research/04`. | Geometry schema reviewed (schema-first skill loaded); census deltas recorded in `research/`; gate entry list ratified in this plan. |
| P1 Implement delete-package with doctor mode | pending | `beep delete-package` per `research/05` §9 (phases 0–10): dependents scan + refuse table, plan/dry-run/check, identity remove + orphan lint, workspace-literal remove, tsconfig-sync, lockfile, baseline regen, changeset policy. Doctor fails on the live #680 residue; fix that residue in the same PR. | Track A acceptance boxes in SPEC pass; PR mergeable via yeet. |
| P2 Implement apps/labs substrate and v1 variants | pending | One-time `apps/labs/*` glob + gate scoping PR; lab manifest schema + `beep labs list`; vite + service AppKinds (nextjs reused); GLOSSARY "lab app"; promotion runbook; scaffold the trustgraph-ts workbench lab shell. | Track B acceptance boxes (except tauri + round-trip) pass; PRs mergeable via yeet. |
| P3 Tauri lab variant (spike then land) | pending | Toolchain/CI spike (rust on runners, portless semantics for the webview, professional-desktop overlap), then land tauri as a lab AppKind on the existing templates. | Spike outcome recorded; tauri lab scaffolds and typechecks; PR mergeable. |
| P4 Verify create/delete round-trip | pending | Run the First Vertical Slice: vite lab scaffold → serve → delete → doctor green, clean tree. | Round-trip evidence recorded in `history/`; doctor green. |
| P5 Yeet: final PR to mergeable | pending | Publish remaining work through yeet and drive to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence updated; closeout reflection exists. |

Phase ids MUST match `ops/manifest.json` `phases[]` exactly. Each implement
phase (P1, P2, P3) ships as its own PR through yeet with the packet slug in
the PR title; P5 covers whatever residue closes the packet.

## P6 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`, and record `mergedPullRequest`.

## Execution Notes

- Load the `schema-first-development` skill before P0 geometry/manifest
  schema work and `effect-first-development` before P1/P2 CLI work.
- SPEC Decision Log D1–D14 is operator-ratified and locked — implement,
  don't re-litigate. Research amendments listed under the Decision Log are
  adopted requirements.
- Split tripwire (SPEC D11): if a track grows a second primary, mark its
  phase `superseded` with `supersededBy` pointing at a sibling packet
  (`ci-fleet-endgame` precedent). Do not widen this packet.
- Preserve unrelated worktree changes; never `git add -A`.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/lab-apps-lifecycle/GOAL.md)" -le 4000
jq . goals/lab-apps-lifecycle/ops/manifest.json
rg -n "lab-apps-lifecycle|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lab-apps-lifecycle
git diff --check -- goals/lab-apps-lifecycle
```
