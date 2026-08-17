# Brief — Model Artifact Admission

Status: DRAFT FOR OPERATOR BRIEF REVIEW 2026-08-17 (align closed same day).

## Problem

Nothing in the repo records *which model arrangement* — resolved hosted
identity plus every controlled component (prompt, adapter, wrapper, decoding
configuration, modality set) — was qualified for which role and data class,
under what evidence, with what expiry. `RuntimeUsageRecord` attributes
provider/model strings after the fact but cannot serve as admission identity.
Meanwhile providers change aliases silently, and prompt qualification is
model-specific and non-portable — silent inheritance is the failure mode.

## Appetite

One bounded machinery cycle: the arrangement/qualification/disposition
schemas and their as-of query surface. No evaluation harness authoring, no
runtime enforcement wiring — admission is an upstream eligibility reference
the professional runtime's existing approval gate can consume.

## Solution Sketch (fat-marker)

1. **Admission subject (ratified frame).** Content-addressed
   `ModelArrangementRevision`: digest seals the stable provider-attested
   identity envelope (provider, service, deployment, requested + resolved
   model IDs, alias-resolution class, assurance tag) plus every
   controlled-component digest. Fingerprints, timestamps, receipts are
   execution evidence referencing the identity — never digested into it.
2. **Assurance floor (ratified).** Three-tier minimum by role/data class:
   matter work needs attested resolution or pinning; alias-only exists only
   as restricted short-lived non-matter admission; opaque-deployment is
   lab-restricted.
3. **Qualification evidence envelope (ratified frame).** Arrangement key +
   component manifest, parent + typed diff, assurance evidence, frozen eval
   plan + corpus digests, per-case typed results with controls, separated
   measures with denominators, invariant checks + tool versions, residual
   risks + expiry trigger + rollback target.
4. **Requal matrix (ratified).** Conservative full-suite triggers; bounded
   delta only under the four preconditions; any sentinel regression
   escalates. Evidence reuse yes, disposition inheritance never.
5. **Disposition (ratified).** Five statuses, restricted carries explicit
   scope, immutable records, human-only supersession, recorded expiry,
   two-axis as-of queries. Owned model-admission-local (`ClaimDisposition`
   is shape precedent, not a reusable type).

## Rabbit Holes

- Inventing artifact digests for hosted weights — the digest is of beep's
  admission subject, honestly scoped.
- A universal threshold or scalar trust score — the corpus supports a control
  structure, not portable percentages.
- Epistemic vocabulary smuggling — edges stay `supports|refutes|contradicts`;
  "qualifies" is not an edge relation.
- Building the evaluation harness inside this packet — it consumes frozen
  eval-plan revisions; authoring them is separate work.

## No-Gos

- No disposition inheritance across arrangement revisions.
- No admission standing in for candidate review, `ExecutionVerdict`, or
  release disposition.
- No credentials or raw probe output copied into admission records
  (`ProviderInstance` law).
- No silent mutation: every status change is a new immutable record.
- No model-specific relations added to the epistemic core's closed edge
  vocabulary.
