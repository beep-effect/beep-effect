# Bake-off Criteria Rubric — DRAFT (pending adversarial review + ratification)

Status: **DRAFT** (D11: ratify after Grok 4.6 xhigh + GPT-5.6 Sol xhigh adversarial pass and
Benjamin's sign-off, before any bake-off launches). Verdict vocabulary and envelope are already
locked by DECISIONS D8/D9; this file operationalizes scoring.

## Hard gates (fail => park, regardless of score)

1. **Envelope (D9).** Must run in-process/embedded, or as a binary the Tauri app can bundle and
   spawn as a local sidecar. Server-only / docker-required => park (recoverable via Layer).
2. **License.** In-process dependencies: permissive (MIT/Apache-2.0/BSD/ISC) only. Sidecar
   binaries crossing a process boundary: copyleft tolerable case-by-case (flag for explicit
   decision). Unverifiable license => park.
3. **Maintenance floor.** Upstream shows life within ~12 months or is trivially vendorable at
   our risk appetite. Abandonware with no fork path => park.

## Scored axes (per candidate, 1-5, evidence required for 4+)

| Axis | Weight | What 5 looks like |
|------|-------:|-------------------|
| Quality / best-in-class evidence | x3 | Benchmarks, correctness track record, breadth of capability vs the family's state of the art — judged on merit, not incumbency (D7) |
| Envelope fit | x2 | Pure in-process TS/WASM; no sidecar, no native build pain in Tauri's matrix |
| Effect-native integration cost | x2 | Clean service-contract fit; typed errors expressible; no impedance mismatch (callbacks/global state/singletons) |
| Beep-concept overlap | x1 | Composes with existing bricks (ontology slice, `@beep/semantic-web`, PGlite, `effect/Graph`) rather than duplicating them — an axis, not a bye |
| Port/wrap surface | x1 | Small stable API to wrap; low maintenance tail |
| Data-model fidelity | x2 | Preserves the distinctions our schemas need (IRI vs literal w/ datatype+lang, spans, provenance hooks, temporal validity) |

Verdict per family (D8): **already-have** / **pick-one** (winner + runner-up recorded) /
**park**. Every scored claim cites a source into `SOURCES.md` section 3.

## Family sheets (candidates to seed research; not exhaustive)

### 1. Storage substrate (vector + property graph + triplet, judged together)
- Must answer first: does `@beep/semantic-web` + ontology slice already cover triplet/SPARQL
  needs (already-have)? Does `effect/Graph` cover in-memory property graph?
- Candidates: pgvector-on-PGlite (convergence prior), sqlite-vec, Oxigraph (WASM/embedded),
  quadstore-class TS stores, LevelGraph-class, in-memory + serialization.
- Cross-cutting: one substrate serving multiple access patterns beats three engines — score
  "engine count" as integration cost.

### 2. Embeddings runtime
- Candidates: transformers.js/ONNX-runtime (in-process), fastembed-style local, sidecar-spawned
  runtimes, API-backed via agents slice (envelope-legal but scores on quality + offline story).
- Data-model fidelity: dimension/model identity must live in the schema (semantica finding:
  silent random-vector fallback is the anti-pattern to make unrepresentable).

### 3. Input stack (ingest / parse / split / normalize)
- Census-first vs `@beep/file-processing`, `@beep/md`, `@beep/html`: per semantica capability,
  mark covered / gap / better-elsewhere. Candidates for gaps: unified-ecosystem parsers, pdf
  tooling, Docling-equivalents (often sidecar), chunking libraries vs schema-first native.

### 4. Reasoning engines (elevated, D10)
- Two-sided: (a) ecosystem — eyereasoner (EYE/WASM), N3.js rules, Datalog engines (TS/WASM,
  incl. souffle-wasm class), SHACL-AF, production-rule/Rete libraries; (b) Effect-native design
  space — typed proof DAGs, Rete-as-data over `effect/Graph`, bounded forward chaining as
  fibers/Streams; salvage input from `beep-effect-logos` (`grounding-v3-logos.md`, pending) and
  the ontology slice's bounded reasoning.
- This family may legitimately end **pick-one + NET-NEW hybrid** (wrap an engine for baseline,
  design the native substrate as the lab's novel contribution). The /adhd pass (D15) feeds this
  sheet before it freezes.

## Process

Each bake-off = one deep-research pass (Opus-class dynamic workflow or Codex fan-out per D17)
producing `research/bakeoff-<family>.md`: scored table, winner + runner-up, park list with
one-liners, and a `SOURCES.md` section 3 appendix. Verdicts land in DECISIONS with a dated
entry and sync to the Notion atlas `Verdict` columns (D2/D3).

---

*Provenance note (appended so the body above keeps its original line numbers). This is a
reconstruction of the rubric v1 draft that the adversarial rubric reviews cite by line; v1 was
overwritten in place by v2 before the packet's first commit. Reconstructed 2026-08-24 from the
session transcript's original write. One caveat: a same-day line edit added the v3-logos
salvage verdicts to the reasoning family sheet while the reviews ran, so a reviewer may have
read that one line in either state. Current law: [`../criteria-rubric.md`](../criteria-rubric.md)
v2.0.*
