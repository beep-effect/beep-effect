/**
 * Deterministic pffexport email-header projection for the practice KG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { parseOutlookHeaders, rfc5322DateFromOutlookTimestamp } from "@beep/libpff";
import { NonNegativeInt } from "@beep/schema";
import { FileInfo } from "@beep/schema/FileInfo";
import { thunk0, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Str from "effect/String";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { stripPrefix } from "./PracticeKg.rows.ts";
import { PracticeKgEmailHeaderRow } from "./PracticeKg.schemas.ts";

const headerValue = (headers: Readonly<Record<string, string>>, key: string): O.Option<string> =>
  pipe(O.fromUndefinedOr(headers[key]), O.filter(Str.isNonEmpty));

const outlookTimestampToIso = (value: string): O.Option<string> =>
  pipe(rfc5322DateFromOutlookTimestamp(value), O.flatMap(DateTime.make), O.map(DateTime.formatIso));

const recipientsFromText = (text: string): string =>
  pipe(
    Str.split("\n")(text),
    A.map((line) =>
      pipe(
        Str.indexOf(":")(line),
        O.filter((separator) => separator > 0),
        O.map((separator) => Str.trim(Str.slice(separator + 1)(line))),
        O.filter(Str.isNonEmpty)
      )
    ),
    A.getSomes,
    A.join(" | ")
  );

const messageOrdinal = (directoryName: string): number =>
  pipe(
    Str.match(/(\d+)$/u)(directoryName),
    O.flatMap(A.get(1)),
    O.map(Number),
    O.filter(Number.isFinite),
    O.getOrElse(thunk0)
  );

const archiveDigestFromDirectory = flow(
  stripPrefix("artifact:"),
  O.map(Str.replace(/\.(?:export|orphans|recovered)$/u, "")),
  O.filter(Str.isNonEmpty),
  O.map((digest) => (Str.startsWith("sha256:")(digest) ? digest : `sha256:${digest}`))
);

const walkForHeaderFiles = Effect.fn("PracticeKg.walkForHeaderFiles")(function* (
  root: string,
  canonicalRoot: string
): Effect.fn.Return<ReadonlyArray<string>, PracticeKgProjectionError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(root)
    .pipe(PracticeKgProjectionError.mapError(`Failed reading pffexport directory "${root}".`));
  const children = yield* Effect.forEach(
    A.sort(entries, Order.String),
    Effect.fnUntraced(function* (entry) {
      const absolute = path.join(root, entry);
      const canonical = yield* resolvePathWithinCanonicalRoot({
        canonicalRoot,
        candidate: path.relative(canonicalRoot, absolute),
      }).pipe(PracticeKgProjectionError.mapError(`Failed resolving "${absolute}".`));
      if (!Eq.equals(path.resolve(absolute), canonical)) {
        return A.empty<string>();
      }
      const info = yield* fs
        .stat(canonical)
        .pipe(PracticeKgProjectionError.mapError(`Failed inspecting "${absolute}".`));
      if (FileInfo.guards.Directory(info)) {
        return yield* walkForHeaderFiles(canonical, canonicalRoot);
      }
      return FileInfo.guards.File(info) && entry === "OutlookHeaders.txt" ? A.of(canonical) : A.empty<string>();
    })
  );
  return A.flatten(children);
});

const readEmailArchiveRows = Effect.fn("PracticeKg.readEmailArchiveRows")(function* (
  archiveRoot: string,
  archiveDigest: string
): Effect.fn.Return<
  ReadonlyArray<PracticeKgEmailHeaderRow>,
  PracticeKgProjectionError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const archiveInfo = yield* fs
    .stat(archiveRoot)
    .pipe(PracticeKgProjectionError.mapError(`Failed inspecting email archive export "${archiveRoot}".`));
  if (!FileInfo.guards.Directory(archiveInfo)) {
    return A.empty();
  }
  const canonicalArchiveRoot = yield* fs
    .realPath(archiveRoot)
    .pipe(PracticeKgProjectionError.mapError(`Failed resolving email archive export "${archiveRoot}".`));
  const headerPaths = yield* walkForHeaderFiles(canonicalArchiveRoot, canonicalArchiveRoot);
  return yield* Effect.forEach(
    A.sort(headerPaths, Order.String),
    Effect.fnUntraced(function* (headersPath) {
      const messageDir = path.dirname(headersPath);
      const relativeMessagePath = pipe(path.relative(archiveRoot, messageDir), Str.replaceAll("\\", "/"));
      const folderPath = pipe(path.dirname(relativeMessagePath), Str.replaceAll("\\", "/"));
      const headersText = yield* fs
        .readFileString(headersPath)
        .pipe(PracticeKgProjectionError.mapError(`Failed reading "${headersPath}".`));
      const recipientsPath = path.join(messageDir, "Recipients.txt");
      const recipientsText = yield* resolvePathWithinCanonicalRoot({
        canonicalRoot: canonicalArchiveRoot,
        candidate: path.relative(canonicalArchiveRoot, recipientsPath),
      }).pipe(
        Effect.filterOrFail(
          (canonical) => Eq.equals(path.resolve(recipientsPath), canonical),
          () => PracticeKgProjectionError.make({ message: `Refused linked recipients file "${recipientsPath}".` })
        ),
        Effect.flatMap(fs.readFileString),
        Effect.orElseSucceed(thunkEmptyStr)
      );
      const headers = parseOutlookHeaders(headersText);
      return PracticeKgEmailHeaderRow.make({
        archiveDigest,
        folderPath: folderPath === "." ? "" : folderPath,
        messageOrd: NonNegativeInt.make(messageOrdinal(path.basename(messageDir))),
        messageRelPath: relativeMessagePath,
        recipients: recipientsFromText(recipientsText),
        subject: O.getOrElse(headerValue(headers, "Subject"), thunkEmptyStr),
        ...O.getSomesStruct({
          conversationTopic: headerValue(headers, "Conversation topic"),
          deliveryIso: O.flatMap(headerValue(headers, "Delivery time"), outlookTimestampToIso),
          senderEmail: headerValue(headers, "Sender email address"),
          senderName: headerValue(headers, "Sender name"),
          submitIso: O.flatMap(headerValue(headers, "Client submit time"), outlookTimestampToIso),
        }),
      });
    })
  );
});

/**
 * Parse all pffexport message directories into deterministic headers-only rows.
 *
 * **Details**
 *
 * A missing `childrenRoot` yields an empty array rather than a failure, so a
 * corpus with no mail archives needs no special-casing at the call site. Message
 * bodies are never opened — only headers — which is what keeps the pass cheap
 * and its output stable across reruns.
 *
 * **Example** (Usage)
 * ```ts
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Effect } from "effect"
 * import * as A from "effect/Array"
 * import { readEmailRows } from "../../src/PracticeKg.emails.ts"
 *
 * const subjects = readEmailRows("/corpus/staging/extract/children").pipe(
 *   Effect.map(A.map((row) => `${row.archiveDigest} ${row.subject}`)),
 *   Effect.provide(BunServices.layer)
 * )
 *
 * Effect.runPromise(subjects).then((lines) => console.log(lines.length))
 * ```
 *
 * @param childrenRoot - Extract children directory containing artifact export trees.
 * @returns Rows ordered by archive digest, folder path, and message ordinal.
 * @effects Reads only `OutlookHeaders.txt` and `Recipients.txt` files.
 * @category use-cases
 * @since 0.0.0
 */
export const readEmailRows = Effect.fn("PracticeKg.readEmailRows")(function* (
  childrenRoot: string
): Effect.fn.Return<
  ReadonlyArray<PracticeKgEmailHeaderRow>,
  PracticeKgProjectionError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootExists = yield* fs.exists(childrenRoot).pipe(Effect.orElseSucceed(thunkFalse));
  if (!rootExists) {
    return A.empty();
  }
  const archiveEntries = A.sort(
    yield* fs
      .readDirectory(childrenRoot)
      .pipe(PracticeKgProjectionError.mapError(`Failed reading extract children root "${childrenRoot}".`)),
    Order.String
  );
  const rows = yield* Effect.forEach(archiveEntries, (archiveEntry) =>
    O.match(archiveDigestFromDirectory(archiveEntry), {
      onNone: () => Effect.succeed(A.empty<PracticeKgEmailHeaderRow>()),
      onSome: (archiveDigest) => readEmailArchiveRows(path.join(childrenRoot, archiveEntry), archiveDigest),
    })
  );
  return A.sort(
    A.flatten(rows),
    Order.mapInput(
      Order.String,
      (row: PracticeKgEmailHeaderRow) => `${row.archiveDigest}\u0000${row.folderPath}\u0000${row.messageOrd}`
    )
  );
});
