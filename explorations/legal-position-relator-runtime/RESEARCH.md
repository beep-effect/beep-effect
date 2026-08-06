# Research — Legal Position Relator Runtime

<!--
Stage 1 synthesis and index. The depth lives in the two lane artifacts under
research/; this file is the canonical cold-session surface over them
(explorations/README.md stage contract). Lanes ran 2026-08-05 as two parallel
Claude Opus 5 agents (Workflow `wf_66532d96-48b`) per the DECISIONS.md
orchestration entry.
-->

## Lane artifacts

1. [`research/01-repo-surfaces.md`](./research/01-repo-surfaces.md) — grounded
   file:line inventory of every live surface and binding SPEC contract the
   wedge composes (taxonomy foundation, `EdgeVersion`, `EdgeAuthority`,
   Party/Role/principal surfaces, `ExecutionLedger`, the contradiction-triage
   goal, the candor sibling boundary), reconciled against all ten nuggets;
   net-new symbols re-confirmed at zero occurrences on 2026-08-05; drift
   against the 2026-08-01 routing-seed grounding attributed section by
   section.
2. [`research/02-position-relator-legal-frame.md`](./research/02-position-relator-legal-frame.md) —
   bounded legal-theory frame from public primary sources (Hohfeld's 1913 and
   1917 Yale Law Journal articles from Yale's own repository, published
   FLINT/eFLINT papers plus an ILLC MSc thesis and a working note — source
   classes distinguished in the lane's §9 — and the TNO `flint-ontology`
   GitLab repository, published UFO-L papers), with the
   correlativity/opposite algebra, the P100/R25
   verification verdicts, the competency-question field mapping, and the
   never-compute boundary drawn and cited. Failed fetches are recorded in the
   file's NOT FOUND / NOT VERIFIED ledger rather than papered over.

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## What the landscape says (synthesis)

**The carried contradiction cluster now composes shipped code, not a
promise.** `feat(epistemic): add contradiction source triage (#520)` merged
2026-08-02 — one day after the routing seed's grounding — landing
`ContradictionCandidate`/`Receipt`/`Disposition`, a digest-sealed
`ContradictionMatchBasis`, and a five-operation repository (Lane A §6, §10).
The forbid-widening line is exact and blunt: "No changes to shared
`ClaimLifecycle`; no IP-law vocabulary" (`SPEC.md:27`), typed verdict families
stay separate (`:76-78`), and detection-heuristic pressure is a stop
condition (`:138-139`). Compose-don't-widen is now enforced by live code
review surface, not just doctrine.

**The composition surface is real but thinner than the seed implied.**
`EdgeVersion` is strictly binary with no widening seam (two endpoint slots,
untyped qualifiers, `fact` as `UnknownRecord`); `@beep/ontology` has no
correlative primitive — `TaxonomyConcept` stores `broader` with no `narrower`
field, and `owl:inverseOf` exists only as a decoded FOLIO mirror field —
though the fold's narrower→broader normalization
(`Fold.assembly.ts:730-736`) is the nearest live inverse-pair precedent,
distinct from the endpoint-ordering combinator (`orderEndpoints`), which
canonicalises two presentations of one relation — symmetry, not
correlativity, which pairs two differently-named positions held by two
parties (Lane A §1, §2). A `Party` entity is NOT FOUND anywhere in
`packages/**/src`;
`RuntimePrincipalId` in the agents runtime is a module-private bare string
while the epistemic slice already injects a real `Principal` — sharpening the
T4-F6 align question into "does agents adopt the shared `Principal` union, or
does the legal layer map down?" (Lane A §4). `ExecutionLedger` gives durable
attempt records, but no surface anywhere in `packages/**/src` holds legal
competence, capacity, validity, or nullity (Lane A §5).

**The theory frame corrects the nuggets before they become schema.** T1-F1
conflates Hohfeld's two axes: correlative (cross-party, same relation) and
opposite (same party, negated position) are distinct derivations, and the
opposite bimap is unsound over `kind` alone — it must be defined over
`(kind, content)` with act/omission polarity or it manufactures false
contradictions (Lane B §1). The clean algebra: correlative and opposite are
commuting involutions forming a Klein four-group over the eight positions,
with exactly two orbits — LiteralKit-ready. UFO-L states T1-F2 better than
the nugget does (relators are "full-fledged endurants … as opposed to just
n-uples of relata"); its correlated moments as essential, inseparable parts
of one relator is the strongest support for storing one relation and deriving
views (Lane B §4). T1-F9's field list needs two corrections: `result` cannot
be required on a standing position, and one grounding event is insufficient
(original and derived founding events both matter) (Lane B §5). T1-F7's
sharpest design tension is void-vs-penalised: acting without permission
invites a penalty, acting without power means the act was never constituted —
eFLINT's uniform violation rule collapses exactly the distinction the wedge
exists to preserve (Lane B §2).

**Donor verdicts (Lane B's verification is done; ledger promotion is
pending).** Lane B's verdict on P100 is `verified-with-correction`: FLINT's
act/fact frames and precondition→create/terminate semantics check out
verbatim, but "transition semantics over Hohfeldian relators" is false as
written — FLINT models act frames *instead of* positions, its own competency
material puts liberty–no-right, immunity–disability, omissions, and duty
violations out of scope, and the maintainers point at Griffo et al. for the
relation modeling this wedge needs; beep-fit passes for the
frame/slot/precondition shape only — eFLINT's execution semantics are
excluded because they collapse void-vs-penalised (Lane B §2). Lane B's
verdict on R25 is `verified` — all four gates pass on the real repository
(TNO GitLab, not GitHub): top-level Apache-2.0 (port-with-attribution),
`shacl/` MPL-2.0 (clean-room only), with `SlotCorrespondence`, hard/advisory
shapes, source references (structural pointers verified; the `src:` offset
module is NOT FOUND — Lane B §3.3, §8), and 22 competency queries confirmed
(Lane B §3). The pre-existing `ShaclSeverity` in `@beep/semantic-web` narrows
what the wedge would *want* from `shacl/` — the severity split is already
owned — but not the obligation: anything taken from either `shacl/*.ttl`
file is clean-room-only regardless of novelty, and the clean-room derivation
must be recorded in the graduated goal packet (Lane A §8; Lane B §3.2). Both
verdicts are Lane B's; the parent campaign's `nugget-catalog.json` rows were
promoted 2026-08-06 with the align outcomes (dated verification descriptors,
recommendation `adopt`) — a parent-packet act landing in the same PR as this
file.
Recommended donor split: position domain and relator shape from UFO-L;
frame/slot/precondition/source-reference machinery and the validator
severity split from FLINT.

**The never-compute boundary is "attributed interpretation", not "compute
nothing".** Lane B §6 delivers an 11-row records/derives/never-computes
table, each row cited (one row inherits the triage SPEC via CAPTURE and is
marked NOT VERIFIED by that lane; eFLINT's authors: no explicit conflict-
resolution mechanism; UFO-L: no normative system is guaranteed complete).
The nuance: interpretation and qualification are subjective and human; only
assessment is automatable, and only relative to a named, attributed
interpretation — never asserted as legal truth. The sibling candor SPEC
already states the authority half of this boundary; the wedge inherits it
rather than restating it (Lane A §7). Griffo's five scope axes (material,
temporal, jurisdictional, quantitative, subjective) give `LegalScopeContext`
primary-source grounding T1-F3/T3-F9 previously lacked.

**Package-home evidence cuts both ways.** The same-day sibling precedent
(graduated 2026-08-05, PR #560) fixes legal vocabulary in
`packages/law-practice/domain`, entity ids in `shared/domain/src/identity/`,
and "No new packages" as a Non-Goal — with one bounded new-package exception
already carved at `SPEC.md:96-99` — so a separate legal-consumer core
package departs from precedent (Lane A §7). But Lane B §7.2 carries the
counter-evidence: UFO-L is explicitly a *core* ontology layered
UFO-A → UFO-C → UFO-L → domain, so co-locating positions with patent
entities flattens a distinction the donors treat as structural, while a
separate legal-core package preserves it at the cost of a package. Lane B
deliberately makes no recommendation; the decision is Benjamin's at align.
Lane B §7.3 is stronger on the Party–Role split: collapsing them makes
principle collisions structurally unrepresentable, so that split is closer
to a requirement than a preference.

## Open questions carried to align

The manifest's align questions, sharpened by the lanes: V1 scope
(scheme-first vs full relator — the Klein-group position domain is
LiteralKit-ready today, but Lane B §7.1 finds scheme-first is *not separable*
from content: the opposite bimap is unsound without act/omission polarity,
polarity lives in the relator's content field, and the correlative pair *is*
the simple relator — its attributed recommendation is scheme-plus-simple-
relator);
package home (sibling precedent vs new package); the Party–Role/principal
split (adopt shared `Principal` in agents vs legal maps down; no `Party`
entity exists); the `CorrectionDelta` shape (T4-F8's precise gaps against the
live triage code: model/configuration identity, validator report, semantic
checkpoints, explicit delta vs whole-fact replacement); plus two new branches
the lanes surfaced — the void-vs-penalised representation for `PowerExercise`
(T1-F7) and the opposite-bimap content/polarity model (T1-F1). P100/R25
adoption follows Lane B's recorded verdicts; promoting the parent campaign's
ledger rows out of `unverified-addendum`/`study` is a parent-packet act at
align/PR 2.
