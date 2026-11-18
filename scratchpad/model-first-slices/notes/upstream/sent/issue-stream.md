When a projection is rebuilt by a version bump (its own, or that of a view it reads), the stream it writes silently drops its appends until its input positions pass the old generation's. There is no error and no log. The input counts as handled, so it is never redelivered, and the stream ends up missing a run of entries while looking healthy. When the stream is a published one, the dropped entries are facts that other contexts never receive.

Seen on 2.0.0-beta.87 and unchanged on `main` (3ff34b9).

### Cause

A stream entry records the writer's position as its origin: the input's place in the projection key's input log, and the append's index within that input.

```ts
// packages/domain/src/Model.ts:1307
const position: [number, number] = [meta.position, meta.appends];
```

The stream keeps the last origin in its meta and ignores a write that is not after it. That is what makes a replayed or redelivered input append nothing twice:

```ts
// packages/domain/src/DurableObjects.ts:1941, and InMemory.ts:1357
if (!isAfter(write.origin, meta.origin)) return;
```

A projection's generation is its `version` plus the versions of every view in its `from` (`Kernel.ts:801`). When the generation changes, the projection's input log starts over at position 1:

```ts
// packages/domain/src/DurableObjects.ts:1734
/** Start a log built by an earlier generation over. */
```

The stream is not part of the generation (`emptyStreamMeta` is `{ seq: 0, checkpoints: {}, origin: [0, 0] }`, `Platform.ts:684`). It still holds the old generation's last origin, say `[n, k]`. So every append the rebuilt projection makes at a position up to `n` is ignored, and `append` returns `void` either way.

### Reproduction

In memory, with any model whose projection writes a stream:

1. Append a few entries.
2. Bump the projection's `version` (or the `version` of a view in its `from`) and host the model again on the same platform.
3. Send one more event. The stream gains nothing.

We first saw it on Effect Cluster with PostgreSQL 17, restoring a dump taken under one version of a model into a stack running the next. A projection reading a review view published a `Decided` fact with two entries per decision. One claim was decided, so the stream's meta held `origin: [1, 1]`. The next version bumped the view to version 1, which rebuilt the projection with an input log from position 1. The next approval was the rebuilt projection's input 1. Its two appends carried origins `[1, 0]` and `[1, 1]`, both were ignored, and the consumer waiting for that decision never saw it.

### What would fix it

1. **Record the writer's generation.** The origin becomes `[generation, position, append]`, and `isAfter` compares the generation first, so a write from a newer generation is after every write of an older one. The two-element form keeps reading as generation 0.
2. **Decide what a rebuild means for the stream.** A rebuilt projection replays all of history, so with (1) alone it would append everything again. Either:
   - the rebuilt writer starts a new stream (its identity includes the writer's generation), and the old one stays readable; or
   - the stream keeps one log, and a rebuilt writer's appends are deduplicated by the source event (`source`, `sourceSeq`), which a rebuild does not change, instead of by input position.
3. **Fail loudly.** An append ignored because it is not after the stream's origin, from a generation other than the one that wrote that origin, is a definition problem, not a redelivery. It should be logged, or rejected with a `DefinitionError` when the model is hosted.

(2) is a design choice for the library. We have been working around it by hand with the first form: a changed publisher writes a new stream, the feed serves the closed generation and then the new one, and consumers drop what they already saw by producer, fact id and version.
