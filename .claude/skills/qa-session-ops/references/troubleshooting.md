# QA session troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `beep qa record --lane obs` fails with connect error naming the OBS config | obs-websocket server disabled | Flip `server_enabled: true` with OBS closed; restart OBS |
| Connect OK, auth failure | Password mismatch | Export `OBS_WEBSOCKET_PASSWORD` from `~/.config/obs-studio/plugin_config/obs-websocket/config.json` (`server_password`) |
| Portal picker pops every run | RestoreToken invalidated (portal/compositor update) | Expected — re-pick once; token persists again |
| Lane B video is black | Wrong window picked, or window minimized (PipeWire sends no frames) | Keep Chrome visible; clear the input's RestoreToken and re-pick |
| Recording never reaches STARTED | OBS busy dialog / first-run wizard on screen | Finish the wizard once; check the OBS window |
| `current.json` exists but no session running | Crashed session left a stale handle | Delete `.beep/qa/current.json` (pid check should do this automatically) |
| `/health` shows 0 events | Witness not injected, or CORS-dropped POSTs | Check `window.__beepQa` in page console; verify app origin is portless-canonical |
| `/health` shows rejected lines | Schema-invalid events (witness/collector version skew) | Rebuild: the collector bundles the witness at boot — restart `beep qa record` |
| Clock sync `assumed-start` / `low` confidence | Beacon not detected in video | Re-record with `--beacon`; ensure first paint settles before gestures; check `video/record-hint.json` exists |
| Clock sync `medium` but windows look shifted | OBS anchor only (±1 frame) plus event skew | Acceptable for hovers; for transition-timing findings prefer a beacon round |
| Extraction artifacts missing for a gesture | Window dropped by budget ladder | `report.md` + plan `dropped` list name the reason; raise `--budget-mb` or drop other scenarios |
| GIFs huge / over budget | Long gesture at high fps | Planner degrades automatically (fps→10, width→480, strip fallback); shorten the gesture instead |
| Harness exits CAPTURE-FAILURES but video exists | Real assertion failures | Fix app or harness first — never judge a failing capture |
| exiftool "not installed" error on extract | Binary missing | `sudo pacman -S perl-image-exiftool` |
| Witness events but wrong selectors | App lacks stable attrs | Add `data-qa` attributes to interactive targets (preferred) — selector builder falls back to role/nth-of-type |
