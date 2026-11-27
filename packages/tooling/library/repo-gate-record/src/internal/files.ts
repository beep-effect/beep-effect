/**
 * The file operations the record store runs on, over a platform file system
 * or over memory, so the store's rules are written once.
 *
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Random from "effect/Random";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Str from "effect/String";

/**
 * File operations on repository-relative paths.
 *
 * @since 0.0.0
 */
export interface RecordFiles {
  readonly listNames: (dir: string) => Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError>;
  readonly readText: (path: string) => Effect.Effect<O.Option<string>, PlatformError.PlatformError>;
  readonly remove: (path: string) => Effect.Effect<void, PlatformError.PlatformError>;
  readonly sink: (path: string) => Sink.Sink<void, Uint8Array, never, PlatformError.PlatformError>;
  readonly writeText: (path: string, text: string) => Effect.Effect<void, PlatformError.PlatformError>;
}

const TEMPORARY_ATTEMPTS = 8;

const isTaken = (error: PlatformError.PlatformError): boolean => error.reason._tag === "AlreadyExists";

/**
 * File operations over the platform file system, rooted at the repository.
 *
 * **Details**
 *
 * Every write first makes the parent directory. A text write goes to a
 * sibling temporary file reserved by exclusive creation (a taken name is
 * redrawn, up to eight times) and is renamed into place, so a reader never
 * sees half a record and overlapping writes never share a temporary file; a
 * failed write removes its temporary file.
 *
 * @since 0.0.0
 */
export const platformFiles = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = (relative: string): string => path.join(repoRoot, relative);
  const makeParent = (relative: string) => fs.makeDirectory(path.dirname(absolute(relative)), { recursive: true });
  const reserveTemporary = Effect.fnUntraced(function* (relative: string) {
    const suffix = yield* Random.nextIntBetween(0, 0x7fffffff);
    const temporary = absolute(`${relative}.${suffix.toString(36)}.tmp`);
    yield* fs.open(temporary, { flag: "wx" });
    return temporary;
  }, Effect.scoped);
  const files: RecordFiles = {
    sink: (relative) => Sink.unwrap(Effect.as(makeParent(relative), fs.sink(absolute(relative)))),
    writeText: Effect.fnUntraced(function* (relative: string, text: string) {
      yield* makeParent(relative);
      const temporary = yield* reserveTemporary(relative).pipe(
        Effect.retry({ while: isTaken, times: TEMPORARY_ATTEMPTS - 1 })
      );
      yield* fs.writeFileString(temporary, text).pipe(
        Effect.andThen(fs.rename(temporary, absolute(relative))),
        Effect.onError(() => Effect.ignore(fs.remove(temporary, { force: true })))
      );
    }),
    readText: (relative) =>
      Effect.flatMap(fs.exists(absolute(relative)), (present) =>
        present ? Effect.asSome(fs.readFileString(absolute(relative))) : Effect.succeedNone
      ),
    listNames: (dir) =>
      Effect.flatMap(fs.exists(absolute(dir)), (present) =>
        present ? fs.readDirectory(absolute(dir)) : Effect.succeed(A.empty<string>())
      ),
    remove: (relative) => fs.remove(absolute(relative), { force: true }),
  };
  return files;
});

const decodeChunks = (chunks: ReadonlyArray<Uint8Array>): string => {
  const decoder = new TextDecoder();
  return `${A.join(
    A.map(chunks, (chunk) => decoder.decode(chunk, { stream: true })),
    ""
  )}${decoder.decode()}`;
};

const encoder = new TextEncoder();

const childName = (dir: string) => (path: string) =>
  pipe(
    O.liftPredicate(path, Str.startsWith(`${dir}/`)),
    O.map(Str.slice(dir.length + 1)),
    O.filter((name) => !Str.includes("/")(name))
  );

/**
 * File operations over a map from repository-relative path to bytes.
 *
 * **Details**
 *
 * With `failWrites`, every write fails with a platform `Unknown` error and
 * leaves the map unchanged; reads and removals still work.
 *
 * @since 0.0.0
 */
export const memoryFiles = (input: {
  readonly files: Ref.Ref<HashMap.HashMap<string, ReadonlyArray<Uint8Array>>>;
  readonly failWrites: O.Option<string>;
}): RecordFiles => {
  const { files, failWrites } = input;
  const put = (path: string, chunks: ReadonlyArray<Uint8Array>) =>
    Ref.update(files, (map) => HashMap.set(map, path, chunks));
  const refuse = (method: string) =>
    O.map(failWrites, (description) =>
      PlatformError.systemError({ _tag: "Unknown", module: "FileSystem", method, description })
    );
  const guard = (method: string, write: Effect.Effect<void>) =>
    O.match(refuse(method), { onNone: () => write, onSome: Effect.fail });
  const appendAfterSinkReset = (path: string, chunk: Uint8Array) =>
    Ref.update(files, (map) => HashMap.modify(map, path, A.append(chunk)));
  return {
    sink: (path) =>
      O.match(refuse("sink"), {
        onSome: Sink.fail,
        onNone: () =>
          Sink.unwrap(
            Effect.as(
              put(path, A.empty()),
              Sink.forEach((chunk: Uint8Array) => appendAfterSinkReset(path, chunk))
            )
          ),
      }),
    writeText: (path, text) => guard("writeFileString", put(path, [encoder.encode(text)])),
    readText: (path) => Effect.map(Ref.get(files), (map) => O.map(HashMap.get(map, path), decodeChunks)),
    listNames: (dir) =>
      Effect.map(Ref.get(files), flow(HashMap.keys, A.fromIterable, A.map(childName(dir)), A.getSomes)),
    remove: (path) => Ref.update(files, (map) => HashMap.remove(map, path)),
  };
};
