# Follow-up rounds — post-merge fix campaign (2026-07-31/08-01)

Recorded in the `recorded-qa-followup` worktree against merged `main`
(`c21fb7bb6a`, after PR #519 landed its gesture rework and PR #521 landed the
QA system). Worktree round numbers restart at 1; they are campaign rounds
2–6. Round 3 has no judge verdict: its fixes were superseded mid-flight by
the adversarial code-review wave before judging.

| Worktree round | Purpose | Harness | Judge |
|---|---|---|---|
| 1 | Re-verify R1-01/02/03 against merged main | 1 failure (grip resize) | 3 findings (2 P1, 1 P2) |
| 2 | First confirmation after fix wave 1 | green | 2 P1 (cancel-reset lens) |
| 3 | Fix wave 2 (superseded by review findings before judging) | green | — |
| 4 | Confirmation after concluded-semantics rework | green | 1 P1 (sash capture) |
| 5 | **Clean confirmation** | green | **0 findings, judge-lint + cross-check ok** |

## What each layer caught

- **Harness selector bug (was "R1-01")**: the original grip locator
  `"[data-floating-resize], [data-floating-grip]"` resolved `.first()` in DOM
  order to the HEADER's grip glyph, so every recorded "resize" dragged the
  header in move mode. The product resize path was sound all along — the
  judge's round-1 "falls through to the move path" described exactly what the
  wrong element produced. Fixture-realism class.
- **Escape activation leak (was "R1-02")**: real. Confirmed with a jsdom repro
  red on merged main (round 2's scenarios all dragged already-active tabs, so
  the leak had nothing to leak — scenario-state blindness). Fixed via
  `TabDrag.concluded`: any promoted drag (Escape-cancelled or committed)
  concludes and keeps its record until the release's trailing click is
  swallowed or the next press heals it; unpromoted presses clear outright so
  plain clicks still activate.
- **Focus leak (FU-R2-02)**: one level beneath activation — the press's
  `node.focus()` had no cancel counterpart. Escape now hands focus to the
  group's active tab (roving-tabindex invariant, kernel-derived).
- **Drop preview spanning the container (FU-R1-02)**: the 32px root-split
  band shadowed the bottom/right quadrants of edge-adjacent groups;
  `ROOT_EDGE_BAND_PX = 8` returns those zones to the hovered group.
- **Sash stuck after synthetic pointercancel (FU-R2-01/FU-R4-01)**: two-layer
  fix — cancellation must release pointer capture (synthetic cancels skip the
  implicit release), and it must release the pointerId **recorded at the
  press** (`SashDragBase.pointerId`/`TabDrag.pointerId`), because synthetic
  cancel events carry a default pointerId, not the captured one.
- **Ghost clipping (was "R1-03")**: ellipsis cap (240px) bounds the label so
  the edge flip triggers exactly when the far edge would cross the container
  and the flipped side clamps against the left/top edges.

## Open design question (deliberate, user decision)

`ROOT_EDGE_BAND_PX = 8` makes pointer-driven root-edge docking an 8px target
whenever the dock edge does not coincide with a physical screen edge (no
Fitts pinning). The band cannot widen without re-shadowing group quadrants —
the affordances overlap geometrically. The proper resolution is dockview-style
dedicated root drop overlay targets rendered during drag; ledgered as a
follow-up product decision, not regressed here.

## Verification inventory

- jsdom: 28/28 (`Gestures.test.tsx` + suites), including three new regression
  tests: Escape-activation leak, cross-group-drop record conclusion + healing,
  focus restore.
- Adversarial review workflow (3 lenses, 9 raw findings → 4 real): all
  absorbed; see PR description.
- Lane A judge: round-5 inventory `requiredCount: 0`, judge-lint green,
  evidence cross-check ok, beacon clock sync 11.3 ms RMS (high).
