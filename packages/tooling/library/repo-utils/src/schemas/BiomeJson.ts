/**
 * Shared Biome-backed JSON rendering for repo-managed config files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Str, thunkEmptyStr } from "@beep/utils";
import { Effect, Path, Stream } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { DomainError } from "../errors/index.ts";
import { findRepoRoot } from "../Root.ts";

const require = createRequire(import.meta.url);
const biomeExecutable = require.resolve("@biomejs/biome/bin/biome");
const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const textEncoder = new TextEncoder();

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (text, chunk) => `${text}${chunk}`)
  );

/**
 * Render JSON with the same Biome config that repository lint uses.
 *
 * @remarks
 * The `filePath` is passed to Biome as the stdin filename, so formatting follows
 * the same parser and indentation rules Biome would choose for that target on
 * disk. Invalid JSON-compatible values fail before the child process is spawned.
 * @effects
 * Locates the repository root, launches the workspace Biome binary, writes the
 * encoded JSON to stdin, and reads stdout/stderr from the child process.
 * @example
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
 * @category utilities
 * @since 0.0.0
 */
export const renderBiomeJson: {
  (filePath: string, value: unknown): Effect.Effect<string, DomainError, Path.Path>;
  (value: unknown): (filePath: string) => Effect.Effect<string, DomainError, Path.Path>;
} = dual(
  2,
  Effect.fn(function* (filePath: string, value: unknown) {
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot(moduleDir).pipe(
      Effect.mapError((cause) =>
        DomainError.make({ message: "Failed to locate the repo root for Biome formatting.", cause })
      )
    );
    const biomeConfigPath = path.join(repoRoot, "biome.jsonc");
    const relativeToCwd = path.relative(process.cwd(), filePath);
    const stdinFilePath =
      relativeToCwd.length > 0 && relativeToCwd !== ".." && !Str.startsWith("../")(relativeToCwd)
        ? relativeToCwd
        : filePath;
    const encoded = yield* encodeJson(value).pipe(
      Effect.mapError((cause) => DomainError.make({ message: `Failed to encode JSON for "${filePath}".`, cause }))
    );
    const command = ChildProcess.make(
      biomeExecutable,
      ["format", `--config-path=${biomeConfigPath}`, `--stdin-file-path=${stdinFilePath}`],
      {
        stdin: Stream.make(textEncoder.encode(encoded)),
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const result = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* command;
        return yield* Effect.all({
          stdout: collectText(handle.stdout),
          stderr: collectText(handle.stderr),
          exitCode: handle.exitCode,
        });
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

    return Str.endsWith("\n")(result.stdout) ? result.stdout : `${result.stdout}\n`;
  })
);
