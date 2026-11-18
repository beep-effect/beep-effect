# Issue: a rebuilt projection's first appends to its stream are dropped

For alchemy `packages/domain` at 33c10dd (2.0.0-beta.87).

A projection rebuilt by a version bump (its own, or that of a view it reads) has its appends
silently dropped by the stream it writes, until its input positions pass the old generation's.

## What happens

A stream entry records the writer's position as `origin`: the input's place in the projection key's
input log and the append's index within that input (`Model.ts`, `append`:
`[meta.position, meta.appends]`). The stream keeps the last `origin` in its meta and ignores a write
that is not after it, so a replayed or redelivered input appends nothing twice
(`DurableObjects.ts`, `streamObject.append`: `if (!isAfter(write.origin, meta.origin)) return;`;
the same in `InMemory.ts`).

A projection's generation is its Layer `version` plus the versions of every view in its `from`
(`Kernel.ts`, `generationOf`). When the generation changes, the projection is rebuilt: a new
consumer class with a new input log, which starts again at position 1. The stream it writes is not
part of the generation. It still holds the old generation's last `origin`, say `[n, k]`, so every
append of the rebuilt projection at a position up to `n` is ignored:

- no error and no log: `append` returns `void` either way;
- the handler succeeded, so the input counts as handled and is not redelivered: on the cluster the
  projection key's `processed` and the stream's checkpoint for the source both moved past it, with
  no entry added;
- once its positions pass `n`, appends are accepted again, so the stream ends up missing a run of
  entries and looks healthy.

When the stream is a published one (an outbox for integration facts), the dropped entries are facts
other contexts never receive.

## Evidence

On Effect Cluster with PostgreSQL 17, restoring a dump taken under one version of a model into a
stack running the next:

1. Under the first version, a projection that reads a review view (`from: [Review]`) publishes a
   `Decided` fact (two entries, versions 1 and 2 of the fact, per decision) to a stream; the view is
   version 0. One claim is decided, so the stream's meta holds `origin: [1, 1]`. A second claim
   waits with a proposal, and a run waits for its approval. The database is dumped.
2. The next version bumps the view to version 1. The projection's generation becomes 1 (a class
   suffixed `V1`), with an input log from position 1. The dump is restored under it.
3. The waiting claim is approved. The projection handles the approval as its input 1; its two
   appends carry origins `[1, 0]` and `[1, 1]`, and both are ignored. The consumer never sees the
   decision, and the run waiting for it is never concluded.

In memory it reproduces with any model whose projection writes a stream: append a few entries,
bump the projection's `version` (or a view it reads), redeploy on the same platform, send one more
event: the stream gains nothing.

## Proposed change

Make a stream's dedupe follow its writer's generation, and say so when it refuses:

1. **Record the generation.** `origin` becomes `[generation, position, append]`, and an entry stores
   it. `isAfter` compares the generation first: a write from a newer generation is after every write
   of an older one. The two-element form keeps reading as generation 0.
2. **Decide what a rebuild means for the stream.** A rebuilt projection replays all of history, so
   with (1) alone it would append everything again. Two options, one of which the library should
   pick and document:
   - the rebuilt writer starts a new stream (the stream's identity includes the writer's
     generation), and reads of the old one stay possible; or
   - the stream keeps one log, and the rebuilt writer's appends are compared by the source event
     (`source`, `sourceSeq`), which do not change across a rebuild, instead of by input position.
3. **Fail loud.** An append that is ignored because it is not after the stream's origin, from a
   generation other than the one that wrote that origin, is a definition problem, not a
   redelivery: log it, or die with a `DefinitionError` when the model is hosted (a projection that
   writes a stream may not change generation without (2)).

## Workaround in use

Option (2a), by hand: the publisher reads the aggregate's events, not a view, so a view's version
bump cannot rebuild it. A changed publisher writes a new stream, a new generation of the published
log. The feed serves the closed generation and then the new one, and consumers drop what they
already saw by producer, fact id and version. A check fails when a projection that writes a
published stream changes its generation or its sources without a new stream generation.
