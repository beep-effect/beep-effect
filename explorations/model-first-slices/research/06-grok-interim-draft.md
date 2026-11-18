# Verdict

One `Domain.Model` per bounded context, with the host swapped as one Layer, is what Alchemy shipped on 12 November 2026. The Effect Cluster Postgres host is the one that commits one aggregate's command, events, state, and reply together. Cloudflare backfills during the deploy, caps each object, and Effect's own Durable Object package is still experimental. Keep the agent outside the log: schema-described tools, a person who can deny the call, a recorded pausable run, and checks on intermediate steps. Change event meaning on the read path. Erasure, cross-aggregate invariants, and projection read-your-writes sit outside that single-aggregate commit. A React screen can be tested as a pure update, and the story kit this proposal borrows is not built.

Status of this pass: partial. The gaps are listed under Coverage. Nothing here was re-run against the Party prototype.

Reviewed 2026-11-13. Sources are public pages and the local proposal. Searches named the technologies only.

## Findings by thread

### 1. Alchemy domain, Effect Cluster, Cloudflare

As of Alchemy 2.0.0-beta.87 on 12 November 2026, one `@alchemy.run/domain` model runs unchanged on Cloudflare Durable Objects, Rivet, or Effect Cluster by swapping one host Layer. Watch and events are pushed over WebSockets on every platform, including `Domain.InMemory`.
Source: [2.0.0-beta.87](https://alchemy.run/blog/2026-11-12-beta-87/), 12 November 2026.

`@alchemy.run/effect-cluster` deploys entities, singletons, crons, and workflows as a database Layer plus a pool Layer on Docker, AWS, GCP, Fly, Hetzner, and Kubernetes. `ClusterCloudflare.DurableObjectPool` uses no database and no shards, because each instance is one Durable Object and every entity type shares one Durable Object class. Every host passes the same 20 conformance cases.
Source: [Effect Cluster on Cloudflare](https://alchemy.run/cluster/cloudflare/), read 13 November 2026, checked against the same beta.87 post.

On the Effect Cluster host, commands to one aggregate run one at a time. Its events, new state, and reply commit in one Postgres transaction or not at all. Consumers get each source's events at least once and in order. A deploy that adds or versions a view or projection does not wait for history. The first call after the deploy starts the backfill.
Source: [Effect Cluster (Alchemy Domain)](https://alchemy.run/domain/effect-cluster/), read 13 November 2026.

On Cloudflare the deploy itself backfills new or rebuilt views and projections and waits, 30 minutes by default, then raises `BackfillStillRunning`. A measured million-account run held about 2,000 keys a second and finished in 8 minutes. One object handles about 1,000 requests a second and stores up to 10 GB.
Source: [History at scale](https://alchemy.run/domain/backfill/), read 13 November 2026.

`@effect/platform-cloudflare` landed as experimental Cloudflare Cluster support in 4.1.3 on 10 November 2026. It maps one entity instance to one SQLite Durable Object and warns that APIs may change in patch releases. The live Alchemy deploy smoke has not been verified. A `ClusterCron` never fires until a Cron Trigger wakes its seed singleton. Stream asks with a future `DeliverAt`, and park-and-replay caller hibernation, are outside v1.
Source: [@effect/platform-cloudflare README](https://github.com/Effect-TS/effect/blob/main/packages/platform/cloudflare/README.md), Effect main, read 13 November 2026. The 4.1.3 date was read on newreleases.io. The published npm tarball was not opened.

After a deploy, kept-alive entities keep running the old code for about five minutes and then die without warning. Recovery takes about those five minutes plus one `keepAliveHeartbeat` interval, 30 seconds by default.
Source: same README, Restarts and recovery, [raw](https://raw.githubusercontent.com/Effect-TS/effect/main/packages/platform/cloudflare/README.md), read 13 November 2026.

The beta.87 line "Hibernatable WebSockets are coming soon" is about Rivet 3. It is not a statement about `@alchemy.run/domain`, `@alchemy.run/effect-cluster`, or `@effect/platform-cloudflare`.

### 2. What event-sourced actors learned the hard way

Akka Persistence and Apache Pekko keep stored events immutable and usually undeleted. They evolve them by promoting old events to the latest view during recovery. Pekko's `EventAdapter` splits one stored composite event into finer events only on that read path.
Source: [Schema Evolution for Event Sourced Actors](https://doc.akka.io/libraries/akka-core/current/persistence-schema-evolution.html), current Akka docs, read 13 November 2026. The same recovery-time split is in the current Apache Pekko docs.

Axon Framework 5 leaves stored events in serialized form and converts each payload to the handler's expected type at handling time. Adding fields with defaults, removing fields, renaming with annotations, and changing compatible field types need no upcaster and do not rewrite the log.
Source: [Event Versioning (Axon Framework 5.4)](https://docs.axoniq.io/axon-framework-reference/5.4/events/event-versioning/), read 13 November 2026. That page stops at payload conversion. This pass does not claim the older chained revision-to-revision upcaster is still the current API.

On KurrentDB, deleting or expiring events removes them from ordinary stream reads and leaves them visible on `$all` until a destructive scavenge runs on every node. A positive scavenge threshold can leave deleted events in place.
Source: [Scavenging (Kurrent v26.0)](https://docs.kurrent.io/server/v26.0/operations/scavenge), read 13 November 2026. A current streams page was not re-read, so this pass does not claim that selective deletion from the middle of a stream is unsupported.

Orleans grain persistence makes one state-record write atomic. Writes to two records, to different grains, or a write plus an external message are separate. Multi-grain atomicity needs Orleans transactions. Storage plus messaging needs an outbox, an inbox, or an idempotency protocol.
Source: [Grain persistence (Microsoft Orleans)](https://dotnet.github.io/orleans/docs/grains/grain-persistence/), read 13 November 2026.

Marten gives read-your-writes for an inline projection by applying it inside the same database transaction as the event append, at `SaveChanges`. An async projection does that later.
Source: [Inline Projections (Marten)](https://martendb.io/events/projections/inline), read 13 November 2026.

A claim that a new async projection version re-emits side effects because catch-up replays history was excluded by verification. Rebuild mode replays through the prior progression mark and suppresses `RaiseSideEffects()`. That claim is not used below.

Temporal replay patching, Restate's `ctx.run` journal, Convex serializable OCC, LiveStore's forward-compatible event schemas, Durable Objects' single-threaded private storage, Electric's write path, and Rivet's per-actor state were on pages opened during the pass and are outside the claims above. Electric now resolves to electric.ax. The portion inspected only indexes online writes and optimistic state. Rivet's state documentation was not opened.

### 3. Agent-native architecture in 2026

MCP revision 2026-07-28 models tools as model-controlled capabilities. Each tool is uniquely named and described by a JSON Schema `inputSchema` (2020-12 by default) and an optional `outputSchema`. The protocol does not mandate a user-interaction model. It says there SHOULD always be a human who can deny a tool invocation, and that clients SHOULD confirm sensitive calls, show inputs before the call, and log tool usage for audit.
Source: [Tools, Model Context Protocol 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), 28 July 2026.

The MCP Agents Interest Group charter, fetched the same day, says durable execution, capability discovery, delegation, and multi-turn interaction are still ad hoc above ordinary tools. An Agents Extension was still under evaluation. Core MCP is not itself a durable agent-run standard.

The OpenAI Agents SDK pauses a run when a tool needs approval and resumes later from the same serialized `RunState`, including after the process has stopped. If approval is required and no decision is stored, the tool does not execute.
Source: [Human-in-the-loop, OpenAI Agents SDK](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/), read 13 November 2026.

Tracing is enabled by default and records an end-to-end trace whose spans include model generations, function tool calls, handoffs, and guardrails. It is unavailable for Zero Data Retention organizations, and it can be disabled. The default span record is not a universal authorization audit log.
Source: [Tracing, OpenAI Agents SDK](https://openai.github.io/openai-agents-python/tracing/), read 13 November 2026.

LangGraph models a durable agent run as a thread of checkpointer snapshots and requires that checkpointer for human-in-the-loop and fault recovery. `exit` persists only when execution leaves, including on a human interrupt, and cannot recover a mid-run crash. `async` writes during the next step and leaves a crash window. `sync` persists before the next step starts. An in-memory saver does not survive process restart.
Source: [Checkpointers, LangGraph](https://docs.langchain.com/oss/python/langgraph/checkpointers), read 13 November 2026.

SWE-CC, a paper dated 5 October 2026, turns contributor documentation from 12 repositories into 823 machine-checkable atomic policies, each a deterministic checker, and audits both agent runtime behavior and the final deliverable. On 500 SWE-bench Verified tasks, agents violate 43.1 percent of applicable project policies, and nearly half of those violations happen during intermediate steps. This is a benchmark of repository contribution docs. It is not evidence that a production vendor runtime encodes its own product architecture as machine-checked laws.
Source: [SWE-CC, arXiv:2610.06193](https://arxiv.org/abs/2610.06193), 5 October 2026.

### 4. Pure screen updates beside React

Foldkit Story tests call a pure `update` directly. They start from a Model, send Messages, and keep Commands as data until the test supplies result Messages. Neither Story nor Scene runs a browser or the Effects inside Commands.
Source: [Story | Foldkit](https://foldkit.dev/testing/story), read 13 November 2026.

Foldkit is The Elm Architecture on TypeScript and Effect: one Model, Messages, a pure update, and a view. It is not a React state library.
Source: [Coming from React | Foldkit](https://foldkit.dev/react/coming-from-react), read 13 November 2026.

Maple's production web app left React for Foldkit in October 2026, 287,000 lines across 131 routes. Its founder reports more than 1,200 Scene and unit tests that need no DOM, with a Scene test that runs `update` in Node. Maple's test files were not inspected. Maple's post attributes DOM-free update testing to Scene tests, while Foldkit's own docs assign calling `update` directly to Story and the rendered view to Scene.
Source: [Porting 287,000 lines of React in 3 days](https://maple.dev/blog/react-to-foldkit/), October 2026.

XState v6 keeps pure machine checks separate from React rendering. `initialTransition` and `transition` run no effects and start no children. Each returns a `[snapshot, actions]` tuple. React tests should assert what is on screen. A release note stating whether that API is stable was not opened.
Source: [Test XState logic](https://stately.ai/docs/xstate/v6/testing), v6 docs, read 13 November 2026.

AWS Amplify UI's production authenticator is an XState machine whose unit tests interpret a running service, send events, and assert snapshots, with actions replaced by Jest mocks. They are not pure transition calls and are not named story tests.
Source: [amplify-ui authenticator machine tests](https://github.com/aws-amplify/amplify-ui/blob/main/packages/ui/src/machines/authenticator/__tests__/index.test.ts), read 13 November 2026.

No page inspected declares one current best pattern for React state that is both a pure machine and verified by tests named stories.

The 13 November 2026 proposal keeps React and borrows only Foldkit's story pattern: screen state is a schema, events are tagged messages, one pure function returns the next screen and a list of intents, and a story test checks that sequence with no DOM. The proposal itself describes the screen-story test kit as not existing.
Source: [PROPOSAL.md](./01-proposal.md), 13 November 2026.

## What the proposal should change

Ranked. Each item is a change to the 13 November proposal, grounded in the findings above.

1. **Name Postgres Effect Cluster as the atomicity host.** The proposal's "the app picks the pool" is right as a package boundary and wrong as a commit boundary. On Effect Cluster, one aggregate's events, new state, and reply commit in one Postgres transaction, and a new projection backfills on first call after deploy. On Cloudflare the deploy itself waits on backfill, each object has hard throughput and size caps, and Effect's Durable Object package is experimental, with old code surviving about five minutes after a deploy. Write those as two host laws. A slice still names no cloud. The standard names which host law a conformance test must pass.

2. **Keep the agent as a caller with a pausable run.** The field's working shape is a schema-described tool surface, a human who can deny the call before it runs, a serialized run that can resume after the process stops, and checks on intermediate steps as well as the result. `by: Actor` on each event is provenance. An agent saga inside the model can be the run. The agent's authority is the approval decision and the tool contract, not membership in the log. MCP's own charter still treats durable execution as ad hoc above ordinary tools, so `toMcp` is the tool surface and not the durability story. LangGraph's `sync` mode is the crash rule worth copying: persist before the next step starts. `exit` loses a mid-run crash.

3. **Put schema evolution on the recovery path, and say which changes that path can do.** Akka and Pekko promote old events during recovery and can split one stored event into finer events only there. Axon 5 converts the stored payload to the handler's type at handling time, so additive fields, removals, renames, and compatible type changes do not rewrite the log. The proposal should state that list as the decode-on-read budget, and require an explicit adapter, still on the read path, for a split or an incompatible change. A migration that rewrites stored events is the thing these systems refused.

4. **Write the three boundaries a single-aggregate commit does not cross.** Erasure: Kurrent still serves deleted events on `$all` until a destructive scavenge runs on every node, and a positive threshold can leave them. Cross-aggregate work: Orleans makes one record atomic, and a second record, a second grain, or an external message needs transactions or an outbox, inbox, or idempotency protocol. Read-your-writes: Marten gets it by applying an inline projection inside the append transaction. An async projection does not. The standard should say, per view, whether that view is inline in the command transaction or caught up later.

5. **Build the React story kit as a pure update test, and keep the DOM test separate.** Foldkit Story calls `update` with commands left as data. Foldkit is not a React library, and the one production port that reports this testing style left React. XState v6 runs `transition` with no effects and tells React tests to assert the screen. The proposal can keep React. The kit it describes does not exist, and no current React codebase supplies a pattern named stories that is also a pure machine. Ship the pure-update test. Assert the rendered tree in a different test.

## Ideas the proposal has not considered

- **Code skew after a Cloudflare deploy.** Kept-alive entities run the old code for about five minutes and then die. Recovery is that interval plus one heartbeat. A rolling reader can observe two versions of one entity type without a migration.
- **Cron on Cloudflare needs a wake.** A `ClusterCron` does not fire until a Cron Trigger wakes its seed singleton. "Schedule on the model" still needs a platform trigger on that host.
- **Future `DeliverAt` and caller hibernation are outside Effect's Cloudflare v1.** A saga that parks until a deadline and expects the caller to hibernate is a Postgres-host feature until that README changes.
- **Approval that survives process death.** The OpenAI Agents SDK resumes a paused tool call from a serialized `RunState`. A saga checkpoint that only exists while the process lives is a weaker form of the same idea.
- **Intermediate-step checkers.** SWE-CC found that nearly half of the policy violations on 500 tasks happened before the final deliverable. A law that runs only on the merged result misses the step where the agent already broke it. The paper is a benchmark, so the idea is the checker shape, not a claim that a vendor product already does this.
- **Idempotency for the message that leaves the aggregate.** The single-aggregate transaction covers the domain receipt. Orleans' hard lesson is the next write: another aggregate, or an external system, is a different protocol.
- **The Rivet sentence in the beta.87 post.** "Hibernatable WebSockets are coming soon" is Rivet 3. Treating it as an Alchemy domain roadmap item mis-assigns the work.

## Open questions for the owner

- Which host must pass the atomicity law for v1: Postgres Effect Cluster alone, or Cloudflare as well?
- Is erasure in scope for the log? If a person can demand deletion, `$all` plus scavenge is the mechanism to design, and a positive scavenge threshold leaves data behind.
- Which invariants cross two aggregates, and which of those also send an external message?
- Which views must reflect the command that just committed, in the same reply the caller sees?
- Where does a human denial sit relative to the agent saga: before the tool effect is journaled, or after?
- Does a screen story assert only the pure update and its intents, with a second test for the React tree?

## Coverage

- No dated public feature roadmap for `@alchemy.run/effect-cluster` was found beyond the 12 November 2026 beta.87 surface and the current Cloudflare limits.
- The research pass reported this checkout's `@alchemy.run/domain` pin as 2.0.0-beta.86 against public beta.87 docs, and did not re-test that pin. The proposal header says the Party prototype is on 2.0.0-beta.87. Those are different trees. This file does not resolve them.
- The experimental README was read from Effect main. The 4.1.3 note was read on newreleases.io. The published npm tarball was not opened.
- Axon 5.4 was not checked for a surviving chained upcaster. Kurrent selective mid-stream deletion was not re-checked. Cloudflare Agents' state page was not treated as a read-your-writes claim. Electric and Rivet state docs were not established.
- XState v6 `transition` stability was not confirmed against a release note. Amplify's live tests still `interpret` a service. Maple's test files were not opened.
- Author and early-user posts on X, GitHub issues, and Discord were in the question and are thin in the surviving claims. The claims above are from the primary docs that the pass could cite. Where a social source did not survive into a claim, it is absent here on purpose.

## Sources

- [S1] 2.0.0-beta.87, 12 November 2026. https://alchemy.run/blog/2026-11-12-beta-87/
- [S2] Effect Cluster on Cloudflare, read 13 November 2026. https://alchemy.run/cluster/cloudflare/
- [S3] Effect Cluster (Alchemy Domain), read 13 November 2026. https://alchemy.run/domain/effect-cluster/
- [S4] History at scale, read 13 November 2026. https://alchemy.run/domain/backfill/
- [S5] [S6] @effect/platform-cloudflare README, Effect main, read 13 November 2026. https://github.com/Effect-TS/effect/blob/main/packages/platform/cloudflare/README.md
- [S7] Schema Evolution for Event Sourced Actors, current Akka docs, read 13 November 2026. https://doc.akka.io/libraries/akka-core/current/persistence-schema-evolution.html
- [S8] Event Versioning, Axon Framework 5.4, read 13 November 2026. https://docs.axoniq.io/axon-framework-reference/5.4/events/event-versioning/
- [S9] Scavenging, Kurrent v26.0, read 13 November 2026. https://docs.kurrent.io/server/v26.0/operations/scavenge
- [S10] Grain persistence, Microsoft Orleans, read 13 November 2026. https://dotnet.github.io/orleans/docs/grains/grain-persistence/
- [S11] Inline Projections, Marten, read 13 November 2026. https://martendb.io/events/projections/inline
- [S12] [S13] Tools, Model Context Protocol 2026-07-28. https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- [S14] Human-in-the-loop, OpenAI Agents SDK, read 13 November 2026. https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- [S15] Tracing, OpenAI Agents SDK, read 13 November 2026. https://openai.github.io/openai-agents-python/tracing/
- [S16] Checkpointers, LangGraph, read 13 November 2026. https://docs.langchain.com/oss/python/langgraph/checkpointers
- [S17] SWE-CC, 5 October 2026. https://arxiv.org/abs/2610.06193
- [S18] Story, Foldkit, read 13 November 2026. https://foldkit.dev/testing/story
- [S19] Coming from React, Foldkit, read 13 November 2026. https://foldkit.dev/react/coming-from-react
- [S20] Porting 287,000 lines of React in 3 days, October 2026. https://maple.dev/blog/react-to-foldkit/
- [S21] Test XState logic, v6 docs, read 13 November 2026. https://stately.ai/docs/xstate/v6/testing
- [S22] amplify-ui authenticator machine tests, read 13 November 2026. https://github.com/aws-amplify/amplify-ui/blob/main/packages/ui/src/machines/authenticator/__tests__/index.test.ts
- [S23] Model-First Slices proposal, 13 November 2026. `scratchpad/model-first-slices/PROPOSAL.md`
