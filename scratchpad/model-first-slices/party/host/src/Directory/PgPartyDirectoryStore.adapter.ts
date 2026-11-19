import type * as Domain from "@alchemy.run/domain";
import type { OrgId } from "@proto/kernel/Ids";
import { Text } from "@proto/kernel/Measure";
import type { DirectoryText } from "@proto/party-contract/Directory/FindParties.read";
import {
  DirectoryChange,
  type DirectoryWrite,
  GenerationBehind,
  pageOf,
  PartyDirectoryStore,
  resumeAfter,
} from "@proto/party-model/Directory/PartyDirectory.store";
import { and, arrayContains, eq, isNull, lt, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Str from "@beep/utils/Str";
import { ClusterSql, ClusterSqlLive, type Connection } from "../ClusterSql.ts";
import {
  PartyDirectoryActive,
  type PartyDirectoryRowGeneration,
  PartyDirectoryRowTables,
  PartyDirectoryTables,
  StoreKit,
} from "./PartyDirectory.table.ts";
import { thunkEffectSucceedNone, thunkEffectVoid, thunkUndefined } from "@beep/utils/thunk";

/**
 * The store was asked for a generation this deploy declares no row table
 * for. A defect: the set of row tables is static per deploy.
 *
 * @category errors
 * @since 0.0.0
 */
export class UndeclaredGeneration extends S.TaggedError<UndeclaredGeneration, { readonly brand: unique symbol }>()("UndeclaredGeneration", {
  generation: S.Int,
  message: Text,
}) {}

const undeclared = (generation: number) =>
  UndeclaredGeneration.make({
    generation,
    message:
      `party directory generation ${generation} has no row table: declare PartyDirectoryRowsV${generation} ` +
      "in party/host/src/Directory/PartyDirectory.table.ts, add it to PartyDirectoryRowTables and to " +
      "party/host/src/Party.schema.ts, then run `bun run --cwd party/host migrations`",
  });

const { positions, active } = PartyDirectoryTables;
const candidate = alias(positions, "candidate");
const encodeActive = S.encodeEffect(PartyDirectoryActive.insert);

/** Collate party ids bytewise, as the in-memory store orders them, whatever the database's default collation. */
const partyIdOrder = (column: unknown) => sql`${column} collate "C"`;

/** What a connection gives the store: Drizzle, the client its transactions run on, and the active pointer's repository. */
const storeOf = Effect.fnUntraced(function* (connection: Connection) {
  const activeRows = yield* StoreKit.NativeRepository(PartyDirectoryActive, { spanPrefix: "PartyDirectoryActive", idColumn: "slot" }).pipe(
    Effect.provideService(SqlClient.SqlClient, connection.sql),
  );
  return { ...connection, activeRows };
});

/**
 * The directory in Postgres over `rows`, the row tables the deploy keeps:
 * each generation's rows in its own table, and the per-source positions
 * beside them, written together in one transaction, so a replayed or
 * redelivered change is refused exactly as the in-memory store refuses it
 * (D14, D16). A generation still building forwards each write to the active
 * generation in the same transaction, so a search that waited for a write
 * finds it before the switch. The model's port is unchanged; only this
 * adapter knows about Postgres.
 *
 * **Details**
 *
 * A generation with no declared table dies with {@link UndeclaredGeneration},
 * which says what to add. The switch makes a generation active and drops
 * older generations' positions; an older generation's row table stays until
 * a migration drops it.
 *
 * **Example** (Over a test's row tables)
 * ```ts
 * import { pgPartyDirectoryStoreFor } from "@proto/party-host/Directory/PgPartyDirectoryStore.adapter";
 * import { PartyDirectoryRowTables } from "@proto/party-host/Directory/PartyDirectory.table";
 *
 * const store = pgPartyDirectoryStoreFor(PartyDirectoryRowTables);
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const pgPartyDirectoryStoreFor = (rows: Readonly<Record<number, PartyDirectoryRowGeneration>>) =>
  Layer.effect(
    PartyDirectoryStore,
    Effect.gen(function* () {
      const { connect } = yield* ClusterSql;
      const connected = yield* Effect.cached(Effect.flatMap(connect, storeOf));
      const withStore = <A, E>(f: (store: Effect.Success<typeof connected>) => Effect.Effect<A, E>) =>
        Effect.logInfo("party directory: using Postgres").pipe(Effect.andThen(Effect.flatMap(connected, f)));
      const rowsOf = (generation: number) =>
        O.match(O.fromUndefinedOr(rows[generation]), {
          onNone: () => Effect.die(undeclared(generation)),
          onSome: Effect.succeed,
        });
      const activeGeneration = ({ activeRows }: Effect.Success<typeof connected>) =>
        activeRows.findById(1).pipe(
          Effect.map((row) => O.some(row.generation)),
          Effect.catchTag("NoSuchElementError", thunkEffectSucceedNone),
        );

      /**
       * Apply one write to one generation's rows unless that generation's position for the stream
       * is at or past it: the change and the position together. Says whether it applied.
       */
      const applyTo =
        (store: Effect.Success<typeof connected>, generation: number, { model, table }: PartyDirectoryRowGeneration) =>
        (write: DirectoryWrite) =>
          Effect.gen(function* () {
            // Lock the position row: two runners applying one stream serialise here.
            const position = yield* store.db
              .select({ seq: positions.seq })
              .from(positions)
              .where(and(eq(positions.generation, generation), eq(positions.stream, write.stream)))
              .for("update");
            if (O.exists(A.head(position), (row) => write.seq <= row.seq)) return false;
            yield* DirectoryChange.match(write.change, {
              Registered: ({ partyId, org, name }) => {
                // The insert variant starts `absorbed` empty; a registration replayed over a merged row resets it, as before.
                const row = model.insert.make({ partyId, org, name });
                const values = { ...row, absorbed: A.copy(row.absorbed) };
                return Effect.asVoid(
                  store.db
                    .insert(table)
                    .values(values)
                    .onConflictDoUpdate({ target: table.partyId, set: { org: values.org, name: values.name, absorbed: values.absorbed } }),
                );
              },
              Merged: ({ partyId, absorbed }) =>
                Effect.asVoid(
                  store.db
                    .update(table)
                    .set({ absorbed: sql`array_append(${table.absorbed}, ${absorbed})` })
                    .where(and(eq(table.partyId, partyId), not(arrayContains(table.absorbed, [absorbed])))),
                ),
            });
            yield* store.db
              .insert(positions)
              .values({ generation, stream: write.stream, seq: write.seq })
              .onConflictDoUpdate({ target: [positions.generation, positions.stream], set: { seq: write.seq } });
            return true;
          });

      return PartyDirectoryStore.of({
        apply: dual(
          2,
          Effect.fn("PgPartyDirectoryStore.apply")((writes: ReadonlyArray<DirectoryWrite>, generation: number) =>
            withStore((store) =>
              store.sql
                .withTransaction(
                  Effect.gen(function* () {
                    const current = yield* activeGeneration(store);
                    if (O.exists(current, (at) => generation < at)) return 0;
                    const target = yield* rowsOf(generation);
                    const write = applyTo(store, generation, target);
                    if (O.isNone(current)) {
                      const pointer = yield* encodeActive(PartyDirectoryActive.insert.make({ generation }));
                      yield* store.db.insert(active).values(pointer).onConflictDoNothing();
                    }
                    // A generation still building forwards each write to the one queries read, in the
                    // same transaction; the active generation's own positions refuse what it has.
                    const forward = yield* O.match(O.filter(current, (at) => at < generation), {
                      onNone: () => Effect.succeed(O.none<ReturnType<typeof applyTo>>()),
                      onSome: (at) => Effect.map(rowsOf(at), (rows) => O.some(applyTo(store, at, rows))),
                    });
                    return yield* Effect.reduce(writes, () => 0, (applied, next) =>
                      Effect.gen(function* () {
                        const landed = yield* write(next);
                        yield* O.match(forward, { onNone: thunkEffectVoid, onSome: (toActive) => Effect.asVoid(toActive(next)) });
                        return landed ? applied + 1 : applied;
                      }),
                    );
                  }),
                )
                .pipe(Effect.orDie),
            ),
          ),
        ),
        active: withStore(flow(activeGeneration, Effect.orDie)),
        checkpoints: Effect.fn("PgPartyDirectoryStore.checkpoints")((generation: number) =>
          withStore((store) =>
            store.db
              .select({ stream: positions.stream, seq: positions.seq })
              .from(positions)
              .where(eq(positions.generation, generation))
              .pipe(
                Effect.map(flow(A.map((row) => [row.stream, row.seq] as const), HashMap.fromIterable)),
                Effect.orDie,
              ),
          ),
        ),
        switchTo: Effect.fn("PgPartyDirectoryStore.switchTo")((generation: number) =>
          withStore((store) =>
            store.sql
              .withTransaction(
                Effect.gen(function* () {
                  yield* rowsOf(generation);
                  // The streams where the candidate has not applied what the active generation has.
                  const behind = yield* store.db
                    .select({ stream: positions.stream })
                    .from(positions)
                    .innerJoin(active, eq(positions.generation, active.generation))
                    .leftJoin(candidate, and(eq(candidate.generation, generation), eq(candidate.stream, positions.stream)))
                    .where(or(isNull(candidate.seq), lt(candidate.seq, positions.seq)));
                  if (A.isReadonlyArrayNonEmpty(behind)) return A.map(behind, (row) => row.stream);
                  const pointer = yield* encodeActive(PartyDirectoryActive.insert.make({ generation }));
                  yield* store.db.insert(active).values(pointer).onConflictDoUpdate({ target: active.slot, set: { generation } });
                  yield* store.db.delete(positions).where(lt(positions.generation, generation));
                  return A.empty<string>();
                }),
              )
              .pipe(
                Effect.orDie,
                Effect.flatMap((behind) =>
                  A.isReadonlyArrayEmpty(behind) ? Effect.void : Effect.fail(GenerationBehind.make({ generation, behind })),
                ),
              ),
          ),
        ),
        search: dual(
          3,
          Effect.fn("PgPartyDirectoryStore.search")((org: OrgId, text: DirectoryText, { after, take }: Domain.Query.PageRequest) =>
            withStore((store) =>
              Effect.gen(function* () {
                // A cursor the store did not issue is refused before anything is read.
                const from = yield* resumeAfter(after);
                const current = yield* activeGeneration(store).pipe(Effect.orDie);
                if (O.isNone(current)) return yield* pageOf(A.empty(), take);
                const { model, table } = yield* rowsOf(current.value);
                // Contains `text`, case-insensitively: `strpos` matches the text as written, so `%`, `_` and `\` are plain characters.
                const found = yield* store.db
                  .select()
                  .from(table)
                  .where(
                    and(
                      eq(table.org, org),
                      sql`strpos(lower(${table.name}), ${Str.toLowerCase(text)}) > 0`,
                      O.match(from, { onNone: thunkUndefined, onSome: (at) => sql`${partyIdOrder(table.partyId)} > ${at}` }),
                    ),
                  )
                  .orderBy(partyIdOrder(table.partyId))
                  .limit(take + 1)
                  .pipe(Effect.orDie);
                const decoded = yield* S.decodeEffect(S.Array(model.select))(found).pipe(Effect.orDie);
                return yield* pageOf(decoded, take);
              }),
            ),
          ),
        ),
      });
    }),
  );

/**
 * The directory in the cluster's Postgres, over the row tables this deploy
 * keeps ({@link PartyDirectoryRowTables}).
 *
 * **Details**
 *
 * It connects to the cluster's own database (`CLUSTER_DATABASE_URL`, which
 * every runner and the front have) on first use and applies Party host's
 * pending migrations once.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PgPartyDirectoryStore = pgPartyDirectoryStoreFor(PartyDirectoryRowTables).pipe(Layer.provide(ClusterSqlLive));
