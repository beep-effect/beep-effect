# Verification Route Plan

## Status

Status: `pending`. Graduated 2026-10-28 from `explorations/verification-route`
(16 rulings). Each slice is one PR through Yeet; phase ids match
`ops/manifest.json`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Slice 1: schemas, route, census | pending | `ChangeAtom`/`CheckFootprint`/`Propagation` schemas, the total record at `unknown`, `classify`, `route`, the corpus fetch, `beep ci route plan|census|replay`. | Slice-1 acceptance rows in `SPEC.md` green; the census printed with the `unknown` share; PR merged. |
| P1 Slice 2: refinements, both layers, final-check | pending | Refine in census rank with fixtures and recall; compile file/field-grain footprints to turbo inputs and root `package.json` projections; sweep package-local `turbo.json`; final-check shadow then enforced; sentinel row. | At least one refinement enforced; layer-1 fixture green under pinned turbo; receipts carry the route section; PR merged. |
| P2 Slice 3: hosted per lane | pending | Extend `HeavyAdmission` to per-lane `skip-satisfied` with the receipt in the job summary. | A real PR shows a routed-out lane completing `skip-satisfied`; required contexts unchanged; PR merged. |
| P3 Yeet: PR to mergeable | pending | Each slice PR through `yeet publish`, `final-check`, `ready`, `monitor --until-ready`. | `merge-ready: yes`; zero unresolved review threads. |
| P4 Close | pending | Closeout reflection, status flip, proposedCloseout on the final PR. | Reflection lints green; manifest, README and PLAN agree. |

## Sequencing

P0 before P1 (the census ranks the refinements). P1 before P2 (hosted enforces
nothing until a local refinement has clean recall). The cut line is P0: its
census is the deliverable even if P1 and P2 slip. Gated MAP candidates
(`proof-key-footprint`, `pre-push-route`, `symbol-grain-propagation`,
`per-law-footprints`) re-enter the exploration at decompose; none is this plan's
work.

## P0 — Slice 1

- [ ] Schemas in `commands/Ci/`: `ChangeAtomKind` (LiteralKit), `ChangeAtom`,
      `Propagation`, `CheckFootprint`, the total record; totality test.
- [ ] `classify`: semantic atoms for `package.json` (field families: scripts,
      catalog, dependencies, devDependencies, patchedDependencies,
      trustedDependencies, workspaces, engines, other), `bun.lock` (one
      `lockfile` kind, package-grain), `turbo.json`, `tsconfig*`, `biome.jsonc`,
      workflow YAML; path atoms with owning package elsewhere; `unknown`.
- [ ] `route`: `Required(Δ)` over turbo's package graph (`--dry-run=json`
      dependencies) then `WaveOrder.order`.
- [ ] Corpus fetch: hosted PR Check runs since 2026-09-01 by head sha
      (`capture_hosted` recipe ported), `refs/pull/N/head`, main push runs for
      base-green, digest-pinned receipts, resume by head.
- [ ] `beep ci route plan|census|replay` (`--json`), A1 cost source per lane.
- [ ] Friction receipts in the exploration's `research/OPPORTUNITIES.md`.

## P1 — Slice 2

- [ ] Rank refinements from the census; first candidates by expectation:
      `pkg:catalog`/`pkg:dep-version` vs `build`/`check`/`test`, `docs:markdown`
      vs everything but docgen/jsdoc, `src:test` vs `build`.
- [ ] Mutation fixtures per claimed-absent kind on the production path.
- [ ] Layer 1: task-input negations plus the root `package.json` field
      projections written by the prepare phase (tracked generated files,
      drift-checked by the codegen lane); sweep the 21 package-local
      `turbo.json`; pin turbo 2.11.10 in the fixture.
- [ ] final-check: route section in the receipt; shadow sentinel inbox row;
      enforcement flag per refinement, revocable.
- [ ] Note the proof-ledger key change in the receipt.

## P2 — Slice 3

- [ ] `HeavyAdmission` per lane: `run | skip-satisfied | hold` from the route;
      `heavy.yml` lane jobs compute the route and complete with the receipt.
- [ ] Prove on one real PR; ruleset contexts unchanged.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Sub-agents follow the AGENTS.md volume pools.

## Verification Commands

```sh
test "$(wc -m < goals/verification-route/GOAL.md)" -le 4000
jq . goals/verification-route/ops/manifest.json
rg -n "verification-route|GOAL.md|agentLaunchers|packetAnchorDocument" goals/verification-route
git diff --check -- goals/verification-route
bun run beep quality package-verify @beep/repo-cli
bun run beep ci route plan --json
bun run beep ci route census --json
bun run beep ci route replay --json
```
