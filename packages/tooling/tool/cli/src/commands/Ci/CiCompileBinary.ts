/**
 * `beep ci compile-binary`: compile the slim CI entry into a standalone executable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils/Root";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { CiCommandError } from "./Ci.errors.ts";

/** The entry `bun build --compile` bundles: the pre-toolchain `ci` commands only. */
const CI_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";
const isCiCommandError = S.is(CiCommandError);

/**
 * Compile `src/bin-ci.ts` to `outfile` and write `<outfile>.sha256` beside it.
 *
 * **Details**
 *
 * Runs `bun build --compile --target <target>` on the slim CI entry, then
 * hashes the executable and writes one `sha256sum`-format line naming its
 * basename, so `sha256sum --check` verifies a download placed next to it.
 *
 * **Example** (Compile the Linux CI binary)
 *
 * ```ts
 * import { compileCiBinary } from "@beep/repo-cli/commands/Ci"
 *
 * const program = compileCiBinary("dist/beep-linux-x64", "bun-linux-x64")
 * console.log(typeof program) // "object"
 * ```
 *
 * @param outfile - Executable path, resolved against the current directory.
 * @param target - Bun compile target such as `bun-linux-x64`.
 * @returns The sha256 hex digest of the compiled executable.
 * @category use-cases
 * @since 0.0.0
 */
export const compileCiBinary = Effect.fn("Ci.compileCiBinary")(
  function* (outfile: string, target: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const digest = yield* Digest.Digest;
    const root = yield* findRepoRoot();
    const executable = path.resolve(outfile);
    yield* fs.makeDirectory(path.dirname(executable), { recursive: true });
    const status = yield* spawner.exitCode(
      ChildProcess.make(
        "bun",
        ["build", "--compile", `--target=${target}`, path.join(root, CI_ENTRY), "--outfile", executable],
        { cwd: root, stdin: "ignore", stdout: "inherit", stderr: "inherit" }
      )
    );
    if (status !== 0) return yield* CiCommandError.make({ message: `bun build --compile exited ${status}.` });
    const bytes = yield* fs.readFile(executable);
    const hash = yield* digest.digest(Digest.sha256, bytes).pipe(Effect.map(Hex.encode));
    yield* fs.writeFileString(`${executable}.sha256`, `${hash}  ${path.basename(executable)}\n`);
    yield* Console.log(`${hash}  ${executable}`);
    return hash;
  },
  Effect.mapError((error) =>
    isCiCommandError(error) ? error : CiCommandError.new(error, "Failed to compile the CI binary.")
  )
);

/**
 * `beep ci compile-binary --outfile <path> [--target <bun-target>]`.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciCompileBinaryCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciCompileBinaryCommand.name) // "compile-binary"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciCompileBinaryCommand = Command.make(
  "compile-binary",
  {
    outfile: Flag.String("outfile").pipe(Flag.withDescription("Executable path; <path>.sha256 is written beside it")),
    target: Flag.String("target").pipe(Flag.withDefault("bun-linux-x64"), Flag.withDescription("Bun compile target")),
  },
  ({ outfile, target }) =>
    compileCiBinary(outfile, target).pipe(
      Effect.asVoid,
      Effect.catchTag("CiCommandError", (error) =>
        Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
      )
    )
).pipe(Command.withDescription("Compile the pre-toolchain CI binary and its sha256 checksum"));
