# External landscape: typed workflows, evidence/provenance, and output verification

**Date:** 2026-08-13

## Executive summary

Four of the packet's five patterns already have mature, named prior art, but only in pieces.
Temporal and Restate provide durable, replayable execution and compensation vocabulary for bounded
recovery; statecharts provide explicit discovery-before-invocation transition topology; C2PA and
in-toto/SLSA provide cryptographically bound evidence records and policy verification; and
Guardrails, Outlines, promptfoo, and OpenAI Evals provide schema or evaluation gates. The packet
should reuse those terms and interoperate with their envelopes rather than invent another generic
"provenance" or "workflow" format. The genuinely open ground is their composition: a phase-typed
discovery API, a domain-specific evidence ladder in which operational completion cannot masquerade
as semantic success, authoritative re-extraction across heterogeneous projections, bounded failure
receipts that carry claim-level source spans, and a single Effect Schema from which both the
human contract and executable gate are derived. No surveyed framework closes that loop. Most
importantly, signed provenance proves who asserted something and which bytes it concerns; it does
not prove the assertion true.

## 1. Temporal: durable deterministic workflows and sagas

**Core contract idea.** A Temporal Workflow Definition is replayable orchestration code. Given the
same history, it must emit the same sequence of Temporal commands; non-deterministic I/O, database,
and LLM work belongs in Activities whose results enter workflow history. Temporal says a Workflow
Execution effectively executes once to completion even though its function can execute many times
during replay ([Workflow Definition](https://docs.temporal.io/workflow-definition)). The
TypeScript SDK can derive callable Activity proxies from an activity module or interface, including
argument and asynchronous-return checking
([TypeScript `proxyActivities`](https://typescript.temporal.io/api/namespaces/workflow#proxyactivities)).

**Enforcement.** The service stores event history; replay compares newly emitted commands with the
recorded sequence and raises a nondeterminism error on mismatch. Worker/process loss is recovered
by replay. Activities supply retry, timeout, and cancellation boundaries. Saga compensation is an
application pattern rather than an atomic rollback: completed steps register compensating
Activities, normally run in reverse after failure; compensations must tolerate retry and partial
effects ([Temporal saga pattern](https://go.temporal.io/platform-hub/patterns)).

**What “completed” means.** Temporal completion means the Workflow closed successfully—normally,
its workflow function returned. It does **not** independently establish that an external protocol
write was persisted, delivered, or semantically applied. Activities can return a domain proof, but
Temporal does not manufacture that proof. Therefore `Completed` is execution status, not the top of
the packet's evidence ladder. The same distinction applies to compensation: successful execution of
an undo Activity is not proof that every externally visible effect was reversed.

**License.** Temporal's TypeScript SDK is
[MIT](https://raw.githubusercontent.com/temporalio/sdk-typescript/main/LICENSE).

**Verdict — steal.** Steal deterministic-orchestrator/activity separation, durable history,
idempotent compensation, and explicit retry/timeout policy; keep `SemanticallyApplied` as a stronger
typed result that an Activity must prove, never as a synonym for Workflow completion.

## 2. Restate: typed durable handlers and journaled execution

**Core contract idea.** Restate exposes Basic Services, key-addressed Virtual Objects, and
single-run-per-ID Workflows. Each invocation is journaled, and completed actions are replayed from
their stored results after failure rather than executed again
([key concepts](https://docs.restate.dev/foundations/key-concepts)). Its TypeScript handlers and
clients are typed, and input/output runtime codecs can use any Standard Schema-compatible library;
the declared schemas are also discoverable as handler JSON Schema
([serialization](https://docs.restate.dev/develop/ts/serialization),
[handler metadata](https://docs.restate.dev/admin-api/service_handler/get-service-handler)).

**Enforcement.** Calls through `ctx`, state mutations, timers, promises, and `ctx.run` results are
written to the invocation journal. On replay the SDK substitutes recorded results and resumes at the
first incomplete action. A Workflow has one `run` handler per ID, while shared handlers may signal
or query it concurrently ([service semantics](https://docs.restate.dev/foundations/services)). The
server marks the journal complete after the handler returns successfully
([request lifecycle](https://docs.restate.dev/guides/request-lifecycle)). Standard Schema codecs
enforce boundary shape, but ordinary TypeScript annotations alone do not.

**Boundary.** Restate is unusually relevant to agent loops because it explicitly journals LLM calls,
tool execution, and routing decisions ([durable agents](https://docs.restate.dev/ai/patterns/durable-agents)).
Still, “invocation complete” only says the handler returned; a returned self-report can be wrong.
It also does not make discovery phases uncallable: that remains an application-level type design.

**License.** The Restate TypeScript SDK is
[MIT](https://raw.githubusercontent.com/restatedev/sdk-typescript/main/LICENSE).

**Verdict — interop.** Treat Restate as a plausible durable runtime for a future contract kernel and
export packet `GateEvidence`/`FailureReceipt` values through its typed codecs and journal. Do not
duplicate its execution log, and do not confuse its exactly-once-per-ID orchestration guarantee with
domain-level exactly-once effects or semantic success.

## 3. XState and statecharts: explicit transition topology, not full phase typing

**Core contract idea.** Statecharts make states, events, guarded transitions, hierarchy, parallel
regions, and final states explicit. XState evaluates only transitions enabled for the current active
state; an absent transition leaves state unchanged, while an explicit forbidden transition stops
parent-state fallback ([transitions](https://stately.ai/docs/transitions)). Its TypeScript setup can
infer a discriminated event union so `actor.send` and transition implementations are type checked
([TypeScript guide](https://dev.stately.ai/docs/typescript)).

**Enforcement.** The machine configuration and interpreter enforce the runtime graph. Final states
stop event processing and clean up invoked work, and the editor can identify unreachable states
([states and transitions](https://stately.ai/docs/editor-states-and-transitions)). The `@xstate/graph`
and `@xstate/test` packages support traversal/model-based testing
([packages](https://stately.ai/docs/packages)).

**Adversarial limit.** “Illegal transitions are unrepresentable” is too strong for stock XState.
TypeScript rejects events outside the machine's global event union, but it does not generally narrow
`actor.send` by the actor's current runtime state. An event valid somewhere in the machine can still
be sent in the wrong state and ignored or handled by an ancestor. XState gives an auditable runtime
transition relation; it does not by itself give a compile-time capability token proving discovery or
authentication occurred.

**License.** XState is
[MIT](https://raw.githubusercontent.com/statelyai/xstate/main/LICENSE).

**Verdict — steal.** Steal statechart vocabulary, explicit forbidden transitions, guards, final
states, and graph-derived test coverage. Implement `Undiscovered → Discovered → Authenticated →
Invocable` as distinct Effect/Schema values or capability-bearing APIs so invocation literally lacks
an entry point before discovery; optionally render or test that algebra as a statechart.

## 4. W3C PROV-O: interoperable provenance descriptions, not source-span proof

**Core contract idea.** PROV-O standardizes an OWL 2 vocabulary around three deliberately broad
classes: `prov:Entity` (a thing with fixed aspects), `prov:Activity` (a process over time that uses or
generates entities), and `prov:Agent` (something bearing responsibility). It relates them with
generation, use, derivation, attribution, association, delegation, plans, collections, and qualified
relations ([PROV-O](https://www.w3.org/TR/prov-o/)). This is a generic interchange model, not a fixed
document-level granularity: an application may model a whole corpus, document, claim, or span as an
Entity, but must define the domain-specific identity and anchoring details itself.

**Enforcement.** PROV-O supplies ontology terms and OWL restrictions. The separate PROV Constraints
specification can normalize a PROV instance and check temporal, uniqueness, type, and impossibility
constraints; its “validity” is closer to consistency of the represented history than proof that the
history occurred ([PROV Constraints](https://www.w3.org/TR/prov-constraints/)). Neither PROV-O nor
PROV validation cryptographically authenticates the speaker, binds an assertion to bytes, or checks
the truth of `prov:wasDerivedFrom`.

**Where span-level provenance ends.** PROV-O has no normative text-offset, quote-context, page-region,
or byte-range selector. W3C Web Annotation supplies `TextQuoteSelector`, `TextPositionSelector`,
`DataPositionSelector`, and other target selectors, including the warning that bare character
positions are brittle under document change
([Web Annotation](https://www.w3.org/TR/annotation-model/),
[selector details](https://www.w3.org/TR/selectors-states/)). Thus the corpus's document-level
`prov:wasGeneratedBy` statements are valid PROV-shaped claims but do not close “provenance claimed,
never proven.” Claim evidence needs a stable source identity/digest plus quote/position anchors and
re-extraction.

**License.** PROV-O and Web Annotation are published under the
[W3C Document License (2015)](https://www.w3.org/copyright/document-license-2015/), which permits
implementation-derived material with notice but prohibits publishing derivative technical
specifications.

**Verdict — interop.** Emit PROV-O for graph interchange, using claim/span entities and activities
linked to packet receipts, but keep the citation-span schema authoritative. Pair PROV relations with
Web Annotation selectors and content digests; never treat PROV graph consistency as evidence truth.

## 5. C2PA Content Credentials: signed claims hard-bound to asset bytes

**Core contract idea.** A C2PA Manifest is a verifiable unit containing an assertion store, a claim
that references assertions, and a claim signature. Assertions describe actions, ingredients,
metadata, identity, or content bindings; `created_assertions` are attributed to the signer, while
`gathered_assertions` are explicitly not sourced from the claim generator
([Content Credentials structure](https://spec.c2pa.org/specifications/specifications/2.4/specs/ContentCredentials.html)).
A standard manifest includes a hard-binding assertion. Hash-based hard bindings allow a validator
to check that the manifest belongs to the asset and that the covered asset bytes have not changed;
soft bindings instead support recognizing renditions or recovering detached credentials.

**Enforcement.** Validators verify the claim signature, certificate/trust conditions, hashed
references to assertions, and the hard binding. The specification defines byte-range, media-format,
collection, and structured-text binding rules and concrete failure codes. This is much stronger than
an unsigned XMP namespace tag: XMP can carry useful metadata, but C2PA guidance says external asset
metadata should be included in the hard binding when possible so its integrity is protected
([binding requirements](https://spec.c2pa.org/specifications/specifications/2.4/specs/ContentCredentials.html#_binding_to_content)).

**Boundary.** C2PA proves integrity, signer attribution, and asset association—not that a signed
assertion is factually correct or that an image demonstrates the claimed UI behavior. Trust still
depends on the signer, claim-generator security, validation status, and consumer policy. For beep QA,
the immediate gain is to retain XMP for searchable fields while adding a signed manifest whose hard
binding covers the media and, where feasible, the XMP fields and witness-log digest.

**License.** The C2PA specification is
[CC BY 4.0](https://github.com/c2pa-org/specifications/blob/main/LICENSE).

**Verdict — interop.** Do not invent a second media credential container. Define a beep QA assertion
or ingredient convention and use C2PA manifests for portable signature and byte binding; keep the
packet's semantic gate responsible for correlating frames, gestures, witness events, and expected UI
postconditions.

## 6. in-toto attestations and SLSA provenance: evidence receipts as typed data

**Core contract idea.** The in-toto Attestation Framework has four layers: a predicate with a
type-specific schema, a Statement binding that predicate type to digest-identified subjects, an
authenticated envelope, and an optional bundle
([framework specification](https://github.com/in-toto/attestation/blob/main/spec/README.md)). A DSSE
envelope signs both payload and payload type; consumers must parse and verify the signed payload
rather than trust file extensions or media types
([envelope specification](https://github.com/in-toto/attestation/blob/main/spec/v1/envelope.md)).
Classic in-toto layouts go further: authorized functionaries produce signed Link metadata for named
steps, and `in-toto-verify` checks layout signatures/expiry, functionary thresholds, commands,
material/product rules, and inspections
([in-toto verification](https://in-toto.io/docs/getting-started/)).

SLSA Build Provenance is a concrete in-toto predicate. It divides the recipe and resolved inputs
(`buildDefinition`) from the particular execution, builder, timing, and byproducts (`runDetails`),
with output artifacts identified by Statement subjects
([SLSA Build Provenance](https://slsa.dev/spec/v1.2/build-provenance)). Verification checks the
envelope signature and trusted builder identity, matches the subject digest to the artifact, and
compares `buildType`, canonical source, and external parameters to policy expectations
([SLSA artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)).

**Comparison to `FailureReceipt` and `Gate`.** This is the closest prior art and should determine the
packet vocabulary:

- `EvidenceReceipt` maps naturally to an in-toto Statement: digest-bound `subject`, stable
  `predicateType`, typed predicate, signed envelope, and optional bundle.
- `Gate` maps to an independently versioned policy/expectation evaluated by a verifier, not a boolean
  emitted by the producer. Classic in-toto inspections are especially close to authoritative
  artifact re-extraction.
- `FailureReceipt` should record attempted operations, budgets, observations, partial subjects, and
  terminal reason in a packet-specific predicate. It must not be misrepresented as SLSA Build
  Provenance when no build occurred.
- “All blocking gates passed” should be an attested verifier result referencing the exact policy and
  input-attestation digests. SLSA's Verification Summary Attestation already models verifier,
  policy, inputs, and `PASSED | FAILED`
  ([VSA](https://slsa.dev/spec/v1.1/verification_summary)).

**Boundary.** A valid signature proves attester control of a key and statement integrity. Policy
verification proves that authenticated data met configured expectations. Both still depend on the
attester, verifier, policy completeness, and capture boundary; neither makes an LLM-authored claim
true. That is why packet evidence must be re-extracted from authoritative subjects rather than merely
copied into a signed predicate.

**License.** The in-toto Attestation Framework is
[Apache-2.0](https://github.com/in-toto/attestation/blob/main/LICENSE); the SLSA specification is
[Community Specification License 1.0](https://github.com/slsa-framework/slsa/blob/main/LICENSE.md).

**Verdict — interop.** Adopt the Statement/predicate/envelope/policy split and make in-toto export a
first-class target. Design a narrow agent-work-evidence predicate instead of another envelope; use
SLSA vocabulary only where its build semantics actually apply.

## 7. W3C Verifiable Credentials: credential exchange, not the whole credential chain

**Core contract idea.** VC Data Model 2.0 defines tamper-evident credentials and presentations in an
issuer–holder–verifier ecosystem, with verification material and registries supporting authenticity,
status, and currency checks. A holder can construct a verifiable presentation from one or more
credentials for a verifier ([VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)). The
Recommendation is explicit that successful cryptographic verification does **not** imply the truth
of credential claims; relying on them requires verifier-specific business rules.

**Enforcement and chain fit.** Conforming documents have required properties and a securing
mechanism; a verifier checks conformance, proof, and status. This maps well to the packet's
`Presented` artifact and partially to `KeyMatched`, but the VC data model does not standardize the
packet's `Generated → Published → Presented → Dereferenced → KeyMatched` operational transitions.
Publication, URL/DID dereferencing, key resolution, holder binding, and authorization require chosen
protocols and verifier policy around the VC payload.

**License.** VC Data Model 2.0 uses the
[W3C Software and Document License (2023)](https://www.w3.org/copyright/software-license-2023/).

**Verdict — interop.** Use VC for portable credential/presentation payloads and proof/status
processing, but retain the packet's phase-typed chain to prove publication, live dereference, exact
key match, and subsequent authorization. A verified VC is one rung, not the terminal state.

## 8. Guardrails AI and Outlines: validated and constrained LLM output

### Guardrails AI

**Core contract idea and enforcement.** Guardrails wraps LLM input/output in a `Guard` backed by
Pydantic/JSON Schema plus composable validators. Failures can raise, filter, deterministically fix,
or trigger bounded re-asks; execution history retains iterations and validation outcomes
([Guardrails repository](https://github.com/guardrails-ai/guardrails),
[Guard API](https://guardrailsai.com/guardrails/docs/api_reference_markdown/guards)). This covers
post-generation decoding and repair and, with custom deterministic validators, can test more than
syntax.

**Validation boundary.** JSON Schema proves shape only. A custom regex, classifier, or LLM judge
proves only what that validator actually tests, with its own false-positive and false-negative
profile. Re-asking can produce another conforming claim without adding external evidence. Guardrails
is therefore a useful gate runner, not a provenance or truth system.

**License.** Guardrails is
[Apache-2.0](https://raw.githubusercontent.com/guardrails-ai/guardrails/main/LICENSE).

**Verdict — reference-only.** Steal bounded re-ask/fix/fail policy and iteration receipts, but derive
packet gates directly from Effect Schema and reserve semantic success for validators that inspect
authoritative artifacts.

### Outlines

**Core contract idea and enforcement.** Outlines turns Python types, choices, regular expressions,
context-free grammars, and JSON Schema into output constraints. For steerable models its structured
generation backend restricts token generation so output conforms to the selected language; the
documented JSON generator targets schema-valid JSON
([output types](https://dottxt-ai.github.io/outlines/1.0.0/features/core/output_types/),
[generation](https://dottxt-ai.github.io/outlines/reference/generation/generation/)).

**Validation boundary.** Constrained decoding can make malformed JSON or an out-of-enum tag
unreachable. It cannot establish that a valid citation exists, that extracted text matches a source,
or that a `passed: true` field is deserved. Those require post-generation re-extraction and domain
gates.

**License.** Outlines is
[Apache-2.0](https://raw.githubusercontent.com/dottxt-ai/outlines/main/LICENSE).

**Verdict — steal.** Use constrained decoding where available to reduce parse/repair work, while
keeping decode, evidence checks, and semantic gates mandatory. Grammar validity is the first rung,
not completion.

## 9. Eval and CI gates: promptfoo and OpenAI Evals

**Core contract idea.** Promptfoo versions prompt/provider/test matrices in configuration and applies
deterministic assertions, schema checks, similarity metrics, custom code, or model-graded rubrics
with explicit thresholds ([assertions and metrics](https://www.promptfoo.dev/docs/configuration/expected-outputs/)).
Its CI guidance turns failures into a deployment gate and retains JSON/HTML/JUnit result artifacts
([CI/CD integration](https://www.promptfoo.dev/docs/integrations/ci-cd/)). OpenAI Evals similarly
models an eval as a dataset plus an eval class, uses named split/version registry entries, supports
custom evaluation logic, and records metrics
([OpenAI Evals](https://github.com/openai/evals),
[building an eval](https://github.com/openai/evals/blob/main/docs/build-eval.md)).

**Enforcement and boundary.** These harnesses execute repeatable cases and fail a pipeline according
to configured assertions or aggregate thresholds. That makes agent behavior a versioned regression
contract, but the gate is only as sound as its dataset, oracle, rubric, sampling controls, and
threshold. Model-graded evaluators are themselves probabilistic and should not be the sole blocking
oracle for provenance or security claims. The packet should persist per-case evidence and gate
versions, not only aggregate scores.

**License.** Promptfoo is
[MIT](https://raw.githubusercontent.com/promptfoo/promptfoo/main/LICENSE); OpenAI Evals is
[MIT](https://raw.githubusercontent.com/openai/evals/main/LICENSE.md).

**Verdict — interop.** Export contract fixtures and deterministic gate results to ordinary test/CI
lanes; use promptfoo or OpenAI Evals for comparative behavioral evaluation. Keep exact artifact,
span, and protocol postcondition checks in deterministic Effect gates and record model judges as
non-authoritative evidence.

## SOURCES ledger rows

- https://docs.temporal.io/workflow-definition — license: UNVERIFIED (documentation); disposition: reference-only
- https://typescript.temporal.io/api/namespaces/workflow#proxyactivities — license: UNVERIFIED (documentation); disposition: reference-only
- https://raw.githubusercontent.com/temporalio/sdk-typescript/main/LICENSE — license: MIT; disposition: port-with-attribution
- https://docs.restate.dev/foundations/key-concepts — license: UNVERIFIED (documentation); disposition: reference-only
- https://docs.restate.dev/develop/ts/serialization — license: UNVERIFIED (documentation); disposition: reference-only
- https://docs.restate.dev/guides/request-lifecycle — license: UNVERIFIED (documentation); disposition: reference-only
- https://raw.githubusercontent.com/restatedev/sdk-typescript/main/LICENSE — license: MIT; disposition: port-with-attribution
- https://stately.ai/docs/transitions — license: UNVERIFIED (documentation); disposition: reference-only
- https://dev.stately.ai/docs/typescript — license: UNVERIFIED (documentation); disposition: reference-only
- https://raw.githubusercontent.com/statelyai/xstate/main/LICENSE — license: MIT; disposition: port-with-attribution
- https://www.w3.org/TR/prov-o/ — license: W3C Document License 2015; disposition: interop-target
- https://www.w3.org/TR/prov-constraints/ — license: W3C Document License 2015; disposition: interop-target
- https://www.w3.org/TR/annotation-model/ — license: W3C Document License 2015; disposition: interop-target
- https://spec.c2pa.org/specifications/specifications/2.4/specs/ContentCredentials.html — license: CC BY 4.0; disposition: interop-target
- https://github.com/c2pa-org/specifications/blob/main/LICENSE — license: CC BY 4.0; disposition: reference-only
- https://github.com/in-toto/attestation/blob/main/spec/README.md — license: Apache-2.0; disposition: interop-target
- https://github.com/in-toto/attestation/blob/main/spec/v1/envelope.md — license: Apache-2.0; disposition: interop-target
- https://in-toto.io/docs/getting-started/ — license: UNVERIFIED (documentation); disposition: reference-only
- https://slsa.dev/spec/v1.2/build-provenance — license: Community Specification License 1.0; disposition: interop-target
- https://slsa.dev/spec/v1.2/verifying-artifacts — license: Community Specification License 1.0; disposition: interop-target
- https://slsa.dev/spec/v1.1/verification_summary — license: Community Specification License 1.0; disposition: interop-target
- https://www.w3.org/TR/vc-data-model-2.0/ — license: W3C Software and Document License 2023; disposition: interop-target
- https://github.com/guardrails-ai/guardrails — license: Apache-2.0; disposition: reference-only
- https://guardrailsai.com/guardrails/docs/api_reference_markdown/guards — license: UNVERIFIED (documentation); disposition: reference-only
- https://dottxt-ai.github.io/outlines/1.0.0/features/core/output_types/ — license: UNVERIFIED (documentation); disposition: reference-only
- https://raw.githubusercontent.com/dottxt-ai/outlines/main/LICENSE — license: Apache-2.0; disposition: port-with-attribution
- https://www.promptfoo.dev/docs/configuration/expected-outputs/ — license: UNVERIFIED (documentation); disposition: reference-only
- https://www.promptfoo.dev/docs/integrations/ci-cd/ — license: UNVERIFIED (documentation); disposition: reference-only
- https://raw.githubusercontent.com/promptfoo/promptfoo/main/LICENSE — license: MIT; disposition: port-with-attribution
- https://github.com/openai/evals — license: MIT; disposition: reference-only
- https://raw.githubusercontent.com/openai/evals/main/LICENSE.md — license: MIT; disposition: port-with-attribution
