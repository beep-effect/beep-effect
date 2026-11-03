# Scratch competency migration — 2026-11-03

The duplicate scratch implementation and its five test files have been removed
from the working tree after comparing their assertions with the package tests.
The scripts consume package exports. `scripts/ReviewPage.ts` is unchanged and
`test/ReviewPageAdapter.test.ts` remains to check the script-only boundary.
This receipt is local evidence, not hosted readiness or completion evidence.

## Coverage mapping

Paths in this table are relative to the repository root. Multiple old assertions
may be covered by one stronger scenario; test-count equality is not the criterion.

| Former scratch test group | Graduated checks |
| --- | --- |
| Party schema slots, self-reporting, structural versus review verdicts, required disposition, account-only party enumeration, single From | `packages/party/domain/test/Claim.test.ts`, `Party.competency.test.ts` |
| Delegate versus represented mailbox, stable voice, unknown shared-mailbox authorship | `packages/party/domain/test/Party.competency.test.ts`; `packages/party/server/test/MailRecord.test.ts` |
| Historical correction, phone reassignment and gaps | `packages/party/domain/test/Party.competency.test.ts`; `packages/party/server/test/Ledger.test.ts` |
| SameParty/DistinctParty replay and resolution graph | `packages/party/domain/test/Resolution.test.ts`, `Party.competency.test.ts` |
| Admission purposes, independent corroboration, cited support, knowledge time, signature-only rejection, typed client-facing result | `packages/party/domain/test/Admission.test.ts` |
| Shadow gate, missing collection, declared chain, selector graph, hop distances, reporting cycle, Mermaid | `packages/party/domain/test/Party.competency.test.ts` |
| Immutable supersession and historical snapshots | `packages/party/server/test/Ledger.test.ts` |
| Mail parser hazards, swapped fields, sender-only source anchor, missing From | `packages/party/server/test/MailRecord.test.ts` |
| Proposed pairing claims, actual assertion support, observed spans and DN drift | `packages/party/server/test/IdentityEvidence.test.ts`, `MailRecord.test.ts` |
| Mailbox components and all five collision outcomes | `packages/party/server/test/IdentityEvidence.test.ts` |
| Contact normalization, shared mailbox representation and context roles | `packages/party/server/test/ContactEvidence.test.ts`, `GraphContact.test.ts`; `packages/law-practice/server/test/PartyContactSource.test.ts` |
| Timestamp parsing and millisecond precision | `packages/party/server/test/MailIndex.test.ts` |
| Cross-source card chains and suppression of ambiguous matches | `packages/party/server/test/IdentityEvidence.test.ts` |
| Organization domain, free mail, overlap, sequential move, missing evidence and low-information names | `packages/party/server/test/OrgEvidence.test.ts` |
| Stable mailbox anchors, duplicate group members, canonical case bases, complete partitions, stale/invalid/unreviewed outcomes and cross-case vetoes | `packages/party/server/test/ReviewLoop.test.ts` |

## Intentional contract changes

- Whole-second ISO-string ordering is replaced by numeric epoch-millisecond time
  through the foundation time model. Mail parsing preserves fractional precision;
  invalid dates and missing zones remain rejected.
- National phone parsing requires explicit country context. The original guessed
  US default is not retained. Canonical E.164 equality, missing context, invalid
  values and unsupported context are covered by domain `PartyKey.test.ts` and
  the contact adapter tests.
- String party identifiers are replaced by shared integer PartyId. Mailbox anchor
  stability belongs to the memory ledger instance and does not assert identity.
- Pairing and review claims carry real source assertions. Proposed card/address
  matches never become Accepted solely because normalized keys agree.
- Review exports require explicit validity and source context. Conflicting or
  stale decisions remain review outcomes and emit no accepted claims.

## Local evidence

The domain package verifier passed after adding the previously missing exact
hierarchy, selector distance, cycle, Mermaid and schema-boundary assertions:
`bun run beep quality package-verify @beep/party-domain` (audit and docgen).
Following removal, `bunx tsrs -p scratchpad/party/tsconfig.json` passed and
`bunx vitest run --config scratchpad/party/vitest.config.ts` passed all three
page-boundary tests. Full slice verification and hosted gates remain outstanding.
