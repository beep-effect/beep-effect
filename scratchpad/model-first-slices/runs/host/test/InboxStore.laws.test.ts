import { makeLayer } from "@beep/pglite";
import { expect, it } from "@effect/vitest";
import { Count, Name } from "@proto/kernel/Measure";
import { ClusterSql, clusterSqlFrom, clusterSqlNames } from "@proto/runs-host/ClusterSql";
import { InboxStore, MemoryInboxStore } from "@proto/runs-host/Inbox/Inbox.store";
import { PgInboxStoreOverClusterSql } from "@proto/runs-host/Inbox/PgInboxStore.adapter";
import { RunsMigrations } from "@proto/runs-host/Runs.migrations";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// The inbox store's laws, held by both implementations: memory, and the Postgres adapter on
// PGlite. A scene is the commits an inbox made, in the order it made them, with a producer and a
// key it may ask about that no commit named; what each read returns is known from the scene.

/** One commit, by index into the scene's producers and keys: the producer, the fact acted on (none when the fact was passed over), and the position. */
const Pick = S.Struct({ producer: Count, key: S.Option(Count), seq: Count });
/** Two producers and three keys, so commits share them; and a producer and a key no commit names. */
const Scene = S.Struct({
  producers: S.Tuple([Name, Name]),
  keys: S.Tuple([Name, Name, Name]),
  picks: S.Array(Pick).check(S.isMaxLength(12)),
  producer: Name,
  key: Name,
});
type Scene = typeof Scene.Type;
/** A commit as the inbox makes it. */
const Commit = S.Struct({ producer: Name, key: S.Option(Name), seq: Count });
type Commit = typeof Commit.Type;

const at = <const T extends ReadonlyArray<string>>(values: T, index: number) => values[index % values.length] ?? values[0] ?? "";
const commitsOf = (scene: Scene): ReadonlyArray<Commit> =>
  A.map(scene.picks, ({ producer, key, seq }) => ({ producer: at(scene.producers, producer), key: O.map(key, (index) => at(scene.keys, index)), seq }));

type Store = Context.Service.Shape<typeof InboxStore>;

const commitAll = (store: Store, commits: ReadonlyArray<Commit>) =>
  Effect.forEach(commits, ({ producer, key, seq }) => store.commit(producer, key, seq), { concurrency: 1, discard: true });

/** The checkpoint a producer reads: the highest position committed for it, 0 before the first. */
const expectedCheckpoint = (commits: ReadonlyArray<Commit>, producer: string) =>
  A.reduce(commits, 0, (highest, commit) => (commit.producer === producer && commit.seq > highest ? commit.seq : highest));
const keysOf = (commits: ReadonlyArray<Commit>) => A.dedupe(A.getSomes(A.map(commits, (commit) => commit.key)));
const producersOf = (commits: ReadonlyArray<Commit>) => A.dedupe(A.map(commits, (commit) => commit.producer));

/** What the store says of the scene: every producer's checkpoint and every key's seen flag, the unnamed ones included. */
const readAll = Effect.fnUntraced(function* (store: Store, scene: Scene) {
  const producers = A.append(producersOf(commitsOf(scene)), scene.producer);
  const keys = A.append(keysOf(commitsOf(scene)), scene.key);
  const checkpoints = yield* Effect.forEach(producers, (producer) => Effect.map(store.checkpoint(producer), (seq) => [producer, seq] as const), {
    concurrency: 1,
  });
  const seen = yield* Effect.forEach(keys, (key) => Effect.map(store.seen(key), (flag) => [key, flag] as const), { concurrency: 1 });
  return { checkpoints, seen };
});

const Postgres = PgInboxStoreOverClusterSql.pipe(Layer.provideMerge(clusterSqlFrom(makeLayer(clusterSqlNames), RunsMigrations)));

/** Each implementation, fresh for every generated scene. */
const implementations = {
  memory: MemoryInboxStore.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(InboxStore))),
  postgres: Effect.gen(function* () {
    const { connect } = yield* ClusterSql;
    const { sql } = yield* connect;
    yield* sql`TRUNCATE runs_inbox_checkpoints, runs_inbox_seen`;
    return yield* Effect.service(InboxStore);
  }).pipe(Effect.orDie),
};
const options = { timeout: 120_000, arbitrary: { runs: 30 } };

it.layer(Postgres, { timeout: "60 seconds" })("the inbox store's laws", (it) => {
  A.forEach(["memory", "postgres"] as const, (name) => {
    const fresh = implementations[name];

    it.effect.prop(`${name}: a producer's checkpoint is the highest position committed for it, 0 before the first`, [Scene], ([scene]) =>
      Effect.gen(function* () {
        const store = yield* fresh;
        yield* commitAll(store, commitsOf(scene));
        const { checkpoints } = yield* readAll(store, scene);
        A.forEach(checkpoints, ([producer, seq]) => expect(seq).toBe(expectedCheckpoint(commitsOf(scene), producer)));
      }),
      options,
    );

    it.effect.prop(`${name}: a key is seen exactly when a commit recorded it`, [Scene], ([scene]) =>
      Effect.gen(function* () {
        const store = yield* fresh;
        yield* commitAll(store, commitsOf(scene));
        const { seen } = yield* readAll(store, scene);
        A.forEach(seen, ([key, flag]) => expect(flag).toBe(A.contains(keysOf(commitsOf(scene)), key)));
      }),
      options,
    );

    it.effect.prop(
      `${name}: commits redelivered, or arriving from a second inbox out of order, leave what one ordered pass leaves`,
      [Scene],
      ([scene]) =>
        Effect.gen(function* () {
          const ordered = yield* fresh;
          yield* commitAll(ordered, commitsOf(scene));
          const once = yield* readAll(ordered, scene);
          const shuffled = yield* fresh;
          yield* commitAll(shuffled, pipe(commitsOf(scene), A.reverse, A.appendAll(commitsOf(scene))));
          const twice = yield* readAll(shuffled, scene);
          expect(twice).toEqual(once);
        }),
      options,
    );

    it.effect.prop(`${name}: a commit that passes a fact over moves the checkpoint and records no key`, [Name, Name, Count], ([producer, key, seq]) =>
      Effect.gen(function* () {
        const store = yield* fresh;
        yield* store.commit(producer, O.none(), seq);
        const checkpoint = yield* store.checkpoint(producer);
        expect(checkpoint).toBe(seq);
        const seen = yield* store.seen(key);
        expect(seen).toBe(false);
      }),
      options,
    );
  });
});
