# Recorded QA Acceptance — dock-react gesture verification

Lifecycle: active

Campaign charter. End-to-end acceptance of the UI Verification System
(`beep qa` record → extract → judge) against the dock-react pointer-gesture
fixes, INCLUDING a falsification round proving the system catches a
deliberately re-introduced bug. The system is not "accepted" because it ran —
only because it demonstrably detects the defect class it was built for.

Started: 2026-07-30. Branch: `feat/recorded-qa-system`.
Plan of record: `~/.claude/plans/what-do-you-think-zany-lemon.md`.

## Locked decisions

| Decision | Value |
|---|---|
| Target surface | dock-react stories via `http://storybook.beep.localhost:1355/iframe.html?id=dock-dockviewreact--<story>&viewMode=story` |
| Fixes under test | `Sash.tsx` / `GroupPane.tsx` / `FloatingPane.tsx` pointerdown `preventDefault`, `pointercancel` reset, `touchAction`/`userSelect` hardening |
| Lanes | Lane A (playwright) for loop rounds; ONE Lane B (OBS + real Chrome) polish round — native selection escalation is exactly the Lane B class |
| Judge | codex-companion `gpt-5.6-sol` `--effort high`, read-only, `qa-inventory/v1` output via `beep qa judge-ingest` |
| Falsification | Revert patch of the Sash `preventDefault` hunk pre-saved in `ops/falsification/`; round-F runs provenance-flagged (`falsification: true`, scenario prefix `falsification:`), doubled strip density |
| Falsification pass bar | ≥ 1 P0/P1 `selection-smear` finding whose evidence refs point at mid-drag strip frames of the sash scenario; miss ⇒ system fails acceptance, tune extraction/lenses and repeat |
| Exit criteria | Falsification true-positive + two clean structured rounds on the fixed build (one Lane A, one Lane B) + `beep qa judge-lint` green on every round |
| `touchAction: none` | Not verifiable in desktop-Chrome frames — recorded as covered-by-code-review (honest gap; CDP touch-emulation is a future scenario) |
| Durable evidence | Inventories + timelines + ≤ 1 contact-sheet JPEG (≤ 300 KB) per proven scenario under `history/`; bulk artifacts stay in gitignored `.beep`, referenced from the PR body |
| Git | dock-react fixes land WITH this campaign; Yeet publish at convergence; no merge without user |

## Scenario table

| # | Gesture (story) | Fix under test | Artifact | Assertion |
|---|---|---|---|---|
| 1 | Slow sash drag across panel text (ConstrainedSash) | Sash pointerdown `preventDefault` | 12-frame mid-drag strip + sheet | No selection highlight in any mid-drag frame; `getSelection().isCollapsed` stays true |
| 2 | Sash drag + injected `pointercancel` at ~50 % (Workspace) | Sash `pointercancel` → atom reset | strip spanning cancel ± 4 frames | Post-cancel frames identical; subsequent pointermove causes no resize |
| 3 | Slow tab drag group A → B (Workspace) | GroupPane Tab `preventDefault` | strip + sheet | No native drag ghost, no selection smear; no `dragstart` in events |
| 4 | Float pane: header drag across text, then grip resize (Workspace) | FloatingPane `preventDefault` + hardening | strip per sub-gesture | No smear/ghost; pane translates by pointer delta only |
| 5 | Drop-quadrant hover sweep (DropQuadrants) | regression guard | sheet of hover previews | Preview appears in the frame where the cursor dot enters each zone |
| 6 | Escape mid tab-drag (Workspace) | regression guard | strip around Escape | Post-Escape layout matches pre-gesture frame |

## Falsification protocol (round-F)

1. Generate `ops/falsification/sash-preventdefault-revert.patch` from the
   committed fix (the `preventDefault` hunk only) BEFORE round 1.
2. Round 1..n: all fixes applied → drive to `requiredCount: 0` on motion lenses.
3. `git apply ops/falsification/sash-preventdefault-revert.patch` → run
   round-F (`falsification: true` in session provenance, 24-frame strips).
4. Pass/fail per the locked bar above. `git apply -R` to restore.
5. Final confirmation round → 0 required findings, twice (Lane A + Lane B).

## Evidence locations

- `history/rounds/round-N/` — `inventory.json`, `inventory.md`,
  `judge/timeline.md`, `report.md` copies per round.
- `history/evidence/` — the ≤ 300 KB proof sheets.
- `ledgers/findings.md` — cumulative findings ledger with resolution rounds.
