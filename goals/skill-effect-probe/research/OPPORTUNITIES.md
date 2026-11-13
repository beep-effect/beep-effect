# Skill effect probe: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-12: the archived corpus ships no known-good solutions

- **Doing:** P0 preflight for `sfv4-normalization-003`.
- **Evidence:** the archive at `94b8d15c` holds tasks, fixtures, splits and
  `DERIVATION.md`, but no solution files; `rg -il "known-good|golden"` over
  `goals/skillopt-training-pilot` finds nothing. The SPEC preflight needs one
  per task, so each has to be written by hand before any scored run.
- **Would have prevented it:** a corpus contract that requires a solution
  beside every fixture, checked by the same scorer that grades the runs.

## 2026-11-12: a natural known-good answer fails the tsgo lane

- **Doing:** the same preflight.
- **Evidence:** `export const decodeHtmlInnerText = S.decodeUnknownOption(HtmlInnerText)`
  satisfies every completion pattern but the tsgo lane reports
  `TS377101 ... has no pipeable overload ... effect(missingPipeableSignature)`.
  A one-argument wrapper passes all lanes. The task prompt does not mention
  the diagnostic, so a run without Bash cannot see it.
- **Would have prevented it:** a task prompt or completion contract written
  against the current Effect language-service rule set, rechecked when the
  rule set changes.

## 2026-11-12: six tasks require `S.Class`, which the schema-first lint rejects

- **Doing:** writing preflight solutions for all 12 tasks.
- **Evidence:** the fn-schema and getsomes-struct tasks' completion patterns
  require `export class X extends S.Class`; the schema-first lint (rule D1)
  scores a data-only `S.Class` below 1 and asks for a branded `S.Opaque`, which
  is what the live source those tasks came from now uses. A solution passes
  every lane only by adding an instance getter or method, which the lint
  exempts. Without one these tasks cap at schema-first 0.5.
- **Would have prevented it:** a corpus check that rescores every known-good
  solution whenever the schema-first rules change, so a task whose contract
  contradicts a newer law is rewritten or retired before a probe spends runs
  on it.

## 2026-11-12: a plan limit turns a 180-run invocation into 178 instant failures

- **Doing:** the first P2 attempt.
- **Evidence:** `claude plugin eval ... -j 2` kept launching runs after the
  seven-day limit was reached; 178 runs ended in about a second each with
  "You've hit your weekly limit" and a `rate_limit_event` with status
  `rejected`. `--max-cost-usd` never trips, because failed runs cost 0.
  The pre-run `beep accounts` view had shown a different account with full
  headroom marked "use next", which is not the account the eval child used.
- **Would have prevented it:** a harness option to abort on the first
  plan-limit error, and an accounts view that names the account the CLI is
  signed in to separately from the recommended next one.
