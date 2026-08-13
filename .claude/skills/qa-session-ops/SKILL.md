---
name: qa-session-ops
description: >
  Run and troubleshoot `bun run beep qa` recording sessions: record / extract /
  report subcommands, lane choice (playwright recordVideo vs OBS obs-websocket
  against real Chrome), OBS provisioning (websocket enable, PipeWire portal
  restore-token, scene setup), and collector/witness debugging. Use when a QA
  capture will not start, produces no events, records a black window, or you
  must pick a recording lane. The loop protocol itself lives in
  `browser-qa-loop`; this skill is the machinery under it.
version: 0.2.0
status: active
---

# QA Session Ops

`browser-qa-loop` owns *when and how to run the loop*. This skill owns *making
the machinery work*: lanes, OBS, the event collector, and the witness.

## Quick health check

`bun run beep qa doctor` — probes ffmpeg/ffprobe/exiftool presence,
obs-websocket reachability (127.0.0.1:4455), and playwright. Exit 1 on
required-missing. `resources/qa-env-doctor.sh` is the standalone fallback when
the CLI itself is broken.

## Lane choice

See `references/lane-selection.md` for the decision table. Short version:
Lane A (playwright) for every loop round — deterministic, headless, CI-able.
**Lane B (OBS) is deprecated as of 2026-08-01** — it cannot run unattended
(the PipeWire portal requires human consent by design) and silently records
black video when its restore token goes stale. Its replacement for native
drag, cursor, and OS-selection classes is Lane C (Xvfb + `xdotool` XTEST +
`ffmpeg x11grab` + CDP), proven as a prototype but not yet shipped as a CLI
lane; see `browser-qa-loop` and the `recorded-qa-acceptance` packet.

## OBS provisioning (Lane B — deprecated, existing sessions only)

1. obs-websocket server: `server_enabled: true` in
   `~/.config/obs-studio/plugin_config/obs-websocket/config.json` (edit with
   OBS **closed** — OBS rewrites the file on exit) or OBS → Tools →
   WebSocket Server Settings. Port 4455; password lives in that file —
   export it as `OBS_WEBSOCKET_PASSWORD` for the driver, never commit it.
2. Scene: `beep qa record --lane obs` provisions the `beep-qa` scene and
   window-capture input idempotently via `@beep/obs` `ensureQaScene` — do not
   hand-build scenes. On Wayland the input is `pipewire-screen-capture-source`:
   the FIRST run pops the portal window picker (pick the Chrome window);
   OBS persists the `RestoreToken` in the input settings and later runs reuse
   it. A stale token (compositor/portal update) just re-pops the picker —
   that is expected, not an error.
3. OBS need not be running — `ensureRunning` spawns `obs --minimize-to-tray`
   detached and retry-connects. First-ever OBS launch shows the onboarding
   wizard once (manual step).

## Collector / witness debugging

- Collector runs inside `beep qa record` at `http://127.0.0.1:43117`
  (`--port` to override): `GET /health` (event count), `GET /witness.js`,
  `POST /events`, `POST /mark`, `POST /stop`. A live session writes
  `.beep/qa/current.json` (pid + port); `beep qa stop` and `beep qa mark`
  discover it there. Stale handle after a crash → delete the file.
- No events flowing? Check in order: (1) `curl 127.0.0.1:43117/health`;
  (2) witness actually injected — `window.__beepQa` defined in the page
  console; (3) CORS — the collector allows the portless app origins; a raw
  `localhost:<port>` origin outside the allowed set is silently dropped by
  the browser; (4) events are `text/plain` NDJSON POSTs — a proxy rewriting
  content-type breaks decode (rejects are counted in `/health`).
- Black/empty Lane B video: the portal picked the wrong window, or the window
  is minimized (PipeWire delivers no frames) — keep the Chrome window visible;
  re-pick via `ensureQaScene` after deleting the input's RestoreToken.
- Clock-sync confidence `low` in `report.md`: the beacon was not detected
  (heavy first-paint delay, or beacon disabled). Extraction still ran with
  +250 ms window padding; re-record with `--beacon` on and a settled page for
  precise windows. See `references/troubleshooting.md` for the full table.

## Worktree / parallel lanes

Portless names are machine-global and duplicate registration fails loudly.
Concurrent lanes use lane-suffixed names
(`portless storybook-<lane>.beep sh -c '...'`); never `--force` over another
lane's route. One recording session per checkout at a time (pid-checked
`current.json`).

## Environment notes

- The `chrome-devtools` MCP (slim, default-disabled in settings) attaches to
  the QA Chrome via `--browser-url` for perf traces and computed-style
  introspection — enable it for the session, keep it disabled otherwise.
- Evidence reading is `motion-evidence-review`; artifact provenance lives in
  XMP-beepQA tags (inspect with `exiftool`/`ffprobe`).
