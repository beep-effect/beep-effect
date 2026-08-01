# Findings ledger — recorded-qa-acceptance

Cumulative across rounds. IDs follow `qa-inventory/v1` (`R<round>-<nn>`;
falsification-round ids never count as product findings).

| ID | Severity | Lens | Title | Found | Resolved | Notes |
|---|---|---|---|---|---|---|
| R1-01 | P1 | floating-chrome | Floating resize grip translates the pane without resizing it | R1 | open | Judge diagnosis sharper than the harness assertion: the grip gesture falls through to the MOVE path. Suspect: gesture-mode discrimination in the in-flight `Gesture.models.ts`/`FloatingPane.tsx` refactor (header `move` works; `resize` does not). jsdom suite (26 tests) green — real-input-only defect. Owner: Benjamin (dock-react WIP). |
| R1-02 | P1 | cancel-reset | Escape cancellation leaves the dragged Brief tab activated | R1 | open | Layout membership restores but the dragged tab's ACTIVATION leaks — harness compared panel→group mapping only; the judge saw the active-tab state change in post-Escape frames. Owner: Benjamin (dock-react WIP). |
| R1-03 | P2 | overflow | Drag label is clipped at the right and bottom viewport edges | R1 | open | Pointer-adjacent drag label overflows the viewport near edges; judge suggests clamping/flipping the overlay placement. |

## Falsification record (rounds 99, 98, 97 — 2026-07-30)

Sash selection-defense revert (`ops/falsification/sash-selection-defense-revert.patch`:
removes `preventDefault` AND `touchAction`/`userSelect` hardening, keeps the
orthogonal `pointercancel` fix). Three Lane-A attempts with progressively tuned
drag paths (mid-height → fixed text offset → text-anchored Y): the native
selection smear did NOT reproduce — `getSelection()` stays collapsed and no
highlight appears in any mid-drag frame, with ALL defenses removed.

**Conclusion (system boundary, verified 3×):** playwright's CDP-synthesized
pointer stream does not anchor native text selections in headless Chromium.
The selection-smear defect class is reproducible ONLY under native input —
which is exactly how the original bug shipped past every synthetic test, and
why Lane B (OBS + real Chrome) exists. The Lane-A falsification bar is
therefore amended (see README): Lane A true-positive capability is proven by
live fire — the judge caught R1-01 and R1-02, two real P1 defects invisible
to harness assertions — and the selection-smear falsification moves to the
Lane B round. Sash restored byte-identical after every attempt (md5-verified).
