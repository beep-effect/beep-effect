# Brief

<!--
Stage 3. Fat-marker fidelity.
-->

## Problem

Research arrives in hodgepodge piles: Grok nightly reports, VidBee video
bundles, DM archives, bare link lists, Box folders. The October packet proved
the intake discipline (immutable originals, hashes, dispositions, routed
findings) and left maintained CLI, but three things still cost more than they
should:

1. **Web sources have no route.** The library can acquire GitHub, arXiv PDFs
   and YouTube captions; everything else is "scrape in a session and import a
   manifest". At 835 URLs per aggregation that is the whole job.
2. **Relevance is prose.** "Mine for alpha relevant to beep-effect" ends as a
   reading note. The catalog knows sources, versions, captures and findings,
   but its vocabulary is implicit (`LiteralKit`s inside anonymous structs) and
   nothing links a finding to the packet it matters for except Markdown.
3. **Citation chains stop at hop 0.** Nightlies cite papers that cite papers;
   link lists are hop-0 shells around hop-1 content. October followed links
   only to close a named gap.

Why now: the Nov-5 pile (332 files, 835 URLs, 38 videos) plus Box (34
nightlies, 449 PDFs) is sitting unmined, and the repo now has the bricks the
October run lacked: `@beep/ontology` fold and Turtle projection,
`@beep/rdf` PROV/CiTO/FaBiO/SKOS vocabularies, `@beep/shacl`,
`@beep/oxigraph`, `@beep/box`, VidBee and alphaXiv MCP servers.

## Appetite

Two weeks of lane time, three goal packets, at most three concurrently open
PRs. Deep-read volume bounded to the Nov-5 corpus at hop 0 and hop 1 plus
gated hop 2; the 449-PDF Box pile gets T1 triage only. No new paid endpoint;
Firecrawl runs on the existing key, mining on existing pools (Junie first).

## Solution sketch

**Ontology as schema of record.** `Library.schemas.ts` becomes named
`S.Class` models carrying `$I.annoteSchema` ontology annotations:

- `Source` (identity, `prov:Entity`, typed by FaBiO/schema.org kind),
  `SourceVersion` (requested revision), `Capture` (`prov:Entity` produced by
  an acquisition `prov:Activity` under a route `prov:Plan`), `Artifact`
  (immutable bytes, hash), `Occurrence` (a citation site in a document,
  anchored with `@beep/rdf` evidence selectors), `Finding` (CiTO-typed edge
  from a reading to a source span), `Disposition` (a phase of a capture, not
  a class), `Derivation` (`prov:wasDerivedFrom` with `hopDepth`),
  `ModelRun` (`prov:SoftwareAgent` = model id + effort, the manifest pin).
- Topic scheme: SKOS concepts for every `goals/<slug>` and
  `explorations/<slug>`; a finding is relevant when it has `skos:related` to
  a live packet concept.
- `research library ontology render` folds the models through
  `@beep/ontology` into `ontology/research-library.ttl` and
  `ontology/research-library.shacl.ttl` in the library root;
  `research library verify` validates the catalog projection with
  `@beep/shacl`; views (`index.md`, `ROUTING.md`, per-hop coverage) are
  SPARQL queries over `@beep/oxigraph`, no longer hand-maintained
  projections.

**Routes.** `drivers/firecrawl` (web/docs/registry), a Box adapter on
`@beep/box` (receipt per file), VidBee and alphaXiv `import-result` methods.
X stays `research.web` Grok with honest `incomplete` dispositions.

**Hops.** Inventory extracts hop-1 identities from every hop-0 document;
acquisition runs hop 1 in full; T1 triage and T2 reads produce routed
findings; the hop-2 gate admits children of routed sources under per-domain
caps; arXiv hop 2 is catalogued from alphaXiv reference lists. Every hop has
its own denominator in `COVERAGE.md`.

**Mining.** T1 luna triage → T2 Junie/Opus deep reads producing CiTO-typed
findings with spans → T3 orchestrator synthesis; `/deep-research` per gap
cluster, sequential; `/adhd` for competency questions and the graduation
portfolio.

**Flow (fat marker).**

```
Box ─┐                     ┌─ firecrawl ─┐
Nov-5 dir ─┤ inventory(hop0) ├─ github ─────┤ acquire ─ verify ─ T1 ─ T2 ─ route
VidBee md ─┘   │              ├─ alphaXiv ──┤    │                      │
               └─ hop1 ids    └─ vidbee ────┘    └─ hop2 gate ◄─────────┘
                                                      │
                               ontology render → ttl/shacl → oxigraph → views
```

## Rabbit holes

- **Validator migration vs selected-source acquisition.** October demoted 68
  valid captures by mixing them. The ontology rewrite changes the catalog
  schema; land it as an explicit versioned migration with real-corpus replay
  before any new acquisition.
- **Phase vs kind.** `readable`/`incomplete`/`tool-blocked` are capture
  phases; `hopDepth` is an edge attribute. The foundational-auditor pass must
  run before the T-Box is emitted or these become classes.
- **GitHub transitivity.** 408 GitHub URLs at hop 1; READMEs link out.
  Never transitive; cited object only.
- **X bodies.** Grok proves execution, not content. Do not chase.
- **Firecrawl envelope drift.** The validator expects
  `{"data": {"markdown", "rawHtml", "metadata": {"sourceURL", "statusCode"}}}`;
  the driver must produce exactly that, byte-bound, or the October captures
  and new ones diverge.
- **Private archive leakage.** `Research-11-5-26/` must stay out of `render`
  output by default and out of every repo PR; the partition is a schema field,
  not a convention.
- **`beep-cli-composition` motion.** The Research group will move to a command
  tool later; keep the facade curated so the move is a path change.

## No-gos

- No new ontology authored in Turtle or LinkML by hand; no Python ontology
  toolchain in the repo.
- No storage switch: Postgres/PGlite and the file library remain truth;
  oxigraph is a query projection.
- No full hop-2 crawl, no transitive GitHub acquisition, no archiving video
  files into `objects/`.
- No promotion of the library model into `packages/epistemic` in this
  packet.
- No implementation of findings routed to other packets; routing is the
  deliverable.
- No new paid endpoints, credits or quota top-ups.
