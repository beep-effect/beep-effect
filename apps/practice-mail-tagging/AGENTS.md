# @beep/practice-mail-tagging

Practice mail-tagging job: tags the attorney mailbox by matter and files attachments.

## Surface

- This app publishes no `@beep/practice-mail-tagging` source exports — do not add package root exports or docgen unless it is intentionally converted to a runtime proof package.
- `src/bin.ts` is the executable; `src/runtime/Layer.ts` holds the process wiring; the commands stay thin.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this app; record only genuinely app-specific deltas here.
- Tests never reach Microsoft 365, Box, or a real knowledge-graph bundle: use the in-memory platform and stubs in `test/PracticeMailTagging.fixture.ts`.
- Logs carry ids, counts, and status text only. A matter key may appear on standard output of an attended command, never in a log line.
- `deploy/practice-mail-tagging.service` is a sample. Nothing installs it; never add an installer.
