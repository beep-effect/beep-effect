# Audit: `ontology-modeling-foundation` Supersession

## Anchor

The identity-as-IRI handoff is the superseding context because it says the old package is prior art to resurrect only selectively, and it explicitly kills the old authoring API surface. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`

```text
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47:- Prior art to resurrect selectively: the deleted `@beep/ontology` package
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:48:  (draft→assembly pipeline, JSON-LD/Turtle/Markdown projections, SKOS profiles,
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:49:  `OntologyAssemblyError` taxonomy). The projections and assembly walker are
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:50:  good; the authoring API (`Ontology.create`, `createOntologyIdentity`, the
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:51:  eight-way `ref`/`parent`/`child`/`exact`/... synonym set, runtime draft
explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:52:  sniffing, string term references) is dead and stays dead.
```

The replacement surface is composer-centered because the handoff says the composer absorbs `Ontology.create`, derives `baseIri` and `prefix`, and exposes `$I.key(...)`, `$I.class(...)`, and `$I.ontology(...)` over triples-as-tuples. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:204-235`

## Dead Design Confirmation

`goals/ontology-modeling-foundation/README.md` specifies the dead design because its current decisions favor `Ontology.create(...)` and an identity wrapper. `goals/ontology-modeling-foundation/README.md:40-48`

```text
goals/ontology-modeling-foundation/README.md:46:- The authoring syntax should favor the `Ontology.create(...)` combinator
goals/ontology-modeling-foundation/README.md:47:  surface and an identity wrapper that auto-populates Effect Schema annotation
goals/ontology-modeling-foundation/README.md:48:  fields.
```

`goals/ontology-modeling-foundation/README.md` also keeps the broad relationship-reference synonym surface alive. `goals/ontology-modeling-foundation/README.md:49-51`

```text
goals/ontology-modeling-foundation/README.md:49:- Relationship references such as `sameAs`, `equivalentClass`, `parents`,
goals/ontology-modeling-foundation/README.md:50:  `children`, `seeAlso`, and `isDefinedBy` may accept schema values, local
goals/ontology-modeling-foundation/README.md:51:  terms, IRIs, RDF named nodes, or assembled references.
```

`goals/ontology-modeling-foundation/SPEC.md` specifies the dead design because it makes `Ontology.create(...)` the public POC syntax. `goals/ontology-modeling-foundation/SPEC.md:49-63`

```text
goals/ontology-modeling-foundation/SPEC.md:51:The public POC syntax is:
goals/ontology-modeling-foundation/SPEC.md:57:const { Ont, $I } = Ontology.create({
goals/ontology-modeling-foundation/SPEC.md:58:  identity: $OntologyId.create("example-ontology"),
goals/ontology-modeling-foundation/SPEC.md:59:  baseIri: "https://example.org/ontology#",
goals/ontology-modeling-foundation/SPEC.md:60:  preferredPrefix: "ex",
goals/ontology-modeling-foundation/SPEC.md:61:  label: "Example Ontology"
goals/ontology-modeling-foundation/SPEC.md:62:})
```

`goals/ontology-modeling-foundation/SPEC.md` keeps the `Ont.class(...)`, `Ont.dataPredicate(...)`, `Ont.objectPredicate(...)`, `Ont.sameAs(...)`, `Ont.parent(...)`, `Ont.equivalentClass(...)`, and `Ont.build(...)` surface that the handoff replaces with `$I` handles and a fold. `goals/ontology-modeling-foundation/SPEC.md:65-78` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-114`

## Current Status Fields

The target README status is `ACTIVE - POC implementation in progress`. `goals/ontology-modeling-foundation/README.md:3-5`

The target SPEC status is `ACTIVE`. `goals/ontology-modeling-foundation/SPEC.md:3-5`

The target manifest identifies `ontology-modeling-foundation`, titles it `Ontology Modeling Foundation`, sets `initiative.status` to `active`, and keeps `packetAnchorDocument` at `SPEC.md`. `goals/ontology-modeling-foundation/ops/manifest.json:3-10`

The target manifest says `currentSourceOfTruth` is `SPEC.md` and `currentTargetPhase` is `P3`. `goals/ontology-modeling-foundation/ops/manifest.json:11-13`

The target manifest completion gate still requires a Yeet PR path and says the goal is not achieved until PR-driven mergeability. `goals/ontology-modeling-foundation/ops/manifest.json:51-57`

## Link Inventory

The target goal has self-references in its manifest id and creation plan, but those are not other goal, exploration, or docs links. `goals/ontology-modeling-foundation/ops/manifest.json:3-10` `goals/ontology-modeling-foundation/PLAN.md:8-13`

`explorations/identity-as-iri/README.md` links the supersession audit as part of current identity-as-IRI research. `explorations/identity-as-iri/README.md:20-26`

`explorations/identity-as-iri/CAPTURE.md` states that `goals/ontology-modeling-foundation` encodes the dead `Ontology.create` design and needs superseding. `explorations/identity-as-iri/CAPTURE.md:83-89`

`explorations/identity-as-iri/assets/exploration-report-2026-07-01.md` states that the goal encodes the dead design and must be superseded to avoid contradictory guidance. `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:74-79`

`explorations/identity-as-iri/assets/exploration-report-2026-07-01.md` lists `goals/ontology-modeling-foundation supersession` as a repo-audit task and later says to mark the goal as superseded before implementation starts. `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:122-123` `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:142-143`

`explorations/ATLAS.md` indexes identity-as-IRI as the packet whose research includes superseding `goals/ontology-modeling-foundation`. `explorations/ATLAS.md:133-144`

`goals/README.md` indexes `ontology-modeling-foundation` as a foundation modeling packet for the `@beep/rdf` and `@beep/ontology` split and schema-annotation ontology builder POC. `goals/README.md:184-188`

`docs/BEEPGRAPH_ARCHITECTURE.md` cites `ontology-modeling-foundation/SPEC.md:10-11` for the doctrine that Effect Schema classes are source of truth and JSON-LD/Turtle projections are derived. `docs/BEEPGRAPH_ARCHITECTURE.md:111-113`

`docs/BEEPGRAPH_ARCHITECTURE.md` uses `ontology-modeling-foundation/SPEC.md:10-11` for design-time ontology grounding and typed authority with ontology annotations. `docs/BEEPGRAPH_ARCHITECTURE.md:227-229`

`docs/BEEPGRAPH_ARCHITECTURE.md` classifies ontology authoring over Effect Schema to JSON-LD/Turtle as `Specced, blocked` and points at `goals/ontology-modeling-foundation/SPEC.md`. `docs/BEEPGRAPH_ARCHITECTURE.md:256-260`

`docs/BEEPGRAPH_ARCHITECTURE.md` includes `goals/ontology-modeling-foundation/SPEC.md:10-11` in authority criteria and includes `ontology-modeling-foundation` in the specced goal set. `docs/BEEPGRAPH_ARCHITECTURE.md:321-323`

`explorations/_gold-intake/ROUTING.md` routes an IP-law domain-depth cluster with `goals/ontology-modeling-foundation` as a secondary target. `explorations/_gold-intake/ROUTING.md:395-397`

`explorations/_gold-intake/routing/shards/shard-ip-domain-models.json` lists `goals/ontology-modeling-foundation` as a secondary target and says License Grant / IP Ownership should coordinate with it. `explorations/_gold-intake/routing/shards/shard-ip-domain-models.json:38-48`

`explorations/_gold-intake/routing.json` lists `goals/ontology-modeling-foundation` among secondary targets. `explorations/_gold-intake/routing.json:940-946`

`explorations/domain-layer-hardening/MAP.md` says a future SPO-capable assertion packet must reconcile with `@beep/ontology`, `ontology-modeling-foundation`, and `ip-law-knowledge-graph`. `explorations/domain-layer-hardening/MAP.md:75-80`

`explorations/atlas-synthesis/synthesis/04-goals-landscape.md` lists `ontology-modeling-foundation` and `ontology-interop-roadmap` under the ontology / KG platform. `explorations/atlas-synthesis/synthesis/04-goals-landscape.md:115-118`

`goals/ontology-interop-roadmap/README.md` says the roadmap plans the next ontology interop phase after `goals/ontology-modeling-foundation`. `goals/ontology-interop-roadmap/README.md:18-24`

`goals/ontology-interop-roadmap/SPEC.md` ranks `goals/ontology-modeling-foundation` as source-hierarchy item 3. `goals/ontology-interop-roadmap/SPEC.md:15-23`

`goals/ontology-interop-roadmap/PLAN.md` records inspection of `goals/ontology-modeling-foundation` as completed phase-0 work. `goals/ontology-interop-roadmap/PLAN.md:8-15`

`goals/ontology-interop-roadmap/GOAL.md` says the packet extends `goals/ontology-modeling-foundation` and tells future editors to inspect that packet before package work. `goals/ontology-interop-roadmap/GOAL.md:16-28`

`goals/ontology-interop-roadmap/research/current-surface-gap-analysis.md` lists `goals/ontology-modeling-foundation/SPEC.md` as a source. `goals/ontology-interop-roadmap/research/current-surface-gap-analysis.md:5-12`

`goals/ontology-interop-roadmap/research/skos-profile-research.md` lists `goals/ontology-modeling-foundation/SPEC.md` as a source. `goals/ontology-interop-roadmap/research/skos-profile-research.md:5-10`

`goals/law-practice-office-action-spike/research/SOURCES.md` lists `goals/ontology-modeling-foundation` as a related secondary target not edited there. `goals/law-practice-office-action-spike/research/SOURCES.md:144-148`

## Minimal Supersession Edit To Apply Later

This section specifies edits for a later supersession pass, and the identity-as-IRI report already identifies marking `goals/ontology-modeling-foundation` as superseded as a side task before implementation starts. `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:142-143`

Edit `goals/ontology-modeling-foundation/README.md` by changing the status block from `ACTIVE - POC implementation in progress` to a retained-reference superseded block, because the current README status is active and existing repo precedent uses `Lifecycle: reference`, `Status: superseded`, and a `Superseded by` link. `goals/ontology-modeling-foundation/README.md:3-5` `goals/repo-quality-acceleration/README.md:3-10`

Use `explorations/identity-as-iri` as the superseder target in the README because identity-as-IRI explicitly replaces the dead `Ontology.create` API with `$I.ontology` and tracks this supersession audit. `explorations/identity-as-iri/README.md:12-18` `explorations/identity-as-iri/README.md:20-26`

Edit `goals/ontology-modeling-foundation/SPEC.md` by changing its status from `ACTIVE` to `SUPERSEDED / reference only` and adding a warning before the Authoring Contract that `Ontology.create(...)` is retained only as dead prior-art context. `goals/ontology-modeling-foundation/SPEC.md:3-5` `goals/ontology-modeling-foundation/SPEC.md:49-63` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`

Edit `goals/ontology-modeling-foundation/ops/manifest.json` by changing `initiative.status` from `active` to `superseded-reference`, adding `initiative.supersededBy: "explorations/identity-as-iri"`, and retaining `packetAnchorDocument: "SPEC.md"`. `goals/ontology-modeling-foundation/ops/manifest.json:3-10` `goals/repo-quality-acceleration/ops/manifest.json:3-13`

If execution metadata is tightened in the same edit, set the manifest lifecycle to `reference` and execution capability to false, because the closest superseded-reference precedent does that for a goal retained as reference material. `goals/repo-quality-acceleration/ops/manifest.json:6-13`

Do not set `explorations/identity-as-iri/ops/manifest.json` `links.supersededBy`, because that field currently belongs to the exploration's own outbound supersession state and is null while the exploration is active. `explorations/identity-as-iri/ops/manifest.json:3-23`

Touch `goals/README.md` by revising the `ontology-modeling-foundation` index line so it says the packet is superseded/reference-only and points to `explorations/identity-as-iri`. `goals/README.md:184-188`

Touch `explorations/ATLAS.md` only if the index should move from planned work to completed audit status, because it already says identity-as-IRI includes the repo audit to supersede `goals/ontology-modeling-foundation`. `explorations/ATLAS.md:133-144`

Leave `docs/BEEPGRAPH_ARCHITECTURE.md` out of the minimal supersession edit unless architecture doctrine is being updated, because its cited statement is the reusable projection doctrine rather than the dead `Ontology.create(...)` authoring API. `docs/BEEPGRAPH_ARCHITECTURE.md:111-113` `docs/BEEPGRAPH_ARCHITECTURE.md:256-260`

## Interop Roadmap Overlap

The roadmap is not in the same lifecycle state as the dead foundation goal, because its README says `Lifecycle: completed-retained` and `COMPLETE`, while its manifest sets `initiative.status` to `completed-retained`. `goals/ontology-interop-roadmap/README.md:3-8` `goals/ontology-interop-roadmap/ops/manifest.json:3-13`

The roadmap SPEC still says `ACTIVE`, so its status text should be reconciled with README and manifest if the packet is touched. `goals/ontology-interop-roadmap/SPEC.md:3-5` `goals/ontology-interop-roadmap/README.md:3-8` `goals/ontology-interop-roadmap/ops/manifest.json:3-13`

The roadmap assigns generic RDF values, vocabularies, and pure syntax utilities to `@beep/rdf`; schema-backed assembly, opt-in SKOS profile behavior, projections, Markdown docs, JSON Schema sidecars, and provenance hooks to `@beep/ontology`; and runtime validation/reasoners/services to `@beep/semantic-web`. `goals/ontology-interop-roadmap/README.md:25-31` `goals/ontology-interop-roadmap/SPEC.md:27-83` `goals/ontology-interop-roadmap/ops/manifest.json:43-64`

Those assignments overlap constructively with identity-as-IRI because the handoff keeps RDF vocab registry work and resurrected projections while replacing only the old authoring API. `goals/ontology-interop-roadmap/research/roadmap-synthesis.md:44-63` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-56`

The roadmap does contradict the handoff where it treats existing `Ontology.create(...)` authoring helpers as current surface, because the current-surface research lists `authoring helpers through Ontology.create(...)` and the handoff says that authoring API is dead. `goals/ontology-interop-roadmap/research/current-surface-gap-analysis.md:40-50` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`

The roadmap does not contradict the handoff on SKOS profile opt-in semantics, because the roadmap says SKOS should be opt-in and should not silently reinterpret every class, while the handoff keeps SKOS profiles as prior art to resurrect selectively. `goals/ontology-interop-roadmap/research/skos-profile-research.md:12-24` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`

The roadmap does not contradict the handoff on JSON Schema sidecars, Markdown docs, provenance, or projections, because the roadmap keeps JSON Schema sidecars out of RDF triples by default and the handoff keeps projections while moving authoring to composer-derived handles and folds. `goals/ontology-interop-roadmap/research/effect-json-schema-metadata.md:68-80` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:193-200`

The roadmap should get a cross-link and authoring-surface qualification, not a full supersession status flip, because its completed-retained v1 scope is SKOS/docs/schema/provenance interop and package-boundary evidence rather than the now-dead `Ontology.create(...)` goal packet itself. `goals/ontology-interop-roadmap/README.md:33-35` `goals/ontology-interop-roadmap/research/roadmap-synthesis.md:79-94` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`

Add that cross-link near the roadmap README purpose and GOAL extension note, because those are the places that currently say the roadmap follows or extends `goals/ontology-modeling-foundation`. `goals/ontology-interop-roadmap/README.md:18-24` `goals/ontology-interop-roadmap/GOAL.md:16-28`

## Sources

- `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
- `explorations/identity-as-iri/README.md`
- `explorations/identity-as-iri/CAPTURE.md`
- `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md`
- `explorations/identity-as-iri/ops/manifest.json`
- `explorations/ATLAS.md`
- `explorations/_gold-intake/ROUTING.md`
- `explorations/_gold-intake/routing/shards/shard-ip-domain-models.json`
- `explorations/_gold-intake/routing.json`
- `explorations/domain-layer-hardening/MAP.md`
- `explorations/atlas-synthesis/synthesis/04-goals-landscape.md`
- `goals/README.md`
- `goals/ontology-modeling-foundation/README.md`
- `goals/ontology-modeling-foundation/SPEC.md`
- `goals/ontology-modeling-foundation/PLAN.md`
- `goals/ontology-modeling-foundation/ops/manifest.json`
- `goals/ontology-interop-roadmap/README.md`
- `goals/ontology-interop-roadmap/SPEC.md`
- `goals/ontology-interop-roadmap/PLAN.md`
- `goals/ontology-interop-roadmap/GOAL.md`
- `goals/ontology-interop-roadmap/ops/manifest.json`
- `goals/ontology-interop-roadmap/research/current-surface-gap-analysis.md`
- `goals/ontology-interop-roadmap/research/skos-profile-research.md`
- `goals/ontology-interop-roadmap/research/roadmap-synthesis.md`
- `goals/ontology-interop-roadmap/research/effect-json-schema-metadata.md`
- `goals/law-practice-office-action-spike/research/SOURCES.md`
- `goals/repo-quality-acceleration/README.md`
- `goals/repo-quality-acceleration/ops/manifest.json`
- `goals/codex-security-findings-2026-06/README.md`
- `goals/codex-security-findings-2026-06/ops/manifest.json`
- `docs/BEEPGRAPH_ARCHITECTURE.md`
