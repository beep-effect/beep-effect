# Mapping: Graphnosis agent/MCP surface findings → beep-effect

Checkout: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `main` (`d1dfc4b3c1`), clean.
Source survey: `scratchpad/graphnosis/survey-agent-surface.md`.
Source repo: `/home/elpresidank/YeeBois/dev/Graphnosis`.

## Environment friction (recorded per AGENTS.md friction law)

Tool output in this session is being **word-mangled by a transport filter**: `rg`
results returned `non-deterministic` → `ni`, `Version` → `n`, `confidentiality` →
`nity`, `sensitive` → `il`, `classification` → `n`, `multilingual` → `n`. The
mangling applied to **both** `Bash` stdout *and* `Read` of a file that `rg` had
just written, so it is not a shell artifact. Consequence: every load-bearing
claim below was re-verified by `Read`-ing the actual source file or by
`rg -c` / `rg -l` (counts and filenames survive intact). Do not trust a quoted
grep line from this session without opening the file.

---

## 0. The three beep-effect surfaces this territory lands on

1. **`@beep/mcp-kit`** (`packages/foundation/capability/mcp-kit/src/`) — the
   reusable MCP host kit: `SourceAuth` (credential gates), `ToolkitComposition`
   (`hard` gates *vanish* at composition), `ApiKeyRequired` (typed
   `failureMode:"return"` envelope), `TierGate` (fail-closed dispatch boundary),
   `FieldTier` (progressive projection + `FieldProjectionOutcome`),
   `SanitizedSpan`, `McpCaller`, `ToolAnnotations` (the four MCP hints).
2. **`packages/epistemic/*`** — the authority model: `ExecutionGrant`,
   `GrantSet` (Draft→Frozen, digest-sealed), `ExecutionRecord`,
   `ExecutionVerdict`, `GovernedEgress`, `CandidateClaim`, `ClaimGate`,
   `ClaimDisposition`. Shipped by `goals/agent-execution-authority`
   (completed-retained, 7 PRs).
3. **`goals/practice-kg-mcp`** (active) — the live, product-facing MCP surface:
   ~9 read-only tools over the Oppold corpus, Claude Desktop as client #1.
   This is where most of the Graphnosis instruction-design ideas actually bite.

Existing packet for this whole mining run: **`explorations/graphnosis-prior-art`**
(CAPTURE.md written 2026-08-06; the method note already describes this mapper
step). Findings that are pure design-notes with no beep owner land there.

---

## gai-01 — Tool taxonomy axis switch; per-call determinism self-report

**Status: partial.**

What beep already has:

- **Per-call self-report of which path ran.** `FieldProjectionOutcome` in
  `packages/foundation/capability/mcp-kit/src/FieldTier.ts:321` is a
  `LiteralKit(["Inline","Fetchable"])` tagged union whose members each carry
  `tier: FieldTierName` — i.e. the response says which of three projections
  actually executed. Same mechanism as Graphnosis's `mode` field, applied to
  payload budget instead of determinism. `packages/drivers/nlp-mcp/src/StreamingTools.ts:77`
  ships a `truncated` boolean for the same reason.
- **The availability half of the tier axis, solved better.**
  `SourceAuth`/`ToolkitComposition`: a `hard`-gated source *vanishes from
  `tools/list`* when its credential is absent (per
  `packages/foundation/capability/mcp-kit/CLAUDE.md` surface map), and a `soft`
  gate returns the typed `ApiKeyRequiredFailure` envelope at call time
  (`packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:1-15`).
  A tool that is unavailable does not appear at all, which beats labelling it.
- **A curated tool table with a per-tool axis column.**
  `docs/product/ontology-agent-surface.md:25-35` — but the column is
  `Mode: read | mutation`, an *authority* axis, not a determinism axis.

What is missing:

- **No tool anywhere in the repo declares its determinism.** Checked every
  `*Tools*.ts` (`packages/drivers/{gov-legal-mcp,m365-mcp,nlp-mcp,uspto-mcp}/src/`,
  `packages/law-practice/{use-cases,server}/src/Tools.ts`,
  `packages/ontology/server/`): descriptions are single-sentence capability
  statements. `rg -rni "determinism tier|non-deterministic|approximate tool"`
  over the whole repo returns only `explorations/graphnosis-prior-art/CAPTURE.md`.
- `ToolAnnotations.ts` applies exactly the four MCP-standard hints
  (readOnly/destructive/idempotent/openWorld) — none of which says whether the
  result was computed or generated.

Why it matters here specifically: `goals/practice-kg-mcp/SPEC.md` D-2 **already
splits its data families on exactly this axis** — "(a) deterministic
docket-family spine … **no LLM anywhere in this layer**; (b) OA span-grounded
candidate claims … **with a real LanguageModel layer**". The split exists in
the spec and does not reach the agent as a tier on the tool.

**Recommendation:** add a determinism tier to `@beep/mcp-kit` alongside
`FourHintAnnotations` (a `LiteralKit(["deterministic","approximate","model-derived"])`
annotation + a matching field on responses whose path can vary), and group the
practice-kg tool table by it. `FieldProjectionOutcome` is the shape to copy.

Landing: `goals/practice-kg-mcp`. Value 4, effort M.

---

## gai-02 — "Two non-negotiable habits"; anti-rationalization clauses inline

**Status: partial.**

beep already writes instructions in this exact voice. From `AGENTS.md` (121
lines, read in full):

- `:37-38` — "The old `standards/repo-exports.catalog.*` is retired; **never look
  for it** or run repo-export catalog commands as a discovery or proof step."
- `:53-55` — "Attribute verification failures before repairing — introduced /
  inherited / unrelated / environment-only; attribution decides fix vs rebase vs
  report, **not blind rerun**."
- `:56-60` — "**never leave threads standing or ask the operator to relay them**."
- `:88-92` — friction receipts "at the moment it happens, **never saved for
  closeout**."
- `:120-121` — "**never chat-only summaries**."

And the **redundancy-at-the-call-site** mechanism is already in production:
`packages/foundation/CLAUDE.md` and
`packages/foundation/capability/mcp-kit/CLAUDE.md` restate the relevant laws at
the directory you are editing, which is precisely Graphnosis's "repeat the rule
where violating it is tempting".

What is missing: **the recall-first habit itself.** `AGENTS.md:94-100` ("Agent
Memory") names Cognee as the durable dev-memory and the fallback, but never
instructs an agent to *query it before answering*. The operational runbook,
`standards/memory-architecture/06-agent-memory-operations.md`, is 31 lines and
its "Recall routing" section is three bullets about which server to prefer —
no "recall before answering, even if your own history looks empty".

**Recommendation:** one bullet in `AGENTS.md` "Agent Memory", carrying the
anti-rationalization clause. Cheap. The technique is already house style.

Landing: `explorations/compound-engineering`. Value 3, effort S.

---

## gai-03 — Query-transformation curriculum keyed to the engine's blind spots

**Status: partial — and this is the highest-value mapping in the set.**

The one existing brick: `.claude/skills/repo-symbol-discovery/SKILL.md` is
exactly this pattern for a *different* engine — ripgrep recipes keyed to how the
source tree is laid out ("Canonical Lookup", "package barrels list the public
surface", "For an intent-based search … search bodies and JSDoc"). It proves
beep knows the form.

Nothing covers the retrieval engines:

- `standards/memory-architecture/06-agent-memory-operations.md` — recall routing
  only, zero query-formulation guidance for Cognee.
- `goals/hybrid-retrieval-fusion-core/SPEC.md` — fuses **semantic + lexical FTS +
  exact-literal + optional graph** ranked channels; the SPEC specifies fusion
  arithmetic, empty-channel renormalization, tie-breaking and contribution
  exposure, and says nothing about how a caller should *shape the query*.
- `goals/practice-kg-mcp/SPEC.md` D-2(d) — "corpus full-text search over the
  extracted text", no query contract.
- `rg -rni "query transformation|synonym|stopword"` over `explorations/`,
  `goals/`, `docs/` returns only external-research notes (embedding bakeoffs,
  courtlistener clustering), no agent-facing curriculum.

Why it bites here harder than in Graphnosis: a Postgres/SQLite FTS lexical
channel has the *same* named blind spots (stemmer, stopword list, no semantic
awareness), and the corpus is **legal text**, where the highest-idf tokens are
proper nouns that must not be normalized: application numbers, `In re Bilski`,
inventor surnames, `37 CFR 1.56`, CPC codes. Graphnosis's "anchor on proper
nouns, verbatim spelling, never transliterate" is directly load-bearing, and the
bounded zero-result retry ("1–2 other plausible …") is what stops an agent
looping.

**Recommendation:** author the query curriculum as a section of the practice-kg
tool documentation *and* as agent-visible text, with each rule naming the engine
property that motivates it (which analyzer, which stemmer, which stopword set —
facts the fusion-core SPEC can state), plus a bounded retry policy.

Landing: `goals/hybrid-retrieval-fusion-core` (it owns the channel semantics the
rules must cite). Value 5, effort M.

---

## gai-04 — Escalation policy in the tool description; harness-aware pre-load; in-band redirect hints

**Status: partial.**

Already have — mechanism (3), the in-band control signal:
`ApiKeyRequiredFailure` is a structured result the calling model is explicitly
meant to act on. From `packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:1-15`:
`"return"`-mode failures are folded into the tool's success union (verified
against upstream `Toolkit.ts:240-242`) and shipped as
`CallToolResult({ isError: false, … })` with the encoded failure JSON mirrored
into `content[].text`, so "the calling model … can self-correct instead of
treating the call as a hard failure". That is a control token in the *result*,
by design.

Already have — partial harness-awareness: `AGENTS.md:112-114` "Keep the MCP/tool
surface stable within a session; settle `.mcp.json` and enabled tools before
working, not mid-task."

Missing:

- **No escalation policy in any tool description**, and no forbidden-utterance
  formulation anywhere. Checked descriptions in
  `packages/drivers/uspto-mcp/src/UsptoTools.ts`,
  `packages/drivers/nlp-mcp/src/StreamingTools.ts`,
  `packages/drivers/{gov-legal-mcp,m365-mcp}/src/`,
  `packages/law-practice/use-cases/src/Tools.ts` — all single-sentence
  capability statements, no cross-tool sequencing.
- **No deferred-schema-loading instruction.** Relevant: this repo's own Claude
  Code sessions run with `ToolSearch`-deferred tools (see this session's system
  reminder), so the exact hazard is live.
- **No document-level redirect hint** from a search result.

**Recommendation:** for the practice-kg search tools, put the escalation rule in
the description as a forbidden utterance ("do not report *no matching docket
family* until `kg_*_search` has run with the same query"), and emit a
`sourceIds` redirect hint when a query matches document-level metadata rather
than a chunk. Both are additive to the existing `mcp-kit` failure/annotation
machinery.

Landing: `goals/practice-kg-mcp`. Value 4, effort S.

---

## gai-05 — Per-stage retrieval provenance with a >60% threshold that changes what the agent must SAY

**Status: partial.**

beep's provenance accounting is **already stronger than Graphnosis's**.
`goals/hybrid-retrieval-fusion-core/SPEC.md` requirement 6: "Duplicate candidate
IDs across channels yield one result. Contributions name their channel and expose
rank, configured/effective weight, RRF component, and weighted contribution;
**their deterministic sum equals the fused score.**" Requirement 4 covers
empty-channel renormalization with exposed configured/effective weights.
Graphnosis reports node counts per stage; beep reports an auditable score
decomposition.

What is missing is the *second half*: a **server-computed boolean** that binds a
retrieval-quality condition to a **prescribed user-facing utterance**. Nothing in
the SPEC's acceptance criteria turns a contribution profile into a disclosure
obligation.

beep does have this shape at a different altitude — `goals/patent-citation-candor-gate`
is precisely "a computed condition forces an explicit, auditable human
disposition, fail-closed" — so the pattern is native; it just does not exist at
the retrieval layer.

**Recommendation:** add one boolean to the fusion result (e.g.
`indirectDominant` — the fraction of fused score contributed by non-content
channels crossed a fixed threshold) and one contract line binding it to a
disclosure. A number the model must interpret is worse than a boolean it cannot
misread; that is the transferable part.

Landing: `goals/hybrid-retrieval-fusion-core`. Value 4, effort S.

---

## gai-06 — Layered `.gai`/`.gnn`/`.gll`; write privilege enforced by file separation

**Status: partial (guarantee already-have; response-rendering convention missing).**

beep's equivalent is stronger than file separation because it is enforced by the
type system *and* the database:

- `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts`,
  `.../entities/ClaimDisposition/ClaimDisposition.model.ts`,
  `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` — candidate
  and accepted are different entities behind a gate service, not two files a
  writer might address.
- `standards/memory-architecture/README.md` — "semantic layers as managed caches,
  not sources of truth … **every semantic fact must trace back to a
  deterministic source or carry an explicit uncertainty marker**." That is
  Graphnosis's inferred-layer doctrine, as binding repo law.
- `goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md` —
  candidate/accepted/rejected/revision_requested/superseded, and the escape
  hatch Graphnosis names ("save the user's confirmation, not the inference") is
  beep's `accepted` verdict: "Acceptance records the human-disposition verdict —
  one of seven independent typed verdicts … none implies another."
- `goals/practice-kg-mcp/SPEC.md` D-4 already fences the layers **in tool
  output**: "Candidate claims are labeled `candidate — unreviewed` with their
  evidence span; spine rows are labeled derived-from-official-records." D-2(c)
  adds "confidence stated in tool output".
- "Never promote an inference" is structurally impossible in practice-kg v1:
  D-4 — "Every tool is read-only. **No write tools.**"

Missing: the **compact per-row tag convention**. Graphnosis tags every inferred
row `[gll·assertion 78%]` / `[gnn·edge 91%]` — engine + kind + confidence in six
characters — so the distinction survives inside a flat text block an LLM reads
linearly, and orders attested-first / inferred-last behind a header that says
what it is not. beep's D-4 labels are prose per row with no fixed grammar and no
ordering rule.

**Recommendation:** fix a row-tag grammar and a section order for practice-kg
tool output. Cheap, and it is what keeps the D-4 labels from being paraphrased
away by the model.

Landing: `goals/practice-kg-mcp`. Value 3, effort S.

---

## gai-07 — Sensitivity tiers, intent-scoped consent gating, headless typed-phrase fallback

**Status: partial.**

Already have:

- **Time-boxed, policy-pinned authority.**
  `packages/epistemic/domain/src/values/ExecutionGrant/ExecutionGrant.model.ts:1-14`
  — "A grant names what one principal may do — one operation against one sink —
  under a pinned policy revision **and an expiry**. Grants are held only by the
  enforcement boundary and are **never issued to the agent as a credential**, so
  there is nothing for a prompt-injected agent to leak, replay, or forward."
  Graphnosis's Allow-1h / Allow-today, at a better layer.
- **A partial-surface mechanism already running.** `TierGate`'s
  `withEnabledWhenApprovedTool` filters `tools/list`; `hard`-gated sources vanish
  at composition. A beep agent *already* sees a partial tool surface.

Missing:

- **No sensitivity tier on any record.** `rg -ril "matter.isolation|ethical.wall"`
  over `packages/` returns **zero files**; the concept exists only as vision
  (`docs/PROSE_TO_PROOF_VISION.md` — "One logical graph, **walled by matter** —
  each matter a named subgraph that doubles as an ethical wall with legal
  force") and as a research note that says so explicitly
  (`goals/agentic-professional-runtime/research/gold-intake-agent-skills-ethical-wall.md`
  — "beep has none today").
- **No consent gate.** `rg -rn "consent" packages/ -g '*.ts'` (non-test) returns
  only the generated IANA media-type table (`application/edi-consent`) and
  unrelated substrings. No modal, no grant-on-demand, no headless protocol.
- **No agent-facing partiality corollary.** Nothing tells an agent that its tool
  surface or its results may have been silently narrowed, so a beep agent will
  report absence as a fact. Given `hard`-gate vanishing and `TierGate`
  list-filtering are both live, this is a real, current defect, not a future one.

The headless typed-phrase protocol (present the notice verbatim, direct to a
settings path, relay exactly what was typed, `SKIP` terminates, never synthesize
the phrase) is genuinely novel for beep and fits a solo attorney driving agents
from a terminal or a cron job — `goals/practice-kg-mcp` explicitly names "cron
jobs, and background agents" as the same consumer as Claude Desktop.

**Recommendation:** (1) one line of agent-facing law: tool surfaces and results
may be narrowed by policy — never report absence as proof of absence; (2) take
the intent-scoping rule (broad query silently narrows, only an explicitly named
sensitive scope prompts) as the design default when the matter-wall lands.

Landing: `goals/agentic-professional-runtime` (owns the approval/autonomy policy
and the Agent/Skill stubs). Value 4, effort L.

---

## gai-08 — `maxAutonomy`: an authority ceiling that travels in the artifact

**Status: partial. Strongest structural mapping in the set.**

beep has a **host-side, session-scoped** authority model that is more rigorous
than the Graphnosis proposal in every respect except portability:

- `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:1-20` —
  Draft/Frozen expressed as *types* ("widening a frozen set does not compile"),
  sealed by a SHA-256 digest re-verifiable at any read, with
  `FrozenGrantSet.make` banned outside the module by repo law. And, crucially:
  "**Grants derive only from session-static inputs (config, policy revision,
  caller identity), never from tool output.** That is what makes the freeze
  sound: the allowed-destination set provably predates any untrusted content
  that tries to change it."
  → That is **Graphnosis rule 5** ("a process minting a node MUST NOT set
  `maxAutonomy` above the ceiling of the context it runs in" / "what proposes an
  action does not approve its own limits"), already implemented.
- `packages/foundation/capability/mcp-kit/src/TierGate.ts` — the fail-closed
  dispatch boundary; `goals/agent-execution-authority` acceptance criterion 1:
  "Dispatch refused when the frozen grants do not authorize it; refusal is a
  typed value." → **rule 1** (a ceiling is a maximum, never a grant), done.
- `packages/epistemic/server/src/GovernedEgress/` + `EgressDenied` (field-free by
  design) → default-deny egress.

Missing — and it is exactly the half Graphnosis proposes:

- **No authority field on a portable artifact.** beep *does* borrow executable
  procedures from third parties: `skills-lock.json` at repo root, governed by
  `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts` (1,675 lines,
  `skills-lock/v2`) — pinned upstream revision, per-file content digests,
  aggregate pristine/effective hashes, provenance confidence
  (byte-exact / inferred / unresolved), patch review labels, SPDX license bytes.
  Provenance is exhaustive. **Authority is absent**: `rg -in
  "permission|authority|allowed|capabilit|autonom|trust"` over that file returns
  two hits, both the word "allowed" in prose about *which source kinds may be
  pinned*.
- **No min-over-members composition rule** and **no fail-closed-on-absence rule**
  for an imported artifact. `rg -l "maxAutonomy|authority ceiling|AuthorityCeiling"`
  over `packages/` returns nothing; the term appears only in `docs/`,
  `explorations/`, `goals/` prose.

The transferable core is rules 2 and 4 together — *minimum over members* +
*unspecified is the most restrictive level the host supports*. Together they mean
an unknown, malformed, or hostile borrowed procedure can only ever **reduce** the
host's authority. That is what would make `skills-lock/v2` safe to point at
arbitrary upstreams, and what would let an attorney-authored SOP declare "never
unattended" in a way that survives being handed to a different runtime.

**Recommendation:** add an optional monotone authority ceiling to
`skills-lock/v2` entries (and to the future `Skill` entity), with the two rules
normative: effective ceiling = min over members; absent = most restrictive.
Enforce at the same boundary that already freezes grants, so the ceiling
*lowers* the frozen grant set and can never raise it.

Landing: `explorations/agent-governance-control-plane` — active, capture stage,
its open question is literally "explicit agent-role authority … which parts still
justify a separately shaped governance capability", and it already received a
corpus dispatch naming "trajectory envelopes, commitments, principals,
performatives, budgets, break predicates". Value 5, effort L.

---

## gai-09 — Per-layer conformance L1/L2/L3; "ranking is not conformance"

**Status: partial.**

The *conformance-levels* framing is largely **not applicable**: beep publishes no
external format with independent implementations, so the "many implementations
prove the bytes are unambiguous / ranking is a design position" argument has no
consumer here.

What *is* applicable is the cross-layer obligation — **push the fail-closed
default below the layer that enforces the feature** — and beep has a real
population of versioned envelopes read by more than one program:

- `skills-lock/v2` (`Skills.schemas.ts`)
- `hook-pulse/v1` + its legacy migration codec
  (`packages/tooling/library/ai-metrics/src/hook-pulse.ts:735-824`)
- `qa-inventory/v1` (`AGENTS.md:78-79`, judged by an out-of-process vision task)
- `epistemic-grant-set/v1` — with the version-skew instinct already correct:
  "Digest version prefix. **Bump whenever the canonical encoding changes so old
  and new digests can never collide in a table that holds both.**"
  (`GrantSet.model.ts`)
- `initiative-manifest/{v1,v2}` + `1.0.0`
  (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts`) — where
  `schemaVersion` is `S.optionalKey` at `:450`, i.e. **absence is currently
  permission**, the exact hazard Graphnosis rule 4 names. Low blast radius here
  (a manifest, not an authority field), but it is the live instance.

Also relevant to beep's own history: MEMORY.md records "check-mode envelopes
poison next publish" — a version/mode-skew incident treated as corruption, which
is the failure Graphnosis's `version-skew ≠ corruption` split exists to prevent.

**Recommendation:** a one-paragraph standard for beep's versioned envelopes —
unknown/absent version fails closed, never permissive; a must-understand list for
future extension; skew is reported as skew, not as corruption. Do **not** port
the L1/L2/L3 scheme.

Landing: `explorations/graphnosis-prior-art` (design note; no beep owner today).
Value 3, effort M.

---

## gai-10 — Skills as ordinary nodes/edges tagged via `evidence`; unbounded loops invalid

**Status: partial.**

Bricks that exist:

- `packages/agents/domain/src/entities/Skill/Skill.model.ts` — read in full. The
  entire entity is `{ fixtureKey: SkillFixtureKey, name: SkillName }`. No steps,
  no contract, no trigger, no prerequisites, no bound. A declared stub.
- `packages/agents/domain/src/entities/Agent/Agent.model.ts` — `mode: AgentMode`,
  a single literal `deterministic_fixture`, folded through
  `S.toTaggedUnion("mode")` at `:69-75` — i.e. the union is already open for a
  second execution mode.
- The edge substrate Graphnosis's representation would ride:
  `packages/epistemic/domain/src/entities/EdgeVersion/`,
  `.../values/EdgeRelation/`, `.../values/LogicalEdgeIdentity/`,
  `.../values/EdgeEndpoint/` — bitemporal, versioned, provenance-bearing edges,
  owned by `goals/epistemic-bitemporal-edge-core`.
- `.claude/skills/` — 30 markdown skills; borrowed ones pinned by
  `skills-lock.json` (see gai-08).

Missing:

- No graph representation of a procedure. `rg -rn "maxIterations|loop bound|
  unbounded loop|termination bound"` over `packages/` returns nothing.
- **No termination bound anywhere on a borrowable procedure.** The `.claude/`
  skills are prose; nothing declares or enforces a loop cap.

The architectural fit is unusually good: representing a skill as `precedes` edges
over existing epistemic nodes, discriminated by an `evidence` tag, means skills
inherit bitemporality, supersession, provenance and (per gai-08) authority
ceilings for free, and no reader that ignores skills needs to change. That is the
same "structural, not a new node kind" argument, and beep's edge model is
already richer than Graphnosis's.

The load-bearing safety rule generalizes past the format: **an artifact you can
borrow and execute must carry its own termination bound, because the borrower
cannot infer one.** beep borrows executable procedures today (skills-lock) with
no bound at all.

**Recommendation:** when the `Skill` stub is filled in, represent steps as
tagged epistemic edges rather than a new entity family, and make an unbounded
loop a decode-time invalid state (a schema check, not a runtime guard).

Landing: `goals/agentic-professional-runtime` (owns the Agent/Skill stubs and the
autonomy policy). Value 5, effort L.

---

## gai-11 — Paired explain/execute skill tools; resumable `SkillExecutionPlan` IR

**Status: partial.**

Already have — the resumption half, in a stronger form.
`goals/effect-v4-workflow-engine-spike` (active) is proving a
persistence-backed Effect v4 `WorkflowEngine.makeUnsafe` adapter that "can
recover one representative workflow **across a real process kill and restart**",
against a 14-point durability checklist. That subsumes
`save_skill_run`/`resume_skill_run` (runId, captured vars, `nextStepIndex`) —
durable execution as an engine rather than two tools the agent must remember to
call.

Also already have, in effect: the plan IR's constituents exist as Effect
primitives (typed inputs/outputs, named bindings, concurrency, failure routing).
Porting the JSON IR verbatim would be redundant **for code-authored procedures**.

Missing, and the reason it is not simply not-applicable: a procedure authored by
an *attorney* and executed by an *agent* must be **data**, not code — which is
what the `Skill` entity stub is for (gai-10). For that, the plan shape is a
useful checklist of what such data must carry: declared `requires` with type
hints, declared `produces`, `captureAs` bindings, `parallel` members,
per-loop `maxIterations`, `failureHandlers`, and `unresolvedCall` surfaced rather
than auto-created.

The separable design decision worth taking regardless: **two names bound to two
intents beats one tool with a `format` parameter the model will get wrong**, with
the preference stated in the description. beep's `FieldTier` takes the opposite
route (one tool, a budget option) but pays for it with `FieldProjectionOutcome`
self-reporting; both are defensible, and the choice should be deliberate.

**Recommendation:** treat the plan shape as the acceptance checklist for the
`Skill` entity's fields, and let the workflow engine own execution and
resumption. Do not build a parallel runner.

Landing: `goals/effect-v4-workflow-engine-spike`. Value 3, effort L.

---

## gai-12 — Error taxonomy keyed on caller action, surviving JSON-RPC and bundler duplication

**Status: already-have, and beep's version is structurally stronger.**

- **`instanceof` is not used for domain error classification.**
  `rg -n "instanceof" packages/ -g '*.ts' --glob '!**/test/**'` → 70 hits,
  every one of them a host built-in check (`Error`, `Uint8Array`, `File`,
  `Element`, `S.SchemaError`, ts-morph nodes). Domain errors are
  `TaggedErrorClass`/`CauseTaggedError` with `S.is(...)`-derived guards — see
  `packages/foundation/capability/api-transport/src/EgressDenied.ts:43-51`
  (`static readonly is = S.is(EgressDenied)`).
- **Codes are schema-encoded and survive JSON-RPC by construction.**
  `packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:1-15` documents
  the verified upstream path: `"return"`-mode failures fold into the tool's
  success union and ship as `CallToolResult({ isError: false })` with the
  **encoded failure JSON** mirrored into `content[].text`. A `_tag` string
  survives `JSON.stringify`; that is the whole gai-12 fix, obtained from the
  schema layer rather than hand-rolled.
- **Single source of truth by construction.** The code↔class relationship in
  Graphnosis is a hand-maintained frozen map that had already diverged once.
  beep's equivalent is the schema itself, so a second copy cannot exist.
- **The action-keyed axis is already house style elsewhere.**
  `QualityIssueAttribution = LiteralKit(["introduced","inherited-adjacent","not-applicable"])`
  (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts:158`) and
  `FindingAttributionKind`
  (`.../commands/Quality/internal/FallowEnvelope.schema.ts:80`), with
  `AGENTS.md:53-55` making the class decide fix vs rebase vs report.
- **No substring-matching consumer.** `apps/professional-desktop/src/lib/failureMessage.ts`
  reads `.message` only to *display* it (via `redactCauseForClient`), never to
  branch. Checked in full.

Residual worth one line somewhere: freeze prose, extend codes, and never let a
message become an interface. Not worth a packet.

Landing: NONE. Value 2, effort S.

---

## gai-13 — No-egress invariant at the definition site, with a carve-out and a falsification procedure

**Status: partial.**

Already have — enforcement, and better than a banner:

- `packages/epistemic/server/src/GovernedEgress/{GovernedEgress.fetch.ts,GovernedEgress.layer.ts}`
  — default-deny outbound boundary; `EgressDenied` is deliberately field-free
  because "a denial reason returned to an agent is a payload-smuggling and
  probing channel".
- `packages/epistemic/server/test/GovernedEgress.test.ts` — `expectDenied`
  asserts the URL **never reached the base fetch** (stub fetch at 0). That is a
  falsification test, in CI, on every PR — strictly stronger than a documented
  procedure.
- `packages/epistemic/domain/test/ExecutionAuthority.test.ts` — "keeps the
  ungoverned-infrastructure destination set empty".
- `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`
  — a poisoned read followed by a publish to the injected destination is denied.
- Import-level enforcement exists too:
  `packages/tooling/policy-pack/lint-rules/src/rules/namespace-node-imports.ts`,
  plus the node-builtin import gate on typechecked `src`.

Missing:

- **No invariant banner at a definition site.** No `@beep/*` barrel opens with
  numbered security invariants naming the modules it must never import, nor an
  enumerated carve-out of the exact symbols that *do* reach the network. The
  invariants live in tests and in packet prose, where an author editing the
  barrel will not see them.
- **No published, third-party-runnable falsification procedure.** Nothing tells
  an outsider: read this re-export list, grep this transitive import graph for
  these five tokens and find zero hits, then run under `unshare -n` and confirm
  everything still works.

Why this matters more here than there: the standing OIP rule is that
pre-publication patent text never leaves the device. A five-minute, third-party
`unshare -n` proof that the local processing path performs zero egress is a
**client-facing artifact**, not just hygiene — and beep is already ~90% of the
way to being able to publish one.

**Recommendation:** (a) invariant banners on the barrels that must not egress,
with the forbidden imports named and the carve-out symbols enumerated;
(b) a published three-step audit procedure, with step 3 the network-sandbox run.

Landing: `explorations/ingestion-security-secret-governance` (active, graduate
stage; owns the security-governance surface, with `goals/ingestion-secret-scrub`
as its live child). Value 4, effort M.

---

## gai-14 — `log-redact`: stable FNV-1a pseudonymization

**Status: already-have, materially stronger.**

- `packages/tooling/library/ai-metrics/src/privacy.ts` —
  `hashPrivateIdentifier(value, salt)`: **salted SHA-256** via
  `globalThis.crypto.subtle` for "private identifiers such as local paths and
  session ids" (`:426-440`), and `hashPublicTextSha256` (`:413-424`) for the
  unsalted public case. Graphnosis's own header concedes unsalted FNV-1a is
  "cryptographically weak by design"; beep pays the salt.
- The weak case is a **declared state**, not a silent fallback:
  `AiMetricsHashSaltStatus = LiteralKit(["provided","insecure_default"])`
  (`:81`), `AI_METRICS_LOCAL_INSECURE_HASH_SALT` (`:57`) whose value literally
  contains "insecure", and `resolveAiMetricsHashSaltValue` (`:377`).
  `hashSaltStatus` is carried on the privacy record (`:263`).
- Stability across call sites is preserved (same input+salt → same token), which
  is the property Graphnosis argues for over `[REDACTED]`.
- Wired: `.claude/hooks/hook-pulse.sh:114,123,133-135` names
  `hashPrivateIdentifier` as "the oracle, not this comment";
  `packages/tooling/library/ai-metrics/src/hook-pulse.ts:553` applies it;
  `hook-pulse.ts:735-824` is a migration codec that pseudonymizes *legacy*
  pre-pseudonymization rows on decode.
- The same threat model is applied to telemetry, which Graphnosis does not do:
  `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`
  (`sanitizeTracerAttributes`, `withSanitizedToolSpan`, `sanitizedToolkit`)
  suppresses raw tool `parameters` from span attributes, and
  `packages/drivers/gov-legal-mcp/src/Handlers.ts` scrubs
  `url.full` / `url.path` / `url.query`.
- Reachability — the defect Graphnosis shipped (`redactId` compiled but not
  exported) — does not apply: these are workspace-internal `@beep/*` packages
  resolved by the monorepo, and the mcp-kit barrel curates every export.

Residual: none actionable.

Landing: NONE. Value 2, effort S.

---

## Antipatterns — does beep risk the same mistakes?

| Graphnosis antipattern | beep exposure |
|---|---|
| `GRAPHNOSIS_MCP_ROOT` set and read by nothing; four copies of an unchecked `expandPath` | **Low, but worth a check.** `goals/ontology-agent-surface` is explicitly "stateless over saved Turtle files, CAS-safe"; `packages/drivers/nlp-mcp/src/StreamingTools.ts` takes model-supplied file paths. The generalizable lesson — *a path-resolution helper duplicated per tool is how the root check gets lost* — argues for one shared resolver in `@beep/mcp-kit` if any beep MCP tool ever takes a filesystem path from the model. Not mapped as a finding; flag for `goals/practice-kg-mcp` (read-only, local corpus). |
| One shared HTTP transport + module-global session map ⇒ cross-client reads/writes | **Already reasoned about.** `packages/foundation/capability/mcp-kit/src/McpCaller.ts` documents exactly this hazard: `clientId` "identifies one **protocol exchange** (the HTTP protocol mints it per request)", `sessionId` is the `mcp-session-id` header "and the only stable per-session key". MEMORY.md carries it as a durable note. `goals/agent-execution-authority` shape decision 10 keys a run to an MCP session deliberately. No "most-recently-loaded" default anywhere. |
| Instruction file documents ~48 tools the repo does not implement | **Live risk, different shape.** beep's analogue is stale-doc drift between `docs/product/*.md` tool tables and the registered toolkits. `AGENTS.md:115-117` already treats always-loaded files as a maintained prompt-cache prefix. Worth a generated-vs-authored check on the practice-kg tool table. |
| MCP tools throw bare `Error` with prose | **Not at risk** — see gai-12. Typed, schema-encoded failures throughout; `EgressDenied` is field-free by design; the ontology surface has a named typed-refusal contract (`docs/product/ontology-agent-surface.md:95-113`). Note beep also avoids the second half of that defect: it does not echo resolved host paths back into model context (`SanitizedSpan`, `redactCauseForClient`). |
| `redactId` shipped but unreachable | **Not at risk** — workspace-internal packages, curated barrels, and `bun run docgen` proves barrel examples compile. |
| `buildGraphPrompt` injects English-only benchmark rubric into every caller's prompt | **Real risk class.** The lesson — *benchmark-tuned corpus-specific heuristics must not live in the default code path of a general capability* — maps onto `goals/hybrid-retrieval-fusion-core` (whose SPEC keeps the fusion core fixture-driven and channel-agnostic, correctly) and onto the `_gold-intake` mojibake-repair table (`explorations/_gold-intake/research/per-repo/doctor.md:165`), which is court-specific and must stay a domain artifact, not a core transform. Also note gai-03's rules must be *stated as engine facts*, not baked as silent query rewriting — the same trap. |

---

## Ranking for beep-effect

| Value | Findings |
|---|---|
| 5 | gai-03 (query curriculum), gai-08 (portable authority ceiling), gai-10 (skills as tagged edges + bounded loops) |
| 4 | gai-01 (determinism tier), gai-04 (escalation in tool description), gai-05 (threshold → obligation), gai-07 (sensitivity/consent), gai-13 (no-egress audit procedure) |
| 3 | gai-02 (recall-first habit), gai-06 (row-tag rendering), gai-09 (fail-closed envelope versioning), gai-11 (plan shape as Skill checklist) |
| 2 | gai-12, gai-14 — solved, and solved better |
