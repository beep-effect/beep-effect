<!-- Draft of a new issue (feature request). Not posted. File it after the published-stream issue, which motivates it. -->

**Title:** `domain: expose a projection's backlog on Projection.Progress`

Before a deploy closes a published stream, or gives the stream another writer, the outgoing writer (a projection that lists the stream in `writes`) must have published everything it was given. Today nothing in the public API says whether it has. `Projection.Progress` has `history` and `caughtUp(receipt)` (`packages/domain/src/Projection.ts:107`). Both wait for a write you already know about. Neither says what is still pending.

What a projection has been given and not yet handled waits in four places:

- deliveries to it staged in its sources' outboxes;
- deliveries of an event it consumes, still on their way to a view it reads (and to views that view reads), which reach it once the view applies them;
- inputs its keys accepted into their logs and have not handled;
- its backfill run, while the run is not complete.

A reader outside the library can count these only from the Durable Object platform's rows, and every rule it relies on is private:

- outbox rows are `outbox:<seq>` and are deleted only after their delivery returns, so a delivery already taken in can still be staged;
- a key's progress is in its `meta` row (`accepted`, `processed`, `intake`), and a view key's in its snapshot's `checkpoints`;
- a consumer's storage class is `consumerClass(kind, name, generation)`, except that a view rebuilt in place keeps generation 0 (`Kernel.ts`, `classGenerationOf`) while its deliveries carry its generation;
- a backfill run keeps its phase under `run:<target>` (`Backfill.ts`).

The in-memory platform keeps all of this in closures (`InMemory.ts:153`), and `Control` exposes only `drain` and `idle` (`InMemory.ts:66`), so a reader can't be written there at all.

We wrote such a reader against the Durable Object rows for a projection that reads a view and publishes one fact per decision. We compared it three times with a query specific to that model ("decided claims whose fact the stream lacks"): once in process, and twice on Effect Cluster with PostgreSQL (a restored dump with a delivery staged, and a running stack with the view held on a row lock). The two agreed every time, reporting one pending delivery while it was held and none once it drained. But the reader had to learn the in-place rule and the "already taken in" rule from the source, and any release may change them.

### Proposal

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
  // ...history, caughtUp
  /** What the projection has been given and has not yet handled, read from the platform. */
  readonly backlog: Effect.Effect<Backlog>;
}
```

Each platform would answer from what it already stores:

- the Durable Object platform from the rows above (on Effect Cluster one SQL query; on Cloudflare and Rivet through the instance index the backfill run already builds);
- the in-memory platform from its queue and partitions.

A drain check before a handover then becomes one line:

```ts
const backlog = yield* writer.Progress.pipe(Effect.flatMap((progress) => progress.backlog));
```

It is read-only, and it answers with counts, not rows, so no storage layout leaves the library.

Cases it would need:

- On each platform, a projection held in its handler with a decision committed upstream reports one pending, and none once it handles the input.
- A delivery taken into a key's log, whose outbox row is not yet deleted, counts once.
- A view rebuilt in place is read from the storage it kept.
- A projection whose backfill run is not complete reports `runComplete: false`.
