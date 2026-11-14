# Proposal for Alchemy: a projection's backlog, from its platform

A proposal for `@alchemy.run/domain` (2.0.0-beta.87), not a patch. Not filed (D52). It is the
library call that would make the prototype's drain check (D47, D50) one line for any published
stream.

## What the check needs

Before a deploy closes a published stream's generation or gives it another writer, the outgoing
writer (a projection that lists the stream in `writes`) must have published everything it was
given. What it has not published waits in four places:

- deliveries to it staged in its sources' outboxes;
- deliveries of an event it consumes still on their way to a view it reads (followed through views
  that read views), which reach it once the view applies them;
- inputs its keys accepted into their logs and have not handled;
- its backfill run, while the run is not complete.

## What a reader outside the library has to do today

The prototype's reader, `shared/tooling/src/PublisherBacklog.ts` (`backlogOf`, `writerShapeOf`),
counts those from the Durable Object platform's rows. Every rule it relies on is a private detail
of `DurableObjects.ts` and `Kernel.ts`:

- an instance's outbox rows are `outbox:<12-digit seq>`, each a `Delivery` naming its target, key,
  source, `seq` and tag (`queue`, line 396; the aggregate's outbox at 823, the view's at 1042), and a
  row is deleted only after its delivery returns, so a delivery already taken in can still be
  staged;
- a projection key's progress is its `meta` row, `accepted`, `processed` and `intake` (the last
  `seq` taken per source) (`ProjectionMeta`, line 1311), and a view key's is its `snapshot` row's
  `checkpoints` (`Platform.ts`, `ViewSnapshot`, line 302);
- a consumer's storage class is `consumerClass(kind, name, generation)` (line 345), except that a
  view rebuilt in place keeps generation 0 (`Kernel.ts`, `classGenerationOf`, line 752) while its
  deliveries carry its generation;
- a backfill run keeps its phase at `<class>Run/~run` under `run:<encoded target>` (`RUN_ROOT`,
  line 771; `Backfill.ts`, line 1986).

Any release may change these. The in-memory platform keeps all of it out of reach: its queue is a
closure-local array of effects with labels (`InMemory.ts`, line 137), its projection partitions are
closures too, `Control` exposes `idle` and `drain` only, and `Model.Internals` exposes the
aggregate, view and stream stores. So the reader cannot run in memory at all; the prototype's
in-process comparison (`conformance/test/HandoverBacklog.test.ts`) runs it on the Durable Object
platform over an in-process host instead.

## The change

Add the backlog to `Projection.Progress`, beside `history` and `caughtUp`
(`Projection.ts`, line 107):

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
backfill run already builds), the in-memory platform from its queue and partitions. The drain check
then reads, for each handover:

```ts
const backlog = yield* writer.Progress.pipe(Effect.flatMap((progress) => progress.backlog));
```

## Why it is safe

- Read only. It adds a member to a service the platforms already provide.
- It answers with counts, not rows, so no layout leaves the library.

## Tests it needs

- In memory and on each Durable Object host: a projection held in its handler, with a decision
  committed upstream of it, reports one pending; after the handler is released and the input
  handled, none.
- A delivery taken into a key's log whose outbox row has not been deleted yet counts once.
- A view rebuilt in place (version bumped, keyed by the one aggregate it reads) is read from the
  storage it kept.
- A projection whose backfill run is not complete reports `runComplete: false`.

The prototype's agreement with Party's own query: in process (held, one pending by both; drained,
none by both) and on the cluster over phase 6's data (drained, and with a decision undelivered:
`notes/phase-11.md`).
