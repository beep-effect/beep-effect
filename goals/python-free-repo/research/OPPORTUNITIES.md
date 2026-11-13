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

## 2026-11-13: consumer filter excluded tests and packet ops TypeScript

- **Doing:** P1 probe deletion, PR #3296.
- **Evidence:** the triage counted a match as a live consumer only under
  `.github/`, `src/`, skills, hooks, package manifests and `ops/manifest.json`.
  beep-reviewer round 1 (2/5) then found five law-practice-server unit tests,
  the regex-translator integration child (`ops/qualify-regex-translator.child.mjs`),
  `citation:parity-check` (`ops/check-*.ts`) and a turborepo refresh script still
  reading deleted `.py` producers to compare pinned digests. Any of those files
  named the deleted basename, so the raw search had found them; the filter dropped them.
- **Would have prevented it:** treating every executable file (`*.ts`, `*.mjs`,
  `*.js`, `*.sh`, workflows, package scripts) that names a file as a consumer by
  default, and showing only data and prose matches as "recorded evidence".
