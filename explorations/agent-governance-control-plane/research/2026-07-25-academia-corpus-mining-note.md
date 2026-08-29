# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** extend `explorations/agent-governance-control-plane` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [Agent security, governance & multi-agent orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md) and [Agent metacognition, self-reflection & neuro-symbolic architecture](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached agent-governance-control-plane

The target capture already owns an ordered law canon, explicit authority by role,
structured blockers, a gated work lifecycle, decision-complete handoffs, and
expiring exceptions. The corpus supplies research candidates for making those
ideas observable and testable across an execution trajectory rather than only
describing them as prompt or workflow policy
([target capture, “Durable design seed”](../CAPTURE.md#durable-design-seed)).

The owning security report argues that prompt admission, evidence verification,
human disposition, action authorization, and output release are distinct
decisions. Its proposed trajectory envelopes, commitment revisions, authority
scopes, break predicates, budgets, certifier separation, and typed messages
therefore extend the capture's role and lifecycle scope without creating a new
source of authority
([security report, “Verdict paragraph”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#verdict-paragraph)).

The metacognition report adds a compatible distinction between non-authoritative
monitoring cues and control decisions. Per align decision 6, research should
converge on one typed event/control protocol while leaving external-supervisor
versus integrated-scheduler deployment open until matched fixtures exist
([metacognition report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#tensions--contradictions)).

These are inputs for this capture-stage packet's future RESEARCH stage. They do
not revive the deleted command matrix, alter current repo law, or resolve the
capture's open boundary between repo-wide law, operator skills, and a separately
shaped governance capability
([target README, “Next Open Question”](../README.md#next-open-question)).

## Distilled requirements

1. **Record a typed trajectory envelope for every attempted side effect.**
   A fixture must reconstruct the acting principal, role, causal parent,
   governing objective and policy revision, capability and resource scope,
   protected argument projection, authorization source, memory effects,
   delegation, retries, consumed budget, and result. Exact attempts remain the
   audit substrate; summaries and graphs are projections. Evidence:
   `faeed21c6fc9` (Towards trustworthy agentic AI: a comprehensive survey),
   `2ad7451c2819` (AGENT-FENCE), and `05d0a27d8629`
   (Secure-by-Default Guardrails for MCP-Based Tool Use)
   ([security report, “Direct patterns,” pattern 1](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

2. **Make authorization principal-, intent-, capability-, resource-, and
   budget-aware and default-deny.** Tests must prove that prompt admission,
   verified evidence, or an allowed read cannot independently authorize a side
   effect or an outbound sink. The enforcing runtime, not the model or client,
   must decide allow, deny, or escalate. Evidence: `05d0a27d8629`,
   `faeed21c6fc9`, and `caefce8b35a2` (LLM Agents can Autonomously Exploit
   One-day Vulnerabilities)
   ([security report, “Design challenges,” challenges 1 and 3](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

3. **Version each run's commitment instead of mutating its objective in place.**
   A commitment must freeze objective, constraints, permitted side paths,
   success criteria, and governing evidence; every action must identify the
   revision it followed. Tests must distinguish legitimate success, competence
   failure, update failure, integrity failure, and justified abstention.
   Evidence: `5ea186e9fffe` (OTIP as a Commitment-Integrity Layer for Agentic
   AI), `2f8e3f5ed7c2` (OTIP-for-LLMs Pilot), and `93e36f54c4ed`
   (A Dialogue Game Protocol)
   ([security report, “Direct patterns,” pattern 2](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

4. **Treat budgets and stopping as typed control outcomes.** Token, tool-call,
   retry, elapsed-time, and spend ceilings must be checked before continued
   execution and recorded after each attempt. Exhaustion must produce a
   distinct budget-exhausted, escalate, or stop result rather than silently
   becoming false, unknown, or ordinary failure. Evidence: `faeed21c6fc9`,
   `2ad7451c2819`, `8f4dd599bd01` (Eyla), and `c83ef6c0788e`
   (Metareasoning as an Integral Part of Commonsense and Autocognitive
   Reasoning)
   ([security report, “Direct patterns,” pattern 6](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns);
   [metacognition report, “Design challenges,” challenge 8](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges)).

5. **Derive security breaks with deterministic predicates.** The future
   protocol must separately classify unauthorized invocation, unsafe argument,
   wrong-principal action, state or commitment integrity violation,
   confidentiality breach, attack-linked deviation, and budget breach.
   A successful task result must not erase a break. Evidence:
   `2ad7451c2819`, `faeed21c6fc9`, and `5ea186e9fffe`
   ([security report, “Direct patterns,” patterns 1 and 2](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

6. **Separate execution authority from independent certification.** The actor
   must be unable to alter frozen evidence, evaluator configuration, audit
   history, or success markers. Tests must distinguish drafted, verified,
   human-disposed, and released states; approval records a scoped human
   disposition and does not establish factual truth, consistent with align
   decision 2. Evidence: `5ea186e9fffe`, `b9ac605c406e` (OTIP),
   `e6b81c79c7ba` (Designing Scalable Agentic AI Platforms), and
   `2dc05086235c` (AILab)
   ([security report, “Direct patterns,” pattern 4](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

7. **Use typed performatives and guarded multi-agent transitions.** Every
   message attempt must carry a principal, performative, conversation and
   causal-parent identifiers, evidence references, commitment revision,
   authority scope, cost, lifecycle state, and outcome. Stage or role violations,
   rejections, retractions, conflicts, and timeouts must be recorded rather than
   silently discarded. Evidence: `d2fb8e91a6a9` (Metacognitive Multi-Agent
   Systems) and `93e36f54c4ed`
   ([security report, “Direct patterns,” pattern 8](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

8. **Keep role authority deterministic and non-consensual.** Orchestrators,
   workers, auditors, certifiers, and human reviewers need non-overlapping
   authority scopes. Agent unanimity may advise or challenge but must not
   manufacture human authority; deadlock, timeout, escalation, and final
   disposition rules must be explicit. Evidence: `93e36f54c4ed`
   ([security report, “Tensions & contradictions”](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions)).

9. **Adopt one topology-neutral monitoring and control protocol.** Monitoring
   must emit typed, non-authoritative cues; a controller must record its choice
   to verify, retry, change strategy, seek help, abstain, escalate, or stop.
   Observation coverage, freshness, ordering, and loss must be measurable so
   both external and integrated deployments can consume the same event contract.
   Evidence: `576ee59aaf2b` (Two Approaches to Implementing Metacognition),
   `9f1484f54bef` (Integrating Metacognition into Artificial Agents),
   `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent),
   and `6682c2d0729f` (Toward Artificial Metacognition)
   ([metacognition report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns)).

10. **Give every approved intervention a post-action outcome contract.**
    A proposal must name its expected effect, deadline, success predicate,
    failure predicate, attempt record, and later disposition. Authorization,
    attempted execution, and observed efficacy must remain distinct. Evidence:
    `9f1484f54bef`, `37c958e24d62`, and `77fde20a861d`
    (General-Purpose Metacognition Engine)
    ([metacognition report, “Design challenges,” challenge 4](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges)).

## Fixture candidates

- **Authorization matrix:** replay one execution attempt as allow, deny,
  escalate, budget-exceeded, wrong-principal, unsafe-argument, and secret-egress
  outcomes while holding the proposed action constant.

- **Mid-run policy revision:** change a governing rule after planning but before
  execution; exercise correct revision adoption, stale-rule execution,
  attempted waiver, unresolved conflict, and evidence-grounded abstention.

- **False but replayable trace:** preserve a byte-stable, deterministically
  replayable trajectory that reaches an unsupported conclusion; require trace
  integrity to pass while evidence certification and release fail.

- **Performative guards:** send valid and invalid Inform, Request, Propose,
  Challenge, Approve, Reject, and Retract attempts across wrong-role,
  wrong-stage, conflicting, timed-out, and deadlocked conversations; require a
  reasoned recorded outcome for every attempt.

- **Topology comparison:** run an external supervisor and an integrated
  scheduler against identical partial-observation, delayed-event, event-loss,
  privacy, latency, and recovery cases using the same typed protocol, as
  required by align decision 6.

- **Long-horizon capability chain:** combine a legitimate public vulnerability
  disclosure with browser, network, file, terminal, and code capabilities;
  verify per-capability grants, cumulative budgets, escalation boundaries, and
  a budget-exceeded break without importing a paper's numerical threshold.

- **Approval-to-outcome lifecycle:** begin with a failed tool call, record a
  recovery proposal and human disposition, attempt the recovery, miss its
  deadline, and prove that authorization, attempt, failure, and escalation are
  separate events.

- **Audit versus confidentiality:** inject a secret-bearing observation into an
  otherwise complete trajectory; require coverage and causal reconstruction
  from scrubbed metadata or a capability-checked reference while proving that
  raw secret content never enters the durable governance log.

## Tensions and limits

- The corpus is strong on architectural convergence but thin on production
  validation. Most governance papers are surveys, position papers, toy
  protocols, or unevaluated designs; none tests the complete privileged legal
  workflow. Adopt contracts and falsifiable fixtures, not reported security
  percentages, architecture rankings, or release thresholds.

- Complete trajectory evidence conflicts with secret minimization. Exact
  non-secret events and protected legal records may be authoritative within
  their storage classes, while secret-bearing content requires masked evidence,
  keyed digests, or capability-checked references rather than wholesale logs.

- External supervisors offer separability and certifier independence but can be
  blind to omitted or delayed process state. Integrated schedulers improve
  access to execution state but risk coupling monitor and actor authority.
  Align decision 6 correctly leaves topology open pending matched fixtures.

- Fail-closed authorization can produce approval fatigue. Hard prohibitions
  need deterministic vetoes, while softer risk signals should remain advisory
  and resource- and sink-aware; neither an agent explanation nor an LLM judge
  can certify authorization or release readiness.

- Independent certification is a boundary, not a guarantee. Hashes, append-only
  logs, deterministic replay, schema validity, and logical consistency each
  prove different properties and do not establish factual truth, completeness,
  durable retention, or professional authority.

- Pre-constrained executable envelopes may make narrow learned controllers more
  inspectable, as suggested by `665cd63780b0` (A Neural-Based Architecture for
  Bridging the Gap Between), but its small simulation does not justify learned
  governance policy for open-ended or consequential work
  ([metacognition report, “Direct patterns”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns)).

## Provenance

- Target scope read first:
  [README.md](../README.md) and [CAPTURE.md](../CAPTURE.md). No target SPEC,
  GOAL, or BRIEF was present.

- Owning synthesis:
  [Agent security, governance & multi-agent orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md),
  especially “Verdict paragraph,” “Design challenges,” “Direct patterns,”
  “Tensions & contradictions,” “Routing suggestions,” and “Quality notes.”

- Corroborating synthesis:
  [Agent metacognition, self-reflection & neuro-symbolic architecture](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md),
  especially “Design challenges,” “Direct patterns,” “Delta vs the June-29
  prior synthesis,” “Tensions & contradictions,” and “Quality notes.”

- Paper identities and tiers were checked against the
  [paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl).
  The cited per-paper deep-read notes were read directly, gold tier first.
  Their limitations govern this note: corpus structures are research inputs,
  not proof that any proposed control is production-effective.

- Per align decision 8, this additive note proposes research requirements only.
  Any binding doctrine, SPEC, PLAN, operator-skill, or product-vocabulary change
  belongs in its separately reviewed PR.
