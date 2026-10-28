# Friction and opportunities

Record friction as it occurs: work, minimum command/error/file evidence,
impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

### Complete protocol checks at the supervisor boundary

While preparing accepted receipt import, source review found that
`Cache.protocol.runner.ts` checks transport-failure joins inside its worker but
only reruns the six-case observation validator in the outer supervisor. The current implementation now uses `validateCacheProtocolExecution` in the
worker, outer supervisor and producer acceptance boundary. Current protocol
tests cover relationship rejection; this historical lead is resolved in source.
It does not establish deployed trust or qualify a new computation.

## 2026-10-28: supervisor failure needs safe termination attribution

A current `cache protocol-run` attempt waited for capacity and then returned
`Protocol supervisor failed or exceeded its capture bound.` The admission gate
is already outside the runtime timeout; source inspection ruled out the initial
timeout diagnosis. Minimal namespace and no-credential protocol-module import
probes pass. The failure needs a bounded distinction between nonzero worker exit
and truncated capture, without publishing worker streams that may contain
synthetic credentials. Concrete team-ID requests are being tested against the
fixture's strict `teamId` selector contract. Owner: this goal. Repaired both supervisor diagnostics with separate bounded
exit/truncation results and private-stream regression checks. Current stable
2.11.10 and canary 2.11.9-canary.1 passed the isolated six signing and three
transport cases using concrete team IDs. Adding `--skip-infer` exposed a
zero-task fixture run; pairing it with `--single-package` restored actual
execution, and the existing no-task negative control remains enforced.
Current results are retained in `current-native-checkpoint.json`; production
trust and wrong-team native proof remain open.

## 2026-10-28: diagnostic guards must share the capture contract

The first publish preflight found two introduced complexity findings in the
controlled runner process seams and a six-line duplicated supervisor block.
The repeated synthetic private-stream conditions are consolidated through one
schema-derived fault guard. Both supervisors now consume one bounded capture
validator in the existing Cache evidence module, reusing the shared process
exit validator. No capture stream or cause is attached to these errors. The
behavioral suite and Fallow audit must pass again before publication.
