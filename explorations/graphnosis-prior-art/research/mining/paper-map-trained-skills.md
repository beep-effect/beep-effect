# Paper map — Graphnosis "Borrowable Skills as Lean Un-Ganglia Subgraphs" → beep-effect

Source note: `scratchpad/graphnosis/paper-trained-skills.md` (946 lines, read in full: 1–490, 491–946).
Repo verified: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean).
Date: 2026-08-06.

---

## 0. Ground truth established first

### 0.1 The Skill entity is a 47-line stub — CONFIRMED

```
$ wc -l packages/agents/domain/src/entities/Skill/Skill.model.ts
47 packages/agents/domain/src/entities/Skill/Skill.model.ts
```

`Skill extends BaseEntity.Class<Skill>($I`Skill`)(Agents.SkillId, { fields: { fixtureKey: SkillFixtureKey, name: SkillName }, ... })`.
No prompt body, no steps, no goals, no tool allowlist, no routing metadata, no version, no vitality.

`packages/agents/domain/src/entities/Skill/` contains exactly `index.ts` + `Skill.model.ts`.

### 0.2 The `agents` domain slice in full

```
$ find packages/agents/domain/src -type f -name '*.ts'
src/index.ts
src/entities/{Fixture.values.ts,index.ts}
src/values/index.ts
src/entities/Agent/{Agent.model.ts,Agent.values.ts,index.ts}
src/entities/ProviderInstance/{ProviderInstance.behavior.ts,ProviderInstance.model.ts,ProviderInstance.values.ts,index.ts}
src/entities/Skill/{Skill.model.ts,index.ts}
src/values/AssistantContent/{AssistantContent.behavior.ts,AssistantContent.model.ts,index.ts}
```

`Agent` fields: `{ fixtureKey, mode, name, skillFixtureKey }` — `mode` is the single literal
`deterministic_fixture`, and an Agent points at **exactly one** Skill by fixture key. There is no
agent→skill-set relation, so the paper's "Agempus = bundle of procedures + bound memory + dispatch
index + call graph" has no carrier at all.

### 0.3 Negative-search proof block (every one returned zero rows)

```
$ rg -n --glob '!**/node_modules/**' -g '!*.md' -g '!*.pdf' 'skill:seq|skill:loop|skill:branch|skill:ctx|skill:calls|skill:goal' .
$ rg -n --glob 'packages/**/src/**/*.ts' 'AutonomyLevel|autonomyLevel|maxAutonomy|dispatchSafe|dispatch-safe'
$ rg -n --glob 'packages/**/src/**' 'vitality|Vitality|freshnessScore|SkillHealth'
$ rg -n --glob 'packages/**/src/**' 'retrainQueue|citedNode|RetrainReason|staleReason'
$ rg -n --glob 'packages/**/src/**' 'SkillExecutionPlan|walk_skill|SkillStep\b'
$ rg -n --glob 'packages/**/src/**' 'TriggerTable|triggerIndex|SkillTrigger|skillIndex'
$ rg -n --glob 'packages/**/src/**/*.ts' 'loopCap|maxIterations|maxRounds|recursionDepth'   # only ExperimentalConfig.schema.ts:198 depthLimit (Next.js config)
$ rg -n --glob 'packages/**/src/**/*.ts' '"precedes"|"depends-on"'
```

Every one empty. The whole procedural-skill layer is absent from `packages/`.

### 0.4 The bricks that DO exist (verified by reading, not by name-match)

| Brick | Path | What it actually is |
|---|---|---|
| Bitemporal edge substrate | `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` | One immutable assertion per logical edge over half-open `[validFrom,validTo)` / `[recordedAt,expiredAt)` BIGINT-millis intervals, `supersedes_id` self-FK lineage, no `isLatest` flag. Derived from Graphiti, reimplemented. **Stronger than the paper's soft-delete-plus-`validUntil`.** |
| Edge relation vocabulary | `packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts` | `LiteralKit(["supports","refutes","contradicts"])` + a symmetric subset used to collapse endpoint orderings in the logical-edge digest. Epistemic only — no structural/procedural verbs. |
| Typed weighted tagged-union edges | `packages/foundation/modeling/nlp/src/Graph/Schema.ts:77-225` | `TextEdgeRelation = LiteralKit(["contains","follows","derived-from","parent-of","tagged-as","lemma-of","head-of","dependent-of","entity-mention","relates-to"])`, `TextEdge` built with `S.toTaggedUnion("relation")` carrying optional `label` + `weight`. This is the closest existing shape to the paper's five edge classes — but it is a **text-annotation** graph, not a procedure graph. |
| Authority object | `packages/epistemic/domain/src/values/ExecutionGrant/ExecutionGrant.model.ts` | `SinkClass` / `SinkAudience` / `SinkDestination` / `GrantOperation` / `PolicyRevision`; grants held only at the enforcement boundary, never issued to the agent. |
| Frozen authority + pure evaluator | `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts` | `DraftGrantSet` (widenable) vs `FrozenGrantSet` (sealed by a SHA-256 digest over versioned canonical JSON). `addGrant` accepts only Draft, `evaluateExecutionRequest` accepts only Frozen — the freeze is a **type**, not a runtime flag. `freezeGrantSet` is the only legal constructor (repo law bans `FrozenGrantSet.make` elsewhere). |
| Bounded denial domain | `packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts` | 10 closed `DenialReason` literals, split evaluator-produced vs boundary-produced, never returned to the agent (differential-denial oracle). |
| Enforcement boundary | `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` | Write-ahead fail-closed: every verdict seals an `ExecutionDecisionRecord` and appends it to the ledger **before** returning. Session-frozen authority keyed by transport session id, not `clientId`. Refusal is a value and is reason-free. |
| Audience resolution | `packages/epistemic/config/src/Audience.ts` | `resolveSinkAudience` derives audience from destination; **unparseable input takes the stricter branch**. Caller can never self-declare a friendlier audience. This is the paper's "lock-when-unsure" done properly. |
| Progressive disclosure | `packages/foundation/capability/mcp-kit/src/FieldTier.ts` | `FieldTierName = LiteralKit(["minimal","balanced","complete"])` + projector + columnar reshaper + `FetchableHandle` escape valve. Payload-side progressive disclosure, not dispatch-side. |
| Provider fallback | vendored `effect` `ExecutionPlan` + `Stream.withExecutionPlan` at `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:129` | Ordered provider fallback, per `explorations/multi-provider-llm-dispatch-fallback/DECISIONS.md` Q1–Q3 (2026-07-14 LOCKED). No capability sets, no cost preview, no privacy lock. |
| Knowledge-surface drift gate | `packages/tooling/tool/cli/src/commands/Knowledge/{Knowledge.service.ts,Knowledge.schemas.ts}` | `beep knowledge semantic-delta` — paired merge-base/HEAD git archives over `SCANNER_SCOPE = ["AGENTS.md","CLAUDE.md","goals","explorations","docs",".claude",".agents",".codex","standards",".github"]`, 14 `KnowledgeFindingKind` literals incl. `index-drift`, `broken-tracked-path`, `unknown-beep-command`, `failed-assertion`. Verifies **paths and commands**, not cited claims. |
| Skill provenance / snapshot chain | `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts` + `skills-lock.json` | `skills-lock/v2`: pristine `SkillSnapshot` (ordered mode-aware manifest, `fileCount` must equal manifest length), ordered patch series, reconstructed effective tree, `SkillProvenanceStatus = exact|inferred|unresolved`, `SkillProvenanceConfidence = high|medium|low|unresolved`. Subcommands: `beep skills update`, `beep skills provenance`. **Upstream vendoring, not retraining.** |
| Cross-agent skill frontmatter | `packages/tooling/library/ai-sync/src/schemas.ts:131` | `AgentSkillFrontmatter` = `{ name, description }` only, shared across claude-code/codex/grok-build/junie, with `normalize`. `.agents/skills -> ../.claude/skills` is a symlink (one tree, two consumers). |
| Reflection artifact gate | `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts` | `beep lint reflection-artifacts` — schema-valid closeout reflection per completed packet, gated only when `reflectionRequired: true`. |
| Goal manifest contract | `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts` | `GoalStatus` (5), `GoalPhaseStatus` (4), `GoalManifestSchemaVersion` (3), `GoalCompletionGate`, `GoalInitiative`, `GoalPhase`, `GoalManifest`. |
| Loop budget (prose only) | `.claude/skills/quality-review-fix-loop/SKILL.md:28` | `loop_budget: 3 reviewer/fixer rounds before escalating` — a prose constant, no schema, no per-edge accounting. `.claude/skills/browser-qa-loop/SKILL.md:76` is `Exit when a round reports requiredCount: 0` — **uncapped**. |

### 0.5 Prior mapping already in-tree (do not re-derive)

`goals/agentic-professional-runtime/research/gold-intake-agent-skills-ethical-wall.md` (2026-06-29)
already: confirms the Skill stub verbatim, recommends growing `Skill` with a prompt body + per-agent
tool allowlist + cost-tier routing metadata + `requiresDisclaimer`, names `agents` as the slice that
owns "agents, skills, commands, connectors, model/provider bindings", and flags ethical-wall
`CurrentUser` identity as a cross-cutting standards decision. Any skill-shape proposal must extend
that note rather than restate it.

### 0.6 Landing-packet candidates and their live state

```
$ rg -o '"stage": "[a-z]+"|"status": "[a-z-]+"' explorations/<slug>/ops/manifest.json
graphnosis-prior-art                  status=active     stage=research
agent-governance-control-plane        status=active     stage=capture
agent-memory-tiers-bitemporal-edges   status=active     stage=graduate
multi-provider-llm-dispatch-fallback  status=graduated  stage=graduate
rag-retrieval-projection              status=active     stage=graduate
compound-engineering                  (CAPTURE.md only — no ops/manifest.json yet)
```

Goals: `agentic-professional-runtime` 3/5 active · `knowledge-surface-automation` 2/7 active ·
`hybrid-retrieval-fusion-core` 0/4 · `agent-execution-authority` 5/5 complete ·
`coding-agent-effectiveness-evidence-loop` 0/9 · `agent-reflection-loop` 4/4 complete ·
`skillopt-training-pilot` 7/7 complete.

---

## 1. Findings and verdicts

### ts-01 — Zero-primitive procedural extension (Proposition 1)
Skill semantics carried entirely by a node `role` + an optional `evidence` string on otherwise
generic typed edges; no new `NodeType`, no new `DirectedEdgeType`, no new graph engine.
**gap.** beep-effect has no generic node/edge substrate to label. `EdgeRelation` is a closed
3-literal epistemic vocabulary; `TextEdgeRelation` is a closed 10-literal NLP vocabulary. Both are
`LiteralKit` — adding a member is a schema change, which is the *opposite* of "labeling discipline
over an unchanged schema". Note also: the paper's own repo check shows this design forced an
escape hatch (`blockedEvidencePrefixes`) into the substrate anyway, so the "zero primitives" claim
is partly bookkeeping.

### ts-02 — A skill IS a subgraph (Definition 1)
Title hub + 8 typed goal nodes + ordered step body + 6 evidence-tagged edge classes; "there is no
separate skill data type."
**gap** for the shape; **partial** for the raw materials (`S.toTaggedUnion` over a `LiteralKit`
relation with weight, `packages/foundation/modeling/nlp/src/Graph/Schema.ts`). The
graph-native framing is load-bearing only if procedures must be co-resident with, and
recall-bound to, memory nodes — which beep-effect does not do today.

### ts-03 — Eight-goal contract as a total record
`Trigger, Prerequisites, Requires, Produces, Success, Out of scope, On failure, On completion`,
parsed from line prefixes, hung off the hub. Mining note's key move: model as a **total record over
the category literal**, not an array, so goal-completeness is a type property.
**gap** in `packages/`; the closest analogue is the goal-packet document contract
(`GoalManifest` + `goals/_template/`), which is a *document* completeness contract, not a
procedure-contract record. The paper's own corpus had five skills failing this contract.

### ts-04 — Completion oracle as the classifying primitive
`[verify: tool|state|human]` — "the completion oracle, not the domain, is the primitive that
classifies kinds of procedural work." Corpus is oracle-agnostic across 12 families.
**gap.** No literal domain for how a procedure knows it is done. Closest live analogue is the
`verificationCommands` field on goal manifests (tool-oracle only) and `beep qa judge-*`
(human/vision oracle) — but they are unrelated surfaces with no shared vocabulary.

### ts-05 — Parameterized evidence strings and the Lemma 1 bug
`skill:loop;max=N`. The shipped linker's delete predicate matched only the bare `skill:loop` tag,
so capped-loop edges **accumulated across re-derivations** and the idempotence fixpoint failed
silently — weakening Theorem 1 and Invariant 3 until caught, verified red before fix.
**not-applicable as a bug** (no such string exists here) but **directly applicable as a law**:
`S.TemplateLiteral` (13 uses in `packages/**/src/**`) makes that class of bug unrepresentable.

### ts-06 — Step DSL and the graph-resident vs graph-topological distinction
`@loop:`/`@branch:`/`@skill:` become edges; `@needs`/`only_engrams` do not — "routing metadata is
graph-*resident* but not graph-*topological*. We state this rather than overclaim."
**gap** mechanically. The distinction itself is a good honesty discipline worth borrowing in prose.

### ts-07 — Plan compiled from storage ORDER, not edge traversal (Theorem 1)
Steps are `array index ↦ step i`; a back-edge is recorded only as a bounded annotation and never
re-enters construction; serialized plan asserted byte-equal to a stored fixture (7/7).
**partial.** The byte-equal-to-fixture discipline is already repo doctrine — see the
architecture-lab proof oracle and `packages/tooling/tool/docgen/src/ProofManifest.ts`. What is
absent is any ordered-procedure compiler to apply it to.

### ts-08 — `SkillExecutionPlan` shape
`requires[]/produces[]/steps[]{calls,args,captureAs,parallel,maxIterations,branchesTo,loopsBackTo,supportingContext,targetGraphId}/failureHandlers[]`.
Mining note's improvement: `S.toTaggedUnion` over step kinds so `loopsBackTo` + `branchesTo`
together is unrepresentable, and loop cap as `S.Positive` with a schema-level default so the
"was the cap authored?" bit survives decoding (the paper tracks it out-of-band as "cap source").
**gap.** `rg 'SkillExecutionPlan|SkillStep\b'` → empty. `S.toTaggedUnion` has 98 call sites, so the
idiom is native here.

### ts-09 — Bounded walk with per-EDGE lifetime caps (Theorem 2)
Caps are lifetime budgets per edge within one walk (an enclosing loop never resets an inner edge's
budget); depth-3 recursion incl. recovery handlers; **reaching a cap is a normal reported outcome**
— the walk falls through and completes, reporting per-edge iterations, cap source, and stop reason.
Contrast: LangGraph's single global `GRAPH_RECURSION_LIMIT` (25) raises `GraphRecursionError` and
**fails the run**.
**partial.** `.claude/skills/quality-review-fix-loop/SKILL.md:28` has `loop_budget: 3` in prose;
`.claude/skills/browser-qa-loop/SKILL.md:76` exits only on `requiredCount: 0` — uncapped.
No schema, no per-edge accounting, no stop-reason record.
`rg 'loopCap|maxIterations|maxRounds|recursionDepth' packages/**/src/**/*.ts` → only a Next.js
config field.

### ts-10 — Empty-engram training (Invariant 1)
Body is a pure function of authored source; personal facts bind at **walk** time via
`only_engrams=[…]` recall recipes. Makes one artifact simultaneously portable and private, and
keeps SOPs legible ("recall the prior tier decisions", not a frozen paste of last quarter's
pricing). Scope caveats stated in the invariant itself: does not cover the opt-in `bind_recipes`
path or hand-authored facts.
**partial.** The repo's skills are already source-only (no data baked in) and the OIP
confidentiality rule enforces the same separation by policy. What is missing is any *declared*
binding — a skill cannot say "at run time, recall from matter X" and be checked on it.

### ts-11 — Structure-preservation gate on machine rewrite (Proposition 2)
`save(s) = r if tok(s) ⊆ tok(r), else s` — an LLM rewrite is kept only if every structural token
survives, else revert to verbatim. Honestly de-rated: set-presence via deduplicated substring
match, **not** per-step placement or count.
**gap** for skills; **already-have** for the pattern class — the repo is full of
render→write/check drift gates (`GeneratedFileDrift.ts`, `beep lint schema-catalog`,
`beep knowledge semantic-delta`). The transferable bit is the *revert-to-source-on-fail* branch,
which the drift gates do not have (they fail the build instead).

### ts-12 — The closed staleness loop (cited-node index + typed retrain queue)
A skill records the ids of the memory nodes its recall recipes cite; an edit/forget/supersede on
one of those nodes enqueues the dependent skill with a **typed reason** (`source-edited`,
`superseded`, `forgotten`); an idle scheduler drains **at most one per cycle**, owner-confirmed;
drift detection is license-free even though applying the fix is gated.
The mining note ranks this #1 to port, and it is the paper's answer to "decay by assumption".
**partial.** `beep knowledge semantic-delta` is a real dependency gate over exactly the right
scope (`.claude`, `goals`, `explorations`, `docs`, `AGENTS.md`, `CLAUDE.md`, `standards`) with 14
typed finding kinds — but it checks **paths and `beep` command/option existence**, not the *claims*
a skill makes. A skill asserting "the coverage lane runs `test`" or "`Skill` has two fields" goes
stale with zero signal. No per-skill dependency record, no queue, no drainer.
`rg 'retrainQueue|citedNode|RetrainReason'` → empty.

### ts-13 — Vitality derived, never stored
`100 − min(⌊months×5⌋,25) − round(superseded/total×50) − round(missingCited/total×40)`,
bands fresh≥80 / aging 60–79 / retrain 40–59 / stale<40. Self-flagged as narrow: it does **not**
reward goal completeness or structural resolution, so real quality work leaves it unmoved.
Measured baseline was mean 97.7 across 76 skills — i.e. the metric was saturated and could not
discriminate; the only signal was the *move* under retrain (92→98, 94→99).
**gap**, and mostly not worth porting. The formula constants are arbitrary (the mining note says
so), the metric saturated on its own corpus, and beep-effect already has ratchets that measure real
properties. "Store the inputs, derive the score" is correct and already repo doctrine (cf.
`EdgeVersion`: no persisted `isLatest` flag, "latest is a question you ask the axes").

### ts-14 — In-place retrain with a reversible snapshot chain
Same source id reused; snapshot live nodes to an encrypted file **before** mutating; soft-delete
(`validUntil` set, confidence→0) rather than hard delete; **rollback snapshots the current state
first, then restores**, so rollback is itself reversible; `rename source AFTER inserts succeed`;
crash between clear and re-insert leaves a **hollow** skill, auto-repaired on read by replaying the
newest non-empty snapshot. An earlier model minted a fresh source per retrain, leaving "red island"
orphans that broke call resolution.
**already-have, in stronger form.** `EdgeVersion` is bitemporal-immutable with `supersedes_id`
lineage — there is no destructive window to crash inside, so "hollow" is structurally impossible
rather than repaired. `skills-lock/v2` independently carries pristine snapshot + ordered patch
series for the vendored skill tree. The one genuinely portable lesson is the **ordering law**
(rename/publish after inserts succeed), which is a general write-path discipline.

### ts-15 — Cross-skill call stability under retrain (Invariant 3)
Retrain reuses the source id, so `resolves(C,K)` is invariant under any number of retrains;
name matching normalized so `norm(slug) = norm(title-case)` while distinct names stay distinct,
preventing a casing variant from forking a duplicate source.
**already-have.** The repo's identity discipline is stronger: `$I` identity composers,
`EntityId`/`SkillId` branded ids, `LogicalEdgeKey`/`LogicalEdgeIdentity` with a canonical-JSON
digest and endpoint-order collapse for symmetric relations
(`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts`).
Slug-vs-title-case forking is a defect class this repo already designs out.

### ts-16 — Lazy dispatch: index-only load, then hydrate matched bodies
Load a one-line `trigger → skill` index (~160 chars/skill, ≈3,034 tokens over 76 skills), classify
context against it, hydrate only the 1–3 matched bodies. 48,780 → ≈3,600–4,100 tokens, ~8% of the
library. Explicitly not claimed as novel — "the contribution is the exact token accounting."
**already-have**, structurally. This is exactly how Claude Code skills work: 30 dirs under
`.claude/skills/`, frontmatter `{name, description}` in the always-loaded prefix, body loaded only
on invoke. `AGENTS.md` "Context Economy" already states the prefix argument. The *accounting* is
what beep-effect lacks — nobody has measured the repo's own prefix cost.

### ts-17 — One trigger table, several consumers ("the library advertises itself to its executor")
The same trigger table is the single matching authority for the proactive watcher, for in-chat
routing, and for **export** — rendered into `CLAUDE.local.md`, `.cursorrules`, Cursor `.mdc`.
**partial.** `.agents/skills -> ../.claude/skills` is already one tree with two consumers, and
`@beep/ai-sync` has `AgentSkillFrontmatter` (`{name, description}`) plus per-agent transforms and
generated source metadata. What is missing is a **generated** index: nothing renders a
trigger→skill table into any agent config, and `rg 'TriggerTable|triggerIndex|SkillTrigger'` is
empty. Honest read: the symlink already gets most of the value for two consumers; a generator earns
its keep only at a third target or when descriptions need machine validation.

### ts-18 — Proactive matching with concrete anti-spam bounds
Three passes (due obligations / keyword overlap with recent ingest / cadence rules), then: cap of
**five** new proposals per session, **six-hour** suppression window per `(signal, skill)` pair,
meta-skill blocklist, and a `dispatch-safe` + confidence gate capping a match at *suggest*.
**gap**, and largely **not-applicable** to today's repo: nothing proposes skills proactively, so
there is no spam to bound. Relevant only if the product ships a proactive agent surface.

### ts-19 — Authority ceiling with min-composition and fail-closed absence
SPEC §8.2: `maxAutonomy` is node metadata; a ceiling is a maximum never a grant; **a subgraph's
effective ceiling is the MINIMUM over its member nodes**, so borrowing cannot raise the borrower's
ceiling; it travels in the transport envelope; **absence is UNSPECIFIED, not unlimited** — a
conforming host must treat unspecified as its most restrictive level. The paper's own Invariant 4
uses a weaker fallback chain (per-skill → engram default → **global default**), where a permissive
global default silently raises every un-annotated skill. Mining note: take the SPEC's semantics.
**partial.** beep-effect's authority model is **binary and default-deny**, not an ordered ladder:
`FrozenGrantSet` + `evaluateExecutionRequest` + 10 closed `DenialReason`s + write-ahead ledger
(`goals/agent-execution-authority` 5/5). Default-deny already gives "absence is not permission" for
*sinks*. The missing piece is an **ordered** level domain
(`L0 manual < L1 suggest < L2 preview-then-run < L3 autonomous`) with an `Order` instance and
min-composition, so a composite action's authority is the meet of its parts.
`rg 'AutonomyLevel|maxAutonomy|dispatch-safe' packages/**/src/**/*.ts` → empty.
Prose-level policy exists at `goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md`
(`candidate|accepted|rejected|revision_requested|superseded` + "Not Autonomous In V1" list) and
`SPEC.md:218 "Autonomy Boundary"` — unmodeled.

### ts-20 — Rule 5: the writer of a node cannot raise its own ceiling
"A process that mints or edits a node MUST NOT set `maxAutonomy` above the ceiling of the context
it is running in… **what proposes an action does not approve its own limits.**" The mining note
correctly classifies this as a *service*-level invariant (the minting service clamps against the
ambient ceiling), not a schema one.
**partial.** The same principle is already enforced in beep-effect for two other axes, and enforced
better: `resolveSinkAudience` derives audience from the destination so "a prompt-injected agent that
could name its own audience could name the friendlier one" cannot;
`GrantSet.model.ts` header — "Grants derive only from session-static inputs (config, policy
revision, caller identity), never from tool output. That is what makes the freeze sound." What is
missing is the *general* statement of it as a repo law covering any self-authored config an agent
writes (skills, manifests, packet lifecycle flips, `.claude/settings.json`).

### ts-21 — Unattended-execution conjunctive gate
An L3 run is admitted only when **all** hold: kill-switch on, explicit owner opt-in (off by
default), effective level re-resolved to L3 at execution time, recalled memory re-checked live for
contradictions, plan walker-executable (`parallel` refused; a loop admitted **only when its cap was
authored**, because an unattended run requires the bound to be in the skill, not in the runtime
default), effects reversible, rate limit — plus an encrypted append-only per-action audit with
per-action undo.
**partial.** Write-ahead fail-closed decision records + session-frozen authority + expiry are live
(`GovernedTierGate.gate.ts`); the run-time re-resolution, reversibility precondition, and
authored-vs-defaulted-cap distinction are not. The authored-vs-defaulted distinction is the sharpest
idea in the whole gate and is cheap: it is one boolean that must survive decoding (see ts-08).

### ts-22 — Per-step capability routing with a deterministic, previewable selector
`needs(s)` capability set per step; feasible set `ℱ(s) = {m : capabilities(m) ⊇ needs(s)}`;
selection lexicographic under **privacy ≻ strategy ≻ cost**, ties broken by typical-latency then
stable catalog order so the ordering is **total**; side-effect-free, so `Σ_s price(model(s))` is
computable **before any token is spent**; `ℱ(s) = ∅` ⇒ the walk is *infeasible* under that strategy
(a first-class outcome, not a silent downgrade). Proposition 4: under cost-first strategies,
enlarging the catalog can only lower routed cost — so the artifact *benefits* from model churn.
**partial.** Provider selection exists as ordered fallback (vendored `ExecutionPlan` +
`Stream.withExecutionPlan` at `AnthropicTurnKernel.ts:129`), and
`explorations/multi-provider-llm-dispatch-fallback` (graduated) owns the registry/resolver surface.
Absent: a capability domain, a model catalog with declared capabilities, feasibility as a value,
and a pre-spend cost preview. The **infeasible-as-a-value** and **total-order** properties are the
parts worth stealing; the cost numbers are not (see ts-27).

### ts-23 — Privacy hard-lock, and its disclosed hole
For every step whose own recall touches an engram flagged sensitive, `model(s) ∈ LocalModels`
**independently of the active strategy** — the privacy filter runs *before* cost minimization.
Unresolved engram name ⇒ conservatively treated as sensitive. Disclosed limit: **per-step only,
no taint propagation** — content derived from a sensitive recall, captured into a variable, and
flowing to a later cloud-routed step is **not** covered. Also disclosed: the planner supported the
lock but **no walker passed the per-step tier map**, so until that revision it did not engage.
**gap on the axis that matters most here.** beep-effect classifies *destinations* (egress) —
`resolveSinkAudience`, strict-on-unparseable — but nothing classifies *content* sensitivity and
routes on it. `rg -i 'ollama|localModel|local-model' packages/**/src/**/*.ts` returns only
`@beep/openclaw` probe/render strings, not a routing rule. This repo runs under a standing rule
that pre-publication patent text never reaches a cloud LLM; that rule is enforced today by human
discipline only. The paper's two disclosed failures — **no taint propagation** and **a lock that
silently did not engage because one caller never passed the tier map** — are precisely the two
failure modes a beep-effect implementation would have to design against from day one, and they
argue for putting the check at the egress boundary (where `GovernedTierGate` already is,
fail-closed, write-ahead) rather than in a planner.

### ts-24 — Block propagation, never membership (`blockedEvidencePrefixes`)
A factual query seeds into one procedure step by vocabulary overlap and traversal unrolls the
*entire* procedure into a budget meant for facts. "The harm is the chain, not the node." So the
retrieval boundary blocks *propagation* through an evidence namespace while the seeded node still
scores and still appears. And the layering law: the SDK stays generic and has no opinion about what
a namespace means — "the host that OWNS a namespace sets it at its own retrieval boundary."
**gap** mechanically (no traversal engine yet), but the **membership-vs-propagation distinction is
a genuinely good retrieval primitive** and `goals/hybrid-retrieval-fusion-core` (0/4) is the packet
that would inherit it — its SPEC already reserves "an optional graph ranked fixture channel" that is
"rank-only" with "No graph producer, BFS, driver" (SPEC lines 12, 99, 108–112). Recording the
distinction now, before a producer exists, is nearly free.

### ts-25 — Cross-boundary calls cannot be edges
"An SDK directed edge joins two nodes within a single graph, so a `@skill:` call that targets a
skill in a *different* engram cannot be a graph edge." Resolved at **training** time into a keyed
name→source-id side-table (so resolution costs zero model tokens at walk time — this is what makes
the borrow cheap), stabilized by Invariant 3. The paper flags it as "a constraint of reusing the
substrate's strictly intra-graph edge model, not as a design we would otherwise have chosen."
**not-applicable** to beep-effect's current shape, but it is the single most useful *warning* in the
paper: **a "one graph, procedures are subgraphs" story leaks the moment procedures cross graph
boundaries.** beep-effect is a multi-slice monorepo with matter-scoped isolation as a product
requirement — cross-boundary is the normal case here, not the exception. Any future
procedures-as-subgraphs design should assume a resolver from the start rather than discovering it.

### ts-26 — Resumable runs
Captured variables + last completed step persisted to an encrypted run record; `save_skill_run`
returns a `runId`, `resume_skill_run` restores vars + `nextStepIndex`. "Long procedures survive a
closed laptop."
**partial.** `goals/effect-v4-workflow-engine-spike` targets exactly this class of guarantee —
persistence-backed `WorkflowEngine.makeUnsafe` proving one deterministic workflow survives real
process kill/restart with a keyed activity, durable clock, and deferred acknowledgment. But
`packages/drivers/workflow` **does not exist yet** (`ls` → No such file or directory) and
`rg 'WorkflowEngine' packages/**/*.ts` → empty. So: chartered, not built, and the Effect v4
workflow engine subsumes hand-rolled run records.

### ts-27 — The routing story's own counter-evidence (E6)
Blind position-counterbalanced judge, K=10/capability: cheap **cloud** (Haiku) retained 75% overall,
≥60% in every capability; the **local** 14B held only on mechanical capabilities (code 100%,
structured-output 80%, extraction 70%) and **collapsed on judgment** (reasoning **0%**, writing
**0%**, summarization 20%) — and the catalog's actual local model is a smaller 7B. Meanwhile the
headline 99.6% saving is achieved *precisely* by routing reasoning (51% of 809 steps) and writing
(11%) to free local models. The paper states the contradiction itself: "realizing that saving
*without* quality loss is **not** established… the 99.6%/96.6% gap is the price of the quality
risk, not a free lunch." Threats disclosed: K=10, single non-human-calibrated judge, 7/60 local
records materialized the relay, judge not blind on 3.
**not-applicable as a mechanism, high-value as a decision input.** It is the empirical case for
"cheap cloud, not local, for judgment work" and it directly contradicts the routing arm of the same
paper. Anything in beep-effect that proposes routing reasoning steps to a local model inherits this
evidence.

### ts-28 — "Dispatched but not walked" (the counterexample)
"A later firefight in which skills were *instructed but not walked* at the orchestrating level
regressed to the no-skills baseline — multiple rework loops, a net-negative verdict in the founder's
own retrospective. We keep this in the paper because it sharpens the claim: the benefit comes from
executing the procedure graph, not from a skill library merely existing in the cortex."
**partial.** The repo has 30 skills, a `Skill` tool, and skill-invocation instructions in `AGENTS.md`
— and no measurement of whether an invoked skill was *followed*. `goals/skillopt-training-pilot`
(7/7) built rollout scoring for a skill's *effect on a diff*;
`goals/coding-agent-effectiveness-evidence-loop` (0/9) is chartered to "make coding-agent
effectiveness measurable with trustworthy schema-first evidence." Neither measures adherence.
This is the paper's most valuable finding for this repo precisely because beep-effect's skill
library is large enough to be in exactly the failure mode described.

### ts-29 — Untrusted ingress: quarantine an imported procedure
"An imported pack is untrusted content entering the cortex… land an import in a quarantined scope
rather than merging it live, never auto-recall or auto-dispatch imported nodes, and treat an
imported skill as **not `dispatch-safe`** until the owner promotes it." Paired with the honest
admission that pack encryption uses "a fixed, obfuscation-grade key embedded in the open source"
delivering "integrity-by-signature, not confidentiality", and that "a license check on pack import
or export is a **product boundary, not a security control**."
**partial.** `skills-lock/v2` already treats vendored skills as content with graded provenance
(`exact|inferred|unresolved` status × `high|medium|low|unresolved` confidence) — the *epistemic*
half is there. The *authority* half is not: a vendored skill is fully active the moment it lands;
nothing marks an unpromoted skill as ineligible for auto-invocation. This is the natural join
between `beep skills provenance` and ts-19's ceiling.

### ts-30 — Skill-vs-skill conflict is not modeled (a named absence)
Supersession happens at the *node* level via the substrate's correction pipeline. "There is **no**
mechanism by which two skills conflict with each other or one skill supersedes another."
**partial**, and the gap is live here: beep-effect has 30 skills with overlapping trigger surfaces
(`ponytail` vs `ponytail-review` vs `simplify`; `effect-first-development` vs
`schema-first-development` vs `schema-model-specialist` vs `crispen`; `explore` vs `grill-me` vs
`grill-with-docs`), and nothing detects overlap or records supersession between them.
`goals/harness-hygiene-mechanical` (4/4) deleted four zero-signal skills by hand — evidence both
that the problem is real and that the current remedy is manual.

### ts-31 — The reflexive methodology note (§13.1)
"The order here was build-first… What the paper added was not the building but a *reckoning* with
it… Several fixes began as sentences that would not survive being written down — the
dispatch-but-don't-walk gap, and the chunk-splitting and goal-completeness defects caught while
cataloguing the corpus. **The manuscript paid for itself in defects surfaced, not only in claims
made.**"
**already-have.** This is `AGENTS.md`'s friction law ("record a receipt — what you were doing, the
evidence, what would have prevented it — at the moment it happens, never saved for closeout"),
`beep lint reflection-artifacts`, and `explorations/compound-engineering`'s explicit thesis
("Every unit of work emits two outputs: the deliverable, and information about how the work could
have been better. The second output is perishable"). beep-effect has independently converged on the
same finding and has gone further by moving capture *forward* in time.

### ts-32 — The Agempus reframe ("the engram IS the agent")
A skill engram = procedures + walk-time-bound private memory + dispatch index + cross-skill call
graph, co-located and owner-held. "The model is rented and swappable… while the Agempus is owned
and durable." Caveat stated exactly: "an Agempus acts only when a runtime *walks* it. Calling an
engram an agent is a claim about its structure and ownership, not that it loops autonomously."
**gap**, and mostly a naming move. `Agent` carries a single `skillFixtureKey`, so there is no bundle
to name. The one durable idea — *the unit of reuse is the owned procedure set, not the prompt, and
the model is a rented, per-step-swappable component* — is worth recording as a design stance for
`goals/agentic-professional-runtime` without adopting the vocabulary.

---

## 2. Cross-cutting judgment

**The paper's real contribution for this repo is not the graph.** It is three separable ideas that
do not require a subgraph substrate at all:

1. **Bounded execution where reaching the cap is a normal reported outcome** (ts-09, ts-21) — a
   per-loop authored cap with a recorded stop reason beats a global budget that errors. beep-effect
   runs several unbounded agent loops today.
2. **A dependency record that makes silent decay loud** (ts-12) — the one mechanism that answers
   "my runbook silently became wrong", and the one the repo is closest to (`beep knowledge
   semantic-delta` has the scope and the finding taxonomy, just not the claim-level dependencies).
3. **Ordered authority with min-composition and fail-closed absence** (ts-19, ts-20) — the algebra
   beep-effect's binary grant model does not express, and a repo law ("what proposes an action does
   not approve its own limits") that generalizes past graphs.

**What to refuse.** The vitality formula constants (arbitrary, saturated at 97.7 mean on its own
corpus), every cost figure (the 73.3% is by the author's own analysis `1 − Haiku/Sonnet` — a pricing
identity carrying zero information about skills), the ≈39–45× borrow-vs-spawn multiple (two
datapoints, different tokenizers on each side, memory-ablated comparison arm), and the
route-judgment-to-free-local strategy (ts-27 is the paper's own refutation).

**Trust calibration.** Three of five regression suites are not shipped and the two that are cannot
be run standalone; all pass counts are internal CI records. Read the design claims, not the numbers.
