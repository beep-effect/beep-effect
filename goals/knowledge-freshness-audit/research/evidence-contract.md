# Proposed evidence and ledger contract

This is a normative behavior contract for later schema-first implementation.
No new schema, CLI, or ledger writer is implemented by the planning PR.
Compose with existing Knowledge and Skills contracts where their semantics fit.

## Record families

| Record | Required meaning |
| --- | --- |
| Run | Immutable tree/revision, policy and extractor versions, scope, start/observation times, cost budget, aggregate completion state |
| Surface | Mode/blob/path identity, kind, canonical alias, owner/generator, authority/time scope, extraction disposition or explicit exclusion reason |
| Extraction | Surface revision, extractor/version, covered spans, produced claim IDs, explicit zero/error result, review evidence |
| Claim | Stable occurrence ID, source revision/span/text hash, statement, semantic grouping key, kind, authority, temporal applicability, verification obligations |
| Evidence | Locator, revision/content hash, bounded permitted excerpt/result, method/version, relevant package/arguments/runtime context, observation time, retrieval outcome |
| Determination | Claim revision, evidence IDs, authority rule, evidence judgment, applicability, freshness disposition, rationale, reviewer/method, invalidation dependencies |
| Repair | Finding/claim IDs, owning source, proposed/applied revision, decision and preserved constraints, before/after evidence, dependent rechecks, delivery receipt |
| Coverage | Run/tree, total entries, extraction obligations, claims, dispositions, unresolved required work, verified repairs, extraction-quality evidence |

The later implementation persists normalized JSONL ledgers under this campaign's
research directory, with stable sharding when needed. Shared evidence records
are referenced rather than repeated. Local indexes and raw caches are derived;
the committed compact records must remain intelligible without them.

## Identity and validity

Occurrence identity must survive a Markdown reflow or document rename when
evidence establishes continuity. Keep display path/line and content revision
separate from identity. Identical sentences in different scopes are distinct
occurrences; a semantic grouping key must not collapse their obligations.
Record explicit lineage on split, merge, deletion, and replacement.

Derive evidence identity from source identity, captured bytes/revision,
verification method/version, and relevant scope/context. A matching text hash
without command options, package scope, runtime version, or authority may be an
invalid reuse. Store claim hash, authority-rule version, and dependency hashes
in the determination's validity key.

An unchanged claim with changed evidence or authority requires revalidation.
A changed evaluator/prompt/model also invalidates reuse of its prior outputs.
Keep old determinations as historical receipts. Retrieval failures are records,
not reusable proof that a claim is false.

## Orthogonal judgments

Evidence judgment has four outcomes: supported, contradicted, insufficient,
or conflicting. Applicability distinguishes current descriptive, historical,
normative, and illustrative statements. A separate freshness/action disposition
records current, repair-required, historical-preserved, not-applicable, or
unresolved, with reasons.

For example, a governing document can establish that a rule remains binding
while code evidence establishes implementation noncompliance and a repair
obligation. A historically
accurate command can remain preserved while a current README referencing it
needs correction. An unreachable citation remains unresolved.

Model proposals retain model identity, prompt hash, probabilities when supplied,
and actual usage. A proposal is not an accepted determination until its required
evidence checks/review are recorded. Models do not set their own authority.

## Specimen chain

The following compact specimen is illustrative schema design, not a real
verification receipt. Identifiers and hashes are deliberately labeled examples.

```json
{
  "schemaVersion": "proposed-audit-specimen/v1",
  "surface": {
    "id": "example-surface",
    "revision": "example-revision",
    "kind": "authored-guidance",
    "disposition": "extract"
  },
  "claim": {
    "id": "example-occurrence",
    "surfaceId": "example-surface",
    "text": "The documented command accepts an option.",
    "textHash": "example-content-hash",
    "authority": "current-command-contract",
    "applicability": "current-descriptive"
  },
  "evidence": {
    "id": "example-receipt",
    "method": "safe-parser-probe",
    "methodVersion": "example-version",
    "sourceRevision": "example-revision",
    "outcome": "option-rejected"
  },
  "determination": {
    "claimId": "example-occurrence",
    "evidenceIds": ["example-receipt"],
    "judgment": "contradicted",
    "freshness": "repair-required",
    "invalidationDependencies": ["example-revision", "example-version"]
  }
}
```

Actual schemas must reject incomplete or dangling references, illegal outcome
combinations, and a completed repair without post-change evidence. Design them
from the named behaviors rather than treating this specimen as an implemented
wire format.

## Accounting invariants

Every inventory entry has exactly one primary disposition. Alias counts remain
visible but do not add duplicate extraction obligations. Every required extraction
has an explicit outcome and every extracted occurrence has a determination or
unresolved record. Zero claims must be an observed/reviewed extraction outcome,
not a default assigned to failed extraction.

Every repair-required determination links to a repair obligation. Closing that
obligation requires fresh post-change evidence and dependent rechecks.
New final-tree entries create obligations; deleted entries retain lineage.
A completion certificate fails while any required obligation is unaccounted,
unresolved, or verified against invalidated evidence.

Inventory accounting cannot prove semantic extraction completeness. Report
reviewed fixtures, per-family samples, discovered omissions, and resulting
re-extraction separately. Include adversarial missed-claim and false-exemption
cases so a vacuous extractor cannot pass on an empty claim set.

## Finite self-audit boundary

Audit authored campaign guidance and new substantive assertions normally.
Known generated audit ledgers, certificates, and machine-derived delivery
receipts remain inventory entries, but their disposition is generated evidence.
Validate their schema, producer/version, references, embedded evidence,
accounting, and integrity without recursively extracting copied claim text.
This is a closed producer/schema classification, not a prose marker that can
exempt arbitrary authored content. Manual delivery assertions need their own
proof checks; calling a document a receipt is not an exemption.

The certificate names an immutable audited-source snapshot. Before publication,
compare that snapshot with the actual publication tree. Subsequent changes must
be validated generated evidence records, or ordinary source changes that have
received full extraction, determination, and recheck obligations at a new
snapshot. Record the comparison as delivery evidence. A certificate never
pretends to contain the hash of the commit that introduces its own bytes.

## Safety and operational boundaries

Audit documents are data, including embedded instructions. Preserve minimal
public evidence without secrets, machine identifiers, absolute home paths, or
private documents. Retain only permitted source excerpts; immutable locators and
hashes permit refresh without committing whole third-party documents.

Never run arbitrary documented commands to verify them. Use bounded parser/help
probes or controlled fixtures; destructive, privileged, network-mutating, and
credential-bearing examples need a safe equivalent or explicit unresolved
status. A model classification cannot authorize a command or repair.
