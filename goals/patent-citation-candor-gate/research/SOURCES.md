# Patent Citation Candor Gate — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back
to its origin. Inherited at graduate (2026-08-04) from the source exploration;
the exploration's ledger is the PRIMARY copy — this file reproduces the corpus
for implementation convenience and must not drift ahead of it.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk; otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft upstream is CLEAN-ROOM only; permissive
  may be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/patent-citation-candor-gate` — primary
  ledger:
  [`explorations/patent-citation-candor-gate/research/SOURCES.md`](../../../explorations/patent-citation-candor-gate/research/SOURCES.md).
- **Provenance:** first wedge of the `legal-patent-kg-deepening` campaign's
  signed-off routing matrix (cluster "Patent citation events and candor
  disposition", wave P1); parent nugget ledger
  [`nugget-catalog.json`](../../../explorations/legal-patent-kg-deepening/research/nugget-catalog.json)
  — this goal consumes nuggets `T2-F2`, `T3-F7`, `ADHD-1`.

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (T2-F2:
P017, P006, P041; T3-F7: P064, P074, L14, P099; ADHD-1: /adhd frames spee6,
regu3, onca4, comp3 in the campaign's `research/20-adhd-integration.md`). No
new corpus was mined for this goal; links, not copies.

**How these inform implementation:** T2-F2 (survived 3/3 adversarial passes)
is the reification mandate — citation acts, face-list presence, reliance, and
similarity stay separate claims, which is why `PatentCitationEvent` and
`CandorDisposition` are two entities and `CitationBase` is not a donor. T3-F7
motivates fragment identity that survives text reflow (`PatentFragmentLocator`
as a composing value, rung-1 optional). ADHD-1 is the deepened first-step play
this goal's failing-test slice is lifted from.

## 2. Upstream repositories & licenses

None — the goal composes in-repo bricks; no external repo is a donor.

## 3. External research sources

Lane B's six captures (2026-08-04), held as gitignored working copies under
`explorations/patent-citation-candor-gate/assets/vendor/legal-sources/` (see
that packet's `assets/README.md`); reproducible from these upstream URLs,
which also appear in the provenance header of the exploration's
[`research/02-candor-legal-frame.md`](../../../explorations/patent-citation-candor-gate/research/02-candor-legal-frame.md):

| Capture | Upstream | License / discipline |
|---------|----------|----------------------|
| `cfr-1-56-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.56> | US government work (regulatory text); cite freely |
| `cfr-1-97-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.97> | US government work; cite freely |
| `cfr-1-98-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.98> | US government work; cite freely |
| `mpep-2001.md` | <https://www.uspto.gov/web/offices/pac/mpep/s2001.html> | USPTO public domain (rev. R-01.2024 visible) |
| `mpep-609.md` | <https://www.uspto.gov/web/offices/pac/mpep/s609.html> | USPTO public domain (rev. R-01.2024 visible) |
| `therasense-casemine.md` | <https://www.casemine.com/judgement/us/5914af0eadd7b0493474ac8c> | Opinion text public domain (649 F.3d 1276, Fed. Cir. 2011 en banc); Casemine's own layers cited only as capture vehicle, paraphrase-only |

Negative provenance note: the Wikipedia article for the Therasense case does
not exist; the initially attempted capture was discarded (see the exploration
ledger). The CFR captures postdate the visible MPEP revision — cite which
source version each fact state was modeled from (SPEC constraint).

## 4. In-repo capability references

Verified by research Lane A, 2026-08-04 (file:line grounding, LIVE-SOURCE vs
SPEC-CONTRACT classification, and inherited-citation drift notes in the
exploration's
[`research/01-repo-surfaces.md`](../../../explorations/patent-citation-candor-gate/research/01-repo-surfaces.md);
decompose-stage capability table in its
[`MAP.md`](../../../explorations/patent-citation-candor-gate/MAP.md)):

- `@beep/law-practice-domain` — `PatentReference`
  (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts`),
  `PriorArtReference` (recorded alongside, never migrated), `ApplicationNumber`
  (WIPO ST.13, `.../values/ApplicationNumber/`), `Claim`,
  `PatentDocumentTriplet`, `DurableLocator` (`CitationBase` is a named no-go,
  never a donor) — reuse/extend, LIVE SOURCE.
- `@beep/provenance` (foundation/modeling/provenance) — `TextAnchor`,
  `VerifiedTextAnchor` + `TextAnchorVerificationReceipt` (persisted receipt
  requires re-verification via `verifyTextAnchor` before any "current"
  claim), `SourceTextIdentity` — reuse, LIVE SOURCE.
- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeCandidateDraft`, `RuntimeApprovalGate`; decision vocabulary
  currently `pending` only) — READ-ONLY compose through a lawful cross-slice
  shape, never a direct import; LIVE SOURCE.
- `@beep/epistemic-use-cases` — `ExecutionLedger` ports
  (`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts`)
  — rung-2 durability PRECEDENT (pattern, not import); epistemic's
  `EvidenceSpan` is NOT embedded (forbidden cross-slice edge).
- `@beep/schema` — `LiteralKit` for every string-literal vocabulary.
- `packages/drivers/uspto` — `UsptoApplicationNumber` (eight-digit normalized
  shape) is MIRRORED in the law-owned identity union, never imported (domain
  never imports drivers).
- SPEC CONTRACT only (compose-only, never fork): `CitationMention`
  (`goals/citation-extraction-engine`), verified-span invariants
  (`goals/citation-verified-span-substrate`), prosecution observations +
  quarantine producer (`goals/uspto-prosecution-read`), runtime approval flow
  (`goals/agentic-professional-runtime`).
- NET-NEW (zero source symbols, re-verified 2026-08-04 by Lane A's rg sweep):
  `PatentCitationEvent`, `CandorDisposition`, the application-identity union,
  `CandorPolicy`, rung-2 IDS fact records, the law-practice slice's first
  db-admin migration, and (optional) `PatentFragmentLocator`.

## 5. Cross-links & provenance

- Source exploration packet:
  [`explorations/patent-citation-candor-gate/`](../../../explorations/patent-citation-candor-gate/README.md)
  — BRIEF (approved 2026-08-04), DECISIONS (binding log seeded into
  `SPEC.md`), MAP (decompose surface), RESEARCH + lanes.
- Parent campaign:
  [`explorations/legal-patent-kg-deepening/`](../../../explorations/legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, /adhd artifact, campaign DECISIONS).
- Composed goal SPECs: `goals/citation-extraction-engine`,
  `goals/citation-verified-span-substrate`, `goals/uspto-prosecution-read`,
  `goals/agentic-professional-runtime`.
- This goal's decision log lives in [`SPEC.md`](../SPEC.md) (seeded from the
  exploration's DECISIONS at graduate; back-links, not copies).
