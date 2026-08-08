# Graphnosis survey — territory: agent/MCP tool surface, skills, authority ceiling

Repo surveyed: `/home/elpresidank/YeeBois/dev/Graphnosis` @ `7a19c4b` (npm `@nehloo/graphnosis` v0.11.0, Apache-2.0).
Files read in full: `GRAPHNOSIS.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/launch.json`, `SPEC.md` §8 (332–582),
`src/mcp/{server,graph-session,tfidf-cache}.ts`, `src/mcp/tools/{load_graph,ingest_files,update_graph,query,export}.ts`,
`src/sdk/index.ts` (1626 lines), `src/sdk/log-redact.ts`, `src/sdk/adapters/{openai,local,static}.ts`,
`src/core/errors.ts`, `src/core/query/subgraph-serializer.ts`, `buildGraphPrompt` in `src/core/query/query-engine.ts`,
`enterprise/enterprise.md` (targeted sections), `package.json`, `ROADMAP.md`, `CONTRIBUTING.md`, `src/cli/index.ts`.

---

## 0. The single most important structural fact about this territory

**There are two different agent surfaces in this repo and they do not overlap.**

| | the OSS MCP server | `GRAPHNOSIS.md` |
|---|---|---|
| Where | `src/mcp/server.ts` | repo root |
| Version | package.json `0.11.0` | file line 3 says `v1.13.0` |
| Tools | **5**: `load_graph`, `ingest_files`, `update_graph`, `query`, `export` | **~48 in 10 groups**: `recall`, `remember`, `dig_deeper`, `edit`, `walk_skill_structured`, … |
| Domain vocabulary | graphs, sessions, `.gai` files | *engrams*, *cortex*, *vitality*, *Skills engram*, `.gnn`/`.gll` overlays |

`GRAPHNOSIS.md` is the **closed-source desktop app's** agent instruction sheet, checked into the Apache-2.0
engine repo with no header saying so. `README.md:512-516` admits it obliquely: *"Parts they discuss that sit
above the library — the MCP surface, encrypted sync — are separate repositories."*

This matters for mining because **almost all of the interesting agent-surface design is in `GRAPHNOSIS.md`
and `SPEC.md` §8, i.e. in documents, not in code.** `src/mcp/*` is a thin, competent, unremarkable 5-tool
stdio/HTTP wrapper (~370 LOC total) — and it has real defects (§7 below). The intellectual product here is
the *instruction design* and the *format-level authority model*, not the server.

Treat `GRAPHNOSIS.md` as a spec of a system you can read but not run, and `SPEC.md` §8 as an explicitly
labelled **proposal** (`SPEC.md:334` — *"Status: PROPOSAL. Nothing here is implemented."*).

---

## 1. Tool taxonomy: intent for the first six groups, determinism for the last four

`GRAPHNOSIS.md:8`:

> The MCP tools are organized into **10 groups** — pick by intent; the tool name shapes the audit footer.

The ten groups, with counts, in file order:

| # | Group | Count | Axis |
|---|---|---|---|
| 1 | Core memory (`GRAPHNOSIS.md:77`) | 8 | intent |
| 2 | Engram discovery (`:101`) | 5 | intent |
| 3 | Structured recall (`:108`) | 4 | intent (output *shape*) |
| 4 | Source operations (`:114`) | 3 | intent |
| 5 | Engram operations (`:120`) | 2 | intent |
| 6 | Skills / SOPs (`:126`) | 12 | intent (procedural memory) |
| 7 | Brain maintenance (`:168`) | 5 | **contract** — "read-only windows into the background brain" |
| 8 | Approximate (`:180`) | 2 | **determinism tier** — "similarity scans, no LLM" |
| 9 | Conditional (`:184`) | 1 | **determinism tier** — "deterministic by default, LLM-aware when enabled" |
| 10 | Non-deterministic (`:191`) | 6 | **determinism tier** — "require local LLM (Ollama) on the user's machine" |

The mechanism worth stealing: **the axis switches deliberately.** An agent picks group 1–6 by *what it is
trying to do*, because those tools always work. It picks 7–10 by *what guarantee it will get and whether the
tool is even available*, because those tools' behaviour and availability vary at runtime. Two of the three
determinism-tier group headers *are* the tier name ("Approximate", "Non-deterministic"), so the tier is
unavoidable when reading a tool list — it isn't buried in a description.

`GRAPHNOSIS.md:191` makes the availability consequence explicit for tier 10, and `:219-221` gives the agent a
behavioural rule for it:

> **Don't assume the LLM is on.** `insights`/`develop`/`predict`/`llm_query`/`llm_distill` may return
> "Local LLM unavailable"; surface plainly with the toggle path. Don't pretend the feature ran.

### 1a. The per-call determinism self-report

The "Conditional (1)" group contains exactly one tool, `edit`, and it resolves the ambiguity by **reporting
its own tier per call** (`GRAPHNOSIS.md:189`):

> The `mode` field reports which path ran (`deterministic` / `gnn-expanded` / `llm-assisted`).

This is the sharpest single idea in the tool-surface design. A tool that *can* be deterministic depending on
host configuration is otherwise unusable by an agent that needs to know how much to trust the result. The fix
is not to split it into three tools; it is to make the tier a field on the response. The agent learns the
tier of *the actual call*, not the tier of the tool.

### 1b. Tool name → audit footer

`GRAPHNOSIS.md:8` also says *"the tool name shapes the audit footer"* — i.e. which tool the agent chose is
recorded in the user-visible provenance of the response. That closes a loop: naming is not cosmetic, and an
agent that reaches for `dig_deeper` when `recall` would do leaves a trace the user can see.

---

## 2. The "two non-negotiable habits" — instruction design that pre-empts the model's own excuses

`GRAPHNOSIS.md:10-21`. Verbatim, because the phrasing is the artifact:

> ## The two non-negotiable habits
>
> 1. **Recall first, answer second.** For any question that leans on prior context — past decisions,
>    preferences, "what did we say about X?" — call `recall`/`remind` **before** answering, **even if your own
>    history looks empty**. Graphnosis persists across sessions and AI clients.
> 2. **Remember proactively, in the user's words.** When the turn produces something durable — a decision
>    (with one-line reason), a to-do, a draft, an open question, a new lasting fact — call `remember`.
>    **Don't wait to be asked.** Save in the user's language; **never translate "for safekeeping"**.
>    Route topical notes with `target_engram`; call `stats` if you don't know the engrams yet.

Four separate anti-rationalization clauses, each aimed at a specific failure the author has evidently
watched happen:

1. *"even if your own history looks empty"* — kills the model's most natural reason to skip recall: the
   context window contains nothing about X, therefore there is nothing about X.
2. *"Don't wait to be asked"* — kills deference as an excuse for not writing.
3. *"never translate 'for safekeeping'"* — kills a *helpful* behaviour that silently destroys retrievability,
   because the index is lexical (§3). The scare-quoted rationalization is quoted back at the model.
4. *"call `stats` if you don't know the engrams yet"* — removes the "I don't know where to put it" excuse by
   naming the tool that answers it.

Structural points: there are exactly **two** habits, they are labelled **non-negotiable**, and they come
before the tool list. Contrast with the usual MCP instruction pattern of a flat alphabetized tool dump.

Compare the counterpart "keep the memory clean" block (`GRAPHNOSIS.md:48-55`), which carries the single most
operationally important rule in the file:

> **To fix / update / add detail, use `edit` — never a second `remember`.** A second `remember` creates a
> conflicting duplicate.

and it is repeated inside the `edit` tool description itself (`:187-189` — *"**Never use `remember` to
modify** — creates a conflicting duplicate"*). Deliberate redundancy at the two places the agent will be
reading when it makes the mistake.

---

## 3. Teaching the agent to query well — a curriculum keyed to the engine's actual blind spots

`GRAPHNOSIS.md:23-46`. This is, in my judgement, the rarest thing in the repo. Header:

> ## Query well — recall quality lives or dies here
> Before any search tool, transform the user's utterance into a query:

Five rules. What makes them unusual is that **each one names the retrieval-engine property that motivates
it**, so the model can generalize rather than pattern-match:

| Rule | The stated mechanism behind it |
|---|---|
| **Strip framing** (`:27-29`) | — (pure query hygiene). Example given in Romanian: *"Remind me where Nelu lived" → `unde a locuit Nelu`*. Explicitly *"in any language"*. |
| **Match the storage language** (`:30-35`) | *"The lexical index does not bridge languages."* Heuristic supplied: query in the language(s) seen this session; if unknown, current input language **plus** any other the user has used **plus** English. *"Zero results → retry in 1–2 other plausible languages before declaring nothing found."* |
| **Add 1–2 same-language synonyms** (`:36-37`) | *"('locuit' won't match 'trăit'; 'live' won't match 'reside'). **TF-IDF has no semantic awareness.**"* |
| **Keep it dense** (`:38-39`) | *"3–8 content words. No 'the/a/is', no full sentences, no punctuation."* (stopword filtering + tf weighting) |
| **Anchor on proper nouns** (`:40-42`) | *"Verbatim spelling and capitalisation. Names, places, projects, URLs, dates are the strongest signal. **Never transliterate** (don't turn 'Nelu' into 'ネル')."* (idf — rare tokens dominate) |

Then a worked cross-lingual example (`:44-46`):

> Example (Arabic user, French-stored memory):
> `مشروع تسويق projet marketing proposition` — translate key content words, keep proper nouns intact, add
> same-language synonyms.

Three things to note as *design*, separate from the content:

- **It is placed before the tool list.** The agent reads how to query before it reads what to call.
- **The zero-result retry policy is quantified** ("1–2 other plausible languages") rather than left as
  "try harder", so it terminates.
- **It teaches the limitation, not the workaround.** *"TF-IDF has no semantic awareness"* is a statement a
  model can reason from; "add synonyms" alone is a rule it will forget.

The engine-side facts backing all of this are real: `src/sdk/index.ts:290-297` documents that the analyzer is
`asciiFoldEnAnalyzer` (diacritic-folded ASCII + **English** stopwords) by default, and
`src/sdk/index.ts:840-905` (`migrateAnalyzer`) records the incident where the historical default filtered the
union of sixteen languages' stopwords, so *"'car' in French, 'war' and 'die' in German — were dropped from
every document at ingest. A graph built that way cannot match a query containing them, and no amount of
re-querying fixes it, because the terms are absent from the index rather than merely ranked low."*

---

## 4. Escalation, in-band hints, and provenance accounting

### 4a. Escalation policy written into the tool description

`GRAPHNOSIS.md:78-84`:

> - `recall` — semantic search; ready-to-read context block. **Escalation policy:** 0–3 nodes (or nodes that
>   don't answer the question) → call `dig_deeper` with the same query **before** saying "nothing found".
>   **If your client uses deferred schema loading, pre-load `dig_deeper` before the first `recall`.**

Two mechanisms:

1. **A numeric trigger plus a semantic trigger** (`0-3 nodes` OR `nodes that don't answer`), and a *forbidden
   utterance* ("nothing found") that the agent may not emit until the escalation has run. Aliasing is handled
   by making the alias inherit the policy explicitly: `remind` is *"alias for `recall`, same input + results
   + escalation policy"* (`:83`).
2. **Harness-awareness.** The instruction knows that some clients defer tool-schema loading (exactly the
   `ToolSearch` mechanism in this Claude Code session) and tells the agent to warm the escalation tool
   *before* the call that might need it — because discovering you need `dig_deeper` mid-turn costs a
   round-trip. I have not seen this written into an MCP instruction file before.

### 4b. In-band hints that redirect the agent mid-flow

`GRAPHNOSIS.md:85-88`:

> `dig_deeper` — … Watch the response for a `💡 The query entities also match source-file names…` hint with
> sourceIds — **stop and call `recall_source` on those IDs** before composing your answer; a whole document
> is relevant.

The tool *result* carries a control signal, and the instruction file teaches the agent to recognize and obey
it. This is a cheap way to get adaptive multi-hop behaviour without a planner: the retrieval layer knows
something the agent doesn't (that the match is document-level, not chunk-level) and says so in a token the
agent has been trained to look for.

### 4c. Per-stage provenance accounting with a mandated user-facing consequence

`GRAPHNOSIS.md:272-294`. `dig_deeper` output is a labelled three-stage structure:

```
[Stage 1: standard recall subgraph]

## DIG_DEEPER — Source-filename expansion
### Engram Name (additional chunks from matched source filenames)

## DIG_DEEPER — Cross-engram entity hop
_Pulled via shared entities: EntityA, EntityB_
### Engram Name
```

followed by italic provenance bullets giving node counts per stage:
`_• Content match (recall): N nodes…_`, `_• Source-filename expansion: N nodes from M source(s)…_`,
`_• Cross-engram entity hop: N nodes via M shared entities…_`.

Then (`:292-294`) the part that makes it more than telemetry:

> If indirect stages dominated (>60% of nodes), a ⚠️ heads-up follows — when you see it, surface that the
> answer is mostly indirect expansion, not a direct content match, and invite the user to rephrase.

A quantified retrieval-quality threshold, computed server-side, that changes **what the agent must say to the
user**. Most RAG systems compute this kind of signal and throw it away, or surface it as a score the model
ignores. Here it is (a) a boolean the agent cannot misread, and (b) attached to a prescribed utterance.

---

## 5. Layered memory: `.gai` / `.gnn` / `.gll` — write privilege enforced by file separation

`GRAPHNOSIS.md:226-238`:

| Layer | File | Contains | Mutable by |
|---|---|---|---|
| Canonical | `.gai` | Every memory the user attested (or you saved on their behalf) | Only the user, via approved `edit` diffs |
| Neural network overlay | `.gnn` | Predicted edges from a local GNN | The GNN's training pass; user discards via UI |
| Local LLM overlay | `.gll` | Predicted edges + synthesised assertions from the local LLM | The LLM's inference loops; user discards via UI |

> The LLM and the GNN **cannot** mutate `.gai`. The only path to attested change is an `edit` diff the user
> approves. **This is structural — different files, different write privileges.**

That last sentence is the finding. The guarantee is not a check in a function that could be forgotten; it is
a filesystem-level partition. An overlay engine physically cannot write the canonical file.

The capability table at `GRAPHNOSIS.md:203-215` makes the write-target of every optional LLM capability
explicit, with a dedicated **"Writes to graph?"** column:

| Capability | Effect | Writes to graph? |
|---|---|---|
| Recall enrichment | Rewrites your query at recall time | No |
| Correction parsing | Upgrades `edit` to author multi-edit diffs | Only after user approval |
| Distillation | Powers `llm_distill` | No |
| Insights / predictions | Powers `insights`/`develop`/`predict`/`llm_query` | Writes to `.gll` overlay only |
| Edge prediction | Background loop proposing connections | Writes to `.gll`, **never to `.gai`** |
| Skill training (Pro) | LLM-rewritten skill body, attribution preserved | Writes to `.gai` **only after the user trains** |

### 5a. How the layers surface in a recall response

`GRAPHNOSIS.md:240-257`. Four ordered sections:

1. `=== KNOWLEDGE SUBGRAPH ===` per engram — *"drawn purely from `.gai`, the authoritative answer."*
   Node format `[shortId|nodeType|score|src:label|date:YYYY-MM-DD] content`; edges `n1 -[edgeType:weight]-> n2`
   (directed) or `n1 ~[edgeType:weight]~ n2` (undirected); a `--- SESSION SUMMARIES ---` block whose
   `claims:` line is pipe-separated atomic facts.
2. `--- CROSS-GRAPH CONNECTIONS ---` (multi-engram only) — *"Attested; derived from `.gai`."*
3. Audit footer + footnotes — `_anchored on entities: …_`, `_GNN expanded recall by N node(s) at ≥65%
   confidence_`, `_enriched: "…" → "…"_`.
4. `--- INFERRED LAYER (overlays — NOT attested memory) ---`, rows tagged `[gll·assertion N%]`,
   `[gll·edge N%]`, `[gnn·edge N%]`.

**Attested content comes first; inferred content comes last and is fenced by a header that says what it is
not.** The per-row tags carry engine + kind + confidence in six characters.

### 5b. The four agent rules for the inferred layer (`GRAPHNOSIS.md:259-271`)

- **Cite as a prediction, not a fact.** *"Based on a local-LLM inference with ~78% confidence" — never "you
  said X" when X is from `[gll·…]`.*
- **Attested wins on conflict.** *"If `.gai` says Bucharest and `[gll·…]` infers Cluj, mention the
  discrepancy and offer `edit`."*
- **Never `remember` an inferred row.** *"That promotes a prediction to attested memory — **the failure mode
  overlays exist to prevent**. If the user confirms the inference, save the user's confirmation as a new
  attested memory."*
- **`forget` doesn't touch overlays.** *"It operates on `.gai` node IDs only. Overlay content is wiped via the
  Foresight controls."*

The third is the load-bearing one. The whole layering scheme is defeated by one careless `remember` of an
inferred row, and the instruction names that as the failure mode by name. The escape hatch it offers —
re-save the *user's confirmation*, not the inference — keeps provenance honest: the attested memory's source
is the human, which is true.

`:224` also handles the invisible-rewrite problem: *"Recall enrichment, when on, is invisible. Your query is
rewritten server-side; a `_enriched: "…" → "…"_` footer shows what ran. Informational — don't try to undo
it."* An agent that sees its query changed will otherwise try to compensate.

---

## 6. Sensitivity, consent, and the headless fallback

`GRAPHNOSIS.md:57-73`. Three tiers per engram: `public`, `personal`, `sensitive`.

- Routing rule: *"Route private content (credentials, health, finances) to a personal or sensitive engram —
  never to public."*
- **`public` and `personal` recalls are silent. `sensitive` recalls trigger an in-app one-click consent modal
  (Allow / Deny / Allow-1h / Allow-today).** Four-option modal, two of them time-boxed — that is a real
  consent-UX decision, not a yes/no.
- **Federated recall auto-excludes sensitive engrams you lack consent for; the gate only fires when you
  explicitly name a sensitive engram via `only_engrams` / `target_engram`.** i.e. the *broad* query silently
  narrows, and only an *explicit* request for the sensitive engram interrupts the user. This is the right
  default: consent prompts fire on intent, not on breadth.
- The consequence the agent must internalize (`:66-67`): **"Recalls may be partial — don't assume you can see
  everything stored."** An agent that assumes completeness will report "you never told me about X" when in
  fact X is behind a consent gate.

### 6a. The headless consent-phrase protocol (`GRAPHNOSIS.md:69-73`)

> **Headless fallback (SSH / Docker / CI):** if a recall returns `⚠️ GRAPHNOSIS CONSENT REQUIRED`, present the
> notice **verbatim**, tell the user to open **Settings → AI → Consent Phrases**, wait for them to type it,
> call `confirm_data_access({phrase, tier})` with exactly what they typed, then retry. **If they type SKIP, do
> not retry and do not invent the phrase.**

An out-of-band, human-typed shared secret used as the consent channel when there is no UI to click. The agent
is a courier: it must relay the notice *verbatim*, relay the reply *exactly*, and is explicitly forbidden
from synthesizing the phrase. `confirm_data_access` is listed under "Brain maintenance" (`:178`) with a
pointer back to this section. The `SKIP` sentinel gives the user a refusal that terminates the loop rather
than leaving the agent retrying.

---

## 7. `maxAutonomy` — the authority ceiling travels with the memory (SPEC.md §8.2)

`SPEC.md:417-462`. **PROPOSAL, not implemented** (`SPEC.md:334`). The framing (`:419-428`):

> A skill that may act on its own carries a limit on how far it may go. In v1 that limit is not expressible
> in the file, so it can only live in the application holding it — and a `.gai` moved to a different
> application therefore arrives with its procedure intact and its constraints absent. The receiving side has
> no way to learn that a step was never meant to run unattended, **and no way to discover that it is missing
> something.**
>
> Putting the ceiling in the file is what makes the guarantee survive transport, and it is the format-level
> statement of a requirement the procedure itself cannot be trusted with: **what proposes an action does not
> approve its own limits.**

The field:

```
maxAutonomy?: 'L0' | 'L1' | 'L2' | 'L3'      // L0 < L1 < L2 < L3
// L0 = never act unattended;  L3 = may act unattended within the host's own policy
```

**The five rules that turn it from decoration into a ceiling** (`SPEC.md:439-458`) — these are the finding,
not the enum:

1. **A ceiling is a maximum, never a grant.** A host MUST NOT execute above it; MAY execute below it; MAY
   refuse entirely. *"The field can only ever lower authority."*
2. **Monotone under composition.** A subgraph's effective ceiling is the **MINIMUM** over its member nodes.
   *"Borrowing a skill therefore cannot raise the ceiling of the graph that borrows it — the strictest member
   governs."* This is the rule that makes composition safe: pulling in a third-party SOP can only tighten you.
3. **It survives transport.** Because it is node metadata it rides the same `serializeSubgraph` envelope as
   the steps. Export → import preserves the ceiling.
4. **Absence is not permission.** A node with no `maxAutonomy` is **UNSPECIFIED, not unlimited**; a conforming
   host MUST treat unspecified as the most restrictive level it supports for unattended execution.
   *"This is the rule that makes the field fail closed, and it is the difference between a ceiling and a
   suggestion."*
5. **The writer of a node cannot raise its own ceiling.** A process minting or editing a node MUST NOT set
   `maxAutonomy` above the ceiling of the context it is running in. Restates the §4 Grounded-Engineering
   requirement at the format level.

Then the honesty (`:460-462`):

> **Honest limitation.** This is advisory unless a conformance level mandates it. An L2 reader that ignores
> `maxAutonomy` still parses the file correctly. That is why §8.3 exists: **the field is only as strong as the
> level that requires it.**

Rules 2 and 4 together are the transferable core: *min over members* + *fail closed on absence*. Together they
mean an unknown or malformed skill can only reduce authority, never increase it — the monotonicity is what
makes borrowing arbitrary artifacts tractable at all.

---

## 8. Conformance declared per layer, with an argument for why retrieval is *not* conformance

`SPEC.md:464-483`:

> Conformance is declared per layer, because the layers have genuinely different requirements. **A file format
> benefits from many independent implementations: that is what proves the bytes are unambiguous. A retrieval
> engine does not — ranking is a design position, and two engines that rank differently are not two
> implementations of one thing.** Stating a single, undifferentiated "conforming" would force those two facts
> into one claim and make it useless.

| level | covers | a conforming implementation must |
|---|---|---|
| **L1 — container** | §1 byte layout, §2 header, §4 integrity | frame, checksum-verify and reject per §5.1 |
| **L2 — model** | §3 node/edge model, §8.1 `(id, rev)` | round-trip every node, edge, revision and metadata field without loss; honour §8.2 rule 4 (unspecified is restrictive) |
| **L3 — retrieval + authority** | §5.3 traversal, §8.2 ceilings in full, skill execution per §8.4 | **enforce `maxAutonomy` as a hard gate**; implement path-maximum traversal |

> **Most implementations need only L1 or L2, and declaring L2 is a complete claim, not a partial one.** …
> `maxAutonomy` is enforceable at L3, and an implementation declaring L3 while ignoring it is non-conforming —
> without that, §8.2 is advisory text.

Two things here:

- **"Declaring L2 is a complete claim, not a partial one"** removes the social pressure to over-claim. Most
  levelled-conformance schemes make lower levels feel like failure; this one explicitly says the opposite,
  and gives the reason (L2 = every memory round-trips faithfully; it just doesn't promise to *rank* them the
  same way).
- Note the **cross-layer obligation**: L2 must honour §8.2 rule 4 (unspecified ⇒ restrictive) even though L2
  does not enforce ceilings. The fail-closed default is pushed *below* the level that implements the feature,
  so a merely-model-conforming reader can't accidentally treat an unspecified ceiling as unlimited.

Related §8.0 governing constraint (`SPEC.md:339-376`), which is process craft worth noting: *"A format that
breaks twice has taught the market that it breaks"*; everything in v2 lands together or not at all; after v2,
extension goes through a `requires[]` must-understand list in the header so a reader *"refuses on an unknown
feature tag, never on an unknown version"* (PNG/Matroska precedent, version number *"vestigial by design"*);
three admissible reasons for a v3 named in advance *"because 'never' is not credible"*; **magic bytes do NOT
change**, because *"a format that reports version skew as a wrong-format error teaches its own tooling to
treat upgrades as corruption"* (`:368-370`) — which is the same insight as the error taxonomy in §11.

---

## 9. Skill subgraphs — structural, not a new node kind (SPEC.md §8.4)

`SPEC.md:485-522`.

> A skill is a procedure stored as memory: an ordered chain of steps, **in the same graph, in the same file,
> addressable by the same ids as everything else.**
>
> The representation is **structural rather than a new node kind** — a skill is ordinary nodes and ordinary
> edges, distinguished only by the edge type and evidence tag below. **An L1 or L2 implementation therefore
> needs no skill support at all: it round-trips them correctly by round-tripping nodes and edges.**

The convention, normatively (`:497-511`) — all four are `precedes` directed edges discriminated by the
`evidence` string:

| construct | edge | `evidence` |
|---|---|---|
| step sequence | `precedes` | `skill:seq` (chain order = step order) |
| loop | `precedes` | `skill:loop;max=N`, N a positive integer |
| branch | `precedes` | `skill:branch;when=<predicate>` |
| call to another skill | `precedes` | `skill:call;target=<id>` |

- Contract (trigger, prerequisites, produces, success criterion, out-of-scope) lives in **node metadata on the
  head step**.
- Subgraph ceiling = **MIN `maxAutonomy` over its steps** (§8.2 rule 2).
- **"A loop without a bound is invalid — an unbounded loop in a borrowable artifact is an unbounded
  obligation."** (`:502-503`) — the single best line in the spec.
- **Reader obligations** (`:519-522`): an **L3 implementation MUST refuse to execute** a skill subgraph whose
  loop edges lack bounds, and MUST apply §8.2 rule 2 before executing any step. L1/L2 treat them as ordinary
  nodes and edges, *"which is exactly what they are on disk"*.
- **Out of scope on purpose** (`:513-517`): how a skill is *authored or trained*. *"An implementation can be
  fully conforming without being able to train anything."*

Why this is good: representing procedures as a *tagged pattern over the existing node/edge model* means
(a) zero format change for readers who don't care, (b) skills inherit every property of memories for free —
provenance, retirement, supersession, HMAC signing, ceilings — and (c) the same query engine that retrieves
facts retrieves procedures. Note the deliberate divergence: `GRAPHNOSIS.md:130-131` lists **five** shipped
edge types (`skill:seq`, `skill:loop`, `skill:branch`, `skill:ctx`, `skill:calls`) while the spec normalizes
to **four** (`skill:ctx` dropped, `skill:calls` → `skill:call;target=`). The spec is the tidied version of
what shipped.

---

## 10. The skills tool surface: paired explain/execute tools and a resumable execution plan

`GRAPHNOSIS.md:126-166` (12 tools) and the execution protocol at `:296-316`.

The design decision: **two tools that do the same walk and differ only in output shape, with the choice bound
to intent.**

- `walk_skill` — *"step-by-step narrative SOP text with ⟲ (loop) / ⤳ (branch) / ⊕ (sub-skill) annotations.
  Use for **explaining** to the user."*
- `walk_skill_structured` — the same walk as a `SkillExecutionPlan` JSON. *"**Prefer this for any procedural
  execution task.**"*

`:315` closes it: *"Two paired tools, two distinct purposes."*

The `SkillExecutionPlan` shape (`:137-143`) is worth transcribing because it is a compact and fairly complete
agent-execution IR:

- `requires` (+ `requiresTypes` **inline type hints**), `produces`
- ordered `steps[].calls` with `args` and **`captureAs`** (named variable binding for downstream steps)
- `steps[].parallel` — concurrent sub-skills
- `steps[].maxIterations` — loop-convergence cap (the §8.4 bound, surfaced to the agent)
- cross-engram calls flagged with `targetGraphId`
- `failureHandlers`

Orchestration syntax inside a step (`:164-166`):
`@skill: target-name(arg=value, arg=$priorVar) -> $captureName`, with a bare form `@skill: target-name`.

The six-step agent protocol (`:298-309`): (1) `walk_skill_structured { sourceId }`; (2) read `requires[]` →
**confirm each input with the user**; (3) read `constraints.prerequisites` → ask if satisfied, **abort if
not**; (4) walk `steps[]` in order, resolving `args[]` from prior `$captures` + literals, recursively
`walk_skill_structured` on `targetSourceId`, storing under `captureAs`; (5) **on exception route to
`failureHandlers[0]` instead of stopping**; (6) **report the captured variables explicitly** in the final
answer.

Two more that matter:

- **Cross-session resumption is a first-class pair**: `save_skill_run` persists captured vars + progress and
  *returns a `runId`* (omit to start, pass back to update) — *"Call as you walk"*; `resume_skill_run` reloads
  captured vars, last completed step, and **`nextStepIndex`** (`:144-148`). Long procedures survive a context
  reset without re-running side effects.
- **`unresolvedCall` on a step means the named sub-skill wasn't found in the same engram — surface to the
  user; do not auto-create.** (`:314-316`). A dangling reference is reported, never papered over. Cross-engram
  calls explicitly unsupported in v1 despite `targetGraphId` existing in the plan shape.

Supporting tools: `train_skill` (*"the user's license picks the path, not you"* — free = deterministic
memory-augmented body with `_(from source)_` attribution; Pro = LLM-rewritten with the same attribution),
`export_skill` (signed `.gsk` pack, AES-256-GCM + Ed25519, magic `GSK\x01`, older `.gts` still imports),
`skill_history` / `rollback_skill` (*"itself recorded as a new snapshot; lineage preserved"* — rollback is
append-only, consistent with indelibility), `skill_vitality` (0–100 over staleness, anchor coverage, goal
completeness, structure resolution).

---

## 11. Error taxonomy designed to survive the MCP/JSON-RPC boundary

`src/core/errors.ts`. This is the best *code* in my territory and the most portable.

The incident is written into the source (`errors.ts:42-75`). A consuming app classified failed `.gai` loads by
substring-matching the library's prose:

```ts
const looksCorrupt = msg.includes('checksum') || msg.includes('HMAC')
                  || msg.includes('Invalid .gai') || msg.includes('signature');
```

0.10.0 added a validation whose message began `Invalid graph:` — not `Invalid .gai` — so it matched nothing
and **lost its recovery path silently**. Worse in the other direction: `Invalid .gai file: format version N is
newer than this reader supports` *does* contain `Invalid .gai`, so the classifier would **quarantine a
perfectly good file written by a newer version**.

The fix has four parts:

1. **The axis is "what should the consumer DO", not "which error"** (`errors.ts:77-88`):
   `'corruption'` (quarantine, try a backup) | `'version-skew'` (**NEVER quarantine — the file is fine, the
   reader is old. Upgrade, do not destroy.**) | `'caller'` (retrying unchanged will not help) | `'config'`.
2. **One frozen code→class map** (`errors.ts:114-133`), `Object.freeze`d, *"deliberately the only place this
   relationship is written down — a second copy is how the app ended up with two divergent classifiers that
   disagreed with each other."* `GAI_VERSION_UNSUPPORTED` is called out inline as *"THE ONE THAT IS NOT
   CORRUPTION"*.
3. **Messages are frozen; codes are additive.** Two named traps: *"Do not introduce the word `signature` into
   any message or code description — the shipped classifier matches it, and no message contains it today, so
   adding it would silently reclassify an unrelated failure as corruption"*; and do not change the
   `Invalid .gai` / `Invalid graph` prefixes.
4. **One class with a code field, not a subclass per failure** (`errors.ts:135-154`) — and the reason is
   exactly our territory:

   > `instanceof` does not survive duplicated module instances (two copies of the package in a dependency
   > tree, or an esbuild bundle that inlines it — **the app's MCP bundle does exactly that**), whereas a
   > string code does. It also survives `JSON.stringify` across an IPC or JSON-RPC boundary, which
   > `instanceof` cannot, as long as the boundary copies own enumerable fields.

Predicates `isCorruption` / `isVersionSkew` / `isCallerError` (`errors.ts:171-192`) are the consumer API.
And `src/sdk/index.ts:1542-1561` records the follow-up defect: the taxonomy shipped in 0.10.0 living only in
`@/core/errors`, while `package.json`'s `exports` map publishes only three entry points — so a deep import was
blocked by Node's resolver and *"a consumer had no reachable way to import `isCorruption`."* The comment ends:
**"An unreachable API is an unshipped one."**

---

## 12. The no-egress invariant banner, and turning it into an auditor's procedure

`src/sdk/index.ts:1-33`. Four numbered SECURITY INVARIANTS at the top of the barrel, with the enforcement
mechanism named in the heading: **"enforced by what we re-export, not by runtime checks."**

- **#1** — the default path performs **zero network I/O**; *"This module must not import from
  `@/core/enrichment/*` or from `@/core/query/answer.ts` — both of those reach OpenAI. Preserve that property
  when modifying this file."* The two forbidden modules are named, and the prohibition is **repeated at the
  re-export block** 1500 lines later (`:1517-1519`) where the mistake would actually be made.
- **#2** — `.gai` crossing a trust boundary must be written AND read with `hmacKey`; the default additive
  checksum catches corruption, **not tampering**.
- **#3** — file paths are forwarded to `node:fs` / `better-sqlite3` as-is; do not pass user-controlled strings.
- **#4** — an explicit **EMBEDDING CARVE-OUT** naming the exact seven symbols that *do* egress
  (`attachEmbeddings`, `embedNodes`, `embedQuery`, `buildEmbeddings()`, `queryHybrid()`, `promptHybrid()`,
  `appendWithEmbeddings()`), plus the trap: *"the regular sync `append*()` methods do NOT update the embedding
  index. Audit your call sites."*

`enterprise/enterprise.md:313-336` converts the invariant into a **three-step, five-minute audit procedure**:

1. Read `src/sdk/index.ts`; every re-exported module is listed at the bottom; the banner names the exclusions.
2. Grep the transitive import graph from `src/sdk/index.ts` for `@ai-sdk/openai`, `openai`, `fetch(`,
   `node:http`, `https.request`. *"You should find zero hits."*
3. Run the SDK behind a network sandbox that blocks all egress (`unshare -n`, restrictive seccomp, deny-all
   pod egress policy). *"All SDK operations continue to work."*

Step 3 is the one that makes the claim falsifiable by a third party with no knowledge of the codebase. The
whole pattern — *invariant stated at the definition site, exclusions named, carve-out enumerated, and a
runnable falsification procedure published* — is a better security-claim format than any threat-model doc.

`enterprise/enterprise.md:241-245` extends it to embeddings with an "auditor checklist": grep for the adapter
import (the only network modules), check every `EmbeddingAdapter.id` (encodes provider+model+dimension, and is
persisted on the index for fail-closed mismatch detection at load — see `EmbeddingAdapterMismatchError` fired
at `src/sdk/index.ts:762-764`), and confirm the API key env var exists so the adapter throws synchronously
*"easier to detect than silent fallback."*

The adapter contract itself is 3 fields (`id`, `dimensions`, `embed(texts, intent?, signal?)`) and the three
shipped implementations are instructive: `openai.ts` lazily imports peer deps behind a try/catch that emits an
install hint, encodes dims into `id` (`openai:text-embedding-3-small@1536`), and documents that OpenAI models
are symmetric so `intent` is ignored — *"Voyage / Cohere adapters MUST honor it"* (`adapters/openai.ts:68-71`).
`local.ts` serializes every call through a promise chain because onnxruntime-node crashes on concurrent
invocation, and keeps the chain alive across rejections (`adapters/local.ts:60-80`). `static.ts` is a
Map-lookup adapter with `onMiss: 'throw' | 'zeros'` for deterministic CI.

---

## 13. `log-redact.ts` — pseudonymizing identifiers in *library* logs

`src/sdk/log-redact.ts`, 36 lines, the whole threat model in the header:

> When the SDK is embedded in a consumer app (the Graphnosis App, a CI pipeline, a user's own integration),
> its `console.error` / `console.warn` lines flow into the **consumer's** stderr buffer — dev terminals, crash
> reports, OS log aggregators. **Anything sensitive that lands there is out of the SDK's control after that.**
>
> Node ids, source paths, and file references are all potentially sensitive (a path can name a private folder;
> a node id is stable per cortex and can be cross-referenced). This helper hashes them into a short stable
> token so internal logs remain greppable across related events without exposing the underlying identifier.
>
> **Cryptographically weak by design — FNV-1a 32-bit.** The point is privacy hygiene in OUR logs, not
> authentication.

Implementation: FNV-1a 32-bit via `Math.imul`, 8 hex chars zero-padded; `ZERO_HASH = '00000000'` returned for
empty/null/undefined so the call is total. Property stated in the JSDoc: *"Same id → same hash across calls
(so a single failing operation can be traced through multiple log lines), different id → different hash, no
way to recover the original from the token."*

Two transferable ideas:

1. **A library's logs are the consumer's data-retention problem.** Most libraries never reason about this.
2. **Stable pseudonymity beats redaction.** `[REDACTED]` destroys the ability to correlate two log lines from
   one failing operation; a stable hash preserves it. This is the same trade the "hook-pulse pseudonym" idea
   makes, and the salt-rotation caveat applies: FNV-1a with no salt is trivially reversible by brute-force
   over a known id space, which is precisely why the header says "privacy hygiene, not authentication."

Used at exactly two call sites: `src/app/api/graph/enrich/route.ts:65` and
`src/core/ingestion/parsers/image-parser.ts:163`. See antipattern §14e — it is not exported.

---

## 14. Antipatterns

### 14a. `GRAPHNOSIS_MCP_ROOT` is set and never read — a sandbox that isn't one

`src/cli/index.ts:491-495`:

```ts
case 'mcp':
  // Lives behind a lazy import so the MCP stack is never a cost for demo/serve.
  process.env.GRAPHNOSIS_MCP_ROOT = resolve(folder);
  await import('@/mcp/server');
  break;
```

`grep -rn 'GRAPHNOSIS_MCP_ROOT' src/ dist/` returns exactly two hits: this line and its compiled twin. **No
reader exists.** Meanwhile all four filesystem-touching tools expand and resolve *any* path the model supplies,
via four independent copies of the same 4-line helper:

- `src/mcp/tools/load_graph.ts:51-54`
- `src/mcp/tools/ingest_files.ts:97-100`
- `src/mcp/tools/update_graph.ts:109-112`
- `src/mcp/tools/export.ts:41-44`

```ts
function expandPath(p: string): string {
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2));
  return resolve(p);
}
```

So `npx -y @nehloo/graphnosis mcp ./notes` *reads* as scoping the server to `./notes`, but `ingest_files` will
read `~/.ssh/config` (it is `.txt`-adjacent — actually only whitelisted extensions parse, but `export` and
`update_graph` will **write** a `.gai` to any path the model names, at `0o600`, via `renameSync`). The SDK's
own invariant #3 (`src/sdk/index.ts:16-18`) says *"Do NOT pass user-controlled strings; canonicalize before
calling"* — and the MCP layer, whose path arguments are by construction model-controlled, does not.

A shared `resolveWithinRoot(root, p)` in one place would fix it; four copies of `expandPath` is how it got
lost.

### 14b. HTTP mode has one shared transport and one global session map — no tenant isolation

`src/mcp/server.ts:133-155`: `startHttp()` constructs **one** `StreamableHTTPServerTransport` at startup and
`app.all('/mcp', (req, res) => transport.handleRequest(req, res, req.body))` hands every request from every
client to it. `sessionIdGenerator: () => randomUUID()` is supplied but the transport instance is singular.

Under it, `src/mcp/graph-session.ts:8` is a **module-global** `Map<string, SessionGraph>`, and
`getDefaultSession()` (`:21-25`) returns *the most recently created session across the whole process*:

```ts
export function getDefaultSession(): SessionGraph | undefined {
  if (sessions.size === 0) return undefined;
  const ids = Array.from(sessions.keys());
  return sessions.get(ids[ids.length - 1]);
}
```

`graphId` is **optional** on `query`, `update_graph` and `export` (`tools/query.ts:7`,
`tools/update_graph.ts:17`, `tools/export.ts:11`) with the documented default *"omit to use the
most-recently loaded graph"*. Therefore in HTTP mode, client A calling `query` without a `graphId` reads
whatever client B loaded a moment ago — a cross-tenant read, and via `update_graph`/`export` a cross-tenant
**write**. `enterprise/enterprise.md:221-227` says *"The current MCP server does not implement
authentication. For enterprise deployments, place the container behind your existing internal API gateway"* —
but a gateway authenticates *into* the process; it cannot fix session bleed *inside* it.

Second defect in the same file: sessions are **never evicted**. No TTL, no LRU, no `deleteSession`. Every
`load_graph` / `ingest_files` call retains a full graph plus its TF-IDF index for the process lifetime. The
SDK has a `dispose()` for exactly this (`src/sdk/index.ts:1404-1422`, *"lets GC reclaim the bulk of the
footprint"*) and the MCP session layer does not use it.

Third: `startHttp()` returns the transport and `main()` then calls `server.connect(transport)` *after*
`app.listen()` has already been called (`server.ts:129-130, 150-154`) — a request arriving in that window hits
an unconnected transport.

### 14c. `GRAPHNOSIS.md` documents ~48 tools this repository does not implement

`GRAPHNOSIS.md:3` declares `v1.13.0`; `package.json:3` is `0.11.0`. The file describes `recall`, `remember`,
`dig_deeper`, `edit`, `forget`, engrams, cortex vitality, `.gnn`/`.gll` overlays, and 12 skill tools. The MCP
server in this repo registers exactly five tools, none of which appear in that document
(`src/mcp/server.ts:38, 56, 74, 92, 110`). There is **no header on `GRAPHNOSIS.md` saying it describes a
different product** — only an oblique note 500 lines into the README (`README.md:512-516`).

Consequences: (a) an engineer mining this repo for "the MCP surface" will spec against something that isn't
here; (b) a coding agent given this repo plus this file will call tools that do not exist; (c) the layered
`.gai`/`.gnn`/`.gll` guarantee at `GRAPHNOSIS.md:236-238` is unverifiable from this codebase — there is no
`.gnn` or `.gll` writer or reader in `src/`.

### 14d. MCP tools throw bare `Error` with prose, in the one place the coded taxonomy was built for

`src/mcp/tools/query.ts:22`, `update_graph.ts:34`, `export.ts:24` all do
`throw new Error('No graph loaded. Call load_graph or ingest_files first.');`, and
`load_graph.ts:25-27` does `throw new Error(\`File not found: ${absPath}\`)`. None carries a code.

This is the exact scenario `src/core/errors.ts:135-143` was written for — *"`instanceof` does not survive …
an esbuild bundle that inlines it — the app's MCP bundle does exactly that … a string code does. It also
survives `JSON.stringify` across an IPC or JSON-RPC boundary"* — and the MCP layer uses none of it. A client
gets prose, over JSON-RPC, and is pushed straight back to substring-matching, which is the failure the
taxonomy exists to prevent.

`File not found: ${absPath}` additionally echoes a fully-resolved host path back into the model's context,
which is both an information leak and, per the redaction module's own threat model (`log-redact.ts:9-13`),
precisely the class of identifier the same package hashes before logging.

### 14e. `redactId` is compiled and shipped but unreachable by consumers

`src/sdk/log-redact.ts` sits under `src/sdk/`, compiles to `dist/sdk/log-redact.js` (present in `dist/`), and
is **not re-exported** from `src/sdk/index.ts` (zero occurrences of `redact` in that 1626-line file). The
`exports` map in `package.json` publishes exactly `.`, `./adapters/openai`, `./adapters/static`, and
`./package.json`, so Node's resolver blocks a deep import.

This is character-for-character the defect the barrel itself documents and fixed for the error taxonomy
(`src/sdk/index.ts:1544-1550`, ending *"An unreachable API is an unshipped one"*). The same mistake is still
live one module over — a consumer who wants the SDK's own privacy-hygiene helper for their own logs cannot
have it.

### 14f. `buildGraphPrompt` bakes benchmark-tuned, English-only heuristics into every consumer's system prompt

`src/core/query/query-engine.ts:809-827` defines two English regexes:

```ts
const PREFERENCE_INTENT  = /\b(favorite|favourite|prefer|preference|usually|typically|habit|routine|tend to|like to|love to|hate|enjoy|style|personal)\b/i;
const AGGREGATION_INTENT = /\b(total|how many|how much|number of|count of|sum of|all of the|every time)\b/i;
```

and `:855-875` injects LongMemEval-shaped procedure text into the system prompt when they fire — including
corpus-specific adjudication such as *"'cuisine' = a national/regional cooking tradition, NOT a diet like
'vegan'; 'purchase' = an actual buy event, NOT a wish"* and instructions about `claims:` lines and
`src:User (turn N)` tags.

Three problems: (1) it is **invisible** — a caller who writes `g.prompt(q)` has no parameter, no log line, and
no return value telling them ~400 tokens of benchmark rubric were prepended; (2) it is **English-only**, in a
library whose own agent instructions (`GRAPHNOSIS.md:30-35`) make multilingual usage a headline concern;
(3) it **violates the library's own stated boundary** — `src/sdk/index.ts:176-179`, on the contradiction
entity filter, says *"Deliberately STRUCTURAL only: corpus-specific stopword lists are the consuming app's
concern, not a general-purpose library's."* The prompt builder is where the corpus-specific tuning went
instead.

The `ctx.questionType` router hook (`:851-853`) is the intended escape, but the *fallback* — what every
untagged caller gets — is the benchmark path, explicitly *"for exact A/B comparability"* (`:849-850`).
Benchmark scaffolding left in the default code path.

---

## 15. Smaller observations that did not become findings

- **The `query` MCP tool is the only one that does not `JSON.stringify` its result.** Four tools return
  `JSON.stringify(result)`; `query` returns `result.serialized` alone (`src/mcp/server.ts:99-105`), dropping
  `nodeCount`. The tool description (`server.ts:94`) carries the containment claim and the token budget in
  the schema the model reads: *"Returns a plain-text subgraph snippet (~2K tokens) suitable for injection
  into an LLM system prompt. Only the relevant subgraph is returned — the full graph never leaves the
  session."* Stating the *cost* and the *containment property* in the tool description is good practice; so
  is returning the smallest thing that is still an answer.
- **TF-IDF cache keyed on (absolute path, mtime, analyzerId)** — `src/mcp/tfidf-cache.ts:7-36`. The comment
  at `:10-17` is the finding: *"mtime alone is not a sufficient key: the same unchanged file can legitimately
  be indexed under different analyzers across SDK versions, and serving a stale index built by a different
  tokenizer is exactly the silent drift `analyzerAdapterId` exists to prevent."* And `:51-61` records that the
  previous local reimplementation (a) excluded `section` nodes, *"making headings unreachable as seeds"*, and
  (b) called `createTfidfIndex()` with no argument so every graph was tokenized with the default analyzer —
  *"Since `documentCount` is in the idf numerator, that gave the same `.gai` two different score tables
  depending on the loader."* Cache-key completeness as a correctness property, not a performance one.
- **`.claude/launch.json`** is 11 lines: one `graphnosis-dev` configuration running `npm run dev` on port
  3000. Nothing agentic. Note the port disagrees with the CLI default of 7777 (`src/cli/index.ts:485`).
- **`CLAUDE.md:3-48`** is entirely a **ship-cadence authority policy for the coding agent** — a small,
  well-designed authority ceiling for a *host*, complementing §8.2's ceiling for an *artifact*. It enumerates
  the exact utterances that constitute a ship signal (*"ship", "release", "publish", "let's commit", "push to
  GitHub", "push it", "tag v0.x"*), explicitly disqualifies near-misses (*"Anything less specific ('looks
  good', 'great', 'fixed it') is **not** a ship signal"*), states the cost that motivated it (*"every tag push
  triggers an OIDC-authenticated npm publish, and we've already burned version numbers (v0.2.4, v0.2.5) on
  transient CI failures"*), and splits the surface into "needs explicit confirmation" vs "you can do without
  asking". The positive list is as important as the negative one.
- **`AGENTS.md` and `CLAUDE.md` have drifted apart and both are stale.** `CLAUDE.md:56-147` still says `.aikg`
  throughout (the extension was renamed to `.gai`), lists 8 pages / 10 API routes that no longer match `src/`,
  and describes `aikg-writer.ts` / `aikg-reader.ts` (actually `gai-writer.ts` / `gai-reader.ts`).
  `enterprise/enterprise.md` is likewise `.aikg` throughout and refers to `writeAikg`/`readAikg`
  (`enterprise.md:354-356`) — symbols that do not exist; the SDK exports `writeGai`/`readGai`
  (`src/sdk/index.ts:1606-1607`). An agent following `enterprise.md`'s HMAC guidance verbatim writes code
  that does not compile.
- **Sourcing conventions for soft-delete reasons** (`enterprise/enterprise.md:247-272`): a namespaced-prefix
  convention — no prefix / `user:` / `system:` / `preview:` — where `preview:*` is **hidden by default** in
  audit exports *"so compliance exports don't include phantom add → soft-delete pairs from rejected
  previews"*, overridable with `{ hideReasonPrefixes: [] }` for forensics. The convention is *"not enforced —
  the string remains freeform"*, but the library follows it internally (`cascadeSoftDelete`,
  `forgetByTimeWindow`, `forgetByTopic` default to `system:*`). Convention + a default filter + an escape
  hatch, without a type change.
- **`setConfidence` throws where `edit`/`deleteNode`/`supersede` return `{applied: 0, errors: []}`** — and the
  reason is written down (`src/sdk/index.ts:1287-1292`): the non-throwing shape exists to protect batches, was
  therefore ignored by a consumer (`try { ... } catch { /* ignore */ }` around a method that never throws,
  discarding the errors that are always returned), and `setConfidence` has no batch to protect, so *"refusal
  is raised in the one shape a caller cannot ignore by doing nothing."* Choosing the error channel per method
  based on whether ignoring it is survivable.
- **`queryGraphs` federation refuses to dedupe on a bare hash** (`src/sdk/index.ts:1466-1494`): `contentHash`
  is 32-bit DJB2 and *"at 50k nodes the chance of a collision is ~25%"*, so the map is keyed by hash but
  **holds the content**, and a hash match with different content keeps both nodes. *"In a system whose Theorem
  1 says nothing is ever hard-deleted, losing evidence to a hash collision is the sharpest possible
  contradiction."* And the per-graph `catch` explicitly **does not swallow** — the comment records that it
  used to be `catch {}` with "skip silently", which meant *"a federated query would quietly answer from a
  subset of the memories it was given, with no signal that anything was missing."*
- **The single-implementation determinism argument** (`README.md:59-66`, restated `src/cli/index.ts:9-16`):
  other languages get *"a process boundary, not a rewrite"*, because *"tie-breaking, hash iteration order and
  Unicode handling all differ subtly between runtimes"* and independent ports are the fastest way to lose
  determinism. Hence `serve` (plain HTTP, `src/cli/index.ts:401-426`, `POST /query {"q"} -> {nodes, prompt}`)
  and `mcp` as the two process boundaries.
- **Commit-message craft.** `git log --oneline` reads as a series of claims about *why*:
  `docs(spec): v2 keeps the AIKG magic — version skew is not a wrong-format error`;
  `docs(changelog): the corruption class does not mean tampered with`;
  `docs(spec): write section 8 for an implementer, not for a reader of this repo`;
  `fix(query): embedding seed scores are a cosine again, not a bare dot product`. The CHANGELOG
  (`CHANGELOG.md:1-90`) leads each release with a paragraph naming **which callers break and how**, including
  the distinction that a field becoming required *"is listed here rather than under Added because 'additive'
  describes the reader's view only, and the constructor's view is the one that breaks a build."*
- **`ROADMAP.md` is a triage document, not a wish list.** It states the in-scope primitive list explicitly so
  PRs can be triaged against it, states the out-of-scope default (*"build it as a separate package that
  depends on Graphnosis"*), and gives a three-question template for "I think this might be in scope".
  `CONTRIBUTING.md` adds a "What we will NOT accept" list whose second entry is *"Changes that require network
  egress from the core SDK"* — the no-egress invariant enforced at the process level, not just the code level.
