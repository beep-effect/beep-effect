# Model Artifact Admission — Sources & Provenance

Date: 2026-08-13

## External sources

| Source | URL | Accessed | Use |
| --- | --- | --- | --- |
| Anthropic, Model IDs and versioning | https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions | 2026-08-13 | Pinned-ID guarantee and alias limitation. |
| Anthropic, Get a Model | https://platform.claude.com/docs/en/api/beta/models/retrieve | 2026-08-13 | Alias-to-model-ID resolution. |
| OpenAI API backward compatibility | https://platform.openai.com/docs/api-reference/backward-compatibility | 2026-08-13 | Snapshot behavior and pinned-version/eval guidance. |
| OpenAI reproducible outputs | https://cookbook.openai.com/examples/reproducible_outputs_with_the_seed_parameter | 2026-08-13 | Backend fingerprint semantics and nondeterminism caveat. |
| Learning To See But Forgetting To Follow | https://aclanthology.org/2024.safety4convai-1.5/ | 2026-08-13 | Matched VLM/backbone safety drift. |
| LMSanitator | https://arxiv.org/abs/2308.13904 | 2026-08-13 | Backdoor/scanner evidence limits. |
| Prompt Engineering a Prompt Engineer | https://arxiv.org/abs/2311.05661 | 2026-08-13 | Model/task-specific prompt optimization. |
| Securing with Dual-LLM Architecture: ChatTEDU | https://doi.org/10.1109/ACCESS.2025.3623268 | 2026-08-13 | Role separation and inherited evaluation caveat. |

No upstream code repository was mined or proposed for porting. All external
sources are reference-only; repository-license disposition is not applicable.

## Mined local corpus

- `explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md`
  — ids `93ee78a5076c`, `32499919f05e`, `0d06c1a2189a`, and `e77ec0588486`;
  disposition: research evidence only, no thresholds imported.
- `explorations/academia-corpus-mining/research/paper-catalog.jsonl` — local
  content hashes and paper metadata for the same four records.

## In-repo bricks

- `packages/drivers/anthropic/src/Anthropic.config.ts`
- `packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.model.ts`
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts`
- `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts`
- `packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts`
- `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts`
- `goals/epistemic-bitemporal-edge-core/SPEC.md`

## Research artifacts

- [`01-hosted-identity-boundary.md`](./01-hosted-identity-boundary.md)
- [`02-admission-evidence-and-change-policy.md`](./02-admission-evidence-and-change-policy.md)
- [`03-epistemic-lineage-and-drift.md`](./03-epistemic-lineage-and-drift.md)

