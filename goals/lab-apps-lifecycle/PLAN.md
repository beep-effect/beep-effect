# Lab Apps Lifecycle Plan

## Status

Status: `active` — P0 complete 2026-08-14 (PR #722); P1 complete 2026-08-16
(PR #723, delete-package + registration geometry merged as `e97f73be44`);
P2 complete 2026-08-17 (substrate PR #732 merged as `afe4cdfaa7`, plus the
lab-minting PR that scaffolded `apps/labs/trustgraph-workbench`); P3 complete
2026-08-17 (tauri lab AppKind, PR #752 merged as `bd577ed8bc`); P4 complete
2026-08-17 (First Vertical Slice proven live); P5 next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Census ratification and geometry schema design | complete | Re-verify the registration-surface census (`research/02` §19, `research/05` §7) against the live tree; design the `RegistrationSurface` geometry schema and the labs identity-segment mechanism (SPEC D6/D8); ratify the exact gate-scoping entry list from `research/04`. | Geometry schema reviewed (schema-first skill loaded); census deltas recorded in `research/`; gate entry list ratified in this plan. |
| P1 Implement delete-package with doctor mode | complete | `beep delete-package` per `research/05` §9 (phases 0–10): dependents scan + refuse table, plan/dry-run/check, identity remove + orphan lint, workspace-literal remove, tsconfig-sync, lockfile, baseline regen, changeset policy. Doctor proves against a synthetic residue fixture built from the #680 classes (SPEC Track A); any matching live residue found at P1 time is swept in the same PR as a bonus. | Track A acceptance boxes in SPEC pass; PR mergeable via yeet. |
| P2 Implement apps/labs substrate and v1 variants | complete | One-time `apps/labs/*` glob + gate scoping PR; lab manifest schema + `beep labs list`; vite + service AppKinds (nextjs reused); GLOSSARY "lab app"; promotion runbook; scaffold the trustgraph-ts workbench lab shell. | Track B acceptance boxes (except tauri + round-trip) pass; PRs mergeable via yeet. |
| P3 Tauri lab variant (spike then land) | complete | Toolchain/CI spike (rust on runners, portless semantics for the webview, professional-desktop overlap), then land tauri as a lab AppKind on the existing templates. | Spike outcome recorded; tauri lab scaffolds and typechecks; PR mergeable. |
| P4 Verify create/delete round-trip | complete | Run the First Vertical Slice: vite lab scaffold → serve → delete → doctor green, clean tree. | Round-trip evidence recorded in `history/`; doctor green. |
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
`history/p1-implementation-notes.md`. Track A acceptance boxes all pass:
the synthetic #680 fixture and refuse-table tests in CI, and the LIVE
zero-consumer create→delete round-trip executed 2026-08-16
(`history/p1-track-a-round-trip.md`) — which caught and fixed one doctor
bug (the pending-changeset probe flagged its own `{}` deletion note as
residue). P4's First Vertical Slice remains the separate Track B lab
round-trip gate.

## P2 Outcome (2026-08-17)

Shipped as two PRs, per the substrate-then-lab split.

**PR #732 (`afe4cdfaa7`) — substrate.** All fourteen ratified gate-scoping
edits from `research/12`, plus the thirteen explicit no-edit ratifications
held (`.changeset/config.json`, `knip.jsonc`, `biome.jsonc`, `lefthook.yml`,
`Lint.schemas.ts`, `PackageTestTypecheck.ts`, storybook config untouched).
The frozen 16 required contexts are unchanged and `Labs` lands permanently
non-required. Landed with 22/22 checks green.

**Lab-minting PR — the D13 acceptance proof.**
`apps/labs/trustgraph-workbench` scaffolded through the shipped tooling with
no hand edits, which discharges two SPEC Track B boxes at once:

- *"mints labs that pass `beep:check`, `beep:lint`, `beep:test` out of the
  box"* — measured on the generated lab: check exit 0, lint
  "Checked 12 files … No fixes applied", test 1/1 passed.

  The Track B criterion covers Next.js, Vite, and service labs, and the
  Vite lab alone does not discharge it. Minting throwaway `nextjs-probe`
  and `service-probe` labs and running all three gates against each found
  **three of six failing**: nextjs `lint` 1; service `check` 1 and `lint`
  1. Deleting the probes surfaced a fourth, from Fallow's unused-export
  gate. All four were generator defects, not lab defects:

  | variant | gate | before | cause |
  | --- | --- | --- | --- |
  | nextjs | lint | 1 | tsconfig `include` emitted multi-line |
  | service | lint | 1 | same |
  | service | check | 1 | bare `yield*` on `Layer.launch` (TS377006); mid-pipeline `Effect.provide` (TS377032) |
  | service | fallow | 1 | `ApiGroup` exported with no importer |

  Re-minting both variants through the fixed generator returns
  check/lint/test = 0 across all six gates. The formatting class is now
  closed structurally rather than by hand-tuning emitted arrays:
  `create-package` runs `biome check --write` over the generated tree as
  an advisory pass.
- *D5 zero-root-churn, proven live rather than argued.* The mint's entire
  footprint outside the lab tree is the generated identity segment
  (`generatedLabComposers = {}` → `$I.compose("trustgraph-workbench")`, strictly
  inside the fenced markers) and `bun.lock`. Root `package.json`,
  `tsconfig.json`, `syncpack.config.ts`, `vitest.config.ts` and
  `.changeset/config.json` are untouched — create-package reported
  `workspaces: SKIP (already covered by an existing workspace entry)`.

Five defects found by a 30-agent conformance audit of #732 were fixed in the
minting PR, because each one only bites once a lab exists: ratified row 7's
second half (lab templates still emitted a `coverage` script — fixed in #732
itself); `--reuse-retired-name` never removing the registry entry, which would
wedge the later delete; row 13's missing `apps/labs/*/src/main.ts` Fallow entry
glob for the `service` AppKind; `--parent-dir apps/labs` without `--lab`
bypassing every lab construction rule; and lab dependency tables declaring
workspace packages no emitted file imports, which would fail the required Knip
context on the first lab.

## P3 Outcome (2026-08-17)

**Spike result: the CI half of D4's toolchain question is a non-issue.** The
Labs lane (`CiLane.ts:923`) runs one bundled `turbo run check lint test` over
the labs glob, and no lab script invokes cargo. The repo's only Rust toolchain
step (`check.yml:358`) is path-gated to `apps/professional-desktop/**` plus the
shared-toolchain files, so it never fires for `apps/labs/**`. A full local lane
replay with two labs present: **22 tasks, 22 successful, 19.9s, zero cargo
invocations**. A tauri lab therefore adds no Rust time to any lane, required or
not — the `dev:tauri` script is a developer-local affordance.

Tauri already existed as a non-lab AppKind with all fourteen templates, so P3
reduced to lifting one refusal guard — except that executing the gates per
variant (the P2 lesson) found the templates emit a crate that **does not
compile**:

| probe | gate | before | after |
| --- | --- | --- | --- |
| lab | check / lint / test | 0 / 0 / 0 | 0 / 0 / 0 |
| lab | `cargo check` | **101** | 0 (22s) |
| non-lab | check / lint / test | 0 / 0 / 0 | 0 / 0 / 0 |
| non-lab | `cargo check` | **101** | 0 (22s) |

`tauri::generate_context!()` opens `src-tauri/icons/icon.png` while the macro
expands. The template emitted `"icon": []` and no icons directory, so every
generated Tauri crate — lab and non-lab alike, since the templates are shared —
panicked at build time. Measured, not argued: as generated → 101; with
`bundle.active: false` → still 101; with an icon present → 0. The defect
predates this packet and survived because the three gates that run are the
three gates that cannot compile Rust.

Two template defects fixed, and one mechanism added:

- **The icon is now a generated file.** Being binary, it cannot pass through
  the Handlebars string renderer, so `create-package` gained a verbatim
  asset-copy path (`StaticAssetSpec` → `PlannedAsset` → the `copy-asset`
  generation action). The tests assert the emitted PNG's signature bytes, not
  merely its existence — a string round-trip would corrupt exactly those bytes.
- **`devUrl`/`devCsp` now use `{{portlessLabel}}`.** They hardcoded
  `<name>.beep.localhost:1355`, so a lab's webview pointed at a host its own
  `dev` script never serves (`<name>.labs.beep`). Both variants verified.

The create→delete round-trip was also exercised on the heaviest variant: delete
reported "zero declared residue" and swept 1.1 GB of gitignored `src-tauri/target`
plus `gen/` and `Cargo.lock`, leaving `standards/` untouched. That is a bonus
data point, not P4 — the First Vertical Slice remains the specified vite loop.

## P4 Outcome (2026-08-17)

The First Vertical Slice ran live on `main` at `bd577ed8bc`; full evidence in
`history/p4-first-vertical-slice.md`. Scaffold → four gates → portless serve →
delete → doctor, each leg producing measured output.

D5 held again: the mint's whole footprint outside the lab tree was `bun.lock`
and the fenced identity segment. Gates were check/lint/test/build = 0. The
serve leg — the one thing P3's tauri round-trip did not cover — resolved on
`https://round-trip-probe.labs.beep.localhost:1355`, the `.labs.beep` segment
D1 requires, returning the lab's own document and compiling its TSX through the
proxy (the transformed module's `_jsxFileName` named the probe's own source
directory under the labs root, which no longer exists). Delete
swept the tree including 2.9 MB of gitignored `dist/` + `node_modules/`, and
the deleted-target doctor probe reported **"clean: no registration residue
remains"** with `git status` empty.

One operational defect surfaced, recorded as ledger receipt 9: an unscoped
delete's baseline regeneration **exceeds ten minutes** and, when interrupted,
leaves six `standards/` files rewritten by ~49k lines of drift that is not
probe removal at all — a lab minted after `HEAD` never entered a committed
baseline, so regenerating repo-wide to remove it is wasted work by
construction. Every prior probe cycle in this packet passed
`--skip-baselines`, which is why the cost stayed invisible until a phase
deliberately declined it.

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
