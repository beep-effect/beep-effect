/**
 * The verdict log: append-only verdict revisions on answers, kept in the
 * plugin store and exported as JSON lines for review.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeClaudeModId } from "@beep/identity/packages";
import { ReviewBatchId, ReviewItemId, Verdict, VerdictRow } from "@beep/law-practice-domain/values";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { ModHost } from "./PracticeMod.host.ts";
import { KgAnswerItem } from "./PracticeMod.values.ts";
import type { ModHostError } from "./PracticeMod.host.ts";

const $I = $PracticeClaudeModId.create("PracticeMod.verdicts");

const ItemsKey = "verdict-items";
const RowsKey = "verdict-rows/v2";
const LegacyRowsKey = "verdict-rows";

const StoredItems = S.Array(KgAnswerItem);
const StoredRows = S.Array(VerdictRow);
const RowLine = S.fromJsonString(VerdictRow);

class VerdictLocked extends S.TaggedError<VerdictLocked, { readonly brand: unique symbol }>($I`VerdictLocked`)(
  "VerdictLocked",
  { itemId: S.NonEmptyString },
  $I.annote("VerdictLocked", { description: "A verdict was refused because its item is locked." })
) {}

class VerdictStoreUnreadable extends S.TaggedError<VerdictStoreUnreadable, { readonly brand: unique symbol }>(
  $I`VerdictStoreUnreadable`
)(
  "VerdictStoreUnreadable",
  { key: S.NonEmptyString, message: S.String },
  $I.annote("VerdictStoreUnreadable", {
    description: "Stored verdict data failed to decode, so the log refuses to overwrite it.",
  })
) {}

type VerdictLogError = VerdictLocked | VerdictStoreUnreadable | ModHostError;

/**
 * **Example** (Prepare an undo revision)
 *
 * ```ts
 * import { VerdictInput } from "@/PracticeMod.verdicts"
 * import { KgAnswerItem } from "@/PracticeMod.values"
 * import * as O from "effect/Option"
 *
 * const item = KgAnswerItem.make({
 *   itemId: "kg-answer:s-1:t-1",
 *   sessionId: "s-1",
 *   turnId: "t-1",
 *   question: "What changed?",
 *   matter: O.none(),
 * })
 * const input = VerdictInput.make({ item, verdict: "withdrawn", note: O.none() })
 * console.log(input.verdict) // "withdrawn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerdictInput extends S.Opaque<VerdictInput, { readonly brand: unique symbol }>()(
  S.Struct({
    item: KgAnswerItem,
    verdict: Verdict,
    note: S.Option(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("VerdictInput", {
      description: "A verdict (withdrawn for undo) and an optional note on one answer.",
    })
  )
) {}

/**
 * The verdict log.
 *
 * **Example** (Read the latest revision of an answer)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { VerdictLog } from "@/PracticeMod.verdicts"
 *
 * const program = Effect.flatMap(VerdictLog, (log) => log.current("kg-answer:s-1:t-1"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VerdictLog extends Context.Service<
  VerdictLog,
  {
    readonly record: (input: VerdictInput) => Effect.Effect<VerdictRow, VerdictLogError>;
    readonly current: (itemId: string) => Effect.Effect<O.Option<VerdictRow>, VerdictLogError>;
    readonly exportJsonl: Effect.Effect<string, VerdictLogError>;
  }
>()($I`VerdictLog`) {}

const unreadable = (key: string) => (issue: unknown) => VerdictStoreUnreadable.make({ key, message: String(issue) });

const readStored = Effect.fn("VerdictLog.readStored")(function* <A, I>(
  host: ModHost["Service"],
  key: string,
  schema: S.Codec<ReadonlyArray<A>, I>
) {
  const raw = yield* host.storeGet(key);
  return raw === undefined
    ? A.empty<A>()
    : yield* S.decodeUnknownEffect(schema)(raw).pipe(Effect.mapError(unreadable(key)));
});

const writeStored = Effect.fn("VerdictLog.writeStored")(function* <A, I>(
  host: ModHost["Service"],
  key: string,
  schema: S.Codec<ReadonlyArray<A>, I>,
  values: ReadonlyArray<A>
) {
  const encoded = yield* S.encodeEffect(schema)(values).pipe(Effect.mapError(unreadable(key)));
  yield* host.storeSet(key, encoded);
});

const LegacyRow = S.Struct({
  schemaVersion: S.tag("practice-verdict/v1"),
  itemId: S.NonEmptyString.check(S.isPattern(/^kg-answer:.+:.+$/)),
  verdict: S.OptionFromNullOr(Verdict.pick(["right", "wrong", "partly"])),
  note: S.OptionFromNullOr(S.NonEmptyString),
  revision: S.Natural,
  recordedAt: S.DateTimeUtcFromString,
  lockedAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
}).pipe(
  $I.annoteSchema("LegacyVerdictRow", {
    description: "Legacy zero-based practice-verdict/v1 rows decoded before migration.",
  })
);

const legacyBatch = (itemId: string) =>
  ReviewBatchId.make(`session:${pipe(itemId, Str.slice(10), Str.split(":"), A.dropRight(1), A.join(":"))}`);

const MigratedRows = S.Array(LegacyRow).pipe(
  S.decodeTo(
    S.toType(StoredRows),
    SchemaTransformation.transform({
      decode: (rows): ReadonlyArray<VerdictRow> =>
        A.map(rows, (row, index) =>
          VerdictRow.make({
            itemId: ReviewItemId.make(row.itemId),
            batchId: legacyBatch(row.itemId),
            verdict: O.getOrElse(row.verdict, () => "withdrawn"),
            note: row.note,
            revision: 1 + A.filter(A.take(rows, index), (prior) => prior.itemId === row.itemId).length,
            recordedAt: row.recordedAt,
            lockedAt: row.lockedAt,
          })
        ),
      encode: (rows) =>
        A.map(rows, (row) => ({
          schemaVersion: "practice-verdict/v1",
          itemId: row.itemId,
          verdict: row.verdict === "withdrawn" ? O.none() : O.some(row.verdict),
          note: row.note,
          revision: S.Natural.make(row.revision - 1),
          recordedAt: row.recordedAt,
          lockedAt: row.lockedAt,
        })),
    })
  )
);

const currentVerdictFor = (rows: ReadonlyArray<VerdictRow>, itemId: string): O.Option<VerdictRow> =>
  A.reduce(rows, O.none<VerdictRow>(), (latest, row) =>
    row.itemId !== itemId || O.isSome(row.lockedAt)
      ? latest
      : O.match(latest, {
          onNone: () => O.some(row),
          onSome: (previous) =>
            DateTime.toEpochMillis(row.recordedAt) >= DateTime.toEpochMillis(previous.recordedAt)
              ? O.some(row)
              : latest,
        })
  );

const batchLocked = (rows: ReadonlyArray<VerdictRow>, batchId: string): boolean =>
  A.some(rows, (row) => row.batchId === batchId && O.isSome(row.lockedAt));

/**
 * Builds the verdict log over the mod host's store.
 *
 * **Example** (Reference the constructor)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeVerdictLog } from "@/PracticeMod.verdicts"
 *
 * console.log(Effect.isEffect(makeVerdictLog)) // true
 * ```
 *
 * **Gotchas**
 *
 * An item’s current verdict has the greatest recordedAt, with append order breaking ties. Lock rows never count as verdicts; revisions restart per batch and cannot break ties.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeVerdictLog = Effect.gen(function* () {
  const host = yield* ModHost;

  // decision: shared-plugin-write-permits
  const writes = yield* Semaphore.make(1);

  const readRows = Effect.fn("VerdictLog.readRows")(function* () {
    const rows = yield* readStored(host, RowsKey, StoredRows);
    if (A.isReadonlyArrayNonEmpty(rows)) return rows;
    const migrated = yield* readStored(host, LegacyRowsKey, MigratedRows);
    if (A.isReadonlyArrayNonEmpty(migrated)) yield* writeStored(host, RowsKey, StoredRows, migrated);
    return migrated;
  });

  const currentUnserialized = Effect.fn("VerdictLog.current")(function* (itemId: string) {
    const rows = yield* readRows();
    return currentVerdictFor(rows, itemId);
  });

  const recordUnserialized = Effect.fn("VerdictLog.record")(function* (input: VerdictInput) {
    const rows = yield* readRows();
    const batchId = ReviewBatchId.make(`session:${input.item.sessionId}`);
    if (batchLocked(rows, batchId)) {
      return yield* VerdictLocked.make({ itemId: input.item.itemId });
    }
    const row = VerdictRow.make({
      batchId,
      itemId: input.item.itemId,
      verdict: input.verdict,
      note: input.note,
      revision:
        1 +
        A.reduce(
          A.filter(rows, (row) => row.itemId === input.item.itemId && row.batchId === batchId),
          0,
          (max, row) => Num.max(max, row.revision)
        ),
      recordedAt: yield* host.now,
      lockedAt: O.none(),
    });
    const items = yield* readStored(host, ItemsKey, StoredItems);
    if (!A.some(items, (item) => item.itemId === input.item.itemId)) {
      yield* writeStored(host, ItemsKey, StoredItems, A.append(items, input.item));
    }
    yield* writeStored(host, RowsKey, StoredRows, A.append(rows, row));
    return row;
  });

  const exportUnserialized = Effect.gen(function* () {
    const rows = yield* readRows();
    const lines = yield* Effect.forEach(
      rows,
      (row) => S.encodeEffect(RowLine)(row).pipe(Effect.mapError(unreadable(RowsKey))),
      { concurrency: 1 }
    );
    return A.join(lines, "\n") + (lines.length > 0 ? "\n" : "");
  });

  const record = (input: VerdictInput) => Semaphore.withPermit(writes)(recordUnserialized(input));

  const current = (itemId: string) => Semaphore.withPermit(writes)(currentUnserialized(itemId));
  const exportJsonl = Semaphore.withPermit(writes)(exportUnserialized);
  return VerdictLog.of({ record, current, exportJsonl });
});

/**
 * The verdict log over the mod host's store.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { verdictLogLayer } from "@/PracticeMod.verdicts"
 *
 * console.log(Layer.isLayer(verdictLogLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const verdictLogLayer: Layer.Layer<VerdictLog, never, ModHost> = Layer.effect(VerdictLog)(makeVerdictLog);
