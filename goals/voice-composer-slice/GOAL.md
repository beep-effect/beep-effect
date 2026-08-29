# GOAL: ship local voice in the professional-desktop composer

Repo root: the current `beep-effect` working directory. All paths are repo-relative.

Outcome: the professional-desktop composer has local push-to-talk Moonshine
dictation and manual, interruptible Kokoro read-aloud on completed agent turns,
proven on-device and shipped only after its bounded spike gate passes.

Read these as the detailed contract:

- `goals/voice-composer-slice/README.md`
- `goals/voice-composer-slice/SPEC.md`
- `goals/voice-composer-slice/PLAN.md`
- `goals/voice-composer-slice/ops/manifest.json`
- `goals/voice-composer-slice/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, and standards named by `SPEC.md`.

Scope:

- In: Linux development Tauri/WebKitGTK P0 proof; narrow professional-desktop
  composer and completed-turn UI; thin Web Audio capture/worklet, resample/PCM,
  fixed local worker/model cache, playback, lifecycle wiring; focused tests and
  packet evidence; P1 macOS/WKWebView and Windows/WebView2 pre-ship checks.
- Out: cloud audio, auto/streaming read-aloud, provider-selection platforms,
  voice-to-voice, native capture, multilingual models, chat-domain or sidecar-
  protocol changes, and capture/worker extraction without a second consumer.

Workflow:

1. Inspect the source exploration, packet docs, provenance ledger, and live repo.
2. Execute P0 only: a five-engineering-day Linux Tauri spike measuring every
   locked threshold in `SPEC.md`.
3. Record `history/<date>-p0-spike-decision.md` with measurements and exactly one
   disposition: proceed, reshape, or stop. If any threshold fails, do not begin
   P1 until that explicit decision is recorded.
4. Only after proceed, implement the thin slice, check named macOS/Windows risks,
   and keep privileged audio on-device.
5. Preserve unrelated changes; keep decisions tied to files, tests, recordings,
   network inspection, or command output; update packet evidence/status.
6. Run focused proof and `bun run beep yeet verify`, publish/monitor to mergeable,
   then write the P3 `/reflect` closeout and pass reflection lint.

Locked P0 thresholds:

- first model load ≤15s with visible progress; cached loads ≤3s;
- ≤10s speech produces composer text ≤2s after push-to-talk release;
- read-aloud time-to-first-audio ≤1.5s and playback is interruptible;
- mic indicator clears ≤500ms after release and unmount;
- zero audio network egress;
- composer insertion without chat-domain or sidecar-protocol changes.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] Required checks pass, or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/voice-composer-slice/GOAL.md)" -le 4000
jq . goals/voice-composer-slice/ops/manifest.json
git diff --check -- goals/voice-composer-slice explorations/local-first-voice explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

Stop on the P0 cap or failed threshold and record proceed/reshape/stop. Also stop
before entering a named non-goal, changing public API/schema/auth/infra,
adding dependencies or lockfile changes not explicitly approved by `SPEC.md`,
touching destructive state, or proceeding without required egress/teardown proof.

Done only when acceptance passes and Yeet reports the PR work mergeable, or when
the packet records a supported reshape/stop or blocker with evidence.
