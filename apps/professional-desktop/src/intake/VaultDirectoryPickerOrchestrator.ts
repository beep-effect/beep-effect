/**
 * App-level native vault directory picker served by the bun sidecar.
 *
 * The Tauri shell opens its own native dialog through the Rust
 * `select_vault_directory` command; this handler covers browser-mode clients by
 * opening the sidecar host's native folder dialog (kdialog first for KDE, then
 * zenity) and returning the picked absolute path over RPC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Effect, Stream } from "effect";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { VaultDirectoryPickError, VaultDirectoryPickerRpcs } from "./VaultDirectoryPicker.rpc.ts";

const dialogTitle = "Select workspace vault";

const emptyString = () => Str.empty;

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(Stream.decodeText(), Stream.runFold(emptyString, Str.concat));

const pickWith = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  executable: string,
  args: ReadonlyArray<string>
) =>
  Effect.gen(function* () {
    const child = yield* spawner.spawn(ChildProcess.make(executable, args));
    const [stdout, exitCode] = yield* Effect.all([collectText(child.stdout), child.exitCode], {
      concurrency: "unbounded",
    });
    // kdialog and zenity exit non-zero when the user cancels the dialog.
    if (Number(exitCode) !== 0) return null;
    const selected = Str.trim(stdout);
    return Str.isNonEmpty(selected) ? selected : null;
  }).pipe(Effect.scoped);

/**
 * RPC handler layer that opens the sidecar host's native folder dialog.
 *
 * @example
 * ```ts
 * import { VaultDirectoryPickerHandlersLive } from "@/intake/VaultDirectoryPickerOrchestrator"
 *
 * console.log(VaultDirectoryPickerHandlersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultDirectoryPickerHandlersLive = VaultDirectoryPickerRpcs.toLayer(
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const startDirectory = yield* Config.string("HOME").pipe(Config.withDefault("/"));
    return VaultDirectoryPickerRpcs.of({
      PickVaultDirectory: () =>
        pickWith(spawner, "kdialog", ["--title", dialogTitle, "--getexistingdirectory", startDirectory]).pipe(
          Effect.catch(() =>
            pickWith(spawner, "zenity", ["--file-selection", "--directory", `--title=${dialogTitle}`])
          ),
          Effect.catch((error) =>
            Effect.logWarning("native vault directory picker unavailable", { detail: error }).pipe(
              Effect.andThen(VaultDirectoryPickError.failEffect("Native folder dialog unavailable on this host."))
            )
          )
        ),
    });
  })
);
