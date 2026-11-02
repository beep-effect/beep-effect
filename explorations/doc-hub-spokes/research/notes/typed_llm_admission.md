# Typed admission of LLM output with repair: prior art

Provenance note: items marked [web] were confirmed by search or fetch in this session (2026-10-28). Items marked [prior] are cited from the researcher's training knowledge (cutoff mid-2026) with canonical URLs that were not re-fetched here. The report writer should treat [prior] numbers as needing a check before quoting exact figures.

## System matrix: admission, repair, streaming, context cost, location of findings

### Takeaway
Almost every production system admits output through a schema (JSON Schema, Zod, Pydantic, TS types) or a grammar, and repairs by regenerating the whole object with the error text attached. The located-findings pattern exists only in coding agents (compiler, linter, tests) and a few small blog-level Markdown validators. No product or paper found ships the full brief: free-form document notation, then positioned typed findings, then span repair, as a general admission layer for non-code documents.

### Cited Findings

**A. Constrained generation at the API (admission by construction, no repair needed for shape)**
- OpenAI Structured Outputs (Aug 2024): `strict: true` JSON Schema on `response_format` or function tools, enforced by constrained decoding (CFG compiled from the schema). Schema subset only (all fields required, `additionalProperties: false`, limited keywords). First request with a new schema pays a compile latency; schema is cached afterwards. Streams partial JSON. Findings: none, shape cannot be violated, but semantics (values) are unchecked. — [OpenAI, Introducing Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) [prior]
- Anthropic tool use: tool `input_schema` JSON Schema; the strict/structured-outputs mode (2025) constrains decoding to the schema. Without strict mode, the schema is guidance and the client must validate. Tool definitions are injected into the system prompt and count as input tokens. — [Anthropic tool use docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) [prior]
- Thesys C1: an OpenAI-compatible endpoint whose model returns a proprietary declarative UI DSL ("similar to JSX or JSON but optimized for AI-to-UI translation"); a React SDK renders it and supports partial rendering while streaming. No published repair mechanism or wire spec found. — [Thesys docs](https://docs.thesys.dev/guides/what-is-thesys-c1); [Thesys concepts](https://docs.thesys.dev/guides/concepts.md) [web]

**B. Grammar-constrained decoding libraries (admission by construction at the token level)**
- Outlines (dottxt): regex/JSON Schema/CFG compiled to an FSM over the vocabulary; masks logits each step. Streams. Zero repair; findings never exist. Context cost: none in the prompt (the grammar is not shown to the model), but the model is not told the schema unless you also put it in the prompt. — [Outlines GitHub](https://github.com/dottxt-ai/outlines); Willard & Louf, "Efficient Guided Generation for LLMs", [arXiv 2307.09702](https://arxiv.org/abs/2307.09702) [prior]
- XGrammar (MLC/CMU): pushdown-automaton CFG engine with context-independent token precomputation; claims near-zero overhead; default structured-output backend in vLLM/SGLang/TensorRT-LLM. — [arXiv 2411.15100](https://arxiv.org/abs/2411.15100) [prior]
- llguidance (Microsoft, Rust): Earley-based lazy lexer/parser for CFGs; backs Guidance and is used in OpenAI's structured outputs per Microsoft statements (unsure about current status). — [llguidance GitHub](https://github.com/guidance-ai/llguidance) [prior]
- Guidance (Microsoft): interleaved template + constrained generation program; can "fast-forward" forced tokens. — [Guidance GitHub](https://github.com/guidance-ai/guidance) [prior]
- LMQL (ETH): query language with `where` constraints compiled to token masks (eager, partial evaluation). — Beurer-Kellner et al., "Prompting Is Programming", [arXiv 2212.06094](https://arxiv.org/abs/2212.06094) [prior]
- SGLang: frontend DSL plus runtime with compressed-FSM jump-forward decoding for regex/JSON. — Zheng et al., [arXiv 2312.07104](https://arxiv.org/abs/2312.07104) [prior]
- JSONSchemaBench (Geng et al., ICML 2025): ~10K real-world schemas; compares Guidance, Outlines, llama.cpp, XGrammar, OpenAI, Gemini on efficiency, coverage, quality; reports constrained decoding can speed generation ~50% vs unconstrained; large differences in schema-feature coverage across engines. — [arXiv 2501.10868](https://arxiv.org/abs/2501.10868) [web]; secondary numbers (Guidance 41%, XGrammar 28%, Outlines 3% on hardest GitHub schemas; XGrammar 38 under-constrained failures) only from [a secondary blog](https://beancount.io/bean-labs/research-logs/2026/07/08/jsonschemabench-structured-outputs-language-models), unverified [web]
- Distortion: token masking changes the sampled distribution away from the model's conditional distribution ("grammar-aligned decoding" addresses this). — Park et al., "Grammar-Aligned Decoding", [arXiv 2405.21047](https://arxiv.org/abs/2405.21047) [prior]
- Monitor-guided decoding: static analysis (a language server) consulted during decoding to mask tokens that would introduce unresolved identifiers. This is the closest decoding-time analogue to "tier 1 name resolution as admission". — Agrawal et al., [arXiv 2306.10763](https://arxiv.org/abs/2306.10763) [prior]

**C. Validate-and-repair loops (admission by validator after generation)**
- Instructor (Jason Liu): Pydantic model as response type; on `ValidationError`, re-asks with the error messages appended (`max_retries`). Repair = full regeneration of the object. Findings are Pydantic error paths (`loc` tuples, a JSON pointer analogue), not spans in text. Streams partial objects (`Partial[T]`, `Iterable[T]`). Context cost: JSON Schema of the model in the tool definition plus the failed output and errors on retry. — [Instructor docs, retrying](https://python.useinstructor.com/concepts/retrying/) [prior]
- Pydantic AI: `output_type` validated; output validators can raise `ModelRetry`, which sends the message back and the model regenerates. Same shape: path-located, full regeneration. — [Pydantic AI output docs](https://ai.pydantic.dev/output/) [prior]
- BAML (BoundaryML): schema-as-types DSL rendered into the prompt in a compact TS-like notation (claimed fewer tokens than JSON Schema), output parsed with "Schema-Aligned Parsing" (lenient parser that tolerates Markdown fences, trailing commas, unquoted keys, prose around JSON, then coerces to the type). Repair = deterministic coercion first, retry policies second. Streams typed partials. BoundaryML blogs claim SAP plus no function-calling matches or beats native function calling on BFCL; vendor claim, not independently verified. — [BAML docs](https://docs.boundaryml.com/); [BoundaryML SAP blog](https://www.boundaryml.com/blog/schema-aligned-parsing) [prior]
- Guardrails AI: RAIL/Pydantic specs plus a validator hub; per-validator `on_fail` actions: `reask`, `fix` (deterministic programmatic fix), `filter`, `refrain`, `exception`, `noop`. Reask sends only failing fields back (a partial re-generation, closer to patch than most). Findings are field-located. — [Guardrails docs, on-fail actions](https://www.guardrailsai.com/docs/concepts/validator_on_fail_actions) [prior]
- TypeChat (Microsoft, 2023): TypeScript type declarations as the schema in the prompt; the LLM output JSON is validated by the actual TypeScript compiler; on failure, a repair prompt containing the compiler diagnostics is sent and the model regenerates the whole JSON ("The JSON object is invalid for the following reason: ... The following is a revised JSON object:"). Semantic validation is user-supplied (e.g., program validation for its JSON "program" mode). Findings are TS diagnostics, which are positional in the JSON text but the repair is full regeneration. Context cost: the TS type source is usually much smaller than equivalent JSON Schema. This is the nearest established ancestor of the brief's "compiler for agent output" idea, but it constrains output to JSON. — [TypeChat GitHub](https://github.com/microsoft/TypeChat); [TypeChat techniques docs](https://microsoft.github.io/TypeChat/docs/techniques/) [prior]
- Marvin (Prefect): typed functions/casts over Pydantic via the LLM; relies on structured outputs; no distinctive repair channel (unsure about current 3.x behaviour). — [Marvin GitHub](https://github.com/PrefectHQ/marvin) [prior]

**D. Generative UI from typed component trees**
- Vercel AI SDK generative UI: `streamUI` (RSC, now marked experimental/paused) maps tool calls to React components; the newer pattern is tool parts rendered client-side, plus `streamObject`/`useObject` with Zod for partial typed objects. Admission = Zod tool schemas; repair = `experimental_repairToolCall` hook (can re-ask the model or use a stronger model to fix a malformed tool call). Path-located Zod issues, regeneration. — [AI SDK generative UI docs](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces); [tool call repair](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) [prior]
- json-render (Vercel Labs): developer declares a catalog with `defineCatalog(schema, { components, actions })` (Zod props + descriptions); `catalog.prompt()` generates a system prompt with "component descriptions, props schemas, available actions"; flat spec `{root, elements: {id: {type, props, children}}}`; `createSpecStreamCompiler` yields `newPatches` per chunk (secondary sources describe JSON Patch RFC 6902 over JSONL); YAML wire format package exists. README states no token-size figures and describes no repair/retry for invalid output. — [json-render README](https://cdn.jsdelivr.net/gh/vercel-labs/json-render@main/README.md); [GitHub](https://github.com/vercel-labs/json-render); [InfoQ](https://infoq.com/news/2026/03/vercel-json-render) [web]
- Google A2UI: declarative JSON UI messages, not executable code; v0.8 framed as JSONL over SSE, each line a standalone message so the client builds UI incrementally; flat component adjacency list keyed by id so the LLM can emit incrementally; v0.9 draft, v1.0 candidate; transports AG-UI and A2A. Admission = client-side catalog of trusted components; no published repair loop found. — [a2ui.org spec v0.8](https://a2ui.org/specification/v0.8-a2ui/); [a2ui.org](https://a2ui.org/); [GitHub google/A2UI](https://github.com/google/A2UI) [web]
- Salesforce: I did not find a specific Salesforce generative-UI typed component tree system in this session (gap).

**E. Raw-HTML / code design agents (free-form notation, weak admission)**
- fx0 (Vercel Labs): "a lightweight design agent built with libfx. Describe a page and an agent writes it as one HTML file." Admission is coarse: one HTML file, at most 512 KB, no external assets (`lib/design-artifact.ts`), sandboxed iframe with a CSP that blocks network. Feedback is visual (`screenshot_design` tool), not located diagnostics. Draft streams via an expiring Redis channel; provisional preview strips active markup. Preview hot-updates stylesheets and inline styles on uniquely identified elements, else reloads. README does not state whether edits are string-replace or regeneration. — [GitHub vercel-labs/fx0](https://github.com/vercel-labs/fx0) [web]
- libfx: the agent core of fx, Vercel's Zig coding agent, exposed as a Node native addon and WASM. — [InfoQ on fx](https://infoq.com/news/2026/10/vercel-zig-fx-agent); [flaviocopes deep dive](https://flaviocopes.com/fx/) [web]
- v0, Lovable, bolt.new: generate code (React/TSX, HTML) as free text in files; admission = build/type-check/runtime errors in a sandbox (bolt runs WebContainers; v0 has an auto-fix model for errors); repair by targeted file edits or diffs. v0 publicly described a composite model pipeline with a "Quick Edit" path and an "AutoFix" step that streams fixes for errors (Vercel blog, 2025). Findings are compiler/runtime messages with file:line. — [Vercel, v0 composite model family](https://vercel.com/blog/v0-composite-model-family) [prior; details unverified]

**F. Free-form notation plus located diagnostics plus repair (the brief's pattern, but in code)**
- Self-Debugging (Chen et al., 2023): model explains code and uses execution/unit-test feedback to fix; gains on Spider, TransCoder, MBPP. Repair by regeneration. — [arXiv 2304.05128](https://arxiv.org/abs/2304.05128) [prior]
- Reflexion (Shinn et al., 2023): verbal self-reflection stored in episodic memory after failure signals (tests); retry full attempt. — [arXiv 2303.11366](https://arxiv.org/abs/2303.11366) [prior]
- Chain-of-Verification (Dhuliawala et al., 2023): model drafts, plans verification questions, answers them independently, revises. No external oracle, findings not located. — [arXiv 2309.11495](https://arxiv.org/abs/2309.11495) [prior]
- CRITIC (Gou et al., 2023): tool-interactive critique (search, code interpreter) then revise. — [arXiv 2305.11738](https://arxiv.org/abs/2305.11738) [prior]
- RustAssistant (Microsoft, 2023): feeds rustc errors back to the LLM; asks for changes in a line-numbered changelog format applied as patches; reported ~74% fix rate on real compile errors. This is span-located findings plus partial edit. — [arXiv 2308.05177](https://arxiv.org/abs/2308.05177) [prior; number to verify]
- SWE-agent (Yang et al., 2024): Agent-Computer Interface with a line-range `edit` command guarded by a linter that rejects syntactically invalid edits and asks again; removing the edit interface dropped SWE-bench Lite solve rate 18.0% to 10.3%; paper says linting is "beneficial for stymieing cascading errors". — [arXiv 2405.15793](https://arxiv.org/pdf/2405.15793) [web]
- Anthropic text editor tool (`str_replace_based_edit_tool`): repair by unique-string replacement, i.e. anchor-located span edits. — [Anthropic text editor tool docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool) [prior]
- Small Markdown cases: contentbit describes a constrained Markdown-like syntax with a validator reporting file:line:col and a retry loop feeding diagnostics back; a Medium post describes line-numbered input and a structured list of per-line replacements with validator error text. Blog-level, no evaluation. — [contentbit](https://contentbit.dev/blog/llm-markdown-that-cannot-break/); [Medium, targeted line edits](https://medium.com/@pYdeas/when-llms-give-almost-correct-code-fix-it-with-targeted-line-edits-instead-of-a-full-rewrite-af3329e42010) [web]
- Deterministic Markdown fixers (no model call): llm-markdown-sanitizer, markdown-mend (also strips active HTML and dangerous URLs; analogous to `SafeDocument`). — [llm-markdown-sanitizer](https://github.com/stlahxm/llm-markdown-sanitizer); [markdown-mend](https://github.com/progineousgb/markdown-mend) [web]

### Inferences
- Same vs adjacent relative to the brief:
  - Same mechanism, different domain: SWE-agent, RustAssistant, v0/bolt autofix, Claude Code / Cursor with linters. Free notation (code), deterministic located oracle (compiler/linter/tests), span edits. The brief's novelty is transplanting this to document notations with a typed semantic model and domain rules, not the loop itself.
  - Same intent, different admission channel: TypeChat (compiler diagnostics as repair prompt, but the notation is JSON and repair regenerates), Guardrails (field-level reask, partial), BAML (lenient parse of near-JSON).
  - Opposite design point: OpenAI/Anthropic strict mode, Outlines, XGrammar, llguidance, json-render, A2UI, C1. They remove the possibility of shape errors and therefore never produce findings; semantic errors pass through unflagged.
  - fx0 is the brief's "speed" baseline: raw HTML with only size/asset/CSP admission and screenshot feedback. It has no typed model and no located findings.
- No product or paper found that admits Markdown/HTML documents into a typed semantic AST with accumulated, positioned, typed findings and span repair as a general LLM output layer. The brief's combination looks unclaimed at the product level; the individual parts are all established. Confidence moderate: absence of evidence from ~15 searches, not an exhaustive survey.
- Grammar-constrained decoding cannot express tier-1 rules like antecedent basis or numeral-drawing agreement (context-sensitive, cross-reference), except via monitor-guided-decoding-style external checks. That gap is a real argument for post-hoc located validation over decoding-time constraint for documents.

### Gaps
- No published wire spec or repair mechanism for Thesys C1.
- Could not confirm v0's AutoFix internals or fx0's edit mechanism (string replace vs regenerate).
- No Salesforce generative-UI typed tree system located.
- Anthropic strict tool-use launch details (date, schema subset) were not re-verified this session.

## Which systems repair by partial edit versus full regeneration, and is there evidence on which works better?

### Takeaway
Most schema-validation libraries regenerate the whole object; coding agents and Guardrails' field reask repair partially. Direct evidence that partial edit beats regeneration is mostly from code (Aider's edit-format benchmarks, SWE-agent's edit-command ablation, RustAssistant); no controlled study for documents was found.

### Cited Findings
- Full regeneration with error text: Instructor, Pydantic AI (`ModelRetry`), TypeChat repair prompt, Vercel AI SDK tool-call repair, Reflexion, Self-Debugging. — [Instructor](https://python.useinstructor.com/concepts/retrying/); [TypeChat](https://github.com/microsoft/TypeChat); [Reflexion](https://arxiv.org/abs/2303.11366) [prior]
- Partial: Guardrails reask of failing fields only, plus deterministic `fix`; BAML deterministic coercion; RustAssistant line-numbered changelog patches; SWE-agent line-range edit with lint guard; Anthropic str_replace; the beep-effect chat surface's JSON Patch against the failing block (from the brief). — [Guardrails](https://www.guardrailsai.com/docs/concepts/validator_on_fail_actions); [RustAssistant](https://arxiv.org/abs/2308.05177) [prior]; [SWE-agent](https://arxiv.org/pdf/2405.15793) [web]
- SWE-agent: removing its edit interface (with linter guard) reduced SWE-bench Lite from 18.0% to 10.3%; this compares interface designs, not edit vs regeneration per se. — [arXiv 2405.15793](https://arxiv.org/pdf/2405.15793) [web]
- Aider edit-format work: unified-diff format reduced GPT-4 Turbo "lazy coding" (eliding code with comments) roughly 3x on its refactoring benchmark versus search/replace blocks; Aider uses whole-file format for weaker models and diff/search-replace formats for stronger models because weak models fail to produce valid diffs. Evidence that partial-edit formats are model-dependent: they cut output tokens but raise format error rates on weaker models. — [Aider, unified diffs](https://aider.chat/2023/12/21/unified-diffs.html); [Aider edit formats](https://aider.chat/docs/more/edit-formats.html) [prior]
- Olausson et al. (ICLR 2024): once repair cost is counted, self-repair gains are modest and uneven; bottleneck is feedback quality; stronger-model or human feedback substantially improves repair. Suggests that diagnostic quality, not repair mechanics, dominates. — [arXiv 2306.09896](https://arxiv.org/abs/2306.09896) [web]
- "How Many Tries Does It Take?" (2026): iterative self-repair across scales; name errors repaired ~77%, syntax ~66%, assertion ~45%, attributed to diagnostic specificity. — [arXiv 2604.10508](https://arxiv.org/html/2604.10508) [web]

### Inferences
- Partial edit pays off when (a) the artifact is long relative to the defect, (b) the model can produce valid anchors, (c) findings are located. Regeneration is simpler and robust when artifacts are short or findings are global. The brief's bet (span repair) is supported indirectly by coding-agent practice, which converged on anchor/str_replace edits, not by a head-to-head experiment.
- A practical hybrid seen in the wild: deterministic fix first (Guardrails `fix`, BAML coercion, markdown-mend), model span edit second, full regenerate as a fallback.

### Gaps
- No controlled study of span repair vs regeneration for prose/document artifacts (Markdown, HTML, legal text).
- No measurement of anchor drift (stale span) failure rates in LLM edit loops, which the brief's fingerprinted source map addresses.

## Is there published evidence on agents performing better with free-form notation plus a validator versus JSON-schema-constrained output (token cost, quality, latency)?

### Takeaway
Yes, moderate evidence that forcing content into JSON degrades quality on reasoning and code tasks, and that "generate natural, then convert" recovers it. No study directly compares "free notation + validator + repair" against "JSON-constrained" on document generation with tokens and latency measured.

### Cited Findings
- "Let Me Speak Freely?" (Tam et al., EMNLP 2024 Industry): significant decline in reasoning under format restrictions (JSON/XML/YAML instructions, JSON mode); stricter constraints degrade more; NL-then-convert largely preserves NL performance; classification tasks can benefit from strict formats. — [arXiv 2408.02442](https://arxiv.org/html/2408.02442v1) [web]. Note: dottxt published a rebuttal arguing the study's prompts/parsing were flawed and that well-designed structured generation does not hurt ([dottxt, "Say What You Mean"](https://blog.dottxt.co/say-what-you-mean.html)) [prior]; the question is contested.
- Aider (Aug 2024): models produce lower-quality code (more syntax errors) when asked to return it inside JSON vs as Markdown text, across several models on 133 Exercism problems; even strict structured outputs did not close the gap. — [Aider, code in JSON](https://aider.chat/2024/08/14/code-in-json.html); [Simon Willison summary](https://simonwillison.net/2024/Aug/16/llms-are-bad-at-returning-code-in-json) [web]
- JSONSchemaBench: constrained decoding can be ~50% faster than unconstrained (forced tokens skipped), and improves compliance, but engines differ widely in schema coverage. — [arXiv 2501.10868](https://arxiv.org/abs/2501.10868) [web]
- BAML vendor claim: prompting with a compact type notation plus lenient parsing beats native function calling at lower token cost. Vendor benchmark. — [BoundaryML SAP blog](https://www.boundaryml.com/blog/schema-aligned-parsing) [prior]
- Grammar-aligned decoding: masking distorts the distribution, which can reduce quality even when outputs are valid. — [arXiv 2405.21047](https://arxiv.org/abs/2405.21047) [prior]

### Inferences
- The evidence supports the brief's premise that natural notation is a better thinking medium for content-heavy output, with the caveat that it is contested (dottxt). JSON escaping of large text payloads (newlines, quotes) is a concrete token and error tax; Markdown/HTML avoid it.
- Token cost: constrained decoding puts zero schema tokens in the prompt if the model is not told the schema, but in practice schemas are described in the prompt too. Validator-loop designs pay instead on retries. No paper reports total-cost-to-valid-output for both designs on the same task.

### Gaps
- No head-to-head on document artifacts measuring tokens-to-admitted-output, latency, and semantic error rate.
- No evidence that agents "prefer" the validator loop in the sense of routing around it less; only coding-agent adoption as indirect evidence.

## What do the generative-UI JSON-spec systems say about streaming and schema size costs?

### Takeaway
They all design for streaming (flat id-keyed element maps, JSONL messages, JSON Patch deltas) and constrain via a component catalog, but none found publishes catalog prompt-size numbers or a repair loop. Schema size cost is an unaddressed problem in their docs.

### Cited Findings
- A2UI: flat adjacency-list components keyed by id, JSONL over SSE, each line standalone so UI renders incrementally; designed explicitly so LLMs can emit incrementally and so updates target ids. — [a2ui.org v0.8](https://a2ui.org/specification/v0.8-a2ui/); [the-decoder](https://the-decoder.com/googles-open-standard-lets-ai-agents-build-user-interfaces-on-the-fly/) [web]
- json-render: flat `elements` map with child id arrays; streaming compiler emits patches; YAML alternative wire format (suggesting JSON token overhead was a concern; the README does not say so); `catalog.prompt()` includes all component props schemas, no size guidance. — [json-render README](https://cdn.jsdelivr.net/gh/vercel-labs/json-render@main/README.md) [web]
- Thesys C1: custom DSL instead of JSON, "optimized for AI-to-UI translation", progressive partial rendering. — [Thesys docs](https://docs.thesys.dev/guides/what-is-thesys-c1) [web]
- OpenAI structured outputs: first request with a new schema incurs preprocessing latency; strict mode limits schema features. — [OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/) [prior]

### Inferences
- The convergence on flat id-keyed trees and patch streams is the UI-spec world's answer to "repair and update by locus": ids act as spans. The brief's byte-offset spans with fingerprinted staleness are a finer-grained version for free text.
- Catalog prompt cost scales linearly with components x props; C1's custom DSL and json-render's YAML option both hint that JSON is a costly carrier, matching Aider's JSON finding.

### Gaps
- No published token counts for catalog prompts (json-render, A2UI, C1).
- No published invalid-output rates or repair strategies for these systems.

## Any evaluations of "diagnostic quality" (few, ranked, actionable) and its effect on LLM repair success?

### Takeaway
Indirect evidence only: feedback quality is the bottleneck of self-repair (Olausson), more specific/localized error classes repair at higher rates, and structured, localized feedback (tests, compiler) beats vague feedback. No study found that varies diagnostic count, ranking, or wording while holding the defect fixed.

### Cited Findings
- Olausson et al.: replacing self-generated feedback with stronger-model or human feedback substantially improves repair; feedback quality limits self-repair. — [arXiv 2306.09896](https://arxiv.org/abs/2306.09896) [web]
- FeedbackEval (2025): single-iteration repair rate by feedback type: test feedback 61.0%, compiler feedback 55.8%, human feedback 50.5% (averaged across models); authors credit "clear, actionable error localization". — [arXiv 2504.06939](https://arxiv.org/html/2504.06939) [web]
- Iterative self-repair study (2026): name errors ~77%, syntax ~66%, assertion ~45% repair rates, attributed to diagnostic specificity. — [arXiv 2604.10508](https://arxiv.org/html/2604.10508) [web]
- Industrial CI compile-error repair (2025): prompt design (what diagnostic context is included) raised pass rate from 8-19% to up to 63%. — [arXiv 2510.13575](https://arxiv.org/pdf/2510.13575) [web]
- SWE-agent: guardrail that rejects an edit immediately with a lint message (located, early) prevents cascading errors. — [arXiv 2405.15793](https://arxiv.org/pdf/2405.15793) [web]
- Human-side precedent: research on enhanced compiler error messages for novice programmers (e.g., Becker et al.) and LLM-explained error messages (Leinonen et al., "Using LLMs to Enhance Programming Error Messages", SIGCSE 2023, [arXiv 2210.11630](https://arxiv.org/abs/2210.11630)) [prior].

### Inferences
- Evidence is consistent with the brief's design rule (few, located, typed, actionable findings with a mechanical fix), but the specific claims "few" and "ranked" are untested for LLMs. A two-week experiment could fill a genuine gap: hold defects fixed, vary diagnostic format (path vs span, all vs top-k, with vs without suggested fix), measure repair success and tokens.

### Gaps
- No ablation on number of diagnostics shown, ordering, or presence of a suggested fix for LLM repair.
- No evaluation of diagnostic quality for prose/document validators (legal or otherwise).
