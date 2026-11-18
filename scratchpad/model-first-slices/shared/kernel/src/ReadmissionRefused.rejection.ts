import * as S from "effect/Schema";
import { GrantRef } from "./Invocation.ts";
import { $KernelId } from "./Identity.ts";
import * as Initial from "./Initial.ts";

const $I = $KernelId.create("ReadmissionRefused.rejection");

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
 * import * as O from "effect/Option";
 *
 * const refusal = ReadmissionRefused.make({ reason: "lapsed", lapsed: [{ grant: GrantId.make("g_rev"), delegation: O.none() }] });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class ReadmissionRefused extends S.TaggedError<ReadmissionRefused, { readonly brand: unique symbol }>()(
  "ReadmissionRefused",
  {
    reason: S.Literals(["unaccountable", "lapsed"]),
    lapsed: Initial.empty(GrantRef, { description: "The grants that lapsed; none when the reason is `unaccountable`." }),
  },
  $I.annote("ReadmissionRefused", { httpApiStatus: 403, description: "The authority context will not re-admit this provenance for the next hop." }),
) {}
