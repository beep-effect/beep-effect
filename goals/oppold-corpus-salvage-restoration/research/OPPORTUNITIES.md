# Oppold Corpus Salvage Restoration — friction ledger

Receipts recorded while executing this packet, per `AGENTS.md`.

## 2026-08-27 — Yeet's Fallow packet hid the actionable locations

- **Doing:** running `bun run beep yeet repair` before the tooling baseline
  commit.
- **Evidence:** the cheap-gates envelope reported 18 introduced Fallow findings,
  but the generated Yeet packet categorized the failure as
  `effect-tsgo-policy` against `repo` and contained no Fallow file, symbol, or
  line. The locations were recoverable only by extracting the nested first-line
  JSON from `.beep/fallow/raw/audit.check.combined.txt`.
- **Prevented by:** preserve Fallow's structured path, symbol, line, metric, and
  attribution fields in the Yeet issue index and route the packet to a
  complexity/duplication fixer instead of the Effect tsgo fallback.

## 2026-08-27 — The wrong test runner disguised passing assertions as timeouts

- **Doing:** attributing focused libpff proof after the restoration boundary
  changes.
- **Evidence:** every process-backed case completed all of its assertions and
  then reported `test timed out ... before its done callback was called` while
  consuming CPU in teardown. The behavior reproduced from `origin/main`, but
  only under direct `bun test`; the package-authoritative
  `bunx --bun vitest run` completed the same focused suites with 30/30 and
  19/19 passing tests.
- **Prevented by:** route focused test suggestions through each package's
  `beep:test` script (or its exact Vitest runner) so Effect's scoped test
  adapter is never executed through Bun's incompatible native callback path.
