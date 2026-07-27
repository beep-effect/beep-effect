# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** extend `goals/agentic-professional-runtime` (high priority)
- **Source packet:** [`explorations/academia-corpus-mining`](../../../explorations/academia-corpus-mining/README.md) (align-stage dispatch)
- **Owning reports:** [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), [agent metacognition and neuro-symbolic architecture](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md), and [agent security and orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached agentic-professional-runtime

The target already owns the governed runtime loop: agents read bounded context,
produce candidate claims, tasks, and drafts, and cross a strict professional
approval boundary before consequential use. Its [SPEC](../SPEC.md) also assigns
agents, skills, commands, connectors, and provider bindings to the agent slice,
while preserving exact evidence, provenance, lifecycle history, and external
systems of record.

The corpus route adds the missing control contracts around that boundary:
typed capabilities, decision-complete approval, guarded speech acts, explicit
intervention attempts, and post-action outcome contracts. These extend the
existing candidate-write and approval model rather than introducing a new
product surface.

The reports converge on a crucial distinction: prompt admission, evidence
verification, human disposition, action authorization, execution, and release
are separate decisions. Approval is an authoritative record of a scoped human
disposition, not proof that an interpreted proposition is true. This supports
the typed-verdict correction assigned to a separate PR by align decision 2;
this additive note does not amend the current
[approval policy](../docs/approval-and-autonomy-policy.md), consistent with align
decision 8.

The metacognition evidence also supports one shared event/control protocol while
leaving deployment topology unresolved. External supervision and an integrated
scheduler should consume and emit the same contract until comparison fixtures
justify a choice, as required by align decision 6.

## Distilled requirements

1. **Capability invocations should cross a closed, typed boundary.** Each
   capability candidate should declare principal and scope, inputs, outputs,
   preconditions, effects, approval class, evidence obligation, resource and
   cost limits, and explicit failure outcomes. A language model may propose a
   decoded invocation; deterministic services retain execution ownership.
   A conformance test should reject unresolved entities, invalid spans, excess
   authority, or unsupported inputs before any side effect. Evidence:
   [metacognition report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns),
   1a3665b7d2ae — *A modular, neuro-symbolic architecture that combines large language models*;
   9e55e391080a — *SYMBOLIC AI: A FRAMEWORK FOR LOGIC-BASED APPROACHES COMBINING*;
   and [security report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges),
   05d0a27d8629 — *Secure-by-Default Guardrails for MCP-Based Tool Use in Multi-Modal*.

2. **Verdicts should remain decision-specific and non-transitive.** The runtime
   should independently record prompt-admission, evidence-verification,
   professional-disposition, action-authorization, execution, and release
   verdicts; no verdict should satisfy another by implication. Tests should
   prove that verified evidence cannot authorize a tool call and that an
   approved assertion can remain disputed or unverified. Evidence:
   [security report, “Verdict paragraph”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#verdict-paragraph),
   faeed21c6fc9 — *Towards trustworthy agentic AI: a comprehensive survey of*;
   and [legal report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges),
   703aea161905 — *Argumentation and Standards of Proof* and
   73abf21862dc — *The adaptive nature of text-driven law*.

3. **Consequential approval packets should be decision-complete.** Before an
   attorney can approve, the packet should expose authority context, reviewed
   facts and evidence snapshot, proposed actions and ordering, alternatives,
   uncertainty, expected consequences, proposed changes, policy or commitment
   revision, unresolved questions, and waivers; the decision event should
   capture rationale. Fixture validation should block approval when a required
   field is absent and exercise reject and revise paths, not only confirmation.
   Evidence: [security report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns),
   93e36f54c4ed — *A Dialogue Game Protocol for Co-operative Plan Proposals*;
   2a33e80446ab — *Decision as the Ontological Imperative: Why We Must*; and
   a0240f0f8138 — *When Should Language Models Remain Silent? Governing LLM*.

4. **Speech acts should have guarded, auditable transitions.** Inform, request,
   propose, challenge, approve, reject, and retract attempts should carry actor,
   role, conversation, causal parent, authority scope, evidence, and commitment
   revision. Each performative should define stage and role preconditions,
   immediate effects, outstanding completion conditions, and legal successors.
   Invalid or unauthorized attempts should produce recorded typed outcomes
   rather than disappear. Evidence:
   [legal report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   c610011eac4e — *A method for the computational modelling of dialectical argument*;
   and [security report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns),
   93e36f54c4ed — *A Dialogue Game Protocol for Co-operative Plan Proposals*.

5. **Protocol legality, strategy, and professional authority should remain
   separate.** A legal transition does not make a move strategically useful or
   attorney-authorized. Tests should show that a planner cannot redefine
   protocol preconditions, that advisory agent consensus cannot manufacture
   attorney authority, and that an otherwise legal move can still be denied by
   capability policy. Evidence:
   [legal report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   c610011eac4e — *A method for the computational modelling of dialectical argument*;
   and [security report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions),
   93e36f54c4ed — *A Dialogue Game Protocol for Co-operative Plan Proposals*.

6. **Interventions should use one durable typed lifecycle.** The shared protocol
   should distinguish observation, expectation, violation, failure hypothesis,
   response proposal, approval, action attempt, outcome observation, and final
   disposition while retaining rejected alternatives and causal links. Tests
   should prohibit skipping directly from proposal or approval to success.
   Evidence: [metacognition report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns),
   7ea169e822e0 — *Toward Domain-Neutral Human-Level Metacognition*;
   576ee59aaf2b — *Two Approaches to Implementing Metacognition*; and
   37c958e24d62 — *Architecture for a General Purpose Metacognitive Agent*.

7. **Every attempted intervention should carry an outcome contract.** Before
   execution, record the expected effect, observation deadline, success and
   failure predicates, cancellation conditions, and escalation route. Later
   observations should yield succeeded, failed, inconclusive, timed-out, or
   superseded dispositions. Absence of another alarm must not count as success.
   Evidence: [metacognition report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges),
   7ea169e822e0 — *Toward Domain-Neutral Human-Level Metacognition* and
   37c958e24d62 — *Architecture for a General Purpose Metacognitive Agent*.

8. **The control protocol should be topology-neutral for now.** An external
   supervisor and an integrated scheduler should receive equivalent event
   coverage and emit the same typed proposals, attempts, and outcomes. Their
   comparison should hold workload, partial observations, event freshness,
   privacy filtering, latency, and recovery cases constant. No topology should
   become binding before those fixtures exist, per align decision 6. Evidence:
   [metacognition report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#tensions--contradictions),
   576ee59aaf2b — *Two Approaches to Implementing Metacognition* and
   37c958e24d62 — *Architecture for a General Purpose Metacognitive Agent*.

9. **Non-action and exhausted control paths should be visible outcomes.**
   Verification, retry, fallback, abstention, attorney help, and stopping should
   carry reason codes, remaining budget, deadline impact, and escalation state.
   Tests should keep budget exhaustion distinct from refutation, unknown, and
   successful restraint, and should prevent silent abstention from hiding a
   legal deadline. Evidence:
   [metacognition report, “Design challenges”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges),
   7ea169e822e0 — *Toward Domain-Neutral Human-Level Metacognition*; and
   [security report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions),
   a0240f0f8138 — *When Should Language Models Remain Silent? Governing LLM*.

## Fixture candidates

- **Citation capability rejection:** extend the law patent-intake fixture with
  one unresolved entity and one unaligned required span. The model proposes a
  citation-verification invocation; decoding succeeds only for the complete
  case, and neither rejection can cross into a professional disposition or
  external action.

- **Decision-complete client draft:** place the existing client-facing
  acknowledgement behind two ordered alternatives with evidence, uncertainty,
  deadline consequences, proposed changes, unresolved questions, and reviewer
  rationale. Remove each required field in turn and expect a blocked or revise
  outcome rather than approval.

- **Failed recovery with observed outcome:** make a bounded filing-status lookup
  fail, produce two recovery proposals, approve one, record the attempted retry,
  and then observe a timeout. The final state must be failed or timed-out with
  attorney escalation, never successful merely because the retry was authorized.

- **Guarded conversation trace:** replay propose, challenge, justify, approve,
  retract, and close moves. Include a wrong-role approval, premature close,
  contradictory commitment, expired completion obligation, and rejected move;
  every attempt should remain in the exact trace while current commitments are
  rebuildable projections.

- **Topology comparison:** run the same delayed-event and omitted-observation
  episode through an external supervisor and an integrated scheduler. Compare
  detection coverage, duplicate interventions, latency, privacy exposure, and
  recovery without changing the shared protocol or expected verdicts.

- **Authorized read plus forbidden sink:** permit a matter-scoped document read
  but deny an outbound remote-tool call whose combined capabilities could
  disclose privileged content. Evidence verification and read authorization
  must remain non-authorizing for transmission.

- **Budget-sensitive abstention:** exhaust retry or tool-call budget immediately
  before a synthetic filing deadline. Expect a visible budget-exhausted event,
  deadline check, and attorney escalation rather than unknown, success, or
  silent abstention.

## Tensions and limits

- Typed guards can enforce protocol mechanics, capability scope, and closed
  outcomes; they cannot encode open-textured legal interpretation or establish
  legal correctness. Align decision 5 places qualified legal argumentation
  after semantic-foundation M1, not inside these control types.

- Complete event coverage improves diagnosis, but unrestricted telemetry
  conflicts with privilege, matter walls, and local-first confidentiality.
  Comparison fixtures should use scrubbed metadata and capability-checked
  references while measuring coverage and freshness explicitly.

- Decision-complete packets reduce rubber-stamping but can increase approval
  fatigue. The corpus offers no direct approval-UX study, so field requirements
  and escalation thresholds need repository-owned comprehension and workload
  fixtures rather than assumed effectiveness.

- The external-supervisor versus integrated-scheduler evidence is genuinely
  mixed and narrow. Align decision 6 correctly fixes the protocol while
  deferring topology; this note must not smuggle either deployment choice into
  the target contract.

- The corpus is strong on architectural convergence and thin on production
  validation. Most supporting work is a protocol, position paper, survey, or
  small demonstration; none evaluates privileged IP-law documents, exact span
  authority, matter walls, attorney approval, and adversarial tool execution
  together.

- The target remains deterministic-fixture-first and law-first, with wealth
  retained only as a dormant cross-domain fixture. These requirements should
  tighten the existing runtime proof, not imply production certification,
  autonomous legal judgment, or a new vertical.

## Provenance

This note was distilled from the three linked cluster reports, with the legal
norms report owning the speech-act and approval-versus-truth correction and the
metacognition and security reports supplying the control lifecycle, capability,
authorization, and outcome details.

The directly consulted deep reads were gold first:
c610011eac4e — *A method for the computational modelling of dialectical argument*
and faeed21c6fc9 — *Towards trustworthy agentic AI: a comprehensive survey of*.
Their value is architectural; neither validates this complete target setting.

Additional consulted deep reads were:
1a3665b7d2ae — *A modular, neuro-symbolic architecture that combines large language models*;
9e55e391080a — *SYMBOLIC AI: A FRAMEWORK FOR LOGIC-BASED APPROACHES COMBINING*;
7ea169e822e0 — *Toward Domain-Neutral Human-Level Metacognition*;
576ee59aaf2b — *Two Approaches to Implementing Metacognition*;
37c958e24d62 — *Architecture for a General Purpose Metacognitive Agent*;
93e36f54c4ed — *A Dialogue Game Protocol for Co-operative Plan Proposals*;
2a33e80446ab — *Decision as the Ontological Imperative: Why We Must*;
a0240f0f8138 — *When Should Language Models Remain Silent? Governing LLM*; and
05d0a27d8629 — *Secure-by-Default Guardrails for MCP-Based Tool Use in Multi-Modal*.

No paper quotation is reproduced here. Requirements are paraphrased design
inputs, and paper limitations remain controlling. Align decisions 1, 4, and 7
place this dispatch before the deferred second mining wave and park the source
packet after dispatch; this target note therefore records the routed evidence
without reopening corpus alignment or shaping a brief for the mining packet.
