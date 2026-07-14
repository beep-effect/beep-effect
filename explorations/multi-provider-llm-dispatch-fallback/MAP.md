# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Candidate | Disposition | Mission | Trigger / dependency | Capabilities cited |
| --- | --- | --- | --- | --- |
| [`llm-provider-subscription-auth`](../../goals/llm-provider-subscription-auth/README.md) | **GRADUATED** (shipped 2026-07-11) | Delegate Claude/Codex subscription authentication to vendor CLIs without storing provider tokens. | Shipped auth leg; it is not a dispatchable endpoint or credential source. | `@beep/ai-provider-cli`; agents `ProviderInstance` domain/use-cases/server surfaces |
| `llm-runtime-dispatch` | **DEMAND-GATED** — no goal scaffold | Construct/select ordered `ExecutionPlan`s over configured, eligible provider targets for an owning runtime consumer. | **Trigger:** a real consumer requires two compatible, credential-resolvable runtime targets. Consumer candidate: `AnthropicTurnKernel` successor work. | Vendored `ExecutionPlan`; public barrels of `@beep/anthropic`, `@beep/openai-compat`, `@beep/xai`, `@beep/venice-ai`; `LanguageModel.generateObject`; secret-governance credential-resolution port |

## Sequencing

The subscription-auth leg has graduated and shipped. It remains separate from
runtime dispatch: CLI authentication proves vendor-CLI availability, not a
beep-resolvable credential or dispatchable language-model endpoint.

`llm-runtime-dispatch` remains unscaffolded until its trigger fires. When it
does, the owning consumer first proves two compatible targets, then incubates
the runtime assembly in `packages/agents/server`. A static adapter registry may
be promoted only after a second congruent consumer proves demand.

## First Vertical Slice

After the trigger, prove one non-streaming provider-neutral call across the two
targets through public driver barrels and a common `LanguageModel` surface.
Compile/dtslint must prove the adapters. Then spike forced tools, structured
output via `generateObject`, streaming behavior, and model-identity
compatibility before integrating the plan into the owning consumer.

## Open Risks Inherited From The Brief

- Dispatch owns eligible-vs-unavailable advancement only; secret governance
  owns credential resolution (user vault -> `op://` -> environment).
- Authentication, integrity, and transport failures require explicit policy
  and are never silently collapsed into missing credentials.
- Ordered fallback only. Driver retry predicates and schedules remain at driver
  boundaries; round-robin and circuit breaking remain demand-gated elsewhere.
- Client-safe policy contracts live in agents domain/use-cases with no driver
  imports; concrete assembly incubates in `packages/agents/server`.
- Start with an app-local two-target match. No uniform driver-interface mandate,
  dynamic plugin registry, new dispatch driver package, or foundation package.
