---
"@beep/repo-cli": patch
---

Quality lane runner gains TS2589 flake-quarantine semantics: when a `quality:build`/`quality:check` lane fails and the only error output is the no-location `error TS2589` signature of the TS7 native-compiler scheduling flake, the runner reruns each attributed package standalone once (lane environment preserved, so an inherited `TURBO_FORCE` keeps the rerun a real execution instead of a cache replay) plus the whole lane once (cache-resumed with `TURBO_FORCE` stripped); if both come back green the proof stays green and the incident (package, task, timestamps, durations) is recorded in `.beep/yeet/flake-quarantine.json` and surfaced in the yeet verdict as `flakeQuarantine` — read only after a successful pre-push proof step in the same run. Located TS2589s, mixed diagnostics, unattributed errors, truncated captures, more than three failed tasks, or any rerun failure keep the failure hard; CI runs are unaffected.
