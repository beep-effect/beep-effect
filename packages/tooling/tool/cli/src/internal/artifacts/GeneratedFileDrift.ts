/**
 * Shared write/check lifecycle for deterministic generated files.
 *
 * **Details**
 *
 * Commands that own a committed generated file (`Lint/SchemaCatalog`,
 * `Fallow` boundaries) share one skeleton: reject the mutually-exclusive
 * `--write`/`--check` combination, then either render-and-write the file or
 * compare the committed copy against freshly rendered content and fail stale
 * with a regeneration-command message. {@link assertExclusiveModeFlags},
 * {@link writeGeneratedFile}, {@link checkGeneratedFile}, and
 * {@link syncGeneratedFile} reproduce that flow while leaving the emitted
 * strings and failure effect to the caller.
 *
 * Deterministic content rendering, per-target diffing (`SyncDataToTs`), and
 * per-file JSONC edits (`TsconfigSync`) stay in their commands; this skeleton
 * covers the single-file render→write/check shape only. `Fallow` folds a
 * missing file into its read-error branch rather than a separate existence
 * check; see the divergence catalog in the wave report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, Path } from "effect";

/**
 * Reject the mutually-exclusive `--write` / `--check` flag combination.
 *
 * **Example** (Validate exclusive mode flags)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { assertExclusiveModeFlags } from "@beep/repo-cli/test/Artifacts"
 *
 * const program = assertExclusiveModeFlags({
 *   write: true,
 *   check: false,
 *   onConflict: Effect.fail(new Error("choose either --write or --check"))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param input - The two mode flags and the conflict failure effect.
 * @returns Effect that fails with `onConflict` when both flags are set.
 * @category validation
 * @since 0.0.0
 */
export const assertExclusiveModeFlags = <E, R>(input: {
  readonly write: boolean;
  readonly check: boolean;
  readonly onConflict: Effect.Effect<never, E, R>;
}): Effect.Effect<void, E, R> => (input.write && input.check ? input.onConflict : Effect.void);

/**
 * Make the parent directory, write rendered content, then run the caller's
 * success effect.
 *
 * **Example** (Write then run success)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { writeGeneratedFile } from "@beep/repo-cli/test/Artifacts"
 *
 * const program = writeGeneratedFile({
 *   path: "/repo/standards/schema-catalog.generated.jsonc",
 *   content: "// generated\n{}\n",
 *   onWrote: Console.log("[schema-catalog] wrote standards/schema-catalog.generated.jsonc"),
 *   onError: (cause) => new Error(String(cause))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param input - Absolute path, rendered content, a post-write effect (for
 * example the `wrote ...` log), and an fs error factory.
 * @returns Effect that writes the generated file.
 * @category filesystem
 * @since 0.0.0
 */
export const writeGeneratedFile = Effect.fn("GeneratedFileDrift.writeGeneratedFile")(function* <E, R>(input: {
  readonly path: string;
  readonly content: string;
  readonly onWrote: Effect.Effect<void, E, R>;
  readonly onError: (cause: unknown) => E;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(input.path), { recursive: true }).pipe(Effect.mapError(input.onError));
  yield* fs.writeFileString(input.path, input.content).pipe(Effect.mapError(input.onError));
  yield* input.onWrote;
});

/**
 * Compare a committed generated file against freshly rendered content and route
 * to the missing, stale, or current branch.
 *
 * **Example** (Route missing stale current)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { checkGeneratedFile } from "@beep/repo-cli/test/Artifacts"
 *
 * const regenerate = "bun run beep lint schema-catalog --write"
 * const program = checkGeneratedFile({
 *   path: "/repo/standards/schema-catalog.generated.jsonc",
 *   content: "// generated\n{}\n",
 *   onMissing: Effect.fail(new Error(`missing; run ${regenerate}`)),
 *   onStale: Effect.fail(new Error(`stale; run ${regenerate}`)),
 *   onCurrent: Console.log("[schema-catalog] up to date"),
 *   onError: (cause) => new Error(String(cause))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param input - Absolute path, expected content, the three outcome effects,
 * and an fs read error factory.
 * @returns Effect that fails stale (or missing) with the caller's failure
 * effect, or succeeds when the committed file matches.
 * @category filesystem
 * @since 0.0.0
 */
export const checkGeneratedFile = Effect.fn("GeneratedFileDrift.checkGeneratedFile")(function* <E, R>(input: {
  readonly path: string;
  readonly content: string;
  readonly onMissing: Effect.Effect<never, E, R>;
  readonly onStale: Effect.Effect<never, E, R>;
  readonly onCurrent: Effect.Effect<void, E, R>;
  readonly onError: (cause: unknown) => E;
}) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(input.path).pipe(Effect.mapError(input.onError));
  if (!exists) {
    return yield* input.onMissing;
  }

  const current = yield* fs.readFileString(input.path).pipe(Effect.mapError(input.onError));
  if (current !== input.content) {
    return yield* input.onStale;
  }

  return yield* input.onCurrent;
});

/**
 * Dispatch a single generated file to {@link writeGeneratedFile} in write mode
 * or {@link checkGeneratedFile} otherwise.
 *
 * **Example** (Check mode without write)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { syncGeneratedFile } from "@beep/repo-cli/test/Artifacts"
 *
 * const program = syncGeneratedFile({
 *   write: false,
 *   path: "/repo/standards/fallow.boundaries.generated.jsonc",
 *   content: "{}\n",
 *   onWrote: Console.log("fallow boundaries: wrote config"),
 *   onMissing: Effect.fail(new Error("generated config is missing")),
 *   onStale: Effect.fail(new Error("generated config drift detected")),
 *   onCurrent: Console.log("fallow boundaries: up to date"),
 *   onError: (cause) => new Error(String(cause))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param input - The `write` flag plus the write-mode and check-mode fields.
 * @returns Effect running the selected branch.
 * @category filesystem
 * @since 0.0.0
 */
export const syncGeneratedFile = <E, R>(input: {
  readonly write: boolean;
  readonly path: string;
  readonly content: string;
  readonly onWrote: Effect.Effect<void, E, R>;
  readonly onMissing: Effect.Effect<never, E, R>;
  readonly onStale: Effect.Effect<never, E, R>;
  readonly onCurrent: Effect.Effect<void, E, R>;
  readonly onError: (cause: unknown) => E;
}): Effect.Effect<void, E, FileSystem.FileSystem | Path.Path | R> =>
  input.write
    ? writeGeneratedFile({ path: input.path, content: input.content, onWrote: input.onWrote, onError: input.onError })
    : checkGeneratedFile({
        path: input.path,
        content: input.content,
        onMissing: input.onMissing,
        onStale: input.onStale,
        onCurrent: input.onCurrent,
        onError: input.onError,
      });
