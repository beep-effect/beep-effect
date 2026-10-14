# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-27

Raw dump (verbatim from the `/explore /deep-research /grill-with-docs` session,
captured across the conversation in the order it arrived):

> Can you research everything about a tauri app and working with microphones
> (for TTS, voice to voice etc) btw I'm down for hand rolling a dev safe
> solution to what ever. Further more I even believe that
> "@effect/platform-browser" has some ideal primitives for certain things.

> maybe device permissions for example with /atom-reactivity-specialist

> and KV's

> Also I'm open to running local models with effect/rpc controlling
> service workers for stuff liking @huggingface/transformers for efficient and
> configurable browser based or local models that are good to run for TTS,
> Transcription etc. Maybe web whisper?

> But I want the ability to choose a better option or options(s) for the
> different kinds of models, services I'm using for various microphone / voice
> features.

Threads pulled out of the dump (not tidying the above — just noting what the
later stages chewed on):

- Tauri app + microphone for TTS, voice-to-voice, transcription.
- "hand rolling a dev safe solution" — open to building custom primitives.
- `@effect/platform-browser` suspected to have ideal primitives.
- Device permissions modeled via the Atom-reactivity layer
  (`/atom-reactivity-specialist`).
- KV stores for persisted state.
- Local/on-device models via `@huggingface/transformers` (Transformers.js),
  driven by `effect/rpc` controlling a worker; "web whisper".
- Per-capability provider/model selection — pick the best option per voice
  feature, swap freely.
