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

## 2026-11-13: an out-of-repo tool broke on a script rename

- **Doing:** the skills port (#3293), which replaced the plasma-sensitive-entry
  Python prompt helper with `scripts/prompt.ts`.
- **Evidence:** the workstation tool aws-vault-prime (in the user's local bin
  directory) ran the Python helper with `--write-fd … --title … --label … --timeout 90`
  against the primary clone. Once main reached that clone, every AWS TOTP dialog
  failed silently and the operator saw no prompt. The orchestrator patched the
  tool to call `bun …/scripts/prompt.ts` with the same flags. The repo-side
  consumer search covered only tracked files, so it could not see this caller.
- **Would have prevented it:** a documented stable entry point for helpers that
  external tools call (now in the skill's `references/integration.md`). Also a
  workstation sweep (`~/.local/bin`, `~/.config/systemd`, `environment.d`, shell
  rc, `~/.ssh/config`) for the old path in the same change that renames a
  script, or a `beep` check that greps those locations for deleted repo paths.

## 2026-11-13: photo-face lane inherited unrelated unpublished work

The supplied worktree was clean, but its starting commit was 22 commits ahead
of the remote main branch and carried unrelated Alchemy, dependency and packet
changes. Evidence: `git rev-list --left-right --count HEAD...origin/main` returned
`22 4` after fetching main. The lane preserved the original branch, committed
its own photo-face changes, then cherry-picked that single commit onto a fresh
feature branch from `origin/main`. The resulting branch was `0 1` against main.

Worktree creation should show the selected base and its unpublished-commit count
before starting an independent implementation lane. This would prevent an
unrelated parent branch from becoming part of the publication diff. No unrelated
commits were reset, deleted, or published by this lane.

## 2026-11-13: command injection must preserve static derivation

Changing the production match-person command into a factory taking a service
Layer broke two knowledge tests with `command factory arguments are not bound
string literals`. Production now uses a statically declared command definition;
the test factory only applies its service Layer to that definition. Both static
command-surface tests passed after this fix. A documented injection pattern for
commands would prevent this extra test cycle.

## 2026-11-13: local aggregate proof exceeded available compute

`quality package-verify @beep/repo-cli` spent 894 seconds in its audit and
reported twelve test, hook or watchdog timeouts, with no assertion failures.
The host's load average exceeded 90 while independent proof lanes were active.
The lane retained its passing package lint, source/test checks, 126 focused tests
and successful native CLI scans, and reran the aggregate proof. Scheduler
admission and elapsed gate time must be visible continuously rather than only
at the aggregate command's exit; this would make the workstation's ten-minute
constrained-compute rule easier to apply without starting duplicate proofs.
