/**
 * File-backed mail-tagging state: the append-only JSONL tag and filing
 * ledgers and the atomically replaced backfill checkpoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  BackfillCheckpointJson,
  FilingLedgerEntryJsonLine,
  TagLedgerRecordJsonLine,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  BackfillCheckpointStore,
  BackfillCheckpointStoreShape,
  FilingLedger,
  FilingLedgerShape,
  TagLedger,
  TagLedgerShape,
} from "@beep/law-practice-use-cases/MailTagging";
import { Effect, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodeLines, makeStateFileAt } from "../internal/MailTaggingStateFile.ts";
import { MailTaggingStateLocation } from "./MailTagging.state.ts";
import type { MailTaggingStateStore } from "@beep/law-practice-use-cases/MailTagging";
import type { FileSystem } from "effect";

type StateRequirements = MailTaggingStateLocation | FileSystem.FileSystem | Path.Path;

type JsonLineCodec<A> = {
  readonly encode: (value: A) => Effect.Effect<string, S.SchemaError>;
  readonly decode: (line: string) => Effect.Effect<A, S.SchemaError>;
};

const makeStateFile = Effect.fn("MailTaggingState.makeStateFile")(function* (
  store: MailTaggingStateStore,
  file: string
) {
  const path = yield* Path.Path;
  const location = yield* MailTaggingStateLocation;
  return yield* makeStateFileAt(store, path.join(location.stateDirectory, file));
});

const makeJsonlLedger = Effect.fn("MailTaggingState.makeJsonlLedger")(function* <A>(
  store: MailTaggingStateStore,
  file: string,
  codec: JsonLineCodec<A>
) {
  const state = yield* makeStateFile(store, file);

  return {
    append: Effect.fn("MailTaggingState.appendLine")(function* (value: A) {
      const line = yield* Effect.mapError(codec.encode(value), state.unencodable);
      yield* state.append(`${line}\n`);
    }),
    read: Effect.flatMap(state.read, (text) =>
      decodeLines({ decode: codec.decode, corrupt: state.corrupt })(O.getOrElse(text, () => ""))
    ),
  };
});

const makeCheckpointStore = Effect.gen(function* () {
  const state = yield* makeStateFile("checkpoint", "checkpoint.json");
  const decode = S.decodeEffect(BackfillCheckpointJson);
  const encode = S.encodeEffect(BackfillCheckpointJson);

  return BackfillCheckpointStoreShape.make({
    load: Effect.flatMap(
      state.read,
      O.match({
        onNone: () => Effect.succeedNone,
        onSome: (text) => Effect.asSome(Effect.mapError(decode(text), state.corrupt(O.none()))),
      })
    ),
    save: Effect.fn("MailTaggingState.saveCheckpoint")(function* (checkpoint) {
      const text = yield* Effect.mapError(encode(checkpoint), state.unencodable);
      yield* state.replace(`${text}\n`);
    }),
  });
});

/**
 * Layer providing the tag ledger as `tag-ledger.jsonl` in the state
 * directory.
 *
 * **Details**
 *
 * `append` writes one JSON line and syncs the file. `records` reads the whole
 * file and decodes every non-empty line with the domain codec; a missing file
 * is an empty ledger. A line that does not decode fails the read with a
 * `MailTaggingStateError` naming the file and the 1-based line number, never
 * the line's content. The file has one writer: the tagging service.
 *
 * **Example** (Wire the tag ledger)
 *
 * ```ts
 * import { TagLedgerFile } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(TagLedgerFile)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TagLedgerFile: Layer.Layer<TagLedger, never, StateRequirements> = Layer.effect(
  TagLedger,
  Effect.map(
    makeJsonlLedger("tag-ledger", "tag-ledger.jsonl", {
      encode: S.encodeEffect(TagLedgerRecordJsonLine),
      decode: S.decodeEffect(TagLedgerRecordJsonLine),
    }),
    (ledger) => TagLedgerShape.make({ append: ledger.append, records: ledger.read })
  )
);

/**
 * Layer providing the filing ledger as `filing-ledger.jsonl` in the state
 * directory.
 *
 * **Details**
 *
 * Same contract as {@link TagLedgerFile}: synced appends, whole-file reads, a
 * missing file is empty, and an undecodable line fails closed with the file
 * and line number.
 *
 * **Example** (Wire the filing ledger)
 *
 * ```ts
 * import { FilingLedgerFile } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(FilingLedgerFile)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingLedgerFile: Layer.Layer<FilingLedger, never, StateRequirements> = Layer.effect(
  FilingLedger,
  Effect.map(
    makeJsonlLedger("filing-ledger", "filing-ledger.jsonl", {
      encode: S.encodeEffect(FilingLedgerEntryJsonLine),
      decode: S.decodeEffect(FilingLedgerEntryJsonLine),
    }),
    (ledger) => FilingLedgerShape.make({ append: ledger.append, entries: ledger.read })
  )
);

/**
 * Layer providing the backfill checkpoint as `checkpoint.json` in the state
 * directory.
 *
 * **Details**
 *
 * `save` writes `checkpoint.json.tmp`, syncs it, and renames it over the
 * checkpoint, so a reader sees the old document or the new one and never a
 * partial write. `load` answers none when the file does not exist and fails
 * closed when it does not decode.
 *
 * **Example** (Wire the checkpoint store)
 *
 * ```ts
 * import { BackfillCheckpointStoreFile } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(BackfillCheckpointStoreFile)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BackfillCheckpointStoreFile: Layer.Layer<BackfillCheckpointStore, never, StateRequirements> = Layer.effect(
  BackfillCheckpointStore,
  makeCheckpointStore
);

/**
 * Layer providing all three file-backed mail-tagging state ports.
 *
 * **Example** (Wire the state over a named directory)
 *
 * ```ts
 * import {
 *   MailTaggingStateConfig,
 *   MailTaggingStateFile,
 *   MailTaggingStateLocation
 * } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const State = MailTaggingStateFile.pipe(
 *   Layer.provide(
 *     Layer.succeed(
 *       MailTaggingStateLocation,
 *       MailTaggingStateConfig.make({ stateDirectory: "state/practice-mail-tagging" })
 *     )
 *   )
 * )
 * console.log(Layer.isLayer(State)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingStateFile: Layer.Layer<
  TagLedger | FilingLedger | BackfillCheckpointStore,
  never,
  StateRequirements
> = Layer.mergeAll(TagLedgerFile, FilingLedgerFile, BackfillCheckpointStoreFile);
