# Agent-skill and tool-contract formalization prior art

**Date:** 2026-08-13

## Executive summary

The ecosystem frontier is strong on **structural contracts** and weak on **semantic completion**. MCP, OpenAI strict function calling, LangChain, and Effect AI can constrain or validate tool-call shapes; A2A and experimental MCP Tasks type transport lifecycles; Agent Skills and OASF type discovery metadata; Oracle Agent Spec reaches into portable agent/workflow topology and standardized execution traces. None of those, by itself, makes a skill's advertised real-world outcome unreachable without gate-specific proof. One important exception sharply narrows this packet's novelty claim: Microsoft's draft Agent Control Specification (ACS) already implements machine-validated, fail-closed policy gates whose verdicts may carry proof artefacts and whose hosts must persist audit records. That is genuine **contract = executable gate + evidence receipt** prior art, and the packet should say so loudly. Its boundary is governance: it proves or records a policy decision at an intervention point, not that a skill delivered, persisted, or semantically applied its promised result. The packet's remaining gap is therefore the Effect-native composition of skill promises, typed acceptance gates, mandatory evidence, and domain-specific completion ladders—not the invention of executable evidenced gates in the abstract.

## 1. Model Context Protocol (MCP)

### Contract scope

MCP tool definitions cover a name, prose description, JSON Schema `inputSchema`, optional JSON Schema `outputSchema`, optional behavior annotations, and optional task-execution support. Structured results live in `structuredContent`; protocol and tool-execution errors are distinct. The 2025-11-25 revision also lets a tool declare task support, while experimental Tasks add `working | input_required | completed | failed | cancelled`, polling, cancellation, retention, and deferred result retrieval ([tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [Tasks specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)).

MCP resources contract discovery/read envelopes, URIs, MIME types, content, subscriptions, and display-oriented annotations; prompts contract names, arguments, and returned message/content envelopes. Neither primitive specifies acceptance criteria for work performed by an agent ([resources specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources), [prompts specification](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts)).

Side effects are only described by optional `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`. The spec explicitly says these are untrusted hints, not faithful behavioral guarantees ([schema reference](https://modelcontextprotocol.io/specification/2025-11-25/schema)). There is no standard gate registry, evidence receipt, postcondition, compensation contract, or definition of semantic success.

### Enforcement

Servers **MUST** validate tool inputs; when an output schema is present, servers **MUST** return conforming structured results and clients **SHOULD** validate them. This is runtime JSON Schema enforcement only when implementations honor those requirements; the protocol does not execute a verifier itself ([tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)). Task state transitions are normatively constrained, but `completed` means the wrapped request completed and its result is available—it is not proof that an external effect was delivered or semantically applied ([Tasks specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)).

### License

The MCP repository is in a licensing transition: new code and specification contributions are Apache-2.0, documentation other than specifications is CC-BY-4.0, and unrelicensed older contributions remain MIT ([repository license](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/LICENSE)).

### Steal / interoperate / ignore

**Interop target:** preserve MCP JSON Schemas, error separation, `structuredContent`, and task identifiers; overlay trusted Effect gates and evidence-ladder states rather than pretending MCP annotations or `completed` prove semantic success.

## 2. Anthropic-originated Agent Skills format

### Contract scope

An Agent Skill is a directory with a required `SKILL.md`. Its frontmatter types `name` and `description`, plus optional `license`, `compatibility`, arbitrary string metadata, and experimental `allowed-tools`; the body is unrestricted Markdown, with optional scripts, references, and assets. Progressive disclosure loads name/description for discovery, the body on activation, and bundled resources on demand ([Agent Skills specification](https://agentskills.io/specification)).

This is a packaging and context-loading contract, not an execution contract. It has no typed task inputs, outputs, failure algebra, side-effect model, lifecycle, acceptance gates, evidence receipts, or normative success semantics. `allowed-tools` is a space-separated pre-approval declaration whose support varies by client; it does not prove that disallowed capabilities are technically unreachable ([Agent Skills specification](https://agentskills.io/specification)).

### Enforcement

The reference `skills-ref validate` command checks frontmatter and naming conventions. The specification explicitly leaves the Markdown body without format restrictions, so procedural claims, examples, output promises, and “must verify” instructions remain prose even when the package validates ([specification validation section](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)). Client-side activation and compliance with the body are implementation/model behavior, not spec-enforced semantics.

### License

Repository code is Apache-2.0 and documentation is CC-BY-4.0 ([repository README](https://github.com/agentskills/agentskills#license)).

### Steal / interoperate / ignore

**Interop target:** keep `SKILL.md` as the human-facing progressive-disclosure projection, but generate it from or bind it to a typed manifest; treat current validation as package lint, never as proof the skill contract is satisfied.

## 3. OpenAI function calling and Structured Outputs

### Contract scope

Function definitions contract the model-generated function name and arguments through a supported JSON Schema subset. With `strict: true`, calls reliably adhere to that schema; the application still routes and executes the function and returns a `function_call_output` whose ordinary format is application-defined, often just a string ([function-calling guide](https://developers.openai.com/api/docs/guides/function-calling)). Structured Outputs similarly constrains model response shape, with explicit refusal and incomplete-generation escape paths and only a subset of JSON Schema supported ([Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)).

The scope stops at generated syntax. It does not contract the function implementation, its side effects, authorization, idempotence, evidence, lifecycle, or truth of values inside schema-valid JSON. OpenAI explicitly notes that schema-valid output can still contain substantive mistakes ([Structured Outputs announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/)).

### Enforcement

This is the strongest generation-time shape enforcement surveyed: OpenAI describes compiling the supplied JSON Schema into a context-free grammar and masking invalid next tokens during sampling. Unsupported strict schemas are rejected, while refusals and truncation remain separately detectable cases ([Structured Outputs announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/), [function-calling strict mode](https://developers.openai.com/api/docs/guides/function-calling#strict-mode)). It is nevertheless grammar enforcement, not a semantic gate over the executed operation.

### License

No portable specification license was stated on the fetched API documentation or announcement: **UNVERIFIED**.

### Steal / interoperate / ignore

**Interop target:** compile Effect Schema projections to provider-supported strict schemas and preserve refusal/incomplete as typed alternatives; ignore any inference that schema-conformant arguments or output values constitute task success.

## 4. Google-originated Agent2Agent (A2A) protocol

### Contract scope

A2A 1.0 defines discovery via `AgentCard`, descriptive `AgentSkill` entries, messages, stateful tasks, artifacts, streaming updates, push notifications, authentication declarations, and protocol bindings. `AgentSkill` covers id, name, description, tags, examples, media input/output modes, and security requirements, but the specification itself calls skills “largely a descriptive concept” ([A2A specification](https://a2a-protocol.org/latest/specification/)).

Tasks have typed lifecycle states including submitted, working, input/auth required, completed, failed, canceled, and rejected. Artifacts have identity, content parts, optional metadata, and chunking signals. The protocol types *that* an artifact was emitted and *that* a server asserted successful completion; it does not type a per-skill artifact schema, acceptance predicate, evidence chain, or independently verified postcondition ([A2A specification](https://a2a-protocol.org/latest/specification/)).

### Enforcement

Servers **MUST** validate protocol inputs, capability use, terminal-state behavior, and required fields; Protocol Buffer field annotations are described as documentation and validation hints. Implementations can therefore enforce wire shape and lifecycle legality. They cannot derive “the email arrived,” “the record persisted,” or “the remote system applied the mutation” from `TASK_STATE_COMPLETED` without an extension or application gate ([A2A specification](https://a2a-protocol.org/latest/specification/), [normative protobuf](https://github.com/a2aproject/A2A/blob/main/specification/a2a.proto)).

Compared with the packet's evidence ladder, A2A gives a valuable transport state machine but collapses the right-hand side: `COMPLETED` is a server assertion, whereas `Accepted -> Persisted -> Delivered -> SemanticallyApplied` requires different evidence at each transition. A2A artifacts are suitable evidence carriers, but the base protocol does not require them to justify completion.

### License

The A2A repository and specification are Apache-2.0 ([repository license](https://github.com/a2aproject/A2A/blob/main/LICENSE)).

### Steal / interoperate / ignore

**Interop target:** map Agent Cards, task IDs/states, and artifacts into the contract kernel; publish evidence receipts as typed artifacts or extensions, and never equate A2A terminality with the packet's highest semantic-success rung.

## 5. AGNTCY Open Agentic Schema Framework (OASF)

### Contract scope

OASF is a versioned schema/taxonomy for agent records: identity and version, authors, descriptions, skills, domains, locators, and extensible modules. It is aimed at capability discovery and directory interoperability, including translations to/from MCP and A2A ([OASF repository](https://github.com/agntcy/oasf), [Linux Foundation project announcement](https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos)).

The current v1.0 schema is closer to this packet than a superficial survey suggests. Its Agent Skills module models a normalized `SKILL.md` manifest and a validation record containing validator identity, timestamp, status, `skill_md_valid`, optional artifact-integrity status, errors/warnings, and a report URL ([Agent Skills manifest schema](https://github.com/agntcy/oasf/blob/main/schema/objects/agentskills_manifest.json), [Agent Skills validation schema](https://github.com/agntcy/oasf/blob/main/schema/objects/agentskills_validation.json)). OASF also has evaluation data and reports with ratings, scores, and metrics ([evaluation data schema](https://github.com/agntcy/oasf/blob/main/schema/objects/evaluation_data.json), [evaluation report schema](https://github.com/agntcy/oasf/blob/main/schema/objects/evaluation_report.json)).

Those are evidence-shaped metadata, but they remain detachable records. The base agent record does not require a passing evaluation for every claimed skill, bind an evaluation metric to a skill postcondition, or prevent publication/discovery when semantic proof is absent.

### Enforcement

The OASF validation service checks records against a selected schema version and returns validity, errors, and non-blocking warnings; AGNTCY Directory rejects records with validation errors before accepting them ([validation service](https://docs.agntcy.org/oasf/validation/), [Directory validation](https://docs.agntcy.org/dir/validation/)). This enforces record conformance, taxonomy constraints, and some artifact-presence/integrity claims—not the truth of capability advertisements or evaluation results.

### License

OASF is Apache-2.0 ([repository license](https://github.com/agntcy/oasf/blob/main/LICENSE.md)).

### Steal / interoperate / ignore

**Interop target:** export contract discovery metadata to OASF and reuse its validator/timestamp/report vocabulary; strengthen its optional validation/evaluation records into gate-bound receipts whose subject, inputs, criterion, and evidence identity are mandatory.

## 6. Oracle Open Agent Specification (Agent Spec)

### Contract scope

Agent Spec is a portable JSON/YAML intermediate representation for standalone agents, structured flows, tools, LLM configuration, and multi-agent composition. Tools and flows expose typed properties for inputs and outputs; flows model nodes plus control/data edges, while runtime adapters translate the representation into WayFlow, LangGraph, and other frameworks ([project documentation](https://oracle.github.io/agent-spec/), [technical report](https://oracle.github.io/agent-spec/development/_downloads/9bed8c437b5139f7c816476b7e2c20f1/agentspec_technical_report.pdf)).

Agent Spec Tracing adds standardized spans/events for agent, model, and tool executions, including correlated tool request ids, inputs, final outputs, errors, and streaming chunks. This is real runtime receipt infrastructure, not merely prose ([tracing specification](https://oracle.github.io/agent-spec/development/agentspec/tracing.html)). What it does not add is a declarative acceptance gate whose evidence must pass before a workflow or skill may claim domain completion.

### Enforcement

PyAgentSpec constructs conformant models and serializes/deserializes configurations; actual execution requires a runtime adapter. Configuration shape and component topology are enforceable, while fidelity of runtime behavior and validation of promised outcomes remain adapter/application concerns ([project repository](https://github.com/oracle/agent-spec)). Tracing specifies what conforming producers emit, but a trace saying a tool returned an output is not proof that the output satisfied an external postcondition.

### License

The project is dual-licensed at the user's option under Apache-2.0 or UPL-1.0 ([project repository license statement](https://github.com/oracle/agent-spec#license)).

### Steal / interoperate / ignore

**Interop target:** reuse its component I/O and trace correlation concepts; make a gate consume selected trace events plus authoritative re-extraction evidence instead of treating trace completion as acceptance.

## 7. LangChain and LangGraph tool contracts

### Contract scope

LangChain tools combine a name/description with an inferred or explicit argument schema. Python type hints, Pydantic models, or raw JSON Schema can define inputs; tools may return strings, objects, multimodal content, `Command` state updates, or content-plus-artifact tuples. LangGraph executes these through `ToolNode`, with state/context injection and middleware-based error handling ([LangChain tools documentation](https://docs.langchain.com/oss/python/langchain/tools)).

The contract is intentionally flexible on outputs and side effects. A function return annotation is not a domain acceptance contract, `Command` describes state mutation rather than its postcondition, and there is no common lifecycle/evidence algebra across tools.

### Enforcement

For a Pydantic `args_schema`, `BaseTool._parse_input` calls `model_validate`/`parse_obj`, so bad model-generated arguments fail at runtime. A notable gap: when `args_schema` is a raw JSON Schema dictionary, the same implementation returns the input dictionary without running JSON Schema validation; that schema is principally a model/provider-facing description unless another layer validates it ([BaseTool source](https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/tools/base.py)). Output handling checks coarse carrier conventions such as content versus content-and-artifact, but the standard tool abstraction does not decode the returned value against a declared semantic output schema ([BaseTool reference](https://reference.langchain.com/python/langchain-core/tools/base/BaseTool)).

### License

LangChain is MIT ([repository license](https://github.com/langchain-ai/langchain/blob/master/LICENSE)).

### Steal / interoperate / ignore

**Reference only:** support adapters for Pydantic/JSON Schema input declarations and LangGraph trace/state carriers, but do not inherit the asymmetric “validated input, flexible output” boundary.

## 8. Effect AI Toolkit (`effect/unstable/ai`)

### Contract scope

Effect v4's `Tool` already provides most of the typed invocation substrate this packet needs: name/description, Effect Schema parameters, success schema, failure schema, failure mode, typed handler requirements, annotations, and static or parameter-sensitive approval. `Toolkit` groups tools and derives handlers whose parameter, success, failure, and service types follow from those schemas. *Validated 2026-08-13 against the repository's checked-in pinned source — `.repos/effect` @ effect `4.0.0-rc.108`: `.repos/effect/packages/effect/src/unstable/ai/Tool.ts` (success/failure `Schema.Constraint`s, `failureMode`, static boolean or `NeedsApprovalFunction` approval) and `.repos/effect/packages/effect/src/unstable/ai/Toolkit.ts` (parameter decode, result encode, `AiError` wrapping); that pinned tree is authoritative for `@beep/skill-contract` integration.* (Upstream fetched copies: [Tool source](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Tool.ts), [Toolkit source](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Toolkit.ts).)

It does not natively model a gate registry, severity/applicability, evidence receipts, authoritative-artifact re-extraction, retry budgets, compensations, or an evidence ladder. `success` means the handler returned a value matching the success schema; it does not mean an external effect reached a domain-specific semantic state.

### Enforcement

`Toolkit` runtime-decodes unknown parameters before handler invocation, executes the typed handler, and encodes results against the success schema—or the success/failure/AiError union when failure mode is `return`. Invalid parameters and invalid/unencodable handler results become typed `AiError` reasons. This is materially stronger and more symmetric than common function-tool wrappers ([Toolkit source](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Toolkit.ts)).

### License

Effect is MIT ([repository license](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/LICENSE)).

### Steal / interoperate / ignore

**Substrate, not competitor:** extend `Tool`/`Toolkit` rather than duplicate them. The packet should add contract-level gates and proof-bearing completion types around a handler's schema-valid success value.

## 9. Microsoft Agent Control Specification (ACS) — closest evidenced-gate prior art

### Contract scope

ACS 0.3.1-beta is a draft machine-readable governance manifest plus normative runtime semantics. It defines intervention points at agent startup/shutdown, input/output, pre/post model call, and pre/post tool call; binds each point to a policy target and policy; and normalizes decisions to allow, deny, warn, escalate, or transform. The runtime is specified as deterministic and stateless, while host adapters enforce the verdict ([ACS specification](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/SPECIFICATION.md)).

This is the surveyed item that most directly invalidates any broad claim that “nobody has contract = gate with evidence receipts.” ACS verdicts may carry an evidence artefact and verification pointers; the evidence profile covers content-addressed proof artefacts, proof/attestation lookup pointers, telemetry propagation, and mandatory audit-record fields binding policy, intervention point, identities, mode, verdict, reason, dispatcher, and evidence ([AGT Evidence profile](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/agt/AGT-EVIDENCE-1.0.md)).

Its limit is equally important: evidence is optional and opaque to the runtime, and the runtime does not verify the proof artefact or pointers. More fundamentally, ACS gates whether an action is policy-acceptable at one intervention point; it does not define the skill's promised deliverable, test semantic postconditions, or advance a multi-stage operational completion ladder ([ACS specification](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/SPECIFICATION.md), [AGT Evidence profile](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/agt/AGT-EVIDENCE-1.0.md)).

### Enforcement

The manifest has a JSON Schema and unknown/invalid members fail validation. Runtime errors, missing paths, unknown tools, malformed policy output, unsafe remote references, invalid transforms, and dispatcher failures normatively fail closed to denial; SDK host adapters enforce allow/deny/transform/escalate behavior. Evidence has a bounded shape and audit persistence requirements, although cryptographic or formal verification is delegated to auditors/dispatchers ([ACS specification](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/SPECIFICATION.md), [AGT Evidence profile](https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/agt/AGT-EVIDENCE-1.0.md)).

### License

Microsoft Agent Governance Toolkit is MIT ([repository license](https://github.com/microsoft/agent-governance-toolkit/blob/main/LICENSE)).

### Steal / interoperate / ignore

**Port with attribution:** adopt its fail-closed evaluation discipline, pre/post intervention vocabulary, evidence size bounds, input-versus-enforced identity binding, and audit separation. The packet must distinguish its novelty as *skill outcome and evidence-ladder gating* and should consider an ACS adapter so governance verdicts can become prerequisite evidence, not reinvent ACS policy evaluation.

## SOURCES ledger rows

- https://modelcontextprotocol.io/specification/2025-11-25/server/tools — license: Apache-2.0 for new specification contributions; legacy portions may remain MIT — disposition: interop-target
- https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks — license: Apache-2.0 for new specification contributions; legacy portions may remain MIT — disposition: interop-target
- https://modelcontextprotocol.io/specification/2025-11-25/server/resources — license: Apache-2.0 for new specification contributions; legacy portions may remain MIT — disposition: interop-target
- https://modelcontextprotocol.io/specification/2025-11-25/server/prompts — license: Apache-2.0 for new specification contributions; legacy portions may remain MIT — disposition: interop-target
- https://modelcontextprotocol.io/specification/2025-11-25/schema — license: Apache-2.0 for new specification contributions; legacy portions may remain MIT — disposition: interop-target
- https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/LICENSE — license: Apache-2.0/MIT transition; non-spec documentation CC-BY-4.0 — disposition: reference-only
- https://agentskills.io/specification — license: CC-BY-4.0 documentation — disposition: interop-target
- https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx — license: CC-BY-4.0 — disposition: interop-target
- https://github.com/agentskills/agentskills#license — license: Apache-2.0 code; CC-BY-4.0 documentation — disposition: reference-only
- https://developers.openai.com/api/docs/guides/function-calling — license: UNVERIFIED — disposition: interop-target
- https://developers.openai.com/api/docs/guides/structured-outputs — license: UNVERIFIED — disposition: interop-target
- https://openai.com/index/introducing-structured-outputs-in-the-api/ — license: UNVERIFIED — disposition: reference-only
- https://a2a-protocol.org/latest/specification/ — license: Apache-2.0 — disposition: interop-target
- https://github.com/a2aproject/A2A/blob/main/specification/a2a.proto — license: Apache-2.0 — disposition: interop-target
- https://github.com/a2aproject/A2A/blob/main/LICENSE — license: Apache-2.0 — disposition: reference-only
- https://github.com/agntcy/oasf — license: Apache-2.0 — disposition: interop-target
- https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos — license: UNVERIFIED — disposition: reference-only
- https://github.com/agntcy/oasf/blob/main/schema/objects/agentskills_manifest.json — license: Apache-2.0 — disposition: interop-target
- https://github.com/agntcy/oasf/blob/main/schema/objects/agentskills_validation.json — license: Apache-2.0 — disposition: interop-target
- https://github.com/agntcy/oasf/blob/main/schema/objects/evaluation_data.json — license: Apache-2.0 — disposition: interop-target
- https://github.com/agntcy/oasf/blob/main/schema/objects/evaluation_report.json — license: Apache-2.0 — disposition: interop-target
- https://docs.agntcy.org/oasf/validation/ — license: UNVERIFIED — disposition: reference-only
- https://docs.agntcy.org/dir/validation/ — license: UNVERIFIED — disposition: reference-only
- https://github.com/agntcy/oasf/blob/main/LICENSE.md — license: Apache-2.0 — disposition: reference-only
- https://oracle.github.io/agent-spec/ — license: Apache-2.0 or UPL-1.0 — disposition: interop-target
- https://oracle.github.io/agent-spec/development/_downloads/9bed8c437b5139f7c816476b7e2c20f1/agentspec_technical_report.pdf — license: UNVERIFIED — disposition: reference-only
- https://oracle.github.io/agent-spec/development/agentspec/tracing.html — license: Apache-2.0 or UPL-1.0 — disposition: interop-target
- https://github.com/oracle/agent-spec — license: Apache-2.0 or UPL-1.0 — disposition: interop-target
- https://docs.langchain.com/oss/python/langchain/tools — license: UNVERIFIED documentation; repository code MIT — disposition: reference-only
- https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/tools/base.py — license: MIT — disposition: reference-only
- https://reference.langchain.com/python/langchain-core/tools/base/BaseTool — license: UNVERIFIED documentation; repository code MIT — disposition: reference-only
- https://github.com/langchain-ai/langchain/blob/master/LICENSE — license: MIT — disposition: reference-only
- https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Tool.ts — license: MIT — disposition: interop-target
- https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Toolkit.ts — license: MIT — disposition: interop-target
- https://raw.githubusercontent.com/Effect-TS/effect-smol/main/LICENSE — license: MIT — disposition: reference-only
- https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/SPECIFICATION.md — license: MIT — disposition: port-with-attribution
- https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/agt/AGT-EVIDENCE-1.0.md — license: MIT — disposition: port-with-attribution
- https://github.com/microsoft/agent-governance-toolkit/blob/main/LICENSE — license: MIT — disposition: reference-only
