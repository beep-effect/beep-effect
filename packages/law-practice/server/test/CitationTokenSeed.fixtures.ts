/** Shared native source-token fixture codec; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationTokenSeed } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import * as S from "effect/Schema";

const Native = S.NullOr(S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex }));
/** @internal @category testing @since 0.0.0 */
export const CitationTokenSeedHex = S.Struct({
  ...CitationTokenSeed.fields,
  data: Native,
  groups: S.Record(S.String, Native),
});
