# History Message Overlay

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Latest evidence

- Final PR [#2785](https://github.com/beep-effect/beep-effect/pull/2785): map at
  `docs/history/commit-message-map.json` (940 rows), `beep history notes --check
  | --write | sync`, bootstrap hooks, `.github/workflows/history-notes-publish.yml`,
  and the July cutover folder archived to `$HOME/.local/state/beep/archive/beep-effect-cutover/`.
- `--write` is deterministic (same notes commit from any prior ref state); a
  scratch-ref run matched 940/940 under `--check --require-published`.
- Post-merge proof (2026-11-07): `History Notes Publish` run 42339731476 on
  `12ba0fe044` published `refs/notes/history` at `b40fd076d8`, the same commit
  the pre-merge scratch `--write` produced. `sync` then `--check
  --require-published`: 940 notes, 940 match. `git log 6f33208961` shows
  `Notes (history):` under the original subject.
- Completed 2026-11-07: completion verified on final PR #2858, adopted as
  `completed-retained`.
- Re-final PR [#2858](https://github.com/beep-effect/beep-effect/pull/2858): #2785
  merged before its readiness monitor recorded merge-ready, and its rendered lane
  names tripped `knowledge:semantic-delta` on main; #2858 fixes both.
- Reflection: [`history/reflections/2026-11-06-claude.md`](./history/reflections/2026-11-06-claude.md).

## Mission

History Message Overlay (graduated from explorations/git-history-rewrite).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/history-message-overlay/GOAL.md
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

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
