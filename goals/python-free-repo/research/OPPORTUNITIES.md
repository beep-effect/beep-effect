# Python-free repo: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: consumer search skipped hidden directories

- **Doing:** P0 triage, finding a runtime consumer for each tracked `.py`.
- **Evidence:** `rg -l --fixed-strings <basename> .` reported no live consumer
  for `goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.py`.
  `rg` skips dot-directories by default, so `.github/workflows/heavy.yml`, which
  runs the script twice in `producer-inspect`, was not searched. A rerun with
  `--hidden` found it before anything was deleted.
- **Would have prevented it:** a `beep` reverse-reference query
  ("who names this path?") that always covers `.github/`, `.claude/`, `.codex/`
  and `lefthook.yml`. That is the triage step SPEC's Constraints section
  describes, and every graduation and deletion packet needs it.
