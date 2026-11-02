# Actual attorney authority and review-import integrity

Date: 2026-10-31

The operator explicitly reports that attorney review is not available yet. No legal verdicts, positive-reference agreement, adjudicated false-positive rate or confidence interval are recorded. The current 30-claim v2 packet remains readable and blank; its files, earlier packets and every previous measurement are unchanged.

## Defect and correction

The allowed-review summarizer previously accepted a complete version-bound answer file and could emit an adjudicated point estimate/interval without an explicit actual-attorney submission confirmation. Binding a file to the correct source does not authenticate who supplied its answers. That distinction must be explicit before the first real export arrives.

The summarizer now emits schema `claim-allowed-adjudicated-summary/v2`. Without explicit confirmation that an attorney personally supplied the exact submitted export, `actualAttorneyAdjudicationRecorded` remains false and both the adjudicated point estimate and interval remain null, even if every response is filled. Response classifications and unresolved bounds remain diagnostics of supplied answers, not proof of human judgment. The output states that file validation cannot authenticate a person.

Once actual attorney review is available, the task submission must explicitly establish that provenance. Only then may the importer use `--human-attorney-ref R1` (an anonymous reference, never a personal name). This is an admission assertion based on the actual task submission, not cryptographic identity verification. The option must never be used to promote synthetic or interface-preview data; recognized preview/synthetic markers and non-attorney roles are rejected. Existing v2 review exports remain usable without editing the immutable interface or repeating the review: actual submission confirmation supplies the missing authority assertion at import time.

```sh
# Validation/diagnostics only; never claims actual attorney authority.
python3 goals/claim-element-antecedent-check/research/summarize-allowed-verdicts.py \
  goals/claim-element-antecedent-check/history/allowed-review-v2/packet.json \
  submitted-review-export.json

# Only after explicit actual-attorney confirmation for that exact export.
python3 goals/claim-element-antecedent-check/research/summarize-allowed-verdicts.py \
  goals/claim-element-antecedent-check/history/allowed-review-v2/packet.json \
  submitted-review-export.json --human-attorney-ref R1
```

No current file satisfies the second command's human prerequisite. The operator's unavailable-review answer is not a pause or permission to fabricate judgments. The goal stays active and incomplete; this turn makes independent progress on the import boundary rather than marking it complete or blocked.

## Packet and denominator integrity

The importer also rejects zero, boolean or mismatched sample denominators; duplicate/empty claim and question identities; unsupported claim/question statuses; repeated, orphan or cross-claim questions; no-finding confirmations mixed with finding questions; unchecked claims carrying adjudication questions; and non-boolean completion flags. It retains existing rejection of wrong version bindings, duplicate/unknown verdicts, false completion assertions and wrong/uncertain answers without reasons.

A recognized wrong finding establishes that sampled claim's erroneous-alert indicator even if another finding is unresolved. Otherwise all relevant finding answers must be right to establish no erroneous emitted finding. Missing, uncertain, failed and undecomposed outcomes stay unresolved. No resolved-only denominator is used. Complete outcomes are still insufficient for an adjudicated metric until actual-attorney provenance is confirmed.

The CLI verifies the packet's content digest and hashes the exact packet/export bytes it parsed. The derived summary includes those hashes and anonymous provenance metadata; it does not modify source packets, answer files, reference labels, predictions or earlier results.

## Verification

Eight synthetic boundary tests pass, including explicit authority gating, rejection of preview/non-attorney assertions, malformed packet ownership, fixed denominators and completion types. All synthetic answer objects remain test controls; none is saved as actual human adjudication.

A real invocation against the retained 30-claim v2 packet and an explicitly labelled empty synthetic preview confirms 30 unresolved claims, actual-attorney=false, and null adjudicated rate/interval. That control remains private test evidence and supplies no legal verdict. Python compilation passes. No TypeScript/runtime source changed, so the retained v13 implementation hashes still bind the 31/538 positive result and the 196/200-set allowed coverage; package verification is not rerun for unchanged runtime packages.

The [integrity receipt](2026-10-31-adjudication-authority-receipt.json) verifies every earlier history artifact and source/sample freeze against retained commit 56a68c4455 and binds the new analysis-tool sources and this report. Existing actual-attorney requirements remain unfulfilled under SPEC P2/P3. Yeet publication/readiness and final closeout/reflection are also still incomplete.
