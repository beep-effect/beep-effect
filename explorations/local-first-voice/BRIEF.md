# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The professional-desktop control plane has no voice. We want to talk to the agent
— dictate into the composer, have replies read aloud, and eventually hold a
voice-to-voice conversation — but the firm handles **privileged client audio**, so
the naive "pipe the mic to a cloud realtime API" answer is a privilege-waiver hazard
(ABA MR 1.6(c); cloud zero-retention is enterprise-only, ElevenLabs has none).

The repo already has scattered pieces—a Tauri v2 shell, Web Audio waveform capture,
an ElevenLabs Scribe UI/state-machine precedent, xAI/Venice voice drivers, composer
seams, and `@effect/platform-browser` primitives. What is missing for the shaped bet
is much smaller than a general voice platform: a proven, scope-safe local capture and
model path that can insert a Moonshine transcript into the existing composer and play
Kokoro audio for a completed agent turn without audio egress or chat-domain/sidecar
protocol changes. Moonshine/Kokoro plus browser workers make that thin loop plausible;
the bounded spike must prove it on the user's real Linux Tauri target before production
design earns its budget.

## Appetite

**One thin composer slice in two to three weeks.** The shaped bet adds local,
English push-to-talk dictation **and** manual read-aloud of completed agent turns
to `apps/professional-desktop`. Its first week is a five-engineering-day,
hard-capped P0 spike on Linux development Tauri. Any failed acceptance threshold
forces an explicit proceed/reshape/stop decision before production work begins;
the budget never expands silently. Provider platforms, automatic or streaming
read-aloud, cloud voice, and voice-to-voice remain later bets in the MAP.

## Solution Sketch

**Posture:** local-first (for latency and offline dictation, not for
compliance), pipeline, desktop-first. Hosted providers remain an option.

```
 push-to-talk ─▶ thin AudioWorklet capture ─▶ resample/PCM ─▶ local worker
                                                               ├─ Moonshine ─▶ composer insertion
 completed agent turn ─▶ speaker button ───────────────────────└─ Kokoro ─▶ playback buffer
```

**P0 spike architecture is deliberately minimal:** capture, a thin worklet frame
poster, resampling/PCM, one local worker with visible model loading, Moonshine and
Kokoro calls, a small interruptible playback buffer, and direct composer/message
seams. It proves secure context, COOP/COEP, `getUserMedia`, model load/cache behavior,
teardown, zero audio egress, transcript insertion, and time-to-first-audio on Linux
development Tauri (WebKitGTK).

**Production slice after a P0 proceed:** a hold-to-talk control records locally and
inserts the Moonshine transcript into the existing composer; a speaker button on each
completed agent turn starts local Kokoro playback and can be interrupted. Cancellation
flows through Reactivity/`AtomRegistry` so tracks, contexts, workers, and playback
release predictably. No chat-domain or sidecar-protocol change is part of the seam.

Production provider ports, a general `InferenceWorker` platform, provider selection,
and a full OPFS/model-lifecycle abstraction are **not** in this slice. The slice may
persist/cache its two fixed local models and recover first-run downloads only to the
extent required by the locked acceptance thresholds. Extraction waits for a second
consumer.

## Rabbit Holes

- **Secure context on the desktop webview.** `tauri://` is not guaranteed secure;
  patch with the Tauri `localhost` plugin (127.0.0.1) + a `window.isSecureContext`
  capability check. Don't bet on `tauri://`.
- **Cross-webview differences.** P0 targets Linux development Tauri/WebKitGTK.
  Before ship, P1 must check WKWebView microphone permission/WebGPU behavior and the
  hardened-runtime versus App Sandbox entitlement fork, plus WebView2 permission
  persistence. Do not claim P0 proves macOS or Windows.
- **AudioWorklet realm.** Effect can't run in the worklet; keep it a thin frame-poster
  and do all Effect work in the main thread / worker. Resampling 48k→16k and Float32→PCM16
  rounding live just outside the worklet.
- **COOP/COEP.** Threaded WASM needs cross-origin isolation set in *both* Tauri config
  and dev server; forget the dev server and it silently single-threads.
- **Interrupt cleanup.** Reuse the `Chat.atoms.ts:451–531` lesson — route cancel cleanup
  through `Reactivity`/`AtomRegistry`, not `ctx.set`.
- **Model download UX.** First-run model downloads need visible progress, persistence
  or cache reuse, interruption/failure recovery, and a re-download path. Avoid turning
  that bounded requirement into a general model-store platform.

## No-Gos

- **No cloud routing for privileged audio** — the composer slice has zero audio
  network egress.
- **No automatic or streaming read-aloud** — manual completed-turn playback only.
- **No provider-switching UI or production provider-port platform.**
- **No voice-to-voice or speech-to-speech session.**
- **No native Rust/cpal capture** — the slice uses webview Web Audio.
- **No multilingual local models** — fixed English Moonshine and Kokoro models.
