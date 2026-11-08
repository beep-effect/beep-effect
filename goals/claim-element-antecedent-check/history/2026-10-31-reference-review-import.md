# Durable reference-review import and actual-human acceptance hold

Date: 2026-10-31

The operator has explicitly reported that attorney review is unavailable. Actual reference agreement, the held convention decisions and an adjudicated allowed-claim false-positive interval remain absent. No answer is synthesized or inferred from interface previews. This continuation completes a missing independent deliverable: the main reference-review/addendum validators are now checked in instead of existing only in the ignored scratch directory.

## Read-only, durable import

`research/validate-reference-review.py` replaces the scratch-only validation path with a reproducible command. It reads the existing immutable HTML datasets and receipts, verifies HTML bytes and canonical bundle digests, verifies the preselected six-family/50-claim sample against `attorney-sample.json`, and checks every reviewed annotation/canonical source version against the retained reference/source freezes. It includes the six lexical-head questions, reciprocal-language question and separate one-question addendum.

It writes only JSON to standard output. It never changes annotations, source claims, verdict files, packets or previous results, and never overwrites a fixed summary path. A fresh checkout retains the validation command without requiring private scratch files.

```sh
# Source/packet integrity only; no answer file or human evidence.
python3 goals/claim-element-antecedent-check/research/validate-reference-review.py --audit-packets

# Validate answers, retaining actual-human provenance as unconfirmed.
python3 goals/claim-element-antecedent-check/research/validate-reference-review.py main actual-main-export.json
python3 goals/claim-element-antecedent-check/research/validate-reference-review.py addendum actual-addendum-export.json
```

Only after an actual task submission explicitly confirms that an attorney personally supplied the exact export may `--human-attorney-ref R1` be added. The anonymous reference must match the export's reference and attorney role; preview, synthetic and conflicting role/source metadata cannot supply attorney agreement. File validation does not authenticate reviewer identity. No current export satisfies that human prerequisite.

The immutable existing interfaces and export schemas remain usable. Main answers are mapped by exact family/claim identity; duplicates, out-of-sample claims, changed source versions, unsupported outcomes and false completion declarations are rejected. Partial exports stay partial. All 50 main claims remain in the agreement denominator; uncertain and revision answers are reported separately, and unanswered claims are never silently dropped. Without actual submission confirmation, agreement stays null even for a fully filled answer file. With confirmation, main-claim agreement can be reported independently of pending convention questions; it does not claim the entire packet or P2 acceptance is complete.

The six head questions and reciprocal-language question remain separate from the 50-claim denominator. The addendum likewise remains separate and never changes that denominator. A recorded uncertain convention outcome remains unresolved. Derived summaries bind the exact export bytes, packet HTML hash and reviewed bundle identity without publishing reviewer names.

## Verified current packet audit

[The read-only audit](2026-10-31-reference-review-import-audit.json) confirms:

- Six sampled families, 50 main claims, six head questions and one reciprocal-language question.
- One separate addendum question.
- Original main/addendum HTML hashes and bundle digests remain unchanged.
- Reviewed families and source versions remain in the retained reference selection.
- Actual attorney agreement is false/unrecorded and its fraction is null; this is an integrity audit, not human evidence.

Seven new synthetic boundary tests pass: empty/partial full-denominator handling, complete-but-unconfirmed answers, confirmed synthetic controls with uncertainty, convention-denominator separation, source/version/duplicate/completion rejection, preview/role rejection, and separate addendum handling. These answer objects exist only as synthetic tests and are never saved as actual human receipts. The existing eight allowed-review boundary tests also pass, and Python compilation succeeds.

No TypeScript/runtime implementation changes. The 20 v13 runtime hashes remain unchanged, binding the retained **31/538 exact positives**, all 31 passes retained, and **196/200 allowed sets / 3,108/3,184 source claims checked**. All old history, sample freezes, labels and review packets are verified against retained commit 2e0417f68b. No benchmark is rerun for unchanged runtime source. No push or publication occurs.

## Remaining acceptance requirements

The required actual-human evidence is explicit, not an inferred approval request:

- SPEC's labelled-set criterion requires about 10% attorney spot-checking and recorded agreement. The six-family/50-claim packet is ready, but no actual attorney answers exist.
- Three round-limited reference families retain human convention decisions. Agents cannot substitute another labelling round for the reserved human decisions or change the frozen labels.
- SPEC's P3 evaluation criterion requires an adjudicated allowed-claim false-positive rate with its interval. The current random 30-claim packet is fully readable but has no actual attorney judgments.
- PLAN's P4 entry criterion is P3 exit. Yeet publication/readiness cannot be reported as satisfying that entry criterion while actual adjudication is missing. Final closeout/reflection likewise remains incomplete.

The structural floor remains poor and the remaining 76 allowed input failures stay explicit. GOAL/SPEC's poor-floor appetite instruction does not require indefinite parser expansion or perfect benchmark recovery; the user's bounded repair measurements are retained. The present human acceptance requirements cannot be fulfilled through more synthetic tests, agents, altered labels or repeated status checks.

The goal remains active and incomplete while the unavailable-review condition is tracked under the required blocked audit. This turn makes concrete independent progress and does not mark the goal complete or prematurely blocked. No repeated request for attorney review is sent after the operator's unavailable answer.
