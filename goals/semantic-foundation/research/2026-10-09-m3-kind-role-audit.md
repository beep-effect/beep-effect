# M3 kind, role, deadline and event audit

Bounded SKOS vocabulary audit, 2026-10-09. Authority: the lane brief's explicit
M3 product pull and fixed R3 vocabulary lists; CQs 1/5/7/8/18 in the direction
report. These proposals name vocabulary concepts, not entity classes or OWL
subclass/rigidity commitments. No source symbol is converted into a T-Box.

| Terms | Denotation and identity criterion | Category, dependence and temporality | Verdict / counterexample |
| --- | --- | --- | --- |
| Party, NaturalPersonParty, OrganizationParty | Holder identified across matters independently of a legal role; human continuity or institutional continuity. | Identity-bearing holder categories; natural-person/organization distinctions survive role changes. | Admit party-kind vocabulary. Party is a broad category, not one shared natural-kind identity criterion. |
| LawFirm, PatentOffice, TrademarkOffice | Institutional holders, identified independently of individual practitioners or examiners. | Institutional party classifications, whose purpose or delegated competence can change. | Admit in the party-kind SKOS scheme. Do not assert universal OntoClean rigidity: an institution can change purpose and still be the same organization. |
| InventorRole | Relationship of a person to a particular invention and evidence of contribution. | Externally dependent role relative to an invention. Historical attribution may persist after prosecution. | Admit separate legal-role concept. Start/end describe recorded assignment applicability, not erasure of historical inventorship. |
| ApplicantRole, AssigneeRole, OwnerRole, ExaminerRole, AttorneyOfRecordRole, CorrespondentRole, ClientContactRole, SignerRole, LicenseeRole, LicensorRole | Holder plus identified matter/asset/document/agreement and authority/evidence. | Anti-rigid contextual participation; role may change while holder identity persists. | Admit separate role vocabulary; no role narrower/broader edge to party kinds. A party can occupy multiple simultaneous roles. |
| Deadline, StatutoryDueDate, SoftDueDate and specialized deadline terms | Docket target identified by action, scope and source evidence, rather than a bare date value. | Planned temporal targets or obligation classifications, dependent on applicable law, event or local planning. | Admit descriptive concepts, no date arithmetic or universal legal obligation. Section15DeclarationDeadline is an elective declaration target; annuity jurisdiction remains explicit. |
| DocketingEvent | Observed occurrence with time, provenance and matter context. | Event, distinct from the target it creates, changes or satisfies. | Admit event vocabulary; no scheduled target treated as an occurred event. |
| DeadlineState and open/extended/final/missed variants | Recorded observation concerning a target and its evidence. | Evidence-backed status descriptors, dependent on observation context; not an enduring kind or event. | Admit recorded-state vocabulary. FinalDeadlineState does not imply a final office action or prevent every remedial route. |

SKOS broader edges support bounded lookup only. They do not establish legal
identity equality, OWL class inclusion or formal rigidity. Law-practice's
legal_client/legal_contact are application-facing party associations, not
replacement identities or person subclasses; unchanged domain records remain
consumer-owned. PartyIdentifier records, chain-of-title entities and role
assignments are deferred to domain packets.

External mappings remain empty: no vetted M3 correspondence row establishes
FOLIO/LKIF/FOAF/ORG concept identity. PROV qualifiedAssociation/hadRole/
startedAtTime/endedAtTime is a prose role-assignment pattern, not an external
exactMatch assertion. Public legal authorities appear only as source notes.

Independent adversarial and blinded category reviews requested six revisions.
All are accepted: separate scheme identity implies no disjoint holder classes;
inventor attribution requires conception evidence; open targets may be elective;
status descriptors overlap; public source scope is bounded; family warrants
and domain/null discrimination are documented below.

Family warrants: holder categories support CQ5/18 identity continuity, with
matter role as the counterexample to identity. Institutional sublabels express
function, never rigid essence. Roles support participation queries scoped by
invention, matter, asset, document or agreement; absence of scope/evidence is
unknown, never a role assignment. Targets support CQ1/7/8 planning queries; an
observed occurrence is the event counterexample. States require observations;
no observation is unknown, never open or missed. These are naming warrants
for SKOS lookup, not formal domain entity validation. This report makes
no full foundational-artifact-validator or steward-ratification claim; the
brief authorizes this bounded vocabulary delivery and excludes a new ontology
workflow/package outside its surfaces.
