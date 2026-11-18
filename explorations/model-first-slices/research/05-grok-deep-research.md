# Verdict

This is not the best architecture available in November 2026. Host the model on Alchemy's cluster pools, including Durable Objects through `@alchemy.run/domain` Effect Cluster, and treat `@effect/platform-cloudflare` as a separate experimental package. Keep React, keep one aggregate instance as the entity and the consistency boundary, and keep a person who can deny a world-changing tool call. Change the agent run into a bounded process workflow, give coding agents a sandboxed generated API, and evolve stored events by payload conversion plus read-time transforms. The beta.87 sketches for policies, saga results, and name-only singletons disagree with the library and have to be rewritten.

This pass is partial. A deep-research run on 13 November 2026 kept 15 of 24 candidate claims. Six never reached a verifier. Nine were rejected. The frontend thread is in that unverified six.

## Findings by thread

### 1. `@alchemy.run/domain`, `@alchemy.run/effect-cluster`, Effect Cluster on Durable Objects

`@effect/platform-cloudflare` merged on 10 November 2026 as Effect-TS/effect PR 7322 and is experimental in the 4.1.3 tag. `AlchemyCloudflareCluster.make` is the deploy helper. That tag's README says the live deployment smoke has not yet been verified.
Source: [4.1.3 README](https://raw.githubusercontent.com/Effect-TS/effect/refs/tags/@effect/platform-cloudflare@4.1.3/packages/platform/cloudflare/README.md), tag 4.1.3; merge date 10 November 2026 on [PR 7322](https://github.com/Effect-TS/effect/pull/7322).

`@alchemy.run/effect-cluster` merged on 6 November 2026 as alchemy PR 2924. It ships `Cluster.Entity`, `Cluster.Singleton`, `Cluster.Cron`, and `Cluster.Workflow`, plus pools for Docker, AWS, GCP, Kubernetes, Fly, Hetzner, and Cloudflare Durable Objects. The PR's own leftovers were durable entity state (`Cluster.EntityState`), HTTP routes for non-Effect callers, and an EC2 pool. Nobody re-read commits after that merge, so those leftovers may already be gone.
Source: [PR 2924](https://github.com/alchemy-run/alchemy/pull/2924), merged 6 November 2026.

Domain cluster hosting merged on 7 November 2026 as PR 3143 (`DomainCluster.layerEntities`). Durable Object pool hosting merged on 12 November 2026 as PR 3276, after that pool grew `RunnerHost` and `InstanceStorage`. The 2.0.0-beta.87 domain and effect-cluster packages do not depend on `@effect/platform-cloudflare`.
Source: [PR 3143](https://github.com/alchemy-run/alchemy/pull/3143), merged 7 November 2026; [PR 3276](https://github.com/alchemy-run/alchemy/pull/3276), merged 12 November 2026.

In domain 2.0.0-beta.87 a policy handler is an effect over the trigger only. The trigger carries key, route, source, event, envelope, and state. It does not carry request context. `ExternalSystem` is not its own service identifier. The service id is `ExternalSystemKey`, taken from `Context.Key`, not the class.
Source: `@alchemy.run/domain` 2.0.0-beta.87, `packages/domain/src/Policy.ts` and `ExternalSystem.ts`, read 13 November 2026. Repository: [alchemy-run/alchemy](https://github.com/alchemy-run/alchemy).

In that same version a saga `Activity` needs an explicit error schema because the default error channel is `Schema.Never`. It cannot return a command receipt as its value because `Aggregate.Receipt` is an interface, not a schema. A `Completed` saga story has to carry a `result`.
Source: Effect `Activity.make` in `packages/effect/src/workflow/Activity.ts`, and domain 2.0.0-beta.87 `Saga`, `Aggregate`, and `Story`, read 13 November 2026.

A name-only `Cluster.Singleton` cannot be yielded as a stack effect. That overload returns a tag whose implementation is a `Layer`. Only the props-plus-implementation form is the effect a stack yields. The claim that domain cluster hosting has no live deployment is not what those PRs say. PR 3143 describes the domain conformance suite running on Effect Cluster, including Cloudflare local and live. PR 3276 documents a Durable Object bank integration test. That is a different statement from the unverified smoke on `@effect/platform-cloudflare`.
Source: `@alchemy.run/effect-cluster` 2.0.0-beta.87, `packages/effect-cluster/src/Singleton.ts`, read 13 November 2026, checked against [PR 3143](https://github.com/alchemy-run/alchemy/pull/3143) and [PR 3276](https://github.com/alchemy-run/alchemy/pull/3276).

### 2. Prior art for event-sourced actors

Three systems produced a claim that survived. The rest of the named list did not.

Akka's current state model makes the entity id the consistency boundary. One owner processes commands for an entity id. Changes inside that id can be coordinated. Changes across entities are a process or asynchronous reactions. Unrelated data goes on separate ids. Direct field mutation does not persist. View updates are asynchronous, so a query immediately after a command can return the earlier state. A view-schema or update-logic change can require a rebuild. The read model is not the authoritative history. Schema evolution is part of the application contract. The page does not use the words "bounded context."
Source: [State and read models](https://doc.akka.io/concepts/state-model.html), retrieved 13 November 2026. No last-updated line on the page.

Orleans event-sourced grains are not safe just because one activation is single-threaded. Replicated journaled instances can each accept a conflicting command. An invariant-bearing event has to be conditional on the local version still matching storage. A lost race is not appended. Events that cannot break the invariant may stay unconditional. A second Orleans page, cited by the verifier, says one activation still executes only one turn at a time, so single-threaded activation does not remove the race.
Source: [Replicated grains](https://learn.microsoft.com/en-us/dotnet/orleans/grains/event-sourcing/replicated-instances), last updated 15 November 2025.

Temporal terminates a workflow execution once its event history grows past fixed caps. The current Event History page warns after 10,240 events and terminates an execution past 51,200 events, 2,000 updates, or 10,000 signals. There is no time limit. A long-lived process cannot be an ever-appending event-sourced entity. It has to continue as new. The limits page repeats the 10,240 warning and the 51,200-event cap.
Source: [Events and Event History](https://docs.temporal.io/workflow-execution/event), retrieved 13 November 2026. No last-updated stamp in the HTML.

Corrected on verification, so the stronger wording stays out:

Steven van Beelen, 27 June 2025, says that once aggregates are defined, those decisions are locked for the life of the system, and that Dynamic Consistency Boundary defines a per-operation consistency scope inside a bounded context without discarding stored events. The same post calls DCB experimental. It never discusses streams or a ban on multi-stream consistency sets, so it does not undercut that ban.
Source: [DCB in Axon Framework 5](https://www.axoniq.io/blog/dcb-in-af-5), 27 June 2025.

Cloudflare's Durable Object rules, last updated 5 November 2026, call each object single-threaded, warn that one global object becomes a bottleneck, and give approximate throughputs of about 1,000, 500–750, and 200–500 requests per second depending on the work. They do not call that a hard ceiling, and they do not say one object for a whole bounded context must be sharded.
Source: [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/), last updated 5 November 2026.

KurrentDB 26.1, 4 May 2026, says the old projection engine and Projections V2 checkpoint differently, so there is no automatic migration and identical JavaScript does not carry state. It calls the break a deliberate decision and keeps existing projections on V1. It does not call the engine an operational liability.
Source: [KurrentDB 26.1](https://kurrentdb.kurrent.io/releases/kurrentdb/26-1/), 4 May 2026.

Leads the researchers wrote down and the verifiers did not accept as claims: Pekko's typed snapshot docs (page labeled 2.0.0) on long recovery, failed snapshot loads, and deleting events past a missing snapshot. Restate's split between single-writer virtual objects and exactly-once workflows, with no visible date. Marten's warning that gap-skipping while an appender is still live drops a commit inside the skipped range. ElectricSQL shapes invalidated by a column change, and purged when the replication slot is lost. LiveStore 0.3.1 and 0.4 requiring event definitions to stay and stay forward-compatible. Convex serializable mutations and Rivet's February 2026 workflows-and-queues notes were not opened. The Cloudflare Agents SDK page, updated 10 November 2026, says every agent is one Durable Object with a single alarm. That sentence was not promoted to a claim.

### 3. Agent-native architecture in 2026

The model-facing surface Cloudflare describes is a TypeScript API generated from the tool schema, executed in a sandbox with no general network and no API keys, only bindings. That post is dated 26 September 2025. Anthropic's rendered code-execution article shows no publication date. It generates typed tool files and reports one workflow dropping from about 150,000 tokens to about 2,000. Search metadata listed 4 November 2025 for that article. The date is not on the page, so it is not established.
Source: [Code Mode](https://blog.cloudflare.com/code-mode/), `datePublished` 26 September 2025.

On 10 November 2026 Kiran Prakash defines durable execution, as implemented by Temporal, Restate, Inngest, DBOS, and Cloudflare Workflows, as the replacement for an in-memory agent loop. Each outside-world step's result is logged. Replay skips completed steps. A wait does not hold a process. A long-lived entity workflow stays separate from a process workflow that finishes one piece of work. Admission rules stay in code. In his example, `place_order` is unavailable until a manager approves the price.
Source: [Long-horizon agents and durable execution](https://martinfowler.com/articles/durable-execution-agents.html), 10 November 2026.

Temporal's human-in-the-loop recipe treats approval as a signal into a workflow wait. The wait can last hours, days, or indefinitely and uses no compute. Timers survive disruption. Decisions are the audit trail.
Source: [Human-in-the-loop AI agent](https://docs.temporal.io/ai/cookbook/human-in-the-loop-python), last updated 21 October 2026.

The MCP tools specification dated 25 November 2025 keeps tools model-controlled. It also says there should always be a human who can deny a tool invocation. Servers must apply access controls. Clients should confirm sensitive operations and log tool usage for audit. A machine-checked architecture law is not that denial.
Source: [MCP tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), 25 November 2025.

Corrected on verification: the same specification's authorization page does require an RFC 8707 resource indicator, audience validation, and no token passthrough. It treats least privilege as a scope-selection principle, not as the audience-binding rule. "Least privilege by audience-binding" is not what the specification says.
Source: [MCP authorization, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), 25 November 2025.

Also corrected: Cloudflare's Agents human-in-the-loop page, schema.org `dateModified` 27 October 2026, does pause with `requiresApproval` before a connector call and does replay completed calls from the durable log. The SQL audit insert the researcher attached to that pause belongs to a different `approve()` example, so it is not part of this claim.
Source: [Human-in-the-loop patterns](https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/), `dateModified` 27 October 2026.

No inspected primary source says ArchUnit, NetArchTest, dependency-cruiser, fitness functions, or schema laws are a sufficient sole gate on agent-written code. Prakash also writes that durable execution is not correctness: the replay log does not see every external outcome, the world can change during a wait, and retries are at-least-once unless the harness supplies a stable idempotency key. That second statement stayed an uncertainty, not a retained claim. LangGraph checkpoint interrupts were not page-inspected. OpenTelemetry's GenAI agent spans are marked Development and were not established as a stable provenance record.

### 4. Event-sourcing failure modes

Axon Framework 5.4 leaves stored events in the serialized form they were written in. Payload conversion covers new fields with defaults, removed fields, renamed fields, and compatible type changes. A reshape, a renamed event identity, a split, or a drop is a separate read-time transformation, one per version step. No 2024–November 2026 source inspected states the proposal's rule that an encoded stored contract may only widen and that a new tag is required when no codec can express the change. Axon is the closest statement, and it is wider than that rule: conversion already covers renames and removals.
Source: [Event versioning](https://docs.axoniq.io/axon-framework-reference/5.4/events/event-versioning/), Axon Framework reference 5.4, read 13 November 2026. No separate publication date on the page.

Under Standard Webhooks 1.0.0 the upstream id stays the same across retries and is the idempotency key consumers dedupe on. Authenticity is a separate signature over that id, the timestamp, and the raw body. Timestamp tolerance is what limits replay. The id does not prove the caller is authentic or authorized. The file is labeled version 1.0.0 and contains no revision date.
Source: [Standard Webhooks 1.0.0](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md), version 1.0.0, read 13 November 2026.

Akka's lag point in thread 2 is the verified read-your-writes fact: a query immediately after a command can return the earlier state, and a view change can force a rebuild.

Corrected on verification, and therefore not adopted:

Marten documents inline and async rebuilds, separate tables via `ProjectionVersion` with async catch-up, and gating side effects so historical replay does not fire them again. Insert-only is not true of every rebuild. The same page says aggregation rebuilds stay on UPSERT. The page shows no publication date. Its blue/green section links a Jeremy Miller post dated 26 March 2025.
Source: [Rebuilding projections](https://martendb.io/events/projections/rebuilding), read 13 November 2026.

EDPB Guidelines 02/2025 version 2.0, adopted 7 July 2026, say key deletion leaves ciphertext unintelligible at least until the algorithm is broken, decryption advances, or the key was compromised, and that encrypted personal data remains personal data. Off-chain erasure may prevent future identification depending on the method and the facts. The guidelines do not say the on-chain record then stops identifying the person, and they do not decide a private single-operator event store.
Source: [Guidelines 02/2025 v2.0](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf), adopted 7 July 2026.

Golo Roden, 30 April 2026, says a global email aggregate stops working at large scale, and that a whole-log precondition on the write path grows with the log. The email-as-subject model breaks when addresses change. The article usually recommends reservation, with release, expiry, and compensation, because the reservation and the registration are not one transaction. It does not present either pattern as the one answer.
Source: [Email uniqueness in event sourcing](https://www.eventfoundation.io/resources/blog/email-uniqueness-in-event-sourcing), 30 April 2026.

Jeremy Miller, 11 August 2026, describes Marten and Polecat putting the read model in the same database transaction as the append, applying the not-yet-projected tail in memory (`FetchLatest`), or waiting until the async daemon reaches the high-water mark. The "no wait API, poll a log position" recipe is stated for KurrentDB. The same article gives Axon and Chronicle different answers, so it is not a general recipe for a read model in another database.
Source: [Event sourcing without the eventual consistency tax](https://jasperfx.net/news/strong-consistency-event-sourcing-marten-polecat), 11 August 2026.

An IETF idempotency-key draft (15 October 2025, expired 18 April 2026, not an RFC) was read and not used. It does not discuss keys derived from an upstream event id.

### 5. Frontend state as pure machines with story tests

This thread did not survive the run. The researcher returned six claims. The workflow keeps at most 24 candidates, and these six were the ones cut before verification. They are leads, not findings. Dates below are what that researcher reported. Nobody opened the pages again.

Elm's `update` is `Msg -> Model -> (Model, Cmd Msg)`. The command later comes back as a message. The guide's view is Elm `Html`, not React.
Lead: [HTTP · An Introduction to Elm](https://guide.elm-lang.org/effects/http), inspected 13 November 2026, no publication date on the page.

Foldkit v0.170.0 is that loop on Effect Schema: one update returns commands, and story tests do not touch the DOM. The homepage tells React-ecosystem apps not to take Foldkit as their framework. `Command.expectExact` fails when an interaction produces an unexpected command. The test supplies the result message. Neither Story nor Scene runs a browser.
Lead: [Foldkit](https://foldkit.dev/) and [Scene](https://foldkit.dev/testing/scene), v0.170.0, inspected 13 November 2026, no calendar date.

XState v6 beta, announced 5 November 2026, is the React-keeping library in this set whose transition is a pure `(state, event) => [nextState, effects]`. `enq` records effects. The actor runs them after the next state is calculated. `xstate simulate` does not execute effects. The announcement does not document a story that fails on an unexpected effect.
Lead: [Announcing XState v6 beta](https://stately.ai/blog/2026-11-05-xstate-v6-beta), 5 November 2026.

Effect Atom v4 is a registry of reactive values. The registry starts effects and streams. The API reference does not define one pure screen update from a tagged message to the next state plus an intent list. It is marked unstable, since v4.0.0.
Lead: [Atom API reference](https://effect.website/docs/v4/api/effect/reactivity/Atom), inspected 13 November 2026, no calendar date.

Redux forbids side effects inside reducers and points reactive work at RTK listener callbacks, so the reducer does not return an intent list. Zag.js is a per-widget state-machine toolkit. Storybook play functions run after render against the canvas DOM.
Lead: [Side effects approaches](https://redux.js.org/usage/side-effects-approaches), inspected 13 November 2026, no date shown. Zag and Storybook were inspected and were not the cited claim.

## What the proposal should change

Ranked. Each item is a change to the proposal as written.

1. Name Alchemy's pool as the host. A `Domain.Model` reaches Durable Objects through `@alchemy.run/domain` Effect Cluster on `@alchemy.run/effect-cluster`'s `DurableObjectPool` (PRs 3143 and 3276, 7 and 12 November 2026). `@effect/platform-cloudflare` is experimental, its Alchemy deploy helper has no verified live smoke, and beta.87 does not depend on it. Stop writing the two as interchangeable hosts for the model.

2. Delete the sentence that cluster hosting of the model is unproven. Alchemy's PRs describe Cloudflare local and live conformance and a Durable Object bank integration. The thing that is unproven is the Effect package's own Alchemy smoke. Say that, and nothing wider.

3. Rewrite the sketches that disagree with beta.87. A policy that sends a command supplies the actor itself. The ports union is built from `ExternalSystemKey`, not the class. A saga activity declares its error schema and does not return a receipt. `Story.saga` completed carries a `result`. A singleton yielded from the stack uses the props-plus-implementation form. The name-only tag is a `Layer`.

4. Split the agent run from the aggregate's life. Prakash, 10 November 2026: a long-lived entity workflow and a process workflow that finishes one piece of work are different things, and admission stays in code. Temporal's history caps kill an ever-appending execution. An agent run is a process workflow that continues as new. Human approval is a signal the workflow waits on, as in Temporal's recipe last updated 21 October 2026. The proposal's durable deferred is the right shape. The proposal's habit of letting that run grow with the aggregate is not.

5. Keep a person who can deny a tool call. MCP, 25 November 2025, says so, and says servers apply access controls and clients confirm sensitive calls and log them. Machine-checked laws replace the architecture review gate. They do not replace that denial. The saga's human decision is the denial, and it stays mandatory for any tool that changes the world.

6. Give coding agents a generated TypeScript API in a sandbox with no general network and no keys. That is Cloudflare Code Mode, 26 September 2025. One MCP tool per command is the surface for an operating agent who is still subject to the deny path. It is the wrong surface for the agent that writes the code.

7. Write the consistency boundary as the entity id, meaning one aggregate instance. Akka, retrieved 13 November 2026. The bounded context is not that boundary, and neither is the `Domain.Model`. Cross-instance rules stay a process or a reaction. Do not colocate unrelated aggregates on one object to make a transaction appear.

8. Make an invariant append conditional on the stored version. Orleans, updated 15 November 2025: one turn at a time does not stop two instances accepting conflicting events. The commit of events, state, and the idempotency receipt has to fail when the stored version has moved. Single-threaded execution is not that check.

9. Replace the widen-only stored-contract law with Axon 5.4's split. Leave the stored bytes alone. Payload conversion covers added defaults, removals, renames, and compatible type changes. A change conversion cannot express is one read-time transformation per version step. A new event tag is for a new fact, not for every rename.

10. Split the command id from authenticity. An id derived from the upstream event id dedupes that delivery, which is what Standard Webhooks 1.0.0 says an id is for. Authenticity is a signature over the id, a timestamp, and the body, and the timestamp tolerance is the replay bound. A stable id is not a capability.

## Ideas the proposal has not considered

Continue-as-new. The proposal has sagas and an event log. It has no cap on how long one execution's history may grow, and no rule for starting a fresh execution that carries the state forward. Temporal's numbers are the concrete forcing function. Any workflow engine with a history page will grow the same wart.

Two workflows, not one saga type used for both. Prakash separates the entity that lives as long as the aggregate from the process that finishes one piece of work, including the wait for a person. The proposal puts the agent run, the aggregate, and the live session into one cluster story. The session entity can hold the conversation. The run that waits for approval is the process. They should not share one ever-growing history.

Code Mode. The proposal derives MCP, a toolkit, and a CLI from `Domain.Api`, and stops. The 2025 Cloudflare account says the model should write code against that API inside a sandbox that holds bindings and nothing else. The generated client the web package already wants is the same artifact, pointed at a sandbox.

Conditional append. The proposal's one transaction is necessary and, on Orleans' evidence, not sufficient once two copies can both decide. The version predicate belongs in the host contract the standard states, whoever implements the pool.

Axon conversion as the evolution mechanism the widen-only law forbids. Renames and field removals are normal. The proposal currently sends every one of them to a new event tag. That forks the language `evolve` has to understand. Conversion plus a version-step transform keeps one event name and still leaves the log untouched.

The 6 November 2026 leftovers on effect-cluster: durable entity state, HTTP routes for callers that are not Effect, and an EC2 pool. If entity state is still missing, "the platform commits events, state, and the receipt together" is ahead of the pool the proposal wants to sit on. This was a TODO on the merge day. It was not rechecked.

A signature next to the idempotency key. The proposal derives command ids from upstream ids and treats that as the redelivery story. It never says who is allowed to present that id.

XState v6's pure transition, announced 5 November 2026, which returns effects the actor runs after the state is calculated. That is the same shape as the proposal's `update` plus intents, and it keeps React. It was not verified. Effect Atom is a different thing: a registry that runs effects, not a fold from a message to state and intents. Redux listeners are a third thing. If the hand-rolled fold stays, it should be because it matches the aggregate's `decide`/`evolve` and the story kit, which is a reason from inside the proposal. The outside evidence that would rank it was cut before verification.

## Open questions for the owner

Did `Cluster.EntityState`, HTTP routes for non-Effect callers, and the EC2 pool land after 6 November 2026? The host story depends on the first one.

Does the Effect Cluster commit already compare-and-swap the stream version, or can a restart or a failover append an invariant event twice? Orleans says the second case is the one that overdraws the account.

Is Axon 5's Dynamic Consistency Boundary, called experimental on 27 June 2025, now the way to model a rule that spans aggregate instances inside one context? The 15 October 2025 Axon 5.0 release note was not verified. Until it is, the proposal's "a cross-aggregate invariant is its own aggregate, or a saga that reserves and compensates" still stands, and Roden's 30 April 2026 account is the one that matches the saga half.

What request rate does one aggregate instance actually need on a Durable Object? The 5 November 2026 rules give approximate bands and forbid one global object. They do not require sharding a bounded context. The proposal's per-instance entity id already avoids the global object. The open point is whether one hot instance still blows the band.

Does "the event carries an id, the payload lives in a store" satisfy erasure? The EDPB text that was checked does not say key deletion ends identification, and it was written for blockchains. The proposal needs a source that covers a private log, or it should stop claiming erasure by construction.

Does `waitsFor` / `atLeast` actually wait, or does it only name a cursor the caller hopes the view has passed? Akka says the immediate read can be stale. Miller's general poll recipe was rejected. The mechanism has to be the platform's, and this run did not open Alchemy's view-delivery docs.

How does an agent `Domain.Api` audience become an RFC 8707 resource indicator? The MCP authorization spec requires audience binding and forbids token passthrough. It does not define least privilege as that binding. The proposal's audience list is not yet that control.

The frontend ranking is unanswered. The six leads above need a second pass that opens Elm, Foldkit 0.170, XState v6 beta, Effect Atom, Redux listeners, Zag, and Storybook play, and says which one the React machine should copy. Foldkit stays a pattern source. The homepage already tells React apps not to adopt the framework.

## Sources

Retained claims, in the order the run numbered them.

- [S1] `@effect/platform-cloudflare` 4.1.3 README and Effect PR 7322. https://raw.githubusercontent.com/Effect-TS/effect/refs/tags/@effect/platform-cloudflare@4.1.3/packages/platform/cloudflare/README.md — merge 10 November 2026, https://github.com/Effect-TS/effect/pull/7322
- [S2] alchemy PR 2924. https://github.com/alchemy-run/alchemy/pull/2924 — merged 6 November 2026
- [S3] alchemy PRs 3143 and 3276, domain and effect-cluster 2.0.0-beta.87. https://github.com/alchemy-run/alchemy/pull/3143 — merged 7 November 2026. https://github.com/alchemy-run/alchemy/pull/3276 — merged 12 November 2026
- [S4] `@alchemy.run/domain` 2.0.0-beta.87 `packages/domain/src/Policy.ts` and `ExternalSystem.ts`, read 13 November 2026. https://github.com/alchemy-run/alchemy
- [S5] Effect `packages/effect/src/workflow/Activity.ts` and domain 2.0.0-beta.87 `Saga`, `Aggregate`, and `Story`, read 13 November 2026. https://github.com/Effect-TS/effect
- [S6] `@alchemy.run/effect-cluster` 2.0.0-beta.87 `packages/effect-cluster/src/Singleton.ts`, read 13 November 2026, with PRs 3143 and 3276
- [S7] Akka state and read models. https://doc.akka.io/concepts/state-model.html — retrieved 13 November 2026
- [S8] Orleans replicated grains. https://learn.microsoft.com/en-us/dotnet/orleans/grains/event-sourcing/replicated-instances — last updated 15 November 2025
- [S9] Temporal events and event history. https://docs.temporal.io/workflow-execution/event — retrieved 13 November 2026
- [S10] Cloudflare Code Mode. https://blog.cloudflare.com/code-mode/ — 26 September 2025
- [S11] Kiran Prakash, long-horizon agents and durable execution. https://martinfowler.com/articles/durable-execution-agents.html — 10 November 2026
- [S12] Temporal human-in-the-loop recipe. https://docs.temporal.io/ai/cookbook/human-in-the-loop-python — last updated 21 October 2026
- [S13] MCP tools, specification 2025-11-25. https://modelcontextprotocol.io/specification/2025-11-25/server/tools — 25 November 2025
- [S14] Axon Framework 5.4 event versioning. https://docs.axoniq.io/axon-framework-reference/5.4/events/event-versioning/ — reference 5.4, read 13 November 2026
- [S15] Standard Webhooks 1.0.0. https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md — version 1.0.0, no revision date in the file

Pages the verifiers opened while rejecting a broader claim.

- Axon DCB post. https://www.axoniq.io/blog/dcb-in-af-5 — 27 June 2025
- Durable Object rules. https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ — last updated 5 November 2026
- KurrentDB 26.1. https://kurrentdb.kurrent.io/releases/kurrentdb/26-1/ — 4 May 2026
- MCP authorization. https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization — 25 November 2025
- Cloudflare Agents human-in-the-loop. https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/ — `dateModified` 27 October 2026
- Marten rebuilding projections. https://martendb.io/events/projections/rebuilding — read 13 November 2026
- EDPB Guidelines 02/2025 v2.0. https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf — adopted 7 July 2026
- Email uniqueness. https://www.eventfoundation.io/resources/blog/email-uniqueness-in-event-sourcing — 30 April 2026
- Strong consistency, Marten and Polecat. https://jasperfx.net/news/strong-consistency-event-sourcing-marten-polecat — 11 August 2026

Unverified frontend leads, cut before verification.

- https://guide.elm-lang.org/effects/http
- https://foldkit.dev/ and https://foldkit.dev/testing/scene — v0.170.0
- https://stately.ai/blog/2026-11-05-xstate-v6-beta — 5 November 2026
- https://effect.website/docs/v4/api/effect/reactivity/Atom
- https://redux.js.org/usage/side-effects-approaches
