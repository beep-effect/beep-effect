# Findings ledger — recorded-qa-acceptance

Cumulative across rounds. IDs follow `qa-inventory/v1` (`R<round>-<nn>`;
falsification-round ids never count as product findings).

| ID | Severity | Lens | Title | Found | Resolved | Notes |
|---|---|---|---|---|---|---|
| R1-01 | P1 | floating-chrome | Floating resize grip translates the pane without resizing it | R1 | **resolved (FU-R5)** | ROOT CAUSE: harness selector, not product. `"[data-floating-resize], [data-floating-grip]"` resolved `.first()` in DOM order to the header's grip glyph — the recorded "resize" dragged the header in move mode. Product resize path verified working under real input (follow-up rounds; harness asserts +140/+100 growth). Fixture-realism class. |
| R1-02 | P1 | cancel-reset | Escape cancellation leaves the dragged Brief tab activated | R1 | **resolved (FU-R5)** | Real: jsdom repro red on merged main (the release's trailing click activates via the capture target). Fixed via `TabDrag.concluded` — promoted drags conclude and keep their record until the trailing click is swallowed or the next press heals it; unpromoted presses keep plain-click semantics. Successor focus-leak (FU-R2-02) fixed by Escape handing focus to the group's active tab. |
| R1-03 | P2 | overflow | Drag label is clipped at the right and bottom viewport edges | R1 | **resolved (FU-R5)** | Ghost label ellipsis-capped at 240px; edge flip triggers exactly when the far edge would cross the container and the flipped side clamps against left/top. |

## Follow-up findings (post-merge worktree rounds; see `history/rounds/followup-notes.md`)

| ID | Severity | Lens | Title | Found | Resolved | Notes |
|---|---|---|---|---|---|---|
| FU-R1-02 | P1 | drop-preview | Bottom drop preview spans both panels instead of the target group | FU-R1 | resolved (FU-R5) | 32px root-split band shadowed edge-adjacent groups' quadrants; `ROOT_EDGE_BAND_PX = 8`. Design tradeoff ledgered: 8px root target has no Fitts pinning when the dock edge is not a screen edge — proper fix is dedicated root drop overlay targets (user decision). |
| FU-R2-01 | P1 | cancel-reset | Pointer cancellation leaves the sash in its active drag state | FU-R2 | resolved (FU-R5) | Synthetic pointercancel skips the implicit capture release AND carries a default pointerId. Cancellation now releases the pointerId recorded at the press (`SashDragBase.pointerId`, `TabDrag.pointerId`). Re-observed as FU-R4-01 until the stored-id half landed. |
| FU-R2-02 | P1 | cancel-reset | Escape leaves focus on the cancelled dragged tab | FU-R2 | resolved (FU-R5) | The press's `node.focus()` had no cancel counterpart; Escape now restores focus to the group's active tab (roving-tabindex invariant). |

Adversarial code-review wave (3 lenses over the fix diff) contributed: stale
concluded-record healing on next press (touch/pen releases produce no click),
unpromoted-press Escape keeping plain-click semantics, commit-path trailing
click conclusion, and the exact-geometry ghost flip. All folded into FU-R5.

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
