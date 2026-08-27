# G3 — Amendment H prior art: typed work plans vs generated launcher prompts

**Date:** 2026-08-26
**Session:** packet-system-redesign session B, G3 (Grok)
**Stance:** adversarial. Hypothesis under test: *generating the agent launcher prompt (`GOAL.md`) from structured plan data is better than hand-authoring it.*
**Output contract:** six research items, then a verdict of (a) type-and-render, (b) type-but-hand-author, or (c) neither.

## Evidence legend

| Tag | Meaning |
|---|---|
| **VERIFIED** | Fetched the primary page/docs/source in this session and quoted or paraphrased from that fetch. |
| **SEARCH-HIT** | Appeared in search results / snippets; not independently fetched unless also tagged VERIFIED. |
| **INFERRED** | Author synthesis from verified facts. Not a source claim. |
| **UNCONFIRMED** | Could not fetch, paywalled, GitHub-blocked, or conflicting secondary reports. Do not treat as settled. |

Every factual claim below carries a URL. Claims without a URL are labeled INFERRED or UNCONFIRMED.

Firecrawl MCP was rate-limited this session (anonymous quota). Primary fetches used `open_page` / `web_fetch` plus X search tools. GitHub HTML pages occasionally returned the "Uh oh / You can’t perform that action" interstitial; those are tagged UNCONFIRMED when the body was not recovered.

## Question restated

The team keeps ~214 packets. Each packet has a machine-readable manifest (phases, stop conditions, source-of-truth files) **and** a hand-authored `GOAL.md` used as a compact coding-agent launcher, bounded by a character budget.

The proposal (Amendment H, queued in `MAP.md`) adds a typed `PacketWorkPlan` to the manifest in which every phase step binds a responsible agent (kind, model, effort), allowed tools/skills, constraints, and resources — then **renders** `GOAL.md` from that plan under a four-part prompt contract (instruction / context / input data / output indicator), making the launcher a read-only projection. Motivation quoted from the queue: "which model at which effort ran which phase with which tools is the packet fact most often re-derived from session memory; the launcher is the one packet artifact that is authored by hand yet fully determined by the others." (local: [`MAP.md`](../../MAP.md) L107–122; AgentO mapping: [`research/2026-08-25-agento-ontology-mapping.md`](../2026-08-25-agento-ontology-mapping.md) L63–73.)

Two separable bets live inside that proposal:

1. **Typing the work plan** (per-step agent + model + effort + tools as validated config).
2. **Rendering the launcher** from that typed plan (hand-authored `GOAL.md` dies).

The hypothesis to refute is specifically (2). (1) is in scope because H couples them. The "fully determined" claim is itself the claim under test.

---

## 1. Who binds model / effort / tools per workflow step, in typed config?

**Finding (INFERRED from the table):** per-step *agent + tools* is first-class in several shipped systems. Per-step *model* is common. Per-step *effort* (reasoning level) is almost nowhere a typed workflow-step field — it lives on the model API call or in a session wrapper. Nobody who ships a typed work-plan also *renders the human-facing launcher prompt as a read-only projection of that plan*. The closest analog, CrewAI, binds `agent` + `llm` + `tools` per task in YAML/JSONC **and still hand-authors** `description` / `expected_output` as free-form prose.

### Working table

| System | Per-step agent | Per-step model | Per-step effort | Per-step tools | Typed / validated? | Verdict |
|---|---|---|---|---|---|---|
| LangGraph | node function | `bind_tools` / dynamic `(state, runtime) -> model` | no | `model.bind_tools(tools)` | Python/TS types on state; graph is code | code-first, not a typed plan document |
| CrewAI | **yes** (`task.agent`) | **yes** (`agent.llm`) | no (`max_iter`, `reasoning` bool) | **yes** (agent-level *and* task-level) | JSONC / classic YAML + Python; not a closed JSON Schema | closest analog |
| AutoGen / AgentChat | Agent instance | `llm_config` / model client | no | tools on agent | code-first | not a per-step YAML plan |
| Mastra | `createStep(agent)` / graph `type: "agent"` | agent `config.ts` `model`; `prepareStep` can swap | no | `tools/` + per-step override | **Zod / Standard JSON Schema** on step I/O | typed workflow, authored instructions stay in `instructions.md` |
| Temporal | activity stub | N/A (not an LLM field) | N/A | **task queue** routes the worker | `ActivityOptions` strongly typed | executor routing, not model routing |
| Dagster / Airflow | op / task | resource / executor is process-level | retries/timeouts, not effort | resources / pools | Python + config schema (Dagster); YAML DAG (Airflow) | executor config ≠ model+effort |
| GitHub Actions | job | **`runs-on`** (machine, not LLM) | no | steps / actions | workflow YAML schema | per-job *runner*, not per-job *model* |
| Semantic Kernel | YAML `Agent` | `model.id` | `execution_settings` (temp/tokens, not reasoning-effort) | `tools:` list | YAML declarative spec + prompt templates | typed agent YAML; instructions remain a template string |
| Google ADK | YAML agent + `sub_agents` | **yes** (`model:`) | no | **yes** (`tools:`) | **JSON Schema** (`AgentConfig.json`) on YAML | typed agent config; `instruction:` is still authored prose |
| OpenAI Agents SDK | Agent + handoffs / `asTool` | **yes** (`model`) | `modelSettings`; effort is a Responses API field, not an Agent constructor field | **yes** (`tools`, MCP) | TypeScript/Python classes + Zod | per-agent, not per-workflow-step document |
| A2A `AgentCard` | skills, not steps | **no** | **no** | skills, not tool bindings | **proto-normative** JSON | capability card, not a work plan |
| MCP server | N/A | N/A | N/A | **yes**, JSON Schema `inputSchema` | JSON-RPC schema | capability declaration, not per-step agent assignment |
| Agent Protocol (LangChain) | agent id | optional `config_schema` | no | no | OpenAPI | serving API, not a work plan |
| `AGENTS.md` | no | no | no | no | **explicitly untyped Markdown** | 60k+ repos; required fields rejected |
| Anthropic Skills / `SKILL.md` | N/A (procedure, not a step) | no | no | optional `allowed-tools` | YAML frontmatter; `name`+`description` required | tool restriction, not model/effort |

### Per-system notes

**LangGraph (VERIFIED via docs snippets + GitHub `create_react_agent`).** Nodes are functions. Model and tools are bound in code (`model.bind_tools(tools)`). A *dynamic model* callable `(state, runtime) -> BaseChatModel` can pick a model at runtime; bound tools must be a subset of the `tools` parameter. There is no first-class typed document that says "phase P2 step 3 uses gpt-5.6-sol at high effort with {Read, Grep}". Graph topology is the schema. Source: [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [create_react_agent source](https://github.com/langchain-ai/langgraph/blob/main/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py).

**CrewAI (VERIFIED).** This is the system Amendment H most resembles. A `Task` has `agent`, `tools`, `description`, `expected_output`. An `Agent` has `role`, `goal`, `backstory`, `llm`, `tools`. New projects use JSONC (`agents/<name>.jsonc` + `crew.jsonc` tasks array); classic projects use `config/agents.yaml` + `config/tasks.yaml`. Example agent JSONC binds `"llm": "openai/gpt-4o"` and `"tools": ["SerperDevTool"]`. Task JSONC binds `"agent": "researcher"`. **`description` and `expected_output` remain authored strings.** The docs do not generate them from the rest of the config. There is no `effort` / `reasoning.effort` field; there is `reasoning: bool` and `max_iter`. Source: [CrewAI Agents](https://docs.crewai.com/en/concepts/agents), [CrewAI Tasks](https://docs.crewai.com/en/concepts/tasks).

**Mastra (VERIFIED).** `createStep` / `createWorkflow` take Zod (or any Standard JSON Schema) `inputSchema`/`outputSchema`. File-based agents put `model` in `config.ts` and the always-on prompt in sibling `instructions.md` — they *split* model config from the prompt file rather than generating the prompt from the config. `prepareStep` can swap `model` and `tools` per agentic step. Dynamic workflow JSON can declare `type: "agent", agentId, outputSchema`. Source: [Mastra agents-and-tools](https://mastra.ai/docs/workflows/agents-and-tools), [file-based agent config.ts](https://mastra.ai/reference/file-based-agents/config), [dynamic workflow definition](https://mastra.ai/reference/workflows/dynamic-workflow-definition).

**OpenAI Agents SDK (VERIFIED).** An `Agent` is configured with `name`, `instructions` (string **or** function), `model`, `tools`, `handoffs`, `outputType`. Instructions can be dynamic (`(RunContext) => string`) — that is runtime assembly, not a checked-in generated file. Handoffs are tools. Effort is not an Agent constructor field; GPT-5.6's `reasoning.effort` (`none|low|medium|high|xhigh|max`) lives on the Responses API. Source: [Agents guide](https://openai.github.io/openai-agents-js/guides/agents/), [GPT-5.6 guide](https://developers.openai.com/api/docs/guides/latest-model).

**Google ADK (VERIFIED).** Experimental Agent Config YAML validated against `AgentConfig.json`. Fields: `name`, `model`, `description`, `instruction`, `tools[]`, `sub_agents[]`. The YAML *is* a typed agent; `instruction:` is still a hand-authored string. Known limitation: only Gemini models. Source: [adk-docs agents/config.md](https://github.com/google/adk-docs/blob/main/docs/agents/config.md).

**A2A AgentCard (VERIFIED).** Proto is the normative source (`spec/a2a.proto`). A card declares identity, `supportedInterfaces`, `capabilities`, `skills[]` (id/name/description/tags/examples). It does **not** bind a model, effort, or per-step tools. Guiding principle: *opaque execution* — agents collaborate without sharing internal plans or tool implementations. Source: [A2A specification](https://a2a-protocol.org/latest/specification/).

**MCP (VERIFIED).** Tools have `name`, `description`, `inputSchema` (JSON Schema). This is capability advertisement, not "step 4 of packet X uses this tool with this model." Source: [MCP tools spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/server/tools).

**AGENTS.md (VERIFIED).** FAQ: "Are there required fields? **No.** AGENTS.md is just standard Markdown." Stewarded by the Agentic AI Foundation. Claimed use in 60k+ open-source projects. Nested files: closest file wins; user chat overrides everything. This is the industry's most-adopted *agent instruction* format, and it deliberately rejected a typed schema. Source: [https://agents.md/](https://agents.md/).

**Anthropic Skills / SKILL.md (VERIFIED).** Required frontmatter: `name`, `description`. Optional Claude Code extension: `allowed-tools` (tool allowlist while the skill is active). No model, no effort. Body is Markdown instructions, loaded on demand (progressive disclosure). Source: [Claude Code skills](https://code.claude.com/docs/en/skills), [Anthropic engineering post](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).

**Semantic Kernel (SEARCH-HIT, YAML examples fetched via search).** Declarative agent YAML: `type`, `name`, `instructions`, `model.id`, `tools[]`. Separate prompt-template YAML with `template`, `input_variables`, `execution_settings`. Decision 0070 requires the schema to allow a Semantic Kernel prompt (including Prompty) as agent instructions — i.e. the prompt stays a template, not a generated projection. Source: [SK agent templates](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-templates), [SK ADR 0070](https://github.com/microsoft/semantic-kernel/blob/main/docs/decisions/0070-declarative-agent-schema.md).

**Temporal (VERIFIED).** `ActivityOptions.setTaskQueue` routes an activity to a worker pool. Timeouts, retries, heartbeats are first-class. This is the mature form of "per-step executor binding" — and it binds *compute topology*, not an LLM. Source: [Java ActivityOptions](https://docs.temporal.io/develop/java/activities/execution), [Task Queues](https://docs.temporal.io/task-queue).

**GitHub Actions (VERIFIED).** `jobs.<id>.runs-on` selects a machine image or runner group. There is no model/effort field on a job. Analog: per-job *hardware* routing. Source: [Choosing the runner for a job](https://docs.github.com/en/actions/using-jobs/choosing-the-runner-for-a-job).

**Agent Protocol (SEARCH-HIT).** LangChain's OpenAPI: `GET /agents/{id}/schemas` returns JSON Schema for input/output/state/config. It is a *serving* contract. It does not encode a multi-step work plan with per-step model+effort. Source: [langchain-ai/agent-protocol README](https://github.com/langchain-ai/agent-protocol/blob/main/README.md).

**AutoGen (SEARCH-HIT, not independently fetched this session).** AgentChat is code-first (`AssistantAgent` + model client + tools). UNCONFIRMED whether a first-class per-step YAML plan exists in current Autogen.

**Dagster / Airflow (SEARCH-HIT).** Dagster ops take `ins`/`outs` and can bind resources; executors are typically run-level. Airflow pools/queues are worker routing. Neither binds LLM model+effort per task as a first-class field. Treat as executor-config analog only.

### What this means for Amendment H

**INFERRED.** Typing `ResponsibleAgent.kind` + allowed tools/skills + constraints + resources per step has plenty of precedent (CrewAI, ADK, Mastra, SK, OpenAI Agents). Typing `model` + `effort` *per packet step* is the unusual part:

- Effort is an API-call parameter (`reasoning.effort` on GPT-5.6; OTel even has `gen_ai.request.reasoning.level` as a *span* attribute — see §5), not a work-plan field in any surveyed framework.
- Model IDs rot on a weeks-to-months cadence. 214 packets × N steps of frozen model slugs is a deprecation farm. CrewAI's `llm: openai/gpt-4o` already demonstrates this: the docs still show gpt-4 / gpt-4o as defaults while the frontier has moved.
- NVIDIA is productizing per-step model routing as *infra* (NeMo Switchyard: "route each agent workflow step across a chosen model pool") rather than as a field on a project-plan document. **VERIFIED X:** [NVIDIA, 2026-08-20](https://x.com/nvidia/status/2090548358868070801) (331 likes, 93k views).

Nobody generates the task-description / instructions / GOAL equivalent from the typed fields. CrewAI, ADK, Mastra, SK, and the Agents SDK all keep the prompt as authored text *next to* the typed binding.

---

## 2. Generated prompts vs hand-authored prompts — the actual evidence

**The category error (INFERRED, load-bearing).** "DSPy compiled prompts beat hand-tuned prompts" is real, on some tasks, with a labeled metric. Amendment H is **not DSPy**. H is template substitution: fill a four-part skeleton from YAML. The literature that appears to support H is about a different operation.

| Operation | What it needs | What it produces | Matches H? |
|---|---|---|---|
| DSPy compile | program + trainset + metric + optimizer (MIPRO/GEPA/BootstrapFewShot) | few-shot demos + instruction text *selected by eval score* | **no** |
| OpenAPI / codegen render | schema + templates | files humans used to write | analog of H |
| CrewAI YAML | agent/task fields | runtime agent objects; descriptions stay authored | analog of typing, **not** of rendering |
| H's proposed `LauncherRender` | `PacketWorkPlan` fields | `GOAL.md` under a four-part contract, char-budget checked | template fill |

If the team does not have a labeled eval set per packet and a compile step that searches prompt space, citing DSPy as precedent for rendering `GOAL.md` is a sleight of hand.

### What the success literature actually measured

**DSPy paper (VERIFIED via arXiv HTML).** Khattab et al., *DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines*, [arXiv:2310.03714](https://arxiv.org/html/2310.03714). Compiler inputs: program, a few training inputs with optional labels, a validation metric. Headline: compiled programs beat standard few-shot and, on some tasks, expert-created demonstrations (GPT-3.5 "up to 5–46%", llama2-13b "16–40%"). This is metric-driven search over demonstrations, not rendering a launcher from a work-plan schema.

**Battle & Gollapudi 2024 (VERIFIED).** *The Unreasonable Effectiveness of Eccentric Automatic Prompts*, [arXiv:2402.10949](https://arxiv.org/html/2402.10949). 60 hand-written "positive thinking" system-message combinations × 3 models × GSM8K subsets. Quote: *"the only real trend may be no trend. What's best for any given model, dataset, and prompting strategy is likely to be specific to the particular combination at hand."* Automatic optimization beat the best hand prompts; the winning Llama2-70B prompt was a Star Trek riff ("Command, we need you to plot a course through this turbulence…"). IEEE Spectrum popularized this as "prompt engineering is dead" ([2024-03-06](https://spectrum.ieee.org/prompt-engineering-is-dead), VERIFIED). Battle's prescription is: *build a scoring metric, then search*. H has no scoring metric.

**O'Reilly / Drew Breunig, "The Problem Is Prompt Debt" (VERIFIED, 2026-07-30).** [oreilly.com/radar/the-problem-is-prompt-debt](https://www.oreilly.com/radar/the-problem-is-prompt-debt/). Natural-language system prompts accumulate repeated ALL-CAPS rules, lock you to one model, and become unreviewable. Prescription: specify behavior with **measurements**, then let DSPy/GEPA search. Coding-agent system prompts (Claude Code, Fable) are cited as *examples of prompt debt*, not as things to auto-render from a plan schema. One-off tasks: "hand-tuning is often optimal." A `GOAL.md` is a one-off (per packet) coding-agent launch, closer to Breunig's exception than his production-inference case.

### Failure accounts and reverts (the prize)

1. **Extracting a compiled prompt kills the gain (SEARCH-HIT; GitHub HTML blocked this session).** [stanfordnlp/dspy#8042](https://github.com/stanfordnlp/dspy/issues/8042) (opened 2025-04-02, labeled `bug`). Reporter: MIPROv2 raised exact-match 0.190 → 0.238 *inside DSPy*. Dumping the optimized instruction + examples into Markdown and calling the model without DSPy: non-optimized 47%, optimized+examples 28.5%, `inspect_history()` system prompt 5%. The compiler's win was not portable as a rendered string. **This is the single most important failure for H:** even when generation works, *projecting the generated prompt into a standalone markdown launcher can destroy the performance the generation was for.*

2. **Metric mismatch / live-traffic drop (SEARCH-HIT).** FutureAGI, *Evaluating DSPy Pipelines in 2026* ([futureagi.com](https://futureagi.com/blog/evaluating-dspy-pipelines-2026/)): "The metric DSPy optimizes against is rarely the metric your product needs"; "MIPRO overfit the compile metric. Hold-out scores high; live-traffic scores low." Anti-pattern: "Shipping the first compile." H would ship a render with no metric at all.

3. **Compiled prompts are model-specific and must be recompiled (SEARCH-HIT).** EngineersOfAI / DSPy docs and the Overture Maps / Simon Willison writeup: optimized prompts differ by model; a hand-tuned prompt "will [not] naturally translate." If H bakes model+effort into 214 packets *and* generates GOAL.md from them, every model swap is a fleet rewrite. The DSPy answer to that is recompile-against-eval, which H does not have.

4. **A careful hand-written prompt is a closer call (VERIFIED X).** [@MLflow, 2026-08-24](https://x.com/MLflow/status/2091873660843762078): MIPROv2 beat DSPy's own zero-shot; "A careful hand-written prompt is a closer call. And what actually improved was hedging less often, not reading abstracts better." 14 likes, 1.1k views — small, but it is a practitioner eval result, not a vendor blog.

5. **Practitioners revert from DSPy (VERIFIED X).** [@kellogh (Tim Kellogg), 2025-04-02](https://x.com/kellogh/status/1907367324102865088): *"i’ve stopped using DSPy. i do fine with an LLM reverse interview to write the prompt, and by not using it i can use a different framework instead."* 2 likes — dismissive and low-engagement, included because it is a named revert.

6. **Core prompts stay handwritten even in multi-agent farms (VERIFIED X).** [@eDezhic, 2026-08-21](https://x.com/eDezhic/status/2090928253997654378): "Their tasks are written by higher-level agents, but their **core prompts are handwritten**. Well, to be fair initial drafts of their prompts were generated, but rewritten significantly after that."

7. **OpenAI 2026: leaner system prompts beat scaffolding (VERIFIED).** GPT-5.6 prompting guide: *"In a sample of internal coding-agent eval runs, configurations with leaner system prompts improved evaluation scores by roughly 10–15% while reducing total tokens by 41–66% and cost by 33–67%."* Method: start from a working prompt, **remove** one group of instructions/examples/tools at a time, rerun evals; state each instruction once; expose only relevant tools. Source: [Using GPT-5.6 — Favor leaner prompts](https://developers.openai.com/api/docs/guides/latest-model). **INFERRED implication for H:** a four-part render that concatenates instruction + context + input-data + output-indicator from a rich `PacketWorkPlan` is the opposite of this guidance. The character budget (`targetChars`/`maxChars`) exists because compression *is* the authoring work. Generating then truncating to 4k chars is how you get a worse prompt than a human who chose what to omit.

8. **BAML vs DSPy (SEARCH-HIT).** Practitioner comparison (Prashanth Rao, 2025-08-25, [X](https://x.com/tech_optimist/status/1959790612162515096)): BAML keeps the prompt *written inside the function*; DSPy hides it behind a signature. Teams that want to *see and edit* the prompt pick BAML. That is a vote against "the prompt is a read-only projection."

**UNCONFIRMED (looked for, did not find):** a published post-mortem of a team that generated coding-agent *launcher* prompts from structured plan YAML, measured a drop, and reverted to hand-authored launchers. The closest evidence is #8042 (compiled prompt extracted to Markdown) plus CrewAI's refusal to generate `description` from the rest of the task. Absence of a GOAL.md-shaped revert is not evidence that rendering works; it is evidence that few teams have tried this exact move.

### What would have to be true for H's render bet to inherit DSPy's results

- A per-packet (or per-phase) labeled eval set.
- A metric the compiler can afford to run thousands of times.
- Recompilation when the model changes.
- The rendered `GOAL.md` would have to be *consumed by the same runtime that was optimized*, not pasted into Codex/Claude/Grok as a one-shot user prompt.

None of those are in Amendment H. H has a four-part template and a char-budget check.

---

## 3. The escape-hatch pattern

When a generator takes over an artifact humans used to write, the hatch that survives is almost never "edit the output." The survivors annotate the **source** or **exclude files**. The rotters dump config into the repo ("eject") or leave `// DO NOT EDIT` without CI.

| Pattern | Example | Survives? | Why |
|---|---|---|---|
| Ignore / skip files | OpenAPI Generator `.openapi-generator-ignore` (gitignore syntax, including negation) | **yes** | Humans keep ownership of named files; generator never touches them. [VERIFIED](https://openapi-generator.tech/docs/faq-extending) |
| Annotate the source schema | OpenAPI `x-*` vendor extensions; protobuf custom options (`extend google.protobuf.FieldOptions`) | **yes** | Extra behavior lives on the input, regenerated cleanly. [VERIFIED protobuf custom options](https://protobuf.dev/programming-guides/editions/) |
| Own the templates | OpenAPI `-t` custom mustache; Mastra/SK prompt templates as *source* | **yes, if you own them** | Upstream template changes become your merge. Works for a small template set. |
| Handwritten overlay next to generated | GraphQL Code Generator mappers; Prisma `$extends`; Terraform modules wrapping generated providers | **yes** | Generated stays generated; humans write only the overlay. |
| Generator-to-generator insertion points | protobuf `@@protoc_insertion_point(NAME)` — *plugins* insert into *other plugins'* output | **not a human hatch** | Designed for composable generators, not for people pasting into generated files. [VERIFIED](https://github.com/protocolbuffers/protobuf/blob/main/src/google/protobuf/compiler/plugin.proto) |
| Protected regions / BEGIN-END custom code | Older Swagger/codegen, Visual Studio T4 | **rots** | Regions become the real source of truth; generator is a nuisance; merges conflict forever. |
| Eject | Create React App `npm run eject` — official docs: "one-way operation"; dumps ~2k lines of webpack/babel | **rots, then dies** | You now maintain a fork of the generator. CRA deprecated 2025-02-14. [VERIFIED](https://react.dev/blog/2025/02/14/sunsetting-create-react-app), [CRA site](https://create-react-app.dev/) |
| `// DO NOT EDIT` without CI | ubiquitous | **rots** | People edit anyway. Only works if doctor/CI fails the build on drift. |
| Generated docs with authored islands | this exploration's own BRIEF rabbit hole: "Generated surfaces must not swallow authored Trail/open-question prose" | **yes, by forbidding wholesale generation of the authored surface** | Local precedent. |

**OpenAPI Generator ignore (VERIFIED).** "OpenAPI Generator has a built-in ignore file processor… The ignore file works just like .gitignore." `--skip-overwrite` is coarser; ignore is per-path. This is the hatch you want if you generate *some* packet files and keep others authored. Source: [FAQ: Extending](https://openapi-generator.tech/docs/faq-extending).

**CRA eject (VERIFIED).** React team, 2025-02-14: CRA deprecated; no active maintainers. Eject was marketed as "no lock-in" and became a maintenance trap (Theo/Twitch webpack upgrades; CRACO as a patch-on-a-patch). Analog for H: an `eject GOAL.md` button that copies the render and stops generating **is** CRA eject — 214 one-way forks of a template, no path back.

**This packet system's own law (VERIFIED local).** BRIEF.md rabbit hole: generated surfaces must not swallow authored Trail / open-question prose. Amendment H proposes to swallow the one remaining authored launcher. That is a contradiction with a ratified appetite item, not a small inconsistency.

### Which hatch would H need?

If GOAL.md becomes a projection, the hatches that have survived elsewhere, mapped onto packets:

1. **Do not generate GOAL.md.** Type the plan; keep the launcher authored. (OpenAPI-ignore the whole file.) This is option (b).
2. **Generate a *sidecar*** (`GOAL.generated.md` or a checklist block) and let GOAL.md `@`-include or ignore it. Humans keep the compression layer. Analog: generated README status blocks + authored Trail (already the team's pattern).
3. **Protected `<!-- BEGIN AUTHRED -->` region inside GOAL.md.** This is the pattern that rots. Do not.
4. **`eject` to hand-author after first render.** CRA. Do not.

**INFERRED.** There is no evidence that a four-part render with a char-budget check is a hatch. It is the generator. The hatch has to live *around* it.

---

## 4. Prompt structure contracts

**Finding:** the four-part split (instruction / context / input data / output indicator) is a 2023 pedagogical list from the DAIR.AI Prompt Engineering Guide. AgentO copied it into OWL data properties. The most comprehensive survey of prompt engineering uses a *different* taxonomy and does not evaluate four-part vs free-form. OpenAI's 2026 coding-agent guidance is "leaner, state once," not "always emit four labeled sections."

### Origin (VERIFIED)

[DAIR.AI Prompt Engineering Guide — Elements of a Prompt](https://www.promptingguide.ai/introduction/elements):

> A prompt contains any of the following elements:
> **Instruction** — a specific task or instruction you want the model to perform
> **Context** — external information or additional context that can steer the model to better responses
> **Input Data** — the input or question that we are interested to find a response for
> **Output Indicator** — the type or format of the output.
>
> You do not need all the four elements for a prompt and the format depends on the task at hand.

The page is instructional. It cites no experiment. It explicitly says you do not need all four.

### AgentO (SEARCH-HIT; ontology HTML fetch failed)

AgentO (`http://www.w3id.org/agentic-ai/onto#Prompt`) declares data properties `promptInstruction`, `promptContext`, `promptInputData`, `promptOutputIndicator` ([SEPSIS/TU Wien ontology page](https://sepses.ifs.tuwien.ac.at/onto/index-en.html) — SEARCH-HIT; live fetch of that URL failed this session). The AgentO paper (ESWC 2026, [Springer chapter](https://link.springer.com/chapter/10.1007/978-3-032-25159-6_16)) evaluates translating 66 workflows from AutoGen/CrewAI/LangGraph/Mastra into the ontology; it does **not** evaluate whether splitting a prompt into those four properties improves agent outcomes. The local mapping doc adopted the four-part split as Amendment H's render contract *because AgentO had the slots* ([`2026-08-25-agento-ontology-mapping.md`](../2026-08-25-agento-ontology-mapping.md) L63, L148). That is ontology-driven design, not prompt-eval-driven design.

### The Prompt Report uses a different anatomy (VERIFIED)

Schulhoff et al., *The Prompt Report*, [arXiv:2406.06608](https://arxiv.org/html/2406.06608) (v6, 2025-02-26). Section 1.2.1 "Components of a Prompt":

- **Directive** (instruction or question; "intent")
- **Examples** (shots)
- **Output Formatting**
- **Style Instructions**
- **Role** / persona
- **Additional Information** — *"sometimes called 'context', though we discourage the use of this term as it is overloaded"*

58 text prompting techniques, PRISMA review. No experiment of "four DAIR.AI slots vs free-form vs COSTAR vs RTF." The authors' contribution is a taxonomy, plus two case studies (MMLU; a clinical hopelessness classifier) that compare *techniques*, not slot decompositions.

### Competing folk taxonomies (SEARCH-HIT)

CO-STAR, CRAFT, RTF (Role/Task/Format), five-part Role/Context/Task/Constraints/Format, CRISPE, Agno's description/instructions/expected-output, OpenAI 2026's "goal, context, constraints, required evidence, success criteria, output format." These coexist because none has been shown to dominate. The four-part list is one slide among many.

### Empirical evaluation of structured templates vs free-form

**What exists:**

- Battle & Gollapudi (VERIFIED, §2): 60 structured system-message combinations; *no consistent winner*; sometimes empty system message won.
- Tam et al. 2024, *Let Me Speak Freely?*: structured outputs can *reduce* task performance; Prompt Report cites it and a 2024 rebuttal (Kurt) claiming the opposite. **UNCONFIRMED this session** (paper not fetched); do not rest H on either side.
- OpenAI 2026 coding-agent evals (VERIFIED, §2): *removing* structure/repetition improved scores 10–15%.
- Anthropic (SEARCH-HIT, secondary): deleting >80% of a coding-product system prompt reported no measurable loss — cited in [YouTube roundup 2026-08-19](https://www.youtube.com/watch?v=OiplQPjdA4c) pointing at Anthropic + OpenAI docs. Treat as secondary until the Anthropic post is fetched.

**What does not exist (stated plainly):** a study that assigns agents the DAIR.AI four-part template vs an equal-length free-form `GOAL.md` and measures coding-agent success, especially under a character budget. H would be adopting folklore as a render contract.

**INFERRED.** A four-part *checklist for the human author* ("did you include the output indicator?") is harmless. A four-part *mandatory render* that forces GOAL.md to emit labeled sections from YAML fields will spend the 4k-char budget on headings and duplicated manifest facts (stop conditions, SoT paths) that the agent can read from the packet anyway.

---

## 5. Provenance of agent runs

**Finding:** "which model at which effort ran which step with which tools" is an **observability** record, not a **plan** record. The open conventions already have fields for model, reasoning level, and tool definitions. They are **Development**-status, not stable, and they describe *what happened*. Putting the same facts in `PacketWorkPlan` as *what should happen* is a different type. Consuming traces does not replace a plan; modeling traces in the manifest does not replace an exporter.

### OpenTelemetry GenAI (VERIFIED)

Raw spec: [semantic-conventions-genai `docs/gen-ai/gen-ai-spans.md`](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md). **Status: Development.** Inference span attributes include:

- `gen_ai.request.model` (conditionally required)
- `gen_ai.response.model` (actual model, may differ)
- `gen_ai.request.reasoning.level` — **"The reasoning or thinking effort level requested"**; examples `low`, `medium`, `high`. Recommended when applicable.
- `gen_ai.tool.definitions` (opt-in)
- `gen_ai.operation.name` enum includes `chat`, `execute_tool`, `invoke_agent`, `invoke_workflow`, `plan`
- `gen_ai.prompt.name` / `gen_ai.prompt.version` when a named prompt template is used

The otel.io HTML pages currently 302 to a "Moved" stub; the GitHub-raw document is the fetch that counted.

**INFERRED.** Effort is already a *span* attribute in the emerging standard. That is evidence to **export** effort from the run, not to make it the source of truth in a packet manifest.

### OpenInference (SEARCH-HIT, spec fetched via search)

[Arize OpenInference semantic conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md): required `openinference.span.kind` (`LLM|AGENT|TOOL|CHAIN|…`); `llm.model_name`, `llm.request.model_name` vs `llm.response.model_name`; `tool.name`. Complementary to OTel; natively consumed by Phoenix.

### LangSmith (SEARCH-HIT)

[`ls_provider` + `ls_model_name` metadata](https://docs.langchain.com/langsmith/log-llm-trace) required for cost tracking on custom models. This is run annotation.

### Langfuse / Braintrust / W&B Weave (SEARCH-HIT, not independently fetched)

All three store traces with model, token counts, tool calls. They are products you can point an OTLP exporter at. None of them wants to be your packet manifest.

### Plan vs log (INFERRED, this is the architectural point)

| Question | Lives in | Mutability |
|---|---|---|
| Which agent *should* run P2? | plan / `PacketWorkPlan` | authored, versioned with the packet |
| Which model *did* run P2 on 2026-08-26? | trace / `PacketEvent` / OTel span | append-only |
| Which tools *may* it use? | plan (allowlist) + SKILL.md `allowed-tools` | authored |
| Which tools *did* it call? | trace `execute_tool` spans | observed |

Amendment H's motivation sentence mixes these: "which model at which effort **ran** which phase" is past tense (log), implemented as a future-tense schema (plan). The team's event chain (`ops/events/`, `PacketEventActor`) is already the place for actuals. Candidate 4's evidence receipts are the place for sealed actuals. Dumping actuals-shaped fields into the work plan will go stale the first time a session overrides the model (which the team's own routing doctrine does constantly: `claude` vs `claudex` vs `claudeg`, Sol vs Luna vs Grok per Workflow child).

**Should the team consume observability rather than model this in the manifest?** Consume for *actuals*. Do not expect LangSmith/OTel to answer "what is the intended lane for this packet next Tuesday" — that is a plan, and a fleet-level routing table is a better plan than 214 copied slugs.

OTel GenAI conventions being **Development** is a reason not to treat them as a solved drop-in, and also a reason not to invent a parallel private schema for the same facts.

---

## 6. X / Twitter sweep

All posts below were retrieved via X tools this session. Engagement numbers are as of fetch time 2026-08-26.

### Generated vs hand-written prompts

| Date | URL | Author | Engagement | Claim |
|---|---|---|---|---|
| 2026-08-24 | https://x.com/MLflow/status/2091873660843762078 | @MLflow | 14 likes, 2 RTs, 1.1k views | MIPROv2 beat zero-shot; **careful hand-written prompt is a closer call**; gain was less hedging, not better reading |
| 2026-08-21 | https://x.com/eDezhic/status/2090928253997654378 | @eDezhic | 0 likes, 6 views | Multi-agent farm: **tasks generated, core prompts handwritten** (drafts generated then rewritten) |
| 2025-04-02 | https://x.com/kellogh/status/1907367324102865088 | @kellogh | 2 likes, 339 views | **"i’ve stopped using DSPy"**; reverse-interview an LLM to write the prompt; keep framework choice free |
| 2025-10-05 | https://x.com/bibryam/status/1974819365502570531 | @bibryam | 210 likes, 21 RTs, 14.5k views | Promo for Breunig "let the model write the prompt" / DSPy — the *for* side |
| 2026-08-24 | https://x.com/ManningBooks/status/2091956430676938757 | @ManningBooks | 18 likes, 1.8k views | DSPy book promo. Not evidence. |
| 2026-07-24 | https://x.com/HamelHusain/status/2080521693156766125 | @HamelHusain | 26 likes, 4.4k views | Dismissive: "This one prompt will change your life" posts should rickroll. Sentiment: prompt-as-artifact is a grift. |
| 2026-07-02 | https://x.com/HamelHusain/status/2072814557031268541 | @HamelHusain | 140 likes, 11 RTs, 21.7k views | Joke list: prompt engineering → harness engineering → loop engineering… The dismissive take from the evals person: the prompt is not the discipline. |
| 2026-06-18 | https://x.com/damianplayer/status/1935337378480030203 | @damianplayer | **1969 likes, 772 RTs, 220k views** | Lead-magnet: "7000+ lines of PURE GOLD" leaked coding prompts. Market still sells **hand-authored** mega-prompts as the product. Opposite of "render from schema." |

### Per-step model routing

| Date | URL | Author | Engagement | Claim |
|---|---|---|---|---|
| 2026-08-20 | https://x.com/nvidia/status/2090548358868070801 | @nvidia | 331 likes, 49 RTs, 93k views | NeMo Switchyard: route **each agent workflow step** across a model pool on quality/latency/cost. Formalizes per-step routing as **infra**. |
| 2026-08-21 | https://x.com/0xJ4yD3v/status/2090928251246104639 | @0xJ4yD3v | 0 likes | Quote-tweet: "no model wins every step, so per-step routing… becomes its own infra layer, **not a prompt trick**." |
| 2026-08-24 | https://x.com/thefounderspack/status/2091919683318415688 | @thefounderspack | 0 likes, 230 views | "95% accuracy per step. Across six steps, that's roughly 75%." Pitch for deterministic code vs LLM-per-step. Dismissive of model-decides-every-step. |

### Typed agent workflow config

No high-engagement thread was found that said "we typed our agent workflow YAML and then generated the system prompt from it and it was better." The CrewAI / Mastra / ADK conversation on X is "YAML for agents and tasks is nicer than Python constructors," not "generate the prompt from the YAML."

**UNCONFIRMED:** a viral dismissive take specifically about rendering `GOAL.md`-class launchers. The dismissive mass is aimed at prompt-grimoire Twitter (Hamel) and at DSPy-as-religion (Kellogg), not at Amendment H by name.

---

## Verdict

**Recommend (b): type the work plan, keep the launcher hand-authored.**

Refine the type: bind **kind, tools/skills, constraints, resources, human approver** per step. Keep **model + effort** out of the per-packet plan unless it is an optional override of a **fleet routing table**. Do not make `GOAL.md` a read-only projection. If a generated surface is wanted, generate a sidecar checklist (paths, stop conditions, allowed tools) that GOAL.md can include — the same move already ratified for ATLAS / README status blocks vs Trail.

### Why not (a)

The hypothesis "generating the agent launcher prompt from structured plan data is better than hand-authoring it" is **not supported** by the evidence that looks like it, and is **contradicted** by the evidence that is actually on point.

1. **Category error.** DSPy/GEPA/Battle wins require a metric and a search. H is template fill. Citing compiled-prompt papers for a Mustache render is false precedent. (§2)
2. **The closest shipped analog refused the render.** CrewAI types agent+llm+tools per task and still hand-authors `description`/`expected_output`. Mastra puts `model` in `config.ts` and the prompt in `instructions.md`. ADK JSON-Schema-validates YAML and leaves `instruction:` as prose. (§1)
3. **AGENTS.md, the most-adopted agent instruction format, rejected required fields.** H would impose a stricter contract on 214 internal packets than the Agentic AI Foundation imposes on the ecosystem. (§1)
4. **Extracted generated prompts underperform.** DSPy#8042: the compile gain disappeared when the prompt was materialized as Markdown. That is H's architecture. (§2)
5. **Frontier coding-agent guidance is leaner, not more slots.** OpenAI 2026: −structure, +10–15% on coding-agent evals. A four-part dump of manifest fields fights the character budget that exists *because compression is the job*. (§2, §4)
6. **The four-part contract is DAIR.AI 2023 pedagogy, copied into AgentO OWL, never evaluated against free-form.** The Prompt Report uses different components and discourages "context" as a term. (§4)
7. **"Which model ran" is a trace.** OTel already has `gen_ai.request.model` and `gen_ai.request.reasoning.level`. Actuals belong on events/receipts. Intended lane belongs in a fleet router, not 214 copied slugs. (§5)
8. **Generating a previously-authored artifact without an ignore/overlay hatch is CRA-eject-shaped.** This exploration already forbade generated surfaces from swallowing authored Trail prose. (§3)

### Why not (c)

Not typing the work plan leaves the original bug in place: per-phase lane composition is oral tradition (`agento-ontology-mapping.md` L68–73). CrewAI, ADK, Mastra, SK, and the Agents SDK all treat "this step is this kind of agent with these tools" as config worth validating. The SkillContract kernel (#813) is local precedent for typing the *contract*, not for generating the *prompt*. A typed `WorkPlanStep` that doctor can check ("P3 claims browser-QA but `allowedTools` has no browser skill") is real leverage. That leverage does not require killing GOAL.md.

### Strongest argument against this recommendation

If GOAL.md is truly "fully determined by the others," then dual-writing it is the defect, and (b) preserves the defect. Generated ATLAS and README status blocks already trained the team to accept projections; the operator currently re-derives lane composition from session memory, which is exactly the class of fact they chose to stop storing as handwritten lifecycle labels. A render-with-ignore-file (generate GOAL.md, ignore a `<!-- authored -->` island) would satisfy both "no dual write" and "humans still compress."

**Rebuttal:** the mapping doc *asserted* full determination; C3's GOAL.md census is still in progress and is the measurement that would have to show it. Compression, emphasis, agent-kind-specific phrasing, and the char budget are degrees of freedom the YAML does not have. CrewAI's entire user base is a natural experiment in "typed plan + authored launcher," and they did not collapse the second into the first. Until a packet-level eval shows that a rendered GOAL.md launches agents at least as well as the current hand-authored ones under the same char cap, (a) is an unearned coupling.

---

## Sources log

```
2026-08-26 VERIFIED | https://www.promptingguide.ai/introduction/elements | DAIR.AI four prompt elements
2026-08-26 VERIFIED | https://docs.crewai.com/en/concepts/agents | CrewAI agent JSONC/YAML, llm+tools
2026-08-26 VERIFIED | https://docs.crewai.com/en/concepts/tasks | CrewAI task.agent, authored description/expected_output
2026-08-26 VERIFIED | https://agents.md/ | AGENTS.md: no required fields, 60k+ projects
2026-08-26 VERIFIED | https://code.claude.com/docs/en/skills | SKILL.md frontmatter, allowed-tools
2026-08-26 VERIFIED | https://openai.github.io/openai-agents-js/guides/agents | Agent model/tools/instructions
2026-08-26 VERIFIED | https://developers.openai.com/api/docs/guides/latest-model | GPT-5.6 leaner prompts 10–15%; reasoning.effort
2026-08-26 VERIFIED | https://github.com/google/adk-docs/blob/main/docs/agents/config.md | ADK YAML + AgentConfig.json
2026-08-26 VERIFIED | https://a2a-protocol.org/latest/specification/ | AgentCard, proto-normative, opaque execution
2026-08-26 VERIFIED | https://modelcontextprotocol.io/specification/2025-03-26/server/tools | MCP tool JSON Schema
2026-08-26 VERIFIED | https://arxiv.org/html/2406.06608 | The Prompt Report taxonomy
2026-08-26 VERIFIED | https://arxiv.org/html/2402.10949 | Battle & Gollapudi eccentric automatic prompts
2026-08-26 VERIFIED | https://spectrum.ieee.org/prompt-engineering-is-dead | IEEE coverage of Battle; Star Trek prompt
2026-08-26 VERIFIED | https://www.oreilly.com/radar/the-problem-is-prompt-debt/ | Breunig prompt debt; one-off hand-tune exception
2026-08-26 VERIFIED | https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md | OTel gen_ai.request.model + reasoning.level
2026-08-26 VERIFIED | https://openapi-generator.tech/docs/faq-extending | .openapi-generator-ignore
2026-08-26 VERIFIED | https://react.dev/blog/2025/02/14/sunsetting-create-react-app | CRA deprecated; eject trap
2026-08-26 VERIFIED | https://docs.temporal.io/develop/java/activities/execution | ActivityOptions.taskQueue
2026-08-26 VERIFIED | https://docs.github.com/en/actions/using-jobs/choosing-the-runner-for-a-job | runs-on = machine, not model
2026-08-26 VERIFIED | https://mastra.ai/docs/workflows/agents-and-tools | typed steps; instructions not generated
2026-08-26 VERIFIED | https://mastra.ai/reference/file-based-agents/config | model in config.ts, prompt in instructions.md
2026-08-26 SEARCH-HIT | https://arxiv.org/html/2310.03714 | DSPy paper (snippets; full HTML not fully walked)
2026-08-26 SEARCH-HIT | https://github.com/stanfordnlp/dspy/issues/8042 | extracted compiled prompt underperforms (GitHub HTML blocked)
2026-08-26 SEARCH-HIT | https://sepses.ifs.tuwien.ac.at/onto/index-en.html | AgentO Prompt four data properties (page fetch failed)
2026-08-26 SEARCH-HIT | https://futureagi.com/blog/evaluating-dspy-pipelines-2026/ | MIPRO metric mismatch
2026-08-26 SEARCH-HIT | https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md | OpenInference llm.model_name
2026-08-26 SEARCH-HIT | https://docs.langchain.com/langsmith/log-llm-trace | ls_provider / ls_model_name
2026-08-26 SEARCH-HIT | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-templates | SK YAML agents
2026-08-26 SEARCH-HIT | https://github.com/langchain-ai/agent-protocol | Agent Protocol OpenAPI
2026-08-26 X | see §6 table | practitioner sentiment
```

**Could not confirm:** full body of dspy#8042 (GitHub interstitial); AgentO HTML spec page; Tam et al. 2024 full text; whether current AutoGen has a YAML work-plan schema; Langfuse/Braintrust/Weave primary docs (product behavior inferred from ecosystem knowledge + search hits); Anthropic "deleted 80% of system prompt" primary blog (secondary YouTube citation only).
