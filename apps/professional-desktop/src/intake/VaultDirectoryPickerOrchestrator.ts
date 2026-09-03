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
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import * as O from "@beep/utils/Option";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { VaultDirectoryPickError, VaultDirectoryPickerRpcs } from "./VaultDirectoryPicker.rpc.ts";

const dialogTitle = "Select workspace vault";

const emptyString = () => Str.empty;

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(Stream.decodeText(), Stream.runFold(emptyString, Str.concat));

const pickWith = Effect.fn("professional_desktop.intake.pick_vault_directory_process")(function* (
  executable: string,
  args: ReadonlyArray<string>
) {
  yield* Effect.annotateCurrentSpan({
    "professional_desktop.intake.vault_picker.provider": executable,
  });
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make(executable, args, {
      stdin: "ignore",
      stderr: "ignore",
      stdout: "pipe",
    })
  );
  const [stdout, exitCode] = yield* Effect.all([collectText(child.stdout), child.exitCode], {
    concurrency: "unbounded",
  });
  // kdialog and zenity exit non-zero when the user cancels the dialog.
  if (Number(exitCode) !== 0) return O.none<string>();
  const selected = Str.trim(stdout);
  return Str.isNonEmpty(selected) ? O.some(selected) : O.none<string>();
}, Effect.scoped);

/**
 * Open the sidecar host's native folder dialog (kdialog, then zenity) and
 * resolve with the picked absolute directory path, or `None` on cancel.
 *
 * **Example** (Creating host picker Effect)
 *
 * ```ts
 * import { pickVaultDirectoryOnHost } from "@/intake/VaultDirectoryPickerOrchestrator"
 *
 * const effect = pickVaultDirectoryOnHost("/home/user")
 * console.log(effect)
 * ```
 *
 * @effects Launches a native folder-picker subprocess and records fallback diagnostics.
 * @category workflows
 * @since 0.0.0
 */
export const pickVaultDirectoryOnHost = (
  startDirectory: string
): Effect.Effect<O.Option<string>, VaultDirectoryPickError, ChildProcessSpawner.ChildProcessSpawner> =>
  pickWith("kdialog", ["--title", dialogTitle, "--getexistingdirectory", startDirectory]).pipe(
    Effect.catchTag("PlatformError", (error) =>
      logRedactedCause(
        Cause.fail(error),
        LogRedactedCauseOptions.make({
          message: "primary native vault directory picker unavailable",
          level: "Warn",
          attributes: {
            "professional_desktop.intake.vault_picker.fallback": "zenity",
            "professional_desktop.intake.vault_picker.provider": "kdialog",
            "professional_desktop.subsystem": "vault_picker",
          },
        })
      ).pipe(Effect.andThen(pickWith("zenity", ["--file-selection", "--directory", `--title=${dialogTitle}`])))
    ),
    Effect.catchTag("PlatformError", (error) =>
      logRedactedCause(
        Cause.fail(error),
        LogRedactedCauseOptions.make({
          message: "native vault directory picker unavailable",
          level: "Warn",
          attributes: {
            "professional_desktop.intake.vault_picker.outcome": "failure",
            "professional_desktop.intake.vault_picker.provider": "zenity",
            "professional_desktop.subsystem": "vault_picker",
          },
        })
      ).pipe(Effect.andThen(VaultDirectoryPickError.failEffect("Native folder dialog unavailable on this host.")))
    )
  );

// Env flag that disables the sidecar's native folder dialog entirely.
// kdialog reaches the operator's desktop through the D-Bus portal even when
// DISPLAY/WAYLAND_DISPLAY are unset, so a headless or QA sidecar cannot
// suppress the dialog by stripping display variables — an unattended run can
// pop a folder picker on whatever desktop owns the session bus. Setting
// BEEP_DESKTOP_VAULT_PICKER_DISABLED=true makes PickVaultDirectory fail with
// the typed error immediately, which routes the renderer to its manual
// vault-path form.
const vaultPickerDisabled = Config.boolean("BEEP_DESKTOP_VAULT_PICKER_DISABLED").pipe(Config.withDefault(false));

/**
 * RPC handler layer that opens the sidecar host's native folder dialog.
 *
 * **Example** (Confirming handlers Layer)
 *
 * ```ts
 * import { VaultDirectoryPickerHandlersLive } from "@/intake/VaultDirectoryPickerOrchestrator"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultDirectoryPickerHandlersLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultDirectoryPickerHandlersLive = VaultDirectoryPickerRpcs.toLayer(
  Effect.gen(function* () {
    const startDirectory = yield* Config.string("HOME").pipe(Config.withDefault("/"));
    const disabled = yield* vaultPickerDisabled;
    return VaultDirectoryPickerRpcs.of({
      PickVaultDirectory: () =>
        disabled
          ? VaultDirectoryPickError.failEffect("The native folder picker is disabled on this sidecar.")
          : pickVaultDirectoryOnHost(startDirectory),
    });
  })
);
