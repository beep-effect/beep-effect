import { consumerClass, runClass } from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import {
  Backlog,
  backlogOf,
  type ConsumerRef,
  KeyProgress,
  RunPhase,
  StagedDelivery,
  StoredRow,
  ViewApplied,
  WriterShape,
} from "@proto/tooling/PublisherBacklog";
import * as A from "effect/Array";
import * as S from "effect/Schema";

// Phase 11 (D50): a publisher's backlog read from its host's own records, for any writer.
// Every value below is generated from a schema. A scene says what waits for a generated writer;
// the rows are built from it the way the Durable Object platform stores them, so each count is
// known by construction.

/** One input on its way to a consumer's key: where it came from, and whether the key already took it in. */
const Input = S.Struct({ key: Name, source: Name, seq: Sequence, taken: S.Boolean });
type Input = typeof Input.Type;

/** What a writer's key has accepted and not handled, beside the input that reached it. */
const Arrival = S.Struct({ ...Input.fields, handled: Count, unhandled: Count });

/** A host's records about one writer: its app, what waits in outboxes for it, and what waits behind each view it reads. */
const Scene = S.Struct({
  app: Name,
  shape: WriterShape,
  toWriter: S.Array(Arrival),
  throughViews: S.Array(S.Struct({ ...Input.fields, view: Count, tag: Count })),
});
type Scene = typeof Scene.Type;

const objectOf = (app: string, model: string, cls: string, key: string) => `${app}/${model}.${cls}/${key}`;
const targetOf = (kind: "view" | "projection", ref: ConsumerRef) => ({ kind, name: ref.name, generation: ref.generation });
/** One entry per key: a key holds one record of what it took in. */
const perKey = <Entry extends Input>(entries: ReadonlyArray<Entry>) => A.dedupeWith(entries, (a, b) => a.key === b.key);
const taken = (input: Input) => (input.taken ? { [input.source]: input.seq } : {});

/** The inputs staged for the writer itself, each with its key's progress. */
const writerRows = ({ app, shape, toWriter }: Scene): ReadonlyArray<StoredRow> => {
  const keys = consumerClass("projection", shape.projection.name, shape.projection.classGeneration);
  return A.flatMap(perKey(toWriter), (arrival, index) => [
    StoredRow.make({
      object: objectOf(app, shape.model, "Source", arrival.key),
      key: `outbox:writer:${index}`,
      value: StagedDelivery.make({ target: targetOf("projection", shape.projection), key: arrival.key, source: arrival.source, seq: arrival.seq, tag: "Any" }),
    }),
    StoredRow.make({
      object: objectOf(app, shape.model, keys, arrival.key),
      key: "meta",
      value: KeyProgress.make({ accepted: arrival.handled + arrival.unhandled, processed: arrival.handled, intake: taken(arrival) }),
    }),
  ]);
};

/** The events the writer consumes, staged for a view it reads, each with that view key's snapshot. */
const viewRows = ({ app, shape, throughViews }: Scene): ReadonlyArray<StoredRow> => {
  const { views, on } = shape;
  if (!A.isReadonlyArrayNonEmpty(views) || !A.isReadonlyArrayNonEmpty(on)) return [];
  return A.flatMap(perKey(throughViews), (input, index) => {
    const view = views[input.view % views.length] ?? A.headNonEmpty(views);
    const tag = on[input.tag % on.length] ?? A.headNonEmpty(on);
    return [
      StoredRow.make({
        object: objectOf(app, shape.model, "Source", input.key),
        key: `outbox:view:${index}`,
        value: StagedDelivery.make({ target: targetOf("view", view), key: input.key, source: input.source, seq: input.seq, tag }),
      }),
      StoredRow.make({
        object: objectOf(app, shape.model, consumerClass("view", view.name, view.classGeneration), input.key),
        key: "snapshot",
        value: ViewApplied.make({ checkpoints: taken(input) }),
      }),
    ];
  });
};

const rowsOf = (scene: Scene) => [...writerRows(scene), ...viewRows(scene)];
const waiting = <Entry extends Input>(entries: ReadonlyArray<Entry>) => A.filter(perKey(entries), (entry) => !entry.taken).length;

it.prop("any records give a backlog whose pending is the sum of what waits", [WriterShape, S.Array(StoredRow)], ([shape, rows]) => {
  const backlog = backlogOf(shape, rows);
  expect(S.is(Backlog)(backlog)).toBe(true);
  expect(backlog.pending).toBe(backlog.staged + backlog.throughViews + backlog.unprocessed + (backlog.runComplete ? 0 : 1));
});

it.prop("each input is counted once, where it now waits", [Scene], ([scene]) => {
  const viewsRead = A.isReadonlyArrayNonEmpty(scene.shape.views) && A.isReadonlyArrayNonEmpty(scene.shape.on);
  expect(backlogOf(scene.shape, rowsOf(scene))).toEqual({
    staged: waiting(scene.toWriter),
    throughViews: viewsRead ? waiting(scene.throughViews) : 0,
    unprocessed: A.reduce(perKey(scene.toWriter), 0, (sum, arrival) => sum + arrival.unhandled),
    runComplete: true,
    pending:
      waiting(scene.toWriter) +
      (viewsRead ? waiting(scene.throughViews) : 0) +
      A.reduce(perKey(scene.toWriter), 0, (sum, arrival) => sum + arrival.unhandled),
  });
});

it.prop("the order of the records does not matter", [Scene], ([scene]) => {
  const rows = rowsOf(scene);
  expect(backlogOf(scene.shape, A.reverse(rows))).toEqual(backlogOf(scene.shape, rows));
});

it.prop("another model's records are not the writer's, even one whose name ends with the writer's", [Scene, Scene, Name], ([scene, other, prefix]) => {
  const foreign = rowsOf({ ...other, app: scene.app, shape: { ...scene.shape, model: `${prefix}${scene.shape.model}` } });
  const rows = rowsOf(scene);
  expect(backlogOf(scene.shape, [...rows, ...foreign])).toEqual(backlogOf(scene.shape, rows));
});

it.prop("a backfill run that is not complete counts as one pending", [Scene, RunPhase], ([scene, run]) => {
  const { app, shape } = scene;
  const keys = consumerClass("projection", shape.projection.name, shape.projection.classGeneration);
  const target = `projection:${shape.projection.name}${shape.projection.generation > 0 ? `#${shape.projection.generation}` : ""}`;
  const rows = rowsOf(scene);
  const withRun = backlogOf(shape, [
    ...rows,
    StoredRow.make({ object: objectOf(app, shape.model, runClass(keys), "~run"), key: `run:${encodeURIComponent(target)}`, value: run }),
  ]);
  const complete = run.phase === "complete";
  expect(withRun.runComplete).toBe(complete);
  expect(withRun.pending).toBe(backlogOf(shape, rows).pending + (complete ? 0 : 1));
});
