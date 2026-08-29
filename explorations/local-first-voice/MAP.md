# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | State | Mission | Depends on |
| --- | --- | --- | --- |
| [`voice-composer-slice`](../../goals/voice-composer-slice/README.md) | **GRADUATED — FIRST** | Add all-device push-to-talk Moonshine dictation and manual, interruptible Kokoro read-aloud for completed agent turns in the professional-desktop composer. Its five-day Linux Tauri spike is P0 and gates production work. | none |
| `voice-capture-foundation` | **ABSORBED** | The slice owns only the capture needed by its composer UX; extract a reusable scoped capture capability only when a second consumer appears. | extraction candidate after `voice-composer-slice` |
| `voice-inference-worker` | **ABSORBED** | The slice owns its fixed-model worker/cache seam; extract a general inference worker only when a second consumer appears. | extraction candidate after `voice-composer-slice` |
| `voice-provider-ports` | **GATED FOLLOW-ON** | Introduce general `Transcriber`/`Synthesizer`/`VoiceSession`/`Vad` ports, privilege gates, adapters, and persisted selection only when multiple providers or consumers justify them. | `voice-composer-slice`; second-provider/consumer trigger |
| `voice-tts-playback` | **GATED FOLLOW-ON** | Extend the slice's manual completed-turn playback into automatic and/or streaming read-aloud, with the larger buffering and turn-policy contract. | `voice-composer-slice`; explicit auto/streaming UX decision |
| `voice-cloud-transport` | **GATED FOLLOW-ON** | Add audited, non-privileged cloud voice transport and adapters without weakening the privileged-audio boundary. | `voice-composer-slice`, then `voice-provider-ports`; approved cloud use case |
| `voice-to-voice-session` | **GATED HEADLINE** | Compose capture, VAD, STT, LLM, TTS, playback, barge-in, and echo control into a full-duplex session. | `voice-composer-slice`, `voice-tts-playback`, `voice-cloud-transport`; explicit session bet |

## Sequencing

`voice-composer-slice (GRADUATED FIRST, spike-as-P0) → {capture/worker extraction
only on second consumer, provider ports only on second provider, auto/streaming
TTS only on explicit UX bet} → cloud transport → voice-to-voice session`.

- **First and graduated:** `voice-composer-slice` is one thin combined goal, not
  a miniature platform program. P0 proves the risky Linux/WebKitGTK path within
  five engineering days and records proceed/reshape/stop before P1.
- **Absorbed foundations:** `voice-capture-foundation` and
  `voice-inference-worker` do not graduate separately. Their minimum behavior is
  colocated with the slice; a second consumer is the extraction trigger.
- **Manual TTS is in the slice:** `voice-tts-playback` now names only automatic
  or streaming read-aloud beyond the completed-turn speaker button.
- **Follow-ons hang off proven use:** provider generalization, cloud transport,
  and full-duplex voice inherit the slice instead of blocking it.

## First Vertical Slice

On Linux development Tauri (WebKitGTK), the user holds push-to-talk, sees recording
state, releases, and receives a local Moonshine transcript in the existing composer.
Each completed agent turn has a speaker button that starts local Kokoro playback and
can be interrupted. No audio leaves the device, and no chat-domain or sidecar-protocol
change is required.

P0 acceptance is quantitative: first model load ≤15s with progress; cached loads
≤3s; a ≤10s utterance appears ≤2s after release; read-aloud first audio ≤1.5s;
the mic indicator clears ≤500ms after release/unmount; zero audio network egress.
Any failure forces a recorded proceed/reshape/stop decision before P1.

## Capability Check

### Existing bricks — reuse or precedent

- `packages/foundation/ui-system/ui/src/components/live-waveform.tsx` — existing
  Web Audio capture/visual state to reuse or absorb.
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts` and
  `speech-input.tsx` — **UI/state-machine precedent only**; their ElevenLabs cloud
  path is not reusable for privileged audio.
- `packages/drivers/xai` and `packages/drivers/venice-ai` — existing voice-driver
  evidence for gated follow-ons, not slice dependencies.
- `apps/professional-desktop/src/chat/ui/Composer.tsx` and
  `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` — composer
  affordance and insertion seams.
- `packages/agents/client/src/Chat.atoms.ts` — Reactivity/`AtomRegistry` teardown
  and interruption precedent.

### NET-NEW in the graduated slice

- Thin AudioWorklet processor.
- Audio resampling and Float32/PCM path.
- Scoped microphone capture service/lifecycle.
- Local Moonshine/Kokoro model worker plus bounded cache/recovery behavior.
- Interruptible playback buffer.
- Composer and completed-turn speaker-button wiring.

## Open Risks Inherited From The Brief

- The P0 target is Linux Tauri/WebKitGTK; macOS/WKWebView microphone behavior,
  hardened-runtime versus App Sandbox entitlement choice, and Windows/WebView2
  permission behavior remain named P1 pre-ship risks.
- `tauri://` is not assumed secure; use the localhost path and assert
  `window.isSecureContext`.
- COOP/COEP must be correct in both Tauri and the development server.
- Effect stays out of the AudioWorklet realm; it remains a thin frame-poster.
- Cancellation and unmount cleanup route through Reactivity/`AtomRegistry` so
  media tracks and playback release promptly.
- First-run model download, persistence/cache reuse, visible progress, failure
  recovery, and re-download must meet thresholds without becoming a platform.
