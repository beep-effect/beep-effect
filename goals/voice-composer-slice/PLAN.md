# Voice Composer Slice Plan

## Status

Status: `pending` — P0 spike is the next and only authorized execution phase.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Spike | pending | In at most five engineering days on Linux development Tauri/WebKitGTK, build only enough capture, worker/model load, composer insertion, Kokoro playback, instrumentation, and teardown to test the locked bet. | A dated `history/` note records every threshold and an explicit proceed/reshape/stop decision. P1 remains blocked unless that decision authorizes it. |
| P1 Implement | pending (blocked by P0) | After an explicit P0 proceed, turn the proven path into the production-quality thin slice: local push-to-talk Moonshine insertion plus manual, interruptible completed-turn Kokoro playback. Check macOS/WKWebView, the entitlement fork, and Windows/WebView2 before ship. | Slice behavior and focused tests meet `SPEC.md`; privacy, lifecycle, recovery, and cross-webview risks have evidence; no named non-goal entered scope. |
| P2 Verify | pending | Run focused and repo-wide proof, repeat the quantitative acceptance sweep on the supported target, and archive evidence. | Every `SPEC.md` acceptance item is checked or a blocker is recorded; `bun run beep yeet verify` is green. |
| P3 Close | pending | Publish/monitor through Yeet, respond to review, write the closeout reflection, and synchronize packet status/evidence. | PR work is mergeable, packet state is current, and a schema-valid closeout reflection exists. |

## P0 Spike Contract

- Hard cap: five engineering days; no silent extension.
- Target: Linux development Tauri/WebKitGTK on the user's daily machine.
- First model load: ≤15s with visible progress.
- Cached model loads: ≤3s.
- Dictation: for ≤10s speech, transcript in composer ≤2s after release.
- Read-aloud: first audio ≤1.5s after the completed-turn speaker action.
- Teardown: mic indicator clears ≤500ms after release and unmount.
- Privacy: zero audio network egress, verified rather than assumed.
- Seam: composer insertion without chat-domain or sidecar-protocol changes.
- Deliverable: `history/<YYYY-MM-DD>-p0-spike-decision.md` with measurements,
  failures/caveats, and exactly one disposition: **proceed**, **reshape**, or
  **stop**. Any failed threshold forces this gate before P1.

P0 is not production implementation. It may use deliberately local, fixed-model
seams and the minimum cache/recovery needed to measure the bet. It must not create
provider platforms, a general worker/capture framework, auto/streaming TTS, or
cross-platform scope.

## P3 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained`):

1. Write a closeout reflection via `/reflect` (or copy
   `history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` lifecycle/phase/evidence.
4. Confirm Yeet/GitHub evidence shows the PR work mergeable.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Start from `research/SOURCES.md`; re-verify model artifacts, runtime APIs, and
  licenses before dependency or implementation choices.
- Archive timing, egress, teardown, platform, and decision evidence under
  `history/`; do not record privileged audio or secrets.
- A reshape decision changes the contract before P1; it does not authorize
  silent scope growth.

## Verification Commands

```sh
test "$(wc -m < goals/voice-composer-slice/GOAL.md)" -le 4000
jq . goals/voice-composer-slice/ops/manifest.json
rg -n "voice-composer-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/voice-composer-slice
git diff --check -- goals/voice-composer-slice explorations/local-first-voice explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
