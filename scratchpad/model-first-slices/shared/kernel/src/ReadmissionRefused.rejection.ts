import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { GrantRef } from "./Invocation.ts";

/**
 * Refused: the authority context will not re-admit this provenance for the
 * next hop. `unaccountable`: its agent root no longer has a live
 * accountable human. `lapsed`: every grant it names has been revoked, has
 * expired, or no longer reaches what it derives from. A policy or saga that
 * receives it records the refusal as an outcome; it never acts without one.
 *
 * **Example** (A hop refused after revocation)
 * ```ts
 * import { GrantId } from "@proto/kernel/Ids";
 * import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
 *
 * const refusal = new ReadmissionRefused({ reason: "lapsed", lapsed: [{ grant: GrantId.make("g_rev"), delegation: null }] });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class ReadmissionRefused extends Domain.Rejection(
  "ReadmissionRefused",
  { reason: S.Literals(["unaccountable", "lapsed"]), lapsed: S.Array(GrantRef) },
  { httpApiStatus: 403, description: "The authority context will not re-admit this provenance for the next hop." },
) {}
