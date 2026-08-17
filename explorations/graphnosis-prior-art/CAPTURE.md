# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-06

### The ask (verbatim)

> Just discovered an opensource project called [Graphnosis](https://graphnosis.com/getting-started/overview/).
> I cloned the repo here (machine-local clone) I would like you to do some exploration of it
> and this repo to see if there is any valuable:
>
> - information
> - patterns
> - strategies
> - ideas
> - code
> - design
>
> or anything else valuable to beep-effect. I would like this to be a part of an exploration packet
> if the initial read & exploration of the Graphnosis repo contains enough value.

### First-pass reconnaissance (before any deep read)

Machine-local clone outside this repo, remote `git@github.com:nehloo/Graphnosis.git`,
HEAD `7a19c4b`. Published as `@nehloo/graphnosis` v0.11.0.

- **License: Apache-2.0** (`LICENSE`, `NOTICE` — Copyright 2026 Nehloo Interactive LLC).
  Permissive ⇒ port-with-attribution is on the table, not just clean-room.
  A `CLA.md` exists for inbound contributions; irrelevant to us consuming it.
- Single package, not a monorepo. ~19.6k LOC across 126 `.ts` + 11 `.tsx`.
  Next.js app (`src/app/`), CLI (`src/cli/`), MCP server (`src/mcp/`), SDK (`src/sdk/`),
  engine (`src/core/`), plus `spec/`, `tests/`, `benchmarks/`, `enterprise/`.
- Self-description: *"AI-native dual-graph knowledge representation — build, query, and persist
  typed knowledge graphs in-process."* Positioning line in README: *"Memory for AI harnesses that
  recalls a multi-graph, not a .md file or RAG chunks and a shrug."*

### What jumped out on the headings pass (unverified, this is the raw dump)

- **The dual graph.** Directed edges = typed logic that points somewhere (`causes`, `precedes`,
  `supersedes`, `contains`). Undirected = association (`similar-to`, `shares-entity`,
  `co-occurs`). Same nodes, both layers walked together. They claim this is the whole idea.
- **`.gai` is a specified binary format, not a file layout.** `SPEC.md` is 29KB: byte layout,
  big-endian header, MessagePack body, checksum, optional HMAC signing, "what a conforming reader
  must do", a *Known weaknesses* section, and conformance fixtures with a runner
  (`spec/conformance.mjs`, `spec/make-fixtures.ts`). Stated reason: *"a format with one
  implementation and no written specification is a file layout rather than something anyone else
  can adopt."*
- **`.gai` v2 is a proposal, explicitly unimplemented** (`SPEC.md` §8). Governing constraint is
  §8.0 **"one break, once"** — everything lands together or not at all. Contains: `(id, rev)` node
  identity so two revisions coexist and a merge has somewhere to put a conflict; **`maxAutonomy` —
  an authority ceiling that travels *inside the memory file*** so a skill keeps its constraints
  when it moves between applications; **L1/L2/L3 conformance levels** declared per layer; skill
  subgraphs stated normatively; byte-level reproducibility; and a §8.6 *deliberately NOT in v2*.
- **Determinism as doctrine, with teeth.** `asOf` = one caller-supplied instant for a whole query.
  There is a dedicated `src/core/query/tie-break.ts`. And they refuse to accept ports to other
  languages *because* tie-breaking, hash iteration order, and Unicode handling differ between
  runtimes — other languages get a process boundary, not a rewrite. Cold ingest with LLM summaries
  is called out as the non-deterministic part unless summaries are pinned.
- **Epistemic semantics that read like our `epistemic` family.** Contradictions *reported, not
  silently merged*. `edit` supersedes rather than overwrites — the prior version stays readable.
  `setConfidence` is explicitly **not** the same operation as changing content or retiring.
  `previewForgetTopic` before `forgetByTopic`. Soft-delete + `retired`. `reflect()` surfaces
  contradictions, decayed nodes, surprising connections.
- **Failure classification as API.** Stable error codes *and classes* — `GraphnosisError`,
  `isCorruption`, `isVersionSkew`, `isCallerError` — so a consumer branches on class instead of
  matching message text. README: *"When a load fails, you can tell why without reading the
  message."*
- **MCP tool surface organized twice over.** `GRAPHNOSIS.md` (16KB, addressed to AI assistants)
  groups ~40 tools by **intent** (core memory 8, engram discovery 5, structured recall 4, source
  ops 3, engram ops 2, skills/SOPs 12, brain maintenance 5) *and* by **determinism tier**
  (deterministic / approximate 2 / conditional 1 / non-deterministic 6 requiring a local Ollama).
  Opens with "the two non-negotiable habits". Layered memory `.gai` / `.gnn` / `.gll`.
- **`ROADMAP.md` is a triage instrument**, not a wishlist: explicit in-scope list, explicit out of
  scope, and *"the default answer for borderline cases is build it as a separate package"*.
- **Honesty norms in the docs and the git log.** The benchmark badge literally says
  `LongMemEval — re-measuring`. Recent commit subjects: *"docs: state plainly that a .gai body is
  not encrypted"*, *"docs(changelog): the person-hash change is forward-only, and say what it
  costs"*, *"docs(changelog): the corruption class does not mean tampered with"*.
- Paper: DOI `10.5281/zenodo.20843387` ("The Un-Brain"). `REFERENCES.md` present.
  `enterprise/enterprise.md` is 33KB. `original-discussion.md` is 19KB of design rationale.
- Vendors `3d-force-graph` (MIT) into the demo viewer so `npx … demo` works with **no network**,
  and documents that vendoring in `NOTICE`. There is a 3D graph viewer + `src/app/graph`.

### Why this is worth a packet (the overlap surface)

Live beep-effect territory this collides with, on names alone — to be verified in research:
`packages/epistemic/*`, `packages/ontology/*`, `packages/documents/*`, `packages/agents/*`, and
the packets `epistemic-belief-view-revision`, `epistemic-contradiction-triage` (goal),
`epistemic-bitemporal-edge-core` (goal), `epistemic-claim-lifecycle-gate` (goal),
`agent-memory-tiers-bitemporal-edges`, `rag-retrieval-projection`, `graph-3d-navigation`,
`citation-grounding-hallucination-guard`, `legal-patent-kg-deepening`, `knowledge-workspace`,
`project-intelligence`, `agent-execution-authority` (goal), `agent-governance-control-plane`,
`model-artifact-admission`, `deterministic-doc-structure-extraction`.

The `maxAutonomy`-travels-with-the-artifact idea and the determinism-tiered tool taxonomy are the
two that look least like anything we already have.

### Added by Benjamin, same day — two Graphnosis PDFs

Dropped in from the machine-local `RESEARCH_08_06_26` download batch, copied into this packet's `assets/`:

- [`assets/graphnosis-whitepaper.pdf`](./assets/graphnosis-whitepaper.pdf) — 35 pages, PDF
  CreationDate 2026-06-26. Presumed to be (or sibling to) the "Un-Brain" paper the README cites
  as DOI `10.5281/zenodo.20843387`.
- [`assets/graphnosis-trained-skills.pdf`](./assets/graphnosis-trained-skills.pdf) — 55 pages, PDF
  CreationDate 2026-07-05. Presumed the fuller treatment behind `SPEC.md` §8.4 "skill subgraphs",
  §8.2 `maxAutonomy`, and the 12 "Skills / SOPs" MCP tools listed in `GRAPHNOSIS.md`.

Both predate the repo state we read (`@nehloo/graphnosis` v0.11.0, HEAD `7a19c4b`), so paper-vs-code
drift is expected and is itself a finding — a mechanism described in a paper may be shipped,
proposal-only (`SPEC.md` §8), or absent.

Two other PDFs were sitting in the same download folder. Benjamin folded them in — *"i found them
through the same research"* — so they belong to this packet's provenance, not a separate one.
Copied with cleaned filenames (the RAPTOR original had a newline in its name):

- [`assets/raptor-tree-organized-retrieval.pdf`](./assets/raptor-tree-organized-retrieval.pdf) —
  23 pages, PDF CreationDate 2024-01-31. "RAPTOR: Recursive Abstractive Processing for
  Tree-Organized Retrieval". Hierarchical retrieval: recursively cluster + summarize chunks into a
  tree, retrieve across levels instead of over a flat chunk index. A direct alternative *and*
  possible complement to both flat vector RAG and graph walk — lands on
  `goals/hybrid-retrieval-fusion-core` and `explorations/rag-retrieval-projection`.
- [`assets/chronocept-sense-of-time.pdf`](./assets/chronocept-sense-of-time.pdf) — 20 pages.
  "Chronocept: Instilling a Sense of Time in Machines", Krish Goel, Sanskar Pandey, KS Mahadevan,
  Harsh Kumar, Vishesh Khadaria. Temporal representation — the open question for us is whether its
  temporal object captures anything our two-axis valid-time/transaction-time model does not.
  Lands on `goals/epistemic-bitemporal-edge-core`. *"Orthogonal, low value here"* is an acceptable
  verdict and the mining pass was told so explicitly.

Exact citations for both are transcribed from the PDFs themselves during mining, not recalled —
`research/SOURCES.md` takes the transcribed form.

### Method note

Mining was run as a workflow: 8 territory surveyors over the Graphnosis repo → 8 mappers onto the
live beep-effect checkout (every `gap` claim required a search command in evidence) → 3-lens
adversarial challenge on the ranked shortlist (does beep already have it / is the Graphnosis claim
real / is it worth our time) → completeness critic → synthesis. Raw per-territory notes were
written to disk before summarization. Findings land in `RESEARCH.md`; provenance in
`research/SOURCES.md`.

A second workflow mined the two PDFs on the same shape (read in full → map onto beep-effect with
proof → reconcile paper claims against the shipped code, marking each mechanism SHIPPED /
PROPOSED-ONLY / ABSENT).

Benjamin also asked, mid-run, that the packet produce **two kinds of recommendation**: new goal
packets via the standard graduation contract, *and* amendments to what is already built or already
planned — SPEC/PLAN deltas against open goals, and change proposals against merged code — wherever
a finding improves it.

## 2026-08-06 — assets swapped for a link manifest

Benjamin: *"Maybe just replace those assets with a .md & link to the URL's for the studies & white
papers."* He supplied the arXiv URLs for RAPTOR (2401.18059) and Chronocept (2505.07637); the
Graphnosis paper URLs he could not find turned out to be Zenodo DOIs cited in the Graphnosis repo
README (`10.5281/zenodo.20843387` The Un-Brain, `10.5281/zenodo.21205599` Borrowable Skills). All
four PDFs (7.9 MB) deleted; [`assets/README.md`](./assets/README.md) now carries the canonical
URLs, licenses (all four CC BY 4.0), and SHA-256 of the mined copies. The `assets/*.pdf` links in
the earlier capture entries above are historical — the checksums identify what they pointed at.
