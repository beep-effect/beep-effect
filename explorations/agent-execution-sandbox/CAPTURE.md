# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-25

### Route into this packet

I am opening this because the
[academia-corpus-mining align dispatch](../academia-corpus-mining/DECISIONS.md#2026-07-25--align-remaining-question-deferrals)
routed a high-priority row here: define default-deny execution authority,
resource limits, network policy, and immutable execution records.

This is one of the 15 routes dispatched now under align decision 1.

The parent mining packet parks after dispatch under align decision 7; this
packet owns the follow-through instead of asking the mining packet to shape a
brief.

Align decision 8 also matters procedurally: this capture belongs to the
additive dispatch, not the separate binding-document edits.

### The plain-language itch

I do not want model-generated code or a tool chain to inherit whatever
authority happens to exist in the host process.

“Allowed to reason about it,” “safe to place in a prompt,” “supported by a
citation,” and “approved for some purpose” must not silently become “allowed
to execute it.”

I want execution to begin with no ambient filesystem, process, credential,
memory, or network authority.

Anything granted should be narrow enough to name the principal, purpose,
resource, operation, sink, budget, policy revision, and expiry.

The uncomfortable part is that this is not merely a code runner. Browser,
terminal, remote MCP, retrieval, file access, delegation, and retries can form
one consequential execution path even when each step looks harmless alone.

### Corpus evidence I do not want to lose

The owning report routes this packet because secret scrubbing is necessary but
insufficient; generated code and tools still need denied-by-default authority,
resource limits, network denial, and immutable records
([agent-metacognition-neurosymbolic, “Routing suggestions”](../academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#routing-suggestions)).

`9e55e391080a` (SYMBOLIC AI) executes model-generated Python and Z3 code without
a stated sandbox or permission boundary. Its useful lesson is the missing
boundary, not an implementation to copy
([agent-metacognition-neurosymbolic, “Corroborations”](../academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#corroborations)).

The security cluster’s main claim is trajectory-level: security has to be
externally enforced across the whole run, not inferred from the final model
response. Prompt admission, evidence verification, human disposition, action
authorization, and release are separate decisions
([agent-security-orchestration, “Verdict paragraph”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#verdict-paragraph)).

`caefce8b35a2` (LLM Agents can Autonomously Exploit One-day Vulnerabilities)
is the sharpest warning for the first fixture. Supplying legitimate
vulnerability disclosures materially increased exploitation by a
browser-and-terminal-capable agent; verified evidence can amplify capability
rather than make action safe
([agent-security-orchestration, “Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

`05d0a27d8629` (Secure-by-Default Guardrails for MCP-Based Tool Use in
Multi-Modal) provides a useful default-deny, server-enforced tool pipeline, but
its own read-only relaxation exposes the unresolved read-plus-egress problem.
A privileged read and an allowed outbound sink compose into disclosure
authority
([agent-security-orchestration, “Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

`2ad7451c2819` (AGENT-FENCE: MAPPING SECURITY VULNERABILITIES ACROSS DEEP
RESEARCH AGENTS) contributes trajectory fields, authorization-break
predicates, and budget attacks. Its reported rankings are provisional because
the artifacts and experiments are not reproducible enough
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns);
[“Quality notes”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#quality-notes)).

`faeed21c6fc9` (Towards trustworthy agentic AI) supports sandbox stress,
incident replay, staged release, cumulative risk budgets, and reliable
interruption, but these are survey-derived control hypotheses rather than
validated thresholds
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

The evidence is strong enough to demand boundary fixtures, not strong enough
to import anyone’s security percentage, architecture ranking, or numerical
limit
([agent-security-orchestration, “Quality notes”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#quality-notes)).

### Repo pieces this must compose with

The [ingestion secret scrub spec](../../goals/ingestion-secret-scrub/SPEC.md)
already makes `safeForPrompt` a narrow, fail-closed prompt-admission result and
explicitly leaves operational egress to a later boundary. The sandbox must
consume that result without treating it as action authorization.

The
[professional runtime approval policy](../../goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md)
already preserves candidate work and reviewer decisions. Align decision 2 will
replace its truth-making vocabulary with typed verdicts; sandbox approval
should mean a recorded, scoped human disposition, not factual verification.

The
[agent governance control-plane capture](../agent-governance-control-plane/CAPTURE.md)
already owns role authority, gated lifecycles, blockers, and exception
discipline. I think this packet should own the concrete execution isolation and
authority boundary, while that packet owns the wider governance protocol, but
the seam is not settled.

The
[epistemic bitemporal edge core](../../goals/epistemic-bitemporal-edge-core/SPEC.md)
already establishes immutable payloads, lineage, correction by supersession,
and two-axis history. Under align decision 3, sandbox records may later feed
preferred belief views, but execution events must not become beliefs or truth
merely because they are immutable.

There is a narrow precedent for server-owned budgets and typed refusal in
[OntologyToolkit.ts](../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts),
with caller provenance and budget failures exercised through
[ontology-mcp-http.test.ts](../../apps/professional-desktop/test/integration/ontology-mcp-http.test.ts).
That is a reusable boundary idiom, not a general execution sandbox.

I did not find a repo-wide sandbox that already combines default-deny host
authority, network policy, resource ceilings, cross-tool flow control, and an
immutable execution ledger.

### Boundary sketch, still intentionally rough

Default deny should apply before execution: no tool, resource, credential,
memory mutation, delegation, or outbound sink exists unless an external policy
grant names it
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

Authorization should remain outside the model and outside generated code. The
request may explain purpose and expected outcome, but that explanation is an
auditable assertion rather than proof
([agent-security-orchestration, “Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

Network policy probably needs destination- and purpose-aware grants, not one
network boolean. Reads and sinks have to be evaluated together
([agent-security-orchestration, “Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

The report-named ceilings are tokens, tool calls, retries, elapsed time, and
spend. Research still has to decide which CPU, memory, process, filesystem, and
output-size limits belong in the first enforceable profile
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

A denied request, escalation, budget exhaustion, interrupted run, validator
failure, secret-egress attempt, and successful result should all remain visible
outcomes rather than disappearing behind one generic failure
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

The execution record needs the permissible exact request, principal, policy
revision, grant source, arguments or protected projection, resource accesses,
delegations, retries, budget consumption, causal parents, result, and security
breaks
([agent-security-orchestration, “Direct patterns”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

“Immutable” cannot mean “store every secret-bearing byte forever.” Exact audit
and secret minimization require explicit storage classes, redacted or keyed
evidence where necessary, and proof against deletion, truncation, replay, and
alternate histories
([agent-security-orchestration, “Tensions & contradictions”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions);
[“Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

A hash can prove correspondence to a payload; it cannot prove the payload true,
complete, authorized, or durably retained
([agent-security-orchestration, “Design challenges”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

### Tensions I am leaving open

Master align Q10 is the immediate fork: privileged read plus outbound sink,
browser-to-terminal execution, citation-derived legal action, or
model-generated code as the first authorization proof.

The browser-to-terminal case has the strongest concrete offensive evidence,
but privileged-read-plus-sink may expose the professional-runtime
confidentiality boundary with a smaller fixture.

Model-generated code is the owning report’s original itch, but starting there
could accidentally narrow “sandbox” to a Python runner and miss cross-tool
authority.

Citation-derived legal action would test the most product-specific consequence,
but it mixes sandbox mechanics with attorney authority and legal-policy design.

Fail-closed enforcement competes with approval fatigue. The likely answer is
hard deterministic vetoes plus resource-and-sink-aware approval, but the corpus
does not validate the right interaction
([agent-security-orchestration, “Tensions & contradictions”](../academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions)).

Align decision 6 commits metacognitive monitoring to one typed event/control
protocol while leaving external-supervisor versus integrated-scheduler
topology open. The sandbox should emit into that protocol without selecting
the topology
([agent-metacognition-neurosymbolic, “Tensions & contradictions”](../academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#tensions--contradictions)).

I still need a crisp ownership answer for policy decision, host isolation,
credential brokering, execution logging, and later certification. Putting all
five into one “sandbox service” smells like a future monolith.
