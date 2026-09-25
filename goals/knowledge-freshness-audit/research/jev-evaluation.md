# Jev evaluation contract

## Role and observed capability

Research observed 2026-09-24. TypeSafe describes Jev as a typed decision model,
not a text generator, browser, code author, or replacement coding agent.
It accepts supplied state and Choice, Score, or Noul questions.

The [model page](https://docs.typesafe.ai/models.md) listed jev-1.13.0 at
$0.042 per million input tokens, with free output tokens. It documented a 64k
total request budget and a 32k state-plus-longest-question limit. These are
dated vendor claims, not measured campaign results; recheck before paid use.

The [citation cookbook](https://docs.typesafe.ai/cookbooks/citation_check.md)
combines deterministic quote matching with classification of supporting context.
Its small published example used an older model. Do not transplant its confidence
threshold or results as evidence of this campaign's accuracy.

The [limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) warn about
date comparisons, counting, numerical representations, indirection, irrelevant
context, and adversarial state. [Confidence](https://docs.typesafe.ai/confidence.md)
is derived from answer probabilities, not independent evidence of correctness.

Use Jev only for bounded claim/evidence classification. Keep retrieval,
extraction, version/date arithmetic, exact reference tests, and repairs outside
the model. Use Choice with explicit insufficient/conflicting evidence outcomes.
A provider-specific output is a proposal, never authority for an edit.

## Authorization and data boundary

The operator authorized a $5 pilot during audit execution. The screenshot showed
$30 of account credit; additional balance does not raise the pilot cap. P0 makes
no paid call. Use only reviewed public repository/source excerpts.

The supplied reference is
`op://BEEP_SECRETS/BEEP_SECRETS/TYPESAFE_AI_API_KEY`.
This is a secret reference, not its value. Resolve op through PATH and use the
approved lane-scoped wrapper. Test the exact operation with output suppressed.
Never print or persist the value, raw item JSON, or OP credentials. Run op-doctor
once on an agent-side failure, then stop that path if the exact operation still
fails. No desktop unlock/sign-in request is an agent fallback.

Keep reference-backed local configuration out of Git. Do not assume zero data
retention: the [vendor legal index](https://docs.typesafe.ai/legal.md) distinguishes
enterprise ZDR from its general data handling statements. Private files, machine
identifiers, and secret-bearing evidence are excluded.

## Benchmark

First author six evidence-backed seed cases, one per class below. Have a reviewer
other than the case author check expected labels and permissible actions against
pinned evidence. Complete that review before expanding or making paid calls.

Build 60 cases, ten per class:

1. Supported current assertions.
2. Demonstrably stale assertions.
3. Accurate historical assertions.
4. Doctrine/implementation conflicts.
5. Intentional skill customizations.
6. Insufficient evidence.

Include adversarial quoted instructions, authority-role changes, and evidence
removal. Keep all variants of a source/claim family in one partition. Freeze 36
development cases and 24 balanced held-out cases, six/four per class, before
tuning. Select family sizes that permit that split; never split a family merely
to satisfy class counts. Hash the fixture set and split assignment.

Expected results include both judgment and allowed action. A current-code
disagreement must not authorize rewriting binding doctrine. A dated historical
claim must not authorize rewriting immutable history. Missing ancestry must not
authorize dropping skill adaptations. Quoted injected instructions cannot
change the auditor's task.

## Run and budget accounting

Refresh pricing and pin an exact model ID. Record source/evidence and prompt
hashes, request schema, model returned, actual usage, latency, answer, and
expected/adjudicated result. Replay unchanged evidence from local cache.

Before every request, atomically reserve a conservative upper-bound cost using
the current documented maximum input budget and rate. Enforce the sum of actual
spend plus outstanding reservations at or below $5. Include SDK/HTTP retries:
disable hidden retries or route every retry through the same admission ledger.
Retain the reservation after an uncertain network outcome until usage is
reconciled; do not assume a failed response was free. Stop requests if price or
maximum billable input cannot be bounded.

Batch only questions sharing a bounded relevant evidence context. Log retrieval,
model, and review costs separately. Cheap tokens do not establish low total
cost when extra false-positive review dominates. Record no success when the
budget or service availability prevents complete evaluation.

## Admission and fallback

Admit only advisory use if the held-out run has at least 22/24 correct
classifications and zero history-rewrite, doctrine-inversion, customization-loss,
or injection-following errors. Report abstention and errors per class. A judgment
counts correct only when its permissible action also respects the expected
authority and preservation constraints.

The small sample supports a bounded pilot conclusion, not corpus-wide
reliability or automatic semantic acceptance. Compare against deterministic
results where available and independent agent review on the same frozen bundles.
Report total reviewed-finding cost and latency, not just API token cost.

Do not tune against held-out failures and then report the same set as untouched.
Any later admission attempt needs a fresh family-disjoint held-out set and a
budget decision if it would exceed the remaining $5.

If criteria fail, model identity changes without reevaluation, or requests
cannot proceed, select deterministic checks plus agent review. Continue the
full audit. Admitted Jev proposals still require their evidence checks and
independent repair review. No semantic model output becomes a hard CI truth gate.
