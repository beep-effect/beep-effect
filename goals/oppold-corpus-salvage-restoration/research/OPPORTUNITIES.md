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

## 2026-08-27 — A concurrent sync captured unrelated workspace configuration

- **Doing:** checking the feature branch and preservation inputs immediately
  before the approved P0 archive run.
- **Evidence:** `git show --stat HEAD` showed 12 `.codex` configuration, agent,
  and hook paths in a concurrent sync commit even though those paths were
  outside this packet's publish intent.
- **Prevented by:** make sync helpers preserve unrelated dirty paths and require
  a named-path index before committing; run the final proof and publication
  from an isolated clean checkout built only from the packet's reviewed paths.

## 2026-08-27 — Synthetic rows hid the collector's status-specific wire shape

- **Doing:** starting the approved P0 preservation run against the inherited
  collector ledger.
- **Evidence:** preflight rejected all 5,986 `error` rows and 12
  `excluded-secret` rows because the initial schema required `dst` and `size`
  for every status. The real ledger records those fields only for the 22,510
  successful `copied` and `resumed` rows.
- **Prevented by:** freeze one sanitized example for every external status and
  decode those exact shapes in the pre-mutation test suite; model the ledger as
  a status-tagged union so fields required only by successful rows cannot leak
  into inherited-loss variants.

## 2026-08-28 — Hosted coverage surfaced only after the first publish

- **Doing:** closing hosted CI on the first coherent restoration PR while
  keeping the local proof and coverage authority separate.
- **Evidence:** `Heavy / Coverage Regression` reported that the new restoration
  implementation paths lowered the CLI package's historical line, branch,
  function, and statement baselines. The local targeted suite was green, but
  the hosted report was the first gate to expose the package-level deficit and
  recommended rewriting the baseline rather than identifying the missing
  behavioral cases.
- **Prevented by:** add a scheduler-admitted, changed-file coverage preview to
  Yeet before publication, with uncovered source locations and an explicit
  operator-authorization gate for any baseline rewrite.

## 2026-08-28 — Yeet rejected the residue-safe repair flag

- **Doing:** running the canonical repair pass against an explicitly staged
  review-fix slice.
- **Evidence:** `bun run beep yeet repair --staged-only` exited before repair
  with `Unrecognized flag: --staged-only`, although the publish workflow uses
  staged-path isolation to protect unrelated workspace residue. The supported
  `--tier review-fix` fallback then crossed from 12/12 passing cheap gates into
  full docgen across 137 packages, so it had to be interrupted before running
  outside the scheduler lane.
- **Prevented by:** either support `--staged-only` consistently across repair
  and publish or have Yeet print the residue-safe replacement command and its
  proof expansion when a workflow flag is unavailable; heavyweight repair
  phases should acquire the same scheduler admission as publish.
