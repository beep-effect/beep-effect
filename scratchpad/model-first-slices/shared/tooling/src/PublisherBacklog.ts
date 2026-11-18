import type * as Domain from "@alchemy.run/domain";
import { consumerClass, runClass } from "@alchemy.run/domain/DurableObjects";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { thunkTrue } from "@beep/utils"

/**
 * One row of a host's object storage: the object (an instance's entity id, `Model.Class/key`,
 * prefixed on Effect Cluster by the entity type), the key and the decoded value. The Durable
 * Object platform stores every instance this way (`@alchemy.run/domain`'s `DurableObjects.ts`),
 * on Cloudflare, Rivet and Effect Cluster alike; the in-memory platform does not.
 *
 * @category models
 * @since 0.0.0
 */
export const StoredRow = S.Struct({ object: S.String, key: S.String, value: S.Unknown });
/**
 * @category models
 * @since 0.0.0
 */
export type StoredRow = typeof StoredRow.Type;

/**
 * A consumer as its deliveries and its storage name it: a view or projection, by name, its
 * generation (what a delivery's target carries) and its storage's generation (what its Durable
 * Object class carries). They differ only for a view rebuilt in place, which keeps its storage
 * (`Kernel.ts`, `classGenerationOf`).
 *
 * @category models
 * @since 0.0.0
 */
export const ConsumerRef = S.Struct({ name: Name, generation: Count, classGeneration: Count });
/**
 * @category models
 * @since 0.0.0
 */
export type ConsumerRef = typeof ConsumerRef.Type;

/**
 * The writer whose backlog is read: its model, the projection and its generation, the event tags
 * it consumes, and every view it reads, followed transitively (a view it reads that reads a view),
 * each with its generation. Derived from a hosted model (`writerShapeOf`), or written out for code
 * that is no longer in the tree.
 *
 * @category models
 * @since 0.0.0
 */
export const WriterShape = S.Struct({
  model: Name,
  projection: ConsumerRef,
  on: S.Array(Name),
  views: S.Array(ConsumerRef).check(
    S.makeFilter((views) => A.length(A.dedupeWith(views, (a, b) => a.name === b.name)) === A.length(views), {
      identifier: "OneRefPerViewCheck",
      title: "One ref per view",
      description: "Each view is listed once: a hosted model runs one generation of a view.",
      message: "Expected each view to be listed once",
    }),
  ),
});
/**
 * @category models
 * @since 0.0.0
 */
export type WriterShape = typeof WriterShape.Type;

/**
 * What a writer has not yet published, by where it waits:
 *
 * - `staged`: deliveries to the writer in its sources' outboxes;
 * - `throughViews`: deliveries of an event it consumes in the outboxes feeding a view it reads,
 *   which reach it once the view applies them;
 * - `unprocessed`: inputs its keys accepted and have not handled;
 * - `runComplete`: whether its backfill run, if it has one, is complete (one that is not may still
 *   bring it history).
 *
 * `pending` is their sum, counting an incomplete run as one.
 *
 * @category models
 * @since 0.0.0
 */
export const Backlog = S.Struct({
  staged: Count,
  throughViews: Count,
  unprocessed: Count,
  runComplete: S.Boolean,
  pending: Count,
});
/**
 * @category models
 * @since 0.0.0
 */
export type Backlog = typeof Backlog.Type;

/**
 * A staged delivery, as an outbox row holds it (`Platform.ts`, `Delivery`).
 *
 * @category models
 * @since 0.0.0
 */
export const StagedDelivery = S.Struct({
  target: S.Struct({ kind: S.String, name: S.String, generation: S.optionalKey(S.Int) }),
  key: S.String,
  source: S.String,
  seq: Sequence,
  tag: S.String,
});
const decodeDelivery = S.decodeUnknownOption(StagedDelivery);

/**
 * A projection key's progress (`DurableObjects.ts`, `ProjectionMeta`): what it took in, by source.
 *
 * @category models
 * @since 0.0.0
 */
export const KeyProgress = S.Struct({ accepted: S.Int, processed: S.Int, intake: S.Record(S.String, S.Int) });
const decodeProgress = S.decodeUnknownOption(KeyProgress);

/**
 * A view key's snapshot (`Platform.ts`, `ViewSnapshot`): what it applied, by source.
 *
 * @category models
 * @since 0.0.0
 */
export const ViewApplied = S.Struct({ checkpoints: S.Record(S.String, S.Int) });
const decodeApplied = S.decodeUnknownOption(ViewApplied);

/**
 * A consumer run's state at its root (`Backfill.ts`, `RunState`).
 *
 * @category models
 * @since 0.0.0
 */
export const RunPhase = S.Struct({ phase: S.String });
const decodePhase = S.decodeUnknownOption(RunPhase);

/** The class an object belongs to in `model`: the segment `Model.Class` of its id. */
const classOf = (model: string, object: string): O.Option<string> =>
  pipe(
    A.findFirst(Str.split(object, "/"), Str.startsWith(`${model}.`)),
    O.map(Str.slice(model.length + 1)),
  );

/** The key of an object of `cls` in `model`: what follows `Model.Class/` in its id. */
/** The key of an instance of `model`'s class `cls`: what follows its `Model.Class` segment, which must match whole. */
const keyOf = (model: string, cls: string, object: string): O.Option<string> => {
  const segments = Str.split(object, "/");
  return O.map(A.findFirstIndex(segments, (segment) => segment === `${model}.${cls}`), (at) => A.join(A.drop(segments, at + 1), "/"));
};

/** Per key of a consumer class, the last `seq` it took in from each source, from `rows` decoded by `decode`. */
const takenBy = (
  model: string,
  cls: string,
  rowKey: string,
  rows: ReadonlyArray<StoredRow>,
  decode: (value: unknown) => O.Option<Readonly<Record<string, number>>>,
): HashMap.HashMap<string, Readonly<Record<string, number>>> =>
  HashMap.fromIterable(
    A.getSomes(
      A.map(A.filter(rows, (row) => row.key === rowKey), (row) =>
        O.flatMap(keyOf(model, cls, row.object), (key) => O.map(decode(row.value), (taken) => [key, taken] as const)),
      ),
    ),
  );

/** Whether a consumer key already took in a delivery, whose outbox row has not yet been deleted. */
const alreadyTaken = (taken: HashMap.HashMap<string, Readonly<Record<string, number>>>, delivery: typeof StagedDelivery.Type) =>
  O.exists(HashMap.get(taken, delivery.key), (bySource) => (bySource[delivery.source] ?? 0) >= delivery.seq);

/** A consumer's target id (`CatchUp.ts`, `targetId`). */
const targetOf = (kind: "view" | "projection", ref: ConsumerRef): string =>
  `${kind}:${ref.name}${ref.generation > 0 ? `#${ref.generation}` : ""}`;

/**
 * A writer's backlog, read from its host's rows (D50). The layout it reads is the Durable Object
 * platform's (`DurableObjects.ts`): an instance's outbox rows are `outbox:<seq>`, each a staged
 * delivery naming its target and the event's tag (`queue`, `stage`); a projection key's progress
 * is its `meta` row, `accepted` and `processed` (`ProjectionMeta`); a consumer's backfill run
 * keeps its phase at its run class's root, `~run`, under `run:<target>` (`Backfill.ts`).
 *
 * **Details**
 *
 * An outbox row is deleted only once its delivery returns, so a delivery its consumer has already
 * taken in can still be staged. Such a row is not counted again: a projection key's `meta.intake`
 * and a view key's `snapshot.checkpoints` hold the last `seq` taken from each source, and a staged
 * delivery at or below it is already counted where it now waits (or has been applied).
 *
 * **Example** (A writer with nothing waiting)
 * ```ts
 * import { backlogOf } from "@proto/tooling/PublisherBacklog";
 *
 * const backlog = backlogOf(
 *   {
 *     model: "Party",
 *     projection: { name: "ClaimFacts", generation: 0, classGeneration: 0 },
 *     on: ["ClaimAccepted"],
 *     views: [{ name: "ClaimReview", generation: 0, classGeneration: 0 }],
 *   },
 *   [],
 * );
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const backlogOf: {
  (rows: ReadonlyArray<StoredRow>): (shape: WriterShape) => Backlog;
  (shape: WriterShape, rows: ReadonlyArray<StoredRow>): Backlog;
} = dual(2, (shape: WriterShape, rows: ReadonlyArray<StoredRow>): Backlog => {
  const keyClass = consumerClass("projection", shape.projection.name, shape.projection.classGeneration);
  const isTarget = (kind: string, ref: ConsumerRef, target: typeof StagedDelivery.Type["target"]) =>
    target.kind === kind && target.name === ref.name && (target.generation ?? 0) === ref.generation;
  // A model's deliveries are staged in its own instances' outboxes: another model's are not this writer's.
  const staged = A.getSomes(
    A.map(
      A.filter(rows, (row) => pipe(row.key, Str.startsWith("outbox:")) && O.isSome(classOf(shape.model, row.object))),
      (row) => decodeDelivery(row.value),
    ),
  );
  // A row stays until its delivery returns, so a delivery the consumer has taken in may still be
  // staged: those are counted where they now wait, not twice.
  const writerTook = takenBy(shape.model, keyClass, "meta", rows, (value) => O.map(decodeProgress(value), (progress) => progress.intake));
  const toWriter = A.filter(
    staged,
    (delivery) => isTarget("projection", shape.projection, delivery.target) && !alreadyTaken(writerTook, delivery),
  ).length;
  const throughViews = A.filter(staged, (delivery) =>
    A.contains(shape.on, delivery.tag) &&
    A.some(shape.views, (view) =>
      isTarget("view", view, delivery.target) &&
      !alreadyTaken(
        takenBy(shape.model, consumerClass("view", view.name, view.classGeneration), "snapshot", rows, (value) =>
          O.map(decodeApplied(value), (applied) => applied.checkpoints),
        ),
        delivery,
      ),
    ),
  ).length;
  const unprocessed = A.reduce(
    A.getSomes(
      A.map(
        A.filter(rows, (row) => row.key === "meta" && O.contains(classOf(shape.model, row.object), keyClass)),
        (row) => decodeProgress(row.value),
      ),
    ),
    0,
    (sum, progress) => sum + Math.max(0, progress.accepted - progress.processed),
  );
  const runKey = `run:${encodeURIComponent(targetOf("projection", shape.projection))}`;
  const run = A.findFirst(
    rows,
    (row) => row.key === runKey && O.contains(classOf(shape.model, row.object), runClass(keyClass)),
  );
  const runComplete = O.match(O.flatMap(run, (row) => decodePhase(row.value)), {
    onNone: thunkTrue,
    onSome: (state) => state.phase === "complete",
  });
  return {
    staged: toWriter,
    throughViews,
    unprocessed,
    runComplete,
    pending: toWriter + throughViews + unprocessed + (runComplete ? 0 : 1),
  };
});

/**
 * A hosted model's consumer generations, as its kernel reports them (`Model.Internals`'s
 * `kernel.generationOf` and `kernel.classGenerationOf`).
 *
 * @category models
 * @since 0.0.0
 */
export interface ConsumerGenerations {
  readonly generationOf: (kind: "view" | "projection", name: string) => number;
  readonly classGenerationOf: (kind: "view" | "projection", name: string) => number;
}

const refOf = (generations: ConsumerGenerations, kind: "view" | "projection", name: string): ConsumerRef => ({
  name,
  generation: generations.generationOf(kind, name),
  classGeneration: generations.classGenerationOf(kind, name),
});

const viewsOf = (
  sources: ReadonlyArray<Domain.Aggregate.Any | Domain.View.Any>,
  generations: ConsumerGenerations,
): ReadonlyArray<ConsumerRef> =>
  A.flatMap(sources, (source) =>
    source.kind === "View"
      ? [refOf(generations, "view", source.viewName), ...viewsOf(source.definition.from, generations)]
      : [],
  );

/**
 * The shape of the projection that writes `stream` in a hosted model, if one does.
 *
 * **Example** (Party's publisher of generation 2)
 * ```ts
 * import { writerShapeOf } from "@proto/tooling/PublisherBacklog";
 * import type * as Domain from "@alchemy.run/domain";
 *
 * declare const model: Domain.Model.Any;
 * const shape = writerShapeOf({ model, generations: { generationOf: () => 0, classGenerationOf: () => 0 } })("PartyFacts2");
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const writerShapeOf =
  ({ model, generations }: { readonly model: Domain.Model.Any; readonly generations: ConsumerGenerations }) =>
  (stream: string): O.Option<WriterShape> =>
    O.map(
      A.findFirst(model.definitions.projections, (projection) =>
        A.some(projection.definition.writes ?? [], (written) => written.streamName === stream),
      ),
      (projection) => ({
        model: model.modelName,
        projection: refOf(generations, "projection", projection.projectionName),
        on: A.map(projection.definition.on, (event) => event.tag),
        views: A.dedupeWith(viewsOf(projection.definition.from, generations), (a, b) => a.name === b.name && a.generation === b.generation),
      }),
    );
