# Warning evidence and current P0 audit

The supplemental text observer now retains warnings. Its previous focused
projection omitted the skip-mode warning, so that projection could not prove
warning coverage. This checkpoint fixes the evidence gap; it does not infer
target diagnostic behavior from the oracle logger.

## Explicit warning observations

The fixture advances to `citation-supplemental-extraction/v3`, and the authored
text plan advances to `citation-supplemental-text-plan/v2`. Every one of the
twenty-six text observations requires a warning array, including empty arrays.
The selected probes emit exactly one warning: the annotation skip case, with
logger `eyecite.annotate`, severity `WARNING`, its original message template and
the original argument list. Interpolated text is not substituted for the
template. The validator compares the complete observation with the plan.

The source-bound observer installs an additive handler and removes it in
`finally`, alongside restoration of the mapping method. It captures warnings
at or above the warning level and rejects unclassified message/argument shapes.
Unexpected severity or content cannot pass the frozen schema and plan. Its
handler prevents the default last-resort logger from printing this synthetic
warning during export, without changing logger levels or unrelated handlers.
The observer's hash remains part of the bundle's provenance.

Two independent generations were byte-identical and matched the committed
value: 31,039 bytes, SHA-256
`4f462b83f10b124db4768743b0131b30954a085a0c93197be7232e0de0f0abc9`.
The thirty-nine probes and eighty coordinate records are otherwise retained.
There is no production source-text logging authorization: future engine
diagnostics must translate/redact this observation under the privacy contract.

## Consumer anchor boundaries

Two focused tests in `CitationPrerequisites.test.ts` now bind these observations
to the published prerequisite contracts:

- Locating the citation in the repeated source fails with reason `ambiguous`.
  The failure message omits the citation text. The oracle's choice of the first
  occurrence therefore cannot serve as the prerequisite's uniqueness proof.
- A collapsed `[9,9)` annotation point fails the nonempty `TextOffsetRange`
  schema. It remains a rendering boundary, not a verified citation occurrence.

These tests preserve the existing contract; they do not introduce a new span
type, choose an occurrence or approve a target divergence. A verified mention
requires raw-source proof. Annotation output remains a separate observable
projection. The complete target request/result design must reconcile both
requirements before claiming readiness.

## P0 evidence audit

This is a current artifact audit, not a phase-completion declaration.

| Requirement | Evidence | Remaining |
| --- | --- | --- |
| Official pin/license | Baseline and corpus | Preserve provenance. |
| Authorized donors | Frozen suites/ledger | Final dispositions and proof. |
| Source/runtime sets | Inventories/controls | Target case completion. |
| Prerequisites | Compatibility/tests | Preserve public proof contracts. |
| Limits/strategy | Policy/process controls | Runtime and family safety. |
| Portable command | Eight component audits | Three final verifiers. |
| Supplemental cases | 39 probes and warnings | Five open coverage families. |
| Divergence ledger | Recorded fidelity questions | Artifact/checker absent. |
| Regex corpus/metadata | Inventory/process probe | Family contract absent. |

The inventories independently reconcile source and runtime evidence. Their
source-accounting proof does not establish target execution. Likewise, the
owned-process mechanism probe does not supply the required per-family
adversarial corpus or benchmark metadata. The required schema-decoded
`divergences.json` and its independent checker are not yet present. Both
prerequisites are available; version, capability and raw-source obligations
remain binding.

P0 must not be declared complete from the current audit. Its next concrete work
is the missing divergence accounting and adversarial/benchmark artifacts, with
their negative controls and manifest entries. Final target tests, terminal
dispositions and exhaustive regex/semantic proof remain delivery requirements;
audit mode does not turn those into green completion evidence. No phase status,
goal status or hosted readiness is promoted by this note.

The manifest is updated to register the package audit/completion commands,
supplemental validator/producers and rejection controls. Its former seven-
validator status note is replaced with the current eight-component scope and
explicit remaining work. Operative lifecycle remains active.

## Verification

The supplemental audit and default rejection passed. All sixty-six corruption
controls passed, including absent empty-warning arrays, dropped/duplicated
warnings, altered templates/arguments/logger/severity, unclassified argument
shapes and the old warning-free bundle version. Mutated payloads are rehashed
so semantic checks must reject them.

Package audit/docgen, the standalone command type check, both package audit
baselines and thirteen command rejection controls passed. Formatting, Markdown,
manifest syntax, diff and commit checks cover the authored checkpoint. The
packet doctor initially found seven unregistered existing TypeScript scripts;
all seven are now registered. Its rerun passed with no new blocking findings.
Unrelated existing completion advisories are not promoted to green claims.
Supporting logs are under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`:
`warning-check.log`, `warning-controls.log`, `warning-parity-controls.log`,
`warning-package-verify.log`, `warning-typecheck.log`, `warning-markdown.log`
and `warning-goals-doctor.log`.
