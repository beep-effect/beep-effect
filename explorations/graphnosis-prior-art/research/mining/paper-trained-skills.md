# Mining note — "Borrowable Skills as Lean Un-Ganglia Subgraphs"

**Source PDF:** `/home/elpresidank/YeeBois/projects/beep-effect15/explorations/graphnosis-prior-art/assets/graphnosis-trained-skills.pdf` (55 pages, read in full: 1–18, 19–37, 38–55)
**Author:** Nelu Lazar, Nehloo Interactive LLC / Nehloo Foundation. ORCID 0009-0008-5548-4109. Preprint, DOI 10.5281/zenodo.21205599.
**Companion paper:** *The Un-Brain: A local-first, indelible knowledge multi-graph for private AI memory with deterministic, owner-adjudicated contradiction handling*, DOI 10.5281/zenodo.20843387 (this is the other PDF in the assets dir, `graphnosis-whitepaper.pdf`).
**Title in full:** "Borrowable Skills as Lean Un-Ganglia Subgraphs: trainable, composable, bounded-loop standard operating procedures in a co-located, owner-held, indelible knowledge multi-graph"
**Licensing:** paper text/figures CC-BY-4.0. SDK Apache-2.0. The **skill-training pipeline and signed `.gsk` export are a paid feature** gated by an Ed25519-signed license token. Storing skills, importing packs, exporting skills in any text format, and walking already-trained skills do NOT require it.

---

## 0. Where the code actually lives (repo check — do this first)

This is the single most important structural fact for anyone porting ideas: **almost nothing in this paper is in the Apache-2.0 SDK.**

The paper says so itself (p8):

> "One boundary is worth stating plainly, because it separates this paper from its companion. The *substrate* — generic nodes, typed edges, op-log, encryption — is the SDK (`@nehloo/graphnosis`); the entire *skill layer* — training, walking, routing, vitality, dispatch, packaging — is the application sidecar (`apps/desktop-sidecar`)."

Repo verification at `/home/elpresidank/YeeBois/dev/Graphnosis`:

| Paper mechanism | Repo status |
|---|---|
| `NodeType` has no `skill` member (Prop. 1) | **CONFIRMED** — `src/core/types.ts:16` enumerates `fact, concept, entity, event, definition, claim, data-point, section, document, person, organization, preference, conversation, message, image, video, transcript, visual-description, session-summary`. No `skill`. |
| `DirectedEdgeType` has no `skill` member (Prop. 1) | **CONFIRMED** — `src/core/types.ts:79` enumerates `causes, depends-on, precedes, contains, defines, cites, contradicts, supports, supersedes, discussed-in, knows, works-with, reports-to, collaborated-on, prefers, summarizes`. All four target types the skill classes map onto (`precedes`, `depends-on`, `supports`, `contains`) exist. No `skill`. |
| `evidence` string on directed edges (the carrier of all skill semantics) | **IMPLEMENTED** — `src/core/types.ts:117` `evidence?: string` on `DirectedEdge` (interface at `:111`). |
| `role:` held in `node.source.section` | **PLAUSIBLE CARRIER EXISTS** — `SourceReference` at `src/core/types.ts:43`, `section?: string` at `:47`. No skill-role writer in the SDK. |
| `maxAutonomy` node metadata field (SPEC §8.2) | **NOT IMPLEMENTED** — zero hits for `maxAutonomy` / `dispatch-safe` / `autonomy` anywhere in `src/`. `ROADMAP.md:47`: *"**v2 is proposed in `SPEC.md` §8 and nothing in it is implemented.**"* The metadata carrier does exist (`metadata: Record<string, string \| number>` at `src/core/types.ts:57`), so the field would fit without a schema change. |
| Skill subgraph convention (SPEC §8.4) | **NOT IMPLEMENTED** — same ROADMAP line. §8.4 is a *normative read/transport* spec only; it explicitly excludes authoring/training. |
| 12 MCP skill tools (`train_skill`, `walk_skill`, `walk_skill_structured`, …) | **NOT IMPLEMENTED IN SDK** — `src/mcp/tools/` contains only `export.ts, ingest_files.ts, load_graph.ts, query.ts, update_graph.ts`; `src/mcp/server.ts` registers 5 tools. `rg 'train_skill\|walk_skill\|SkillExecutionPlan'` over non-markdown files: **zero hits**. They're documented in `GRAPHNOSIS.md:126–166` as sidecar tools. |
| `skill-trainer.ts`, `agent-walker.ts`, `model-router.ts`, `gsk-format.ts`, `skill-call-links.ts` … (§14 file map) | **NOT IN THIS REPO** — sidecar only. |
| `blockedEvidencePrefixes` — the one SDK-side accommodation for skills | **IMPLEMENTED** — `src/core/query/traverser.ts:108` (declared), `:183` (consumed), `src/core/query/query-engine.ts:73`, `:385`. |

The `blockedEvidencePrefixes` comment (`traverser.ts:97–107`) is the best piece of actual engineering the SDK exposes about skills, and it names a real failure mode:

> "The motivating case is trained skills. A skill is a chain of step nodes joined by `precedes` edges tagged `skill:seq`. Those nodes live in the same lexical index as ordinary knowledge, so a factual query can seed into one step by vocabulary overlap — and then unroll the ENTIRE procedure into a budget meant for facts. The harm is the chain, not the node: one relevant step surfacing is the cortex working.
>
> So this blocks propagation, never membership. A skill node reached as a seed still scores and still appears; traversal simply does not walk the procedure behind it. Callers that WANT the procedure (skill dispatch, walk) leave this unset."

And `query-engine.ts:70–73` states the layering law:

> "Left unset here on purpose: the SDK is generic and has no opinion about what an evidence namespace means. The host that OWNS a namespace — the app, for `'skill:'` — sets it at its own retrieval boundary."

**Discrepancy worth flagging.** `GRAPHNOSIS.md:161–162` documents `skill_vitality` as *"per-skill 0–100 health (staleness, anchor coverage, goal completeness, structure resolution)"*. The paper's §6 formula has **no** goal-completeness or structure-resolution term, and §11 explicitly flags "Narrow vitality: Per-skill vitality scores age, supersession, and cited-node drift only; it does not reward goal completeness or structural resolution." Either the repo doc is stale or the shipped scorer changed. Do not treat GRAPHNOSIS.md as the vitality contract.

---

## 1. The thesis, and the honest scope of the claim

One sentence (§17): **"a procedure belongs where memory lives."**

The two failure modes the paper is built against (§1):
1. **Decay by assumption** — "a procedure encodes facts ('recall from the `investors` engram', 'the smoke test lives at this path') that drift out from under it, and nothing notices."
2. **Separation from memory** — "the procedure lives in one store and the facts it depends on live in another, so the procedure can neither be versioned with them, encrypted with them, nor checked against them."

The claimed contribution is explicitly a **synthesis, not a first** (§1, §12). The conjunction:

> "SOPs as typed-edge subgraphs + per-step capability routing + function-like sub-skill calls + bounded loops + walk-time recall bindings + a vitality-driven retrain loop, all in the same indelible, encrypted, owner-held graph that stores declarative memory."

The headline **measured** property is *not* portability — it's **intra-cortex borrowability**: one agent calling a sibling agent's single skill instead of spawning the sibling agent. Cross-owner portability follows "by construction" from the empty-engram invariant but is **scoped as future work** and never evaluated (§1.1, §13).

---

## 2. What a "trained skill" IS as a data structure

### 2.1 Definition 1 (Skill subgraph), verbatim (p8)

> "A trained Skill is a title hub node, a set of typed goal nodes partitioned over eight categories — *Trigger, Prerequisites, Requires, Produces, Success, Out of scope, On failure, On completion* — an ordered body of step nodes, and an edge set drawn from five evidence-tagged control-flow classes — `skill:seq`, `skill:loop`, `skill:branch`, `skill:ctx`, `skill:calls` — over those nodes, with the goal nodes attached to the hub by `skill:goal` contains-edges. The procedure *is* this subgraph, by construction rather than by interpretation."

**Key framing repeated throughout:** "The procedure is not *described by* the subgraph; it *is* the subgraph." And: "There is no separate skill data type."

### 2.2 Node roles and presentation order (§3, p9)

Each node carries a **`role:`** which lives in the node's **`source.section`** field (not in a type enum):

`metadata` · `title` · one of eight `goal-*` roles · `body` · `recipe` (a body step that is a recall recipe) · `recalled-memory`

> "Training inserts them in a fixed, presentational order — metadata comment, title, inline goals, the eight structured goals, body steps, then any trailing `recalled-memory` — and **the structure is recoverable from node order and role alone, independent of edge state**."

That last clause is load-bearing: it is what makes Theorem 1 (plan compilation from storage order, never edge traversal) possible.

### 2.3 The five edge classes — TABLE, transcribed verbatim (p9)

| Class | SDK edge | Weight | Meaning |
|---|---|---|---|
| `skill:seq` | `precedes` | 0.90 | do step *n*, then *n+1* — the canonical chain |
| `skill:loop` | `precedes` | 0.70 | a bounded back-edge to an earlier step, carrying `;max=N` |
| `skill:branch` | `depends-on` | 0.75 | a conditional forward skip |
| `skill:ctx` | `supports` | 0.60 | a recalled-memory node bound to the step it informs |
| `skill:calls` | `contains` | 0.95 | a sub-skill invocation, carrying `;args=…;capture=…;onFailure=…;parallel=…` |

Plus a sixth, stated in Definition 1 and Proposition 1 but omitted from the table: **`skill:goal` → `contains`, weight 0.85**, attaching each goal node to the title hub.

Because the substrate permits several typed edges in parallel between the same node pair (multiple `skill:*` relations, or a `skill:*` edge alongside a memory `contains` edge), it is a **multi-graph in the strict sense**, not a simple graph (§2).

### 2.4 Proposition 1 (Zero-primitive procedural extension), verbatim (p7)

> "The skill layer adds no member to the SDK's `NodeType` enumeration and no member to its `DirectedEdgeType` enumeration: SkillNodeTypes ⊆ NodeType and SkillEdgeTypes ⊆ DirectedEdgeType, where both right-hand sets are the substrate's pre-existing enums. All skill semantics are carried by (i) each node's `role` and (ii) the optional `evidence` string on otherwise-generic directed edges; the procedural layer is thus a labeling discipline over the unchanged memory-graph schema — there is no new graph engine."

Rated by the author as "(Verifiable by inspection of the enums and the §3 mapping table, not a deep result; this is the formal anchor of the 'not a workflow engine' defense, §12.)" — I verified it against the live SDK (see §0 above). It holds.

### 2.5 Three inheritances (§2, p7)

- **One key.** "A single derived data key encrypts the skill nodes, the encrypted per-snapshot history files, the cross-engram call side-table, and the resumable-run records — the same key that encrypts every declarative memory in the cortex; there is no separate skill keystore."
- **One op-log.** "Every skill-node insertion and reordering emits `addNode` / `reorderSource` events through the same append-only, signed operation log as memory writes; the log is an *audit and sync* channel, and recoverable state is reconstructed from the sources and snapshots, not by replaying the log."
- **One indelibility discipline.** "A retrain never hard-deletes: the prior live nodes are captured to an encrypted snapshot, then soft-deleted (`validUntil` set, confidence driven to zero) through the very correction pipeline memory uses for supersessions, and new nodes are inserted under the *same source id*. The worst case for a superseded skill node, exactly as for a memory, is reduced prominence, never erasure."

### 2.6 Figure 1 — Anatomy of a Skill as a subgraph (p8), transcribed

The example skill is `ship-workflow` (indigo title-hub, labeled "title-hub (skill)").

- 8 emerald goal nodes joined to the hub by `skill:goal` (contains) edges — left column: **Trigger, Prerequisites, Requires, Produces**; right column: **Success, Out of scope, On failure, On completion**. Both columns annotated "8 goal nodes (contains)".
- Blue ordered step chain via `skill:seq`: `1 · prepare → 2 · run tests → 3 · build → 4 · deploy → 5 · verify`.
- A `skill:loop ;max=4` back-edge from `5 · verify` up to `2 · run tests`.
- A dashed `skill:branch` forward skip from `2 · run tests` to `3 · build`'s vicinity (drawn as a forward skip arc).
- A dashed grey node "recalled engram / deploy runbook · v3" bound by `skill:ctx`.
- A `skill:calls` edge from `5 · verify` to a second title-hub `bug-investigation`.
- Figure legend line: "Established — SOPs with goals + steps · Graphnosis — the SOP encoded as a typed-edge subgraph over generic memory nodes".

### 2.7 Figure 2 — the five classes on a tiny step graph (p10), transcribed

Step graph A → B → C → D with `skill:seq` edges. A `skill:loop ;max=N` back-edge from D to B. A `skill:branch (skips C)` edge from B. A `skill:ctx` dashed edge from a "support engram" node to C. A `skill:calls ;args;capture` edge from D to a green node `bug-investigation (called skill)` — and critically, that call crosses an engram boundary, so it is drawn as routing through a dashed "encrypted side-table `skill-call-links.json.enc`".

Legend transcribed: `seq · precedes · 0.90` / `loop · precedes · 0.70 · ;max=N` / `branch · depends-on · 0.75` / `ctx · supports · 0.60` / `calls · contains · 0.95 · ;args;capture` / `dashed gray = recalled-context / cross-engram side-table`.

### 2.8 The step DSL (§3, p10) — the authoring surface

Control flow and bindings are authored **inline in step text** and parsed at training time:

| DSL token | Effect |
|---|---|
| `@loop: N max=M` (wiki form `[[loop: …]]`) | produces a `skill:loop` edge carrying its cap |
| `@branch: N` | produces a `skill:branch` edge |
| `@skill: name(arg=$var) -> $capture` | produces a `skill:calls` edge with structured argument and capture metadata. Bare `@skill: target-name` also works (GRAPHNOSIS.md:165–166) |
| `only_engrams=[…]` | on a recall step, binds it to specific engrams |
| `@needs <capability>` | per-step model-routing tag. **Does NOT become a graph edge** — parsed from the step's text at walk time |
| `@parallel:` | in the validated structural-token set; produces `parallel` sibling groups in the plan |
| `[ANCHOR]` lines | structural tokens the preservation validator lifts |
| Eight goal-header prefixes | parsed at training time, lifted out of the step body into a meta-header hung off the title hub |

The paper is careful about this (p10):

> "One distinction matters for the 'control flow as graph structure' claim. `@branch` and `@loop` *do* become graph edges; `@needs`, the per-step model-routing tag, does **not** — it is parsed from the step's text at walk time (§5) and never materialized as an edge. Routing metadata is therefore graph-*resident* (it lives in a node's text) but not graph-*topological*. We state this rather than overclaim that routing is encoded in edge structure."

Loop and branch references are "detected multilingually (the trainer ships keyword pattern sets for several languages)."

### 2.9 The one implementation reality: cross-engram calls are NOT edges (§3, p10)

> "An SDK directed edge joins two nodes within a single graph, so a `@skill:` call that targets a skill in a *different* engram cannot be a graph edge. Such cross-engram calls are resolved at training time and persisted in an encrypted side-table (`skill-call-links.json.enc`, under the same cortex key), which the walk consults; intra-engram calls remain ordinary `skill:calls` edges. We surface this as a constraint of reusing the substrate's strictly intra-graph edge model, not as a design we would otherwise have chosen."

This is the sharpest honest admission in the paper and the most important design lesson for a port: **a "one graph, procedures are subgraphs" story leaks the moment procedures need to cross graph boundaries.** The resolution is a keyed name→source-id side-table, resolved at *training* time (so resolution costs zero model tokens at walk time — this is what makes the borrow cheap), and stabilized by Invariant 3 (retrain reuses the source id).

### 2.10 Eight goal categories and their tags (§3, p8–9)

> "A Skill states its contract in eight typed goal nodes — Trigger, Prerequisites, Requires, Produces, Success, Out of scope, On failure, On completion — parsed from line prefixes at training time and lifted out of the step body into a meta-header hung off the title hub by `contains` edges (evidence `skill:goal`, weight 0.85). The categories are not decoration."

- **Requires / Produces** type the skill's inputs and outputs — "which is what lets calls bind arguments and capture returns (§5)".
- **Trigger** carries `[dispatch-safe: yes|partial|no]` — declares whether the skill is safe to auto-propose; read by the autonomy gate that caps proactive dispatch.
- **Success** carries `[verify: tool|state|human]` — a **completion oracle** "that tells an executor how to know it is done".
- **On failure** names the recovery skill to run if a step throws.

> "Goals deliberately hang off the title hub rather than joining the step chain, so recalling any single goal lets a traversal reach the title and, from there, the whole procedure."

---

## 3. Training: what "trained" means (§4)

**"Training" is not gradient learning and, in the shipping system, not memory fusion either. It is a deterministic *compile*."** Authored SOP text is parsed, chunked into the typed nodes of §3, and linked into the subgraph.

### 3.1 Invariant 1 (Empty-engram training), verbatim (p11)

> "Let body(K) be the node set of trained skill K's compiled body and cortex_personal the personal memory nodes. With train-time federated recall gated off (`ENABLE_CORTEX_RECALL_AT_TRAIN = false`), recall at training is scoped to an empty engram, so on the **default (no-recipe-binding) path** no automatically-recalled personal node content enters the body at the content level: no auto-recalled node of cortex_personal has its text occur in any node of body(K). On that same default path — absent hand-authored personal facts — body(K) is a pure function of K's authored source, and personal grounding occurs only at walk time through recall bindings (§5). A trained skill is therefore portable and source-grounded — shareable as a signed `.gsk` pack without leaking the cortex it was trained beside."

**Scope caveats stated in the invariant itself:**
- Does NOT cover the opt-in `bind_recipes` path, "which derives `only_engrams` recipes from cortex state — a query-plus-engram-name binding, not frozen content"
- Does NOT cover "hand-authored facts or sensitive engram names the author writes into the source, which remain the owner's to review before sharing"
- "So 'pure function of authored source' holds for training without recipe binding; 'no leakage' means no automatic frozen personal node content, not 'no authored or metadata leakage.'"

Secondary benefit worth noting: **legibility.** "It also keeps SOPs legible — a step reads 'recall the prior tier decisions,' not a frozen paste of last quarter's pricing."

### 3.2 Two modes, one structure contract

- **memory-augmented** (the default, no model in the loop): the compiled body IS the authored source verbatim, chunked and typed.
- **Pro path**: a *local* LLM may rewrite the prose for clarity — with no cortex recall and no fabricated "(from memory…)" attributions — gated by a structure validator.

### 3.3 Proposition 2 (Structure preservation), verbatim (p11)

> "Let tok(s) be the **set** of structural tokens of a skill source s — every `[ANCHOR]` line, every DSL token (`@skill:`, `@loop:`, `@branch:`, `@parallel:` and wiki forms), the routing tag `@needs`, the recall binding `only_engrams`, and all eight goal-header prefixes — and let r be an optional LLM rewrite. The saved skill is save(s) = r if tok(s) ⊆ tok(r), else s; hence tok(save(s)) ⊇ tok(s) always, so training can never silently drop an executable token, a routing tag, or a goal header."

**De-rated after review** — an unusually honest footnote:

> "(De-rated after review: the validator checks **set-presence** via deduplicated substring match, not per-step placement or count — so this guarantees no structural token is **entirely omitted**, not that each survives on its original step; a rewrite could relocate a token to a different step. Per-step ordered verification is future work. The rewrite is a detachable cosmetic overlay.)"

Model-free suite checks both branches (9/9).

### 3.4 Figure 3 — training as a structure-preserving compile (p12), transcribed

Flow: `authored skill text` → decision `useLlmRewrite?`
- **no** → `memory-augmented: verbatim compile` → `in-place save (trained skill engram)` (annotated "verbatim: no rewrite, gate bypassed")
- **yes** → `Pro: local-LLM rewrite` → `validateSopPreservation` (box contents: "anchors · DSL tokens / @needs · only_engrams / 8 goal headers / (structure-preservation gate)")
  - **pass** → `pass → keep rewrite (structure intact)` → in-place save
  - **fail** → `fail → revert to verbatim` → (dashed loop back, labeled "revert then save")
- Side box: `ENABLE_CORTEX_RECALL_AT_TRAIN = false` / "empty-engram contract: no recall at train time; no automatically-recalled personal content enters step bodies"

### 3.5 Saving is a re-compile

> "On every train or retrain the source is rebuilt from scratch — metadata comment, title, inline goals, the eight structured goals, body steps, trailing recalled-memory — after which all SOP edges are re-derived by the idempotent linkers of §3."

### 3.6 Dormant machinery — designed but gated off (§4, p12)

> "The training pipeline contains machinery for memory augmentation — a relevance floor, a self-tuning recall breadth, an 'influential nodes' ranking — that is *dormant* under the empty-engram invariant above. We describe it as designed-but-gated, not as a live self-tuning system, so as not to claim behavior the shipping configuration does not exhibit. If the gate were opened, recalled paragraphs would be appended as trailing `recalled-memory` nodes (never interleaved into the numbered procedure) under an explicit `_(from …)_` attribution; today they are not."

---

## 4. Execution: compiling and walking (§5)

Running a Skill is two steps: **compile the subgraph into an execution plan, then walk the plan.** The compile is a pure read.

### 4.1 Theorem 1 (Plan-compilation determinism), verbatim (p12–13)

> "Let a Skill K have ordered live body nodes ⟨n₁,…,n_m⟩ in storage order (soft-deleted nodes filtered) and edge overlay E(K). The compiler Π producing K's execution plan is a pure function of (nodes(K), E(K)): its step list is the index-ordered image ⟨n_i ↦ step i⟩, never an edge traversal, and loop/branch/call overlays are deterministic lookups keyed by node id. For a fixed graph state Π(K) is byte-identical across runs under its canonical serialization, and a `skill:loop` back-edge cannot drive Π into nonterminating recursion.
>
> Proof. Steps are built by mapping the body-node array to positions (step i is array index i), not by following edges; a back-edge n_j → n_i (j > i) is recorded only as a bounded annotation on step j and never re-enters the construction (Lemma 1 makes the edge set itself a pure function of node text and order). The serialized plan is asserted byte-equal to a stored fixture (7/7)."

Rated: "(De-rated: enforced by construction, golden-test-pinned. Scope: this is the *compile*; loop re-execution is an executor obligation — Theorem 2.)"

The design insight, stated explicitly:

> "Reconstructing the chain from storage order rather than edge traversal is the load-bearing choice: it is what lets `skill:loop` express a real back-edge in the *graph* while the *plan* stays a finite, ordered list with the loop recorded as a bounded annotation on a step."

### 4.2 The `SkillExecutionPlan` data shape (§5, p13; corroborated GRAPHNOSIS.md:136–143)

Two rendering surfaces from the same compiled walk:

- **`walk_skill`** → human-readable narrative: CONSTRAINTS and PROCEDURE prose with loop/branch/sub-skill annotations. GRAPHNOSIS.md gives the glyphs: **⟲ (loop) / ⤳ (branch) / ⊕ (sub-skill)**.
- **`walk_skill_structured`** → the machine contract, `SkillExecutionPlan`:

```
SkillExecutionPlan {
  requires[]           // with inline type hints (GRAPHNOSIS.md: `requiresTypes`)
  produces[]
  steps[]: {
    calls?             // sub-skill name
    args?              // bound arguments
    captureAs?         // named variable the child's return is captured under
    parallel?          // sibling skills to dispatch concurrently
    maxIterations?     // loop-convergence cap
    branchesTo?        // branch target
    loopsBackTo?       // loop target
    supportingContext? // recalled-context binding
    targetGraphId?     // (GRAPHNOSIS.md) cross-engram calls are flagged with this
  }[]
  failureHandlers[]    // top-level
}
```

> "An AI executor walks the steps in order, invokes sub-skills with the named arguments, captures their returns under the named variables, and routes exceptions to the matching handler."

### 4.3 Theorem 2 (Boundedness), verbatim (p13)

> "*This bounds any executor that honors the plan contract.* The shipped reference walker now honors the loop side of that contract in code — it re-executes loop bodies with each cap enforced by its scheduler, bounds uncapped loops with a default cap, and is regression-pinned by a model-free suite (§11) — so for capped-loop, non-parallel skills the bound is also a shipped-system guarantee; `parallel[]` dispatch remains an obligation on external executors. Let a Skill K have body steps with `skill:loop` back-edges each carrying a finite cap M_ℓ, forward-only `skill:branch` edges, sub-skill calls forming a tree of at most D = 3 executed levels (the executor returns early at recursion depth ≥ 3, so depths 0, 1, 2 execute), and at most one recovery sub-skill plus one retry per throwing step, where **a recovery sub-skill's own execution is a sub-skill call that occupies a depth level** — it descends the same D = 3 recursion ladder as any other call and is refused at depth ≥ 3. Then for any executor honoring the caps the number of step executions is **finite**: each capped back-edge fires at most M_ℓ times, recursion is hard-bounded at D = 3 executed levels (a recovery handler that itself invokes a further handler can only do so within that same depth budget, so mutual On failure* handlers cannot recurse without bound), branch edges are forward-only, and failure recovery adds at most one execution per step — a finite unrolling of a finite graph — hence every walk over a finite skill graph *whose loops are capped* halts. We claim **finiteness only, not a max-per-step bound**: with multiple or nested reachable loops the exact per-step execution count is executor-specific."

Scope: "the bound covers skills whose loops carry a finite cap — an uncapped `@loop` lies outside the contract bound, though the shipped walker bounds it too, with a default three-iteration cap. Termination is an obligation on any contract-honoring executor; the shipped reference walker enforces the depth-3 cap, single-pass recovery, and loop re-execution with in-code cap enforcement plus a hard per-walk execution backstop; `parallel[]` siblings remain undispatched — §11."

### 4.4 What the reference walker does and does not do (§5, p15) — verbatim, high value

> "The in-application walker executes the single-`calls` path, iterates steps in order, and *re-executes loop bodies*: a `loopsBackTo` edge re-enters its body up to the cap, which the walker's scheduler enforces in code — the authored `max=M`, else a default cap of three for an uncapped `@loop` — with an early exit when consecutive body outputs reach a fixed point and a hard per-walk execution backstop behind both. **Caps are lifetime budgets per edge within one walk** (an enclosing loop never resets an inner edge's budget), so every walk terminates by construction, and each walk reports its per-edge iterations, cap source, and stop reason for audit. **Reaching a cap is a normal, reported outcome** — the walk falls through and completes — in contrast to global-recursion-budget engines, where exhausting the budget raises an error and fails the run (the design contrast is drawn against LangGraph in §12). The one plan feature the walker still does not perform is `parallel[]` concurrency."

The LangGraph contrast in full (§12, p38):

> "LangGraph bounds a run with one *global* recursion budget authored in code (`GRAPH_RECURSION_LIMIT`, default 25 supersteps), and exceeding it raises `GraphRecursionError` — the run fails; the Skill Subgraph's cap is *per loop edge*, authored in the SOP text itself (`@loop: N max=M`), and reaching it is a normal, reported outcome — the walk falls through and completes, with per-edge iterations, cap source, and stop reason in the walk result, with the stopping decision (cap or deterministic fixed-point convergence) made by code, never by the model. LangGraph's cyclic graphs remain more *expressive* — arbitrary conditional cycles, code predicates — where the Skill Subgraph deliberately narrows to capped back-edges for provable termination. The authored-versus-defaulted cap distinction is load-bearing for §11: the unattended gate keys on whether a loop's bound was *authored* into the skill, a property a global runtime mod does not have."

### 4.5 Sub-skills compose like functions

> "A `@skill: name(args) -> $capture` step binds its arguments into the child walk and captures the child's output under the named variable for downstream steps; recursion is capped at depth three. Failure recovery is equally bounded: when a step throws and an *On failure* handler is present, exactly one recovery sub-skill runs and the step is retried exactly once — a fixed, runaway-free recovery."

### 4.6 Resumable runs

> "Because captured variables normally live only for one conversation, a multi-skill walk can persist its state — captured variables and the last completed step — to an encrypted run record and resume in a later session from the next step. Long procedures therefore survive a closed laptop."

Tools: `save_skill_run` (returns a `runId`; omit to start new, pass back to update) / `resume_skill_run` (reloads captured vars, last completed step, `nextStepIndex`).

---

## 5. Per-step model routing (§5) — the `@needs` mechanism

### 5.1 Definition 2 (Per-step routing selection), verbatim (p14)

> "For a step s with declared capability set needs(s) and active model catalog 𝒦, the read-only planner selects model(s) lexicographically under the precedence privacy ≻ strategy ≻ cost, over the feasible set ℱ(s) = { m ∈ 𝒦 : capabilities(m) ⊇ needs(s) }: if s recalls a sensitive engram, ℱ(s) is first restricted to local models (Invariant 2); the active strategy then imposes a primary ordering on ℱ(s) — under a cost-first strategy (`adaptive`, `local-only`) the ordering is argmin_{m∈ℱ(s)} cost(m), whereas under `always-best` (coverage-max) it is argmax over capability coverage, and cost breaks ties only within that strategy ordering (so the cost-argmin governs the cost-first strategies, not `always-best`). Residual ties — including the free-local ties at cost 0 that a cost-first strategy leaves undistinguished — are broken lexicographically by typical-latency, then by stable catalog order (per `model-router.ts`), so the ordering is total. The selection is deterministic and side-effect-free, so the previewed total Σ_s price(model(s)) is computable before any token is spent; if some ℱ(s) = ∅ the walk is infeasible under that strategy."

### 5.2 Invariant 2 (Privacy hard-lock), verbatim (p14)

> "This is a **per-step** guarantee. For every step s whose own recall touches an engram flagged sensitive, model(s) ∈ LocalModels *independently of the active strategy*: the planner restricts ℱ(s) to local models before the cost minimization of Definition 2, so that step routes local — within the scope of that flag, privacy is not traded for cost."

Proof by construction: "The privacy gate is the highest-precedence filter; cost minimization ranges only over the already-restricted feasible set."

The honesty note (this is the most important limitation in the whole routing story):

> "Scope: the lock is **per-step only** and there is **no taint propagation** — content *derived* from a sensitive recall at one step and captured into a variable that flows to a later, cloud-routed step is **not** covered; only steps whose own recall touches the flagged engram are locked. It is also conditional on correct sensitive-flagging — an unresolved engram name is conservatively treated as sensitive (lock-when-unsure); behavior under a mis-flagged engram is out of scope."

A wiring bug is disclosed: "The planner always supported the lock, but until this revision **no walker passed the per-step tier map**, so it did not engage; the walk paths — `agent-walker`, the autonomous `unattended-executor`, and the IPC preview/execute paths — now resolve each step's recalled-engram tiers and pass them in." Pinned by 17/17 assertions with a control case proving the wiring is load-bearing.

### 5.3 Proposition 4 (Catalog monotonicity of routed cost — cost-first policies only), verbatim (p49)

> "Let R(S,𝒦) be the routed cost of walking skill S under a **cost-first** strategy (`adaptive` or `local-only`), in which each step selects argmin_{m∈ℱ(s)} cost(m) over its feasible set. If 𝒦 ⊆ 𝒦′ then R(S,𝒦′) ≤ R(S,𝒦) for every S. Proof. For each step the feasible set grows under 𝒦′, and a minimum over a superset is no larger; summing over steps preserves the inequality."

Explicit non-applicability: "this holds **only** for cost-first selection. It does **not** hold for the `always-best` (coverage-max) strategy, which ranks by capability coverage before cost — adding a more capable but pricier model can be selected and **raise** routed cost."

The durability argument built on it (§16): "A structured procedure with per-step routing therefore **survives** model turnover and **benefits** from it, where a model-specific prompt merely depreciates. That is the bet: durability comes from putting the know-how in a layer the model churn does not touch."

### 5.4 Figure 4 — per-step routing, transcribed (p15)

Nine steps of `ghampus-operator` with their `@needs` tags and resolved models:

| Step | `@needs` | Model selected |
|---|---|---|
| 1 · plan | `reasoning` | Qwen 2.5 7B (local · free) |
| 2 · triage | `fast` | Llama 3.2 1B (local · free) |
| 3 · implement | `code` | Qwen 2.5 7B |
| 4 · digest | `summarization` | Llama 3.2 3B (local · free) |
| 5 · analyze | `reasoning` | Qwen 2.5 7B |
| 6 · refactor | `code` | Qwen 2.5 7B |
| 7 · emit | `structured-output` | Qwen 2.5 7B |
| 8 · notify | `fast` | Llama 3.2 1B |
| 9 · write-up | `writing` | **GPT-4o mini (cloud · paid, writing only)** |

Footer: "8/9 steps free · 99.5% vs Sonnet-4.6 baseline (measurement-time catalog)". Side box: "sensitive-engram steps → local-only (separate rule)".

---

## 6. Lifecycle: vitality, versioning, governance (§6) — the anti-rot machinery

### 6.1 The vitality formula, verbatim (p16)

```
score = 100 - agePenalty - stalenessPenalty - citedDriftPenalty
  agePenalty        = min( floor(months_since_trained × 5), 25 )
  stalenessPenalty  = round( superseded_nodes / total_skill_nodes × 50 )
  citedDriftPenalty = round( missing_cited_nodes / total_cited_nodes × 40 )
```

Bands: **fresh ≥80, aging 60–79, retrain 40–59, stale <40.**

> "The three terms encode the three ways a procedure rots: it ages, its own nodes get superseded by partial edits, and the external memory it cites drifts out from under it."

Explicitly distinguished from the substrate's cortex-wide vitality (companion paper): **connectivity 0.40, confidence 0.25, activity 0.20, coherence 0.15** — "the two should not be conflated."

Measured baseline across P76: **every skill fresh, mean 97.7, median 98, minimum 92.** Intervention: a clean re-compile lifted the two lowest from **92 → 98** and **94 → 99** — "because retraining resets the age penalty and clears the bulk of the superseded-node staleness (a small residual keeps the scores at 98/99, not a perfect 100 — the recompile does not necessarily re-ground every cited node)."

Self-flagged weakness: "the score does **not** reward goal completeness or structural resolution — a deliberately narrow definition of freshness we flag in §11, since it means the goal-completeness work of §9 improves the SOP without registering as a vitality gain."

### 6.2 Figure 5 — vitality waterfall + staleness loop (p16), transcribed

**Left panel (waterfall):** starts at 100 → `−age ≤25` → 80 fresh line → `−stale ≤50` → 60 aging line → `−drift ≤40` → 40 retrain line. Inset box: "go-to-market: 100 − age 1 − staleness 7 = 92 / earlier §10.5 intervention → 98".

**Right panel (closed cycle):** `memory node (edited / forgotten)` → `cited-node index` → `retrain queue (typed reason)` → `idle scheduler (one/cycle · user-confirmed)` → `retrain (license-gated)` → `re-bind` → back to `memory node`.

### 6.3 Figure 6 — in-place retrain, snapshot chain, reversible rollback (p17), transcribed

Flow:
`existing source (same sourceId)` → `snapshot live nodes → <ts>.json.enc (encrypted)` → `clearSourceNodes (soft-delete: validUntil set, confidence → 0)` → `re-insert new nodes (fresh, walkable)` → `rename source AFTER inserts` → `re-derive all SOP edges`.
Failure branch: `insert fails → HOLLOW skill (no walkable nodes)` → `auto-repair (replay newest non-empty snapshot)` → feeds back into snapshot live nodes.
Green check box: "`rollback()` snapshots the CURRENT state first, then restores — so rollback is itself reversible; every restore creates a new snapshot in the chain".

Prose (p17):

> "A retrain reuses the skill's single source (§4); before mutating, the prior live nodes are written to an encrypted per-snapshot file (one file per snapshot, appended in O(1), retained indefinitely), which is what powers version history and rollback. Rollback first snapshots the *current* state, then replays the chosen snapshot — so a rollback is itself reversible and the lineage is never lost. An earlier model created a fresh source on every retrain, leaving 'red island' orphans in the graph; collapsing to one source per skill is what keeps the call graph resolvable. A crash between *clear* and *re-insert* would leave a **hollow** skill — a labeled source with no walkable nodes — so reads auto-repair it by replaying the newest non-empty snapshot; the fix that made retrain safe was reordering it to rename the source *after* inserts succeed rather than before."

### 6.4 Invariant 3 (Cross-skill-edge stability under retrain), verbatim (p17)

> "An in-place retrain of skill K reuses K's source id, so id(retrain(K)) = id(K); because a `@skill:` call resolves its target by *name* to a source id — intra-engram at walk time, cross-engram through the encrypted `skill-call-links` side-table — it keeps every incoming call resolvable without rewriting anything on the caller. Name matching is normalized so norm(slug) = norm(title-case) while genuinely distinct names stay distinct. Consequently, for any caller C with a `@skill:` call to K, the predicate resolves(C,K) is invariant under any number of retrains of K, and no casing/punctuation variant can fork a duplicate source."

Pinned 6/6.

### 6.5 The closed staleness loop (§6, p17–18)

> "A Skill records the ids of the memory nodes its recall recipes cite. When the owner edits, forgets, or supersedes one of those nodes, the dependent skill is enqueued for retraining with a typed reason (*source-edited*, *superseded*, *forgotten*), and a periodic sweep audits cited-node drift directly. An idle background scheduler drains the queue conservatively — **at most one retrain per cycle** and (by default) surfaced for the owner to confirm rather than applied silently. Drift detection and enqueuing are deterministic and license-free; the retrain that the owner then confirms is the step that consults the `skill-training` gate, so an unlicensed owner still *sees* every staleness signal even though applying the fix in-app requires the license."

**This is the answer to "decay by assumption."** It's the mechanism I'd port first.

---

## 7. Dispatch: lazy loading, proactive matching, self-registration (§7)

### 7.1 Lazy loading

> "The dispatch router never inlines the library. Step one loads only an **index** — a compact one-line `trigger → skill` entry per route — at roughly **160 characters per skill** in the conservative measurement (a one-line entry carrying the source id; **≈3,034 tokens over the 76 skills**). Step two classifies the current context against that index's trigger table. Step three hydrates the full text of only the matched skills — **one to three in the scenarios we model** (not measured session telemetry)."

### 7.2 Proactive matching — three-pass match + anti-spam bounds

Three passes:
1. due or upcoming obligations
2. keyword overlap with recently ingested material
3. time-based cadence rules

Anti-spam bounds (concrete numbers):
- **a small per-session cap on new proposals (five)**
- **a multi-hour suppression window per (signal, skill) pair (six hours)**
- **exclusion of meta-skills**

> "A skill *declares* its auto-proposal safety through the `[dispatch-safe: yes|partial|no]` tag on its Trigger goal (§3). The proactive watcher now runs every matched skill through the autonomy gate (§11, §13), which reads this tag and caps a `dispatch-safe: no` or low-confidence match at *suggest*; a meta-skill blocklist additionally keeps self-referential skills out of the proactive channel."

### 7.3 One trigger table, several consumers — the self-registration idea

> "The same trigger table is the single matching authority for the proactive watcher, for implicit routing inside a chat, and for *export*: the table is rendered into the host AI client's own configuration — a `CLAUDE.local.md` block, a `.cursorrules` file, Cursor `.mdc` rules — so the skills register themselves with whatever agent is driving. **The library, in other words, advertises itself to its executor rather than waiting to be asked.**"

This is directly transferable to beep-effect: a single generated trigger table that renders into `CLAUDE.md` / skill frontmatter / `.cursorrules`, with one owning source of truth.

---

## 8. Authority and autonomy: how constraints attach and travel

Two *different* mechanisms with the same shape, in two different places. Keep them distinct.

### 8.1 The paper's mechanism — Invariant 4 (Authored safety caps autonomy), verbatim (p40)

> "Over the ordered levels L₀ < L₁ < L₂ < L₃, a skill's effective level is **L_eff = min(cap_authored, L_resolved)**, where L_resolved is the per-skill level, else the engram default, else the global default, and cap_authored is the ceiling set by the `[dispatch-safe:]` tag (no↦suggest, partial↦preview, yes↦auto), with a meta/router skill forced to suggest and an unresolved contradiction in recalled memory forced to suggest; a trigger-match confidence below the floor (0.6) clamps the exercised action to at most suggest. Autonomy is thus capped by authored safety, never the reverse, and a router skill never auto-runs. Proof (by construction). The ceiling and the confidence floor enter only as min operations over the ordered level set, so each can lower but never raise L_eff; the decision is pure and model-free, regression-pinned."

Level semantics (§13): **L0 manual → L1 suggest → L2 preview-then-run → L3 autonomous.**

The unattended L3 executor is **off by default** and admits a run "only when a **conjunctive gate** — kill-switch, opt-in, L_eff = L₃, live contradiction re-check, walker-executable plan (parallel refused; loops only with an authored cap), reversible effects, rate limit — all holds."

Further from §11:

> "A true *unattended* L3 executor walks an auto-eligible skill end-to-end with no human in the loop, behind an explicit owner opt-in that is **off by default**. It admits a run only when every interlock passes — kill-switch on, opt-in on, effective level re-resolved to L3 at execution time, recalled memory re-checked live for contradictions, the plan walker-executable (parallel dispatch is refused; a loop is admitted only when its cap is *authored* — an uncapped `@loop` is refused unattended even though an attended walk bounds it with the walker's default cap, because an L3 run with no human watching requires the bound to be authored into the skill), and the side effects reversible — and it writes an encrypted, append-only per-action audit that a dedicated review surface renders with per-action undo."

Also: "Because today's reference walker emits prompts rather than performing writes, the effects an unattended run can take are read-and-compute; a write-capable walk is the next extension."

### 8.2 The SPEC's mechanism — `maxAutonomy` (§8.2, PROPOSAL, NOT IMPLEMENTED)

`SPEC.md:417–463`. The field:

```
maxAutonomy?: 'L0' | 'L1' | 'L2' | 'L3'      // optional node-metadata field
```

Five rules, verbatim:

1. **"A ceiling is a maximum, never a grant."** A host MUST NOT execute a node above its `maxAutonomy`. MAY execute below, MAY refuse entirely. "The field can only ever lower authority."
2. **"It is monotone under composition."** "A subgraph's effective ceiling is the MINIMUM over its member nodes. Borrowing a skill therefore cannot raise the ceiling of the graph that borrows it — the strictest member governs."
3. **"It survives transport."** "Because it is node metadata, it is carried by the same `serializeSubgraph` envelope that carries the steps."
4. **"Absence is not permission."** "A node with no `maxAutonomy` is UNSPECIFIED, not unlimited. A conforming host MUST treat unspecified as the most restrictive level it supports for unattended execution. This is the rule that makes the field fail closed, and it is the difference between a ceiling and a suggestion."
5. **"The writer of a node cannot raise its own ceiling."** "A process that mints or edits a node MUST NOT set `maxAutonomy` above the ceiling of the context it is running in… **what proposes an action does not approve its own limits.**"

And the honest limitation: "This is advisory unless a conformance level mandates it. An L2 reader that ignores `maxAutonomy` still parses the file correctly."

Conformance levels (§8.3) exist precisely to make it binding:

| level | covers | must |
|---|---|---|
| **L1 — container** | §1 byte layout, §2 header, §4 integrity | frame, checksum-verify and reject per §5.1 |
| **L2 — model** | §3 node/edge model, §8.1 `(id, rev)` | round-trip every node, edge, revision and metadata field without loss; honour §8.2 rule 4 (unspecified is restrictive) |
| **L3 — retrieval + authority** | §5.3 traversal, §8.2 ceilings in full, skill execution per §8.4 | **enforce `maxAutonomy` as a hard gate**; implement path-maximum traversal |

### 8.3 The relationship between the two — the interesting part

The paper NEVER uses the word `maxAutonomy`. The two mechanisms are the same idea at two layers:

| | paper's Invariant 4 | SPEC §8.2 `maxAutonomy` |
|---|---|---|
| Where the ceiling lives | authored `[dispatch-safe:]` tag inside the Trigger goal node's *text*, plus per-skill/engram/global defaults resolved in app config | an explicit optional field in *node metadata*, in the file |
| Composition | `min(cap_authored, L_resolved)` — a min over sources of the level | min over *member nodes of the subgraph* |
| Travels? | in the sense that the tag is in the skill's text, so a `.gsk` pack carries it | explicitly: "carried by the same `serializeSubgraph` envelope" |
| Fail-closed on absence? | falls back to engram default then global default (so a permissive global default *would* apply) | rule 4: absence = UNSPECIFIED = most restrictive. **Strictly safer.** |
| Implemented? | in the sidecar (paper claims regression-pinned) | NO — `ROADMAP.md:47` |

**The SPEC's rule 4 is strictly better design than the paper's fallback chain.** In the paper, a skill with no per-skill level falls back to the engram default, then the global default; a permissive global default silently raises the floor for every un-annotated skill. In SPEC §8.2, unspecified means *most restrictive*. If beep-effect models an authority ceiling, take the SPEC's semantics, not the paper's.

**Rule 5 is the genuinely novel bit** and generalizes past graphs entirely: *the thing that proposes an action does not approve its own limits.* In an agentic system where an LLM writes new memory nodes / skills, this is the one rule that prevents privilege escalation via self-authored config.

---

## 9. Composition, conflict, supersession

**Composition** happens through three mechanisms, all named:

1. **`skill:calls` / `@skill: name(args) -> $capture`** — function-like sub-skill invocation with argument binding and return capture, depth-capped at 3. Intra-engram → a real `contains` edge with evidence `skill:calls`; cross-engram → a row in the encrypted `skill-call-links.json.enc` side-table (NOT an edge).
2. **`On failure` goal names a recovery skill** — "`bug-investigation` recurring as a common *On failure* handler across the code family" (§9). Recovery calls consume a level of the same depth-3 ladder, so mutual handlers cannot recurse.
3. **`parallel[]` sibling groups** — declared in the plan, **never dispatched by the shipped walker**; an obligation on external executors. This is the one contract-only feature, restated at least six times in the paper.

Concrete composition topology from the corpus (§9):
- Code cluster: `bug-investigation ⇄ runtime-diagnosis` loop; `ship-workflow → generated-artifact-freshness-check` chain.
- Business cluster: `go-to-market-planning`, `enterprise-sales-prep → enterprise-gtm-compliance-angle`.
- Both joined at the top by dispatch through `skill-dispatch`.

**Conflict / supersession** is handled at the node level by the substrate's correction pipeline, not by any skill-specific mechanism:
- A retrain soft-deletes prior nodes (`validUntil` set, confidence → 0) under the *same source id* — supersession, never erasure.
- "An unresolved contradiction in recalled memory" forces the autonomy level down to *suggest* (Invariant 4) — this is the only place contradiction directly gates procedure.
- The **contradiction self-heal policy** (§11, "Addressed and planned") — "a walk-time guard surfaces contradicted memory so a recall step never feeds it downstream."
- There is **no** mechanism by which two skills conflict with each other or one skill supersedes another. Two skills with the same normalized name resolve to the same source (Invariant 3 name normalization); genuinely distinct names stay distinct. Skill-vs-skill conflict is simply not modeled.

---

## 10. Does it work? The evaluation, honestly read (§10)

There is **no public "SOP execution" benchmark**, so the paper defines its own measurements: a token-cost decomposition of dispatch, a per-step routing-savings accounting driven by the real router, and a deterministic model-free correctness check of the defining primitive.

Author's own framing (§11, Scope of evidence):

> "This paper is a design, an artifact, and a deterministic-accounting existence-proof… **It is not an outcome study.** It does not provide task-outcome evidence, external-user or independent-corpus validation, or head-to-head baselines, so its claims of cost-benefit and generality are established **by construction and by accounting** — counts and deterministic ledgers over the artifact — rather than by controlled task outcomes, while **borrowability is credited to the measured E4 telemetry**."

### 10.1 §10.2 Lazy dispatch vs library inlining — TABLE OF NUMBERS

Measured with the system's own tokenization heuristic (**characters ÷ 4**):

| Quantity | Value |
|---|---|
| Inlining every skill body (P76) | **48,780 tokens** |
| Lean dispatch index (one-line `trigger → skill` per skill, incl. source id) | **≈3,034 tokens** |
| Median skill body | **550 tokens** |
| Mean skill body | **642 tokens** |
| Heaviest skill (`skill-dispatch` itself) | **1,751 tokens** (a floor — that body is truncated/corrupted, excluded from the E2 routing subset) |
| A session hydrating 1–2 matched skills | **≈3,600–4,100 tokens** |
| Reduction | **91.5–92.6%** |
| Fraction of library loaded | **≈8%** |
| 3-skill match | ~90.4% reduction (§13) |

**Proposition 3 (Lazy-dispatch footprint bound)**, verbatim:

> "Let a library of N skills have per-skill index cost idx_i (one line) and body cost body_j. A session matching k skills (typically 1 ≤ k ≤ 3) loads F(N,k) = Σ_{i=1}^{N} idx_i + Σ_{j∈M} body_j against full inlining Σ_{j=1}^{N} body_j. The matched-body term depends only on k, not on N; hence as N grows at fixed k, inlining grows ∼linearly in N while F grows only at the far cheaper index rate, so, provided added skills' index-to-body ratio stays below the current footprint ratio and the added skills go unmatched (matched k fixed), the reduction 1 − F/Σ_j body_j is non-decreasing in N — **a larger library then tends to strengthen the ratio.**"

Explicitly de-rated: "an addition that *joins* the matched set adds its body to F and can lower the reduction, so the monotonicity is stated for unmatched growth — an empirical scaling argument over this corpus, not a closed-form guarantee."

**Figure 9 transcribed:** bar at ~49k labeled "48,780 tokens / Inline all 76 skills"; small bar labeled "≈4,134 tokens / Lazy dispatch" broken out as "2 matched skills = 1,100" + "lean index 3,034"; callout "~8% of the library / 91.5% fewer tokens".

Explicitly not claimed as novel: "We do not claim the mechanism as new — lazy loading is a known pattern; the contribution is the exact token accounting of it over this deployed corpus."

### 10.2 §10.3 Per-step routing savings — TABLE, transcribed verbatim

Driving the **real router** (`planSkillWalk`) over the static model catalog across the annotated nine-step `ghampus-operator` skill. Assumptions: **1,500 input / 600 output tokens per step**; Sonnet-4.6 counterfactual baseline at **$3 / $15 per 1M tokens = $0.0135 per step**; baseline walk **$0.1215**.

| Configuration | Routing outcome | Walk cost vs $0.1215 baseline | Saved |
|---|---|---|---|
| Adaptive, local + cloud | 8/9 steps → free local (Qwen 2.5 7B, Llama 3.2 1B/3B); 1 step (`writing`) → GPT-4o mini | **$0.0006** | **99.5%** |
| Always-best, cloud only | all 9 → Claude Haiku 4.5 | **$0.0324** | **73.3%** |
| Local-only | 8/9 free; `writing` step has no qualifying model | *infeasible* | — |

**Reproducibility caveat, verbatim and important:**

> "These three rows reflect the **measurement-time** model catalog, in which no local model declared the `writing` capability — hence the one paid `writing` step and the *infeasible* local-only row. The catalog **shipped and pinned with this paper** (`route-b-artifacts/lib/model-registry.ts`, sha256 in `CHECKSUMS.txt`) **has since added local `writing` support**, so re-running `planSkillWalk` over the frozen catalog routes **all nine steps local** (≈100% saved, local-only *feasible*). We keep the 99.5% figure as the measurement-time result and flag that it is **not** reproducible from the shipped catalog without restoring the earlier catalog state."

The 73.3% figure is deconstructed by the author as a **pricing identity, not a corpus property**: Haiku 4.5 pinned at $0.80/$4.00, Sonnet 4.6 at $3/$15 → price ratio 0.2667 → saving = 1 − 0.2667 = **73.3%** "on both token axes regardless of the skill." At current retail (Haiku 4.5 $1/$5) the same identity yields **66.7%**.

### 10.3 §10.4 The model-free regression suites — Figure 10, transcribed

| Suite | Result |
|---|---|
| Plan-compilation determinism (golden plan, Theorem 1) | **7 / 7** |
| Structure preservation (Proposition 2, incl. `@needs` & `only_engrams`) | **9 / 9** |
| Cross-skill name match (§6, slug / title-case normalization) | **6 / 6** |
| Privacy hard-lock (Invariant 2, sensitive-engram steps forced local) | **17 / 17** |
| Edge-derivation idempotence (Lemma 1, capped loops reach a fixpoint) | **14 / 14** |

Plus `agent-walker-loops.test.ts` — **8 sections / 23 assertions** (§11).

**Availability, verbatim and damning:**

> "**two test sources — the privacy hard-lock (17/17) and edge-derivation idempotence (14/14) — are included for inspection in `route-b-artifacts/tests/`, but they import sidecar modules and are not standalone-runnable; the other three (plan-compilation determinism, structure preservation, cross-skill-edge stability) are not shipped. All five pass counts are internal sidecar CI records, not standalone artifact checks** a reader can re-run against the published artifact; the sidecar suite runs internally via `pnpm exec tsx tests/run-all.ts`."

### 10.4 §10.5 Governed retraining moves vitality the right way

Baseline P76: 76 skills *fresh*, mean 97.7, median 98. Clean re-compile of the two lowest: **92 → 98** and **94 → 99**, prior versions preserved as rollback snapshots.

> "The intervention is small because the corpus was already healthy at measurement time — a snapshot, not proof the maintenance loop caused it; the causal signal is the *move* under retrain (92→98, 94→99), not the baseline level."

### 10.5 §10.6 / E4 — Cross-skill call vs sub-agent spawn (THE headline)

The measured borrow arm is a **callee-side proxy** for an `@skill:` sibling call, not a full cross-engram borrow walk (Appendix A note).

| Quantity | Value |
|---|---|
| In-cortex walk-and-recall (borrow) | **≈475 tokens**, grounded **3/3** |
| Full-client cold sub-agent spawn, live | **≈21.3k tokens** (two single-shot spawns: **21,406** and **21,186**), grounded **0/3** (memory-ablated by instruction) |
| Live separation | **≈45×** |
| Reproducible sandbox: 5 cold sub-agent spawns | mean **25.0k tokens, sd 2**, grounded 0/3 |
| Sandbox deterministic borrow | **637 tokens**, grounded 3/3 |
| Sandbox separation | **39.3×** |
| Reported measured separation (2 datapoints) | **≈39–45×** |
| The separately-quoted ~30× | against a **~700-token *modeled*** typical borrow (b_t ≈ 642 + binding) — **not a measured datapoint** |

**Proposition 5 (Borrow avoids the spawn warm-up; the O(N) gap is an eager-inline anti-pattern)**, verbatim:

> "Borrowing skill t via an in-cortex `@skill:` call costs C_borrow = b_t + α — the called body plus a constant argument-binding term — resolved through a training-time side-table at no model-token cost (§3). Two distinct comparisons follow. **(1) The architectural claim (a constant, not an asymptote):** standing up a sibling agent pays an unconditional warm-up W — a re-sent system/role prompt, task framing, context priming — that the shared cortex makes unnecessary; *granted the* same lazy dispatch as Graphnosis (Proposition 3), a spawn's matched-body term is O(1) in library size but it still pays the index term Σ_i idx_i = O(N) that Proposition 3 attributes to the caller's own index — so, scoping the comparison to exclude that shared index term on both sides, the genuine separation is the **constant warm-up W**, not an asymptotic one. **(2) An eager-inline anti-pattern baseline (modeled):** a spawned agent that instead inlines its whole library pays C_spawn = W + Σ_{j=1}^{N} b_j = Ω(W + N b̄), growing linearly in N — but that linearity is a property of the bad baseline, not of spawning."

**Honest caveats, verbatim:**
- "≈21.3k is a *full Claude Code* sub-agent — a harness-specific maximum, not an architectural constant — so the absolute multiple is host-dependent, and the invariant is the constant warm-up avoided."
- "the borrow tokenizer (characters ÷ 4 over walk-plan + recall) and the spawn tokenizer (real `subagent_tokens` over the full session including output) are **different**, so the borrow and spawn sides are *not* counted under the same convention… the separation's robustness rests instead on its magnitude far exceeding any plausible tokenizer discrepancy."
- The sandbox borrow "searched all engrams (36 others, no matches), so it was PII-free *by outcome* — recall surfaced only the 3 sandbox facts — not PII-free *by construction*; it is a single deterministic walk with no CI on the ratio."
- The `0/3` grounding on the spawn side "is by construction" — the spawn arm was memory-ablated by instruction.

**Figure 12 transcribed:** Left panel "Measured — E4 (live run + sandbox N=5, this harness)": red bar at ≈21.3k labeled "spawn whole agent / memory-ablated, by construction / grounded 0/3"; tiny green bar at ≈475 labeled "borrow one skill / grounded 3/3"; callout "≈39–45× meas. · ~30× vs modeled borrow". Right panel "Illustrative — modeled (eager-inline anti-pattern; not measured)": rising dashed line "spawn + inline library — O(N)" with points at "7 skills ≈25.8k" and "25 skills ≈37.4k"; flat line "borrow one skill — O(1), flat". Footnote: "slope vanishes under lazy loading on both sides → only the constant warm-up remains."

**The precedence claim (§10.6), verbatim** — this is the paper's actual novelty claim:

> "Each constituent idea has prior art: function-like composition of tools *inside one agent* (CodeAct; Wang et al., 2024); invoking an agent as a callable with structured input and a returned value (the agent-as-tool pattern in current agent SDKs); and typed-edge skill graphs that compose stored procedures (recent skill-graph work such as SkillDAG and GraSP). What we did **not** find is the specific conjunction — one agent invoking another's *learned, named* skill as a composable function with explicit argument binding and return capture, resolved through a co-located cross-engram side-table, *together with a reported per-call token comparison against sub-agent spawning*."

### 10.6 §10.7 — Route B: five live experiments E1–E5 plus E6

Run against the author's **live cortex (38 engrams, 196 trained-skill versions)** over the Graphnosis MCP, success rules fixed before the run. Raw outputs in `route-b-artifacts/route-b-results.md`.

- **E1 (Portability proxy).** A skill trained source-only (`influential memories: 0`) exported to a signed `.gsk` whose footer states verbatim "personal memories are not included", then retrained into a **recipient engram**, bound, walked; recipient's own deployment fact matched at **similarity 0.83**. Crucially: "**The `.gsk` pack was produced and inspected but not imported — no one-call `.gsk` import path existed at the time of the run**, so transport was shown via a source-grounded retrain into the recipient engram, not a true import; a quarantine-scoped `.gsk` import has since shipped (§11) but E1 was not re-run through it, and an independent third-party device remains the open case."
- **E2 (Routing — a cost accounting, no quality measured).** Over the corpus's real `@needs` tags, priced each step's routed model against all-Sonnet-4.6. Adaptive ≈**99.6%** with **105/105** skills routable. Cloud-only **96.6%** cheapest-qualifying (reaching Gemini Flash / GPT-4o-mini) and **73.3%** coverage-max. Local routing saves **98.7%** but **only 90.5% of skills (95/105) run fully local** — `tone-match`/`cited` are declared by no local model, so 10 skills need cloud for at least one step. An earlier pass reported "100% local / 73.3% corpus distribution" and is **corrected here** as having "conflated a constant price ratio with a distribution and drew its 100% from a fixture that had recoded the local-unservable tags."
  **Step-capability mix over the 809 steps:** reasoning ≈**51%**, fast **23%**, writing **11%**, structured-output **8%**, then summarization, code, tone-match (**1.6%**), extraction.
  The honest read, verbatim: "the ~99.6% adaptive saving is achieved precisely by routing those judgment steps (reasoning ~51%, writing ~11%) to *free local* models — the very steps E6 finds local quality collapses on — so realizing that saving *without* quality loss is **not** established. Keeping the judgment steps on cloud, where quality holds, would *lower* the saving toward the ~96.6% cloud-only figure; the 99.6%/96.6% gap is thus the price of the quality risk, not a free lunch."
- **E3 (Vitality).** Read-only sweep returned sampled vitality **96–100** with an attributable penalty decomposition — a 20-day-old skill at 96 = age −3, superseded-node −1.
- **E4 (Borrowability).** See §10.5 above.
- **E5 (Co-location ablation).** Three arms on a fact-grounded task with success rules frozen in advance: only the **co-located** arm completed it (**3/3** facts grounded); two memory-ablated arms (a pure-SOP arm and a no-memory arm, "instructed to use no memory tools") each grounded **0/3** and **correctly refused to fabricate**. "This is a within-design co-location ablation that isolates the effect of co-locating procedure with owner-held memory; it is complete as an ablation and makes no comparative claim about any other system."
- **E6 (Quality retention — a routing-design sanity note).** 60 tasks, 10 per capability, each completed by Sonnet-4.6 (baseline), Haiku-4.5 (cheap cloud), Qwen2.5-14B (local — *stronger* than the catalog's declared 7B, so an upper bound on local quality). Scored by a **blind, position-counterbalanced Opus judge** (candidate order rotated per task, not RNG-randomized; objective capabilities checked against references, code executed). Retention = cheap model passes or ties-or-beats Sonnet. K=10 per capability, **directional, not point estimates**.

**E6 TABLE, transcribed verbatim:**

| Capability | Haiku (cloud) | Qwen-14B (local) |
|---|---|---|
| code | 100% | 100% |
| structured-output | 60% | 80% |
| extraction | 80% | 70% |
| reasoning | 70% | **0%** |
| summarization | 70% | **20%** |
| writing | 70% | **0%** |
| **overall** | **75%** | **45%** |

> "In this pilot the split is stark: cheap **cloud** (Haiku) retained 75% overall — at least 60% in every capability — while the **local** 14B holds only on **mechanical** capabilities (code 100%, structured-output 80%, extraction 70%) and **collapses on judgment** ones (reasoning 0%, writing 0%, summarization 20%) — and the catalog's actual local model is a smaller 7B, a lower floor still."

Threats disclosed: K=10 gives wide uncertainty (a prior stochastic run scored **77/42** against the 75/45 here); single LLM judge, not human-calibrated, no inter-rater measure, an Opus judge may favor Anthropic-style prose; Qwen-14B is *stronger* than the catalog's 7B; the cheapest-qualifying cloud pick (Gemini Flash) was proxied by Haiku and left untested; the 60-task battery was itself authored by models in the same harness (correlated-design threat); these are per-capability completions, not full skill walks.

Two record-integrity issues disclosed rather than re-run: (1) the local-arm relay **materialized in 7 of the 60 Qwen records** — extraction-2, reasoning-7/8/9, writing-0/1/2 (GEN_FAILED / relay-status / scaffold-contaminated outputs) — "excluding those seven leaves the collapse **direction unchanged**"; (2) the judge was **not blind on 3 records** — writing-0, extraction-2, reasoning-9 leaked the model or local-runtime name (Qwen2.5-14B on writing-0/extraction-2; Ollama on reasoning-9) — "all three were scored failures on content grounds, not on the leaked identity."

**Figure 11 transcribed** — "Corpus-wide per-step routing — cost only (105 skills, 809 steps), mean % cost saved vs all-Sonnet-4.6 baseline": Local-only **98.7%** (annotated "only 90.5% skills fully local — tone-match/cited have no local model"); Adaptive (local+cloud) **99.6%**; Cloud-only cheapest-qual **96.6%**; Cloud-only coverage-max **73.3%** (annotated "= 1 − 0.2667 (pinned-catalog Haiku/Sonnet price ratio) — a pricing identity, not a corpus distribution"). Banner: "COST ONLY — no output quality measured."

---

## 11. The corpus (§9, Appendix A) — what a real skill library looks like

Three populations, defined once (Appendix A):
- **P76** — the original self-built core; used for the dispatch decomposition (§10.2) and the vitality baseline (§10.5).
- **P108** — the full catalogued corpus, **108 trained skills across 12 owner-domain families**.
- **P105** — the E2 routing subset = P108 minus 3 exclusions (two already-tagged skills with **empty step bodies**, plus the body-truncated `skill-dispatch`).

### 11.1 Twelve families — TABLE, transcribed verbatim (Appendix A)

| Family | Engram | Count | Completion oracle | Purpose |
|---|---|---|---|---|
| Code / engineering | Code Skills | 26 | `[verify: tool\|state]` | Ship, test, diagnose, and audit the codebase against machine checks |
| Business / GTM | Business & GTM Skills | 25 | `[verify: human]` | Go-to-market, sales, pricing, fundraising — judgment work bound to private engrams at walk time |
| Meta / agentic | Meta Skills | 24 | mixed (`tool\|state\|human`) | Operate on the skill system itself: dispatch, retrain, retrospectives, delegation |
| Research | Research Skills | 4 | `[verify: human]` | Literature, citation, experiment, and publication workflows |
| Creative | Creative Skills | 4 | `[verify: human]` | Music composition, release, arrangement review, and diagram/layout review |
| Nonprofit / board | Nonprofit Skills | 3 | `[verify: human]` | Board prep, grant drafting, fundraising campaign planning |
| Heritage / genealogy | Heritage Skills | 3 | `[verify: human]` | Source triage, lineage verification, archive ingestion |
| Event organizer | Event Organizer Skills | 3 | `[verify: human]` | Event concept/budget, public launch, sponsor and vendor negotiation |
| Film producer | Film Producer Skills | 3 | `[verify: human]` | Script development, greenlight packaging, teaser launch |
| Acting | Acting Skills | 3 | `[verify: human]` | Role prep, self-tape auditions, public persona and promotion |
| Reviewer | Reviewer Skills | 3 | `[verify: human]` | Manuscript review, publication-readiness audit, peer-review response |
| Ghampus (chat agent) | Ghampus Skills | 7 | mixed (`human\|state`) | The chat agent's own operating skills — turn protocol, recall routing, in-chat dispatch, memory capture, context hygiene, local-model grounding, consent & autonomy |

Total = 26+25+24+4+4+3+3+3+3+3+3+7 = **108**. ✓

Named skills worth noting (full lists in Appendix A):
- Code: `sidecar-change-verify, recall-before-coding, bug-investigation, vibe-coding-workflow, generated-artifact-freshness-check, binary-output-verification, ux-decision-gate, ux-review-checklist, performance-regression-check, testing-cadence, security-review-cadence, ship-workflow, multi-repo-release-coordination, dependency-update-protocol, it-architecture-review, deployment-platform-ops, docs-maintenance-workflow, overlay-triage, consistency-audit, changelog-management, localization-awareness, app-accessibility-check, feature-showcase-sweep, praxis-configuration, runtime-diagnosis, public-repo-ship-audit`
- Meta/agentic (the self-referential family): `agentic-communication-style, task-todo-management, subagent-management, mcp-tool-selection, prompt-improvement, agent-delegation-decision, session-end, self-driving-session, skill-dispatch, project-context-management, session-start, skill-maintenance-review, retrospective-learning, adaptive-skill-creation, autonomous-decision-authority, proactive-feedback-protocol, decision-challenge-protocol, strategic-conversation-tracking, cortex-gardening, dispatch-export-sync, execution-architect, batch-completion-report, skill-retrain-queue-ops, ghampus-operator`

### 11.2 Two orthogonal axes

> "Two axes of generality are thus distinct and both represented in the corpus: it is **domain-agnostic** (eleven domains by one method) and **oracle-agnostic** (procedures close on a tool, state, or human completion oracle), with the completion oracle — not the domain — the primitive that classifies kinds of procedural work."

Note the eight new families are a **representational domain-compatibility probe** — "compatibility under the same training method — **not** measured cross-user transfer."

### 11.3 The `@needs` retrofit — a caveat about the corpus (§9)

> "the *original* 76 skills largely under-exercised [per-step routing]: most carried no `@needs` annotations and defaulted to a general capability, so the dramatic routing savings of §10.3 were a property the engine made *available* more than one the measured library fully exploited. That gap is now closed corpus-wide: the shipped fixture shows the retrofit reached the *original* corpus too — 71 of the original 76 were also `@needs`-retrofitted, so **100 of 108 skills carry the status `retrained`** (the eight remainder already-tagged or excluded). Across the thirty-two new family skills, twenty-nine were given explicit per-step `@needs` in this pass and the three Film Producer skills already carried them (`skipped-already-tagged`), so all thirty-two now route per-step."

---

## 12. The Agempus reframe (§9.1) — "the engram IS the agent"

**Definition 3 (Agempus)**, verbatim (p22):

> "An Agempus is a skill engram: the per-family bundle of (i) its **procedures** — the typed-edge step subgraphs of §3, with their `skill:seq`/`skill:loop`/`skill:branch` control flow; (ii) the **private memory they bind at walk time** through recall recipes (§4, §5), never frozen into the body; (iii) the **dispatch index** that surfaces it on a matching context (§7); and (iv) the **cross-skill call graph** that lets it invoke siblings (§3, the `skill:calls` relations and the encrypted cross-engram side-table). These four are co-located in one engram and held by the owner. An Agempus is therefore the *persistent, model-agnostic core* of a domain agent: the model is rented and swappable — the per-step router (§5) picks a different one for each step and a different one again next quarter — while the Agempus is owned and durable."

Name etymology: **AGENT + hippoCAMPUS**, plural **Agempi**. The **Ghampus** is the chat Agempus (front of house), driven by `ghampus-operator`; the Agempi are the domain specialists it dispatches to.

The neuroscience lens: "the Agempi **share one cortex**, and each **has a hippocampus** (its recall), **a basal ganglia** (its skill set — each skill a *striosome*, a discrete procedure compartment), and **rents a prefrontal cortex** (the per-step model)."

**The caveat, stated exactly — "no overclaim":**

> "An Agempus is the agent's *core*, not a running loop. It does not act on its own; it acts when a runtime *walks* it (§5)… **Left off — the default — an Agempus acts only when a runtime walks it. Calling an engram an agent is a claim about its *structure and ownership*, not a claim that it loops autonomously until the owner turns that on.**"

Why the reframe matters (§9.1): (1) the corpus is a **roster of specialists**, not a flat library; (2) distribution becomes **portable agency** — a `.gsk` pack is "a *signed SOP pack designed for future cross-owner portability*"; (3) it sharpens the **unit-of-reuse** argument — "when the model is rented and the Agempus is owned, the unit of competitive advantage stops being the prompt and becomes the private, governed, ever-improving Agempus you hold."

**Figure S2 transcribed:** "owned substrate · domain agents · rented compute." A `Ghampus (chat agent · runtime)` box dispatches-and-walks into a row of Agempi boxes — `Code`, `Business`, `Reviewer` (highlighted "Agempus being walked"), `Event Organizer` — each containing `skills` + `bound memory`. All four draw (dashed) on a shared `cortex` bar labeled "owner-held memory substrate · notes · sources · decisions · corrections". Right column "Walk-time compute — rented per step": step 1 scan / step 2 reason / step 3 write → `local model (free · on-device)` or `cloud model (paid · rented)`; boxed note "Agempus stays owned; only the model is rented."

---

## 13. The self-referential build loop (§8) — the case study, explicitly excluded from claims

The corpus was "trained, by an AI coding agent (Claude Code) reading the Graphnosis repository together with the founder's plans and prior sessions, to make the ongoing work of building Graphnosis cheaper and more reliable — and it was then used to do exactly that."

**Excluded from claims, verbatim:** "reconstructed after the fact from commit history and session transcripts rather than from instrumented telemetry; its figures are accordingly **excluded from the paper's empirical claims (§10)** and should be read as a guiding anecdote, not as measured evidence."

**The self-improvement triad:**
```
retrospective-learning → adaptive-skill-creation → train_skill → skill-dispatch retrain
```
> "a mistake triggers a `retrospective-learning` walk, which proposes a new or amended procedure via `adaptive-skill-creation`, which compiles it with `train_skill`, which retrains `skill-dispatch` so the new skill self-registers into the router (§7). Indexed work trains the skills; the skills then govern the next session's work — a closed learning loop that, under local-only routing, never leaves the machine."

**Dated provenance:** `train_skill` compile shipped **2026-05-27**; the finite-step `walk` layer with the full eight-goal contract **2026-05-31**. Wave 1 (mid-June, lower recall-breadth): ~50 foundational skills, "several distilled from real debugging sessions, so the SOP encodes what actually worked rather than what the documentation claimed." Wave 2 (a week later, higher recall-breadth): retrained wave 1 and added skills born from concrete incidents in shipping and compliance work → the 76-skill library.

**THE COUNTEREXAMPLE — the most valuable single finding in the paper:**

> "The gains are contingent on actually *walking* the dispatched skills. A later firefight in which skills were *instructed but not walked* at the orchestrating level regressed to the no-skills baseline — multiple rework loops, a net-negative verdict in the founder's own retrospective. We keep this in the paper because it sharpens the claim: the benefit comes from executing the procedure graph, not from a skill library merely existing in the cortex."

**Figure 8 transcribed** ("WITH vs WITHOUT Skills: The Build Ledger", "token bill per build state (lower is better)", y-axis "tokens (est.)"): three states — (1) "No skills (baseline) / poor — large, diffuse": a large token band, "many parallel sub-agents", "rework loops (redo)", "diffuse token bill"; (2) "Skills, walked / best — lowest bill": "dispatched + walked", "fewer rework loops", a small token band; (3) "Skills dispatched, NOT walked / relapse — net-negative": token band back up near the baseline, "rework loops return". Caption: "The bands illustrate the qualitative ordering this case study motivates, not a measured magnitude."

**Figure 7 transcribed** ("The Self-Referential Build Loop"): outer blue cycle `indexed building work (runs are captured + indexed)` → `train_skill (distill run to SOP)` → `trained SOP subgraph (in the cortex)` → `governs the next session` → back to indexed building work. Inner green cycle: `mistake` → `retrospective-learning` → `adaptive-skill-creation` → `skill-dispatch retrain` (dashed "new skill self-registers") → back.

---

## 14. Failure modes named in the document (consolidated)

The paper is unusually generous with failure modes. Collected:

1. **Decay by assumption** — a procedure encodes facts that drift, nothing notices. (§1) → answered by the cited-node index + staleness loop.
2. **Separation from memory** — procedure in one store, facts in another; cannot be versioned/encrypted/checked together. (§1)
3. **Hollow skill** — a crash between `clearSourceNodes` and `re-insert` leaves a labeled source with **no walkable nodes**. Fix: auto-repair on read by replaying the newest non-empty snapshot, *plus* reordering so the source rename happens **after** inserts succeed. (§6)
4. **"Red island" orphans** — an earlier model created a **fresh source on every retrain**, orphaning prior sources and breaking `@skill:` resolution. Fix: one source per skill, reused id. (§6)
5. **Duplicate-fork defect** — a slug-vs-title-case name mismatch forking a duplicate source. Fix: name normalization, `norm(slug) = norm(title-case)`, 6/6. (§6, Invariant 3)
6. **Loop-edge accumulation (the Lemma 1 bug)** — the linker's delete step matched only the *bare* `skill:loop` tag, missing the capped `skill:loop;max=N` form, "so capped-loop edges accumulated across re-derivations and the fixpoint failed (silently weakening Theorem 1 and Invariant 3)." Fix: deletion predicate now matches bare and suffixed forms; `skill-loop-idempotence` 14/14, **verified red before the fix**. (§3)
7. **Dispatched but not walked** — the case-study counterexample; net-negative vs the no-skills baseline. (§8)
8. **Skill-chain unrolling into a factual query budget** — a factual query seeds into one step by vocabulary overlap and traversal unrolls the whole procedure. Fix: `blockedEvidencePrefixes` blocks *propagation*, never *membership*. This is the one fix that lives in the open SDK (`traverser.ts:97–108`). (§SDK)
9. **Data-quality debt** — "At least one shipped skill carries non-SOP content baked into its body (a retrieval/inference dump and duplicated steps); we excluded such content from measurement and flag it as a migration target rather than retraining over it blindly." (§11)
10. **Narrow vitality** — the score doesn't reward goal completeness or structural resolution, so genuine quality work leaves it unmoved. (§6, §11)
11. **No taint propagation** — the privacy hard-lock is per-step; derived content captured into a variable can flow to a later cloud-routed step. (§5, Invariant 2)
12. **Mis-flagged sensitive engram** — conservatively lock-when-unsure; behavior under a mis-flagged engram is out of scope. (§5)
13. **Pack confidentiality is fake** — "Both pack formats — the `.gsk` skill pack and the `.gez` engram pack — encrypt their payload with a **fixed, obfuscation-grade key embedded in the open source**, so the cipher delivers integrity-by-signature, not confidentiality… We therefore describe packs as *signed*, not *confidential*." And: "Because the codebase is open, a license check on pack import or export is a **product boundary, not a security control** — it cannot keep a confidential pack from anyone willing to recompile, and should never be presented as protection." (§11) Since fixed: optional passphrase (Argon2id) or recipient public key (X25519) *over* the unchanged Ed25519 signature.
14. **Untrusted ingress** — "an imported pack is untrusted content entering the cortex, so the right controls are the substrate's owner-adjudicated ones — land an import in a quarantined scope rather than merging it live, never auto-recall or auto-dispatch imported nodes, and treat an imported skill as **not `dispatch-safe`** until the owner promotes it."
15. **Rewrite could drop a routing tag** — the structure validator originally did not guard `@needs` or `only_engrams`; a Pro rewrite could in principle have dropped a routing tag. Gap now closed and regression-tested. (§11)
16. **Set-presence ≠ per-step placement** — a rewrite can relocate a token to a different step; per-step ordered verification is future work. (§4)
17. **`parallel[]` is never dispatched** by the shipped walker — an obligation on external executors, restated ~6×. (§5, §11)
18. **Goal-completeness defects** — "five thin skills were completed to the full eight-category contract" during the maintenance pass; the corpus had incomplete contracts. Also "chunk-splitting and goal-completeness defects caught while cataloguing the corpus for §9." (§9, §13.1)
19. **Two skills with empty step bodies** and one **body-truncated** skill (`skill-dispatch` itself, at 1,751 tokens) — excluded from the routing subset. (Appendix A, §10.2)

---

## 15. Reading the argument — my assessment

**What is genuinely good here.**

The central move is small and correct: *don't add a node type; add an evidence-tag discipline over the edges you already have.* Proposition 1 is trivially true and that is exactly why it's valuable — the whole procedural layer is a **labeling convention** over an unchanged schema, so every substrate property (encryption key, op-log, snapshot versioning, soft-delete supersession) is inherited rather than reimplemented. That is a real architectural result even though the proof is "by inspection."

The second good move is **compiling the plan from storage order, not edge traversal** (Theorem 1). It resolves the tension between "a loop is a real back-edge in the graph" and "a plan must be a finite ordered list": the back-edge exists topologically but is *recorded* on the plan as a bounded annotation. That's clean and I'd port it directly.

The third is the **closed staleness loop**: a skill records the node ids its recall recipes cite; editing/forgetting/superseding one of those nodes enqueues the dependent skill with a *typed reason*. This is the only mechanism I've seen that answers "my runbook silently became wrong." It is also the thing you literally cannot build if the procedure lives in a separate store — which is the paper's whole point, earned.

The fourth is **Invariant 1 + walk-time recall bindings**: the SOP body is a pure function of authored text; personal facts bind at walk time via `only_engrams=[…]`. This makes the same artifact simultaneously *portable* and *private*, and it makes procedures legible ("recall the prior tier decisions", not a frozen paste). The `bind_recipes` opt-in preserves personalization without abandoning the default.

**What is weakest.**

The headline number (≈39–45× borrow-vs-spawn) is measured across **two datapoints**, with **different tokenizers on each side**, against a **memory-ablated** spawn arm whose 0/3 grounding is *by construction*, on a harness-specific ≈21.3k maximum. The author says all of this. But then the abstract still leads with "≈39–45× measured separation." The *architectural* claim — a borrow pays no warm-up, O(1) both sides under lazy dispatch — is the honest one and doesn't need the multiple at all.

The routing story has a genuine internal contradiction that §10.7 itself surfaces: the ~99.6% adaptive saving comes from routing **reasoning (51%) and writing (11%)** steps to free local models, and E6 shows local quality on reasoning/writing is **0%**. The paper flags this explicitly and honestly — but the abstract and §1.1 still quote the 99.6% figure as a contribution. Read as: *the routing mechanism is real and the cost accounting is exact; the cost figures are not achievable at retained quality.*

The 73.3% "premium coverage-max" figure is, by the author's own analysis, **a price ratio** (1 − Haiku/Sonnet = 1 − 0.2667) and carries no information about skills, corpora, or routing. It should not have been a headline number; the author de-rates it four separate times and still quotes it in the abstract.

Test availability is the sharpest gap: **three of the five regression suites are not shipped at all**, and the two that are cannot be run standalone. All five pass counts are "internal sidecar CI records." For a paper whose entire epistemic strategy is "guarantees by construction, pinned by model-free tests," unrunnable tests is the load-bearing weakness.

**The reflexive methodology note (§13.1) is worth stealing outright:**

> "The order here was build-first: the substrate, the skill kit, the corpus, and the autonomy engine were envisioned and implemented before this paper existed. What the paper added was not the building but a *reckoning* with it… Several fixes in this work began as sentences that would not survive being written down — the dispatch-but-don't-walk gap (§8), and the chunk-splitting and goal-completeness defects caught while cataloguing the corpus for §9… The lesson is not 'write while you build'; it is that writing a rigorous account *of* a finished system is one of the surest ways to find where it is still wrong. **The manuscript paid for itself in defects surfaced, not only in claims made.**"

---

## 16. What I would model in `effect/Schema` for beep-effect

Design order per repo law: schema → `Context.Service` contract → implementation.

### 16.1 Literal domains (all `LiteralKit`, never hand-rolled unions)

```
SkillNodeRole      = metadata | title | goal | body | recipe | recalled-memory
SkillGoalCategory  = trigger | prerequisites | requires | produces
                   | success | out-of-scope | on-failure | on-completion
SkillEdgeClass     = skill:seq | skill:loop | skill:branch | skill:ctx | skill:calls | skill:goal
CompletionOracle   = tool | state | human            // the [verify:] tag
DispatchSafety     = yes | partial | no              // the [dispatch-safe:] tag
AutonomyLevel      = L0 | L1 | L2 | L3               // ordered; needs an Order instance
RoutingStrategy    = adaptive | local-only | always-best
VitalityBand       = fresh | aging | retrain | stale // derived from score, not stored
RetrainReason      = source-edited | superseded | forgotten
Capability         = reasoning | fast | code | writing | summarization
                   | structured-output | extraction | tone-match | ...
```

The 8-goal contract is a **total record over `SkillGoalCategory`**, not an array — that's what makes "goal completeness" checkable and what the paper's "five thin skills were completed to the full eight-category contract" pass was doing by hand.

### 16.2 The edge-class → substrate-edge mapping is a `MappedLiteralKit`

```
skill:seq    → precedes    @ 0.90
skill:loop   → precedes    @ 0.70   + { max: PositiveInt }
skill:branch → depends-on  @ 0.75   + { when?: Predicate }
skill:ctx    → supports    @ 0.60
skill:calls  → contains    @ 0.95   + { args, capture, onFailure, parallel }
skill:goal   → contains    @ 0.85
```

Encode the parameterized evidence string as an `S.TemplateLiteral` (`skill:loop;max=${Int}`) with a transform — this is *exactly* the bug in Lemma 1: the linker's delete predicate matched the bare literal and missed the parameterized form. A `TemplateLiteral` schema makes that class of bug unrepresentable rather than regression-tested.

### 16.3 `SkillExecutionPlan` — a tagged step union, not an optional-field bag

The paper's `steps[]` is one record with six optional fields. Model it as `S.toTaggedUnion` over step kinds (`Plain`, `Call`, `ParallelGroup`, `LoopBack`, `Branch`) so illegal combinations (a step that both `loopsBackTo` and `branchesTo`) are unrepresentable. Loop caps as `S.Positive` with a schema-level default of 3 (the walker's default) so an uncapped `@loop` decodes into an *explicitly defaulted* cap and the "was this cap authored?" bit survives — the paper needs exactly that bit for the L3 unattended gate, and it currently tracks it out-of-band as "cap source."

### 16.4 Authority — take SPEC §8.2's semantics, not the paper's

```
AuthorityCeiling = S.Option(AutonomyLevel)   // None ≠ unlimited; None = most restrictive
```
with a `Semigroup`/`Order` such that composition is **min**, and `None` is the *bottom*, not the identity. That is SPEC §8.2 rule 4 ("absence is not permission") expressed in the algebra instead of in prose, and it fixes the paper's weaker fallback chain (per-skill → engram default → **global default**), where a permissive global default silently raises un-annotated skills.

Rule 5 ("the writer of a node cannot raise its own ceiling") is a *service-level* invariant, not a schema one: the minting service must take the ambient ceiling from context and clamp.

### 16.5 Vitality is derived, never stored

```
vitality(skill, now) = 100 - min(floor(monthsSince × 5), 25)
                           - round(superseded / total × 50)
                           - round(missingCited / totalCited × 40)
```
Store the inputs (`trainedAt`, node states, cited-node ids), derive the score and the band. Storing the score is what makes it go stale — which is funny, given the paper.

### 16.6 The three things worth porting first, ranked

1. **The cited-node index + typed retrain queue.** The one mechanism that answers "my procedure silently became wrong." Cheap: skills record the ids they cite; an edit/forget/supersede on a cited node enqueues with a typed reason; an idle drainer surfaces one per cycle for confirmation. Directly applicable to beep-effect's `standards/` + skill frontmatter + goal packets.
2. **Storage-order plan compilation with loops as bounded annotations** (Theorem 1) + **per-edge lifetime caps with "reaching the cap is a normal reported outcome"** (Theorem 2 / §5 walker). The LangGraph contrast is correct and the design is better: a per-loop authored cap with a reported stop reason beats a global recursion budget that raises on exhaustion.
3. **One trigger table, several consumers** (§7) — a single generated `trigger → skill` index rendered into `CLAUDE.md`, skill frontmatter, and `.cursorrules` from one source of truth. beep-effect already has skill frontmatter as a prompt-cache prefix; this is the "library advertises itself to its executor" idea, and the lazy-dispatch accounting (index ≈3,034 tokens vs 48,780 inlined) is exactly the context-economy argument the repo's CLAUDE.md already makes.

What I would **not** port: the vitality *formula* constants (arbitrary), the cost figures (pricing identities), and the `@needs`-routes-to-free-local strategy (E6 shows it collapses on judgment work — the very work that dominates the corpus).

---

## 17. Cited prior art worth following up (from §12 and References)

Everything below is actually cited in the document.

**Directly relevant to skills-as-graphs:**
- **CodeAct** — Wang et al. (2024), *Executable Code Actions Elicit Better LLM Agents*, arXiv:2402.01030. Cited as prior art for function-like composition of tools inside one agent.
- **SkillDAG** — arXiv:2606.03056. Cited as recent typed skill-graph composition work.
- **GraSP** — arXiv:2604.17870. Same.
- **OpenAI Agents SDK** — `openai.github.io/openai-agents-python`. Cited for the agent-as-tool pattern.
- **Anthropic Agent Skills** — platform.claude.com/docs, code.claude.com/docs; *Equipping agents for the real world with Agent Skills* (anthropic.com/engineering). Rated in the matrix as "the closest packaged 'skill' format — prose steps, a skill-level model override, forked-subagent composition."
- **Google Agents CLI (ADK)** — cited as build-time skills scoped to a vendor stack.
- **LangGraph** — docs.langchain.com/oss/python/langgraph (graph-api, use-subgraphs, persistence, GRAPH_RECURSION_LIMIT). The paper's primary procedural comparator; `GRAPH_RECURSION_LIMIT` default **25 supersteps**, raises `GraphRecursionError`.

**Memory / retrieval systems (the matrix rows):**
- **Microsoft GraphRAG** — Edge, D., et al. (2024), *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*, arXiv:2404.16130.
- **LightRAG** — Guo, Z., et al. (2024), arXiv:2410.05779, github.com/HKUDS/LightRAG. Plus *LazyGraphRAG* (Microsoft Research blog, 2024) — "blog-described and unreleased."
- **Mem0** — arXiv:2504.19413, docs.mem0.ai.
- **Zep / Graphiti** — Rasmussen, P., et al. (2025), *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*, arXiv:2501.13956.
- **MemAgent** — arXiv:2507.02259, github.com/BytedTsinghua-SIA/MemAgent. "An RL long-context compression technique — a fixed memory panel overwritten per chunk, with no stored procedure at all."
- **Letta / MemGPT** — Packer, C., et al. (2023), arXiv:2310.08560. Rated the closest on co-location + vitality: "by versioning prose 'skills' in a git-versioned memory store and consolidating in sleep-time passes."
- **A-MEM** — arXiv:2502.12110, github.com/agiresearch/A-mem. Zettelkasten-style declarative notes.

**Routing / cascades:**
- **RouteLLM** — Ong, I., et al. (2024), arXiv:2406.18665, github.com/lm-sys/RouteLLM.
- **FrugalGPT** — Chen, L., Zaharia, M., Zou, J. (2023/2024), arXiv:2305.05176, TMLR 2024.

**The LLM-Wiki / compile-not-retrieve thread (interesting and under-followed):**
- **Karpathy's LLM-Wiki pattern** — "an idea file, not a paper" — and its Obsidian / Claude-Code descendants.
- **LangChain, *Wiki Memory*** — Chase, H. (2026), langchain.com/blog/wiki-memory (2026-06-30). Quoted: "an agent-maintained data structure that represents source knowledge in an agent-friendly way." Also Broekhuizen, J. (2026), *How To Give Your Agent Memory* (2026-06-24); *How we built Agent Builder's memory system* (2026-02-21); *Everything we shipped at Interrupt* / Context Hub announcement (2026-05-14).
- **LangSmith Context Hub** (announced May 2026) — "versions and tags skills-as-prose-files in a central hub"; the trace-driven Observability→Engine→Context Hub improvement loop (June 2026) is called "the nearest managed analogue of the retrain loop."
- Karpathy's **agentic engineering** (spec design, eval loops, security oversight).

**Neuroscience (§15) — all real, all correctly used as analogy only:**
- [1] Miller, E. K., & Cohen, J. D. (2001). *An integrative theory of prefrontal cortex function*. Annual Review of Neuroscience, 24, 167–202.
- [2] Graybiel, A. M. (2008). *Habits, rituals, and the evaluative brain*. Annual Review of Neuroscience, 31, 359–387. Also Graybiel (1998), *The basal ganglia and chunking of action repertoires*, Neurobiology of Learning and Memory, 70(1–2), 119–136.
- [3] McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). *Why there are complementary learning systems in the hippocampus and neocortex*. Psychological Review, 102(3), 419–457.
- [4] Josselyn, S. A., & Tonegawa, S. (2020). *Memory engrams: Recalling the past and imagining the future*. Science, 367(6473), eaaw4325.
- [5] Nader, K., Schafe, G. E., & LeDoux, J. E. (2000). *Fear memories require protein synthesis in the amygdala for reconsolidation after retrieval*. Nature, 406(6797), 722–726.
- [6] Loftus, E. F. (2005). *Planting misinformation in the human mind*. Learning & Memory, 12(4), 361–366.
- [7] Graybiel, A. M., & Rauch, S. L. (2000). *Toward a neurobiology of obsessive-compulsive disorder*. Neuron, 28(2), 343–347.
- [8] Everitt, B. J., & Robbins, T. W. (2005). *Neural systems of reinforcement for drug addiction*. Nature Neuroscience, 8(11), 1481–1489.
- [9] Albin, R. L., Young, A. B., & Penney, J. B. (1989). *The functional anatomy of basal ganglia disorders*. Trends in Neurosciences, 12(10), 366–375.
- [10] Crittenden, J. R., & Graybiel, A. M. (2011). *Basal ganglia disorders associated with imbalances in the striatal striosome and matrix compartments*. Frontiers in Neuroanatomy, 5, 59.
- [11] Eslinger, P. J., & Damasio, A. R. (1986). *Preserved motor learning in Alzheimer's disease*. Journal of Neuroscience, 6(10), 3006–3009.

**Companion:** Lazar, N. (2026). *The Un-Brain: A local-first, indelible knowledge multi-graph for private AI memory with deterministic, owner-adjudicated contradiction handling*. DOI 10.5281/zenodo.20843387.

**Artifacts named:** `github.com/nehloo/graphnosis-trained-skills` (a signed `.gsk` "curated engineering subset"; the full 76/108-skill corpus is **not published**); `route-b-artifacts/` in that pack repo (`route-b-results.md`, `lib/model-registry.ts` + `CHECKSUMS.txt`, `borrow-cost.ts`, `borrow-spawn-runs.json`, `tests/`).

---

## 18. §15.4 — the Un-Ganglia failure-mode table (transcribed, flagged as expository only)

The paper is emphatic: "**This table is an expository analogy and carries no experimental content.** The mapping is illustrative only: the engineering guarantees in the right-hand column constrain the *software* control flow, and we make no claim that they bear on, explain, or 'rule out' the clinical or biological disorders named on the left."

| Brain glitch (analogy only) | What goes wrong, in the brain | The *software* design property the analogy points to |
|---|---|---|
| **OCD / compulsion** [7] | A cortico–striato–thalamo–cortical loop re-fires and cannot reach a stop state | A *capped*, contract-honoring walk runs under a composed termination bound — per-loop iteration caps composed with the depth-3 recursion limit — so it cannot loop without end; the shipped walker enforces it in code, capping even an uncapped `@loop` at its default; only `parallel[]` dispatch lies outside the shipped path |
| **Habit capture / addiction** [8] | Over-trained striatal habits drive behavior stimulus-first after the goal has moved on | A skill fires only when dispatch matches its trigger to the *live* goal, runs under the per-step autonomy ceiling, and loses *vitality* and drops out of dispatch when stale. A stale or off-goal skill is down-weighted and drops out rather than driving behaviour on its own |
| **Perseveration** | Striatal/prefrontal dysfunction locks behavior into a task-set the situation has outgrown | Dispatch re-selects every turn against the current goal — change the goal, change the skill; there is no set to get stuck in |
| **Parkinson's — under-gating** [9] | Dopaminergic under-activity impairs *initiation* of an intended action (akinesia) | Selection is a deterministic read of the trigger index — a matched, capability-feasible goal yields a runnable plan with no stochastic initiation step, though a match can still fail to fire when prerequisites or qualifying models are missing |
| **Huntington's — over-release** [9] | Striatal degeneration releases *involuntary, unselected* movement (chorea) | The autonomy engine forbids any step from running above its authored dispatch-safe ceiling, bounding *unselected* escalation (it does not eliminate model or tool errors within a selected step) |

Set apart as a cross-boundary case:

| Cross-boundary case | Biological dissociation | Where Un-Brain and Un-Ganglia meet |
|---|---|---|
| **Alzheimer's / declarative dementia** [11] | Progressive declarative-memory loss can coexist with comparatively *spared* overlearned procedural skills — a memory/procedure **dissociation**, **not** a claim that Alzheimer's is a basal-ganglia disorder | Un-Ganglia holds procedures as separate, bounded, inspectable Skill subgraphs and makes them not merely resilient but **indelible**; and because every skill grounds in the same substrate, the shared cortex keeps the *declarative* facts it binds at walk time indelible and owner-adjudicated too. "The brain's dissociation shows procedure outlasting memory; the architecture inherits that ordering and then *removes the asymmetry* — neither half is left to decay." |

§15.3's four departures from biology: **decay vs indelibility**; **confabulation/false memory vs determinism** ("The Graphnosis cortex does not reconstruct on read"); **interference and fatigue vs stable, bounded execution** ("There is no fatigue term and no cross-task interference"); **silent overwrite vs owner adjudication**.

---

## 19. Figure S3 — "One SOP, Three Encodings" (p39), transcribed

The clearest single statement of the contribution:

- **(a) Flat prompt text** — "First, read the inputs. Then validate each field and check the schema. If valid, transform and write the result; otherwise log the error and retry once. Finally, emit a summary…" — labeled "prose — no structure", "re-pasted each session", tagged **established practice**.
- **(b) Workflow-engine graph** — boxes `read inputs → validate → transform → emit summary` inside a frame labeled "separate runtime & store", footnote "lives outside the memory graph — must be joined", tagged **established practice**.
- **(c) Typed-edge subgraph in memory** — the same four steps inside a "skill subgraph / typed edges: skill:seq" box, itself inside a frame labeled "owner-held indelible memory graph", surrounded by four circles `fact`, `entity`, `event`, `note` with dashed lines labeled "dashed = recall-bound to memory", tagged **Graphnosis's contribution**.

Caption: "Only (c) is co-located with declarative memory, indelible, and recall-bound — the synthesis this paper claims (§12)."

---

## 20. §14 — the twelve MCP tools (the API surface)

| Tool | Purpose |
|---|---|
| `list_skills` | every skill with metadata (discovery) |
| `get_skill` | fetch one trained skill's rendered output |
| `train_skill` | train or retrain (in-place; one source per skill; writes a snapshot to history). **Gated.** |
| `export_skill` | write a signed `.gsk` pack (AES-256-GCM + Ed25519). Magic bytes `GSK\x01`; older `.gts` extension still imports. **Gated.** |
| `delete_skill` | soft delete |
| `walk_skill` | step-by-step narrative SOP text with ⟲ (loop) / ⤳ (branch) / ⊕ (sub-skill) annotations — for *explaining* to a person |
| `walk_skill_structured` | the `SkillExecutionPlan` JSON contract — *"Prefer this for any procedural execution task"* |
| `save_skill_run` | persist captured vars + progress; returns a `runId` |
| `resume_skill_run` | reload by `runId`: captured vars, last completed step, `nextStepIndex` |
| `skill_history` | snapshot chain (mode, timestamp, diff summary) |
| `rollback_skill` | restore a prior snapshot (itself recorded as a new snapshot; lineage preserved) |
| `skill_vitality` | per-skill 0–100 health |

**Notable absence, stated by the paper:** "this surface exposes **no one-call `.gsk` skill-pack import**: engram `.gez` pack import ships and lands in a quarantined scope (§11), but importing a signed `.gsk` skill pack in a single call is not among these twelve tools — which is why E1's transport was shown via a source-grounded retrain into the recipient engram rather than a true pack import."

Sidecar file map (§14): `skill-trainer.ts` (compilation, SOP edge linkers, snapshots, vitality, hollow-skill repair) · `skill-sop-rewrite.ts` (structure-preservation validator) · `model-router.ts` + `model-registry.ts` (per-step capability routing, model catalog) · `agent-walker.ts` (reference walker + routing-savings accounting) · `skill-runs.ts` (resumable runs) · `skill-call-links.ts` (cross-engram call side-table) · `proactive-watcher.ts` / `proactive-dispatch-match.ts` (dispatch) · `savings-tracker.ts` (cost ledger) · `gsk-format.ts` (signed packs).

**Acknowledgments note worth recording:** "Implementation was AI-assisted under the author's design specifications: the Skill Subgraph was built with **Claude Code (Anthropic)**, which also read the repository and the author's own sessions to **train the skill corpus** documented here… the claims were then stress-tested two ways — **internal multi-agent adversarial review orchestrated with Claude Code** (fan-out finders with adversarial verification of every finding), and **independent, adversarial ('hostile') review by GPT-5.5 (OpenAI) and Fable 5 (Anthropic)** over several iterations… **No AI system is an author.**"
