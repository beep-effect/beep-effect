# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-11-13

### The proposal and its checks

- [`research/01-proposal.md`](./research/01-proposal.md): the third draft of the design, as text, with
  a header stating what was checked. The code blocks are the original sketches.
- Prototype: `scratchpad/model-first-slices/` (standalone workspace on `@alchemy.run/domain`
  2.0.0-beta.87, effect 4.1.4). Four packages type-check; 5 model tests and 1 in-process Api test
  pass. Cluster wiring is type-checked only. Nothing ran on a pool.
- Sketch-versus-library mismatches the prototype found are listed in the proposal header;
  the probes are in `scratchpad/model-first-slices/probes/`.

### Outside reviews

- [`research/02-astra-review.md`](./research/02-astra-review.md): GPT-6 Astra, adversarial check of the
  load-bearing claims against the library source.
- [`research/03-kimi-review.md`](./research/03-kimi-review.md): Kimi K3.1 Pro, design alternatives
  and agent ergonomics.
- [`research/04-adhd-pass.md`](./research/04-adhd-pass.md): thirty divergent ideas under five frames,
  scored and clustered, three deepened.
- [`research/05-grok-deep-research.md`](./research/05-grok-deep-research.md): Grok 4.7 deep research
  on prior art and the state of the art, with source URLs. The run kept 15 of 24 candidate claims
  and marks itself partial; the frontend thread was not verified. It contradicts none of D1 to D20
  outright. It adds three things the grill had not covered: a generated typed API in a sandbox for
  agents that write code, payload conversion plus read-time transforms in place of a widen-only
  stored-contract law, and a bound on one agent run's history.
- [`research/06-grok-interim-draft.md`](./research/06-grok-interim-draft.md): the draft Grok wrote
  before its verification pass finished, superseded by `05`. Kept because it cites Alchemy's own
  documentation pages, including the statement that every host passes the same 20 conformance
  cases. Those claims did not go through the run's verifier.

Three of Astra's source claims were re-read in the library and hold
(`~/YeeBois/references/effect/alchemy/packages/domain/src`):

- `DurableObjects.ts` `commit`: a stored receipt for the command id is returned before `kit.handle`
  runs, so a retried id skips `decide`.
- `DurableObjects.ts` projection `drain`: `kit.run` completes before the checkpoint is written, so a
  crash between them replays the batch.
- `Kernel.ts`: the event codec is chosen by the stored `_tag` before decoding.

## External Landscape

Upstream state on 2026-11-13, read from local checkouts:

- `@alchemy.run/domain/EffectCluster` hosts a `Domain.Model` as one cluster entity type
  (`layerEntities`), on Postgres or on Durable Objects through Alchemy's pools.
- `@alchemy.run/effect-cluster` provides `Entity`, `Singleton`, `Cron`, `Workflow`, pools and
  providers (Docker swarm, AWS, GCP, Kubernetes, Fly, Hetzner, Cloudflare).
- `@effect/platform-cloudflare` runs Effect Cluster on Durable Objects (experimental). Its Alchemy
  helper does not satisfy the Domain host contract as it stands (Astra review, claims table).

## In-Repo Capability Inventory

- `packages/documents/{domain,use-cases,server}`: the one slice on the library today (vault-sync).
- `packages/drivers/alchemy-postgres`: the repo-owned `Domain.Platform` on Postgres (adoption D1).
- `.claude/skills/alchemy-domain/`: block templates and hosting notes.
- `explorations/alchemy-domain-adoption/DECISIONS.md`: D0 to D17, the adoption decisions this
  exploration may supersede.

## Constraints Discovered

- A policy handler runs with no request context.
- A `Domain.ExternalSystem` class is not its own service identifier.
- `SendMeta.context` exists in the library but is not persisted on events, so envelope-level
  provenance needs an upstream change.
- A defecting cluster entity is rebuilt and replayed with no stop today (ADHD focus branch on
  operations; not independently re-checked).
