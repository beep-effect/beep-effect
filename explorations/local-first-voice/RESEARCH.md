# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-06-27

Two adversarial deep-research sweeps (each: 6 angle-finders + a refutation pass +
synthesis). Corrections from the verification pass are flagged inline. Full raw
reports are archived outside the tree (session task outputs `w0z3yf0f2`,
`wplnls7yt`).

## External Landscape

### Tauri-v2 microphone reality (the gotchas that bite)

- **`tauri://` is NOT a guaranteed secure context** (the assumption was *refuted*).
  `getUserMedia` and `AudioWorklet.addModule()` both require a secure context, and
  per [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/) vendor schemes
  aren't trusted by all engines; only the literal `127.0.0.1` is guaranteed. →
  ship the Tauri [`localhost` plugin](https://v2.tauri.app/plugin/localhost/)
  (binds `127.0.0.1`) and verify `window.isSecureContext` per engine.
- **macOS entitlement is distribution-specific** (*partly* corrected): hardened
  runtime needs
  [`com.apple.security.device.audio-input`](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.device.audio-input);
  App Sandbox needs
  [`…device.microphone`](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.microphone).
  Declare the **one** matching the ship path, plus Info.plist
  `NSMicrophoneUsageDescription`.
- **Windows WebView2** caches a "Block" decision permanently with no programmatic
  reset ([WebView2Feedback#2672](https://github.com/MicrosoftEdge/WebView2Feedback/issues/2672)).
  **Linux WebKitGTK** denies media by default unless a `permission-request` signal
  handler is wired, and WebRTC is a *compile-time* flag — the riskiest target
  ([tauri#8426](https://github.com/tauri-apps/tauri/discussions/8426)).
- Tauri **capabilities/ACL gate Tauri commands, not browser APIs**
  ([tauri security](https://v2.tauri.app/security/capabilities/)); CSP must include
  `media-src 'self' data: blob:` or `getUserMedia` fails silently.

### Capture path — webview Web Audio vs native Rust/cpal

- **AudioWorklet is the only correct modern capture** (*confirmed*): ScriptProcessor
  is deprecated; **MediaRecorder emits encoded webm/opus, never raw PCM**
  ([MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet),
  [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)).
  Keep the worklet thin (128-frame blocks on the audio thread). Float32→PCM16 by
  *rounding*; resample 48k→16/24k manually.
- **Native cpal** wins only for background/system-audio capture or Linux WebRTC
  gaps; community plugins (`tauri-plugin-mic-recorder`, `tauri-plugin-audio-recorder`)
  are dormant (fork cost). Stream PCM over **Tauri Channels, not Events**, and batch
  frames ([tauri calling-frontend](https://v2.tauri.app/develop/calling-frontend/)).

### Realtime voice architecture (cloud path)

- **Transports** (*partly* corrected): OpenAI Realtime supports **three** —
  WebRTC, WebSocket, **SIP** ([openai realtime](https://developers.openai.com/api/docs/guides/realtime));
  xAI Grok Voice is **WS-only** (browser needs a backend token relay)
  ([xai voice-agent](https://docs.x.ai/developers/model-capabilities/audio/voice-agent));
  ElevenLabs Scribe v2 is **WS STT-only**
  ([elevenlabs realtime stt](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)).
  Audio converged on **24kHz PCM16 mono**. WebSocket is the pragmatic default for a
  desktop webview (one path, aligns with `BrowserSocket`, dodges fragile desktop WebRTC).
- **Barge-in is NOT a VAD mode** (*partly* corrected) — it's an interrupt
  (`interrupt_response`/cancel), orthogonal to turn detection. **Echo cancellation is
  client-side** or barge-in self-triggers on the agent's own playback
  ([openai realtime-vad](https://developers.openai.com/api/docs/guides/realtime-vad)).
- **Pipeline (STT→LLM→TTS) vs speech-to-speech:** S2S ~200–400ms; pipeline
  ~500–1500ms but yields observability, text-layer compliance filtering, free LLM
  choice, and cost control ([murf](https://murf.ai/blog/speech-to-speech-vs-stt-llm-tts)).
  LLM first-token (~700–800ms) dominates the critical path.

### Local / on-device models (the privilege-safe core)

- **STT realtime: Moonshine**, not Whisper. Moonshine-tiny (27M) ≈ Whisper-tiny WER
  at ~34ms because it processes only the audio given (no 30s zero-pad); Whisper has a
  ~500ms latency floor ([arxiv 2410.15608](https://arxiv.org/html/2410.15608v1),
  [whisper-web](https://github.com/xenova/whisper-web)). Multilingual realtime still
  needs Whisper-class or cloud. **Batch ceiling:** whisper-small/base **q8**.
- **WebGPU is NOT a gate** (*partly* refuted): for small models/short audio, **WASM
  can match or beat WebGPU**; the bottleneck is model size × quantization × hardware
  ([transformers.js#894](https://github.com/xenova/transformers.js/issues/894),
  [sitepoint](https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/)). →
  WASM-first, WebGPU as an accelerator, benchmark on target.
- **TTS: Kokoro-82M** (Apache-2.0; #1 browser TTS on TTS Arena; 326MB→86MB q4 with
  no perceptible loss; ~300–600ms time-to-first-audio; `kokoro-js` streams via
  `tts.stream()`) ([Xenova](https://huggingface.co/posts/Xenova/503648859052804),
  [offlinetts](https://www.offlinetts.com/blog/kokoro-tts-complete-guide/)).
  **Supertonic-3** (99M, 31 langs, faster) if multilingual speed beats naturalness
  ([github/supertonic](https://github.com/supertone-inc/supertonic)). Output is
  Float32 PCM → Web Audio.
- **VAD: Silero** (MIT, zero telemetry) in a worker, 32ms frames, flush on 200–500ms
  silence ([silero-vad](https://github.com/snakers4/silero-vad),
  [vad-web](https://github.com/ocavue/vad-web)).
- **WebGPU per Tauri engine** (*confirmed* uneven): WebView2 ✅ (Chromium 113+);
  **WKWebView `navigator.gpu` unreliable** even on macOS 26
  ([caniwebview](https://caniwebview.com/features/web-feature-webgpu/)); WebKitGTK
  unconfirmed. Tauri exposes **no WebGPU flag** ([tauri#6381](https://github.com/tauri-apps/tauri/issues/6381))
  — runtime-detect. Known Tauri+macOS Whisper window-freeze
  ([wry#1442](https://github.com/tauri-apps/wry/issues/1442)).

### Workers, isolation, storage

- **Inference = dedicated Web Worker** (load the pipeline once, reuse). **Service
  worker ONLY for Cache-API weight interception / offline** (*partly* corrected: the
  "never compute" rule has a Chrome-MV3-extension exception that does not apply to a
  Tauri/Next.js app) ([HF chrome-extension](https://huggingface.co/blog/transformersjs-chrome-extension)).
  Transfer audio via transferable `ArrayBuffer` (zero-copy).
- **Threaded WASM needs `SharedArrayBuffer` → COOP `same-origin` + COEP
  `require-corp`** (*confirmed*) ([web.dev coop-coep](https://web.dev/articles/coop-coep));
  set via Tauri [`app.security.headers`](https://v2.tauri.app/security/http-headers/)
  **and mirror in the Next.js/Vite dev server** or `crossOriginIsolated` silently
  fails. WKWebView's SAB is frontend-only (no Rust↔JS bridge). COOP `same-origin`
  can break OAuth/payment popups.
- **Weights in OPFS** (byte-level, synchronous handles in workers) +
  `navigator.storage.persist()` + graceful re-download
  ([web.dev OPFS](https://web.dev/articles/origin-private-file-system)); self-host
  ONNX (HF Hub CDN is prototyping-only).

### Privilege posture (the legal driver)

- ABA Model Rule 1.6(c) requires "reasonable efforts" against unauthorized
  disclosure; routing privileged audio through unnecessary third parties can risk
  privilege waiver
  ([ABA Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/)).
  → on-device-by-default is architectural, not cosmetic.
- Cloud-tier caveats: OpenAI Zero Data Retention is **enterprise-only** (standard
  tier retains 30 days) ([OpenAI data](https://developers.openai.com/api/docs/guides/your-data));
  xAI ZDR + EU residency is **enterprise-only**; **ElevenLabs has no privilege
  carve-outs** and retains voice data 2–3 years by default
  ([ElevenLabs retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)).
  → cloud for non-privileged / quality-critical work only.

## In-Repo Capability Inventory

Discovery key: ✅ exists · 🆕 NOT FOUND (net-new).

### Desktop shell — already Tauri v2 ✅
- `apps/professional-desktop` — Tauri v2 + React + Vite (`@tauri-apps/api`/`cli`
  ^2.11). `src-tauri/` plugins: shell, log, updater **only — no audio plugin** 🆕.
  IPC bridge at `apps/professional-desktop/src/transport/TauriIpcSocket.ts`.
- `apps/oip-web` — Next.js 16; already merges `BrowserHttpClient.layerFetch` +
  `BrowserKeyValueStore.layerLocalStorage` in `src/runtime/OipAtomRuntime.ts`. ✅

### Voice / audio bricks ✅
- `packages/foundation/ui-system/ui/src/components/live-waveform.tsx` — full Web
  Audio mic capture (`getUserMedia` + `AudioContext` + `AnalyserNode`) + canvas viz.
  Hooks/`useRef`, **not atom-first** (absorb/refactor target).
- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts` +
  `.../components/speech-input.tsx` — ElevenLabs Scribe v2 realtime STT over WS,
  atom-backed (`Atom.family`, `useAtom`).
- `packages/drivers/xai` — realtime voice + streaming TTS/STT WS endpoints.
- `packages/drivers/venice-ai` — `createSpeech` / `createTranscription` / voice-clone.
- `@effect/ai-openai` (4.0.0-beta.90) — whisper / gpt-4o-transcribe / realtime models.
- `@elevenlabs/client` ^1.14.0. `packages/drivers/ffmpeg` (frame extraction; no
  audio codec path 🆕).
- Audio `FileExtension` / `MimeType` schema models exist
  (`packages/foundation/modeling/schema/src/`).

### `@effect/platform-browser` (4.0.0-beta.90) — the user's hunch, confirmed ✅
- `Permissions.query(name)` → `PermissionStatus` (+ `PermissionsError`) — the device
  permission primitive. **Shipped but unused in repo** 🆕 (integration is net-new).
- `BrowserKeyValueStore.{layerLocalStorage,layerSessionStorage,layerIndexedDb}`.
- `BrowserSocket.layerWebSocket(url)` → `Socket.Socket` — typed duplex for the voice WS.
- `BrowserWorker` / `BrowserWorkerRunner` — host the inference worker.
- `BrowserStream.fromEventListener{Window,Document}`.
- **NOT present** 🆕: any `getUserMedia` / `AudioContext` / `MediaRecorder` /
  `AudioWorklet` wrapper → the hand-roll surface.

### Effect worker / RPC primitives — verified in `.repos/effect-v4` ✅ (unused 🆕)
- `effect/rpc`: `Rpc.make(..., { stream: true })`, `RpcGroup.make`,
  `RpcServer.layerProtocolWorkerRunner`, `RpcClient.layerProtocolWorker` —
  transport-agnostic, **streams over a Worker** (`platform-browser/test/RpcWorker.test.ts`).
  `Worker.makePoolSerialized` does **not** exist; RPC is the canonical path.
- Currently unused (`Worker`/`WorkerRunner` NOT FOUND in repo; `Socket` used only in
  observability; `AtomRpc` used in `Chat.atoms.ts`).

### Atom-reactivity wiring ✅
- `packages/agents/client/src/Chat.atoms.ts` — `Atom.kvs`, `Reactivity.mutation`,
  `reactivityKeys`, `Atom.family`, and the hard-won interrupt lesson
  (`:451–531`): route cleanup through `Reactivity`/`AtomRegistry` services, **not**
  `ctx.set`, because the node Lifetime refreshes before the fiber unwinds.
- AudioWorklet→Stream bridge prior art: `packages/drivers/box/src/Box.streaming.ts:824–896`
  (`Stream.callback` + `Queue.offerUnsafe` per event; `off` + `endUnsafe` in release).
- Three-layer service pattern to mirror: `AcpAgent` / `AcpProtocol` / `AcpClient`.
- **No permission-atom integration exists** 🆕.

## Constraints Discovered

- **Secure context is mandatory and not free on desktop** — `getUserMedia` +
  `AudioWorklet.addModule()` require it; `tauri://` does not guarantee it. Forces the
  `localhost` plugin (127.0.0.1) + per-engine `window.isSecureContext` check.
- **Cross-origin isolation (COOP/COEP) is required for threaded WASM** and must be set
  in both the Tauri config and the dev server, or it silently degrades to single-thread.
- **WebGPU is non-uniform across the three Tauri engines** (WKWebView/WebKitGTK
  unreliable) and there is no Tauri flag — the design must degrade WebGPU → WASM →
  (native/server) and runtime-detect.
- **Privilege/legal:** privileged client audio must not leave the device by default
  (ABA MR 1.6(c)); cloud zero-retention is enterprise-only and ElevenLabs has no
  privilege carve-out — so cloud must be gated, audited, and never the default for
  privileged audio.
- **macOS distribution path determines the single mic entitlement** (hardened runtime
  vs App Sandbox); cannot be finalized until the distribution channel is chosen.
- **AudioWorklet runs in a realm where Effect cannot run** — the worklet must stay a
  thin frame-poster; all Effect-side processing happens in the main thread or a worker.

## 2026-06-27 (loop) — `apps/professional-desktop` usage grounding

In-repo deep-research loop (5 read-only Explore agents) to ground *how/what* voice
would actually be used in the target app and right-size the first bet.

**What the app is today (single-workspace chat only — no approval gates, no voice):**
- Shell: `apps/professional-desktop/src/main.tsx` (`WorkbenchThemeProvider` +
  `ProfessionalAtomProvider`) → `App.tsx` mounts `ChatApp` on a resolved sidecar
  transport (HTTP `:3939` or Tauri-IPC stdio).
- Browser runtime: `apps/professional-desktop/src/runtime/ProfessionalAtomRuntime.ts`
  = `Atom.runtime(Layer.empty)` with services added via `addGlobalLayer` (already used
  for `ClientObservabilityLive`) — **the natural insertion point for a voice layer.**
- Server/sidecar runtime: `apps/professional-desktop/src/runtime/Layer.ts`
  (`ChatHandlersLive` + Drizzle/PGlite + turn kernel; `CHAT_AGENT` = `anthropic`|`fixture`).
- Input surface: `apps/professional-desktop/src/chat/ui/Composer.tsx` wrapping
  `@beep/editor` `ChatComposer` (`packages/foundation/ui-system/editor/src/chat/chat-composer.tsx`);
  drafts via `draftAtoms(threadId)`, dispatch via `runTurnAtom`
  (`packages/agents/client/src/Chat.atoms.ts`).
- Output surfaces: `chat/ui/StreamingBlocks.tsx` (in-flight) + `chat/ui/MessageView.tsx`
  (persisted). Orchestration: `chat/ChatOrchestrator.ts`.
- Sole keybinding: Enter-to-send (`editor/src/chat/atoms.ts` `sendKeyBindingAtom`). No
  command palette, no global shortcuts, **no mic affordance anywhere.**
- **Orphaned bricks (zero importers):** `ui/src/components/speech-input.tsx` (compound
  mic UI), `ui/src/components/live-waveform.tsx` (visualizer), `ui/src/hooks/use-scribe.ts`
  — note `use-scribe` is bound to **ElevenLabs cloud** Scribe (`@elevenlabs/client`),
  reusable as a state-machine *shape* but in tension with the privilege-safe posture.

**Use cases ranked (value × proximity-to-existing-surface):**
1. **Push-to-talk dictation → transcript into composer** (`chat/ui/Composer.tsx`) —
   highest; lands as an alternate input stream, no domain/schema re-architecture.
2. **Spoken instruction to direct a turn** — same mechanism as #1 (transcript *is* the
   instruction); free once #1 ships.
3. **TTS read-aloud of a completed turn** (`StreamingBlocks.tsx`/`MessageView.tsx`) —
   medium-high value, **lower proximity** (no synth path exists at all).
4. Voice memo → candidate billable/docket entry — depends on #1 + agent extraction.
5. Voice-to-voice consultation — headline, lowest proximity (barge-in/echo are net-new).

**Integration seams for dictation (the highest-value feature):**
- Mic affordance + transcript injection: `chat/ui/Composer.tsx` (mount `SpeechInput`;
  insert via the editor text-insert seam `captureAttachmentsFn` uses).
- Feature flag + a `voiceActiveAtom` guarding `SEND_MESSAGE_COMMAND` so Enter doesn't
  fire mid-dictation: `editor/src/chat/{chat-composer,atoms}.ts`.
- Mic permission (desktop): `src-tauri/tauri.conf.json` (CSP), `src-tauri/capabilities/default.json`,
  macOS `NSMicrophoneUsageDescription`. Sidecar IPC untouched.
- Runtime layer (only if a service is needed): `ProfessionalAtomRuntime.ts` `addGlobalLayer`.

**Right-sized first bet (the "not a full slice" answer):** push-to-talk dictation into
the existing composer — one thin goal, ~80% existing parts, deferring the full
`AudioCapture`/`InferenceWorker`/ports/`PrivilegedAudio` stack. The one decision baked
in is the **transcription engine** (local Moonshine vs cloud/browser spike) — see the
2026-06-27 engine-fork entry in DECISIONS once resolved.
