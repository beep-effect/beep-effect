# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last.
-->

## 2026-11-06 — packet shape

**Question:** Re-enter `research-corpus-synthesis`, open a new exploration,
or go straight to a goal?

**Answer:** New exploration packet (`research-library-ontology`), linking
the graduated packet as predecessor.

**Rationale:** The graduation contract (explorations/README.md, ratified
2026-08-13) reopens a graduated packet at `decompose` only when a named gate
fires. This is new capture: a new corpus and an ontology design that did not
exist in October. Re-entry would mix two denominators in one packet and bend
the contract; a goal now would skip the design the grill exists for.

## 2026-11-06 — domain model ownership

**Question:** Once the library is ontology-first, who owns
Source/Version/Capture/Artifact/Occurrence/Finding/Disposition?

**Answer:** Stay in tooling (`commands/Research/Library`). Rewrite
`Library.schemas.ts` to named `S.Class` models joined to the `@beep/ontology`
fold; publish the T-Box (Turtle) and SHACL shapes as versioned artifacts in
the library root. Promotion to `packages/epistemic/domain` is a gated
candidate recorded in `MAP.md`, fired when a second consumer appears.

**Rationale:** Rejected: promote to the epistemic slice now (one consumer;
fails the specific-home-first gate and couples operator tooling to a product
slice), and a new `tooling/library/research-library` package (right shape for
`beep-cli-composition`, but that goal is still carving its library map; a new
package now lands in a moving topology).

## 2026-11-06 — web acquisition route

**Question:** How do ~400 non-GitHub, non-arXiv URLs per hop get acquired?

**Answer:** New a new `@beep/firecrawl` driver package driver; `acquire` gains a
native web route whose envelopes match the existing `Library.web.ts`
validator (`raw-response`, `raw-full-text`, `extracted-full-text`; 2xx and
`sourceURL` binding).

**Rationale:** External SDK wrappers belong in `drivers/*`
(07-non-slice-families). Rejected: session-scrape plus `import-result`
(infeasible at this volume, unrepeatable) and a keyless `effect/http` fetch
route (loses JS-rendered pages: effect.website, X, most vendor pages). Key via
the `op` shim only.

## 2026-11-06 — hop-2 admission

**Question:** What admits a hop-2 source into acquisition?

**Answer:** Routed-finding gate plus domain caps. Every hop-2 identity is
catalogued. A hop-2 source is acquired only when its hop-1 parent produced a
finding routed to a live packet (goal status `active` or `paused`; exploration
not `parked`, `killed` or `graduated`). GitHub is never transitive (cited
object only). arXiv hop 2 is catalogued from alphaXiv reference lists and
acquired on demand. Other domains are capped at 25 acquired hop-2 sources per
domain per intake. Depth is a property of the `wasDerivedFrom` edge; the
cutoff and caps are policy values, not schema.

**Rationale:** October's D3 chose gap-bound over recursive expansion, and D5
("clone every repo") nearly drowned hop 0. A relevance-score threshold was
rejected as model opinion that is hard to audit; the routed finding is a
decision the catalog already records.

## 2026-11-06 — T-Box source of truth

**Question:** Which artifact is hand-authored: Effect `S.Class`, LinkML YAML,
or Turtle?

**Answer:** Effect `S.Class` models with `$I.annoteSchema` ontology
annotations are the source; Turtle T-Box and SHACL shapes are generated
through the existing `@beep/ontology` fold (`fold` → `AssembledOntology` →
`toTurtle`), IRIs minted through `@beep/identity`.

**Rationale:** Matches schema → `Context.Service` → implementation and the
repo's schema-first lint. LinkML has no installed tooling here and its
TypeScript generator yields interfaces, not `S.Class`; hand-authored Turtle
plus hand-authored schemas is the two-sources drift the October reflection
warned about. The INBOX item "TTL→Effect-Schema codegen pipeline" is the
inverse direction (import lane); its finding that namespaces must mint
through the identity registry applies here too.

## 2026-11-06 — Box `IP_LAW_ONTOLOGY_RESEARCH` scope

**Question:** 449 legal-ontology PDFs in Box (2026-06-02): mine now, later,
or ignore?

**Answer:** Download through the Box route, hash-dedupe, inventory as its own
intake snapshot with its own denominator, T1 triage only. Deep reads are a
gated re-entry when a legal-ontology packet asks for them.

**Rationale:** It is a different corpus from both the Nov-5 aggregation and
`academia-2026-07`; full mining roughly doubles deep-read volume and mixes
two topical catalogs. Leaving it in Box repeats the academia loss (its PDFs
were never retained); Box is the only copy.

## 2026-11-06 — decided by consistency (no operator question)

- **Mining tiers.** T1 triage of every readable artifact on `gpt-6-luna`
  (`child.lightweight`); T2 deep reads on Junie `claude-opus-5-5` while
  JetBrains credits remain, then `claude-opus-5-5` children; T3 synthesis by
  the orchestrator. Findings carry CiTO-typed edges, mapping the October
  assertion / observation / proposed-use triad onto CiTO subproperties.
  Precedent: `academia-corpus-mining` T1/T2/T3; pool order: AGENTS.md.
- **Duplicates.** Byte-identical files share one object (existing rule).
  Near-duplicates (the five 11-05 nightly variants, hash-suffixed PDFs with
  differing bytes) are versions of one source identity linked by a
  `nearDuplicateOf` edge; nothing is dropped (October D10).
- **Nightly authority.** The Box series (34 files) is the hop-0 nightly set;
  local copies and variants attach as versions of the same identities.
- **Private archive.** `Research-11-5-26/` enters the library under an
  `accessClass: private` partition: mineable, excluded from `render` output
  by default, never committed. Mining it with hosted models is fine (the OIP
  hygiene rule constrains what moves into the repo, not product
  architecture).
- **Videos.** `.mkv` files are referenced by hash from the `Videos/`
  directory, never copied into `objects/` (October D6). VidBee output imports
  through `import-result` with method/provider `vidbee`: `.vtt` as
  `raw-full-text`, FAQ `.md` as `ai-interpretation`, both hash-bound to the
  media. For cited YouTube URLs without a local bundle the yt-dlp native route
  stays primary; VidBee is the fallback import.
- **`/deep-research`.** One run per finding cluster that `CONTRADICTIONS.md`
  marks as an evidence gap, sequential, at most six per intake.
- **`/adhd`.** Two uses: competency questions for the ontology
  (ontology-requirements stage) and the graduation portfolio.
- **Topology fix.** `Library.service.ts` becomes the `Context.Service`
  contract and live layer in the same slice that rewrites the models; the
  facade stops re-exporting internals through a star export.
- **Build location.** Stay in `commands/Research/Library`; do not pre-empt
  `beep-cli-composition`'s carve-out.
