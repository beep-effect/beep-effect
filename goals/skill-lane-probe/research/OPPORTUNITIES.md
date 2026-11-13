# Opportunities and friction

Receipts recorded as they happened. Paths use `~` for the home directory.

## 2026-11-13: no run recipe in the first probe's packet

- Doing: P0, reusing the first probe's staging, preflight and eval commands.
- Evidence: neither `goals/skill-effect-probe/PLAN.md` nor the pilot
  READMEs record the `probe stage`, `probe preflight` or `claude plugin eval`
  argv. The archive and known-good solutions were found by searching
  `~/.cache/beep/skill-effect-probe/`; the eval flags were rebuilt from
  `claude plugin eval --help` and the pilot's result JSON.
- Prevention: each run receipt records the exact commands, with cache paths
  written relative to `~/.cache/beep/<goal>/`. This packet's receipts do.

## 2026-11-13: an Effect CLI boolean flag without a default is required

- Doing: P1, adding `--pilot` to `probe report`.
- Evidence: without `Flag.withDefault(false)`, every call that omitted
  `--pilot` printed the help text (`effect/cli/CliError/ShowHelp`). The
  manual run passed `--pilot`, so only the command test caught it.
- Prevention: the new command test calls the route without the flag; a
  lint for `Flag.Boolean` without a default would catch it earlier.
