# Voice Composer Slice Spec

## Objective

Give the professional-desktop composer an all-device English voice slice: local
Moonshine push-to-talk dictation inserts text into the existing composer, and a
manual speaker button on each completed agent turn starts interruptible local
Kokoro read-aloud. A five-engineering-day Linux Tauri spike is the fail-fast P0
gate; production-quality implementation begins only after a recorded proceed
decision.

## Non-Goals

- Cloud routing for privileged audio or any audio network egress.
- Automatic or streaming read-aloud; only manual completed-turn playback ships.
- Provider-switching UI or a general production provider-port platform.
- Voice-to-voice, speech-to-speech, or WebRTC voice sessions.
- Native Rust/cpal capture.
- Multilingual local models.
- Chat-domain schema changes or sidecar-protocol changes.
- Premature extraction of reusable capture or inference-worker platforms before
  a second consumer exists.

## Source Hierarchy

1. The user-ratified 2026-07-14 decisions and
   [`BRIEF.md`](../../explorations/local-first-voice/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The source exploration, `research/`, `ops/`, and `history/` artifacts.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/professional-desktop` Tauri/webview configuration, runtime wiring, chat
  composer, and completed-turn message UI.
- `packages/foundation/ui-system/editor` and the narrow shared UI/audio seams
  already used by the professional-desktop composer.
- Focused tests, P0 measurement/evidence, packet history, and required docs.
- Fixed local Moonshine/Kokoro worker, capture, cache/recovery, and playback
  code only where the thin slice needs it.

## Constraints (locked and normative)

1. P0 runs on Linux development Tauri/WebKitGTK, the user's daily machine, and
   ends after five engineering days even if a threshold remains unmet.
2. Do not assume `tauri://` is a secure context. Use the localhost delivery path
   and prove `window.isSecureContext` on the P0 target.
3. Effect stays out of the AudioWorklet realm. The worklet is a thin frame
   poster; resampling, PCM conversion, orchestration, and effects run outside it.
4. Configure and prove COOP/COEP consistently in Tauri and the development
   server wherever the selected WASM runtime needs cross-origin isolation.
5. Cancellation, push-to-talk release, and React unmount route through
   Reactivity/`AtomRegistry` lifecycle so media tracks, `AudioContext`, worker
   operations, and playback release deterministically.
6. First-run model handling includes visible progress, bounded download/load,
   persistence or cache reuse, interruption/failure recovery, and a re-download
   path. Do not grow this into a general OPFS/model-lifecycle platform.
7. Privileged audio never routes to cloud services. P0 and P1 must show zero
   audio network egress; existing xAI, Venice, ElevenLabs, or OpenAI drivers are
   not slice dependencies.
8. P0 uses the minimum architecture needed to measure capture, model loading,
   one local worker, Moonshine/Kokoro invocation, composer insertion, playback,
   egress, and teardown. Production ports, provider selection, and generalized
   worker/capture abstractions are out.
9. P1 must check macOS/WKWebView and Windows/WebView2 risks before ship. The
   macOS check explicitly resolves the hardened-runtime versus App Sandbox
   microphone-entitlement fork. P0 does not claim cross-platform proof.
10. Read-aloud is user-initiated on completed agent turns and interruptible.
    Streaming or automatic policy belongs to a follow-on goal.
11. Composer insertion reuses existing UI/state seams and requires no chat-domain
    or sidecar-protocol change.

## Decision Log

Rationale and rejected options remain in the exploration rather than being copied.

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-14 | Graduate one combined slice; move the spike into fail-fast P0; require proceed/reshape/stop before P1 on any failed threshold. | [`DECISIONS.md` — graduation-path](../../explorations/local-first-voice/DECISIONS.md) |
| 2026-07-14 | P0 target is Linux development Tauri/WebKitGTK; macOS and Windows are named P1 pre-ship risks. | [`DECISIONS.md` — spike-target](../../explorations/local-first-voice/DECISIONS.md) |
| 2026-07-14 | Manual, interruptible speaker button on completed agent turns; no auto/streaming read-aloud. | [`DECISIONS.md` — read-aloud-ux](../../explorations/local-first-voice/DECISIONS.md) |
| 2026-07-14 | Five-day cap and quantitative load, latency, teardown, egress, and seam thresholds. | [`DECISIONS.md` — p0-thresholds-and-timebox](../../explorations/local-first-voice/DECISIONS.md) |

## Acceptance Criteria

- [ ] P0 is completed within five engineering days and its evidence records a
      proceed/reshape/stop decision under `history/`.
- [ ] First model load completes in at most 15 seconds with visible progress.
- [ ] Cached model loads complete in at most 3 seconds.
- [ ] For at most 10 seconds of speech, the Moonshine transcript appears in the
      composer at most 2 seconds after push-to-talk release.
- [ ] Manual Kokoro read-aloud produces first audio at most 1.5 seconds after the
      completed-turn speaker action and playback can be interrupted.
- [ ] The operating-system/webview microphone indicator clears at most 500
      milliseconds after push-to-talk release and after component unmount.
- [ ] Network inspection proves zero audio egress during model load, capture,
      transcription, synthesis, playback, release, and unmount.
- [ ] Transcript insertion works without chat-domain or sidecar-protocol changes.
- [ ] Teardown evidence proves media tracks stop, audio resources close, in-flight
      voice work cancels, and playback buffers release on release/unmount.
- [ ] P1 pre-ship evidence names the observed macOS/WKWebView and Windows/WebView2
      behavior and resolves the macOS entitlement branch.
- [ ] Focused tests and repo quality checks pass; Yeet reports the PR work mergeable.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| P0 decision gate | Dated `history/` note containing measurements and proceed/reshape/stop | Exists before P1 starts |
| Model load | Instrumented first and cached load timings | ≤15s with progress; ≤3s cached |
| Dictation latency | Timestamped ≤10s utterance runs on Linux development Tauri | Transcript inserted ≤2s after release |
| Read-aloud latency | Timestamped completed-turn speaker action | First audio ≤1.5s; interruption proven |
| Mic teardown | Release and unmount recording/automation evidence | Indicator clears ≤500ms and resources close |
| Audio egress | DevTools/transport capture covering voice flows | Zero audio network egress |
| Seam integrity | Diff plus focused tests | No chat-domain or sidecar-protocol change |
| Cross-webview risk | P1 evidence note | macOS/WKWebView, entitlement fork, and Windows/WebView2 checked |
| Launcher size | `test "$(wc -m < goals/voice-composer-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/voice-composer-slice/ops/manifest.json` | Passes |
| Packet references | `rg -n "voice-composer-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/voice-composer-slice` | Expected references present |
| Whitespace | `git diff --check -- goals/voice-composer-slice explorations/local-first-voice explorations/ATLAS.md` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at P3 close |

## Stop Conditions

- P0 reaches the five-engineering-day cap. Record proceed/reshape/stop; do not
  continue tuning under P0.
- Any P0 threshold fails. P1 is blocked until the failure and an explicit
  proceed/reshape/stop decision are recorded in `history/`.
- The slice requires cloud audio routing, a chat-domain or sidecar-protocol
  change, native capture, multilingual models, general provider infrastructure,
  auto/streaming read-aloud, or another named non-goal.
- Required sources are missing or decision-invalidating drift is found.
- Implementation requires an unapproved dependency/lockfile, security, auth,
  infrastructure, destructive-state, credential, cost, or policy change.
- Required zero-egress, teardown, on-target runtime, or cross-webview pre-ship
  evidence cannot be produced.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
