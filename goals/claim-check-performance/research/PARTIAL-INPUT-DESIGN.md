# Partial-input inspection design

Status: source schema, independent normalization, conservative ancestry qualification and per-record structural decomposition implemented; substantive policy and product integration remain pending. No product coverage or accuracy gain claimed.
Two independent GPT-6.1-Sol medium reviews identified and checked the constraints
below. The original strict APIs, PatentClaim shape, runner, scorer and all
reference/result files remain unchanged.

## Problem and evidence

The current server adapter normalizes a complete XML claim set atomically.
A malformed sibling therefore rejects selected claims that do not depend on it.
The retained candidate has 43 input-failed selected claims. PatentClaims is a
validated consecutive document with complete dependencies: dropping bad rows
or casting a sparse array to that type would violate the domain contract.

## Ownership

Source-record input belongs to the existing ClaimElement domain capability.
The architecture operation-plan factory was consulted; no separate business
concept, role or package is needed. ClaimElement.input.model.ts models raw
input only. XML decoding/fetching remain in server adapters, normalization and
context qualification in domain, and provenance/orchestration in use-cases.
A later dedicated inspection port avoids breaking existing strict port stubs.

## Contract stages

1. Preserve every original record by document source key and one-based source
   ordinal. Literal number text may be absent, malformed or duplicated. Keep
   the unmodified source fragment and canonical decoded text or a typed
   extraction failure. Do not infer claim numbers from ordinal positions.
2. Normalize each text record to the unchanged PatentClaim or an explicit
   record-bound normalization failure. Use the same normalization implementation
   as the strict path; do not add evaluator-only recovery rules.
3. Qualify sparse dependency context separately from PatentClaims. Preserve
   original numbers, reject ambiguous duplicates, require prior references,
   propagate unknown ancestry transitively and across every alternative branch.
   A gap in source numbering remains a document diagnostic, not a renumbering.
4. Run the domain checker on qualified context through an explicit new entry
   point; retain the strict entry point as a compatibility wrapper. Missing
   ancestor context cannot create a missing/outside-chain allegation or clean
   result. Global outside-chain search also needs explicit completeness:
   preserve available positive witnesses, but do not strengthen an unknown
   diagnosis solely because unavailable records are absent from the index.
5. Expose complete per-record coverage through the real published-inspection
   service and a read-only tool, including the all-unchecked case. Never
   manufacture PatentApplicationDocument merely to reuse candidate mapping.

## First vertical slice

Use source XML with valid independent claim 1, malformed claim 2, independent claim 3 and claim 4
referencing claim 2. All four source identities/texts survive; claims 1 and 3 receive actual
checks, claim 2 is normalization-failed, and claim 4 has affected ancestry and no unsupported
substantive judgment. Also test zero checkable claims, duplicate/missing
numbers, unavailable text, transitive and alternative dependencies, and exact
strict/inspection equivalence for wholly valid input.

The current slice covers source preservation, source order and per-record normalization through the unchanged strict claim parser. Thirteen focused input tests, the earlier full 275-test domain suite and the domain package audit/docgen pass. Qualification blocks duplicate identities and propagates unavailable ancestry through every alternative dependency; it does not assert a complete global index. The structural entry point qualifies raw input itself and builds trees through the same private algorithm as the unchanged strict API; every unchecked record remains explicit. The new strict replay retains 37/538 and all 56 prior prediction reports byte for byte. It does not exercise a new product adapter or demonstrate a usefulness gain.
Ordinal validation alone cannot prove source completeness: the adapter must
account for every input node, and the evaluation must verify the complete raw
canonical inventory independently of successful normalization.

## Evaluation and frozen gates

Keep the original positive.main.ts and Structural.ts byte-identical. A new
runner is legitimate only after the product service/tool path exists. It must
exercise that same adapter and service, verify all original canonical source
texts including failures, enumerate exactly the frozen 538 family/claim
identities, reject duplicate predictions and call unchanged
compareStructuralFamily once per full family. Missing predictions remain
failed rows. Keep separately named strict-path and inspection-path results.

Retaining raw text is not parsed coverage. Successful normalization may count
as parsed input; incomplete ancestry remains an explicit check abstention.
Unknown controls/alerts stay conservative. All 37 original strict passes and
all 1,213 protected file bytes remain mandatory. No threshold changes occur.

## Reversal

The capability is additive. Remove the new inspection port/tool and domain
entry point while preserving the strict service and every recorded result.
Do not delete the source ledger or retrospectively relabel a partial check.
