# Lane B research — admission evidence shape and change policy

Date: 2026-08-13

## Corpus findings

The four inherited papers support a control structure, not a universal
threshold:

- Visual adaptation changed jailbreak behavior across three matched
  VLM/backbone pairs; qualification cannot silently transfer from a text
  backbone to the adapted multimodal arrangement
  ([Pantazopoulos et al.](https://aclanthology.org/2024.safety4convai-1.5/)).
- LMSanitator shows that ordinary task performance can coexist with
  task-agnostic prompt-tuning backdoors; scanner results are evidence, not a
  universal green badge
  ([Wei et al.](https://arxiv.org/abs/2308.13904)).
- PE2 demonstrates model/task-specific prompt optimization and is evidence
  against portable prompt qualification
  ([Ye et al.](https://arxiv.org/abs/2311.05661)).
- ChatTEDU separates generator and detector roles, but the inherited deep read
  found both roles used the same model and the evaluation replayed identified
  attacks; role separation is not an independent trust root
  ([publication record and DOI](https://avesis.tedu.edu.tr/publication/details/a38d51b3-8aeb-4ea5-9e89-d72ae53dbf73/securing-with-dual-llm-architecture-chattedu-an-open-access-chatbots-defense)).

The repo's cluster synthesis already bounds the inference: exact model,
adapter, prompt, wrapper, decoding configuration, and modality must be bound,
and no paper's percentages or release threshold transfer
([`t3-agent-security-orchestration.md:37-47`](../../academia-corpus-mining/research/t3-agent-security-orchestration.md#L37),
[`t3-agent-security-orchestration.md:105-110`](../../academia-corpus-mining/research/t3-agent-security-orchestration.md#L105)).

## Proposed evidence envelope

Each `ModelArrangementQualification` should contain:

1. arrangement revision key and complete decoded component manifest;
2. parent arrangement and typed component diff;
3. identity-assurance evidence for the hosted component;
4. frozen evaluation-plan revision and corpus/fixture digests;
5. per-case typed results, including modality-null and hard-negative controls;
6. clean utility results, safety failures, scanner findings, adaptive holdouts,
   cost, and latency as separate measures with denominators;
7. deterministic invariant-check results and evaluator/tool versions;
8. residual risks, unavailable evidence, expiry/recheck trigger, and rollback
   target.

Qualification evidence and human disposition are distinct immutable records.
A scoped `ModelArrangementDisposition` is recorded only after qualification is
complete and references that completed qualification; the qualification never
embeds its own disposition. Proposed disposition statuses are `admitted`,
`restricted`, `rejected`, `expired`, and `superseded`. `restricted` must carry
explicit eligible roles, modalities, data classes, and operational constraints.
No scalar trust score is part of the verdict. Admission makes an arrangement
eligible for a scope; it does not authorize a tool action or release an output.

## Full versus bounded-delta requalification

Every component change creates a new arrangement revision and a new
disposition. Evidence reuse is allowed; disposition inheritance is not.

**Full suite required** when any of these change or become unverifiable:

- hosted resolved model/snapshot/deployment identity or identity-assurance
  downgrade;
- base artifact, tokenizer, adapter/PEFT payload, modality encoder or enabled
  modality set;
- tool wrapper execution semantics, capability/permission boundary, system
  policy, output parser, or safety guardrail;
- evaluator/verdict logic or a corpus change that alters represented hazards;
- multiple interacting components where the delta cannot be isolated.

**Bounded delta suite may be proposed** only when the unchanged parent is
exactly identified, the component diff is machine-computable, the impact model
names affected tests, and an invariant sentinel suite over all previously
qualified hazard classes also passes. Typical candidates are a controlled
prompt revision, a decoding-budget change within an already qualified range,
or a wrapper change proven not to affect tool exposure. Prompt changes remain
model-specific and must rerun relevant held-out/adaptive cases.

Any unexpected sentinel regression escalates to the full suite. This is a
conservative policy proposed from the corpus's rejection of silent inheritance;
the papers do not validate an invalidation algorithm, so the exact matrix stays
an align decision.

## Separation from professional approval

The live runtime approval gate covers candidate work, evidence, policy basis,
requested reviewer actions, and a reviewer principal
([`ProfessionalRuntime.contracts.ts:456-499`](../../../packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts#L456)).
Model admission should be an upstream eligibility reference. It must not
replace candidate review, and its status must not be accepted where an
`ExecutionVerdict` or release disposition is required.
