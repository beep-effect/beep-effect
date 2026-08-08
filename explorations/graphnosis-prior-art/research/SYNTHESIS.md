# Graphnosis + whitepaper + trained-skills + RAPTOR + Chronocept → beep-effect

**Ranked value inventory for `explorations/graphnosis-prior-art`.**
Sources: Graphnosis `~/YeeBois/dev/Graphnosis` @ `7a19c4b` (Apache-2.0, v0.11.0, ~19.6k LOC TS),
its whitepaper and trained-skills PDF, RAPTOR (arXiv:2401.18059), Chronocept (arXiv:2505.07637v1).
Target: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean).
Evidence: `INDEX-repo.json` (115 repo mappings), `map-*.md` (8 territory notes with beep-side proof),
`paper-map-*.md` (4), `papers-relate.md` (cross-source triangulation).

---

## 1. Verdict

**Yes — the packet is justified, and it should graduate as a set of pre-commitments, not a build
plan.**

191 total mappings across the five sources. Distribution:

| Status | Count | Share |
|---|---|---|
| `partial` (refinement to something beep already has) | 109 | 57% |
| `already-have` (parity or ahead) | 41 | 21% |
| `gap` (nothing here) | 32 | 17% |
| `not-applicable` | 9 | 5% |

Read that table honestly: **beep-effect is at partial-or-better on 78% of everything four
independent artifacts do.** That is the headline, and it is a good one. It also means the mining's
value is *not* "here are things to build" — it is "here are corrections to systems you already own,
plus a small set of rules that cost one sentence today and a redesign later."

Of the 32 gaps, roughly 20 are gaps *because the code does not exist yet* — beep has no retrieval
engine (`rg -i '\brrf\b|reciprocalRank|fuseRanked' packages/**/src/**` → nothing;
`goals/hybrid-retrieval-fusion-core` is 0/4 at `goals/INDEX.md:24`), no scored graph traversal, no
document chunker, no procedure model (`packages/agents/domain/src/entities/Skill/Skill.model.ts` is
47 lines carrying exactly `{fixtureKey, name}`). That timing is the whole opportunity: a rule
written into an unstarted SPEC is free; the same rule discovered after a ranked channel has
published evidence is a migration.

**True gaps against shipped beep surfaces: about 12.** They are ts-03/04/08 (Skill entity),
ts-23 (content sensitivity), ts-13, cc-04 (modality axis), wp-08 (contradiction detector),
`graph-model:gai-03` (re-ingest resurrection), `craft:gcr-07` (required-field break class),
`craft:gcr-08` (bundle confidentiality disclaimer), `ingestion:gai-12` (human-auditable KG surface),
`gai-format:gai-ap-invariant-door` (EdgeVersion invariants live only in SQL).

### The single most valuable thing across all four sources

**Name the tie-break comparator on provenance** — `goals/hybrid-retrieval-fusion-core/SPEC.md:85`
requires "one documented stable comparator independent of map iteration order" and **never says on
what**.

Why this one, over ~190 competitors:

1. It is a **shipped, measured, then fixed defect** in the donor — Graphnosis's
   `tie-break.ts:6-11` documents that ordering on a surrogate id makes results "an artifact of how
   the candidate pool was built rather than anything about the query," and that two successive
   integration fixtures each passed 20/20 against a surgically reverted comparator.
2. beep already owns a **better brick than the donor's**:
   `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145` carries seven
   required fields including `extractor{name,version}` and `normalizationVersion`, so two ingests
   under different extractors are *distinguishable* rather than silently equal. Graphnosis has
   `{file, offset, hash}`.
3. The bug class is **live today**: `packages/drivers/wink/src/WinkCorpus.service.ts:780-786` ties
   on `ascendingNumber((entry) => entry.index)` — the document's position in
   `compiledState.documents`. Contrast `:596-599` (`getStats`), which correctly ties on
   `ascendingString(term)`. The repo gets it right where the field happened to be content and wrong
   where a cheap index was to hand.
4. The fix is **one `Order.Order` plus one SPEC line** on a packet at 0/4 phases.

Runners-up, both effort S and both a repo law rather than a mechanism: **ts-20** (a process minting
an artifact cannot set that artifact's own authority ceiling — beep discovered this twice in the
epistemic slice with excellent written rationale and never generalized it) and **ts-09** (declared
loop caps and recorded stop reasons on agent loops that today have neither).

### Challenge-phase caveat, applied throughout

The adversarial pass was corrupted by an id-collision bug (seven surveyors independently used
`gai-01..gai-14`, so challengers were handed mismatched (title, finding) pairs). I have re-derived
every load-bearing item from the map notes and treat challenge verdicts as **signal about the named
mechanism only**. Where a challenge changed my call, it is stated inline. The one verdict I adopt
wholesale is the PDF-join refutation (§6) — it is an unambiguous layer-attribution correction.

---

## 2. Tier 1 — take this

Ranked. Each item: mechanism → donor citation → beep landing site with proof → first move.

### T1-1. Provenance-keyed total order for ranked ties · value 5 · effort M

**Mechanism.** One module centralizes all score-tie ordering. Resolve each candidate to
`{file, offset, contentHash}`; compare those three **field at a time**, never a concatenated string
key (no separator provably cannot occur in a file path, and a wrong separator silently makes two
different nodes compare equal). An unresolvable key returns 0 — arbitrary-but-stable beats random.

**Donor.** Graphnosis `src/core/query/tie-break.ts` (91 lines), `traverser.ts` consumers;
`survey-retrieval.md` §1, `map-retrieval.md` §1.

**beep landing site + proof.**
- Have, and better: `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145`
  (7 required fields), `TextAnchor.ts:155` (`startChar`/`endChar`/`quote` with `isWellOrdered`,
  `isInternallyConsistent`, `TextAnchorWidthCheck`, `isUtf16Boundary`).
- Have the idiom: `Order.mapInput` field-at-a-time comparators at
  `packages/tooling/tool/docgen/src/ProofManifest.ts`,
  `packages/law-practice/server/src/PracticeKg.projections.ts:444-448`,
  `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:190-192`.
- Missing: `grep -rn "Order" packages/foundation/modeling/provenance/src/*.ts` → only
  `isWellOrdered`, a predicate. No `Order.Order<SourceTextIdentity>`, no `Order.Order<TextAnchor>`.
  Independently re-verified by the challenge pass ("@beep/provenance, 778 LOC, 4 files, never
  imports Order; only `S.toEquivalence` at `VerifiedTextAnchor.ts:19-20` — equality, not ordering").
- Live bug instance: `packages/drivers/wink/src/WinkCorpus.service.ts:780-786`.
- Live concatenation hazard (currently safe — NUL cannot occur in an IRI, but it is a real
  concatenated ordering key): `packages/law-practice/server/src/PracticeKg.projections.ts:200`
  used as sort key at `:444`.

**First move.** Define `Order.Order<{identity: SourceTextIdentity, anchor: TextAnchor}>` in
`@beep/provenance`, field-at-a-time over `(locator, startChar, textDigest)`. Make
`goals/hybrid-retrieval-fusion-core` SPEC-5 name it, and add it to the acceptance matrix. Retrofit
`WinkCorpus.query` off `entry.index` with a non-vacuity assertion that the two orders genuinely
differ on the fixture. **Challenge caveat:** a `worth` challenger downgraded this to val=2, but that
row's provenance is broken by the id bug and its own note says so; the `exists` challenge confirmed
the mechanism gap. I hold value 5.

---

### T1-2. Rule 5 — a minting process cannot raise its own ceiling · value 5 · effort S

**Mechanism.** What proposes an action does not approve its own limits. A process writing an
artifact clamps that artifact's declared authority against the ambient ceiling of the context it
runs in, taken from context — never from the thing being minted.

**Donor.** Trained-skills paper SPEC §8.2 rule 5; note that the paper's own fallback chain is
*weaker* (an unannotated skill falls to an engram default then a global default, so one permissive
global setting silently raises every un-annotated skill). Take the SPEC's semantics, not the
implementation.

**beep landing site + proof.** The principle is already enforced twice, both times better than the
donor, and never generalized:
- `packages/epistemic/config/src/Audience.ts` — `resolveSinkAudience` derives audience from the
  destination and takes the stricter branch on unparseable input, with the rationale inline:
  *"a prompt-injected agent that could name its own audience could name the friendlier one."*
- `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:14-18` — *"Grants derive only
  from session-static inputs (config, policy revision, caller identity), never from tool output.
  That is what makes the freeze sound: the allowed-destination set provably predates any untrusted
  content that tries to change it."*
- Missing as a general law: `rg -n 'self-authored|ambient ceiling|clamp' packages/**/src/**` →
  nothing generalizing it. `AGENTS.md` has no such rule.

**First move.** One paragraph in `AGENTS.md` / `standards/`, plus one `clampAgainstAmbientCeiling`
helper. It covers every self-authored config an agent writes: skills, goal manifests, packet
lifecycle flips, settings. Effort is S precisely because the enforcement pattern exists twice and
only needs naming.

---

### T1-3. Bounded execution: declared loop caps, recorded stop reasons, cap-reached as a normal outcome · value 5 · effort S

**Mechanism.** Per-loop lifetime budgets. Reaching the cap is a **normal, reported outcome**, not an
error — each run reports its per-loop iterations, cap source, and stop reason. Contrast LangGraph's
global `GRAPH_RECURSION_LIMIT` (25 supersteps) which raises `GraphRecursionError` and loses the
partial result.

**Donor.** Trained-skills §5 p15 + §12; `agent-surface:gai-10` (an artifact you can borrow and
execute must carry its own termination bound, because the borrower cannot infer one).

**beep landing site + proof.** Live exposure, right now:
- `.claude/skills/quality-review-fix-loop/SKILL.md:28` — `loop_budget: 3` as **prose**, no schema,
  no accounting.
- `.claude/skills/browser-qa-loop/SKILL.md:76` — "Exit when a round reports `requiredCount: 0` AND
  capture is green." **No cap at all**; `SKILL.md:18` records a real 6-round run.
- `rg -n 'loopCap|maxIterations|maxRounds|recursionDepth|depthLimit' packages/**/src/**/*.ts` → one
  hit, a Next.js config field (`packages/tooling/policy-pack/repo-configs/src/next/models/ExperimentalConfig.schema.ts:198`).
- `rg -rn "maxIterations|loop bound|unbounded loop|termination bound" packages/` → nothing.
- Borrowed executable procedures already ship with no bound: `skills-lock.json` at repo root,
  governed by `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts` (skills-lock/v2 —
  pinned revisions, per-file digests, provenance confidence, SPDX bytes) — exhaustive provenance,
  **zero authority**.

**First move.** Three small things: (1) a declared per-loop cap in skill frontmatter or a loop
manifest; (2) a stop reason recorded on exit — `converged | cap-reached | escalated`; (3) treat
cap-reached as a terminal outcome that reports. Land in `goals/knowledge-surface-automation`.

---

### T1-4. Skills instructed but not *walked* regress to the no-skills baseline · value 5 · effort M

**Mechanism.** The paper's own counterexample: a firefight in which skills were instructed but not
executed at the orchestrating level regressed to the no-skills baseline — multiple rework loops, a
net-negative verdict in the author's own retrospective.

**Donor.** Trained-skills §8. **Carry the caveat**: the paper explicitly excludes this case from its
empirical claims ("reconstructed after the fact from commit history and session transcripts rather
than from instrumented telemetry… a guiding anecdote, not measured evidence"). Treat as a hypothesis
to test.

**beep landing site + proof.** beep is in exactly the reported state:
- `ls .claude/skills/ | wc -l` → 30 skills, invoked through the Skill tool, with four skill-routing
  rules in `AGENTS.md` "Tool Routing".
- `goals/skillopt-training-pilot` (7/7 complete) scored a skill's effect on a produced **diff**
  (`BRIEF.md` B2: "beep lint schema-first + tsgo Effect diagnostics + biome over the rollout's diff
  into a scalar in [0,1]") — never whether the invoked skill's *steps* were followed.
- `goals/harness-hygiene-mechanical` (4/4) deleted four zero-signal skills **by hand**.
- `goals/coding-agent-effectiveness-evidence-loop` is 0/9 and chartered for exactly this
  (`goals/INDEX.md:17`).

**First move.** A per-invocation adherence check on the skills whose steps are mechanically
checkable (`yeet`, `browser-qa-loop`) before attempting anything general. This is the only finding
in the corpus that says "the thing you have built a lot of may be producing no signal, and you have
no instrument that would tell you."

---

### T1-5. Retirement reason decides whether re-ingest may resurrect content · value 5 · effort M

**Mechanism.** `delete` is restorable; `supersede` is not. Four lines: live blocks (ordinary dedup),
supersede-tombs block re-admission, delete-tombs do not, expired-but-not-retired blocks. Encode
intent as a first-class typed reason; **never infer it from a ranking weight** (Graphnosis's prior
test keyed on a confidence threshold and failed in *both* directions).

**Donor.** `graph-model:gai-03` + `epistemics:gai-02` — two independent surveyors, both value 5.

**beep landing site + proof.**
- Vocabulary already exists and is already typed:
  `packages/epistemic/domain/src/values/ClaimDispositionStatus/ClaimDispositionStatus.model.ts:12`
  → `["active","rejected","superseded"]`, append-only because *"a disposition exists to remember a
  decision: editing one would erase the very thing it was written down for"*
  (`ClaimDisposition.repo.ts:3-7`).
- **Nothing reads it on the way in.** `packages/law-practice/server/src/PracticeKg.claims.ts:311-350`
  derives `artifact:${digestHex}` / `claim:${digest}` / `evidence:${digest}` from file bytes and
  persists, never consulting prior dispositions.
  `VaultSyncEngine.service.ts:738-792` re-syncs on a same-path digest change with no epistemic
  consult. `rg -c "reingest|re-ingest|blocksReingest" packages -g '*.ts'` → nothing.
- The failure is available **today**: attorney rejects an extracted claim → corpus refresh re-reads
  the unchanged office action → the rejected claim returns as a fresh candidate.
- Owner exists and is asking the question: `explorations/epistemic-belief-view-revision`
  `ops/manifest.json` align Q3, "retention classes."

**First move.** `blocksReadmission(disposition)` as a named predicate in the belief-view selection
policy, with the four-line table above written into the packet's DECISIONS before any chunked
ingest ships.

---

### T1-6. Enumerate every content *exit* and gate them on one liveness predicate · value 5 · effort M

**Mechanism.** Ranking is not gating. Every path by which stored content leaves the system routes
through one predicate, or is explicitly out of scope with a stated reason.

**Donor.** `ingestion:gai-04`.

**beep landing site + proof.** beep has the *hard* half already, and it is excellent:
`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:30-57` —
`retiredDispositionIds` is *"deliberately computed over the WHOLE recorded set, never over a subset
already filtered to one event… filtering first would… leave a retired judgment looking effective —
a fail-open hole in a gate whose entire purpose is to fail closed."*

What is missing is the **enumeration**. Six exits found live:

| exit | path | gated today? |
|---|---|---|
| LLM classification prompt | `packages/documents/server/src/aggregates/Document/FilingDecisionLlm.ts` (`promptFor` embeds `input.textExcerpt`) | no |
| LLM extraction prompt | `packages/foundation/capability/langextract/src/Service/index.ts:282-283` | remote-allowed check only |
| MCP tool responses | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` | *labels* rows, does not gate |
| DMS mirror | `packages/documents/server/src/aggregates/Sync/DmsMirror*.ts` | no |
| error/log/telemetry | `packages/foundation/capability/observability/src/CauseRedaction.ts` | separate pattern bank |
| agent-metrics derived storage | `packages/tooling/library/ai-metrics/src/privacy.ts:660` `safeForDerivedUi` | separate pattern bank |

`rg -n 'safeForPrompt' packages/**/src/**` → 0 hits; `goals/ingestion-secret-scrub` (active) is
currently specced to build it for **one** of the six. And
`explorations/ingestion-security-secret-governance/RESEARCH.md:96-97` already notes three
independent secret-pattern banks in-tree and says *"fold into one canonical bank, do not start a
fourth"* — the same disease one level down.

**First move.** Before `ingestion-secret-scrub` locks its contract, put that table in the SPEC with
a routed-or-out-of-scope verdict per row.

---

### T1-7. Authority ceiling: an ordered ladder, min-composed, absent = most restrictive · value 4 (down from 5) · effort M

**Mechanism.** Five rules: a ceiling is a maximum never a grant; effective ceiling = **min** over
members; it survives transport in the artifact; **absence is not permission** (unspecified = the
most restrictive level the host supports); a node cannot raise its own ceiling (→ T1-2).

**Donor.** `gai-format:gai-09` + `agent-surface:gai-08` + ts-19 — three independent surveyors
converged, all value 5.

**beep landing site + proof.** The session-scoped half is **shipped and strong** — this is why I
downgrade to 4, adopting the challenge finding ("`GrantSet.model.ts:1-20` verbatim: Draft/Frozen as
types, digest re-verifiable at any read, `FrozenGrantSet.make` banned by repo law; `TierGate.ts`
626 LOC real, wired, consumed by GovernedTier"):
- `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts` — freeze expressed in types
  ("widening a frozen set does not compile"), sealed by `GrantSetDigest`.
- `packages/foundation/capability/mcp-kit/src/TierGate.ts` — fail-closed dispatch boundary.
- `packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts` — 10 closed
  `DenialReason` literals; `goals/agent-execution-authority` 5/5.

Two things are genuinely absent:
1. **No ordered ladder, so no composition.** The existing model is binary default-deny.
   `rg -n 'AutonomyLevel|autonomyLevel|maxAutonomy|dispatchSafe' packages/**/src/**/*.ts` → zero.
   An `L0 < L1 < L2 < L3` domain with an `Order` instance and a min/meet semigroup makes "a
   composite action's authority is the meet of its parts" a **law** rather than a review question —
   and the repo already has `Order` instances in this exact slice
   (`packages/epistemic/domain/src/values/internal/CanonicalJson.ts:20`,
   `LogicalEdgeIdentity.model.ts:313`, `EdgeAuthority.repo.ts:66`).
2. **No authority field on a portable artifact.** `skills-lock/v2` has exhaustive provenance and
   zero authority; `rg -in "permission|authority|allowed|capabilit|autonom|trust"` over
   `Skills.schemas.ts` returns two hits, both the word "allowed" in prose about pinnable source
   kinds.

Also note the live absence-is-permission instance:
`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:450` makes `schemaVersion`
`S.optionalKey`. Low blast radius (a manifest, not an authority field), but it is the pattern.

**First move.** Land the ordered domain + min-composition + absence-is-most-restrictive in
`explorations/agent-governance-control-plane` (capture stage; its open question is literally which
parts belong in repo law vs a shaped capability). Enforce at the boundary that already freezes
grants, so a ceiling can only *lower* the frozen set.

---

### T1-8. Non-vacuity: every law scanner asserts its own scan matched something · value 5 · effort M

**Mechanism.** A guard reported without its mutation is unproven. Every guard ships a non-vacuity
clause and a recorded mutation result.

**Donor.** `proof:gai-04`.

**beep landing site + proof.** beep has the *ritual* at system level and almost nowhere else:
- Excellent instance: `goals/recorded-qa-acceptance/README.md` — *"The system is not 'accepted'
  because it ran — only because it demonstrably detects the defect class it was built for"*, with a
  pre-saved falsification revert patch in `ops/falsification/`.
- Measured density: **8 of 641** test files carry any control/non-vacuity/canary language; **1**
  records a measured mutation result. (Challenge pass widened the regex over all 641 files and
  independently confirmed exactly 8 — "no hidden reservoir under alternate vocabulary.")
- No lint rule for it: `ls packages/tooling/policy-pack/lint-rules/src/rules/` → six rules, none
  about vacuity. No mutation tooling anywhere.
- **The sharpest, cheapest sub-finding, and the one I would ship first:** every repo *law* is a
  source scan (`Laws/FrozenGrantSet.ts`, `Laws/EffectFn.ts`, `Laws/TerseEffect.ts`,
  `Lint/SchemaCatalog.ts`, …) and **none of them asserts its scan matched anything**. A law whose
  regex silently stops matching passes forever. Auto-memory already carries `vacuous-test-pattern`,
  `vacuous-effect-fn-test-body`, and `stale-artifact-false-greens` — beep has diagnosed this disease
  repeatedly and has no mechanism.

**Challenge caveat.** One challenger downgraded the "density framing" by ~40x and another noted the
miner missed `goals/agent-execution-authority` as an on-point shipped packet. Both rows are id-bug
suspect and the 8/641 count was independently re-verified. I hold value 5 but scope the first move
to the law scanners, which is unambiguous.

**First move.** One `check()` per law scanner asserting a non-zero match count. Then the general
convention.

---

### T1-9. Aggregation vs lookup: seeds decide what *enters*, a source floor decides what *survives* · value 5 · effort M

**Mechanism.** Two different knobs. Graphnosis measured: seed diversification alone still left
**19 of 20** final nodes in one source; a membership floor of 1 took the deepest source from 7 nodes
to 2 and replaced **40%** of the subgraph. Score alone answers "what is most relevant," which is
right for a lookup and wrong for an aggregation — producing *"a correct count of an incomplete set,
stated with the confidence of a complete one."*

**Donor.** `retrieval:gai-11`.

**beep landing site + proof.**
- beep has exactly **one** diversification concept, and it is post-fusion rerank:
  `explorations/rag-retrieval-projection/research/rrf-fusion-and-retrieval-contract.md` §8 (MMR,
  λ≈0.5, ratified as "an OPTIONAL, pluggable post-fusion stage"); `goals/hybrid-retrieval-fusion-core/SPEC.md:40`
  non-goals MMR. A reranker that reorders a list it did not choose cannot fix a list that is already
  19/20 one source.
- The failure mode is named nowhere:
  `rg -in "aggregation intent|counting quer|incomplete set|sourceFloor|source floor" explorations goals packages`
  → nothing relevant.
- **beep has more at stake than Graphnosis, not less.** "How many office actions in this family
  raised §103?" answered from a top-k that is 19/20 from one prosecution file is not a relevance
  miss — it is a confidently-wrong count on a docketing question.

**First move.** Add `aggregation` vs `lookup` as a first-class retrieval intent in the fusion
contract, and make the floor a **membership** stage (reserve N slots per source, then re-sort into
score order) distinct from the already-decided post-fusion reranker. Ship OFF by default with a
per-corpus measurement, as the donor did.

---

### T1-10. Structural nodes conduct score but do not occupy budget — unless the query matched them · value 5 · effort M

**Mechanism.** Container nodes relay score through a walk but are dropped before final selection,
**unless the node was a seed** (if the query matched "Docket ABC-123", the docket node *is* the hit).
Graphnosis measured the naive-inclusive version at **18 of 30** budget slots going to headings
against 12 to content.

**Donor.** `retrieval:gai-12` + `graph-model:gai-14`.

**beep landing site + proof.** beep's graph is *more* container-dense than the donor's:
- `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38` — five of seven kinds
  (`client`, `docket_family`, `docket`, `application`, `patent`) carry **names, not answers**.
- `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:37` is a **pure
  containment hierarchy**: `has_docket_family`, `has_docket`, `files_as`, `granted_as`,
  `has_document`, `family_document`, `archived_in`, `continuation_of`, `enriched_family`.
- The budget is already live: `packages/law-practice/use-cases/src/PracticeKg.tools.ts:77` —
  `limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20)))`.
- The rule is absent:
  `rg -n -E "structural|conduct|occupyBudget|isSeed" packages/law-practice packages/foundation/capability/nlp-processing`
  → only unrelated hits.

A walk reaching one document through `client → docket_family → docket → application → patent →
document` burns five of twenty budget slots on names.

**First move.** One rule in the `citation-graph-retrieval-channel` spec: conduct always, seed when
directly matched, occupy a final slot only when directly matched. Same shape covers **ts-24**
(block *propagation*, never *membership*) and the namespace-ownership layering rule — the retrieval
engine stays generic; the slice that owns a namespace sets the block at its own boundary.

---

### T1-11. Best-first under a hop budget: the search state is `(node, hop)` · value 5 · effort M (S if written now)

**Mechanism.** A node-keyed `visited` set is wrong under a hop cap: a node first reached at hop 3
may be reachable at hop 1 by a better path that is then discarded. Dominance must be keyed on
`(node, hop)`. Graphnosis found this at **1 disagreement in 200 random graphs after 400 corpus
queries**; a hand-built counterexample missed it.

**Donor.** `retrieval:gai-06` / `gai-07`.

**beep landing site + proof.** Clean gap, and the satellite is literally named for it:
`rg -n -E "maxHops|hopBudget|expandedAtHop|bestAtHop|DECAY_FACTOR|best-first|bestFirst" packages`
→ no output. The existing graph substrate is order-only and unscored
(`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:124` —
`TraversalOrder = LiteralKit(["dfs","bfs","topo"])`).
`explorations/rag-retrieval-projection/MAP.md:11` — "run bounded BFS, and emit a ranked graph
channel." A scored bounded BFS with a node-keyed visited set is what a competent implementer writes.

**First move.** Write the `(node, hop)` dominance rule and the random-differential-against-exhaustive
-path-enumeration test into the satellite's spec now, while it is one sentence. beep already has the
machinery: `fast-check` across ~20 suites with a shared floor (`@beep/fc-runs`).

---

### T1-12. Guarded max write in traversal, and retrieval as a pure function of `(corpus, query)` · value 4+4 · effort S+S

Two whitepaper rules, both one sentence, both on unstarted surfaces.

**wp-03 — `base(v) ← max(base(v), x)`, never `+=`.** Nearly half the whitepaper's +13.2-point graph
advantage decomposes as **structure +7.2, max-wins scoring rule +6.0** (§12.4, Figure 5, answer
model and TF-IDF seed pool held fixed). Additive accumulation lets a high-degree but irrelevant node
gather score in proportion to its degree; max cannot. Donor code: `traverser.ts:365-369, 385-389,
402-406` — three guarded write sites. **Carry the caveat**: the theorem's *global* path-optimality is
only a lower bound under a FIFO frontier and needed a v0.10.0 best-first change to close; the
degree-independence half holds regardless of frontier order, and that is the half the +6.0 ablation
tested.

**wp-13 — a ranked result is a pure function of `(corpus state, query)`; ranking reads no clock and
writes nothing.** Graphnosis CHANGELOG v0.8.0: *"Wall-clock recency scoring is removed, not made
optional: an option would only relocate the non-determinism behind a flag."* `traverser.ts:432`:
*"a ×1.3 boost… makes the same file and the same query rank differently on Tuesday than on Friday.
That boost has been removed."* beep's `goals/hybrid-retrieval-fusion-core/SPEC.md` constraint 5
ratifies determinism of *ordering* and says nothing about the clock or read-path mutation; nothing
violates it today (`rg -in "saturat|reinforce|decay" packages/{epistemic,ontology,law-practice}` →
zero), which is exactly why it is free to state.

**First move.** wp-03 → one paragraph in the graph-channel spec + one property test at
implementation time. wp-13 → one SPEC constraint + one test that runs the same fixture twice under a
`TestClock` advanced between runs and asserts byte-identical output.

---

### T1-13. Deterministic, model-free contradiction detection · value 4 · effort M

**Mechanism.** High entity overlap + low content similarity + a lexical conflict-signal bank.
Shipped and verified in the donor: `src/core/optimization/reflection.ts:104-191` — entity Jaccard
> 0.6, tf-idf cosine < 0.15, ≥2 shared meaningful entities, both sides ≥80 chars, a nine-pattern
conflict-signal regex bank, emitting a `contradicts` edge at w=0.7.

**beep landing site + proof.** beep owns the candidate **lifecycle** end to end and has nothing that
produces candidates. `goals/epistemic-contradiction-triage/SPEC.md` Non-Goals, verbatim: *"No
semantic-graph or NLP contradiction detection engine in this packet: candidates arrive from
callers."* The similarity primitives all exist:
`packages/foundation/capability/nlp-processing/src/Tools/{TverskySimilarity,BowCosineSimilarity,TextSimilarity,ExtractKeywords}.ts`,
`packages/drivers/wink/src/internal/bm25.ts`.

**First move.** Reimplement, do not vendor — the thresholds are tuned on conversational memory pairs
and the paper concedes detection is "calibrated for graphs of hundreds to thousands of nodes" and
misses "purely numerical drift." Legal text needs its own signal bank ("is hereby amended",
"supersedes", "withdrawn", finality flips) and its own thresholds against real office-action
fixtures. Apache-2.0 means port-with-attribution is legally available; register it in
`explorations/graphnosis-prior-art/research/SOURCES.md` with
`Upstream: github.com/nehloo/Graphnosis @ 7a19c4b`, `Disposition: port-with-attribution` **before**
anyone copies a threshold. Land in a new `epistemic-contradiction-detection` shape — NOT in
`goals/epistemic-contradiction-triage`, whose SPEC:139 makes adding detection heuristics a
stop-and-re-scope condition.

---

### T1-14. Determinism tier on the tool contract · value 4 · effort M

**Mechanism.** Every MCP tool advertises whether its result is replayable. `idempotentHint` answers
"does calling twice change anything," not "will the same inputs give the same answer."

**Donor.** Whitepaper wp-07 + `agent-surface:gai-01`. **Note the donor never shipped it**
(`rg -ni "deterministic|determinism" src/mcp/*.ts` → no output) — this is a paper idea, so there is
no field evidence it helps a calling model.

**beep landing site + proof.**
- Have the four MCP hints: `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:43-70`,
  emitted at `SanitizedSpan.ts:246-249`.
- Have the per-call self-report shape to copy:
  `packages/foundation/capability/mcp-kit/src/FieldTier.ts:321` `FieldProjectionOutcome`.
- **No tool anywhere declares determinism.** `rg -rni "determinism tier|non-deterministic|approximate tool"`
  → only the graphnosis CAPTURE.
- The split already exists one layer up and does not reach the agent:
  `goals/practice-kg-mcp/SPEC.md` D-2 splits its data families on exactly this axis — "(a)
  deterministic docket-family spine… **no LLM anywhere in this layer**; (b) OA span-grounded
  candidate claims… with a real LanguageModel layer."

**First move.** A `LiteralKit(["deterministic","approximate","model-derived"])` annotation in
`@beep/mcp-kit`, pass-through in `SanitizedSpan`, and a lint that every registered tool declares
one. **Admission condition:** pair the `deterministic` tier with a golden-vector test, or it becomes
decorative metadata.

---

### T1-15. State the confidentiality disclaimer where the belief forms · value 5 · effort M

**Mechanism.** A disclaimer belongs in the document a reader consults *while deciding*, not in the
document about the repo. Make it normative on your own docs.

**Donor.** `craft:gcr-08`; corroborated by the donor's own recent commit subject *"docs: state
plainly that a .gai body is not encrypted."*

**beep landing site + proof — live and unmitigated.** `goals/practice-kg-mcp` (active, 5/9, Lane 1
live front) ships a **portable bundle of an IP practice's corpus** to a foreign host
(`research/bundle-contract.md` §4: `bundle.manifest.json`, `kg.pglite/`, `practice.duckdb`,
`README.txt`), copied into a directory and pointed at by `user_config.bundle_dir` in the `.mcpb`
manifest, plus an optional `corpus_root` for full document bodies.

```
grep -rl -i 'encrypt' goals/practice-kg-mcp/          -> (no output, exit 1)
rg -n -i 'confidential|privilege|at rest' goals/practice-kg-mcp/SPEC.md
  -> SPEC.md:69 "Corpus/PII stays outside the repo; gitleaks stays clean."
```

`SPEC.md:69` is a statement about **the repo**. The document a reader consults while deciding
whether the bundle is safe to copy, sync, back up, or hand to co-counsel says nothing at all. This
is the `.gai` situation exactly, on privileged material, in a practice governed by the standing OIP
confidentiality rule.

**First move.** A stated threat boundary in `bundle-contract.md` and in the bundle's own
`README.txt` — what the bundle is, what it is not protected against, and what the operator must do.
Borrow the donor's §11 discipline: *"we do not claim protection against an adversary executing code
as the unlocked user."*

---

### Tier 1 count

15 items. **Four are true gaps** (T1-3 partially, T1-11, T1-13, T1-14 partially); the rest are
refinements to systems beep already owns, five of which land on unstarted SPECs where the
refinement is a sentence.

---

## 3. Tier 2 — worth designing against, by landing packet

### `goals/hybrid-retrieval-fusion-core` (active, 0/4)

| item | mechanism | proof |
|---|---|---|
| **R2 — derived-candidate exclusion as a stated Non-Goal** | Constraint 7 ("Fusion neither invents nor repairs spans") already makes abstractive summary nodes structurally inadmissible; that is currently a *side effect*, so a future summary channel will be discovered illegal only after it is built. | `TextChunk.span` mandatory at `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:321-332`; the repo already rejected community summaries once at `explorations/legal-ontology-landscape/research/04-ontology-informed-extraction.md:49` |
| **R5 — ablation arms as typed options, not ambient config** | The donor's env-var arm made scoring impure and left the whole +6.0 arm identified by outcome (56.20% vs 62.20%) rather than provenance. | beep already bans ambient env in domain slices (3 `process.env` hits across five product families, all JSDoc prose); the missing half is that fusion's own arms (weights, `k`, literal-tier on/off) be typed inputs |
| **`agent-surface:gai-05` — a boolean, not a number, binds retrieval quality to a disclosure obligation** | A server-computed `indirectDominant` boolean the model cannot misread, vs a fraction it must interpret. | Contribution accounting is already stronger than the donor's (SPEC req 6, "their deterministic sum equals the fused score"); the pattern exists at a different altitude in `goals/patent-citation-candor-gate` |
| **`agent-surface:gai-03` — query curriculum keyed to named engine blind spots** | Each rule names the engine property motivating it; bounded zero-result retry. | `.claude/skills/repo-symbol-discovery/SKILL.md` proves beep knows the form, for ripgrep. Nothing covers the retrieval engines. Legal text's highest-idf tokens are proper nouns that must not be normalized (`In re Bilski`, `37 CFR 1.56`, CPC codes) |
| **`retrieval:gai-14` — the golden-vector comparison-key rule** | A golden vector's key must match the system's own stability guarantee, not its surrogate keys; plus the `const GOLDEN = got` anti-pattern and a discrimination check. | `rg -in "golden.?vector" .` → no output. No golden-vector concept exists. Bites at the first ranked-output fixture |
| **`graph-model:gai-05` — the acceptance bound comes from the proof, not the writer** | An out-of-range weight makes best-first pops stop arriving in non-increasing order and retrieval returns a confidently wrong ranking with no error. | SPEC constraint 3 says only "explicit, non-negative" — the writer's convention |

### `explorations/rag-retrieval-projection` (active, graduate)

- **R7 / wp-05 — corpus-derived synonym expansion.** Donor: `synonym-expander.ts:19,41-42` —
  cross-pollinate endpoints of `similar-to`/`shares-entity` edges with weight ≥ 0.4, memoized on a
  graph mutation signature (hence `synonymMapBuildMedian: 0` in the committed benchmark). beep has
  no undirected edge class, so port the *transferable core*: mine pairs from BM25 co-occurrence in
  the existing wink corpus (`packages/drivers/wink/src/internal/bm25.ts`), cache on a corpus
  mutation signature. Assignee variants, inventor spellings, docket aliases at zero model cost.
  Caveat: query expansion is **not independently ablated** in the paper.
- **`graph-model:gai-08` — re-ingest dedup key excludes chunk order.** Key on
  `(content, type, source.file, source.section)`; excluding order stops one inserted paragraph from
  re-storing the entire tail as second live copies; including `section` stops a Beta passage getting
  a stored Alpha node. Preserve multiplicity with a consumed-matches set. beep's dedup is whole-file
  today (`VaultSyncEngine.service.ts:195-213`) and the char-span chunker is a named net-new gap
  (`research/SOURCES.md:242`).
- **`retrieval:gai-05` — conduction, and the mutation-testability criterion for redundant guards.**
  A single admission gate at the output boundary structurally *cannot* catch a retired node relaying
  score between two live ones. beep's `ClaimGate` is exactly that shape; `KgEdgePredicate` includes
  `continuation_of`, so a superseded application relaying rank between two live ones is the concrete
  instance.
- **`ingestion:gai-01` — a length floor applies only to text that was split.** Derive "was this
  truncated?" from the splitter's own output count, never from content. beep has no floor today
  (correct) and no rule for the chunker that does not exist yet. A one-word answer in an office
  action, a `FINAL` marker on its own line, a date cell.
- **`ingestion:gai-08` — multilingual by construction.** A synthesized node re-indexed into the same
  lexical index that transliterated an entity cannot be retrieved by the query that retrieves its
  own evidence. `Müller`/`München`/`東京` in an inventor or assignee field is routine for foreign
  priority. beep's *extraction* path is already structurally protected (unaligned candidates are
  counted, `langextract/src/Service/index.ts:315-322`); *synthesis* paths are not.
- **`graph-model:gai-09` — cross-generation edges, and reach as a metric.** The bug is invisible to
  seed-level recall and shows up only in traversal *reach*. Any incremental graph channel needs a
  reach metric or the class is unobservable.
- **wp-18 / wp-20 — the harness shape.** Identical seed pool across arms; a no-retrieval
  full-context arm as the floor (22.6%, overflowed the window on nine questions — the number that
  kills "just paste the whole file in"); per-arm evidence whose numerators anyone can recompute.
  Constraint beep hits that the donor did not: the realistic corpus is client patent material under
  a hard confidentiality rule, so the committed fixture must be synthetic or public-record.

### `explorations/epistemic-belief-view-revision` (active, capture)

- **cc-04 — MATRES eight-axis modality as a contradiction-triage pre-filter.** *Cite Ning et al.
  2018, not Chronocept.* Two claims that textually conflict are not a contradiction if they sit on
  different modality axes: "We intend to file by March" does not contradict "the filing occurred in
  June." In a prosecution corpus, intention/opinion/conditional statements sit next to statements of
  record constantly. Port **merged** (Generic+Static as one class — their Table 8 shows the merge
  alone moves precision 0.4443→0.5243 and κ 0.3291→0.3866) and drop Static, whose confusion matrix
  shows it absorbing everything. Lands on the packet's own named-and-empty "semantic stance" verdict
  family (`CAPTURE.md:45-49`).
- **cc-05 — and it is a soft prior, never a hard gate.** Human annotators agree at κ=0.39 on the
  merged taxonomy, so no classifier trained on those labels can be expected to beat it. One
  acceptance-criterion sentence. (Also log for source appraisal: the paper's advertised "strong
  inter-annotator agreement (84%/89%)" is ICC on the three curve parameters, not on the axis labels.)
- **`retrieval:gai-03` — the third temporal axis.** beep's two axes are both *membership* axes. The
  donor's split is orthogonal: ranking-time vs membership-time. Pre-commit the asymmetry before the
  first decay term: a caller passing a historical instant for historical *ranking* must not thereby
  move *membership* backward and re-admit retracted content.
- **`retrieval:gai-04` — which property gets the default.** The read path reads no clock at all (10
  `Clock`/`DateTime.now` hits across epistemic + law-practice, every one on a write/settlement path;
  `GovernedTierGate.gate.ts:344,474` independently practices resolve-once-and-thread). The
  consequence: **nothing forces the membership axis to now.** No rule anywhere says retracted content
  must not reach a prompt regardless of what the caller passed.
- **wp-09 — separate conflict *character* at detection time from *disposition* at review time.**
  genuine conflict / temporal supersession / negation artifact / suppress, with every suppressed pair
  written to a named lane carrying its failing reason instead of silently dropped.
  `ContradictionMatchBasisKind` (`Contradiction.model.ts:435`, currently `["same-source-overlap",
  "independent-evidence"]`) is the natural seat. Do not import the donor's numbers: 100% on a 71-pair
  set is regression coverage on a set that co-evolved with the rules.

### `explorations/agent-memory-tiers-bitemporal-edges` (active, graduate)

- **`epistemics:gai-05` — a reweight primitive, and the receipt read back from state.** beep's write
  surface is exactly four operations (`EdgeAuthority.ports.ts:61-66`: `readAsOf/readLatest/record/
  supersede`). A consumer wanting to reweight would reach for `supersede` and burn a version number
  per recall. The donor documents a real consuming app with a permanent graph-vs-log split caused by
  logging an increment while the graph received something else — an audit receipt's `applied` field
  must be **read back from state after assignment**, never echoed from the argument.
- **`epistemics:gai-07` — preview-before-forget on the same code path.** beep has this in tooling
  (`Yeet/internal/Sweep.schemas.ts:10-16`, `SweepPlan`/`SweepReport`, "the same plan echoed verbatim
  plus one outcome per step") and no product-side destructive op yet. Binding the day eviction lands.
- **`epistemics:gai-10` — decay's causal trap.** The donor's decay keyed on `lastAccessedAt` that
  nothing refreshed, so it measured *age*, not disuse; nodes fell to the 0.1 floor within a day and
  were suppressed. beep's decay research is deeper on the math and silent on this. **Generalizable
  schema-review question: what refreshes this field?**
- **`ingestion:gai-03` — per-source right to originate vs corroborate.** beep has this at
  *operation* granularity (detection never mutates authority) and not at *source* granularity. A
  heading, filename, DMS folder label, email subject line, or OCR page header is treated the same as
  body text by every extraction consumer. Three-valued `originate | corroborate | excluded`, not a
  boolean trust flag. Already noticed and not built:
  `explorations/_gold-intake/GOLD_SYNTHESIS.md:680`.
- **`ingestion:gai-07` — summary nodes at a distinct level, above the pruner floor, in the same
  index.** Four mechanics worth copying; one that beep **cannot** copy verbatim — a synthesized
  summary has no verbatim span, so it cannot carry a `VerifiedTextAnchor` and fails
  `verifyTextAnchor`'s quote-mismatch check by construction (`VerifiedTextAnchor.ts:372`). beep's
  version must be a distinct node kind carrying *derived-from* edges to anchored evidence.

### `goals/agentic-professional-runtime` / `explorations/agent-governance-control-plane`

- **ts-04 — the completion oracle (`tool | state | human`) as the primitive that classifies
  procedural work.** Three literals. beep has independently built *both* a tool oracle
  (`verificationCommands` in goal manifests) and a human oracle
  (`packages/tooling/tool/cli/src/commands/Qa/JudgeLint.ts:68`, schema-validated `qa-inventory/v1`)
  without ever naming the axis. Naming it makes obvious which repo procedures have **no** oracle —
  most skills. That is the real finding.
- **ts-08 — `SkillExecutionPlan` as a tagged step union, not a six-optional-field bag.** The idiom is
  native (`rg -c 'S.toTaggedUnion' packages/**/src/**/*.ts` → 98 files); worked precedent at
  `packages/foundation/modeling/nlp/src/Graph/Schema.ts:190-225`. Plus the mining note's improvement
  over the paper: decode an uncapped loop into an *explicitly defaulted* cap so the "was this cap
  authored?" bit survives decode. That single bit is the sharpest conjunct of the unattended gate
  (ts-21) and is currently tracked out-of-band.
- **ts-03 — the goal contract as a TOTAL record over goal categories.** Makes "this skill has no
  failure handler" a decode error instead of a review finding. The donor's own corpus had five skills
  failing the contract. `MappedLiteralKit` exists at
  `packages/foundation/modeling/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts:350`.
- **ts-10 — empty-engram training: the procedure body is a pure function of authored source; private
  facts bind at *walk* time through declared recall recipes.** beep's skills are already source-only
  by construction, but there is **no declared binding**:
  `packages/tooling/library/ai-sync/src/schemas.ts:131` — `AgentSkillFrontmatter` is exactly
  `{name, description}`. A skill that says "recall the matter's prior office actions" instead of
  embedding them is simultaneously shareable and private. Bounds *automatic* leakage only — the
  invariant does not cover facts an author writes into the source.
- **`agent-surface:gai-07` — tool surfaces and results may be narrowed by policy; never report
  absence as proof of absence.** This is a **current defect, not a future one**: `hard`-gated sources
  vanish from `tools/list` at composition and `TierGate.withEnabledWhenApprovedTool` filters the
  list, so a beep agent already sees a partial surface and nothing tells it so.
- **ts-21 — the conjunctive unattended gate.** Premature (v1 policy is "nothing runs unattended,"
  which is a sound conjunctive gate with one simple conjunct). Extract the authored-vs-defaulted cap
  distinction now, for free.

### `goals/knowledge-surface-automation`

- **ts-12 — the closed staleness loop.** Correction to the mining note: beep is much closer than
  assumed. `beep knowledge semantic-delta` already owns the right scope
  (`Knowledge.service.ts` `SCANNER_SCOPE` = AGENTS.md, CLAUDE.md, goals, explorations, docs,
  `.claude`, `.agents`, `.codex`, standards, `.github`) with a 14-member typed finding taxonomy
  (`Knowledge.schemas.ts:35`) running as a gate. Missing: **claim-level dependencies**. A skill
  asserting "the coverage lane runs `test`" or "`Skill` has two fields" goes stale with zero signal.
  Start narrow — *declared* dependencies (this skill depends on these paths/symbols/commands), not
  extracted claims — plus a typed staleness reason and a queue. Copy the drainer discipline: one per
  cycle, surfaced for confirmation, never applied silently.
- **ts-30 — skill-vs-skill conflict is not modeled.** A negative finding in the paper that is a live
  gap here. 30 skills with visibly overlapping triggers: `ponytail` / `ponytail-review` / built-in
  `simplify`; `effect-first-development` / `schema-first-development` / `schema-model-specialist` /
  `crispen`; `explore` / `grill-me` / `grill-with-docs`. Nothing detects overlap
  (`rg -n 'supersede|conflict|overlap' packages/tooling/tool/cli/src/commands/Skills/*.ts` → zero)
  and the remedy is manual (`goals/harness-hygiene-mechanical`, 4/4, deleted four by hand). Cheap
  version: a pairwise description-overlap report surfaced as a knowledge finding kind, read-only
  first.
- **ts-29 — untrusted ingress: an imported procedure is not dispatch-eligible until promoted.** The
  epistemic half exists — `Skills.schemas.ts` grades every vendored skill with
  `SkillProvenanceStatus = LiteralKit([exact, inferred, unresolved])` and
  `SkillProvenanceConfidence`, explicitly *"so an unproven claim can never be read as a proven one."*
  The authority half does not: a vendored skill under `.claude/skills/` is fully invocable the moment
  it lands. Sequence **after** T1-7 — without an ordered ceiling there is nothing to lower it to.
- **ts-17 — one trigger table, several consumers.** Honest read: `ls -la .agents/` shows
  `skills -> ../.claude/skills`, so a symlink already captures most of the value for two consumers. A
  generator earns its keep at a third target, or when the index carries more than name+description —
  i.e. after ts-04 and ts-09 add fields. Sequence after those; a generator over a two-field
  frontmatter is ceremony.

### `goals/coding-agent-effectiveness-evidence-loop` (active, 0/9)

- **`proof:gai-08` / wp-17 — provenance grading per recorded run.** beep has a *typed* version for CI
  lanes (`CiLane.ts:104` `CI_LANE_REPLAY_VALUES = ["exact","approximate","none"]`) — stronger than
  the donor's prose grades — but on **lanes**, not on **runs**. `BenchmarkRun`
  (`packages/tooling/library/ai-metrics/src/models.ts:654-668`) carries no command, no argv, no
  provenance grade. Auto-memory already records `yeet-verdict-misattribution` and
  `stale-artifact-false-greens` — the same failure the donor's `command_provenance` field exists to
  prevent. Add `LiteralKit(["exact","attested","reconstructed"])`. The forcing function is the
  honesty, not the schema: the donor's own +6.0 arm had to be labelled reconstructed.
- **`proof:gai-07` — the evidence bundle that verifies itself, and gates something.** `beep qa
  judge-lint` is a genuinely self-verifying bundle (schema re-decode, round coherence, findings
  cross-checked against `events.ndjson`) — and `rg -n "judge-lint" .github lefthook.yml
  commands/Ci commands/Yeet` → **no matches**. The best artifact in the territory runs only when a
  human remembers. Also: no content hashing of evidence files, and no prose-to-data binding (goal
  READMEs quote numbers nothing recomputes).
- **`proof:gai-10` — the instrument identifies itself.** `CaptureProvenance`
  (`QaCapture.models.ts:540-621`, `beep.qa.provenance.v1` stamped into XMP-beepQA / container tags)
  is *better* than the donor's sidecar JSON. Missing: the harness never hashes its own source, so a
  changed extractor at the same version produces provenance-identical artifacts; no `definitions`
  block travelling with the numbers; no `--self-test` of the scorer.
- **cc-12 — reported metrics must be algebraically independent, or the dependence stated.** Chronocept
  reports MSE, MAE, R², NLL, Spearman and CRPS as six pieces of evidence; on Z-normalized targets
  R² = 1 − MSE identically (verifiable from the printed tables: 1 − 0.8763 = 0.1237 exactly, every
  non-BERT row). Then headlines "R² nearly doubles" three times, where the doubling is +0.0422 on a
  baseline R² of 0.0375. Two acceptance-criteria lines on a spec still being written.
- **cc-13 — the shuffle-vs-remove ablation pair.** Best methodology transfer in the papers. Removing
  a structured feature tells you whether the consumer uses it; **shuffling its order while keeping it
  present** tells you whether it uses the *structure* or just the bag of content. Their result:
  shuffling hurt roughly twice as much as removing (Bi-LSTM +9.83% vs +4.59% MSE). beep already
  plans memory-ablation-by-removal (`PLAN.md` P5); the permuted-order arm costs one more profile and
  answers whether skill ordering, context-section ordering, and prompt-prefix ordering are
  load-bearing or decorative — a question this repo actually has. Borrow the design, not the numbers
  (129-sample test set, single run, no seeds).
- **ts-16 — the token accounting for lazy dispatch.** The mechanism is how Claude Code skills already
  work and the paper disclaims novelty. What beep lacks is the measurement: nobody has measured what
  the 30-skill frontmatter prefix costs per session, which is the number `AGENTS.md`'s
  context-economy law currently asserts without evidence.

### `goals/practice-kg-mcp`

- **`retrieval:gai-13` / wp-06 — role-partitioned prompt rendering.** beep's byte budget is *better*
  than the donor's (`PracticeKg.tool-handlers.ts:58-87` — measured `budgetBytes`, binary search for
  the fitting row count, explicit `truncated` flag; `FieldTier.ts` three real Schema.Struct variants
  plus a `FetchableHandle` escape valve — vs the donor's unenforced "~2K tokens"). What is missing is
  **partitioning**: `PracticeKgEpistemicStatus` (`["derived-from-official-records",
  "candidate-unreviewed"]`) is a *field on rows in one undifferentiated list*, not a partition of the
  rendered result. A model told to count will count from whatever is in front of it. That invites
  exactly the candor failure `goals/patent-citation-candor-gate` exists to prevent.
- **`agent-surface:gai-04` — escalation policy in the tool description as a forbidden utterance.**
  "Do not report *no matching docket family* until `kg_*_search` has run with the same query."
  Additive to the existing `ApiKeyRequiredFailure` in-band-control-signal machinery.
- **`agent-surface:gai-06` — a fixed row-tag grammar and section order.** D-4 labels are prose per
  row with no grammar and no ordering rule; a fixed six-character tag is what keeps them from being
  paraphrased away by the model.

### Other packets, one line each

- `explorations/multi-provider-llm-dispatch-fallback` — **ts-27**: the trained-skills paper refutes
  its own routing arm. Blind, position-counterbalanced, K=10: Haiku retained 75% overall and ≥60%
  everywhere; Qwen-14B held code 100% / structured-output 80% / extraction 70% but collapsed to
  **reasoning 0%, writing 0%**, summarization 20%. Route mechanical work local/cheap, judgment work
  cloud. Direction survives the disclosed threats (single non-blind-in-3-records judge, 7/60 relay
  contamination); the magnitudes do not. Also **ts-22**: infeasibility as a first-class decodable
  value, and a *total* selection ordering — refuse the paper's routing economics.
- `explorations/graphnosis-prior-art` — **`retrieval:gai-09`**: 26 `HashMap.values`/`HashSet.toValues`
  iteration sites, one known-sorted (`PracticeKg.projections.ts:444-448`). Effect's HAMT order is
  deterministic-but-not-lexicographic for string keys and **process-random for object keys without
  `Hash.symbol`** — so beep is better than Go and worse than plain `Map`. Lint-rule candidate.
- `explorations/effect-orchestration-patterns` — **`gai-format:gai-03`**: error taxonomy keyed on
  consumer *action*, with version-skew carved out. Two verified live misroutes:
  `DockEngine.test.ts:129-156` (a legacy snapshot and a `version: 2` snapshot fail with the
  byte-identical `DockInputError`, and the destructive default for a UI is to reset the layout) and
  `Yeet/internal/Status.ts:539-542` (a `/v1`, a `/v3`, and a truncated verdict artifact all collapse
  to one state — the exact class `stale-artifact-false-greens` records).
- `explorations/domain-layer-hardening` — **`gai-format:gai-ap-invariant-door`**: the declared funnel
  enforces one invariant and not the other. `EdgeVersion.table.ts:1-10` states it plainly — "the
  migration publishes the invariants" — and `rg 'S\.check|\.check\(' EdgeVersion.model.ts` → **zero
  hits**. An `EdgeVersion` decoded from a fixture, wire payload, or export path is accepted with
  `validTo < validFrom`; Postgres refuses the same value. The model's doc comments *describe* the
  CHECK constraints, which makes the gap harder to notice.
- `goals/domain-kernel-hardening` (paused) — **`craft:gcr-07`**: adding a **required** field is in
  neither list at `standards/architecture/11-evolution-and-deprecation.md:28-43`. In beep the hole is
  wider than in the donor because `S.Class` schemas are opaque and double as the decoded type, so
  every `X.make({...})` call site and fixture breaks while readers are untouched — and the
  encoded/decoded duality doubles the axes.
- `goals/quality-gate-ratchets` — **`retrieval:gai-10`**: five committed numeric baselines in
  `standards/`, at least one provably env-sensitive axis (`FastCheckRuns.ts:71`,
  `max(inline ?? DEFAULT, BEEP_FC_NUM_RUNS)`, "CI exports BEEP_FC_NUM_RUNS before boot"), and **no
  baseline records the ambient env state it was taken under**. Undeclared ambient state does not
  merely make behaviour vary — it retroactively invalidates every measurement taken under it.
- `goals/recorded-qa-acceptance` — **`proof:gai-06`**: hand-authored `fx-*` fixture ids throughout
  (`VaultSyncReviewRegressions.test.ts:288`, `VaultSyncDrift.test.ts:86`); nothing asserts a
  fixture's id-space is disjoint from production-minted ids, nothing compares evidence *by content*
  when ids are expected to differ, nothing tests a tie-break comparator directly.
- `explorations/compound-engineering` — **`craft:gcr-05`**: 4 of 316 pending changesets carry a
  number; `git log -300 | grep -ci '^cost:'` → 0. The "what this costs" move is absent from the
  corpus entirely. Plus **`epistemics:gai-14`** guard-neutralisation testing and **ts-31** as
  convergent external evidence (beep went one step further by diagnosing *why* closeout reflection
  underperforms).
- `explorations/model-artifact-admission` — **`gai-format:gai-06`**: analyzer identity at the
  *retrieval* layer. beep has it for documents (`WorkspaceSourceTextResolver.ts:80-90`,
  `extractor-unavailable`) and not for indexes: `WinkCorpus.service.ts:243,431,519-543` holds
  `BM25Config{b,k,k1,norm}` in **session state only**, nothing persists or pins it. The donor's
  measured consequence — every A/B retrieval number was a measurement of which loader ran — is the
  argument that packet is missing.
- `explorations/knowledge-workspace` — **`ingestion:gai-12`**: an LLM-free, citation-bearing,
  type-partitioned topic page a human can read to audit what the graph believes. All the bricks exist
  (`@beep/md` pure render adapters at `Md.render.ts:654-1361`, the typed node vocabulary at
  extraction time, `PracticeKgEpistemicStatus` as the honest-epistemic banner, `kg_provenance` for
  reverse citation). Do **not** port the donor's A5 (unused `topic` param, O(pages × graph) index,
  branch-local dedup).
- `explorations/identity-as-iri` — **`gai-format:gai-10`** reproducibility half: no injected build
  instant, no position-derived id scheme. `standards/effect-first-development.md:235` is the entire
  law — "Avoid direct `Date.now()`" — an *avoid* with no injected instant.
- `goals/legal-document-intake` — **`ingestion:gai-09`** resource-exhaustion lane:
  `Effect.timeoutOrElse` does **not interrupt the parse**. `DocText.service.ts:124-133` passes no
  `AbortSignal` into pdfjs, so the timeout stops the fiber waiting while the parse keeps consuming.
  The donor's page-batching + `setImmediate` yield is the mechanism that actually bounds it.
  `explorations/ingestion-security-secret-governance` covers injection, secrets, SSRF, mXSS, hidden
  content — **not** algorithmic complexity — and is about to author a repo-wide regex bank.
- `explorations/ingestion-security-secret-governance` — **`agent-surface:gai-13`**: a published,
  third-party-runnable no-egress falsification procedure. beep is ~90% there already
  (`GovernedEgress.test.ts` `expectDenied` asserts the URL never reached base fetch). Under the
  standing OIP rule, a five-minute `unshare -n` proof is a **client-facing artifact**, not hygiene.
- `explorations/docx-roundtrip-interop` — **`proof:gai-12`**: no fixture is malformed on purpose.
  `ls packages/foundation/modeling/pandoc-ast/test/fixtures/` → two files, both valid. 216 test files
  assert *that* something failed; only 175 mention `_tag` at all.
- `goals/effect-v4-workflow-engine-spike` — **ts-26 / `agent-surface:gai-11`**: do not build run
  records. The spike already has a stricter bar (real process kill, not graceful shutdown) than the
  donor's encrypted run files. Add the multi-session attorney procedure as a second consumer
  alongside law-docketing.
- `goals/one-round-loop` — **`proof:gai-14`**: `bun run release` (`build && test && lint &&
  audit:full && changeset publish`) appears **only** inside the manual publish job;
  `audit:full` runs in no PR workflow, and `build` is `required: false` (`CiLane.ts:450-457`). The
  release path has a segment whose first execution is at release time.
- `goals/fallow-zero-dead-code` — **wp-19**: a declared union is not a census of what is emitted.
  `$match` exhaustiveness proves *consumption* coverage, not *production* coverage. Honest verdict:
  worth one afternoon as a one-off script, not a ratchet. The durable takeaway is a documentation
  rule — when a vocabulary is published as a capability claim, say whether it describes what the
  system emits or what the type system permits.
- **NEW packets proposed by the miners** (all low urgency): `versioned-artifact-envelope-contract`
  (`gai-format:gai-01/gai-02` — 40+ `<family>/vN` envelope ids, every extension a hard version bump,
  three breaks already spent with no doctrine bounding the next),
  `public-demo-corpus-suite` (`ingestion:gai-13` — beep's only corpus is confidential and out-of-repo,
  so every KG/retrieval integration test is hand-authored fixtures that encode the author's
  assumptions), `agent-guide-law-drift-gate` (`graph-model:anti-06` — 20+ lint gates, none checks a
  law statement in `AGENTS.md` against shipped code).

---

## 4. Tier 3 — noted, not pursued

One line each, with the reason.

| item | why not |
|---|---|
| wp-02 co-equal dual graph (directed + undirected over one node set) | XL, and the design case is weak: beep's epistemic edges are authority-bearing and bitemporal, so an associative class is a *derived projection*, not a peer. Also `medianPctOnlyUndirected = 84.8` vs `medianReachDirected = 3` — "co-equal" is a claim about API exposure, not contribution to reach (lopsided ~30:1), and only the 8.4% end of the 8–13% overlap range is reproducible from committed artifacts |
| ts-01 / ts-02 zero-primitive graph-native skills | Only pays with a generic labelable substrate. beep's edge vocabularies are closed `LiteralKit`s where adding a member IS a schema change — the opposite of the claimed property. Building the substrate to obtain the framing is an XL inversion of the repo's design order |
| ts-06 inline prose step DSL (`@needs`, `@branch:`) | Wrong authoring surface for a schema-first repo. Keep only the intellectual honesty (graph-*resident* ≠ graph-*topological*) as a review habit |
| ts-07 plan compiled from storage order, not edge traversal | Genuinely good insight (it lets a loop be a real back-edge while the plan stays a finite ordered list), but beep has no procedure compiler to host it, and the determinism-pinning half is already standard practice (`ProofManifest.ts`, `GeneratedFileDrift.ts`) |
| ts-11 structure-preservation gate on machine rewrite | beep does not machine-rewrite its skills. Keep only the revert-to-source-on-fail branch as a note. The paper de-rated its own validator (deduplicated substring match, not per-step placement) |
| ts-18 proactive skill matching with anti-spam bounds | No proactive dispatch surface exists (`Agent.model.ts:35-40` — one `skillFixtureKey`, one mode literal). If it ever ships, steal the three numbers wholesale; build nothing now |
| ts-32 the "Agempus" reframe | Mostly a naming move, and the paper concedes the limit. Keep the *stance* (the durable unit of reuse is the owned procedure set, the model is rented) as the justification for ts-03/04/08 |
| cc-01 log-time parameterization (`t' = ln t / ln 1.1`) | Real and cleanly separable, but beep has no graded staleness quantity to attach it to and the one packet that would consume it explicitly excludes relevance calibration. Keep one derived law: **any numeric field whose meaning depends on a unit or base carries that unit/base on the record** |
| cc-02 skew-normal graded validity profile | Ranking is the belief-view layer's job; putting a fitted estimate on `EdgeVersion` breaks the core's immutable-assertion invariant. Their own fit explains ~13% of variance on 129 samples |
| cc-06 click-points-and-fit annotation UX | Genuinely good design, no place to put it. beep has no task that asks a human for a graded temporal value |
| `retrieval:gai-08` cosine ULP clamp | Already-have and better instrumented (`WinkSimilarity.service.ts:134-172` — branded `UnitInterval` + a log warning + a span annotation when it fires). One note: beep clamps to **[0,1]**, the donor to **[-1,1]**; a genuinely negative cosine becomes 0, collapsing "actively dissimilar" into "unrelated". Raise if the local encoder lands |
| `gai-format:gai-11` conformance fixtures shipped as bytes | The payoff (a third-party implementer) does not exist. The publish-gate wiring is already stronger |
| `agent-surface:gai-09` L1/L2/L3 conformance ladder | Do not port the ladder. beep already has something better: seven independent typed verdicts, *"none implies another"* (`approval-and-autonomy-policy.md:34-38`) — a lattice, not a ladder, so it cannot become the shaming device §8.3 had to defend against |
| `craft:gcr-01` README ten-second demo | The bricks exist (`apps/architecture-lab-proof`, three rendered HTML pictures) but beep has no `npx` surface and no point-at-your-own-files story. Transferable half only: first content is executable |
| `craft:gcr-09` NOTICE coverage | Real hygiene gap on a public repo — `.repos/effect` (3,340 tracked files), `tools/skillopt/vendor/prompts/**` (no provenance file of any kind, landed in `fb7ce421ce`), and two `patches/` files are all outside `THIRD_PARTY_NOTICES.md`. Coverage, not craft. Worth a chore, not a packet |
| RAPTOR tree levels as node types | `TextChunk.span` is mandatory (`Contract.ts:321-332`) and `ChunkKind` is a *structural* vocabulary; `layer` is an orthogonal axis. If RAPTOR ever graduates, build contiguous ~7-chunk windows (no UMAP/GMM/BIC), depth 2, `layer` as a fusion feature — ~15% index growth and fully incremental |

---

## 5. Already covered — do not rebuild

This section exists to stop a future reader re-deriving what beep owns. 41 `already-have` mappings
plus the challenge refutations.

### Where beep-effect is strictly ahead of the published artifact

| donor claim | beep's path, and why it dominates |
|---|---|
| **Theorem 1 — node-set indelibility** (wp-10) | `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:6` — two half-open axes (`[validFrom,validTo)`, `[recordedAt,expiredAt)`), supersession as atomic close-and-insert. Monotone node sets are *one* axis; beep carries two, so it answers "what did we believe on Tuesday about what was true in March." The paper concedes Theorem 1 is "enforced by construction, not a deep result" |
| **`recall_as_of`** (wp-12) | Shipped end to end — domain → `EdgeAuthority.repo.ts` `asOfWhere(logicalKey, validAt, knownAt)` → RPC → client atoms → `ContradictionTriagePanel.tsx`. Both instants are **required** (`EdgeAsOfQuery`, `EdgeAuthority.commands.ts:268-283`), so the donor's "caller had to know to set two fields" failure is a compile error. **Not implemented in the OSS SDK at all** |
| **Adjudication contract** (wp-01, `epistemics:gai-08` D8) | `Contradiction.model.ts` — immutable digest-sealed `ContradictionCandidate`, append-only `ContradictionDisposition` with a tagged `rejected \| superseded` decision, unique index on `candidateId`; `EdgeRelation.model.ts:13` makes `contradicts` a first-class relation; `values/Contradiction/Contradiction.model.ts:562-566` annotates `detector` as *"provenance, not authority."* Violent agreement. Take the paper's *language* only: "the adjudication contract, not determinism, is the distinguishing commitment" |
| **Promotion gate / Design Invariant 1** (wp-16) | The donor expresses it as a *file boundary* (`.gai` vs `.gnn`/`.gll`) and concedes it is "an invariant enforced by construction rather than a theorem." beep expresses it as separate tables + a typed verdict + a write-ahead ledger (`GovernedTierGate.gate.ts` — "no record, no action"), enforced by a type checker and a foreign key. Borrow only the phrase **"write-path lattice"** |
| **Enforced result cap** (wp-22) | `PracticeKg.tool-handlers.ts:58-87` (measured byte budget, binary search, explicit `truncated`) + `FieldTier.ts` (three real Schema variants + `FetchableHandle`). The donor's "~2K tokens" is an unenforced estimate — `rg -n "token\|truncat\|2000" subgraph-serializer.ts` returns only the file header. Borrow only the lost-in-the-middle *motivation* framing |
| **Canonical hash discipline** (`gai-format:gai-14`, `graph-model:gai-07`) | `CanonicalJson.ts:6-8` carries the identical argument unprompted. And beep does not *freeze* the algorithm — it **versions the digest input** (`epistemic-grant-set/v1`, `digestOf(version, canonical)`), which makes a change loud and non-colliding rather than frozen forever. The donor's 32-bit DJB2 has a self-declared ~5% collision rate at 20k nodes; beep is SHA-256 throughout |
| **`(id, rev)` identity** (`gai-format:gai-10`, `epistemics:gai-13`) | `logicalKey` (a *total canonical encoding* digest, with `absentScopeMarker = "<none>"` so absence cannot collide with a real value) + `version: PosInt` + `supersedesId` self-FK + an **open-head partial unique index** in SQL. beep shipped the donor's unimplemented v2 |
| **Error taxonomy survives transport** (`agent-surface:gai-12`, `proof:gai-02`) | Every domain error is a `TaggedErrorClass`/`CauseTaggedError` with `S.is`-derived guards. `rg "instanceof [A-Z][A-Za-z]*Error" packages apps` → **two hits, both JSDoc examples**. `ApiKeyRequired.ts:1-15` documents the verified upstream path by which a `"return"`-mode failure ships as `CallToolResult({isError: false})` with encoded failure JSON. The donor's hand-maintained code↔class map had already diverged once |
| **Log pseudonymization** (`agent-surface:gai-14`) | `packages/tooling/library/ai-metrics/src/privacy.ts` — **salted SHA-256** via `crypto.subtle`, with the weak case a *declared state* (`AiMetricsHashSaltStatus = LiteralKit(["provided","insecure_default"])`, env var literally containing "insecure"). The donor concedes its unsalted FNV-1a is "cryptographically weak by design" |
| **Source-audit discipline** (wp-25) | `explorations/graphnosis-prior-art/research/SOURCES.md` template pins versions, SHAs, quotes **and** adds a license-disposition column that decides clean-room vs port-with-attribution per upstream — the column that actually governs whether code can move |
| **Known-weaknesses discipline** (wp-24, `gai-format:gai-13`) | `goals/agent-execution-authority/README.md:51-58` states its own audit limits normatively ("a resealed tail or a deleted suffix still verifies intact, because nothing anchors the chain tip"). And postmortem promotion is **law**, not habit — the `AGENTS.md` friction-receipt rule requires it at the moment of friction |
| **Retirement markers / liveness** (`epistemics:gai-04/gai-11`, `graph-model:gai-02/gai-04/gai-13`) | Liveness is `openHeadOf` reading only interval nullness (`EdgeAuthority.repo.ts:154-155`); `supersedesId` is lineage and is read nowhere in the liveness decision. `Confidence` is immutable and never consulted for liveness. The donor's whole `validUntil`-dual-meaning problem is unrepresentable |
| **Ingest funnel + fail-closed vintage** (`ingestion:gai-11/gai-14`) | One `ExtractionResult`, one `Strategy`, one `FileProcessingService.process`. beep does not need the donor's `'mixed'` container marker because vintage is **enforced**: `verifyTextAnchor` compares the whole `SourceTextIdentity` and fails `stale-source` on any difference *before* comparing the quote. Strictly stronger than a marker |
| **Chunk identity** (`ingestion:gai-02`) | `LogicalEdgeIdentity.model.ts` — the producer literally calls the resolver's key function (`import { encodeEdgeEndpointKey }`), which is the donor's stated fix, plus `canonicalEncodingVersion` |
| **Atomic write** (`gai-format:gai-ap-atomic-write-durability`) | Exactly one primitive, `writeFileWithinCanonicalRootAtomically` (`PathSafety/index.ts:591`) — containment check → mkdir → re-check → unpredictable temp dir → `writeFile(flag:"wx", mode:0o600)` → rename. The donor triplicated it. (Durability half — no `fsync` anywhere — is honestly captured at `goals/legal-document-intake/research/sync-state-model.md:149-151`, and because there is one primitive the fix is one edit) |
| **Byte-for-byte faithfulness oracle** (`proof:gai-11` half) | `apps/architecture-lab-proof/AGENTS.md:6-10` + `AcceptedProofManifest.ts` + three `SchemaParity.test.ts` suites. Already enforced |
| **Layered claims / "none implies another"** (`gai-format:gai-08`) | `approval-and-autonomy-policy.md:34-38` — seven independent typed verdicts. A lattice beats the donor's ladder |
| **Errata placement** (`craft:gcr-06`) | `explorations/academia-corpus-mining/DECISIONS.md:142-149` reasons explicitly about errata *placement* and deviates deliberately from an audit recommendation because line-number citations would shift. Better-reasoned than the donor's |
| **CI-gate provenance comments** (`craft:gcr-14` half A) | beep cites incidents **plus the packet and PR that fixed them** — `check.yml:661-673` (why gitleaks pins to the base branch: "a PR could broaden the allowlist in the SAME change"), `:715-726` (CSF-022, "never silently FAIL OPEN"), `release.yml:61-63`, `storybook.yml:31-33` |
| **Determinism-justified single implementation** (`craft:gcr-03`) | Already the product thesis (`docs/ROADMAP.md:64-66`) with binding rules in `goals/practice-kg-mcp/research/bundle-contract.md` §5 |
| **Chronocept's whole temporal object** (cc-07/08/09/11) | Strictly below on every axis: one relative axis vs two absolute; unimodality forbids lapse→revival→renewal, which beep's disjoint-interval model handles natively (patent lapse and revival, maintenance-fee windows, term extensions, restored priority, reinstatement after appeal); `Option.none` says "holds indefinitely" where their curve always decays to zero; and their released JSON has **no character spans at all** (concatenated substring copies, irreversible axis-to-parent mapping) where beep has `EvidenceSpan` with `startChar`/`endChar`/`quote` and a width check |
| **RAPTOR's provenance story** | The paper never evaluates provenance and reports 4% summary hallucination (a fabricated *relation*). beep's verbatim firewall (`docs/product/citation-grounding.md:34-53` — *"Normalization may locate; it may not speak for the source"*) dominates it |
| **Benchmark hygiene** (RAPTOR Appendix H) | Pre-empted by `explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md:60-66` — "Do not use KF1, perplexity, or overlap as an acceptance gate." Corroboration, not a gap |
| **Near-duplicate corpus filtering** (cc-19) | `@beep/nlp-processing` cosine + Tversky, the wink driver, `goals/dedup-clone-engine`, and dedup already routed as a separate concern in the fusion SPEC's Non-Goals |

### Challenge-refuted claims (belong here, not in Tier 1)

- **`ingestion:gai-10` — PDF glyph joining.** Mapped at value 5. **Refuted.** See §6.
- **The "self-stamping eval" refutation (val=2)** is an artifact of the id-collision bug — the
  challenger was handed the proof-territory `gai-10` body under an agent-surface title. Disregard the
  row; the underlying `proof:gai-10` finding (instrument never hashes its own source) stands and is
  routed to Tier 2.

---

## 6. Do not copy

### The PDF-join item is a would-be regression — call it out loudly

`ingestion:gai-10` was mapped as **gap, value 5, "verbatim-portable"**: port Graphnosis's
`joinPdfItems` (position-relative gap `gap > fontSize * 0.2` from `|item.transform[3]|`, then NFC
**after** the join) into `@beep/doc-text`, at the cost of a `DOC_TEXT_ENGINE_VERSION` bump that
invalidates every stored `SourceTextIdentity`.

**The challenge pass refuted it: layer-attribution error.** The proof read unpdf's *outermost
wrapper* (`node_modules/unpdf/dist/index.mjs:394` — a plain `.map(item => item.str + …).join("")`)
and concluded position-relative spacing was absent. Both halves already exist in beep's stack below
that wrapper. Verdict: `already-have`, value 1. **Implementing the recommendation would be a net
regression** — you would replace a working extraction path with a hand-rolled one, *and* pay a
`DOC_TEXT_ENGINE_VERSION` bump that by design fails `verifyTextAnchor` with `stale-source` on every
already-anchored document (`VerifiedTextAnchor.ts:355-357`). Do not do this. If anyone revisits it,
the required first step is reading unpdf's actual `getTextContent` path and pdfjs's item-spacing
behaviour, not the wrapper.

### Antipatterns from the donor

| do not copy | why |
|---|---|
| **Confidence reinforced by access** (wp-14, `w_{n+1} = min(c, w_n + 0.03)`) | The donor's own SPEC §6 concedes: *"`accessCount` is mutable state inside an otherwise declarative file… two files with identical content can rank differently."* For a legal product that is disqualifying — two identical office actions must not rank differently because one was opened more often. Confidence here is a property of the evidence and the detector, not of usage history. **Marked `gap` for accuracy; the correct action is to keep the gap.** Record as a rejected option so nobody proposes it again |
| **`decayConfidence()` / age-based decay** | Keyed on `lastAccessedAt` that nothing refreshed, so it measured *age*, not disuse; compounding on a six-hour scheduler drove nodes to the 0.1 floor within a day and suppressed them in retrieval. Off by default in the donor for that reason. Chronocept's Table 11 independently prices exponential decay-from-t=0 worst by 4–10× RMSE across all six scenarios — the cited reason to leave this function behind rather than port and tune it |
| **A read path that mutates its subject** (wp-15) | The donor's `generateAuditReport` reached the decay path, so producing an audit mutated the data it audits. Keep as a **review heuristic**, not a lint — beep has legitimate write-ahead read paths (`GovernedTierGate` seals an `ExecutionDecisionRecord` *before* returning the verdict) and the false-positive rate would be high. The generalizable schema-review question is "what refreshes this field?" |
| **Ambient env as a scoring switch** (wp-04) | `traverser.ts:208-210` still carries `process.env.GNOSIS_SCORE_RULE` as a fallback in v0.11.0. The whole +6.0 arm is now identified by its *outcome* (56.20% vs 62.20%) rather than by recorded provenance, because the run captured argv and not the env var. beep's Config/Context.Service discipline makes this structurally impossible in domain slices — keep it that way |
| **Chronocept as evidence for anything quantitative** | Test splits of 129 and 55, single runs, no seeds, no CIs; best R² = 0.1298; linear regression **worse** than the mean predictor; distribution-family selection is 4 free parameters fit to 5 hand-drawn points with no held-out data and no AIC/BIC; the BERT row is internally inconsistent (MSE 145.86 with R² −0.0090 where every other row satisfies R² = 1 − MSE exactly — a probable target-normalization bug reported as a finding). Discard the "fine-tuned BERTs do not outperform simpler architectures" narrative outright. Also: baseline code has **no printed license** ⇒ reference-only under the repo's own rule; and the eight-axis taxonomy is **Ning et al. 2018**, not Chronocept — cite correctly |
| **Chronocept's corpus for calibration** | Temporal center of mass ≈ 1.4–2.9 hours after publication (BI ξ=54.28 → ~176 min; BII ξ=46.15 → ~81 min), on GPT-o1-generated present-tense sentences about coffee and website outages, with undergraduate freehand intuition as ground truth. Legal validity horizons are prosecution cycles. **Say this loudly**, because the log axis and the parameter table look superficially reusable |
| **RAPTOR's UMAP + GMM + BIC clustering** | Priced at **0.8 points** by the authors' own Table 9 (56.6 vs 55.8), and it is what destroys incrementality — a global fit makes *every document insert* a full rebuild trigger. Disqualifying for a live matter corpus. The expensive part buys almost nothing |
| **RAPTOR summary nodes in the candidate pool** | Structurally inadmissible today and correctly so: `TextChunk.span` is mandatory, and a derived non-contiguous node cannot carry a `VerifiedTextAnchor`. The repo already rejected the graph analogue once (`04-ontology-informed-extraction.md:49`, "community summaries as legal fact authority — verdict: reject") |
| **`GRAPHNOSIS_MCP_ROOT` + four copies of `expandPath`** | A path-resolution helper duplicated per tool is how the root check gets lost. If any beep MCP tool ever takes a model-supplied filesystem path, one shared resolver in `@beep/mcp-kit` |
| **`buildGraphPrompt` injecting an English-only benchmark rubric into every caller's prompt** | Benchmark-tuned corpus-specific heuristics must not live in the default code path of a general capability. Directly relevant: the query curriculum (Tier 2) must be **stated as engine facts**, not baked as silent query rewriting; and the `_gold-intake` mojibake-repair table must stay a domain artifact |
| **Giki's `getTopicRelationships`** | Unused `topic` parameter, O(pages × graph) with three full scans per page, dedup applied in only one branch so the footer double-counts. Take the *idea* (`ingestion:gai-12`), not the code |
| **The L1/L2/L3 conformance ladder** | Levels invite shaming, which §8.3 then had to defend against. beep's seven-independent-verdicts lattice is the better shape |
| **A second wire format alongside `FieldTier`** | Extend the existing envelope with an edges section rather than minting a parallel serializer, so the byte budget stays one mechanism — and only once a graph channel exists and evidence shows the model needs the edges. The donor's +13.2 attribution bundles the whole traversal, not the serialization |

### Statistical claims to quarantine, not quote

The whitepaper and trained-skills paper are unusually honest, and that honesty is itself a finding —
but three specific numbers should never enter a beep SPEC as targets: the **100% on the 71-pair
contradiction set** (regression coverage on a set that co-evolved with the rules), the **77.8%
model-authored figure** (post-hoc category-level tuning; a recall envelope, not completeness), and
the **~99.6% adaptive routing saving** (achieved precisely by routing reasoning and writing steps to
local models, which the same paper's E6 finds collapse to 0% on those capabilities).

---

## 7. Packet routing table

Effort: S = hours to a day, M = days, L = a phase, XL = a packet of its own.

### Tier 1

| item | landing packet | status | value | effort |
|---|---|---|---|---|
| T1-1 provenance-keyed `Order` for ranked ties | `goals/hybrid-retrieval-fusion-core` | partial | 5 | M |
| T1-2 minting process cannot raise its own ceiling | `explorations/agent-governance-control-plane` | partial | 5 | S |
| T1-3 declared loop caps + recorded stop reasons | `goals/knowledge-surface-automation` | partial | 5 | S |
| T1-4 skill-adherence measurement | `goals/coding-agent-effectiveness-evidence-loop` | partial | 5 | M |
| T1-5 `blocksReadmission` — retirement reason gates re-ingest | `explorations/epistemic-belief-view-revision` | partial | 5 | M |
| T1-6 enumerate content exits, one liveness predicate | `goals/ingestion-secret-scrub` | partial | 5 | M |
| T1-7 ordered authority ceiling, min-composed, absent = most restrictive | `explorations/agent-governance-control-plane` | partial | 4 | M |
| T1-8 non-vacuity: law scanners assert their own match | `explorations/graphnosis-prior-art` → repo law | partial | 5 | M |
| T1-9 aggregation-vs-lookup + source floor as membership | `explorations/rag-retrieval-projection` | partial | 5 | M |
| T1-10 structural nodes conduct, do not occupy (+ ts-24 block propagation) | `explorations/rag-retrieval-projection` | gap | 5 | M |
| T1-11 `(node, hop)` dominance under a hop budget | `explorations/rag-retrieval-projection` | gap | 5 | M |
| T1-12a guarded max write (wp-03) | `explorations/rag-retrieval-projection` | gap | 4 | S |
| T1-12b ranking is a pure function of `(corpus, query)` (wp-13) | `goals/hybrid-retrieval-fusion-core` | partial | 4 | S |
| T1-13 deterministic model-free contradiction detection | `NEW:epistemic-contradiction-detection` | gap | 4 | M |
| T1-14 determinism tier on the tool contract | `goals/practice-kg-mcp` + `@beep/mcp-kit` | partial | 4 | M |
| T1-15 confidentiality disclaimer where the belief forms | `goals/practice-kg-mcp` | gap | 5 | M |

### Tier 2 (abbreviated — full detail in §3)

| item | landing packet | status | value | effort |
|---|---|---|---|---|
| R2 derived-candidate exclusion as Non-Goal | `goals/hybrid-retrieval-fusion-core` | partial | 3 | S |
| R5 ablation arms as typed options | `goals/hybrid-retrieval-fusion-core` | already-have (mechanism) | 3 | S |
| `agent-surface:gai-05` boolean disclosure obligation | `goals/hybrid-retrieval-fusion-core` | partial | 4 | S |
| `agent-surface:gai-03` query curriculum | `goals/hybrid-retrieval-fusion-core` | partial | 5 | M |
| `retrieval:gai-14` golden-vector comparison key | `goals/hybrid-retrieval-fusion-core` | partial | 3 | S |
| `graph-model:gai-05` bound from the proof, not the writer | `goals/hybrid-retrieval-fusion-core` | partial | 3 | S |
| R7/wp-05 corpus-derived synonym expansion | `explorations/rag-retrieval-projection` | gap | 3 | M |
| `graph-model:gai-08` re-ingest dedup key excludes order | `explorations/rag-retrieval-projection` | gap | 4 | M |
| `retrieval:gai-05` conduction + testable redundancy | `explorations/rag-retrieval-projection` | partial | 4 | M |
| `ingestion:gai-01` length floor only for split text | `explorations/rag-retrieval-projection` | partial | 3 | S |
| `ingestion:gai-08` multilingual lexical recall | `explorations/rag-retrieval-projection` | partial | 3 | M |
| `graph-model:gai-09` cross-generation edges / reach metric | `explorations/rag-retrieval-projection` | gap | 3 | M |
| wp-18/wp-20 seeded offline ablation harness shape | `explorations/rag-retrieval-projection` | partial | 3 | M |
| cc-04 MATRES modality axis (cite Ning 2018) | `explorations/epistemic-belief-view-revision` | gap | 4 | M |
| cc-05 modality is a soft prior, never a gate | `explorations/epistemic-belief-view-revision` | partial | 3 | S |
| `retrieval:gai-03` third temporal axis (ranking vs membership) | `explorations/epistemic-belief-view-revision` | partial | 4 | S |
| `retrieval:gai-04` which property gets the wall-clock default | `goals/epistemic-claim-lifecycle-gate` | partial | 4 | S |
| wp-09 conflict character vs disposition | `explorations/epistemic-belief-view-revision` | partial | 4 | M |
| `epistemics:gai-05` reweight primitive + read-back receipt | `explorations/agent-memory-tiers-bitemporal-edges` | partial | 4 | M |
| `epistemics:gai-07` preview-before-forget, same code path | `explorations/agent-memory-tiers-bitemporal-edges` | partial | 4 | M |
| `epistemics:gai-10` decay's causal trap | `explorations/agent-memory-tiers-bitemporal-edges` | partial | 4 | S |
| `ingestion:gai-03` originate vs corroborate per source | `explorations/agent-memory-tiers-bitemporal-edges` | partial | 4 | M |
| `ingestion:gai-07` summary nodes at a distinct level | `explorations/agent-memory-tiers-bitemporal-edges` | partial | 4 | L |
| ts-04 completion oracle | `goals/agentic-professional-runtime` | gap | 4 | S |
| ts-08 tagged step union + authored-cap bit | `goals/agentic-professional-runtime` | gap | 4 | M |
| ts-03 total goal-contract record | `goals/agentic-professional-runtime` | gap | 3 | M |
| ts-10 walk-time recall binding | `goals/agentic-professional-runtime` | partial | 4 | M |
| `agent-surface:gai-07` never report absence as proof of absence | `goals/agentic-professional-runtime` | partial | 4 | L |
| ts-23 content-sensitivity lock at the egress boundary | `goals/agentic-professional-runtime` | gap | 5 | L |
| ts-21 conjunctive unattended gate | `goals/agentic-professional-runtime` | partial | 4 | L |
| ts-12 claim-level knowledge staleness loop | `goals/knowledge-surface-automation` | partial | 5 | L |
| ts-30 skill-vs-skill overlap report | `goals/knowledge-surface-automation` | partial | 3 | M |
| ts-29 untrusted ingress / promotion | `goals/knowledge-surface-automation` | partial | 3 | M |
| ts-17 generated trigger index | `goals/knowledge-surface-automation` | partial | 2 | M |
| `proof:gai-08`/wp-17 run-level provenance grade | `goals/coding-agent-effectiveness-evidence-loop` | partial | 4 | S |
| `proof:gai-07` self-verifying bundle that gates | `goals/coding-agent-effectiveness-evidence-loop` | partial | 4 | M |
| `proof:gai-10` instrument self-identification + self-test | `goals/coding-agent-effectiveness-evidence-loop` | partial | 4 | M |
| cc-12 metric independence + baseline/spread on lift claims | `goals/coding-agent-effectiveness-evidence-loop` | partial | 3 | S |
| cc-13 shuffle-vs-remove ablation pair | `goals/coding-agent-effectiveness-evidence-loop` | partial | 3 | S |
| ts-16 prompt-prefix token accounting | `goals/coding-agent-effectiveness-evidence-loop` | already-have (mechanism) | 3 | S |
| `retrieval:gai-13`/wp-06 role-partitioned rendering | `goals/practice-kg-mcp` | partial | 4 | M |
| `agent-surface:gai-04` escalation in the tool description | `goals/practice-kg-mcp` | partial | 4 | S |
| `agent-surface:gai-06` row-tag grammar + section order | `goals/practice-kg-mcp` | partial | 3 | S |
| ts-27 route mechanical local, judgment cloud | `explorations/multi-provider-llm-dispatch-fallback` | n/a (decision input) | 4 | S |
| ts-22 infeasibility as a value + total selection order | `explorations/multi-provider-llm-dispatch-fallback` | partial | 3 | L |
| `ingestion:gai-05` LLM cache key mixes prompt version | `explorations/multi-provider-llm-dispatch-fallback` | partial | 4 | M |
| `retrieval:gai-09` HashMap iteration-order audit (26 sites) | `explorations/graphnosis-prior-art` → lint rule | partial | 4 | M |
| `gai-format:gai-03` action-axis error class, version-skew carved out | `explorations/effect-orchestration-patterns` | partial | 5 | M |
| `gai-format:gai-ap-invariant-door` EdgeVersion invariants only in SQL | `explorations/domain-layer-hardening` | partial | 4 | M |
| `craft:gcr-07` required-field break class | `goals/domain-kernel-hardening` | gap | 4 | S |
| `retrieval:gai-10` env fingerprint on ratchet baselines | `goals/quality-gate-ratchets` | partial | 3 | S |
| `proof:gai-06` fixture id-space disjointness | `goals/recorded-qa-acceptance` | partial | 4 | M |
| `craft:gcr-05` priced changesets | `explorations/compound-engineering` | partial | 4 | S |
| `epistemics:gai-14` guard-neutralisation testing | `explorations/compound-engineering` | partial | 4 | M |
| `gai-format:gai-06` analyzer identity at the retrieval layer | `explorations/model-artifact-admission` | partial | 4 | M |
| `ingestion:gai-12` LLM-free citation-bearing topic pages | `explorations/knowledge-workspace` | gap | 4 | L |
| `gai-format:gai-10` injected build instant + positional ids | `explorations/identity-as-iri` | partial | 4 | M |
| `ingestion:gai-09` resource-exhaustion lane / AbortSignal | `goals/legal-document-intake` | partial | 4 | M |
| `agent-surface:gai-13` published no-egress falsification procedure | `explorations/ingestion-security-secret-governance` | partial | 4 | M |
| `proof:gai-12` deliberately-malformed conformance fixtures | `explorations/docx-roundtrip-interop` | partial | 3 | M |
| ts-26 workflow-engine as the resumption owner | `goals/effect-v4-workflow-engine-spike` | partial | 3 | L |
| `proof:gai-14` CI runs the release chain; irreversible gate last | `goals/one-round-loop` | partial | 3 | S |
| wp-19 declared union vs emitted census | `goals/fallow-zero-dead-code` | gap | 2 | L |
| `gai-format:gai-01/02` envelope family + must-understand tags | `NEW:versioned-artifact-envelope-contract` | partial | 4 | M |
| `ingestion:gai-13` edge-dense public demo corpus | `NEW:public-demo-corpus-suite` | gap | 3 | L |
| `graph-model:anti-06` agent-guide law drift gate | `NEW:agent-guide-law-drift-gate` | partial | 2 | M |
| cc-03 annotate `Confidence` as ordinal, not calibrated | `goals/citation-verified-span-substrate` | partial | 3 | S |
| cc-17 report end-to-end once a real detector feeds triage | `explorations/graphnosis-prior-art` | partial | 3 | S |
| cc-18 fill the SOURCES ledger (license = reference-only) | `explorations/graphnosis-prior-art` | partial | 3 | S |

---

## 8. Open questions for an align stage

Each is branch-closing. Recommended answer stated.

**Q1 — Does `explorations/graphnosis-prior-art` graduate as one packet, or dissolve into SPEC
amendments on existing packets?**
*Recommended: dissolve, mostly.* 63 of the ~80 routed items land on packets that already exist and
are already asking the question. The exploration's own deliverable should be (a) the filled
`SOURCES.md` with the port-with-attribution disposition, (b) a `DECISIONS.md` recording the six
rejected options in §6 so nobody re-proposes them, and (c) exactly two graduations:
`epistemic-contradiction-detection` (T1-13) and the repo-law bundle (T1-2, T1-3, T1-8).

**Q2 — Do we accept `Order.Order` over `(locator, startChar, textDigest)` as the repo's canonical
ranked-tie comparator, or key on `EntityId`?**
*Recommended: provenance.* Entity ids are stable *within* a database and not across a rebuild, and
beep rebuilds — `oppold-corpus-refresh`, `PracticeKg` bundle regeneration. The provenance triple is
recomputed identically from the same input. Field-at-a-time, never concatenated.

**Q3 — Does the authority ceiling live on the artifact, or stay session-scoped?**
*Recommended: both, with the artifact ceiling able only to LOWER.* The session model is shipped and
sound and must not be weakened — `GrantSet`'s soundness argument is that grants derive only from
session-static inputs. An artifact-carried ceiling that can only reduce the frozen set preserves
that argument exactly while making a borrowed procedure safe to point at an arbitrary upstream.

**Q4 — Is `blocksReadmission` a belief-view policy, or an ingest-path check?**
*Recommended: a belief-view policy the ingest path consults.* Putting it in the ingest path would
make ingestion depend on adjudication state and invite the read-path-mutates-its-subject class
(wp-15). A named predicate in the selection policy, called by ingest, keeps the authority boundary
where `goals/epistemic-bitemporal-edge-core` put it.

**Q5 — Does a content-sensitivity classifier belong in a planner or at the egress boundary?**
*Recommended: the egress boundary, unambiguously.* The paper discloses both failures of the planner
placement: no taint propagation (a per-step lock does not survive a variable carrying derived
content into a later cloud call), and the lock silently never engaged because one call path did not
pass the tier map. `GovernedTierGate` is already the one boundary every path crosses, fail-closed and
write-ahead. Scope to a coarse binary first; content classification is genuinely hard.

**Q6 — Do we add a `DeterminismTier` before or after a golden-vector mechanism exists?**
*Recommended: after, or simultaneously.* The donor never shipped it, so there is no field evidence
it helps a calling model, and a `deterministic` label with nothing proving it is decorative metadata
that will be trusted. Gate the tier's admission on a golden-vector test — which also closes
`retrieval:gai-14`.

**Q7 — Does the fusion core get an `aggregation` vs `lookup` intent now, or after calibration?**
*Recommended: now, as a typed input with the floor defaulting off.* The intent is a schema
decision; the floor's threshold is a calibration decision. Splitting them lets the SPEC land the
first without blocking on the second, and the malpractice-shaped failure (a confidently-wrong count
on a docketing question) is a product requirement, not a tuning preference.

**Q8 — Does the skills library get an adherence instrument before or after the loop caps?**
*Recommended: caps first (T1-3, effort S), adherence second (T1-4, effort M).* A stop reason is a
prerequisite for adherence measurement — you cannot ask "did it follow the steps" of a loop that
does not record why it stopped.

**Q9 — Does MATRES modality land on `epistemic-belief-view-revision` or on the contradiction
detector?**
*Recommended: belief-view revision, as a vocabulary; the detector consumes it.*
`goals/epistemic-contradiction-triage/SPEC.md:139` makes adding detection heuristics a
stop-and-re-scope condition, and the belief-view packet has a named-and-empty "semantic stance"
verdict family waiting for exactly this. The classifier that assigns the label is a separate,
later, expensive decision.

**Q10 — Do we open `versioned-artifact-envelope-contract` as a packet, or write one standards
paragraph?**
*Recommended: one standards paragraph first.* 40+ `<family>/vN` ids and three breaks already spent
justify a doctrine; they do not yet justify a capability. The paragraph: unknown or absent version
fails closed and is reported **as skew, not as corruption**; extension is additive with a
must-understand list; a break must name its admissible reason. If the paragraph is repeatedly
violated, that is the evidence for the packet.

---

## 9. Where this document is thin

Stated plainly, per the proof-over-assertion rule.

- **The `craft` territory** is the weakest input. Its findings are documentation and process norms
  where beep is mostly already ahead (`gcr-03`, `gcr-06`, `gcr-14a`) or where the gap is coverage
  rather than design (`gcr-09`). Only `gcr-08` and `gcr-07` earned real placement.
- **The `gai-format` territory** maps a binary container format onto a repo that owns none
  (`rg 'timingSafeEqual|createHmac|hmac'` → zero hits). Everything there is analogy onto versioned
  JSON envelopes, which weakens the evidence even where the reasoning is good.
- **The challenge phase is unusable as a vote.** Only two of its eleven rows are safely
  attributable: the PDF-join refutation and the 8/641 non-vacuity re-verification. Everything else
  should be re-run with namespaced ids before anyone cites it.
- **No item in Tier 1 has been cost-estimated against a real branch.** The S/M/L labels are the
  miners', carried forward. T1-4 (skill adherence) and T1-13 (detector) are the two most likely to be
  underestimated.
- **RAPTOR contributed almost nothing actionable** — one Non-Goal wording change (R2) and a
  do-not-build verdict on its clustering pipeline. That is a real result, but it means the four-source
  framing is really a two-and-a-half-source result: Graphnosis code + Graphnosis papers carry ~90% of
  the value, Chronocept carries one borrowed taxonomy and three anti-adoption citations, RAPTOR
  carries one sentence.
