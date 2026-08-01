# Round 1 — Lane A (playwright) — 2026-07-30

- Commit under test: `d6761ae059` + user's in-flight dock-react working tree
  (dirty; Sash/GroupPane/FloatingPane/DockviewReact/DropCompiler/Gesture.models).
- Capture: 6 scenarios, `CAPTURE-FAILURES: 1`, 255 witness events, webm recorded.
- Clock sync: **beacon, high confidence, 11.1 ms residual** (least-squares over
  8 flips; reproduced twice at 11.1/11.2 ms).
- Extraction: 20 windows kept, 22 overlap-merged (expected for slow gestures),
  zero budget degradations after estimator calibration; 112 artifacts incl.
  per-gesture GIFs, strips, contact sheet; XMP-beepQA provenance verified
  round-trip on PNG + GIF; container tags on video.
- Judge pack: 106 files, 6.24 MB, 0 dropped (8 MB budget).

## Capture failure (real finding, confirmed by evidence)

`floating-drag-resize: grip resize grows the pane (320x252 -> 320x252)` —
the floating pane's corner grip resize produces NO geometry change under real
pointer input, while the header drag through the same gesture system works
(pane translates exactly by pointer delta, witness cursor ring visible in
mid-drag frames). All 26 dock-react jsdom tests pass — this is precisely the
"jsdom green is not click-works green" class. Mid-drag strips additionally
prove the fixes that ARE working: zero native selection smear in any frame
during sash/tab/floating drags.

Status: surfaced to Benjamin (owns the in-flight dock-react refactor;
gestureRef("resize") wiring is the suspect area). Not fixed by the campaign —
dock-react is user-owned working tree.

## System calibrations made from this round (committed 6970d5f3bd)

- GIF/frame byte estimator was 4-5x too conservative → every GIF degraded to
  strips; recalibrated against measured artifact sizes.
- Witness page-local seqs collide across navigations → collector now rewrites
  every accepted event with one canonical session-wide monotone seq.
- Provenance `sourceVideo` was absolute → session-relative.
- Known cosmetic: session viewport reports the default (1600x1000) rather
  than the harness viewport (1440x900) — extract could set it from the video
  probe; deferred to the quality pass.
