# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/ingestion-secret-scrub` (high priority)
- **Source packet:** `explorations/academia-corpus-mining` (align-stage dispatch)
- **Owning reports:** [Agent security, governance & multi-agent orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached ingestion-secret-scrub

The target already gives `safeForPrompt` a narrow job: admit sanitized text to one
real prompt boundary only when secret coverage is known and no unresolved match
or secret-shaped residue remains. It also makes injection, credential resolution,
vault behavior, guarded fetch, and broader egress enforcement explicit non-goals
([README](../README.md), [SPEC](../SPEC.md)).

The corpus strengthens that boundary by showing why prompt admission must not
become a reusable safety credential. The owning report separates five decisions:
prompt admission, evidence verification, proposition acceptance, action
authorization, and output release. None implies the next
([Verdict paragraph](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#verdict-paragraph)).

The strongest route-specific empirical signal is caefce8b35a2, *LLM Agents can
Autonomously Exploit One-day Vulnerabilities*. In its 15-target sandbox
benchmark, supplying non-secret vulnerability disclosures sharply increased the
successful agent's exploitation rate. Clean, correctly retrieved, or verified
content can therefore amplify capability; confidentiality admission says
nothing about whether a derived action is permitted
([Design challenge 1](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)).

faeed21c6fc9, *Towards trustworthy agentic AI: a comprehensive survey of*,
converges on trajectory-level controls: external content remains untrusted,
hard rules receive deterministic enforcement, and side effects require an
authorization decision distinct from ingestion controls. Its value is
architectural rather than experimental because it is a narrative survey without
an original validation.

05d0a27d8629, *Secure-by-Default Guardrails for MCP-Based Tool Use in
Multi-Modal*, supplies a concrete request-to-execution separation: role
authorization, argument and resource validation, selective approval, and only
then execution. It also exposes the danger of treating read-only access as
low-risk when an outbound sink is available.

The route dispatches now under align decision 1. Its additive, non-binding form
follows align decision 8; it records a proof obligation at the existing seam
without importing the follow-on authorization or egress systems into this
two-week scrub slice.

## Distilled requirements

1. The scrub result contract must state that `safeForPrompt` proves only known
   secret-scrub coverage and prompt admissibility. A focused contract test or
   equivalent static proof must fail if that result is supplied where an action
   authorization or egress-policy verdict is required. Evidence: caefce8b35a2,
   faeed21c6fc9, and 05d0a27d8629
   ([Design challenge 1](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges);
   [Direct pattern 3](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

2. The selected real prompt consumer must demonstrate the one-way implication:
   a known-clean scrub result may release sanitized text to prompt construction,
   but it must create no permission to call a tool, transmit to a sink, mutate
   state, or release output. The fixture passes only when those downstream
   operations still require a separate decision. Evidence: faeed21c6fc9 and
   05d0a27d8629
   ([Two-sided secret and capability pipeline](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)).

3. At least one positive scrub fixture must contain public, non-secret,
   action-enabling information and produce `safeForPrompt: true`, while its
   paired side-effect attempt remains unauthorized in the absence of a
   separately supplied authorization verdict. This proves that successful
   scrubbing is not general action safety. Evidence: caefce8b35a2
   ([Design challenge 1](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges);
   [Delta vs the June-29 prior synthesis](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#delta-vs-the-june-29-prior-synthesis)).

4. A blocked or unknown scrub result must remain fail-closed at prompt
   construction even if a hypothetical downstream action is otherwise allowed.
   Conversely, downstream denial must not rewrite a successful scrub result as
   a confidentiality failure. The two verdicts must be independently
   assertable in fixtures. Evidence: faeed21c6fc9 and 07e39802c9b6,
   *LLMGuard: Guarding against Unsafe LLM Behavior*
   ([Direct pattern 3](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns);
   [Corroborations](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#corroborations)).

5. Scrub proof and audit projections must record only the target's permitted
   non-secret evidence. They must not absorb tool arguments, credentials,
   authorization rationales, or outbound payloads merely to prove the seam;
   exact synthetic-canary absence remains mandatory across serialized results,
   errors, logs, snapshots, and persistence. Evidence: faeed21c6fc9 and the
   owning report's audit-versus-minimization analysis
   ([Tensions and contradictions](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#tensions--contradictions)),
   consistent with the target [SPEC constraints](../SPEC.md#constraints).

6. Packet verification must name the limit of the proof: it establishes
   non-transitivity and one prompt boundary, not injection resistance,
   tool-policy correctness, credential safety, or egress enforcement. A proof
   report fails review if it describes `safeForPrompt` as general safety,
   trusted content, authorized execution, or approved release. Evidence:
   e77ec0588486, *Securing With Dual-LLM Architecture: ChatTEDU an Open Access*,
   and 07e39802c9b6
   ([Quality notes](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#quality-notes)).

## Fixture candidates

- **Public disclosure, denied exploit:** use synthetic CVE-style prose containing
  no credentials and no secret-shaped residue. Expect known coverage and prompt
  admission; pair it with a browser, terminal, or code-execution request that
  remains denied without separate authority. This is derived from
  caefce8b35a2's disclosure ablation, not from its historical percentages.

- **Sanitized credential, still unauthorized:** place a synthetic canary in
  otherwise benign task text. Expect replacement, correct non-secret proof, and
  prompt admission only if the target's existing coverage/residue rules permit
  it. A paired outbound tool request remains unauthorized regardless of the
  scrub result.

- **Allowed read plus forbidden sink:** use a synthetic privileged-document
  fixture with no credential match, followed by an attempted remote-MCP or
  network transmission. Expect prompt admission to remain independent from
  egress denial. This captures 05d0a27d8629's untested but architecturally
  important read-plus-egress risk.

- **Authorized action, blocked prompt:** pair an otherwise permitted synthetic
  action with unknown scrub coverage or secret-shaped residue. Expect the
  prompt leg to stop under the existing SPEC even though the independent action
  policy fixture says allow; no authorization result may override scrub
  failure.

- **Same-model guard says safe:** represent an advisory guard classification as
  clean while a deterministic action boundary denies the proposed side effect.
  This reflects e77ec0588486's role-separated calls to the same model and proves
  that classifier agreement is not an independent trust root.

- **Benign near-miss control:** use placeholder-like text that the canonical
  pattern bank intentionally does not classify as a secret. Expect the exact
  target-defined scrub outcome, then independently exercise allow and deny
  action dispositions to show neither disposition changes scrub metadata.

- **Cross-tool chain handoff:** admit sanitized synthetic text to the prompt,
  then describe—but do not implement in this packet—a read-to-network or
  browser-to-terminal chain whose first external side effect requires a
  separate confidentiality and authorization decision. Mark this as a
  follow-on fixture handoff, preserving the target's non-goals.

## Tensions and limits

- The target must prove a type and policy separation without implementing the
  authorization system whose absence makes that separation observable. A
  bounded negative/static seam proof plus paired fixture expectations is
  appropriate; building tool governance or egress enforcement here would
  violate the packet's scope.

- Complete execution traces aid reconstruction, but secret-bearing content
  cannot enter durable evidence. The owning report resolves this tension with
  distinct storage classes and masked evidence or keyed digests, matching the
  target's stricter non-persistence rules.

- Fail-closed controls can create approval fatigue, while unattended reads can
  combine with allowed sinks into exfiltration. This packet should record the
  distinction but leave resource-, principal-, purpose-, and sink-aware policy
  to the follow-on governance route.

- The corpus is strong on architectural convergence and thin on production
  validation. The survey is non-empirical; the MCP validator used 32
  author-designed vectors without end-to-end exfiltration tests; LLMGuard
  reports disconnected component metrics; and the dual-LLM study replayed
  already identified attacks with possible evaluation leakage.

- caefce8b35a2 offers implemented empirical evidence, but only across 15
  selected sandboxed vulnerabilities and without testing defensive controls.
  Its result supports the fixture hypothesis that clean evidence can amplify
  capability, not a universal threshold or effectiveness claim.

- No paper evaluates this repository's complete setting: privileged legal
  documents, secret scrubbing, deterministic spans, matter walls, typed tool
  authorization, attorney approval, and multi-agent execution. Repo-owned
  fixtures and current target acceptance criteria remain authoritative.

## Provenance

- Target scope read: [README.md](../README.md) and normative
  [SPEC.md](../SPEC.md).

- Owning synthesis read:
  [t3-agent-security-orchestration.md](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md),
  especially its verdict, design challenges 1 and 3, direct pattern 3,
  corroborations, tensions, routing suggestion, and quality notes.

- Per-paper deep reads read, gold tier first: faeed21c6fc9, *Towards trustworthy
  agentic AI: a comprehensive survey of*; caefce8b35a2, *LLM Agents can
  Autonomously Exploit One-day Vulnerabilities*; 05d0a27d8629,
  *Secure-by-Default Guardrails for MCP-Based Tool Use in Multi-Modal*;
  07e39802c9b6, *LLMGuard: Guarding against Unsafe LLM Behavior*; and
  e77ec0588486, *Securing With Dual-LLM Architecture: ChatTEDU an Open Access*.

- Titles and corpus identifiers are preserved from the owning report and its
  [paper catalog](../../../explorations/academia-corpus-mining/research/paper-catalog.jsonl).
  No paper URL, DOI, bibliographic identifier, or direct paper quotation is
  introduced here.

- Under align decision 7, the source mining packet parks after dispatch. Under
  align decision 8, this note remains additive evidence; any binding target-doc
  change belongs in a separate PR.
