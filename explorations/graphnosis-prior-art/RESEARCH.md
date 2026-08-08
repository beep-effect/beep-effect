# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-08-06 — Method and headline

Four sources were mined against the live checkout at `d1dfc4b3c1`: the Graphnosis repo
(`~/YeeBois/dev/Graphnosis` @ `7a19c4b`), its whitepaper and trained-skills PDF, and two adjacent
papers found in the same research session (RAPTOR, Chronocept). Both Graphnosis PDFs predate the
code we read, so paper-vs-code drift was tracked explicitly.

Pipeline: 8 territory surveyors over the repo → 8 mappers onto beep-effect (every `gap` claim
required the search command in its evidence) → adversarial challenge → ranked synthesis → two
amendment lanes. Every agent wrote its full reasoning to disk before returning; those notes are in
[`research/mining/`](./research/mining/) and are the durable record. The ranked inventory is
[`research/SYNTHESIS.md`](./research/SYNTHESIS.md); the cross-source argument is
[`research/cross-source-triangulation.md`](./research/cross-source-triangulation.md).

**Headline: 191 mappings across five sources — `partial` 109 (57%), `already-have` 41 (21%),
`gap` 32 (17%), `not-applicable` 9 (5%). beep-effect is at partial-or-better on 78%.**

Read that honestly. The value here is *not* a build list. It is corrections to systems we already
own, plus a small set of rules that cost one sentence today and a migration later. Of the 32 gaps,
roughly 20 are gaps *because the code does not exist yet* — there is no retrieval engine
(`goals/hybrid-retrieval-fusion-core` is 0/4 at `goals/INDEX.md:24`), no scored graph traversal, no
chunker, no procedure model. **That timing is the whole opportunity.** True gaps against *shipped*
beep surfaces: about 12.

### A defect in this packet's own mining, recorded so nobody over-trusts it

Seven of eight surveyors independently used the id prefix `gai-01…gai-14` regardless of territory,
so 112 findings carried only 28 distinct ids. The orchestrator's join collapsed them and the
adversarial challenge phase received **mismatched (title, finding) pairs**; several challengers said
so unprompted. Ids were re-namespaced by territory afterwards
([`research/mining/INDEX-repo.json`](./research/mining/INDEX-repo.json)), and every load-bearing
item was re-derived from the map notes.

**Only two challenge rows are safely attributable**: the PDF-join refutation (below) and the
non-vacuity re-verification (8 of 641 test files carry vacuity-guard vocabulary — a widened regex
found no hidden reservoir). Everything else from that phase must be re-run with namespaced ids
before it is cited. The lesson is not "instruct agents harder" — **the orchestrator should mint ids
and never delegate a naming convention to independent agents.**

## External Landscape

### Graphnosis — `github.com/nehloo/Graphnosis`, `@nehloo/graphnosis` v0.11.0, Apache-2.0

An in-process TypeScript library (~19.6k LOC) for "AI-native dual-graph knowledge representation":
directed typed-logic edges (`causes`, `precedes`, `supersedes`, `contains`) and undirected
association edges (`similar-to`, `shares-entity`, `co-occurs`) over one node set, persisted to a
specified binary format (`.gai`), queried deterministically, exposed via SDK, HTTP, and MCP.
Apache-2.0 with a `NOTICE` — **port-with-attribution is permitted**, not merely clean-room.

What actually distinguishes it, at mechanism level:

- **Determinism as an engineering commitment, not a slogan.** Tie-breaking is centralized in
  `src/core/query/tie-break.ts` (91 lines) and keyed on **provenance** — `{file, offset,
  contentHash}` compared *field at a time*, never a concatenated string key. The file documents
  that ordering on a surrogate id makes results "an artifact of how the candidate pool was built
  rather than anything about the query," and that this was a shipped, measured, then reverted
  defect. Three time inputs (`now` / `retiredAt` / `asOf`) are never conflated. Language ports are
  refused *because* tie-breaking, hash iteration order, and Unicode handling differ across runtimes
  — other languages get a process boundary.
- **Guarded max write in traversal** (`traverser.ts:365-369, :385-389, :402-406`): a node's score
  is `max(score, x)` over explored paths, never a sum, so in-degree confers no score by
  construction. Measured at +6.0 points in their own ablation.
- **`(node, hop)` as the search state** under a hop budget, rather than `node`.
- **An adjudication contract**: contradictions are surfaced to the owner and never auto-resolved.
  Their §14 framing — *"the adjudication contract, not determinism, is the distinguishing
  commitment"* — is sharper than anything currently written in our own triage packet.
- **A real format spec.** `SPEC.md` (29KB) gives byte layout, integrity, "what a conforming reader
  must do", a §6 *Known weaknesses*, and conformance fixtures with a runner. Rationale stated
  plainly: *"a format with one implementation and no written specification is a file layout rather
  than something anyone else can adopt."*
- **`SPEC.md` §8 is an explicitly UNIMPLEMENTED v2 proposal** governed by §8.0 "one break, once" —
  everything lands together or not at all. It contains `(id, rev)` identity, `maxAutonomy`, L1/L2/L3
  conformance levels, skill subgraphs, byte reproducibility, and a §8.6 *deliberately NOT in v2*.
  Anything matching §8 is a proposal, **not a feature**, and was marked as such during mining.
- **Documentation honesty as a norm.** The benchmark badge says `LongMemEval — re-measuring`.
  Commit subjects state what a change costs: *"the person-hash change is forward-only, and say what
  it costs"*, *"state plainly that a .gai body is not encrypted"*, *"the corruption class does not
  mean tampered with"*.

### Graphnosis whitepaper — *The Un-Brain* ([10.5281/zenodo.20843387](https://doi.org/10.5281/zenodo.20843387), 35pp, 2026-06-26)

Vendor-authored. Carries the dual-graph argument and the ablations. Two cautions recorded during
mining: the "co-equal dual graph" claim is about **query-API exposure, not contribution to reach**
— their own numbers show `medianPctOnlyUndirected = 84.8` against `medianReachDirected = 3`, a
~30:1 asymmetry. And the 8–13% overlap range is measured on LongMemEval conversational haystacks
with only the 8.4% (45k) end reproducible from committed artifacts; the 15k run's JSON is not
committed. **Do not quote their headline numbers.**

Also from the whitepaper: they ship the ablation alternative as a **typed option, never an ambient
env var**, on the argument that an env var makes scoring impure and invalidates published golden
vectors. Their own code has not fully complied — `traverser.ts:208-210` still reads
`process.env.GNOSIS_SCORE_RULE` as a fallback in v0.11.0.

### Graphnosis trained-skills ([10.5281/zenodo.21205599](https://doi.org/10.5281/zenodo.21205599), 55pp, 2026-07-05)

*"Borrowable Skills as Lean Un-Ganglia Subgraphs."* Formal in presentation — propositions,
definitions, theorems, invariants — and the highest-yield single source in the corpus (30+ discrete
findings). A skill **is** a subgraph (Definition 1); plans compile from storage **order**, not edge
traversal (Theorem 1); walks are bounded by per-**edge** lifetime caps (Theorem 2); vitality is
derived, never stored; retrain is in-place with a reversible snapshot chain; cross-skill calls stay
stable under retrain (Invariant 3); dispatch is index-only then hydrate.

The two rules that matter most to us are governance, not graph:

- **Rule 5 — a minting process cannot raise its own ceiling.** What proposes an action does not
  approve its own limits; the artifact's declared authority is clamped against the ambient ceiling
  of the context, taken from context, never from the thing being minted.
- **An authority ceiling on the artifact**, min-composed across members, with absence meaning
  *most restrictive*.

Treat the formalism with care: the mining pass **found a bug in the paper's own Lemma 1** (`ts-05`,
parameterized evidence strings). Take the data shapes; do not inherit the proofs.

### RAPTOR (arXiv:2401.18059) — one sentence of value, and that is a real result

Recursive clustering + LLM summarization into a retrieval tree. **Verdict: do not adopt.**
Structurally inadmissible here — `TextChunk.span` is mandatory and a derived, non-contiguous
summary node cannot carry a `VerifiedTextAnchor`. The repo already rejected the graph analogue once.
Build-time LLM summarization is also a recurring cost and a determinism hole, against exactly the
citation-grounding requirement that makes this product defensible. Its contribution is one Non-Goal
wording change on the fusion core.

### Chronocept (arXiv:2505.07637v1) — quarantine the quantitative, keep one borrowed taxonomy

**Reference-only: no printed license.** Its own numbers disqualify it as evidence — n=129, best
R²=0.1298, and linear regression performing worse than the mean predictor. What survives is not
Chronocept's: the **MATRES eight-axis modality taxonomy it borrows from Ning et al. 2018**, which
lands near `Contradiction.model.ts:435`, plus its ablation *design* (shuffle-vs-remove). Graded
validity, log-time, and skew-normal temporal objects are all absent from beep and should stay
absent. On character spans **beep is ahead** of Chronocept's released JSON
(`EvidenceSpan.model.ts:46`).

## In-Repo Capability Inventory

Full per-finding proof is in [`research/mining/map-*.md`](./research/mining/) (8 files) and
[`research/mining/paper-map-*.md`](./research/mining/) (4 files). Highlights, all verified by
opening the file:

**Where we are ahead of the donor.**
`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145` carries seven required
fields including `extractor{name,version}` and `normalizationVersion` — so two ingests under
different extractors are *distinguishable*, where Graphnosis has only `{file, offset, hash}`.
The contradiction substrate is materially stronger: `ContradictionCandidate` is immutable and
digest-sealed, `ContradictionDisposition` is append-only with `resolvedBy: Principal`, and
`Contradiction.model.ts:562-566` annotates the detector as *"provenance, not authority"* —
`goals/epistemic-contradiction-triage/SPEC.md` already refuses automatic supersession.
Effect-first `Config`/`Context.Service` discipline makes the donor's ambient-env-var defect
structurally impossible in domain slices (`rg "process.env"` over the five product families → 3
hits, all JSDoc prose).

**Where a brick exists but the sharp edge is missing.**
`@beep/provenance` is 778 LOC across 4 files and **never imports `Order`** — only
`S.toEquivalence` (equality) at `VerifiedTextAnchor.ts:19-20` and an `isWellOrdered` predicate at
`TextAnchor.ts:175`. There is no total order over anchored evidence.
`goals/hybrid-retrieval-fusion-core/SPEC.md:85` requires "one documented stable comparator
independent of map iteration order" and **never says on what** — an implementer will reach for the
candidate id, which is precisely the bug the donor shipped and reverted.
`packages/agents/domain/src/entities/Skill/Skill.model.ts` is a 47-line `BaseEntity` carrying
exactly `{fixtureKey, name}` — no steps, contract, trigger, or prerequisites — against 55 pages of
donor treatment.

**Live defects found in shipped code.**
`packages/drivers/wink/src/WinkCorpus.service.ts:783-784` ties on `entry.index`, the document's
position in `compiledState.documents` (pure insertion order), while `:597-598` correctly ties on
`ascendingString(term)`. **The repo gets this right where the field happened to be content and
wrong where a cheap index was to hand.**
`packages/drivers/doc-text/src/DocText.service.ts:128-131` calls `getDocumentProxy` itself and
hands the proxy to `extractText`, so unpdf's `finally { if (pdf !== data) … destroy() }` branch is
skipped by design — **the driver leaks a pdfjs `WorkerTransport` per extraction on the success
path**, and the extraction path has no wall-time bound at all (byte cap only, at `:108-117`).
`packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:167-182` is the single choke point
for all seven law scanners (3,714 LOC) and **nothing asserts `scannedFiles` is non-zero**.
`EdgeVersion` bitemporal invariants live only in SQL — the table header says so verbatim:
*"This projection publishes the columns; the migration publishes the invariants."*

## Constraints Discovered

- **License is permissive but the corpus is mixed.** Graphnosis is Apache-2.0 with a `NOTICE`
  (port-with-attribution). Chronocept prints no license (**reference-only**). Dispositions per
  source are in [`research/SOURCES.md`](./research/SOURCES.md).
- **Vendor-authored papers are not evidence.** Both Graphnosis PDFs are published by the library's
  own vendor, and the repo's own benchmark badge says `re-measuring`. No number from them belongs
  in a SPEC.
- **`SPEC.md` §8 is unimplemented.** Any design that leans on `maxAutonomy`, `(id, rev)`, or
  conformance levels is leaning on a proposal.
- **A ceiling in an unencrypted body is advisory, not enforced.** The donor's own commit log states
  a `.gai` body is not encrypted. An artifact-carried authority ceiling defends against *accident
  and drift*, not an adversary — real for our case (a skill authored for a low-stakes context
  reused on a filing path), but the threat model must be stated rather than inherited silently.
- **We own no binary container**, so the whole `gai-format` territory is analogy onto versioned
  JSON envelopes (`rg 'timingSafeEqual|createHmac|hmac'` → zero hits). Reasoning is good; evidence
  is weaker there.
- **Ownership boundaries between packets are real.** `@beep/provenance` is
  `citation-verified-span-substrate`'s declared surface (`SPEC.md:44-46`), which the fusion core
  lists as "reuse/proof surface, not new storage" (`SPEC.md:63-64`). A comparator added by a
  fusion-core implementer writes into another active packet's territory — hence the amendment split
  across consumer, package, and owner.

## Amendments NOT to make

Recorded so nobody re-proposes them. Full rejection tables with reasons:
[`research/amendments-shipped-code.md`](./research/amendments-shipped-code.md) and
[`research/amendments-open-goals.md`](./research/amendments-open-goals.md).

- **Do NOT port Graphnosis `joinPdfItems` into `@beep/doc-text`.** Mapped at value 5
  "verbatim-portable"; it is a **net regression**. The proof was a layer-attribution error — it read
  unpdf's outer `.map(item => item.str + …).join("")` wrapper and concluded position-relative
  spacing was absent. Verified two levels deeper:
  `grep -o "trackingSpaceMin…" node_modules/unpdf/dist/pdfjs.mjs` shows `trackingSpaceMin=a*.102`
  and the `shouldAddWhitepsace()` path — the synthesis is live inside pdfjs's `getTextContent()`.
  Adopting it replaces a working path *and* forces a `DOC_TEXT_ENGINE_VERSION` bump that fails
  `verifyTextAnchor` with `stale-source` on every already-anchored document.
- **Do NOT add confidence reinforced by access, or age-based decay.** Disqualifying for a legal
  product: two identical office actions must not rank differently because one was opened more
  often. The donor's own decay was keyed on a field nothing refreshed.
- **Do NOT widen `WinkSimilarity`'s `UnitInterval` clamp to `[-1,1]`.** Inputs are tf-idf/BM25
  vectors, so cosine is never negative on any current path; the negative branch is unreachable and
  already instrumented.
- **Do NOT build RAPTOR summary nodes.** Structurally inadmissible — a derived non-contiguous node
  cannot carry a `VerifiedTextAnchor`.
- **Do NOT amend detection heuristics into `goals/epistemic-contradiction-triage`.** Its own
  `SPEC.md:138-139` makes that a stop-and-re-scope condition and `SPEC.md:23-26` an explicit
  Non-Goal. Detection graduates separately.
- **Do NOT quote Chronocept's quantitative results, or Graphnosis's LongMemEval numbers.**

## 2026-08-06 addendum — a second mining defect (LawScan blast radius), caught at shape

The shape-stage verification pass (run against main @ `4aa421d9d3`) found a second error in this
packet's own mining, alongside the id-collision recorded above: the claim that
`LawScan.ts` is "the single choke point every repo law goes through (7 scanners, 3,714 lines)"
**was wrong at mining time**, not stale. Ground truth: `runLawScan` is called by exactly two
scanners (`EffectFn.ts:396`, `FrozenGrantSet.ts:331`). `EffectImports` and `TerseEffect` filter
`project.getSourceFiles()` directly, `NoNativeRuntime` runs its own accumulation loop, and two of
the named seven are not source scanners at all — `AllowlistCheck` validates the allowlist file
and `SchemaDiagnostics` is diagnostic formatting helpers.

What survives: the non-vacuity gap itself is real and verified — `LawScan.ts:175` computes
`scannedFiles` and returns it unguarded, and nothing in the repo asserts it is non-zero
(`Laws.command.ts` only logs it). What changes: the fix is one assertion per scan path (four
paths), not one edit; the repo-law bundle's appetite moved from small to medium accordingly, and
`BRIEF.md` carries the corrected scope. Lesson, same family as the id-collision: a miner's claim
about *routing topology* ("everything goes through X") needs the same proof discipline as a gap
claim — the challenge phase that would have caught it was the one the id-collision disabled.
