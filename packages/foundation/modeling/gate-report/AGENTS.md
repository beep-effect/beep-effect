# @beep/gate-report

Gate-neutral verification report model: gate, unit and item schemas, the event reducer, classifiers and the console dispatch table

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Before handing back a change, run `bun run beep quality package-verify @beep/gate-report` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
- No repo specifics in the model: command strings (the pointer table), record and log paths, fold fix commands and the console budget arrive as data; the input fingerprint stays an opaque string (decision `model-home` in `goals/gate-report-core`).
- Depend only on `effect`, `@beep/schema`, `@beep/identity` and other `foundation/primitive` or `foundation/modeling` packages; never `@beep/github-reporting`, `@beep/cli-kit` or tooling.
- The dispatch table type is total over `RunShape` by `RunOutcome`: a new member of either needs its cells, and the console-law properties (`test/ConsoleLaws.property.test.ts`) must stay green.
- Ported code carries no per-file header; attribution lives in `LICENSE` and the README `Provenance` section.
