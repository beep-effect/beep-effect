# Experiment friction

## 2026-09-15: Grok turn budget ended without a report

- Work: independent adversarial Bun/Turbo configuration review.
- Evidence: Grok 1.0.30 with `--max-turns 18` returned exit 0 after research
  progress messages, without a final review artifact.
- Impact: process success did not establish completion of the requested review.
- Recovery: resumed the same review and requested immediate synthesis from
  gathered evidence, with no further tools or searches. That synthesis exceeded
  a 180-second bound and ended with exit 124 after an incomplete draft. A final
  concise continuation completed with exit 0 and an explicit end marker; its
  report is saved alongside the independent Codex review and adjudication.
- Prevention: reserve a synthesis pass in bounded research runs and validate
  the required report sections before treating exit 0 as successful delivery.

## 2026-09-15: experiment isolation needs explicit wiring

- Work: preparing a local package-runner comparison without production changes.
- Evidence: installed Turbo help has no alternate root configuration option;
  `enterRunScope` supplies attachment/accounting but no CPU or memory limits,
  and failed attachment can warn rather than fail.
- Impact: the pilot needs an isolated experimental worktree and explicit
  per-trial limit enforcement/readback. Admission alone cannot establish a
  matched resource envelope.
- Prevention: inspect installed command/API capabilities before prescribing
  an alternate configuration flag or treating scheduler estimates as hard caps.
  Keep these experiment-specific requirements in the harness; this finding
  does not authorize a shared scheduler or generator redesign.

## 2026-09-15: native command position selected a package script

- Work: launching native Bun qualification from the schema package.
- Evidence: putting `--tsconfig-override` before the `test` command launched the
  package's Vitest script, which rejected `--parallel`.
- Impact: the attempt failed in 43 milliseconds and remains in the execution
  ledger; no native-runner measurement was accepted.
- Recovery: keep `test` immediately after the Bun executable and put global
  options after the command. Verify the actual runner banner and reports.

## 2026-09-15: shared host admission contention

- Work: serial qualification under four-token admission and explicit trial caps.
- Evidence: another full-proof job reduced live capacity below the combined
  request. The scheduler also repeatedly reported an undecodable existing
  lease and quarantined it; no lease payload was inspected or copied.
- Impact: trial execution waits for admission. Queued time consumes no test
  execution budget and cannot be mistaken for runner elapsed time.
- Recovery: preserve the other job, serialize experiment requests, and enforce
  an exclusive artifact lock in the harness. Do not bypass admission or alter
  the shared slice to accelerate this experiment.

## 2026-09-15: native qualification found unsupported contracts

- Work: complete schema ordinary/property qualification before timing.
- Evidence: native Bun reached 717 ordinary and 536 property cases but failed
  `vi.resetModules` in the unsupported-Float16 runtime test. The inherited-suite
  timeout control also failed only on the candidate.
- Impact: successful case counts alone cannot establish compatible execution;
  full-package performance sampling stops at this gate.
- Prevention: preserve executable negative controls and require runtime contracts
  before promoting the adapter or interpreting elapsed-time differences.

## 2026-09-15: Bun parallel override emits an internal diagnostic

- Work: explicit alias resolution in an isolated checkout with shared installed
  dependencies.
- Evidence: Bun 1.4.2 parallel children print `Internal error: directory mismatch`
  naming the supplied `aliases.json` tsconfig override.
- Impact: configuration qualification remains incomplete even where tests pass.
  These attempts are retained as diagnostics, not accepted timings.
- Prevention: qualify a supported alias/config-loading path and child resolution
  identities before collecting confirmation samples; do not suppress the warning
  and call the configuration proven.

## 2026-09-15: coverage success did not establish correct counters

- Work: qualifying Bun-hosted Vitest coverage before changing CI launchers.
- Evidence: all four runtime/provider controls exited zero, but Bun/V8 counted
  an unexecuted break three times and an unused nullish fallback once.
- Impact: runner exit status and complete test counts cannot qualify a provider.
- Prevention: compare exact zero-hit counters and source populations, exercise
  rejection controls, and use the provider's documented runtime support boundary.

## 2026-09-15: provider reports are not interchangeable at the ratchet

- Work: applying existing per-file coverage rules to the Istanbul candidate.
- Evidence: the canonical comparison function returned zero findings for the
  saved Node/V8 schema report and 260 for Bun/Istanbul: 252 findings from 63
  omitted zero-unit source files and eight metrics on executable sources.
- Impact: a runtime-prefix rewrite alone would break the coverage gate.
- Prevention: qualify report identity and provider-specific counter differences
  before any generated command migration; retain the current baseline.

## 2026-09-15: excessive reservation delayed small qualification trials

- Work: serial follow-up qualification behind two active proof jobs.
- Evidence: all 56 completed trials peaked below 1.84 GiB, while the fixed
  reservation requested four tokens and enforced a 16 GiB memory cap.
- Impact: the first follow-up stayed queued despite much smaller measured demand.
- Recovery: cancel only the unstarted experiment loop, preserve its log, and
  use one-token admission with a verified 4 GiB hard cap for both follow-up arms.
  Keep the four-CPU/no-swap limits and record the changed envelope in receipts;
  never pool measurements across resource envelopes.

## 2026-09-15: scratchpad documentation participates in the full gate

- Work: preparing the experiment and provider repair for a mergeable PR.
- Evidence: `beep yeet repair` passed build, check, and tests but failed docgen
  because newly added adapter exports lacked descriptions and examples. The
  next package check exposed TS2883 on the inferred `expectTypeOf` export.
- Recovery: document the public helpers with 49 compiled examples and annotate
  the export as `typeof bt.expectTypeOf`; package docgen then passed.
- Prevention: include the scratchpad's actual docgen/declaration settings in
  qualification; a focused no-emit check alone does not prove portable exports.

## 2026-09-15: quick package checks need built references

- Work: validating the one-line inherited CLI lint repair in a fresh worktree.
- Evidence: the quick package check emitted TS6305 for absent upstream
  declaration outputs, followed by derived type errors.
- Recovery: build the CLI's upstream graph through the canonical build command,
  then rerun its quick verification; both lint and check passed.
- Prevention: build referenced projects before selecting the quick verification
  subset in a fresh dependency installation.
