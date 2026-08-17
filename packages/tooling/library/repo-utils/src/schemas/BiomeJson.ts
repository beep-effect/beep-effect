/**
 * Shared Biome-backed JSON rendering for repo-managed config files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Unknown } from "@beep/schema/Unknown";
import { Str, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, Path, Stream } from "effect";
import { dual } from "effect/Function";
import { ChildProcess } from "effect/unstable/process";
import { DomainError } from "../errors/index.ts";
import { findRepoRoot } from "../Root.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const require = createRequire(import.meta.url);
const biomeExecutable = require.resolve("@biomejs/biome/bin/biome");
const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const encodeJson = Unknown.encodeUnknownEffectFromJsonString;

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (text, chunk) => `${text}${chunk}`)
  );

/**
 * Render JSON with the same Biome config that repository lint uses.
 *
 * **Details**
 *
 * The encoded value is written to a scoped file beneath the repository root
 * before Biome formats it. The temporary file keeps the target basename while
 * avoiding repository ignore rules that can silently suppress stdin formatting.
 * Invalid JSON-compatible values fail before the child process is spawned.
 *
 * **Example** (Format JSON via Biome)
 *
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
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
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot(moduleDir).pipe(
      Effect.mapError((cause) =>
        DomainError.make({ message: "Failed to locate the repo root for Biome formatting.", cause })
      )
    );
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
        const command = ChildProcess.make(
          biomeExecutable,
          ["format", "--write", `--config-path=${biomeConfigPath}`, tempFilePath],
          {
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          }
        );
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
          stderr.length > 0
            ? `Biome failed to format "${filePath}": ${stderr}`
            : `Biome failed to format "${filePath}".`,
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
  })
);
