# Voice Composer Slice — Implementation Sources & Provenance

- **Primary ledger:**
  [`explorations/local-first-voice/research/SOURCES.md`](../../../explorations/local-first-voice/research/SOURCES.md).
  Corrections begin there and are synchronized here.
- **Origin:** the exploration research was captured 2026-06-27 and de-drifted
  2026-07-14. P0 must re-verify runtime behavior, selected model artifacts, versions,
  and licenses against the live checkout and target machine.

## 1. Core local-model and runtime sources

| Source | URL | Recorded use | Disposition |
| --- | --- | --- | --- |
| Moonshine paper | <https://arxiv.org/html/2410.15608v1> | Short-utterance local STT basis. | Reference; implementation artifact/license **NEEDS-REVERIFICATION**. |
| Transformers.js issue #894 | <https://github.com/xenova/transformers.js/issues/894> | WASM/WebGPU performance caveat. | Reference-only until runtime/version/license verification. |
| Xenova Kokoro post | <https://huggingface.co/posts/Xenova/503648859052804> | Kokoro-82M browser TTS and q4/streaming evidence. | Model license recorded Apache-2.0; artifact and attribution recheck required. |
| OfflineTTS Kokoro guide | <https://www.offlinetts.com/blog/kokoro-tts-complete-guide/> | Secondary latency/browser context. | Reference-only. |
| Silero VAD | <https://github.com/snakers4/silero-vad> | VAD prior art if the spike needs it. | MIT recorded; port-with-attribution after recheck. |
| vad-web | <https://github.com/ocavue/vad-web> | Browser VAD precedent. | License **NEEDS-REVERIFICATION**; reference-only. |
| Transformers.js worker precedent | <https://huggingface.co/blog/transformersjs-chrome-extension> | Dedicated worker/cache separation. | Reference-only. |
| COOP/COEP guide | <https://web.dev/articles/coop-coep> | Threaded WASM isolation. | Platform guidance. |
| OPFS guide | <https://web.dev/articles/origin-private-file-system> | Bounded model persistence/cache option. | Platform guidance; no mandate for a general store. |

No standalone ONNX Runtime URL or license was present in the exploration.
Direct ONNX Runtime claims or reuse remain **NEEDS-REVERIFICATION** before P1.

## 2. Tauri/webview and capture sources

| Source | URL | Slice use |
| --- | --- | --- |
| W3C Secure Contexts | <https://www.w3.org/TR/secure-contexts/> | Do not trust `tauri://` by assumption. |
| Tauri localhost plugin | <https://v2.tauri.app/plugin/localhost/> | P0 localhost secure-context path. |
| Tauri WebKitGTK discussion | <https://github.com/tauri-apps/tauri/discussions/8426> | Linux microphone permission/WebRTC risk. |
| Tauri capabilities | <https://v2.tauri.app/security/capabilities/> | Browser media permission is separate from command ACLs. |
| MDN AudioWorklet | <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet> | Thin modern capture processor. |
| MDN MediaRecorder | <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder> | Encoded output is not the raw PCM slice path. |
| Tauri HTTP headers | <https://v2.tauri.app/security/http-headers/> | Tauri COOP/COEP configuration. |
| WebView2 issue #2672 | <https://github.com/MicrosoftEdge/WebView2Feedback/issues/2672> | Named Windows P1 permission risk. |
| Apple audio-input entitlement | <https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.device.audio-input> | Hardened-runtime branch of the named macOS P1 fork. |
| Apple microphone entitlement | <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.microphone> | App Sandbox branch of the named macOS P1 fork. |
| Can I WebView WebGPU | <https://caniwebview.com/features/web-feature-webgpu/> | Cross-webview runtime variability. |
| Wry issue #1442 | <https://github.com/tauri-apps/wry/issues/1442> | Named macOS freeze risk. |

## 3. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| Live waveform | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx` | Reuse/absorb capture and visible-state behavior. |
| Scribe UI/state precedent | `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts`; `packages/foundation/ui-system/ui/src/components/speech-input.tsx` | State-machine precedent only; never its ElevenLabs cloud route. |
| Composer | `apps/professional-desktop/src/chat/ui/Composer.tsx`; `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` | Controls and transcript insertion seam. |
| Cancellation | `packages/agents/client/src/Chat.atoms.ts` | Reactivity/`AtomRegistry` lifecycle precedent. |
| Audio event release | `packages/drivers/box/src/Box.streaming.ts` | Scoped event/stream cleanup precedent. |
| Existing voice drivers | `packages/drivers/xai`; `packages/drivers/venice-ai` | Follow-on evidence only; not slice dependencies. |
| Browser worker/RPC | `.repos/effect-v4/packages/platform-browser`; `.repos/effect-v4/packages/effect/src/unstable/rpc` | Re-verify APIs; Effect remains outside AudioWorklet. |

## 4. Cross-links

- Primary exploration ledger:
  `explorations/local-first-voice/research/SOURCES.md`.
- Research and capability inventory:
  `explorations/local-first-voice/RESEARCH.md`.
- Locked decisions: `explorations/local-first-voice/DECISIONS.md`.
- Shaped boundary and dependency map:
  `explorations/local-first-voice/{BRIEF,MAP}.md`.
