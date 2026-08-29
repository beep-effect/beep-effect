# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-25

### Where this came from

- I am opening this from the `academia-corpus-mining` align dispatch, not from a
  standalone product pitch.
- Align decision 1 dispatched all 15 high-priority routes now; the owning
  cluster routed this one to a new exploration because model admission spans
  supply chain, prompt promotion, multimodal regression, scanner evidence, and
  rollback beyond any current goal.
- The routed insight is deliberately exacting: bind qualification to the model,
  adapter, modality, prompt, wrapper, decoding configuration, and artifact
  digest.
- Source:
  [`Routing suggestions`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#routing-suggestions)
  and
  [`Design challenges` item 5](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges).

### The itch in plain words

- I do not want “we tested Claude” or “this prompt passed” to count as an
  admission claim.
- I want the admitted thing to be the whole executable model arrangement:
  exact artifact or provider version, adapter, enabled modalities, prompt
  lineage, tool wrapper, decoding settings, and the digest of every artifact
  we actually control.
- Change one qualified part and the old verdict should no longer silently
  apply. Requalification may reuse evidence, but it needs a new scoped
  disposition.
- An admission verdict is permission to use that exact arrangement within a
  stated scope. It is not proof that the model is safe in general, and it does
  not authorize any particular tool action or released output.
- That separation follows the cluster
  [`Verdict paragraph`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#verdict-paragraph)
  and align decision 2: approval is a recorded scoped human disposition, not
  epistemic truth.

### Strongest corpus evidence I want to carry forward

- `93ee78a5076c` — *Learning To See But Forgetting To Follow*: three matched
  VLM/backbone pairs produced different harmful-response behavior after visual
  adaptation. Relevant-image and blank-image conditions also behaved
  differently. The study is narrow and does not establish visual tuning as the
  sole cause, but it is enough to reject inherited backbone qualification.
  Source:
  [`Design challenges` item 5](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)
  and the paper deep read, Sections 3–5.
- `32499919f05e` — *LMSanitator*: ordinary clean-task performance often stayed
  intact while tested prompt-tuned encoders retained backdoors. Scanner results
  varied by architecture, strong adaptive attacks could evade detection, and
  the headline mitigation used attacker-known information when mining missed
  it. Scanner evidence therefore belongs in an admission record, but cannot be
  collapsed into a universal green badge. Source:
  [`Model-and-prompt admission ledger`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns)
  and the paper deep read, Sections 2, 5, and 6.
- `0d06c1a2189a` — *Prompt Engineering a Prompt Engineer*: optimized prompts
  did not transfer consistently across task models, and scalar optimization
  rewarded a semantically false shortcut in one experiment. Prompt candidates
  need model-specific lineage, frozen evaluation context, invariant checks,
  held-out cases, and rollback ancestry rather than overwrite-in-place
  promotion. Source:
  [`Design challenges` items 5–6](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)
  and the paper deep read, Sections 2, 3, and 5.
- `e77ec0588486` — *Securing With Dual-LLM Architecture*: the two roles were
  calls to the same model, while the reported detection result replayed already
  identified attacks without an independent held-out benchmark. Role
  separation is useful orchestration, but it is not an independent trust root
  or sufficient admission proof. Source:
  [`Design challenges` item 5](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges)
  and the paper deep read, Sections V–VI.
- The cluster rates this evidence as moderate across mismatched domains. I
  should adopt the control structure and test hypotheses, not import reported
  percentages, thresholds, or claims of universal effectiveness. Source:
  [`Quality notes`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#quality-notes).

### Repo bricks this should compose with

- [`Anthropic.config.ts`](../../packages/drivers/anthropic/src/Anthropic.config.ts)
  already pins a provider model identifier and schema-backed maximum-token
  configuration. That is useful execution input, but I found no admission
  digest, prompt lineage, modality qualification, scanner record, or release
  disposition there.
- [`ProviderInstance.model.ts`](../../packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.model.ts)
  owns token-safe provider CLI instance metadata and authentication probes.
  Admission should reference provider/runtime identity without pulling raw
  credentials into its ledger.
- [`Agent.model.ts`](../../packages/agents/domain/src/entities/Agent/Agent.model.ts)
  and
  [`Skill.model.ts`](../../packages/agents/domain/src/entities/Skill/Skill.model.ts)
  are currently fixture-oriented bindings. They do not yet identify a complete
  qualified model-and-prompt arrangement.
- [`ProfessionalRuntime.contracts.ts`](../../packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts)
  already models candidate work, evidence references, approval gates, and
  provider/model usage attribution. Model admission should become an upstream
  eligibility input, not replace candidate review or action authorization.
- [`approval-and-autonomy-policy.md`](../../goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md)
  preserves human review and rejected/revised history. Its “authoritative
  runtime truth” wording is scheduled for typed-verdict correction by align
  decision 2 in a separate PR; this packet should use the corrected vocabulary
  from the start.
- [`epistemic-bitemporal-edge-core/SPEC.md`](../../goals/epistemic-bitemporal-edge-core/SPEC.md)
  already owns immutable facts, dispositions, lineage, supersession, and
  valid-time/knowledge-time reads. Model trust changes look like a consumer of
  that core, consistent with align decision 3’s retained inconsistent evidence
  plus recoverable preferred working views.
- [`agent-governance-control-plane/CAPTURE.md`](../agent-governance-control-plane/CAPTURE.md)
  owns role authority, gated lifecycle, and decision-complete handoffs.
  Admission can answer whether an arrangement is eligible for a scoped role;
  governance still answers whether this principal may perform this action.

### Boundary sketches and tensions

- The likely record is append-only: candidate arrangement, parentage, frozen
  evaluation corpus/version, configuration, evidence, scoped verdict, human
  disposition, expiry or supersession, and rollback target. This is design
  intent, unverified, distilled from
  [`Model-and-prompt admission ledger`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns).
- The first comparison fixture should hold task and corpus constant while
  varying base versus adapted artifact across ordinary prompts, jailbreaks,
  relevant attachments, modality-null controls, hard-negative grounding cases,
  and held-out attacks. Source:
  [`Model-and-prompt admission ledger`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns),
  citing `93ee78a5076c`, `32499919f05e`, `0d06c1a2189a`, and `e77ec0588486`.
- I am unsure where the identity boundary sits for hosted mutable models. A
  provider model name is not an artifact digest, yet pretending we possess
  unavailable weights would create false precision.
- I am unsure which changes always invalidate admission and which can trigger a
  narrower delta suite. The corpus strongly rejects silent inheritance but
  does not supply a validated invalidation algorithm.
- I need clean utility, safety failures, scanner evidence, adaptive holdouts,
  cost, and latency visible without turning them into one scalar trust score.
  Source:
  [`Design challenges` items 6–7](../academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges).
- I need rollback to restore an exact previously admitted arrangement, not just
  an older prompt string while the provider model or wrapper has drifted.
  Source:
  [`Model-and-prompt admission ledger`](../academia-corpus-mining/research/t3-agent-security-orchestration.md#direct-patterns).
- No align question was deferred into this packet. These tensions are new
  capture questions, not reopened master decisions.
