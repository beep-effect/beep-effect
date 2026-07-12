/**
 * Native vault directory picker RPC contract shared by the sidecar and webview.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const $I = $ProfessionalDesktopId.create("intake/VaultDirectoryPicker.rpc");

/**
 * Client-safe native vault directory picker failure.
 *
 * @example
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
export class VaultDirectoryPickError extends TaggedErrorClass<VaultDirectoryPickError>($I`VaultDirectoryPickError`)(
  "VaultDirectoryPickError",
  {
    message: S.String,
  },
  $I.annote("VaultDirectoryPickError", {
    description: "Client-safe native vault directory picker failure.",
  })
) {
  static readonly new = (message: string) => VaultDirectoryPickError.make({ message });
}

/**
 * RPC that opens a native folder dialog on the sidecar host and resolves with
 * the picked absolute directory path, or `null` when the user cancels.
 *
 * Browser-mode counterpart of the Tauri shell's `select_vault_directory`
 * command; only exposed over HTTP when the per-launch session token guards the
 * full desktop RPC group.
 *
 * @example
 * ```ts
 * import { PickVaultDirectoryRpc, VaultDirectoryPickerRpcs } from "@/intake/VaultDirectoryPicker.rpc"
 *
 * const registered = VaultDirectoryPickerRpcs.requests.get("PickVaultDirectory")
 * console.log(registered === PickVaultDirectoryRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const PickVaultDirectoryRpc = Rpc.make("PickVaultDirectory", {
  success: S.NullOr(S.String),
  error: VaultDirectoryPickError,
});

/**
 * Native vault directory picker RPC group served by the desktop sidecar.
 *
 * @example
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
