/**
 * One private mail-tagging file on disk: fail-closed reads, synced appends,
 * and atomic replacement, with failures that name the file and never its
 * content.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { MailTaggingStateStore } from "@beep/law-practice-use-cases/MailTagging";

const textEncoder = new TextEncoder();

const numbered = (line: string, index: number): readonly [number, string] => [index + 1, line];

const numberedLines = (text: string): ReadonlyArray<readonly [number, string]> =>
  A.filter(A.map(Str.split(text, "\n"), numbered), ([, line]) => Str.isNonEmpty(line));

/**
 * Opens one private file by its full path.
 *
 * **Details**
 *
 * `read` answers none when the file does not exist; `readRequired` fails with
 * an `unavailable` state error instead. `append` and `replace` create the
 * parent directory, write, and sync; `replace` goes through `<file>.tmp` and a
 * rename, so a reader sees the old document or the new one. Every failure
 * names the file by its base name, without its directory.
 *
 * **Example** (Open a ledger file)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeStateFileAt } from "./MailTaggingStateFile.ts"
 *
 * const ledger = makeStateFileAt("tag-ledger", "state/practice-mail-tagging/tag-ledger.jsonl")
 * console.log(Effect.isEffect(ledger)) // true
 * ```
 *
 * @internal
 * @param store - State the file holds, named in every failure.
 * @param target - Full path of the file.
 * @returns The file's read, append, and replace operations.
 * @category constructors
 * @since 0.0.0
 */
export const makeStateFileAt = Effect.fn("MailTaggingState.makeStateFileAt")(function* (
  store: MailTaggingStateStore,
  target: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.basename(target);
  const directory = path.dirname(target);
  const staging = `${target}.tmp`;
  const failing = (operation: string) =>
    Effect.mapError((cause: unknown) => MailTaggingStateError.unavailable(store, file, operation, cause));

  const write = (destination: string, flag: "a" | "w", text: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* fs.makeDirectory(directory, { recursive: true });
        const handle = yield* fs.open(destination, { flag });
        yield* handle.writeAll(textEncoder.encode(text));
        yield* handle.sync;
      })
    );

  const read = Effect.gen(function* () {
    const exists = yield* fs.exists(target);
    return exists ? O.some(yield* fs.readFileString(target)) : O.none<string>();
  }).pipe(failing("read"));

  return {
    corrupt: (line: O.Option<number>) => () => MailTaggingStateError.corrupt(store, file, line),
    unencodable: () => MailTaggingStateError.unavailable(store, file, "encode"),
    read,
    readRequired: Effect.flatMap(
      read,
      O.match({
        onNone: () => Effect.fail(MailTaggingStateError.unavailable(store, file, "read")),
        onSome: Effect.succeed,
      })
    ),
    append: (text: string) => write(target, "a", text).pipe(failing("append")),
    replace: (text: string) =>
      Effect.andThen(write(staging, "w", text), fs.rename(staging, target)).pipe(failing("save")),
  };
});

/**
 * Decodes every non-empty line of a JSONL text, failing closed on the first
 * line that does not decode.
 *
 * **Example** (Decode two lines)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeLines } from "./MailTaggingStateFile.ts"
 *
 * const lines = decodeLines({ decode: Effect.succeed<string>, corrupt: () => () => "corrupt" })("a\nb\n")
 * Effect.runPromise(lines).then(console.log) // ["a", "b"]
 * ```
 *
 * @internal
 * @param codec - Decoder of one line, and the failure for a 1-based line number that did not decode.
 * @returns A function from the whole file content to the decoded lines in file order.
 * @category constructors
 * @since 0.0.0
 */
export const decodeLines =
  <A, E, E2>(codec: {
    readonly decode: (line: string) => Effect.Effect<A, E>;
    readonly corrupt: (line: O.Option<number>) => () => E2;
  }) =>
  (text: string): Effect.Effect<ReadonlyArray<A>, E2> =>
    Effect.forEach(numberedLines(text), ([number, line]) =>
      Effect.mapError(codec.decode(line), codec.corrupt(O.some(number)))
    );
