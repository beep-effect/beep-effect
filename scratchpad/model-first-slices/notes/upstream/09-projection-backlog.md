# Proposal: a projection's backlog, from its platform

For alchemy `packages/domain` at 33c10dd (2.0.0-beta.87). A proposal, not a patch: the library call
that would make a "has this publisher drained?" check one line for any published stream.

## What happens

Before a deploy closes a published stream's generation, or gives it another writer, the outgoing
writer (a projection that lists the stream in `writes`) must have published everything it was
given. What it has not published waits in four places:

- deliveries to it staged in its sources' outboxes;
- deliveries of an event it consumes still on their way to a view it reads (followed through views
  that read views), which reach it once the view applies them;
- inputs its keys accepted into their logs and have not handled;
- its backfill run, while the run is not complete.

The library exposes none of this. `Projection.Progress` (`Projection.ts`) has `history` and
`caughtUp(receipt)`, which wait for a known write; neither says what is pending. A reader outside
the library has to count it from the Durable Object platform's rows, and every rule it relies on is
private to `DurableObjects.ts` and `Kernel.ts`:

- an instance's outbox rows are `outbox:<12-digit seq>`, each a `Delivery` naming its target, key,
  source, `seq` and tag (`queue`; the aggregate's outbox and the view's), and a row is deleted only
  after its delivery returns, so a delivery already taken in can still be staged;
- a projection key's progress is its `meta` row, `accepted`, `processed` and `intake` (the last
  `seq` taken per source) (`ProjectionMeta`), and a view key's is its `snapshot` row's
  `checkpoints` (`Platform.ts`, `ViewSnapshot`);
- a consumer's storage class is `consumerClass(kind, name, generation)`, except that a view rebuilt
  in place keeps generation 0 (`Kernel.ts`, `classGenerationOf`) while its deliveries carry its
  generation;
- a backfill run keeps its phase at `<class>Run/~run` under `run:<encoded target>` (`RUN_ROOT`;
  `Backfill.ts`).

Any release may change these. The in-memory platform keeps all of it out of reach: its queue is a
closure-local array of effects (`InMemory.ts`, `pending`), its projection partitions are closures
too, `Control` exposes `idle` and `drain` only, and `Model.Internals` exposes the aggregate, view
and stream stores. A reader cannot run there at all.

## Evidence

A reader written against the rows above, for a projection that reads a view and publishes a fact per
decision, agreed with a query specific to that model ("decided claims whose fact the stream lacks")
in every comparison:

| Where | Held or undelivered | Drained |
| --- | --- | --- |
| The Durable Object platform over an in-process host, the publisher held in its handler | 1 and 1 | 0 and 0 |
| Effect Cluster with PostgreSQL, a dump restored with the runners stopped, a decision added with its delivery staged (never committed) | 1 and 1 | 0 and 0 |
| Effect Cluster, the previous version of the model running, its review view held on a row lock while a claim was decided | 1 and 1 | 0 and 0 |

It had to learn the in-place rule and the "already taken in" rule from the source, and it cannot be
written for the in-memory platform.

## Proposed change

Add the backlog to `Projection.Progress`, beside `history` and `caughtUp`:

```ts
export interface Backlog {
  /** Deliveries to the projection staged in its sources' outboxes, not yet taken in. */
  readonly staged: number;
  /** Deliveries of an event it consumes staged for a view it reads, not yet applied. */
  readonly throughViews: number;
  /** Inputs its keys accepted and have not handled. */
  readonly unprocessed: number;
  /** Whether its backfill run, if it has one, is complete. */
  readonly runComplete: boolean;
}

export interface Progress {
  // ...
  /** What the projection has been given and has not yet handled, read from the platform. */
  readonly backlog: Effect.Effect<Backlog>;
}
```

Each platform implements it from what it already stores: the Durable Object platform from the rows
above (on Effect Cluster one SQL query; on Cloudflare and Rivet through the instance index the
backfill run already builds), the in-memory platform from its queue and partitions. A drain check
then reads, for each handover:

```ts
const backlog = yield* writer.Progress.pipe(Effect.flatMap((progress) => progress.backlog));
```

Read only; it adds a member to a service the platforms already provide, and it answers with counts,
not rows, so no layout leaves the library.

### Tests it needs

- In memory and on each Durable Object host: a projection held in its handler, with a decision
  committed upstream of it, reports one pending; after the handler is released and the input
  handled, none.
- A delivery taken into a key's log whose outbox row has not been deleted yet counts once.
- A view rebuilt in place (version bumped, keyed by the one aggregate it reads) is read from the
  storage it kept.
- A projection whose backfill run is not complete reports `runComplete: false`.
