import type * as Domain from "@alchemy.run/domain";
import { OrgId } from "@proto/kernel/Ids";
import { Count, Sequence, StreamId } from "@proto/kernel/Measure";
import { DirectoryRow, type DirectoryText } from "@proto/party-contract/Directory/FindParties.read";
import { InvalidCursor } from "@proto/party-contract/Directory/InvalidCursor.rejection";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyName } from "@proto/party-contract/Party/PartyName";
import { $PartyModelId } from "@proto/kernel/Identity";
import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import { thunkEffectSucceedNone, thunkEffectSucceedNull } from "@beep/utils/thunk";

const $I = $PartyModelId.create("Directory/PartyDirectory.store");

/**
 * A change the projection writes. A projection from an aggregate sees only
 * events, never the aggregate's state, so the store applies changes rather
 * than taking whole rows.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryChange = S.TaggedUnion({
  Registered: { partyId: PartyId, org: OrgId, name: PartyName },
  Merged: { partyId: PartyId, absorbed: PartyId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryChange = typeof DirectoryChange.Type;

/**
 * One change and where it came from: the source stream and its position in
 * that stream. The store applies a stream's changes in position order, once.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryWrite = S.Struct({ stream: StreamId, seq: Sequence, change: DirectoryChange });
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryWrite = typeof DirectoryWrite.Type;

/**
 * A generation cannot become the one queries read: it has not yet applied
 * what the active generation has, for these source streams.
 *
 * @category errors
 * @since 0.0.0
 */
export class GenerationBehind extends S.TaggedError<GenerationBehind, { readonly brand: unique symbol }>()("GenerationBehind", {
  generation: Count,
  behind: S.Array(StreamId),
}) {}

/**
 * A directory cursor's contents: the order the pages follow and the last
 * party of the page it ends. Pages follow party id order, the only order the
 * directory keeps.
 */
const CursorPosition = S.Struct({ order: S.Literal("partyId"), partyId: PartyId });

/**
 * The cursor a directory page hands back, as the client sees it: the page's
 * order and its last party, as JSON in base64url. Both stores issue and read
 * cursors through it, so a cursor one issues the other reads, and text that
 * does not decode is no cursor (`InvalidCursor`).
 *
 * **Example** (A page's cursor)
 * ```ts
 * import { DirectoryCursor } from "@proto/party-model/Directory/PartyDirectory.store";
 * import { PartyId } from "@proto/party-contract/Party/Party.id";
 * import * as S from "effect/Schema";
 *
 * const cursor = S.encodeSync(DirectoryCursor)({ order: "partyId", partyId: PartyId.make("party_1") });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryCursor = S.StringFromBase64Url.pipe(S.decodeTo(S.fromJsonString(CursorPosition)));
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryCursor = typeof DirectoryCursor.Type;

const decodeCursor = S.decodeEffect(DirectoryCursor);
const encodeCursor = S.encodeEffect(DirectoryCursor);

/**
 * Where a page starts: after the party a cursor names, or at the first party
 * when there is no cursor. A cursor the directory did not issue is refused
 * with `InvalidCursor`, never read as a position.
 *
 * **Example** (The first page)
 * ```ts
 * import { resumeAfter } from "@proto/party-model/Directory/PartyDirectory.store";
 *
 * const first = resumeAfter(undefined);
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const resumeAfter = (after: string | undefined): Effect.Effect<O.Option<PartyId>, InvalidCursor> =>
  O.match(O.fromUndefinedOr(after), {
    onNone: thunkEffectSucceedNone<PartyId>,
    onSome: flow(
      decodeCursor,
      Effect.map((cursor) => O.some(cursor.partyId)),
      Effect.mapError(() => InvalidCursor.make({})),
    ),
  });

/**
 * One page from the rows a search found from its start, in order: at most
 * `take` of them, and, when more were found, the cursor that resumes after
 * the last. A store finds `take + 1` rows, or all of them, and pages them
 * here, so both stores page alike.
 *
 * **Example** (A first page of two)
 * ```ts
 * import { pageOf } from "@proto/party-model/Directory/PartyDirectory.store";
 *
 * const page = pageOf([], 2);
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pageOf: {
  (take: number): (found: ReadonlyArray<DirectoryRow>) => Effect.Effect<Domain.Query.Page<DirectoryRow>>;
  (found: ReadonlyArray<DirectoryRow>, take: number): Effect.Effect<Domain.Query.Page<DirectoryRow>>;
} = dual(2, (found: ReadonlyArray<DirectoryRow>, take: number) => {
  const entries = A.take(found, take);
  return Effect.map(
    found.length > take
      ? O.match(A.last(entries), {
          onNone: thunkEffectSucceedNull,
          onSome: (row) => encodeCursor({ order: "partyId", partyId: row.partyId }).pipe(Effect.orDie),
        })
      : thunkEffectSucceedNull(),
    (cursor): Domain.Query.Page<DirectoryRow> => ({ entries, cursor }),
  );
});

/**
 * Where the directory lives: a port the model declares. The projection
 * writes through it and `FindParties` reads through it, so a story runs both
 * against memory and a host against a database.
 *
 * **Details**
 *
 * The store owns its checkpoints (D14, D16). Each generation of the
 * projection writes its own rows and keeps, per source stream, the last
 * position it applied; a change at or before that position is refused, so a
 * replayed or redelivered batch changes nothing, whatever arrived since.
 * Queries read the active generation; a rebuild writes the next generation
 * beside it and `switchTo` makes it active once it has caught up.
 *
 * @category ports
 * @since 0.0.0
 */
export class PartyDirectoryStore extends Context.Service<
  PartyDirectoryStore,
  {
    /**
     * Apply a generation's writes in order, each with its checkpoint in the
     * same write. Refused, and not counted: a write at or before the
     * generation's checkpoint for its stream, and every write of a generation
     * older than the active one. Returns how many were applied. The writes
     * come first, so a batch pipes into `apply(generation)`.
     */
    readonly apply: {
      (generation: number): (writes: ReadonlyArray<DirectoryWrite>) => Effect.Effect<number>;
      (writes: ReadonlyArray<DirectoryWrite>, generation: number): Effect.Effect<number>;
    };
    /** The generation queries read; the first to write becomes active. */
    readonly active: Effect.Effect<O.Option<number>>;
    /** A generation's checkpoints: the last position applied, by source stream. */
    readonly checkpoints: (generation: number) => Effect.Effect<HashMap.HashMap<string, number>>;
    /** Make a generation the one queries read, once it has caught up; older generations are dropped. */
    readonly switchTo: (generation: number) => Effect.Effect<void, GenerationBehind>;
    /**
     * One page of an org's parties whose name contains `text`, ordered by
     * party id, from the active generation. A cursor the store did not
     * issue is refused with `InvalidCursor`.
     */
    readonly search: {
      (text: DirectoryText, page: Domain.Query.PageRequest): (org: OrgId) => Effect.Effect<Domain.Query.Page<DirectoryRow>, InvalidCursor>;
      (org: OrgId, text: DirectoryText, page: Domain.Query.PageRequest): Effect.Effect<Domain.Query.Page<DirectoryRow>, InvalidCursor>;
    };
  }
>()($I`PartyDirectoryStore`) {}

const byPartyId = Order.mapInput(Order.String, (row: DirectoryRow) => row.partyId);

const applyChange = (rows: HashMap.HashMap<PartyId, DirectoryRow>, change: DirectoryChange) =>
  DirectoryChange.match(change, {
    Registered: ({ partyId, org, name }) => HashMap.set(rows, partyId, DirectoryRow.make({ partyId, org, name })),
    Merged: ({ partyId, absorbed }) =>
      HashMap.modify(rows, partyId, (row) =>
        A.contains(row.absorbed, absorbed) ? row : { ...row, absorbed: A.append(row.absorbed, absorbed) },
      ),
  });

interface Generation {
  readonly rows: HashMap.HashMap<PartyId, DirectoryRow>;
  readonly checkpoints: HashMap.HashMap<string, number>;
}

interface Table {
  readonly active: O.Option<number>;
  readonly generations: HashMap.HashMap<number, Generation>;
}

const emptyGeneration: Generation = { rows: HashMap.empty(), checkpoints: HashMap.empty() };

const generationOf = (table: Table, generation: number) =>
  O.getOrElse(HashMap.get(table.generations, generation), () => emptyGeneration);

/** Apply one write unless the generation's checkpoint for its stream is at or past it. */
const applyWrite = (
  [applied, generation]: readonly [number, Generation],
  write: DirectoryWrite,
): readonly [number, Generation] =>
  O.exists(HashMap.get(generation.checkpoints, write.stream), (seq) => write.seq <= seq)
    ? [applied, generation]
    : [
        applied + 1,
        {
          rows: applyChange(generation.rows, write.change),
          checkpoints: HashMap.set(generation.checkpoints, write.stream, write.seq),
        },
      ];

/** The source streams where `candidate` has not applied what `active` has. */
const behindOf = (active: Generation, candidate: Generation) =>
  pipe(
    A.fromIterable(active.checkpoints),
    A.filter(([stream, seq]) => !O.exists(HashMap.get(candidate.checkpoints, stream), (at) => at >= seq)),
    A.map(([stream]) => stream),
  );

/**
 * The directory in memory: the twin stories and Api tests use. A fresh,
 * empty directory each time the Layer is built.
 *
 * **Example** (A story's store)
 * ```ts
 * import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
 * import { PartyHandlers } from "@proto/party-model/Party.handlers";
 * import * as Layer from "effect/Layer";
 *
 * const layer = PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MemoryPartyDirectoryStore = Layer.effect(
  PartyDirectoryStore,
  Effect.gen(function* () {
    const table = yield* Ref.make<Table>({ active: O.none(), generations: HashMap.empty() });
    return {
      apply: dual(
        2,
        Effect.fn("PartyDirectoryStore.apply")((writes: ReadonlyArray<DirectoryWrite>, generation: number) =>
          Ref.modify(table, (current): readonly [number, Table] => {
            if (O.exists(current.active, (active) => generation < active)) return [0, current];
            const [applied, next] = A.reduce(writes, [0, generationOf(current, generation)] as const, applyWrite);
            return [
              applied,
              {
                active: O.orElse(current.active, () => O.some(generation)),
                generations: HashMap.set(current.generations, generation, next),
              },
            ];
          }),
        ),
      ),
      active: Effect.map(Ref.get(table), (current) => current.active),
      checkpoints: Effect.fn("PartyDirectoryStore.checkpoints")((generation: number) =>
        Effect.map(Ref.get(table), (current) => generationOf(current, generation).checkpoints),
      ),
      switchTo: Effect.fn("PartyDirectoryStore.switchTo")((generation: number) =>
        Effect.flatMap(
          Ref.modify(table, (current): readonly [ReadonlyArray<string>, Table] => {
            const candidate = generationOf(current, generation);
            const behind = O.match(current.active, {
              onNone: A.empty<string>,
              onSome: (active) => behindOf(generationOf(current, active), candidate),
            });
            return A.isReadonlyArrayEmpty(behind)
              ? [
                  behind,
                  {
                    active: O.some(generation),
                    generations: HashMap.filter(current.generations, (_, at) => at >= generation),
                  },
                ]
              : [behind, current];
          }),
          (behind) =>
            A.isReadonlyArrayEmpty(behind) ? Effect.void : Effect.fail(GenerationBehind.make({ generation, behind })),
        ),
      ),
      search: dual(
        3,
        Effect.fn("PartyDirectoryStore.search")(function* (org: OrgId, text: DirectoryText, { after, take }: Domain.Query.PageRequest) {
          const from = yield* resumeAfter(after);
          const current = yield* Ref.get(table);
          const rows = O.match(current.active, {
            onNone: () => HashMap.empty<PartyId, DirectoryRow>(),
            onSome: (active) => generationOf(current, active).rows,
          });
          return yield* rows.pipe(
            HashMap.values,
            A.fromIterable,
            A.filter((row) => row.org === org && pipe(Str.toLowerCase(row.name), Str.includes(Str.toLowerCase(text)))),
            A.sort(byPartyId),
            A.filter((row) => !O.exists(from, (at) => row.partyId <= at)),
            pageOf(take),
          );
        }),
      ),
    };
  }),
);
