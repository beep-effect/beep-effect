# Six-form hosted coverage repair

Hosted Coverage Regression job 128767990839 on PR #2966 failed after all unit
shards passed. Existing floors regressed in ExtractionEntry, ResolutionInput and
Snapshot; the new extractor result model also had untested identity/count filters.
The failure is owned by this lane. No timeout, assertion or existing floor is lowered.

## Repairs and proof

- The raw extraction entry now tests ordinary oversized input, missing named
  cleaner plans and malformed installation, in both existing runtime replays.
  Its focused measurement exceeds the committed floors: lines 97.91%,
  statements 96.15%, functions 83.33%, branches 100%.
- Strict resolution rejects reversed supported occurrences even when the
  excluded stream is empty. Identical evidence-failure factories are shared
  without changing the closed reason. The focused retained/strict run fully
  covers ResolutionInput.
- A defective installed Digest is refused without returning an artifact or
  exposing its private cause. Snapshot's newly missed digest mapper is covered;
  its other uncovered focused branch was already covered in hosted evidence.
- Genuine source proofs exercise the extractor result filters. Wrong source,
  forged proof, artifact, source ceiling and completion count are refused. The
  model has 100% focused lines/statements/branches/functions coverage.
- Seven projection controls verify malformed, disordered, overlapping and
  out-of-source observations, Id./supra lexical evidence, combined candidate
  accounting, genuine excluded barriers and the exact aggregate quote boundary.
- Direct socket controls exposed a real dropped-write defect: Queue.offer
  returns false on an ended queue. The adapter now checks that supplied result
  and fails closed instead of accepting discarded bytes. Its focused coverage
  is 100% on every metric. EOF/read failures, sticky write failure, ordered
  writeAll and CloseEvent are exercised.
- Public Layer controls reject runtime/vocabulary mismatches, redact resolver
  defects, preserve internal interruption and map a typed parser failure over
  real supplied RPC transport after confirmed retirement. The narrow parser
  failure fixture proves error transport, not donor parsing.
- Worker controls refuse invalid runtime and non-string source before spawn,
  and redact failed independent exit acknowledgement after actual child exit.

The four parent-boundary suites pass 48 tests. Seven retained/input/artifact
suites pass 50 tests. Five extractor-model tests pass. These are separate runs,
not a full package coverage claim. Server/use-case test types and quick package
lint/check verification pass. Frozen profile labels remain unchanged.

## Residual new-file review

A separate reviewer checked the downloaded hosted counters against source and
actual child controls. Only the Bun/Node launchers and RecognizerWorkerProgram
are child-only instrumentation gaps. Real Bun/Node frozen-profile execution,
response-size refusal and physical retirement provide their behavioral proof.
Parent code was not classified as child-only.

After focused repairs, reviewed parent residuals are: the fixed canonical
vocabulary's failure arm and built-in RegExp index invariant; the Layer's final
cross-owner result invariant guard; the worker's source-limit protocol arm
behind the same parent preflight; and required Socket writer-interface paths
not used by the installed binary RPC protocol. Ordinary semantic branches omitted
by this focused subset are covered by the frozen-profile hosted suite.

These findings support reviewing measured new rows, not lowering existing
floors or calling the hosted comparison green. The fresh complete hosted merge
must establish the current measurement before canonical additions-only adoption.
No baseline is changed in this repair batch.
