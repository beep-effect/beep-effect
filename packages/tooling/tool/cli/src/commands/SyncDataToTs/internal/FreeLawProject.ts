/**
 * Shared helpers for pinned Free Law Project data archives.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as R from "effect/Record";
import { Parser } from "tar";
import { SyncDataToTsError } from "../SyncDataToTs.errors.ts";
import { formatJson } from "./Source.ts";
import type { ReadEntry } from "tar";
import type { SyncDataFetchedSource } from "./Source.ts";

/**
 * Assert that a fetched archive matches its pinned SHA-256 digest.
 *
 * @param options - Pinned digest and fetched source to validate.
 * @returns The fetched source when its digest matches the pin.
 * @category validation
 * @since 0.0.0
 */
export const assertPinnedArchive = (options: {
  readonly targetId: string;
  readonly source: SyncDataFetchedSource;
  readonly expectedSha256: string;
}): Effect.Effect<SyncDataFetchedSource, SyncDataToTsError> =>
  options.source.sha256 === options.expectedSha256
    ? Effect.succeed(options.source)
    : Effect.fail(
        SyncDataToTsError.make({
          message: `SHA-256 mismatch for ${options.source.url}: expected ${options.expectedSha256}, received ${options.source.sha256}.`,
          targetId: options.targetId,
        })
      );

/**
 * Extract selected UTF-8 files from a tar archive by unique path suffix.
 *
 * @param options - Archive bytes, required paths, and error context.
 * @returns The extracted UTF-8 text keyed by requested path suffix.
 * @category parsing
 * @since 0.0.0
 */
export const extractArchiveTextEntries = (options: {
  readonly targetId: string;
  readonly bytes: Uint8Array;
  readonly pathSuffixes: ReadonlyArray<string>;
  readonly errorMessage?: string;
}): Effect.Effect<Readonly<Record<string, string>>, SyncDataToTsError> =>
  Effect.callback<Readonly<Record<string, string>>, SyncDataToTsError>((resume) => {
    const entries = R.empty<string, string>();
    let openEntries = 0;
    let parserEnded = false;
    let completed = false;
    const matchingSuffix = (path: string) =>
      A.findFirst(options.pathSuffixes, (suffix) => {
        const rootRelativeSuffix = Str.startsWith("/")(suffix) ? Str.slice(1)(suffix) : suffix;
        return path === rootRelativeSuffix || Str.endsWith(`/${rootRelativeSuffix}`)(path);
      });
    const parser = new Parser({
      strict: true,
      filter: (path) => matchingSuffix(path)._tag === "Some",
    });
    const failWith = (message: string, cause?: unknown, file?: string) => {
      if (completed) {
        return;
      }
      completed = true;
      resume(
        Effect.fail(
          SyncDataToTsError.make({
            message,
            targetId: options.targetId,
            ...O.getSomesStruct({
              cause: O.fromUndefinedOr(cause),
              file: O.fromUndefinedOr(file),
            }),
          })
        )
      );
    };
    const fail = (cause: unknown) =>
      failWith(options.errorMessage ?? "Failed to extract pinned Free Law Project archive.", cause);
    const finish = () => {
      if (completed || !parserEnded || openEntries > 0) {
        return;
      }

      const missing = A.filter(options.pathSuffixes, (suffix) => !R.has(entries, suffix));
      if (A.length(missing) > 0) {
        failWith(`Archive is missing required entries: ${A.join(missing, ", ")}.`);
        return;
      }

      completed = true;
      resume(Effect.succeed(entries));
    };
    const collectEntry = (entry: ReadEntry) => {
      const suffix = matchingSuffix(entry.path);
      if (suffix._tag === "None") {
        entry.resume();
        return;
      }
      if (R.has(entries, suffix.value)) {
        failWith(`Archive contains duplicate entry for ${suffix.value}.`, undefined, entry.path);
        entry.resume();
        return;
      }

      openEntries += 1;
      const chunks = A.empty<Buffer>();
      entry.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      entry.on("error", (cause) =>
        failWith(options.errorMessage ?? "Failed to extract pinned Free Law Project archive.", cause, entry.path)
      );
      entry.on("end", () => {
        entries[suffix.value] = Buffer.concat(chunks).toString("utf8");
        openEntries -= 1;
        finish();
      });
    };

    parser.on("entry", collectEntry);
    parser.on("error", fail);
    parser.on("end", () => {
      parserEnded = true;
      finish();
    });
    parser.end(Buffer.from(options.bytes));
  });

/**
 * Render an internal generated module that decodes canonical JSON through Effect Schema.
 *
 * @param options - Export name, JSON value, and refresh command to render.
 * @returns A deterministic TypeScript module containing the encoded JSON.
 * @category formatting
 * @since 0.0.0
 */
export const renderUnknownJsonModule = (options: {
  readonly exportName: string;
  readonly value: unknown;
  readonly refreshCommand: string;
}): string => {
  const encodedJsonText = pipe(options.value, formatJson, formatJson, Str.trimEnd);

  return `/**
 * Generated from a pinned Free Law Project data archive.
 *
 * Refresh with \`${options.refreshCommand}\`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Result } from "effect";
import { Unknown } from "@beep/schema/Unknown";

const decodeJson = Unknown.decodeUnknownResultFromJsonString;

/**
 * Schema-decoded generated data.
 *
 * @category constants
 * @since 0.0.0
 */
export const ${options.exportName}: unknown = Result.getOrThrow(decodeJson(${encodedJsonText}));
`;
};
