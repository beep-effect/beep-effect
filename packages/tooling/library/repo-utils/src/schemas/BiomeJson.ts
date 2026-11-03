/**
 * Shared Biome-backed JSON rendering for repo-managed config files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeModule from "node:module";
import * as NodeURL from "node:url";
import { Str, thunkEmptyStr } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { DomainError } from "../errors/index.ts";
import { findRepoRoot } from "../Root.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const require = NodeModule.createRequire(import.meta.url);
const biomeExecutable = require.resolve("@biomejs/biome/bin/biome");
const moduleDir = NodeURL.fileURLToPath(new URL(".", import.meta.url));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (text: string, chunk) => `${text}${chunk}`)
  );

// Biome reads the VCS ignore files (`.gitignore`, `.git/info/exclude`) for every
// path it is handed. The staged file is ours by construction, so an ambient ignore
// rule — a shared clone's `info/exclude` hiding leftover `beep-biome-json-*`
// directories — must not turn it into "provided but ignored" and fail the render.
// Turbo never hashes those files, so a render that depended on them would make a
// cached lane's result depend on state outside its key (time-to-certainty ruling 83).
const biomeFormatArguments = (biomeConfigPath: string, tempFilePath: string): ReadonlyArray<string> => [
  "format",
  "--write",
  "--vcs-use-ignore-file=false",
  `--config-path=${biomeConfigPath}`,
  tempFilePath,
];

/**
 * Render JSON with the Biome config of a given repository root.
 *
 * **Details**
 *
 * The encoded value is written to a scoped `beep-biome-json-*` directory
 * beneath `repoRoot` and formatted with `<repoRoot>/biome.jsonc`. Biome runs
 * with `--vcs-use-ignore-file=false`, so neither the repository's ignore files
 * nor a clone's `.git/info/exclude` can suppress the staged file; the
 * configuration's own `files` rules still apply. Invalid JSON-compatible
 * values fail before the child process is spawned.
 *
 * **Example** (Format JSON against an explicit root)
 *
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect";
 * import { renderBiomeJsonAt } from "@beep/repo-utils/schemas/BiomeJson"
 * const program = renderBiomeJsonAt("/repo", "package.json", { name: "@beep/example" }).pipe(
 *   Effect.provide(NodeServices.layer)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root holding `biome.jsonc`; the staging directory is created beneath it.
 * @param filePath - Target path whose basename the staged file keeps.
 * @param value - JSON-compatible value to encode and format.
 * @returns The formatted JSON text, ending in a newline.
 * @category utilities
 * @since 0.0.0
 */
export const renderBiomeJsonAt = Effect.fn("BiomeJson.renderBiomeJsonAt")(function* (
  repoRoot: string,
  filePath: string,
  value: unknown
): Effect.fn.Return<string, DomainError, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const biomeConfigPath = path.join(repoRoot, "biome.jsonc");
  const encoded = yield* encodeJson(value).pipe(
    Effect.mapError((cause) => DomainError.make({ message: `Failed to encode JSON for "${filePath}".`, cause }))
  );
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const tempDirectory = yield* fs
        .makeTempDirectoryScoped({ directory: repoRoot, prefix: "beep-biome-json-" })
        .pipe(
          Effect.mapError((cause) =>
            DomainError.make({ message: `Failed to create a Biome workspace for "${filePath}".`, cause })
          )
        );
      const tempFilePath = path.join(tempDirectory, path.basename(filePath));
      yield* fs
        .writeFileString(tempFilePath, encoded)
        .pipe(
          Effect.mapError((cause) =>
            DomainError.make({ message: `Failed to stage JSON for Biome at "${filePath}".`, cause })
          )
        );
      const command = ChildProcess.make(biomeExecutable, biomeFormatArguments(biomeConfigPath, tempFilePath), {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const handle = yield* command;
      const processResult = yield* Effect.all(
        {
          stdout: collectText(handle.stdout),
          stderr: collectText(handle.stderr),
          exitCode: handle.exitCode,
        },
        { concurrency: "unbounded" }
      );
      const rendered = yield* fs
        .readFileString(tempFilePath)
        .pipe(
          Effect.mapError((cause) =>
            DomainError.make({ message: `Failed to read Biome output for "${filePath}".`, cause })
          )
        );
      return { ...processResult, rendered };
    })
  ).pipe(Effect.mapError((cause) => DomainError.make({ message: `Failed to run Biome for "${filePath}".`, cause })));
  const stderr = Str.trim(result.stderr);

  if (result.exitCode !== 0) {
    return yield* DomainError.make({
      message:
        stderr.length > 0 ? `Biome failed to format "${filePath}": ${stderr}` : `Biome failed to format "${filePath}".`,
      cause: result.stderr,
    });
  }

  if (Str.isEmpty(Str.trim(result.rendered))) {
    return yield* DomainError.make({
      message:
        stderr.length > 0
          ? `Biome produced empty output for "${filePath}": ${stderr}`
          : `Biome produced empty output for "${filePath}".`,
      cause: result.stderr,
    });
  }

  return Str.endsWith("\n")(result.rendered) ? result.rendered : `${result.rendered}\n`;
});

/**
 * Render JSON with the same Biome config that repository lint uses.
 *
 * **Details**
 *
 * Locates the repository root from this module and delegates to
 * {@link renderBiomeJsonAt}. The encoded value is written to a scoped file
 * beneath the repository root before Biome formats it. The temporary file
 * keeps the target basename, and Biome ignores VCS ignore files for it, so
 * neither repository ignore rules nor a clone's `.git/info/exclude` can
 * silently suppress the render. Invalid JSON-compatible values fail before
 * the child process is spawned.
 *
 * **Example** (Format JSON via Biome)
 *
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect";
 * import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson"
 * const formatted = await Effect.runPromise(
 *   renderBiomeJson("package.json", { name: "@beep/example", private: true }).pipe(
 *     Effect.provide(NodeServices.layer)
 *   )
 * )
 * console.log(formatted.endsWith("\n")) // true
 * ```
 *
 * @effects
 * Locates the repository root, stages the encoded JSON in a scoped temporary
 * file, launches the workspace Biome binary, and reads its formatted output.
 * @category utilities
 * @since 0.0.0
 */
export const renderBiomeJson: {
  (
    filePath: string,
    value: unknown
  ): Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>;
  (
    value: unknown
  ): (
    filePath: string
  ) => Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn(function* (filePath: string, value: unknown) {
    const repoRoot = yield* findRepoRoot(moduleDir).pipe(
      Effect.mapError((cause) =>
        DomainError.make({ message: "Failed to locate the repo root for Biome formatting.", cause })
      )
    );
    return yield* renderBiomeJsonAt(repoRoot, filePath, value);
  })
);
