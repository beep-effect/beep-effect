/**
 * Append-only workstation registry for PR-to-agent session history.
 *
 * **Gotchas**
 *
 * Registry rows contain local session identifiers and filesystem paths. They
 * must remain local and reach a PR body only through the public projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Config, Console, Context, Effect, FileSystem, Layer, Path, Ref, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PrSessionRecord } from "./Provenance.ts";
import type { PlatformError } from "effect";
import type { PrNumber, PrRepository } from "./Provenance.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PrSessionRegistry");

/**
 * Failure reason distinguishing filesystem, decoding, and permission errors.
 *
 * **Example** (Inspect registry failure reasons)
 *
 * ```ts
 * import { PrSessionRegistryErrorReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrSessionRegistryErrorReason.Options) // ["io", "decode", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrSessionRegistryErrorReason = LiteralKit(["io", "decode", "denied"]).pipe(
  $I.annoteSchema("PrSessionRegistryErrorReason", { description: "Failure category for local PR-session state." })
);

/**
 * Typed failure raised when local registry state cannot be encoded or accessed.
 *
 * **Example** (Construct a denied registry error)
 *
 * ```ts
 * import { PrSessionRegistryError } from "@beep/repo-cli/test/Yeet"
 *
 * const error = PrSessionRegistryError.make({
 *   reason: "denied",
 *   message: "Registry directory is not writable.",
 * })
 * console.log(error.reason) // "denied"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PrSessionRegistryError extends S.TaggedError<PrSessionRegistryError>($I`PrSessionRegistryError`)(
  "PrSessionRegistryError",
  { reason: PrSessionRegistryErrorReason, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<PrSessionRegistryError>("PrSessionRegistryError", {
    description: "A local PR-session registry operation failed.",
  })
) {
  override readonly [Runtime.errorExitCode] = 1;
}

/**
 * Service contract for appending and querying repository-scoped session history.
 *
 * **Details**
 *
 * `append` never replaces a prior row. `list` and `lookup` preserve the durable
 * history so selection and public projection can apply their own ordering rules.
 *
 * **Example** (Describe a repository lookup)
 *
 * ```ts
 * import { PrRepository } from "@beep/repo-cli/test/Yeet"
 * import type { PrSessionRegistryShape } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const lookupPr = (registry: PrSessionRegistryShape) => registry.lookup(repository, 42)
 * console.log(lookupPr.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PrSessionRegistryShape {
  readonly append: (record: PrSessionRecord) => Effect.Effect<void, PrSessionRegistryError>;
  readonly list: (repository: PrRepository) => Effect.Effect<ReadonlyArray<PrSessionRecord>, PrSessionRegistryError>;
  readonly lookup: (
    repository: PrRepository,
    pr: PrNumber
  ) => Effect.Effect<ReadonlyArray<PrSessionRecord>, PrSessionRegistryError>;
}

/**
 * Context service tag for append-only workstation session state.
 *
 * **Example** (Request repository history)
 *
 * ```ts
 * import { PrRepository, PrSessionRegistry } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const program = Effect.gen(function* () {
 *   const registry = yield* PrSessionRegistry
 *   return yield* registry.list(repository)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PrSessionRegistry extends Context.Service<PrSessionRegistry, PrSessionRegistryShape>()(
  $I`PrSessionRegistry`
) {}

const encodeRecord = S.encodeEffect(S.fromJsonString(PrSessionRecord));
const decodeRecord = S.decodeUnknownOption(S.fromJsonString(PrSessionRecord));

/**
 * Valid registry rows paired with the number of malformed non-empty lines.
 *
 * **Example** (Count a corrupt line)
 *
 * ```ts
 * import { decodePrSessionRegistry } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(decodePrSessionRegistry("not-json\n").corruptLineCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrSessionRegistryRead extends S.Class<PrSessionRegistryRead>($I`PrSessionRegistryRead`)(
  { records: S.Array(PrSessionRecord), corruptLineCount: S.Natural },
  $I.annote("PrSessionRegistryRead", { description: "Valid registry rows and the count of skipped corrupt lines." })
) {}

/**
 * Decode append-only JSON Lines content while counting malformed rows.
 *
 * **Example** (Keep valid decoding non-throwing)
 *
 * ```ts
 * import { decodePrSessionRegistry } from "@beep/repo-cli/test/Yeet"
 *
 * const decoded = decodePrSessionRegistry("not-json\n")
 * console.log(decoded.records.length) // 0
 * ```
 *
 * @param content - Raw registry JSON Lines content.
 * @returns Valid rows and a count of each skipped non-empty corrupt line.
 * @category decoding
 * @since 0.0.0
 */
export const decodePrSessionRegistry = (content: string): PrSessionRegistryRead =>
  PrSessionRegistryRead.make(
    A.reduce(
      A.filter(Str.split("\n")(content), Str.isNonEmpty),
      { records: A.empty<PrSessionRecord>(), corruptLineCount: 0 },
      (result, line) => {
        const decoded = decodeRecord(line);
        return O.isSome(decoded)
          ? { records: A.append(result.records, decoded.value), corruptLineCount: result.corruptLineCount }
          : { records: result.records, corruptLineCount: result.corruptLineCount + 1 };
      }
    )
  );
const mapPlatformError = (cause: PlatformError.PlatformError): PrSessionRegistryError =>
  PrSessionRegistryError.make({
    reason: cause.reason._tag === "PermissionDenied" ? "denied" : "io",
    message: cause.message,
    cause,
  });

const resolveRoot = Effect.fn("PrSessionRegistry.resolveRoot")(function* () {
  const configured = yield* Config.option(Config.string("BEEP_YEET_STATE_ROOT"));
  if (O.isSome(configured) && Str.isNonEmpty(Str.trim(configured.value))) return configured.value;
  const xdg = yield* Config.option(Config.string("XDG_STATE_HOME"));
  if (O.isSome(xdg) && Str.isNonEmpty(Str.trim(xdg.value))) return `${xdg.value}/beep/yeet`;
  const home = yield* Config.string("HOME");
  return `${home}/.local/state/beep/yeet`;
});

/**
 * Return the registry file name for a repository.
 *
 * **Example** (Build a registry key)
 *
 * ```ts
 * import { prSessionRegistryFileName, PrRepository } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(prSessionRegistryFileName(PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })))
 * ```
 *
 * @param repository - GitHub repository identity used to partition local session history.
 * @returns A repository-specific JSON Lines filename containing no local session data.
 * @category formatting
 * @since 0.0.0
 */
export const prSessionRegistryFileName = (repository: PrRepository): string =>
  `${repository.host}__${repository.owner}__${repository.name}.jsonl`;

/**
 * Construct the filesystem-backed registry service.
 *
 * **Example** (Build the live registry effect)
 *
 * ```ts
 * import { makePrSessionRegistryLive } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makePrSessionRegistryLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePrSessionRegistryLive = Effect.fn("PrSessionRegistry.makeLive")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* resolveRoot();
  const directory = path.join(root, "pr-sessions");
  const fileFor = (repository: PrRepository): string => path.join(directory, prSessionRegistryFileName(repository));
  const list = Effect.fn("PrSessionRegistry.list")((repository: PrRepository) =>
    fs.readFileString(fileFor(repository)).pipe(
      Effect.map(decodePrSessionRegistry),
      Effect.tap((result) =>
        result.corruptLineCount > 0
          ? Console.warn(`[yeet] skipped ${result.corruptLineCount} corrupt PR session registry line(s)`)
          : Effect.void
      ),
      Effect.map((result) => result.records),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(A.empty<PrSessionRecord>())
          : Effect.fail(mapPlatformError(error))
      )
    )
  );
  return PrSessionRegistry.of({
    append: Effect.fn("PrSessionRegistry.append")((record) =>
      encodeRecord(record).pipe(
        Effect.mapError((cause) =>
          PrSessionRegistryError.make({ reason: "decode", message: "Failed to encode PR session record.", cause })
        ),
        Effect.flatMap((encoded) =>
          fs
            .makeDirectory(directory, { recursive: true, mode: 0o700 })
            .pipe(
              Effect.andThen(fs.chmod(directory, 0o700)),
              Effect.andThen(
                fs.writeFileString(fileFor(record.repository), `${encoded}\n`, { flag: "a", mode: 0o600 })
              ),
              Effect.andThen(fs.chmod(fileFor(record.repository), 0o600)),
              Effect.mapError(mapPlatformError)
            )
        )
      )
    ),
    list,
    lookup: Effect.fn("PrSessionRegistry.lookup")((repository, pr) =>
      list(repository).pipe(Effect.map(A.filter((record) => O.isSome(record.prNumber) && record.prNumber.value === pr)))
    ),
  });
});

/**
 * Live filesystem registry layer.
 *
 * **Example** (Provide the live registry layer)
 *
 * ```ts
 * import { layerPrSessionRegistryLive, PrSessionRegistry } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const registry = yield* PrSessionRegistry
 *   return registry
 * }).pipe(Effect.provide(layerPrSessionRegistryLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPrSessionRegistryLive = Layer.effect(PrSessionRegistry, makePrSessionRegistryLive());

/**
 * In-memory registry layer for fixture-safe tests.
 *
 * **Example** (List fixture-safe in-memory state)
 *
 * ```ts
 * import {
 *   layerPrSessionRegistryMemory,
 *   PrRepository,
 *   PrSessionRegistry,
 * } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const program = Effect.gen(function* () {
 *   const registry = yield* PrSessionRegistry
 *   return yield* registry.list(repository)
 * }).pipe(Effect.provide(layerPrSessionRegistryMemory))
 * console.log(Effect.runSync(program).length) // 0
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const layerPrSessionRegistryMemory = Layer.effect(
  PrSessionRegistry,
  Ref.make(A.empty<PrSessionRecord>()).pipe(
    Effect.map((records) => {
      const list = Effect.fn("PrSessionRegistry.memory.list")((repository: PrRepository) =>
        Ref.get(records).pipe(
          Effect.map(
            A.filter(
              (record) =>
                record.repository.host === repository.host &&
                record.repository.owner === repository.owner &&
                record.repository.name === repository.name
            )
          )
        )
      );
      return PrSessionRegistry.of({
        append: Effect.fn("PrSessionRegistry.memory.append")((record) => Ref.update(records, A.append(record))),
        list,
        lookup: Effect.fn("PrSessionRegistry.memory.lookup")((repository, pr) =>
          list(repository).pipe(
            Effect.map(A.filter((record) => O.isSome(record.prNumber) && record.prNumber.value === pr))
          )
        ),
      });
    })
  )
);
