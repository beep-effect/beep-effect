# Lab Apps Lifecycle Plan

## Status

Status: `active` — P0 complete 2026-08-14 (PR #722); P1 complete 2026-08-16
(PR #723, delete-package + registration geometry merged as `e97f73be44`);
P2 next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Census ratification and geometry schema design | complete | Re-verify the registration-surface census (`research/02` §19, `research/05` §7) against the live tree; design the `RegistrationSurface` geometry schema and the labs identity-segment mechanism (SPEC D6/D8); ratify the exact gate-scoping entry list from `research/04`. | Geometry schema reviewed (schema-first skill loaded); census deltas recorded in `research/`; gate entry list ratified in this plan. |
| P1 Implement delete-package with doctor mode | complete | `beep delete-package` per `research/05` §9 (phases 0–10): dependents scan + refuse table, plan/dry-run/check, identity remove + orphan lint, workspace-literal remove, tsconfig-sync, lockfile, baseline regen, changeset policy. Doctor proves against a synthetic residue fixture built from the #680 classes (SPEC Track A); any matching live residue found at P1 time is swept in the same PR as a bonus. | Track A acceptance boxes in SPEC pass; PR mergeable via yeet. |
| P2 Implement apps/labs substrate and v1 variants | pending | One-time `apps/labs/*` glob + gate scoping PR; lab manifest schema + `beep labs list`; vite + service AppKinds (nextjs reused); GLOSSARY "lab app"; promotion runbook; scaffold the trustgraph-ts workbench lab shell. | Track B acceptance boxes (except tauri + round-trip) pass; PRs mergeable via yeet. |
| P3 Tauri lab variant (spike then land) | pending | Toolchain/CI spike (rust on runners, portless semantics for the webview, professional-desktop overlap), then land tauri as a lab AppKind on the existing templates. | Spike outcome recorded; tauri lab scaffolds and typechecks; PR mergeable. |
| P4 Verify create/delete round-trip | pending | Run the First Vertical Slice: vite lab scaffold → serve → delete → doctor green, clean tree. | Round-trip evidence recorded in `history/`; doctor green. |
| P5 Yeet: final PR to mergeable | pending | Publish remaining work through yeet and drive to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence updated; closeout reflection exists. |

Phase ids MUST match `ops/manifest.json` `phases[]` exactly. Each implement
phase (P1, P2, P3) ships as its own PR through yeet with the packet slug in
the PR title; P5 covers whatever residue closes the packet.

## P0 Outcomes (ratified 2026-08-14)

- **Census ratified:** `research/10-p0-census-ratification.md` recheck of
  every `research/02` §19 row and the `research/05` §7 derived-vs-committed
  table against the live tree, with deltas (retired-driver residue gone,
  `@beep/protobuf` removed by #690, `@beep/ontology` live-name/retired-name
  collision, fallow/vitest two-level app-glob gaps). The closed ten-kind
  geometry surface list is that report's final table.
- **Geometry designed:** `research/11-registration-geometry-design.md` —
  `RegistrationSurface` ten-kind tagged union + `RegistrationGeometryService`
  (forward/inverse/inspect), homed as a new `RegistrationGeometry` module
  (P1 creates it) under `packages/tooling/tool/cli/src/internal/cli/`;
  `dependentsOf` via inverted dependency index + E1/E15 scans. Holdout
  resolutions adopted per SPEC D5 ("by hand" + generated-labs-segment
  holdout clause): (A) labs excluded from root solution refs by path,
  (B) path-aware changeset-status wrapper in repo CLI, (C) generated
  contiguous labs identity segment + export block in `packages.ts`.
- **Gate entry list ratified:** the one-time P2 scoping set is exactly the
  fourteen edits in `research/12-p0-gate-scoping-ratified.md` (8 mechanical,
  2 trivial, 4 needs-design, all design-bounded by report 11) plus that
  report's explicit no-edit ratifications. Per-lab create/delete must not
  grow it.
- **Standards drafts archived** (not landed) at
  `history/p0-standards-drafts/` — GLOSSARY/DECISIONS/doctrine land in P2
  per SPEC Target Surfaces.

## P1 Outcome (merged 2026-08-16)

PR #723 (`e97f73be44`): `beep delete-package` with dry-run/check/doctor and
the full §9.4 refuse table (`--force` never overrides dependents), the
private `RegistrationGeometry` module (ten-kind `RegistrationSurface` union,
forward/inverse/inspect service, `dependentsOf` with identity-accessor
scanning), identity removal + orphan-composer lint, and 28 tests including
the synthetic #680 residue fixture. Implementation record:
`history/p1-implementation-notes.md`. Track A acceptance boxes pass via the
synthetic fixture and refuse-table tests; the LIVE zero-consumer
create→delete round-trip is deliberately deferred to P4's First Vertical
Slice, which the SPEC designates as that proof's gate.

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
