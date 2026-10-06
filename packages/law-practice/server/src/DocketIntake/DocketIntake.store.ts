/**
 * File-backed durable state of the docket intake service, and the plain-text
 * archive of its daily digests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketIntakeError, DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import type { LocalDate } from "@beep/schema/LocalDate";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.store");

const STATE_FILE = "state.json";
const DIGEST_DIRECTORY = "digests";

/**
 * Settings of the file-backed docket intake store.
 *
 * **Example** (Make store options)
 *
 * ```ts
 * import { DocketFileStoreOptions } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketFileStoreOptions.make({ directory: "state/docket-intake" }).directory);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketFileStoreOptions extends S.Class<DocketFileStoreOptions>($I`DocketFileStoreOptions`)(
  {
    directory: S.NonEmptyString.annotateKey({ description: "Directory that holds the state file and the digests." }),
  },
  $I.annote("DocketFileStoreOptions", { description: "Settings of the file-backed docket intake store." })
) {}

const StateJson = S.fromJsonString(DocketIntakeState);
const decodeState = S.decodeUnknownEffect(StateJson);
const encodeState = S.encodeUnknownEffect(StateJson);

const storeError = (cause: string) => () => DocketIntakeError.make({ cause, stage: "store" });

// Write beside the target and rename over it, so a reader never sees a half-written file.
const writeAtomically = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  contents: string
): Effect.fn.Return<void, DocketIntakeError> {
  const temporary = `${path}.tmp`;
  yield* fs.writeFileString(temporary, contents).pipe(Effect.mapError(storeError("write")));
  yield* fs.rename(temporary, path).pipe(Effect.mapError(storeError("rename")));
});

/**
 * Build the file-backed docket intake store.
 *
 * **Details**
 *
 * State lives in `state.json` inside the directory, which is created when the
 * layer is built. A missing file loads as empty state. A file that does not
 * decode fails the load at stage `store`; it is never replaced by empty state,
 * because that would silently forget the cursor and the ledger.
 *
 * **Example** (Make the file store layer)
 *
 * ```ts
 * import { DocketFileStoreOptions, makeDocketFileStoreLayer } from "@beep/law-practice-server/DocketIntake";
 *
 * const layer = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: "state/docket-intake" }));
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketFileStoreLayer = (
  options: DocketFileStoreOptions
): Layer.Layer<DocketIntakeStore, DocketIntakeError, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    DocketIntakeStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const statePath = path.join(options.directory, STATE_FILE);
      yield* fs.makeDirectory(options.directory, { recursive: true }).pipe(Effect.mapError(storeError("directory")));

      return DocketIntakeStore.of({
        load: Effect.gen(function* () {
          const exists = yield* fs.exists(statePath).pipe(Effect.mapError(storeError("stat")));
          if (!exists) {
            return DocketIntakeState.make({});
          }
          const contents = yield* fs.readFileString(statePath).pipe(Effect.mapError(storeError("read")));
          return yield* decodeState(contents).pipe(Effect.mapError(storeError("decode")));
        }).pipe(Effect.withSpan("DocketFileStore.load")),
        save: Effect.fn("DocketFileStore.save")(function* (state) {
          const contents = yield* encodeState(state).pipe(Effect.mapError(storeError("encode")));
          yield* writeAtomically(fs, statePath, contents);
        }),
      });
    }).pipe(Effect.withSpan("DocketFileStore.make"))
  );

/**
 * Save the text of one day's digest as `digests/<YYYY-MM-DD>.md` under the
 * store directory, replacing an earlier file for the same day.
 *
 * **Example** (Write a digest file)
 *
 * ```ts
 * import { writeDigestFile } from "@beep/law-practice-server/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const program = writeDigestFile({
 *   day: LocalDate.make({ year: 2030, month: 1, day: 9 }),
 *   directory: "state/docket-intake",
 *   text: "Docket intake digest for 2030-01-09."
 * });
 * console.log(program);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const writeDigestFile: (input: {
  readonly day: LocalDate;
  readonly directory: string;
  readonly text: string;
}) => Effect.Effect<string, DocketIntakeError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocketFileStore.writeDigestFile"
)(function* (input) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digests = path.join(input.directory, DIGEST_DIRECTORY);
  const file = path.join(digests, `${input.day.toISOString()}.md`);
  yield* fs.makeDirectory(digests, { recursive: true }).pipe(Effect.mapError(storeError("directory")));
  yield* writeAtomically(fs, file, input.text);
  return file;
});
