/**
 * Native vault directory picker RPC contract shared by the sidecar and webview.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const $I = $ProfessionalDesktopId.create("intake/VaultDirectoryPicker.rpc");

/**
 * Client-safe native vault directory picker failure.
 *
 * **Example** (Creating error with message)
 *
 * ```ts
 * import { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc"
 *
 * const error = VaultDirectoryPickError.new("Native folder dialog unavailable.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultDirectoryPickError extends S.TaggedError<VaultDirectoryPickError>($I`VaultDirectoryPickError`)(
  "VaultDirectoryPickError",
  {
    message: S.String,
  },
  $I.annoteError<VaultDirectoryPickError>("VaultDirectoryPickError", {
    description: "Client-safe native vault directory picker failure.",
  })
) {
  static readonly new = (message: string) => VaultDirectoryPickError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}

/**
 * RPC that opens a native folder dialog on the sidecar host and resolves with
 * `Option.some(path)` carrying the picked absolute directory, or `Option.none()`
 * when the user cancels. The wire form stays `string | null`; the decoded
 * success value is the `Option`.
 *
 * **Details**
 *
 * Browser-mode counterpart of the Tauri shell's `select_vault_directory`
 * command; only exposed over HTTP when the per-launch session token guards the
 * full desktop RPC group.
 *
 * **Example** (Retrieving registered request)
 *
 * ```ts
 * import { VaultDirectoryPickerRpcs } from "@/intake/VaultDirectoryPicker.rpc"
 *
 * const registered = VaultDirectoryPickerRpcs.requests.get("PickVaultDirectory")
 * console.log(registered)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
const PickVaultDirectoryRpc = Rpc.make("PickVaultDirectory", {
  success: S.OptionFromNullOr(S.String),
  error: VaultDirectoryPickError,
});

/**
 * Native vault directory picker RPC group served by the desktop sidecar.
 *
 * **Example** (Checking request registration)
 *
 * ```ts
 * import { VaultDirectoryPickerRpcs } from "@/intake/VaultDirectoryPicker.rpc"
 *
 * console.log(VaultDirectoryPickerRpcs.requests.has("PickVaultDirectory"))
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const VaultDirectoryPickerRpcs = RpcGroup.make(PickVaultDirectoryRpc);
