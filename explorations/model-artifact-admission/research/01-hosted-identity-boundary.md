# Lane B research — hosted-model identity boundary

Date: 2026-08-13

## Answer

A hosted model is admitted by the strongest **provider-attested execution
identity actually available**, not by an invented artifact digest. The
admission subject is a content-addressed `ModelArrangementRevision` whose
controlled components are digest-bound and whose hosted component is an
attestation envelope.

The hosted identity envelope should carry only stable provider-attested
identity:

- provider, service, and deployment identity;
- requested model identifier and the resolved pinned model identifier when the
  provider returns one;
- alias-resolution class;
- an identity-assurance tag: `provider-pinned`, `provider-resolved-alias`,
  `alias-only`, or `opaque-deployment`.

The arrangement digest seals only that stable identity envelope plus every
controlled-component digest. Provider backend fingerprints or revisions,
observation timestamps, and request/response receipt identifiers are
non-identity execution observations. They are recorded as evidence that
references the arrangement identity, never as fields digested into it. This is
an honest digest of beep's admission subject; it is **not** represented as a
digest of unavailable hosted weights.

## Provider evidence

Anthropic now explicitly guarantees that a full model ID identifies a pinned
version whose weights/configuration remain constant for the lifetime of that
ID, while convenience aliases are outside that guarantee
([Anthropic, “Model IDs and versioning”](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)).
Its Models API can also resolve an alias to a model ID
([Anthropic, “Get a Model”](https://platform.claude.com/docs/en/api/beta/models/retrieve)).
That supports `provider-pinned` and `provider-resolved-alias` assurance without
claiming a weights digest.

OpenAI states that prompting behavior can differ between snapshots and
recommends pinned model versions plus evals
([OpenAI API backward compatibility](https://platform.openai.com/docs/api-reference/backward-compatibility)).
OpenAI's `system_fingerprint` describes the combination of model weights,
infrastructure, and other server configuration, but is a monitoring signal and
does not guarantee exact determinism
([OpenAI, reproducible outputs](https://cookbook.openai.com/examples/reproducible_outputs_with_the_seed_parameter)).
It belongs in execution evidence that references the arrangement identity,
not in the arrangement digest.

## Live repo grounding

The Anthropic driver is stronger than the capture implied: its default is the
full pinned ID `claude-opus-4-6`, and its documentation says to keep the ID
pinned
([`Anthropic.config.ts:43-93`](../../../packages/drivers/anthropic/src/Anthropic.config.ts#L43)).
The schema-backed options still accept an override, so admission must bind the
materialized runtime value, not merely the default constant.

`ProviderInstance` correctly carries only CLI binary/HOME/environment metadata
and an auth-probe snapshot; it explicitly forbids token-bearing fields
([`ProviderInstance.model.ts:17-26`](../../../packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.model.ts#L17),
[`ProviderInstance.model.ts:39-60`](../../../packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.model.ts#L39)).
An admission record may reference its public identity but must never copy
credentials or raw probe output.

`RuntimeUsageRecord` stores provider/model strings as attribution
([`ProfessionalRuntime.contracts.ts:638-668`](../../../packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts#L638)).
That is useful execution evidence, but it lacks endpoint, deployment, resolved
ID, fingerprint, component digests, or assurance strength and therefore cannot
serve as admission identity by itself.

## Consequences

- Moving a mutable alias to a new resolved ID is an identity change and creates
  a new arrangement revision requiring requalification.
- Backend-fingerprint churn does not force requalification, and observation
  timestamps or per-request receipt identifiers do not mint arrangement
  revisions; those observations remain linked execution evidence.
- If no resolution/attestation is available, admission may be scoped and
  short-lived at `alias-only` strength, but cannot claim exact-model replay.
- Rollback is permitted only to a previously admitted arrangement whose hosted
  identity can still be requested or resolved to the same attested identity.
- Provider-side unobservable changes are residual risk recorded in the
  disposition, not hidden behind false precision.
