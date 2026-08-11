---
name: motion-evidence-review
description: >
  How to read beep-qa motion evidence: correlate frame strips, contact sheets,
  and GIFs against events.ndjson timelines, map frame timestamps to action
  events, and cite frame+event pairs when judging or fixing. Use when
  reviewing QA evidence, writing a vision-judge finding, reproducing a finding
  from a session's artifacts, or auditing an old round's evidence in a goal
  packet or PR.
version: 0.1.0
status: active
---

# Motion Evidence Review

Three roles consume QA evidence at different times: the vision judge (via its
prompt), the fixer reproducing a finding, and PR/packet reviewers auditing
after the fact. This skill is the shared literacy. The loop protocol and the
inventory/severity format live in `browser-qa-loop` — this is how to READ.

## The three clocks (get this right first)

1. **Event clock** — witness `tEpochMs` = `performance.timeOrigin +
   performance.now()`, wall-clock epoch ms. Every line of `events.ndjson`.
2. **Video time** — seconds from the recording's first frame.
3. **The mapping** — `session.json → clockSync`:
   `videoT = slope·tEpochMs + offsetMs` with `method`
   (`beacon` | `obs-record-state` | `assumed-start`) and `confidence`.
   Confidence `high` ≈ ±25 ms (about one 30 fps frame); `low` means windows
   were padded ±250 ms — do not make timing claims finer than the confidence
   supports.

`references/frame-event-correlation.md` walks the arithmetic with worked
examples; `references/evidence-anatomy.md` decodes file naming, strip
ordering, and sheet grids.

## Reading a finding (or writing one)

A well-formed claim always pairs pixels with events:

> Frames 12–15 of `frames/drag-sash--strip/` (t≈3.31–3.41 s) show a native
> selection highlight across the neighbor panel while `events.ndjson`
> seq 141→158 shows an active pointer drag (`pointer-down` seq 141 at
> tEpochMs …, no `pointer-up` until seq 158) — selection-smear during sash
> resize.

Rules:

- Cite artifact path + frame index/range + event `seq` refs. Inventory
  `QaEvidenceRef` has fields for exactly these — fill them.
- A defect in ONE mid-gesture frame is real even when the final screenshot
  is clean; the converse also holds — a single odd frame at LOW clock
  confidence near a window edge may be a neighboring gesture. Check the
  event seq range before claiming.
- What a GIF proves: a human-visible summary. What it cannot prove: exact
  timing (GIF fps ≠ source fps, frames are sampled). Timing claims come from
  strips + timeline, never from GIF playback feel.
- Markers (`kind: "marker"`) are semantic labels — scenario boundaries and
  agent annotations. Use them to scope which events belong to which gesture.

## Reproducing a finding

1. `session.json` → scenario + commit (`commitSha`, `commitDirty`).
2. The finding's `eventIds` → grep those seqs in `events.ndjson` → exact
   gesture path, coordinates, timing.
3. Re-run just that scenario (`.beep/qa-capture.mjs` scenario name) or
   replay the gesture manually in Lane B at the recorded coordinates.
4. Any extracted frame's own XMP-beepQA provenance tags (inspect with
   `exiftool`) identify its session if files got separated from the round dir.

## Auditing old evidence

`inventory.json` is schema-validated (`beep qa judge-lint --round N` re-checks
any round). `judge/manifest.json` lists what the judge actually saw INCLUDING
`dropped` — an inventory is only as complete as that manifest; treat dropped
evidence as unreviewed, not clean.
