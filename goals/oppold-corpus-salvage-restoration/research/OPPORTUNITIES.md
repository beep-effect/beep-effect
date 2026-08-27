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

## 2026-08-27 — The synthetic converter stub hid the real launcher contract

- **Doing:** proving the legacy-Word conversion sandbox against the pinned
  production toolchain before authorizing corpus writes.
- **Evidence:** the synthetic executable passed, but the real converter failed
  with `bwrap: execvp /tool/converter: No such file or directory`. The pinned
  executable is a shell launcher whose interpreter and sibling installation
  files must remain available at their original runtime paths; the sandbox had
  neither `/bin` nor that launcher layout.
- **Prevented by:** include one real-toolchain smoke in the pre-mutation proof
  and model launcher runtime roots separately from standalone test binaries.

## 2026-08-27 — Collector retry history was mistaken for unique inventory

- **Doing:** hardening P0's row-by-row collector reconciliation after the
  adversarial review requested a source-file bijection.
- **Evidence:** the immutable ledger has 22,510 successful historical rows but
  10,871 unique successful destinations; retry rows intentionally repeat a
  destination. The live aggregate has 21,489 present successful rows and
  1,021 missing rows, with no conflicting recorded sizes.
- **Prevented by:** document the collector's append-only retry semantics and
  frozen destination-prefix contract alongside its per-status denominators,
  so review asks for identity reconciliation rather than row uniqueness.

## 2026-08-27 — The tooling schema scan had no introduced-change attribution

- **Doing:** running the supplemental tooling schema convention scan after the
  authoritative schema-first baseline passed with all advisories at zero.
- **Evidence:** `bun run beep lint tooling-schema-first` exited on 201
  repository-wide findings, mostly the established dotted TypeScript filename
  convention, without identifying whether any finding was introduced.
- **Prevented by:** give the tooling scan a committed baseline or changed-file
  mode so feature work can distinguish regressions from inherited migration
  inventory.
