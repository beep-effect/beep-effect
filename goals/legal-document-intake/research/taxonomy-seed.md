Freshness: 2026-07-08

# Taxonomy Seed Design

This note answers P0 research task 2: enumerate a seed legal-document filing taxonomy, map concepts to FOLIO IRIs where the current repo contains a cited match, and propose the documentation-only Effect Schema/LiteralKit, JSON-LD data shape, and projection-function contract. The scope is bounded by SPEC D5: the taxonomy is a repo-owned SKOS-style seed, concept IRIs align to FOLIO where they exist, and local folder layout is a deterministic projection of taxonomy data, not hardcoded filing logic (`goals/legal-document-intake/SPEC.md:29`, `goals/legal-document-intake/SPEC.md:95-96`). P0 task 2 specifically asks for this note and no feature code (`goals/legal-document-intake/PLAN.md:29-32`).

Evidence boundary: current-session inspection found no checked-in FOLIO legal document-type concept catalog. `@beep/ontology` currently exports the FOLIO OpenAPI component models (`packages/foundation/modeling/ontology/src/index.ts:1-11`), and `Ontology.models.ts` models generic FOLIO `OWLClass` / `OWLObjectProperty` payloads with sample entries for `Lessor` and `drafted`, not document-category classes (`packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`, `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`, `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`, `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83`). Therefore every seed concept below is marked `no FOLIO match (repo evidence only)`. This is not a claim that upstream FOLIO lacks the concept; it means no matching IRI was found in the inspected repo files. The repo already has SKOS constants and JSON-LD/IRI primitives for representing the seed as data (`packages/foundation/modeling/rdf/src/Vocab/Skos.ts:26-74`, `packages/foundation/modeling/rdf/src/Iri.ts:888-1043`, `packages/foundation/modeling/rdf/src/JsonLd.ts:399-454`). `@beep/semantic-web` adds compatibility re-exports and bounded validation/service surfaces, but not a separate FOLIO concept catalog (`packages/foundation/capability/semantic-web/src/index.ts:1-13`, `packages/foundation/capability/semantic-web/src/iri.ts:1-9`, `packages/foundation/capability/semantic-web/src/jsonld.ts:1-9`, `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:18-31`).

## (a) Seed Concept Table

| Concept name | Short definition | FOLIO IRI | Citation for mapping decision |
| --- | --- | --- | --- |
| Pleadings | knowledge-based: Court or tribunal documents that frame claims, defenses, parties, and requested relief, including complaints, petitions, answers, counterclaims, and replies. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Motions and applications | knowledge-based: Requests for a court, tribunal, agency, or arbitrator to grant procedural or substantive relief. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Briefs and legal argument | knowledge-based: Advocacy documents presenting facts, issues, law, argument, and requested disposition. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Court orders and judgments | knowledge-based: Court-issued rulings, orders, judgments, decrees, mandates, and similar adjudicative dispositions. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Notices and docket filings | knowledge-based: Procedural filings and service artifacts such as notices of appearance, hearing notices, proofs of service, certificates, docket sheets, and e-filing receipts. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Correspondence | knowledge-based: Letters and formal communications to or from clients, counsel, courts, agencies, experts, and third parties. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Email and messages | knowledge-based: Email threads, exported mailbox items, chat exports, and other message records that should remain distinct from formal correspondence when needed. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Agreements and contracts | knowledge-based: Executed or draft agreements, amendments, statements of work, licenses, NDAs, settlement agreements, and other binding or proposed deal documents. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Closing and transaction records | knowledge-based: Closing binders, signature packets, checklists, consents, schedules, deliveries, escrow records, and transaction-completion evidence. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Discovery requests and responses | knowledge-based: Interrogatories, document requests, requests for admission, responses, objections, and related meet-and-confer materials. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Productions | knowledge-based: Produced document sets, load files, production indexes, Bates ranges, privilege logs, and received productions. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Deposition materials | knowledge-based: Deposition notices, transcripts, errata, exhibits, outlines, summaries, designations, and video/audio references. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Subpoenas and third-party process | knowledge-based: Subpoenas, witness summonses, third-party requests, returns, objections, and compliance materials. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Exhibits and evidence | knowledge-based: Filed or working exhibits, demonstratives, evidence binders, photos, recordings, demonstrative charts, and exhibit lists. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Expert materials | knowledge-based: Expert reports, rebuttal reports, reliance materials, CVs, fee schedules, communications, and expert discovery work product. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Memoranda and legal research | knowledge-based: Internal or client-facing legal memoranda, research notes, analysis, authorities, case summaries, and issue outlines. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Attorney work product and notes | knowledge-based: Strategy notes, outlines, chronologies, interview notes, internal comments, and non-filed attorney analysis. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Client intake and engagement | knowledge-based: Engagement letters, conflict checks, intake questionnaires, authority-to-act records, KYC/business identity records, and client onboarding material. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Billing and invoices | knowledge-based: Invoices, budgets, fee estimates, accounts receivable artifacts, expense support, and client billing correspondence. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Time records | knowledge-based: Time entries, timekeeper reports, task narratives, billing-code exports, and write-down/write-off support. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Settlement and ADR | knowledge-based: Settlement communications, term sheets, mediation statements, arbitration submissions, releases, and dispute-resolution materials. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Regulatory and agency filings | knowledge-based: Administrative filings, agency correspondence, permits, applications, responses, determinations, and enforcement records outside court dockets. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| IP prosecution and portfolio | knowledge-based: Patent/trademark/copyright prosecution files, office actions, responses, IDS materials, assignments, annuities, portfolio reports, and related docket evidence. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Corporate and governance records | knowledge-based: Entity formation, minutes, consents, board materials, capitalization records, policies, and governance approvals. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |
| Client source materials | knowledge-based: Source documents supplied by clients or third parties, including records, reports, statements, correspondence packets, technical materials, and factual background files. | no FOLIO match (repo evidence only) | `packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610`; `packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83` |

## (b) Proposed Effect Schema / LiteralKit Shape

LiteralKit convention anchors from the repo: `CLAUDE.md` requires named schema building blocks, derived `S.is(...)` guards, and LiteralKit internal domains without `as const` on inline arrays (`CLAUDE.md:21-24`). Hand-authored examples pass inline arrays directly to `LiteralKit(...)`, annotate the schema, and export same-name `typeof Foo.Type` aliases (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:347-369`, `packages/foundation/capability/langextract/src/Target/index.ts:27-47`). Existing examples use `.Enum`, `.is`, and `.Options` as the helper surface (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:335-341`, `packages/foundation/capability/file-processing/src/Strategy/index.ts:20-49`), derive guards with `S.is(...)` in docs (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:19-22`, `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:55-60`), and derive subsets with `.omitOptions(...)` (`packages/foundation/ui-system/ui/src/themes/theme-provider.tsx:69-109`). The file-path segment validator already exists for safe path segment output (`packages/foundation/modeling/schema/src/FilePath/FilePath.segments.ts:75-109`).

Illustrative TypeScript only. The JSON-LD seed data should be the source of truth; a future implementation can derive or generate this LiteralKit companion from the pinned data file so filing logic does not hardcode folder names outside taxonomy data.

```ts
import { LiteralKit, SchemaUtils } from "@beep/schema"
import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath"
import { IRIReference } from "@beep/rdf"
import * as S from "effect/Schema"

const LegalDocumentConceptId = LiteralKit([
  "pleadings",
  "motions-and-applications",
  "briefs-and-legal-argument",
  "court-orders-and-judgments",
  "notices-and-docket-filings",
  "correspondence",
  "email-and-messages",
  "agreements-and-contracts",
  "closing-and-transaction-records",
  "discovery-requests-and-responses",
  "productions",
  "deposition-materials",
  "subpoenas-and-third-party-process",
  "exhibits-and-evidence",
  "expert-materials",
  "memoranda-and-legal-research",
  "attorney-work-product-and-notes",
  "client-intake-and-engagement",
  "billing-and-invoices",
  "time-records",
  "settlement-and-adr",
  "regulatory-and-agency-filings",
  "ip-prosecution-and-portfolio",
  "corporate-and-governance-records",
  "client-source-materials",
]).pipe(
  $I.annoteSchema("LegalDocumentConceptId", {
    description: "Stable identifiers for the repo-owned legal document taxonomy seed.",
  })
)
export type LegalDocumentConceptId = typeof LegalDocumentConceptId.Type

const FolioAlignmentKind = LiteralKit(["exact", "close", "none"]).pipe(
  $I.annoteSchema("FolioAlignmentKind", {
    description: "Whether a taxonomy concept has a cited FOLIO class match.",
  })
)
export type FolioAlignmentKind = typeof FolioAlignmentKind.Type

export class FolioAlignment extends S.Class<FolioAlignment>($I`FolioAlignment`)(
  {
    kind: FolioAlignmentKind,
    iri: S.OptionFromOptionalKey(IRIReference).pipe(SchemaUtils.withNoneDefault),
    citation: S.NonEmptyString.pipe(S.Array),
    note: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FolioAlignment", {
    description: "Evidence-backed alignment between a local taxonomy concept and FOLIO.",
  })
) {}

export class LegalDocumentTaxonomyConcept extends S.Class<LegalDocumentTaxonomyConcept>(
  $I`LegalDocumentTaxonomyConcept`
)(
  {
    id: LegalDocumentConceptId,
    iri: IRIReference,
    prefLabel: S.NonEmptyString,
    definition: S.NonEmptyString,
    folderSegment: ValidWindowsPlainPathSegment,
    broader: LegalDocumentConceptId.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    related: LegalDocumentConceptId.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    folio: FolioAlignment,
  },
  $I.annote("LegalDocumentTaxonomyConcept", {
    description: "One SKOS-style concept in the legal document filing taxonomy.",
  })
) {}

export class LegalDocumentTaxonomy extends S.Class<LegalDocumentTaxonomy>($I`LegalDocumentTaxonomy`)(
  {
    "@context": S.Record(S.String, S.Unknown),
    "@id": IRIReference,
    "@type": LiteralKit(["skos:ConceptScheme"]),
    concepts: S.NonEmptyArray(LegalDocumentTaxonomyConcept),
  },
  $I.annote("LegalDocumentTaxonomy", {
    description: "Data-first SKOS-style legal document taxonomy seed.",
  })
) {}
```

## (c) JSON-LD Shape Example

This JSON-LD entry shape uses SKOS concepts, labels, definitions, broader links, and match predicates from the repo's SKOS vocabulary support (`packages/foundation/modeling/rdf/src/Vocab/Skos.ts:91-125`, `packages/foundation/modeling/rdf/src/Vocab/Skos.ts:176-193`, `packages/foundation/modeling/rdf/src/Vocab/Skos.ts:244-261`, `packages/foundation/modeling/rdf/src/Vocab/Skos.ts:295-312`, `packages/foundation/modeling/rdf/src/Vocab/Skos.ts:380-414`). The underlying JSON-LD document model supports node identifiers, types, and property maps (`packages/foundation/modeling/rdf/src/JsonLd.ts:399-454`).

```json
{
  "@context": {
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "dcterms": "http://purl.org/dc/terms/",
    "beep": "https://beep.local/ontology/legal-document-intake#",
    "folderSegment": "beep:folderSegment",
    "folioAlignment": "beep:folioAlignment",
    "alignmentKind": "beep:alignmentKind",
    "sourceCitation": "dcterms:source"
  },
  "@id": "https://beep.local/ontology/legal-document-intake/concept/pleadings",
  "@type": "skos:Concept",
  "skos:prefLabel": "Pleadings",
  "skos:definition": "Court or tribunal documents that frame claims, defenses, parties, and requested relief.",
  "skos:inScheme": {
    "@id": "https://beep.local/ontology/legal-document-intake/scheme/legal-document-taxonomy-v1"
  },
  "skos:broader": {
    "@id": "https://beep.local/ontology/legal-document-intake/concept/notices-and-docket-filings"
  },
  "folderSegment": "Pleadings",
  "folioAlignment": {
    "alignmentKind": "none",
    "sourceCitation": [
      "packages/foundation/modeling/ontology/src/Ontology.models.ts:292-306",
      "packages/foundation/modeling/ontology/src/Ontology.models.ts:596-610",
      "packages/foundation/modeling/ontology/src/Ontology.models.ts:640-654",
      "packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-83"
    ]
  }
}
```

If a future FOLIO class match is found in repo data, the entry should add `skos:exactMatch` or `skos:closeMatch` with the cited FOLIO IRI and change `alignmentKind` from `none` to `exact` or `close`.

## (d) Projection Function Contract

Documentation-only signature:

```ts
type ProjectTaxonomyPathSegment = (
  concept: LegalDocumentTaxonomyConcept,
  metadata: {
    readonly clientKey?: string
    readonly matterKey?: string
    readonly matterDisplayName?: string
    readonly documentDate?: string
    readonly originalFileName?: string
    readonly jurisdiction?: string
  }
) => Effect.Effect<ValidWindowsPlainPathSegment, TaxonomyProjectionError>
```

Semantics:

- Input `concept` is a decoded taxonomy concept from the JSON-LD seed, not a hardcoded enum branch in filing logic. SPEC requires taxonomy-derived paths and forbids folder names hardcoded outside taxonomy projection (`goals/legal-document-intake/SPEC.md:95-96`).
- Input `metadata` can influence disambiguating suffixes only through deterministic, documented projection rules. The function must be pure: same concept plus same metadata returns the same segment and performs no filesystem, DMS, or network I/O.
- Output is exactly one vault path segment, not a full path. Full matter-centric or client-centric layout remains the folder-structure task's responsibility (`goals/legal-document-intake/PLAN.md:25-28`).
- Output should start from `concept.folderSegment`; if metadata is appended, it must be normalized and validated as `ValidWindowsPlainPathSegment`, whose schema rejects empty segments, separators, Windows reserved characters, and trailing dots/spaces (`packages/foundation/modeling/schema/src/FilePath/FilePath.segments.ts:75-109`).
- Joining the segment into a vault path remains a later FS-materialization concern. The existing path safety guard resolves candidate paths under an allowed root and fails closed on escapes, traversal, or unsafe symlinks (`packages/foundation/capability/file-processing/src/PathSafety/index.ts:1-18`).
- FOLIO alignment is metadata for ontology/KG validation and export. It must not change the folder segment unless the taxonomy data explicitly changes.

## Proposed SPEC Supersession

No SPEC supersession is needed. D5 already says concepts align to FOLIO "where they exist"; this research only clarifies that the current repo package evidence does not contain exact FOLIO document-category IRIs for this seed (`goals/legal-document-intake/SPEC.md:29`).

## Open Questions

- knowledge-based/inferred: Should P1 include IP prosecution as a first-class seed concept because this repo has strong law-practice patent precedent, or should it remain a law-practice extension layered over the generic document taxonomy?
- knowledge-based/inferred: Should `email-and-messages` stay separate from `correspondence` in v1 filing, or should it be a narrower child only when imported from PST/M365 sources?
- A future FOLIO class cache or checked-in fixture is needed before replacing `no FOLIO match` rows with exact `skos:exactMatch` or `skos:closeMatch` IRIs.
- Resolved by `research/folder-structure.md` and `SPEC.md` D5-S1: full vault paths are matter-centric, while this taxonomy note owns only the taxonomy-derived concept path segment contract.
