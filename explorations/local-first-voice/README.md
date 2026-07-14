# Local-First Voice & Microphone Capability

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A Tauri desktop app that can hear and speak — dictation, TTS, and voice-to-voice
— for privileged legal work, hand-rolled "dev-safe" on `@effect/platform-browser`
primitives with per-feature choice of local (Transformers.js) vs cloud models.

## Next Open Question

run [`goals/voice-composer-slice`](../../goals/voice-composer-slice/README.md) P0
spike (5-day cap) → proceed/reshape/stop

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log, including the 2026-07-14 locked ratifications.
5. [`BRIEF.md`](./BRIEF.md) - ratified thin composer-slice pitch.
6. [`MAP.md`](./MAP.md) - graduated first goal plus absorbed and gated follow-ons.
7. [`research/SOURCES.md`](./research/SOURCES.md) - external and in-repo provenance ledger.

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-07-14: de-drifted BRIEF/MAP to the four locked ratifications, created the
  missing provenance ledger, and graduated `voice-composer-slice` with the bounded
  Linux Tauri spike as P0; exploration stays active for absorbed/gated follow-ons.
- 2026-06-27 (loop): research→align loop on user steer ("not a full slice; deep-research
  the repo for real usage"). In-repo sweep of `apps/professional-desktop` (5 agents)
  appended a usage-grounding section to RESEARCH. Bet right-sized to push-to-talk
  dictation into the existing composer (~80% existing parts). Stopped to grill the
  engine fork + packaging before reshaping BRIEF/MAP.
- 2026-06-27: packet opened and driven research → align → shape in one session.
  Two adversarial deep-research sweeps (Tauri/cloud/permissions + local-models/
  workers/WebGPU/RPC) populated RESEARCH; 9 forks resolved in DECISIONS via
  multiple-choice grilling (all on recommendations); BRIEF + MAP drafted. Stopped at
  the shape exit gate awaiting BRIEF sign-off before graduating `voice-dictation-slice`.
