/**
 * Shared 1Password reference value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("values/OnePasswordReference/OnePasswordReference.model");

const onePasswordReferencePattern = /^op:\/\/[^/]+\/[^/]+\/[^/]+(?:\/[^/]+)?$/;

const OnePasswordReferenceChecks = S.makeFilterGroup([
  S.isPattern(onePasswordReferencePattern, {
    identifier: $I`OnePasswordReferencePatternCheck`,
    title: "1Password reference pattern",
    description: "Requires an op://vault/item/field reference, with an optional section segment.",
    message: "OnePasswordReference must look like op://vault/item/field",
  }),
]);

/**
 * Typed reference to a 1Password item field.
 *
 * **Details**
 *
 * This value is a reference only. It is safe for manifests, approvals, and
 * validators because it never contains the resolved secret value.
 *
 * **Example** (Decoding a 1Password reference)
 *
 * ```ts
 * import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference/OnePasswordReference.model"
 * import * as S from "effect/Schema"
 *
 * const reference = S.decodeUnknownSync(OnePasswordReference)(
 *   "op://BEEP_SECRETS/OpenAI/api_key"
 * )
 *
 * console.log(reference.startsWith("op://")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const OnePasswordReference = S.String.check(OnePasswordReferenceChecks).pipe(
  S.brand("OnePasswordReference"),
  $I.annoteSchema("OnePasswordReference", {
    identifier: "OnePasswordReference",
    title: "1Password reference",
    description: "A typed reference to a 1Password item field, never the plaintext secret value.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OnePasswordReference}.
 *
 * **Example** (Typing a decoded reference)
 *
 * ```ts
 * import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference/OnePasswordReference.model"
 * import type { OnePasswordReference as OnePasswordReferenceValue } from "@beep/shared-domain/values/OnePasswordReference/OnePasswordReference.model"
 * import * as S from "effect/Schema"
 *
 * const reference: OnePasswordReferenceValue = S.decodeUnknownSync(OnePasswordReference)(
 *   "op://BEEP_SECRETS/OpenAI/api_key"
 * )
 *
 * console.log(reference)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type OnePasswordReference = typeof OnePasswordReference.Type;

/**
 * Schema-derived guard for 1Password references.
 *
 * **Example** (Checking reference validity)
 *
 * ```ts
 * import { isOnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference/OnePasswordReference.model"
 *
 * console.log(isOnePasswordReference("op://BEEP_SECRETS/OpenAI/api_key")) // true
 * console.log(isOnePasswordReference("sk-live-secret")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isOnePasswordReference = OnePasswordReference.is;
