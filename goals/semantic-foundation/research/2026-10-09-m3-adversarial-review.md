# M3 independent kind, role, deadline and event adversary

Verdict: **revise before freezing the bounded SKOS contract**. This is a
vocabulary review, not an OWL admission, identity ratification, legal opinion,
or claim that the full foundational artifact validator passed. The lane brief
authorizes this bounded delivery; no new ontology root or operator pause is
required. The adversary read the primary audit and candidate data, the R3 M3
recommendations, CQs 1/5/7/8/18, the shared foundational laws, authority matrix,
OntoClean rules and adversary prompt. The blinded alternative seat was not read.

Reviewed input digests:

- `audit-primary.md`: `664c1a960370326f80ba72a23cd859f4fcd44b6c83a763abc50bad498cbfb850`
- `data.json`: `f1f150208b190c1dc6cf558ffbf793f672c65f83c567882d6e3ea3d308f5205b`

## Landed attacks and revision requests

| Rule / surface | Evidence and concrete counterexample | Revision request |
| --- | --- | --- |
| A1: role distinctions are not disjointness; taxonomy/category | The primary audit says “Admit disjoint role vocabulary” but also permits simultaneous roles. One person may be inventor, applicant, owner and signer for the same matter. Distinct SKOS IRIs do not make the corresponding memberships incompatible. | Replace “disjoint” with “separate”. Explicitly state that neither the roles nor institutional classifications are mutually exclusive. Keep role-to-party broader edges absent. |
| A2: contribution is not mere association; denotation/null discriminator | `InventorRole` describes a person “associated with the inventive contribution”. A client contact or practitioner can be associated with that contribution without having made it. CQ5/18 requires distinguishing these relationships. | Define the concept around attribution of inventing or jointly inventing the specified subject matter, supported by evidence; do not infer inventorship from association, ownership, employment or a source mention. Keep the record/claim distinct from the attribution it describes. |
| A3: elective targets cannot inherit mandatory wording; taxonomy/warrant | `Section15DeclarationDeadline` correctly has broader `Deadline`, not `StatutoryDueDate`, and an elective definition. But `OpenDeadlineState` says “awaiting its required action”. A chosen Section 15 target can be open while its filing remains elective. CQ8's word “obligations” must not turn every listed action into a legal duty. | Use neutral pending-action wording for open targets. Carry the elective Section 15 distinction into scope notes or consumer guidance; absence or lateness of this chosen target alone does not establish breach of a mandatory maintenance obligation. |
| A4: status labels are not a mutually exclusive intrinsic phase partition; category/temporal | The audit calls deadline states “Phase/status vocabulary”. A target can be open and extended, final and open, or final and missed. Evidence of an extension depends on authority/context, not merely an intrinsic phase of the target. | Describe them as evidence-backed status descriptors. Do not promise an exclusive state machine or OntoClean Phase classification. Explain that observations need scope and time and may overlap; no absence-based missed/open inference follows from this vocabulary. |
| A5: source authority must match the claim; provenance/null discriminator | All party-kind entries cite MPEP 605 and applicant provisions, including `LawFirm`, `PatentOffice` and `TrademarkOffice`. A patent applicant source does not by itself warrant institutional continuity or a trademark-office classification. `ApplicantRole` includes trademark matters but cites only patent provisions; similar patent-only source rows accompany licensing/contact definitions. | Mark these as repository-authored definitions with contextual sources, not upstream legal definitions or exact support for the whole denotation. Narrow source notes to the supported jurisdiction/topic, add vetted matching sources where available, and otherwise state the gap. Do not present a government URL as evidence for organization identity criteria. |
| A6: a grouped CQ citation is not a term-level warrant; warrant/null discriminator | CQ1 requires response deadlines and status descriptors; CQ7/8 requires the named docket targets; CQ5/18 requires party/role discrimination. A DTO containing these strings is still only a representation. The primary audit cites CQs collectively without explicitly connecting supporting concepts such as `DocketingEvent`, `Party` and `CorrespondentRole` to required decisions. | Add a compact per-term or bounded-family warrant/discriminator record: decision concept versus support concept, the decision it serves, domain use, and the null boundary. Mere inclusion in the fixed list does not justify treating a label as an entity class or proving real-world occurrences. Keep implementation-only interpretations available for usage records. |

The Section 15 attack is independently supported by the
[USPTO post-registration timeline](https://www.uspto.gov/trademarks/trademark-timelines/post-registration-timeline-all-registrations-except-madrid-protocol),
which distinguishes optional Section 15 declarations from required maintenance
filings. No filing dates, periods or calculations are derived here. Attempts
to open the cited MPEP 605/210 pages through the web tool failed; this review
does not claim live verification of their contents. A5 attacks the candidate
notes' declared patent subject and broader semantic use, not unseen page text.

## Attacks that did not land within the authorized scope

- **Institutional identity and rigidity:** an organization can stop providing
  legal services, lose delegated patent competence, or acquire trademark
  competence without ceasing to be that organization. The primary audit
  already admits this and refuses universal rigidity. `LawFirm`,
  `PatentOffice` and `TrademarkOffice` may remain organizational classification
  concepts in a named SKOS scheme; the scheme name is not an OntoClean Kind
  assertion. An office administering both fields may carry both labels.
- **Identity:** “human continuity” and “institutional continuity” are useful
  conceptual reminders but do not decide CQ5 merges. Identical names can
  belong to different people; a renamed institution can remain one holder;
  a merger need not preserve each predecessor's identity. Because entity
  implementation and `PartyIdentifier` are deferred, these are not adequate
  automated identity criteria and must remain non-executable commentary.
- **Inventorship persistence:** ending a recorded prosecution assignment or
  the matter does not erase a historical inventive contribution. The primary
  audit explicitly preserves this. Apply the same distinction to signer
  history and past assignments/licenses: ending current applicability does
  not delete the historical relation. “Time-bounded roles” in R3 must not be
  copied into a claim that all such relations expire.
- **Taxonomy edges:** the party and deadline broader edges support concept
  lookup rather than OWL subclass entailments. There is no claimed identity
  inheritance, anti-rigid superclass over rigid subclass, or role-to-person
  class edge to block. `Section9RenewalDeadline` under the jurisdiction-aware
  `TrademarkRenewalDeadline` and Section 15 directly under `Deadline` are
  defensible. The top-level deadline concept must continue to include
  voluntary and internal targets as well as externally imposed ones.
- **World versus information:** `DocketingEvent` is explicitly an observed
  occurrence; a scheduled target is not such an occurrence. A consumer record
  is evidence about the event, not identical to it. `DeadlineState` is a
  recorded description, not proof of a missed act, extension or loss of rights.
- **Reuse:** empty external mappings are preferable to invented FOAF/ORG,
  FOLIO, LKIF, PROV or ODRL equivalences. R3's reuse recommendations warrant
  design consideration, not arbitrary SKOS `exactMatch` links between local
  vocabulary concepts and external OWL classes/properties. Pattern-level
  PROV guidance does not prove a correspondence.

## Admission boundary

The scoped concepts have plausible operational denotations because CQs demand
distinguishing real parties and legal participation, supported docket targets,
and source events. That defeats a claim that the entire controlled vocabulary
is purposeless implementation bookkeeping. It does **not** defeat the null
for every source record, establish any particular party/event as real, or
warrant OWL class admission. A pure fixture or display DTO can carry all these
labels without making any domain assertion true.

After A1–A6 are addressed by the synthesis owner, this bounded review has no
remaining demand for OWL axioms, party/role entities, a deadline calculator,
obligation rules, external mappings or a formal foundational admission run.
Revised bytes require re-review; this verdict is bound to the digests above.
