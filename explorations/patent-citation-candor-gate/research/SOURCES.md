# Patent Citation Candor Gate — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing; state the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** the "Patent citation events and candor disposition"
  cluster of the parent campaign's signed-off routing matrix
  (`explorations/legal-patent-kg-deepening/routing-seed.json`, wave P1).
- **Provenance:** parent ledger
  [`nugget-catalog.json`](../../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T2-F2`, `T3-F7`, `ADHD-1`.

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (T2-F2:
P017, P006, P041; T3-F7: P064, P074, L14, P099; ADHD-1: /adhd frames spee6,
regu3, onca4, comp3 in `research/20-adhd-integration.md`). No new corpus is
mined for this wedge; links, not copies.

## 2. Upstream repositories & licenses

None — the wedge composes in-repo bricks; no external repo is a donor.

## 3. External research sources

Lane B's six captures (2026-08-04), held as gitignored working copies under
`assets/vendor/legal-sources/` (see `../assets/README.md`); reproducible from
these upstream URLs, which also appear in the provenance header of
[`02-candor-legal-frame.md`](./02-candor-legal-frame.md):

| Capture | Upstream | License / discipline |
|---------|----------|----------------------|
| `cfr-1-56-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.56> | US government work (regulatory text); cite freely |
| `cfr-1-97-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.97> | US government work; cite freely |
| `cfr-1-98-lii.md` | <https://www.law.cornell.edu/cfr/text/37/1.98> | US government work; cite freely |
| `mpep-2001.md` | <https://www.uspto.gov/web/offices/pac/mpep/s2001.html> | USPTO public domain (rev. R-01.2024 visible) |
| `mpep-609.md` | <https://www.uspto.gov/web/offices/pac/mpep/s609.html> | USPTO public domain (rev. R-01.2024 visible) |
| `therasense-casemine.md` | <https://www.casemine.com/judgement/us/5914af0eadd7b0493474ac8c> | Opinion text public domain (649 F.3d 1276, Fed. Cir. 2011 en banc); Casemine's own layers cited only as capture vehicle, paraphrase-only |

Negative provenance note: the Wikipedia article for the Therasense case does
not exist; the initially attempted capture was an article-not-found page and
was discarded (Lane B's in-file gap markers were amended 2026-08-04 once the
opinion capture landed).

## 4. In-repo capability references

Verified by research Lane A, 2026-08-04
([`01-repo-surfaces.md`](./01-repo-surfaces.md) — file:line grounding,
LIVE-SOURCE vs SPEC-CONTRACT classification, and inherited-citation drift
notes live there):

- `@beep/law-practice-domain` — `PatentReference` (three optional fields:
  country/number/kindCode), `PriorArtReference` (examiner-linked occurrence
  with `officeActionFixtureKey`; do not generalize it), `Claim` (whole-claim
  entity only), `PatentDocumentTriplet`, `DurableLocator` (quote/context
  generic legal locator; does not close the structured-fragment gap),
  `CitationBase` (mixes semantic/occurrence/telemetry; do not reuse as donor)
  — reuse/extend, LIVE SOURCE.
- `@beep/provenance` (foundation/modeling/provenance) — `TextAnchor`,
  `VerifiedTextAnchor` (opaque runtime proof vs persistable receipt needing
  re-verification), `SourceTextIdentity` — reuse, LIVE SOURCE.
- `@beep/epistemic-domain` — `EvidenceSpan` — reuse, LIVE SOURCE.
- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeCandidateDraft`, `RuntimeApprovalGate` with array-of-non-empty-
  string `candidateRefs`/`requestedActions`, `RuntimeEvidenceRef`; decision
  vocabulary currently `pending` only; no candor or observation-version
  field) and `ExecutionLedger` ports (append-only precedent) — compose,
  LIVE SOURCE.
- SPEC CONTRACT only (compose-only, never fork): `CitationMention`
  (`goals/citation-extraction-engine`), verified-span invariants
  (`goals/citation-verified-span-substrate`), prosecution observations
  (`goals/uspto-prosecution-read`), runtime approval flow
  (`goals/agentic-professional-runtime`).
- `PatentCitationEvent`, `CandorDisposition`, `PatentFragmentLocator`,
  `PatentReferenceDiscoveryEvent` — NET-NEW (zero source symbols, re-verified
  2026-08-04 by Lane A's rg sweep; commands recorded in its §5).

## 5. Cross-links & provenance

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, /adhd artifact, campaign DECISIONS).
- Composed goal SPECs: `goals/citation-extraction-engine`,
  `goals/citation-verified-span-substrate`, `goals/uspto-prosecution-read`,
  `goals/agentic-professional-runtime`.
- This packet's decision log: [`../DECISIONS.md`](../DECISIONS.md); capture:
  [`../CAPTURE.md`](../CAPTURE.md).
