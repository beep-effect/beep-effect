/**
 * Upload, list, download and delete GitHub Actions artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubActionsId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { unstubbed } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { misconfiguredDetail, resultsBackend } from "./internal/actionsResults.ts";
import { unzipCommand, zipCommand, zipManifest } from "./internal/archiveCommands.ts";
import { azureFileTransfer } from "./internal/azureBlob.ts";
import { digestFileHex } from "./internal/digest.ts";
import { detailText, framed, statusText } from "./internal/messageText.ts";
import { runnerServices } from "./internal/runnerServices.ts";
import { spawnOnce } from "./internal/spawn.ts";
import { CONFLICT, field, isOk, stringField, twirpCall, twirpFailureFields } from "./internal/twirp.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as HttpClient from "effect/http/HttpClient";
import type * as Path from "effect/Path";
import type * as ChildProcess from "effect/process/ChildProcess";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ActionEnvironment } from "./ActionEnvironment.ts";
import type { BlobTransferError, FileBlobTransfer } from "./BlobTransfer.ts";
import type { BackendIds } from "./internal/actionsResults.ts";
import type { RunnerServiceRequirements } from "./internal/runnerServices.ts";
import type { TwirpResult } from "./internal/twirp.ts";

const $I = $GithubActionsId.create("Artifact");

const Json = S.fromJsonString(S.Unknown);

/**
 * Raised when an artifact cannot be uploaded, listed, downloaded or deleted.
 *
 * **Example** (Describe a missing artifact)
 *
 * ```ts
 * import { ArtifactError } from "@beep/github-actions/Artifact";
 *
 * const error = ArtifactError.make({ reason: "notFound", artifact: "logs" });
 * console.log(error.message) // No artifact "logs" exists in this run
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ArtifactError extends S.TaggedError<ArtifactError, { readonly brand: unique symbol }>($I`ArtifactError`)(
  "ArtifactError",
  {
    /**
     * `misconfigured` — the results backend is not reachable from here (see
     * {@link Artifact}). `unreachable` — it could not be contacted, or answered
     * with something that is not a Twirp body. `refused` — it answered,
     * unhappily; re-uploading a name that already exists in the run is the
     * common case. `notFound` — no artifact by that name or id exists in this
     * run. `archiveFailed` — `zip` would not pack or unpack the files.
     * `transferFailed` — the archive itself did not move. `invalidOptions` — the
     * call cannot be made as asked.
     */
    reason: S.Literals([
      "misconfigured",
      "unreachable",
      "refused",
      "notFound",
      "archiveFailed",
      "transferFailed",
      "invalidOptions",
    ]).pipe(
      $I.annoteKey("ArtifactError.reason", {
        description:
          "`misconfigured` — the results backend is not reachable from here (see Artifact). `unreachable` — it could not be contacted, or answered with something that is not a Twirp body. `refused` — it answered, unhappily; re-uploading a name that already exists in the run is the common case. `notFound` — no artifact by that name or id exists in this run. `archiveFailed` — `zip` would not pack or unpack the files. `transferFailed` — the archive itself did not move. `invalidOptions` — the call cannot be made as asked.",
      })
    ),
    /** The artifact's name or id. A stable identifier, never a value. */
    artifact: S.optionalKey(S.String).pipe(
      $I.annoteKey("ArtifactError.artifact", {
        description: "The artifact's name or id. A stable identifier, never a value.",
      })
    ),
    /** The HTTP status, when the backend answered. */
    status: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("ArtifactError.status", { description: "The HTTP status, when the backend answered." })
    ),
    /** What went wrong, when the reason alone does not say. */
    detail: S.optionalKey(S.String).pipe(
      $I.annoteKey("ArtifactError.detail", { description: "What went wrong, when the reason alone does not say." })
    ),
    /** `zip`'s own complaint, which is the only useful part of an archive failure. */
    stderr: S.optionalKey(S.String).pipe(
      $I.annoteKey("ArtifactError.stderr", {
        description: "`zip`'s own complaint, which is the only useful part of an archive failure.",
      })
    ),
    /** The underlying failure, preserved structurally. */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("ArtifactError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<ArtifactError>("ArtifactError", {
    description: "Raised when an artifact cannot be uploaded, listed, downloaded or deleted.",
  })
) {
  /**
   * Explains the artifact failure with the available identifier, status and diagnostic details.
   *
   * **Example** (Read an artifact diagnostic)
   *
   * ```ts
   * import { ArtifactError } from "@beep/github-actions/Artifact";
   *
   * const error = ArtifactError.make({ reason: "notFound", artifact: "logs" });
   * console.log(error.message) // No artifact "logs" exists in this run
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const about = framed({ prefix: ' "', closing: '"' })(this.artifact);
    const detail = detailText(this.detail);
    return Match.value(this.reason).pipe(
      Match.when("misconfigured", () => `The artifact service is not reachable from here${detail}`),
      Match.when("unreachable", () => `The artifact service could not be reached${detail}`),
      Match.when("refused", () => `The artifact service refused${about}${statusText(this.status)}${detail}`),
      Match.when("notFound", () => `No artifact${about} exists in this run`),
      Match.when(
        "archiveFailed",
        () => `The artifact archive could not be built or extracted${about}${detailText(this.stderr)}`
      ),
      Match.when("transferFailed", () => `The artifact archive did not transfer${about}`),
      Match.when("invalidOptions", () => `The artifact call cannot be made as asked${detail}`),
      Match.exhaustive
    );
  }
}

/**
 * One artifact, as the backend describes it.
 *
 * **Example** (Decode an artifact listing row)
 *
 * ```ts
 * import { ArtifactItem } from "@beep/github-actions/Artifact";
 * import * as S from "effect/Schema";
 *
 * const item = S.decodeUnknownSync(ArtifactItem)({ id: 42, name: "logs", size: 128 });
 * console.log(item.name) // logs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
// A boundary struct preserves the backend's plain-record public representation.
export class ArtifactItem extends S.Opaque<ArtifactItem, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The database id, which is what `download` takes. */
    id: S.Finite.pipe(
      $I.annoteKey("ArtifactItem.id", { description: "The database id, which is what download takes." })
    ),
    /** The name the artifact was uploaded under. */
    name: S.String.pipe(
      $I.annoteKey("ArtifactItem.name", { description: "The name the artifact was uploaded under." })
    ),
    /** The size of the stored zip, in bytes. */
    size: S.Finite.pipe($I.annoteKey("ArtifactItem.size", { description: "The size of the stored zip, in bytes." })),
    /** When it was created, ISO-8601, when the backend says. */
    createdAt: S.String.pipe(
      S.UndefinedOr,
      S.optionalKey,
      $I.annoteKey("ArtifactItem.createdAt", { description: "When it was created, ISO-8601, when the backend says." })
    ),
  }).pipe($I.annoteSchema("ArtifactItem", { description: "One artifact, as the backend describes it." }))
) {}

/**
 * The decoded plain-record representation of an artifact listing row.
 *
 * @see {@link ArtifactItem} for the runtime schema used to validate backend rows.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArtifactItem {
  /**
   * The plain object a {@link ArtifactItem} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ArtifactItem.Encoded;
}

/**
 * How to pack an upload.
 *
 * **Details**
 *
 * This boundary struct preserves plain objects and rejects explicit undefined fields.
 * Schema decoding requires finite numbers; the upload operation also validates
 * positive retention and expiration range, and still clamps infinite compression.
 * Defaults are applied by the operation rather than added during schema decoding.
 *
 * **Example** (Validate upload options)
 *
 * ```ts
 * import { UploadOptions } from "@beep/github-actions/Artifact";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(UploadOptions)({ retentionDays: 7, compressionLevel: 6 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class UploadOptions extends S.Opaque<UploadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * How long to keep it, in days.
     *
     * **Details**
     *
     * Bounded by the repository's own retention setting; omitted means the
     * repository default. Zero or negative fails as `invalidOptions` rather than
     * being silently corrected, because "delete it immediately" and "keep it for
     * the default period" are too far apart to guess between.
     */
    retentionDays: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("UploadOptions.retentionDays", {
        description: "Positive finite retention in days; omitted uses the repository default.",
      })
    ),
    /**
     * The zlib level, 0–9, defaulting to 6 as `@actions/artifact` does.
     *
     * **Details**
     *
     * Out-of-range values are clamped. On Windows the level maps onto .NET's
     * `CompressionLevel`: `0` is `NoCompression`, `1..3` `Fastest`, `4..8`
     * `Optimal`, `9` `SmallestSize`.
     */
    compressionLevel: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("UploadOptions.compressionLevel", {
        description: "The zlib level, clamped to 0–9; omitted defaults to 6.",
      })
    ),
  }).pipe(
    $I.annoteSchema("UploadOptions", { description: "Plain-object options for artifact retention and compression." })
  )
) {}

/** The plain-object upload options validated by {@link UploadOptions}.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UploadOptions {
  /**
   * The plain object a {@link UploadOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UploadOptions.Encoded;
}

/**
 * What an upload produced: the new artifact's database id and the size of its zip.
 *
 * **Example** (Admit an upload result)
 *
 * ```ts
 * import { UploadResult } from "@beep/github-actions/Artifact";
 *
 * const result = UploadResult.make({ id: 4242, size: 128 });
 * console.log(result.id) // 4242
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class UploadResult extends S.Opaque<UploadResult, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The new artifact's database id, which `download` takes. */
    id: S.Finite.pipe(
      $I.annoteKey("UploadResult.id", { description: "The new artifact's database id, which download takes." })
    ),
    /** The size of the uploaded zip, in bytes. */
    size: S.Finite.pipe($I.annoteKey("UploadResult.size", { description: "The size of the uploaded zip, in bytes." })),
  }).pipe($I.annoteSchema("UploadResult", { description: "What an upload produced." }))
) {}

/**
 * What an upload produced, decoded as a plain record with a finite database id.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UploadResult {
  /**
   * The plain object a {@link UploadResult} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UploadResult.Encoded;
}

/**
 * Where a download should land.
 *
 * **Example** (Validate a download destination)
 *
 * ```ts
 * import { DownloadOptions } from "@beep/github-actions/Artifact";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DownloadOptions)({ path: "/work/output" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DownloadOptions extends S.Opaque<DownloadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The destination directory. A fresh temporary directory when omitted. */
    path: S.optionalKey(S.String).pipe(
      $I.annoteKey("DownloadOptions.path", {
        description: "Destination directory; omitted creates a fresh temporary directory.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DownloadOptions", {
      description: "Plain-object options specifying where an artifact download lands.",
    })
  )
) {}

/** The plain-object download options validated by {@link DownloadOptions}.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DownloadOptions {
  /**
   * The plain object a {@link DownloadOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DownloadOptions.Encoded;
}

/**
 * What a download produced.
 *
 * **Example** (Validate a download result)
 *
 * ```ts
 * import { DownloadResult } from "@beep/github-actions/Artifact";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DownloadResult)({ downloadPath: "/work/output" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DownloadResult extends S.Opaque<DownloadResult, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The directory the artifact's contents were extracted into. */
    downloadPath: S.String.pipe(
      $I.annoteKey("DownloadResult.downloadPath", {
        description: "The directory the artifact's contents were extracted into.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DownloadResult", {
      description: "The plain-object result naming an artifact's extraction directory.",
    })
  )
) {}

/** The plain-object download result validated by {@link DownloadResult}.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DownloadResult {
  /**
   * The plain object a {@link DownloadResult} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DownloadResult.Encoded;
}

/**
 * The database id of an artifact that `delete` removed.
 *
 * **Example** (Admit a deletion result)
 *
 * ```ts
 * import { ArtifactRef } from "@beep/github-actions/Artifact";
 *
 * const removed = ArtifactRef.make({ id: 11 });
 * console.log(removed.id) // 11
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ArtifactRef extends S.Opaque<ArtifactRef, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The deleted artifact's database id. */
    id: S.Finite.pipe($I.annoteKey("ArtifactRef.id", { description: "The deleted artifact's database id." })),
  }).pipe($I.annoteSchema("ArtifactRef", { description: "The id of an artifact that delete removed." }))
) {}

/**
 * The finite database id of an artifact that `delete` removed, decoded as a plain record.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArtifactRef {
  /**
   * The plain object a {@link ArtifactRef} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ArtifactRef.Encoded;
}

/**
 * The members of the {@link Artifact} service: upload, list, get, download and
 * delete, each failing with {@link ArtifactError}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ArtifactShape {
  /** Delete an artifact by name, answering with the id that is now gone. */
  readonly delete: (name: string) => Effect.Effect<ArtifactRef, ArtifactError>;
  /** Download an artifact by id and unzip it. Answers with where it landed. */
  readonly download: {
    (artifactId: number, options?: DownloadOptions.Encoded): Effect.Effect<DownloadResult, ArtifactError>;
    (options?: DownloadOptions.Encoded): (artifactId: number) => Effect.Effect<DownloadResult, ArtifactError>;
  };
  /** One artifact by name, or nothing — absent is not a failure. */
  readonly get: (name: string) => Effect.Effect<O.Option<ArtifactItem>, ArtifactError>;
  /** Every artifact in the current run. */
  readonly list: Effect.Effect<ReadonlyArray<ArtifactItem>, ArtifactError>;
  /**
   * Zip `files` — paths under `rootDirectory` — and upload them under `name`.
   *
   * **Details**
   *
   * Entries are stored relative to `rootDirectory`, so what a later download
   * extracts is the layout the caller meant rather than its absolute path on
   * whichever runner produced it. A name already used in this run is refused by
   * the backend: artifacts are immutable within a run.
   */
  readonly upload: {
    (
      name: string,
      files: ReadonlyArray<string>,
      rootDirectory: string,
      options?: UploadOptions.Encoded
    ): Effect.Effect<UploadResult, ArtifactError>;
    (
      files: ReadonlyArray<string>,
      rootDirectory: string,
      options?: UploadOptions.Encoded
    ): (name: string) => Effect.Effect<UploadResult, ArtifactError>;
  };
}

/** The Twirp service the artifact protocol lives under. */
const SERVICE = "github.actions.results.api.v1.ArtifactService";

/**
 * `CreateArtifact`'s `version` field.
 *
 * **Gotchas**
 *
 * `7`, read off `actions/toolkit`'s own upload path. It is a *protocol*
 * version, unrelated to the `v4` in `actions/upload-artifact@v4`, and guessing
 * it from the action's major version — which is the obvious guess — produces a
 * create the backend rejects.
 */
const ARTIFACT_VERSION = 7;

/** One row of a `ListArtifacts` answer, read under either field spelling. */
const toItem = Effect.fnUntraced(function* (row: unknown) {
  const createdAt = stringField(row, "createdAt");
  return yield* S.decodeEffect(ArtifactItem)({
    id: Number(stringField(row, "databaseId") ?? 0),
    name: stringField(row, "name") ?? "",
    size: Number(stringField(row, "size") ?? 0),
    ...O.getSomesStruct({ createdAt: O.fromUndefinedOr(createdAt) }),
  });
});

const make = Effect.fn("make")(function* (
  transfer: FileBlobTransfer
): Effect.fn.Return<ArtifactShape, never, RunnerServiceRequirements> {
  // Resolved once, at construction, so every member's `R` is `never`.
  const { http, fs, path, spawner, env, windows } = yield* runnerServices;

  const backend = (artifact: string) =>
    resultsBackend(env).pipe(
      Effect.mapError((name) =>
        ArtifactError.make({
          reason: "misconfigured",
          artifact,
          detail: misconfiguredDetail(name, "artifact service"),
        })
      ),
      Effect.flatMap((resolved) =>
        // The backend ids come from the runtime token's own scope claim, so a
        // token without one is a misconfiguration rather than a call failure —
        // and saying which is the difference between a fixable workflow and a
        // bug report.
        Result.isFailure(resolved.backendIds)
          ? Effect.fail(ArtifactError.make({ reason: "misconfigured", artifact, detail: resolved.backendIds.failure }))
          : Effect.succeed({
              baseUrl: resolved.baseUrl,
              token: resolved.token,
              ids: resolved.backendIds.success satisfies BackendIds,
            })
      )
    );

  const call: {
    (
      method: string,
      body: (ids: BackendIds) => Record<string, unknown>,
      artifact: string
    ): Effect.Effect<TwirpResult<unknown>, ArtifactError>;
    (
      body: (ids: BackendIds) => Record<string, unknown>,
      artifact: string
    ): (method: string) => Effect.Effect<TwirpResult<unknown>, ArtifactError>;
  } = dual(
    3,
    Effect.fn("call")(function* (method: string, body: (ids: BackendIds) => Record<string, unknown>, artifact: string) {
      const { baseUrl, ids, token } = yield* backend(artifact);
      return yield* twirpCall({
        http,
        baseUrl,
        service: SERVICE,
        token,
        method,
        body: { ...ids, ...body(ids) },
      }).pipe(Effect.mapError((failure) => ArtifactError.make({ ...twirpFailureFields(failure), artifact })));
    })
  );

  const listAll = Effect.fnUntraced(function* (artifact: string) {
    const answer = yield* call("ListArtifacts", () => ({}), artifact);
    if (answer === CONFLICT) {
      return [];
    }
    const rows = field(answer, "artifacts");
    return A.isArray(rows)
      ? yield* Effect.forEach(rows, toItem).pipe(
          Effect.mapError((cause) =>
            ArtifactError.make({
              ...twirpFailureFields({ method: "ListArtifacts", kind: "malformed", cause }),
              artifact,
            })
          )
        )
      : [];
  });

  /** Run an archiving command ONCE (`internal/spawn.ts`), keeping its stderr. */
  const archive: {
    (command: ChildProcess.Command, artifact: string): Effect.Effect<void, ArtifactError>;
    (artifact: string): (command: ChildProcess.Command) => Effect.Effect<void, ArtifactError>;
  } = dual(
    2,
    Effect.fn("archive")(function* (command: ChildProcess.Command, artifact: string) {
      const { output, code } = yield* spawnOnce(spawner, command).pipe(
        Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause }))
      );
      if (code !== 0) {
        return yield* ArtifactError.make({ reason: "archiveFailed", artifact, stderr: Str.trim(output) });
      }
    })
  );

  const scratch: {
    <A>(artifact: string, use: (directory: string) => Effect.Effect<A, ArtifactError>): Effect.Effect<A, ArtifactError>;
    <A>(
      use: (directory: string) => Effect.Effect<A, ArtifactError>
    ): (artifact: string) => Effect.Effect<A, ArtifactError>;
  } = dual(
    2,
    <A>(
      artifact: string,
      use: (directory: string) => Effect.Effect<A, ArtifactError>
    ): Effect.Effect<A, ArtifactError> =>
      Effect.acquireUseRelease(
        fs
          .makeTempDirectory({ prefix: "effected-artifact-" })
          .pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause }))),
        use,
        (directory) => Effect.ignore(fs.remove(directory, { recursive: true, force: true }))
      )
  );

  /**
   * The SHA-256 the backend finalizes against.
   *
   * **Details**
   *
   * Over the *stored zip*, streamed rather than read: an artifact is the one
   * payload in this package with no upper bound on size, and a runner has
   * roughly seven gigabytes of memory for everything.
   */
  const digestOf: {
    (file: string, artifact: string): Effect.Effect<string, ArtifactError>;
    (artifact: string): (file: string) => Effect.Effect<string, ArtifactError>;
  } = dual(
    2,
    (file: string, artifact: string): Effect.Effect<string, ArtifactError> =>
      digestFileHex(fs, file, "sha256").pipe(
        Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause }))
      )
  );

  const moved = (artifact: string) =>
    Effect.mapError((cause: BlobTransferError) => ArtifactError.make({ reason: "transferFailed", artifact, cause }));

  const zip: {
    (
      files: ReadonlyArray<string>,
      root: string,
      destination: string,
      level: number,
      artifact: string
    ): Effect.Effect<void, ArtifactError>;
    (
      root: string,
      destination: string,
      level: number,
      artifact: string
    ): (files: ReadonlyArray<string>) => Effect.Effect<void, ArtifactError>;
  } = dual(
    5,
    Effect.fn("zip")(function* (
      files: ReadonlyArray<string>,
      root: string,
      destination: string,
      level: number,
      artifact: string
    ) {
      // Stored relative to `rootDirectory`: `zip` records the paths exactly
      // as given, and the Windows script states each entry name explicitly
      // from the same relative path, so the two archives have one structure
      // — and absolute inputs would extract into a tree named after the
      // runner that produced them.
      const relative = A.map(files, (file) => path.relative(root, file));
      // The Windows list travels one path per line (`internal/archiveCommands.ts`
      // says why), so a path holding a line break cannot be represented.
      // Rejected on every platform: the same upload must not succeed on one
      // runner and fail on another.
      const unrepresentable = A.findFirst(relative, (file) => Str.includes("\n")(file) || Str.includes("\r")(file));
      if (O.isSome(unrepresentable)) {
        const quoted = yield* S.encodeEffect(Json)(unrepresentable.value).pipe(Effect.orDie);
        return yield* ArtifactError.make({
          reason: "invalidOptions",
          artifact,
          detail: `a file path may not contain a line break: ${quoted}`,
        });
      }
      // Beside the archive inside the scratch directory, so `scratch`'s
      // release removes it with the zip. `writeFileString` is UTF-8 with no
      // BOM, which is what `File.ReadAllLines` needs to read the first path
      // intact.
      const manifest = path.join(path.dirname(destination), "artifact.manifest");
      if (windows) {
        yield* fs
          .writeFileString(manifest, zipManifest(relative))
          .pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact, cause })));
      }
      yield* archive(zipCommand({ windows, root, files: relative, manifest, destination, level }), artifact);
    })
  );

  // One spelling with ToolInstaller.extractZip (`internal/archiveCommands.ts`):
  // the Windows half must use the overwrite overload, or a download into a
  // non-empty path fails with an empty stderr.
  const unzip: {
    (source: string, destination: string, artifact: string): Effect.Effect<void, ArtifactError>;
    (destination: string, artifact: string): (source: string) => Effect.Effect<void, ArtifactError>;
  } = dual(
    3,
    (source: string, destination: string, artifact: string): Effect.Effect<void, ArtifactError> =>
      archive(unzipCommand({ windows, source, destination }), artifact)
  );

  /** An `invalidOptions` failure for one artifact. */
  const invalidUpload = (artifact: string, detail: string) =>
    Effect.fail(ArtifactError.make({ reason: "invalidOptions", artifact, detail }));

  /**
   * The expiration `retentionDays` asks for, anchored now: positive, finite
   * and representable, or `Option.none()` for the repository default.
   */
  const retentionExpiry = Effect.fnUntraced(function* (
    name: string,
    retentionDays: number | undefined
  ): Effect.fn.Return<O.Option<DateTime.Utc>, ArtifactError> {
    if (retentionDays === undefined) {
      return O.none();
    }
    if (!S.is(S.Finite)(retentionDays) || retentionDays <= 0) {
      return yield* invalidUpload(
        name,
        "retentionDays must be positive and finite — omit it to use the repository default"
      );
    }
    const expiresAt = DateTime.make((yield* Clock.currentTimeMillis) + retentionDays * 86_400_000);
    return O.isNone(expiresAt)
      ? yield* invalidUpload(name, "retentionDays must produce a representable expiration")
      : expiresAt;
  });

  /**
   * Validate an upload before any scratch, archive, RPC or transfer, answering
   * its expiration: there must be files, the retention must be usable, and
   * `compressionLevel` must not be `NaN`.
   */
  const uploadExpiry = Effect.fnUntraced(function* (
    name: string,
    files: ReadonlyArray<string>,
    options: UploadOptions.Encoded | undefined
  ): Effect.fn.Return<O.Option<DateTime.Utc>, ArtifactError> {
    if (!A.isReadonlyArrayNonEmpty(files)) {
      return yield* invalidUpload(name, "no files were given to upload");
    }
    const expiresAt = yield* retentionExpiry(name, options?.retentionDays);
    if (options?.compressionLevel !== undefined && Num.Equivalence(options.compressionLevel, Number.NaN)) {
      return yield* invalidUpload(name, "compressionLevel must not be NaN");
    }
    return expiresAt;
  });

  /** A `refused` failure for one artifact. */
  const refusedUpload = (artifact: string, detail: string) =>
    Effect.fail(ArtifactError.make({ reason: "refused", artifact, detail }));

  /**
   * Create the artifact, move the packed zip to its signed URL and finalize it.
   * Unlike the cache, a create conflict is a real failure: a run may hold one
   * artifact per name, so the second upload is a mistake rather than a race
   * that resolved itself.
   */
  const uploadPacked = Effect.fnUntraced(function* (
    name: string,
    packed: string,
    expiresAt: O.Option<DateTime.Utc>
  ): Effect.fn.Return<UploadResult, ArtifactError> {
    const created = yield* call(
      "CreateArtifact",
      () => ({ name, version: ARTIFACT_VERSION, mimeType: "application/zip" }),
      name
    );
    if (created === CONFLICT || !isOk(created)) {
      return yield* refusedUpload(name, "an artifact with this name already exists in this run");
    }
    const url = stringField(created, "signedUploadUrl");
    if (url === undefined) {
      return yield* refusedUpload(name, "CreateArtifact returned no upload url");
    }
    yield* transfer.uploadFile(url, packed).pipe(moved(name));
    const size = yield* fs
      .stat(packed)
      .pipe(Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: name, cause })));
    const digest = yield* digestOf(packed, name);
    const finalized = yield* call(
      "FinalizeArtifact",
      () => ({
        name,
        size: String(size.size),
        hash: `sha256:${digest}`,
        ...O.getSomesStruct({ expiresAt: O.map(expiresAt, DateTime.formatIso) }),
      }),
      name
    );
    if (finalized === CONFLICT || !isOk(finalized)) {
      return yield* refusedUpload(name, "FinalizeArtifact did not confirm the upload");
    }
    return yield* S.decodeEffect(UploadResult)({
      id: Number(stringField(finalized, "artifactId") ?? 0),
      size: Number(size.size),
    }).pipe(
      Effect.mapError((cause) =>
        ArtifactError.make({
          ...twirpFailureFields({ method: "FinalizeArtifact", kind: "malformed", cause }),
          artifact: name,
        })
      )
    );
  });

  return {
    upload: dual(
      (args) => P.isString(args[0]),
      Effect.fn("Artifact.upload")(function* (
        name: string,
        files: ReadonlyArray<string>,
        rootDirectory: string,
        options?: UploadOptions.Encoded
      ) {
        yield* Effect.annotateCurrentSpan({ name });
        const expiresAt = yield* uploadExpiry(name, files, options);
        return yield* scratch(
          name,
          Effect.fnUntraced(function* (directory: string) {
            const packed = path.join(directory, "artifact.zip");
            yield* zip(files, rootDirectory, packed, options?.compressionLevel ?? 6, name);
            return yield* uploadPacked(name, packed, expiresAt);
          })
        );
      })
    ),

    list: Effect.suspend(
      Effect.fn("Artifact.list")(function* () {
        return yield* listAll("*");
      })
    ),

    get: Effect.fn("Artifact.get")(function* (name: string) {
      yield* Effect.annotateCurrentSpan({ name });
      const all = yield* listAll(name);
      return A.findFirst(all, (item) => item.name === name);
    }),

    download: dual(
      (args) => P.isNumber(args[0]),
      Effect.fn("Artifact.download")(function* (artifactId: number, options?: DownloadOptions.Encoded) {
        const label = String(artifactId);
        yield* Effect.annotateCurrentSpan({ artifactId });
        // The signed-url RPC takes a NAME, and a caller holds an id — so the
        // listing is how the two are reconciled, not an extra round trip that
        // could be optimized away.
        const all = yield* listAll(label);
        const found = yield* Effect.fromOption(
          A.findFirst(all, (item) => item.id === artifactId),
          () => ArtifactError.make({ reason: "notFound", artifact: label })
        );
        const signed = yield* call("GetSignedArtifactURL", () => ({ name: found.name }), label);
        const url = signed === CONFLICT ? undefined : stringField(signed, "signedUrl");
        if (url === undefined) {
          return yield* ArtifactError.make({
            reason: "refused",
            artifact: label,
            detail: "GetSignedArtifactURL returned no url",
          });
        }
        const destination = options?.path;
        const downloadPath =
          destination === undefined
            ? yield* fs
                .makeTempDirectory({ prefix: "effected-artifact-download-" })
                .pipe(
                  Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: label, cause }))
                )
            : yield* fs.makeDirectory(destination, { recursive: true }).pipe(
                Effect.as(destination),
                Effect.mapError((cause) => ArtifactError.make({ reason: "archiveFailed", artifact: label, cause }))
              );
        yield* scratch(
          label,
          Effect.fnUntraced(function* (directory: string) {
            const packed = path.join(directory, "artifact.zip");
            yield* transfer.downloadToFile(url, packed).pipe(moved(label));
            yield* unzip(packed, downloadPath, label);
          })
        );
        return DownloadResult.make({ downloadPath });
      })
    ),

    delete: Effect.fn("Artifact.delete")(function* (name: string) {
      yield* Effect.annotateCurrentSpan({ name });
      const all = yield* listAll(name);
      const found = yield* Effect.fromOption(
        A.findFirst(all, (item) => item.name === name),
        () => ArtifactError.make({ reason: "notFound", artifact: name })
      );
      const deleted = yield* call("DeleteArtifact", () => ({ name }), name);
      if (deleted === CONFLICT || !isOk(deleted)) {
        return yield* ArtifactError.make({
          reason: "refused",
          artifact: name,
          detail: "DeleteArtifact did not confirm",
        });
      }
      return yield* S.decodeEffect(ArtifactRef)({
        id: Number(stringField(deleted, "artifactId") ?? found.id),
      }).pipe(
        Effect.mapError((cause) =>
          ArtifactError.make({
            ...twirpFailureFields({ method: "DeleteArtifact", kind: "malformed", cause }),
            artifact: name,
          })
        )
      );
    }),
  } satisfies ArtifactShape;
});

const dies = unstubbed("Artifact.makeTest");

/**
 * Upload, list, download and delete GitHub Actions artifacts.
 *
 * **Gotchas**
 *
 * Speaks the artifact **Twirp v2** protocol at `ACTIONS_RESULTS_URL`, which
 * answers with a pre-signed Azure blob url for the zip. No `@actions/artifact`
 * dependency.
 *
 * **Only reachable from a `uses:` step**, like {@link ActionCache} — the two
 * variables it needs are injected into action execution contexts and not into
 * `run:` shell steps. The `Actions.Results` scope inside the runtime token is a
 * third thing that can be absent, and it is reported as `misconfigured` for the
 * same reason.
 *
 * **This surface is provisional.** It has not yet been shaped by a real call
 * site, so it may be reworked once a consumer adopts it. It covers the current
 * run only: there is no cross-run lookup, and adding one later would be
 * additive.
 *
 * **Example** (Upload a build log as an artifact)
 *
 * ```ts
 * import { Artifact } from "@beep/github-actions/Artifact";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const artifacts = yield* Artifact;
 *   return yield* artifacts.upload("logs", ["/tmp/build/log.txt"], "/tmp/build");
 * });
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Artifact extends Context.Service<Artifact, ArtifactShape>()($I`Artifact`) {
  /**
   * The service, over the real Azure client and the real `zip`.
   *
   * **Example** (Inspect the live artifact layer)
   *
   * ```ts
   * import { Artifact } from "@beep/github-actions/Artifact";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(Artifact.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    Artifact,
    never,
    | ActionEnvironment
    | HttpClient.HttpClient
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(this, make(azureFileTransfer));

  /**
   * The service, over a supplied transport.
   *
   * **Details**
   *
   * The protocol, the zip, the digest and the conflict handling are what this
   * package owns; the pre-signed `PUT` is not. Supplying the transport is what
   * lets a test exercise all of the first group without the second.
   *
   * A parameterized layer factory mints a fresh layer per call and layers
   * memoize by reference — bind it to a `const` rather than calling it at each
   * composition site.
   *
   * **Example** (Bind an artifact layer to a supplied transfer)
   *
   * ```ts
   * import { Artifact } from "@beep/github-actions/Artifact";
   * import * as Effect from "effect/Effect";
   * import * as Layer from "effect/Layer";
   * import { dual } from "effect/Function";
   *
   * const layer = Artifact.layerWith({
   *   uploadFile: dual(2, (_url: string, _file: string) => Effect.void),
   *   downloadToFile: dual(2, (_url: string, _file: string) => Effect.void),
   * });
   * console.log(Layer.isLayer(layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerWith = (
    transfer: FileBlobTransfer
  ): Layer.Layer<
    Artifact,
    never,
    | ActionEnvironment
    | HttpClient.HttpClient
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  > => Layer.effect(Artifact, make(transfer));

  /**
   * A test double. Unstubbed members die rather than reporting an empty run.
   *
   * **Example** (Stub an empty artifact listing)
   *
   * ```ts
   * import { Artifact } from "@beep/github-actions/Artifact";
   * import * as Effect from "effect/Effect";
   *
   * const artifacts = Artifact.makeTest({ list: Effect.succeed([]) });
   * console.log(Effect.runSync(artifacts.list).length) // 0
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<ArtifactShape> = {}): ArtifactShape => ({
    upload: dual(
      (args) => P.isString(args[0]),
      (
        _name: string,
        _files: ReadonlyArray<string>,
        _rootDirectory: string,
        _options?: UploadOptions.Encoded
      ): Effect.Effect<UploadResult, ArtifactError> => dies("upload")
    ),
    list: Effect.suspend(() => dies("list")),
    get: () => dies("get"),
    download: dual(
      (args) => P.isNumber(args[0]),
      (_artifactId: number, _options?: DownloadOptions.Encoded): Effect.Effect<DownloadResult, ArtifactError> =>
        dies("download")
    ),
    delete: () => dies("delete"),
    ...overrides,
  });

  /**
   * {@link Artifact.makeTest} behind `Layer.succeed`.
   *
   * **Example** (Provide an artifact listing test double)
   *
   * ```ts
   * import { Artifact } from "@beep/github-actions/Artifact";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.flatMap(Artifact, (artifacts) => artifacts.list);
   * const layer = Artifact.layerTest({ list: Effect.succeed([]) });
   * console.log(Effect.runSync(Effect.provide(program, layer)).length) // 0
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<ArtifactShape> = {}): Layer.Layer<Artifact> =>
    Layer.succeed(Artifact, Artifact.makeTest(overrides));
}
