# Frame ↔ event correlation

## The mapping

From `session.json`:

```json
"clockSync": { "method": "beacon", "slope": 1.0, "offsetMs": -1753900012345.2,
               "residualRmsMs": 11.4, "confidence": "high" }
```

- event → video: `videoMs = slope * tEpochMs + offsetMs`
- video → event: `tEpochMs = (videoMs - offsetMs) / slope`

Frame index → video time needs the source fps: `ffprobe -select_streams v:0
-show_entries stream=r_frame_rate <video>`. For an extracted strip, DON'T
divide by source fps — strips are extracted at explicit timestamps; each
frame's own `XMP-beepQA:capturedAtEpochMs` (or the extraction manifest's
`timestampSeconds`) is authoritative.

## Worked example

Finding: "selection highlight during sash drag".

1. `events.ndjson`:
   `{"seq":141,"kind":"pointer-down","tEpochMs":1753900015651,"selectorPath":"[data-qa=sash-3]",...}`
   `{"seq":158,"kind":"pointer-up","tEpochMs":1753900017102,...}`
2. Drag window per default rules: `[down−100ms, up+300ms]` →
   epoch 1753900015551 … 1753900017402.
3. Via offsetMs → video 3.206 s … 5.057 s.
4. Strip frames were extracted across that window; frame 12's provenance
   says `capturedAtEpochMs=1753900016214` → 563 ms into the drag — mid-drag,
   pointer buttons still down (`pointer-move` seqs 144–156 bracket it).
5. Claim: frames 12–15 (t≈3.87–4.12 s video, 563–813 ms into the drag) show
   the smear; seq refs 141–158.

## Tolerances

| Method and confidence | Evidence interpretation |
|---|---|
| beacon, high | Fit residual RMS ≤25 ms with at least four matched beacon pairs. Use recorded frame timestamps; this is not a single-frame accuracy guarantee. |
| beacon, medium | Fit residual RMS ≤80 ms when the high criteria are not met, with at least three matched pairs. Prefer gesture-window claims; precise transition timing needs additional evidence. |
| obs-record-state, medium | Uses the reported recording-start anchor. Its stored zero residual is not a measured beacon-fit error or a frame-accuracy bound. |
| low, including assumed-start | Window-level claims only; inspect the extraction window padding and do not infer exact frame/event boundaries from this label. |

The beacon thresholds and fallback methods are defined in
[`ClockCorrelator.service.ts`](../../../../packages/tooling/library/qa-capture/src/ClockCorrelator.service.ts).
RMS summarizes the fitted beacon residuals; it is not a maximum error bound for
every event. Frame duration also depends on the recording frame rate. Check
`clockSync.method`, `residualRmsMs`, the actual timestamps and the available
beacon evidence together rather than converting a confidence label into a
fixed number of frames.

Transition-timing findings additionally need the recorded
`transition` events (`phase: "start"/"end"`) — compare their epoch span to
the frames where motion is visible. Qualify any mismatch against the observed
sync evidence and frame sampling; the confidence label alone does not establish
a timing defect.

## Gotchas

- `pointer-move` is throttled (~30 Hz) with the last-before-up always
  emitted — gaps in move seqs are sampling, not stalls. Stall claims need
  frame evidence.
- Lane A videos start at context creation, BEFORE first `goto` — early video
  seconds may be blank; that's not a bug.
- `beacon` events (`kind: "beacon"`) and the corner strobe in the first
  seconds are the sync mechanism — never report them as UI defects.
- Two overlapping gestures can merge into one extraction window
  (planner merge rule) — check `extractionPlan.windows[].seqFrom/seqTo` when
  a strip seems to span two actions.
