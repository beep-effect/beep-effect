/**
 * Desktop sidecar transport probe schema.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("transport/SidecarTransport");

/**
 * Transport probe result returned by the desktop sidecar.
 *
 * **Example** (Create transport instance)
 *
 * ```ts
 * import { SidecarTransport } from "@/transport/SidecarTransport"
 *
 * const transport = SidecarTransport.make({ ipc: false })
 * console.log(transport.ipc) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SidecarTransport extends S.Class<SidecarTransport>($I`SidecarTransport`)(
  {
    ipc: S.Boolean,
    rpcSessionToken: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SidecarTransport", {
    description: "The transport used to communicate with the sidecar.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(SidecarTransport);
}
