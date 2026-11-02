# Effected kit promotion

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Promote the ported `scratchpad/effected` kit into dedicated `@beep/*` packages
placed per `standards/ARCHITECTURE.md`, then retire the one-off modules,
tooling and third-party dependencies they replace, ending the repo's
dependence on the upstream `@effected/*` maintainer.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effected-promotion/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Complete. Every wave and adoption row of [`PLAN.md`](./PLAN.md) merged
before C, R3b (the `jsonc-parser` drop) last. C, the closing PR (#2476),
deleted and unwired the `scratchpad/effected` lab, archived its notes, the
deferred modules' port reviews and canon exceptions under
[`history/`](./history/), pinned the deferred modules by sha (PLAN
"Deferred") and proposed the closeout (`proposedCloseout` in
[`ops/manifest.json`](./ops/manifest.json), SPEC D-60). It merged as
`a0589d263d` from head `b55670b020` with every required context green, and
`bun run beep goals completion refresh --slug effected-promotion` verified the
`completed-retained` proposal on 2026-11-01
([`history/completion-verified-2026-11-01.md`](./history/completion-verified-2026-11-01.md)).
`initiative.status` reads `active` because completion is derived from
clone-scoped receipts rather than written into the manifest (SPEC D-61).
P0 research:
[`research/promotion-map-2026-10-20.md`](./research/promotion-map-2026-10-20.md),
[`research/wave-2b-plan-2026-10-21.md`](./research/wave-2b-plan-2026-10-21.md),
[`research/wave-2d-plan-2026-10-22.md`](./research/wave-2d-plan-2026-10-22.md)
and [`research/wave-4-plan-2026-10-23.md`](./research/wave-4-plan-2026-10-23.md)
(its "Closeout definition of done" was C's checklist).

## Latest Evidence

- 2026-10-20 discovery workflow: 34-row package map (30 now, 4 deferred), 6
  waves, 312 deduplicated reuse sites (29 confirmed, 209 partial, 74 refuted),
  three scored `@beep/md` merge designs.
- Decisions D-01..D-60, W3-a..W3-n and W4-a..W4-aa are in [`SPEC.md`](./SPEC.md).
- 2026-11-01 C: the lab (`scratchpad/effected/**`, 164 files) and its six
  `scratchpad/test` directories (143 files) are deleted with their wiring;
  every deferred module and `PORT_LEDGER.json` is pinned at
  `bb2134fcb952e07580c4cebf2586c901f090ef5b` (SPEC D-60).
- 2026-11-01 C (#2476): `quality package-verify` passed for all 20 touched
  packages and `yeet final-check` passed on `e75c1447b9`; the `--until-ready`
  monitor reported every hard merge criterion green.
- 2026-11-01 completion verified: #2476 merged as `a0589d263d` from accepted
  head `b55670b020` (15 green required contexts, rule suite 4842945018), and
  `goals completion refresh` wrote a `verified` receipt in the clone that ran
  the until-ready job (`history/completion-verified-2026-11-01.md`). Phases P3
  and P4 were marked complete on 2026-11-02 once `goals doctor` stopped forcing
  a phase in-progress on proposed closeouts (#2489).

## Notes

- Port provenance: `bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/EFFECTED_PORT_GOAL.md` and
  `bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/effected/PORT_LEDGER.json` (read with `git show`), the
  per-module review reports under `history/port-reviews/`, the canon exceptions under
  `history/canon-exceptions/` and the lab notes under `history/lab-archive/`.
- Deferred modules left the lab at C, pinned by the last sha that holds them (D-05 as amended by
  W4-m; see the PLAN "Deferred" section for each restore command).
