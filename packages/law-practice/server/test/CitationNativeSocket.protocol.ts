import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";

// The provided JSON transform preserves isolated UTF-16 surrogates before
// SchemaBinary's UTF-8 string encoding; no private string or frame codec.
const $I = $LawPracticeServerId.create("test/CitationNativeSocket.protocol");
const Text = S.fromJsonString(S.String.check(S.isMaxLength(32_768))).pipe(
  $I.annoteSchema("Text", {
    description: "Bounded exact UTF-16 text encoded through Effect JSON before binary framing.",
  })
);
/** Real-process test protocol; never a public parser capability.
 * @internal @category testing @since 0.0.0
 */
export const CitationNativeSocketTestRpcs = RpcGroup.make(
  Rpc.make("Echo", { payload: { text: Text }, success: Text }),
  Rpc.make("Busy", { success: S.Void })
);
