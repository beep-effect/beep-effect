# Local-First Voice — Sources & Provenance

Primary provenance ledger for `explorations/local-first-voice`. This file records
only URLs and license facts already present in `RESEARCH.md`, `BRIEF.md`, or
`DECISIONS.md`. Missing upstream URLs or licenses are marked
**NEEDS-REVERIFICATION** and remain reference-only.

## 1. Local models, workers, and browser runtime

| Source | URL on disk | Recorded fact / use | Verification status |
| --- | --- | --- | --- |
| Moonshine paper | <https://arxiv.org/html/2410.15608v1> | Local short-utterance STT latency/quality basis. | Cited; implementation/model artifact still needs P0 verification. |
| whisper-web | <https://github.com/xenova/whisper-web> | Comparator for browser Whisper behavior. | License **NEEDS-REVERIFICATION**; reference-only. |
| Transformers.js WebGPU issue #894 | <https://github.com/xenova/transformers.js/issues/894> | WASM-versus-WebGPU performance caveat. | Runtime behavior needs target-machine verification; upstream license not recorded. |
| SitePoint WebGPU/WASM comparison | <https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/> | Secondary runtime-performance context. | Reference-only. |
| Xenova Kokoro post | <https://huggingface.co/posts/Xenova/503648859052804> | Kokoro-82M browser TTS, q4 size/quality, streaming claim. | Kokoro-82M license recorded as Apache-2.0; performance needs P0 verification. |
| OfflineTTS Kokoro guide | <https://www.offlinetts.com/blog/kokoro-tts-complete-guide/> | Secondary Kokoro latency and browser-use context. | Reference-only. |
| Supertonic repository | <https://github.com/supertone-inc/supertonic> | Deferred multilingual TTS comparator. | License **NEEDS-REVERIFICATION**; reference-only. |
| Silero VAD repository | <https://github.com/snakers4/silero-vad> | Worker VAD prior art; license recorded as MIT. | Port-with-attribution permitted after version/license recheck. |
| vad-web repository | <https://github.com/ocavue/vad-web> | Browser VAD integration prior art. | License **NEEDS-REVERIFICATION**; reference-only. |
| Transformers.js Chrome extension | <https://huggingface.co/blog/transformersjs-chrome-extension> | Dedicated-worker versus service-worker/cache precedent. | Reference-only; upstream code/license not recorded. |
| COOP/COEP guide | <https://web.dev/articles/coop-coep> | Cross-origin isolation required for threaded WASM/`SharedArrayBuffer`. | Cited platform guidance. |
| OPFS guide | <https://web.dev/articles/origin-private-file-system> | Worker-accessible model persistence/cache option. | Cited platform guidance. |

No standalone ONNX Runtime URL or license appears in the packet. Any direct ONNX
Runtime dependency, backend claim, or code reuse is **NEEDS-REVERIFICATION** against
the chosen runtime before P1; until then the packet relies only on the
Transformers.js/runtime references above.

## 2. Tauri, webview, capture, and platform sources

| Source | URL on disk | Recorded fact / use | Verification status |
| --- | --- | --- | --- |
| W3C Secure Contexts | <https://www.w3.org/TR/secure-contexts/> | Vendor schemes are not universally trustworthy secure contexts. | Normative/reference guidance. |
| Tauri localhost plugin | <https://v2.tauri.app/plugin/localhost/> | `127.0.0.1` delivery path for secure-context proof. | Must be proven in Linux development Tauri P0. |
| Apple audio-input entitlement | <https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.device.audio-input> | Hardened-runtime microphone entitlement branch. | Named P1 macOS risk. |
| Apple microphone entitlement | <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.microphone> | App Sandbox microphone entitlement branch. | Named P1 macOS risk. |
| WebView2 issue #2672 | <https://github.com/MicrosoftEdge/WebView2Feedback/issues/2672> | Persisted microphone-block behavior. | Named P1 Windows risk; repository license not material to reference use. |
| Tauri discussion #8426 | <https://github.com/tauri-apps/tauri/discussions/8426> | WebKitGTK permission-request/WebRTC caveat. | Must be proven on the P0 target. |
| Tauri capabilities | <https://v2.tauri.app/security/capabilities/> | Tauri ACLs do not grant browser API permission. | Cited official guidance. |
| MDN AudioWorklet | <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet> | Modern low-level audio processing path. | Cited platform guidance. |
| MDN MediaRecorder | <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder> | Encoded recording is not the slice's raw PCM path. | Cited platform guidance. |
| Tauri calling the frontend | <https://v2.tauri.app/develop/calling-frontend/> | Tauri Channels precedent for any later native path. | Deferred reference. |
| Can I WebView WebGPU | <https://caniwebview.com/features/web-feature-webgpu/> | Cross-webview WebGPU variability. | Runtime detection still required. |
| Tauri issue #6381 | <https://github.com/tauri-apps/tauri/issues/6381> | No assumed Tauri WebGPU switch. | Reference-only; repository license not recorded. |
| Wry issue #1442 | <https://github.com/tauri-apps/wry/issues/1442> | macOS webview/Whisper freeze risk. | Named P1 risk; repository license not recorded. |
| Tauri HTTP headers | <https://v2.tauri.app/security/http-headers/> | Tauri-side COOP/COEP configuration. | Must be paired with dev-server headers and proven in P0. |

## 3. Deferred cloud and policy context

These citations inform the no-cloud-for-privileged-audio boundary and later MAP
follow-ons; they are not dependencies of `voice-composer-slice`.

| Source | URL on disk | Use |
| --- | --- | --- |
| OpenAI Realtime | <https://developers.openai.com/api/docs/guides/realtime> | Deferred transport/voice comparator. |
| xAI voice agent | <https://docs.x.ai/developers/model-capabilities/audio/voice-agent> | Deferred WebSocket voice comparator. |
| ElevenLabs realtime STT | <https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime> | Existing cloud Scribe behavior; not privileged-audio routing. |
| OpenAI Realtime VAD | <https://developers.openai.com/api/docs/guides/realtime-vad> | Deferred barge-in/turn-detection context. |
| Murf pipeline comparison | <https://murf.ai/blog/speech-to-speech-vs-stt-llm-tts> | Secondary pipeline-versus-speech-to-speech context. |
| ABA Model Rule 1.6 comments | <https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/> | Confidentiality posture context; not legal advice. |
| OpenAI data controls | <https://developers.openai.com/api/docs/guides/your-data> | Cloud-retention caveat recorded during research. |
| ElevenLabs retention | <https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention> | Cloud-retention caveat recorded during research. |

## 4. Upstream repositories and recorded licenses

| Upstream | URL status | License recorded in packet | Disposition |
| --- | --- | --- | --- |
| Kokoro-82M model | Source evidence: Xenova post above; canonical repository URL not present | Apache-2.0 | Model use/port only after artifact and attribution recheck. |
| `kokoro-js` code | Repository URL not present | **NEEDS-REVERIFICATION** | Reference-only; do not vendor or mine code. |
| Silero VAD | <https://github.com/snakers4/silero-vad> | MIT | Port-with-attribution after version/license recheck. |
| Moonshine implementation/model artifact | Repository URL not present; paper URL above | **NEEDS-REVERIFICATION** | Reference-only until P0 selects and verifies the artifact/license. |
| whisper-web | <https://github.com/xenova/whisper-web> | **NEEDS-REVERIFICATION** | Reference-only. |
| Transformers.js | Issue URL above; canonical repository URL not separately recorded | **NEEDS-REVERIFICATION** | Reference-only until dependency/version/license verification. |
| vad-web | <https://github.com/ocavue/vad-web> | **NEEDS-REVERIFICATION** | Reference-only. |
| Supertonic | <https://github.com/supertone-inc/supertonic> | **NEEDS-REVERIFICATION** | Reference-only and out of slice. |

## 5. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| Live waveform/capture | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx` | Reuse or absorb capture/visual behavior. |
| Scribe state machine | `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts`; `packages/foundation/ui-system/ui/src/components/speech-input.tsx` | UI/state-machine precedent only; do not reuse its cloud audio route. |
| Existing voice drivers | `packages/drivers/xai`; `packages/drivers/venice-ai` | Follow-on evidence only; not slice dependencies. |
| Composer seam | `apps/professional-desktop/src/chat/ui/Composer.tsx`; `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` | Reuse for controls and transcript insertion. |
| Chat cancellation precedent | `packages/agents/client/src/Chat.atoms.ts` | Reuse Reactivity/`AtomRegistry` cleanup pattern. |
| Audio event-to-stream precedent | `packages/drivers/box/src/Box.streaming.ts` | Reference scoped event release pattern. |
| Effect browser/runtime primitives | `.repos/effect-v4/packages/platform-browser`; `.repos/effect-v4/packages/effect/src/unstable/rpc` | Re-verify live APIs before implementation; use only outside AudioWorklet realm. |

## 6. Cross-links

- Research claims: [`../RESEARCH.md`](../RESEARCH.md).
- Locked decisions: [`../DECISIONS.md`](../DECISIONS.md).
- Shaped boundary: [`../BRIEF.md`](../BRIEF.md).
- Graduated map: [`../MAP.md`](../MAP.md).
- Graduated implementation ledger:
  [`../../../goals/voice-composer-slice/research/SOURCES.md`](../../../goals/voice-composer-slice/research/SOURCES.md).
