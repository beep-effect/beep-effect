/**
 * Lossless 1Password administrative wire models with redacted field values.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Accounts/AccountsSecretsLayout.schemas");
const Section = S.Struct({ id: S.NonEmptyString, label: S.NonEmptyString });

/**
 * A lossless vault field; layout changes only its optional section.
 *
 * **Details**
 * Unknown wire attributes are preserved. Values decode into Redacted and encode
 * only when preparing the operator's item-edit input or the identity digest.
 *
 * **Example** (Validate a synthetic field)
 * ```ts
 * import { AccountsSecretField } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * Effect.isEffect(S.decodeUnknownEffect(AccountsSecretField)({ id: "f1", label: "AI_KEY", type: "CONCEALED", value: "synthetic" })) // => true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const AccountsSecretField = S.StructWithRest(
  S.Struct({
    id: S.NonEmptyString,
    label: S.String,
    type: S.String,
    value: S.Unknown.pipe(S.RedactedFromValue, S.OptionFromOptionalKey),
    purpose: S.OptionFromOptionalKey(S.String),
    section: S.OptionFromOptionalKey(Section),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("AccountsSecretField", {
    description: "Lossless administrative field; secrets are redacted while held in memory.",
  })
);
/**
 * Decoded administrative field, including preserved unknown attributes.
 * @category type-level
 * @since 0.0.0
 */
export type AccountsSecretField = typeof AccountsSecretField.Type;

/**
 * Lossless item payload for the section-layout operation.
 *
 * **Example** (Decode an empty synthetic item)
 * ```ts
 * import { AccountsSecretsItem } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * Effect.isEffect(S.decodeUnknownEffect(AccountsSecretsItem)({ fields: [], sections: [] })) // => true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const AccountsSecretsItem = S.StructWithRest(
  S.Struct({
    fields: S.Array(AccountsSecretField),
    sections: S.Array(Section),
    version: S.OptionFromOptionalKey(S.Natural),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("AccountsSecretsItem", {
    description: "1Password item metadata retained byte-semantically while fields are resectioned.",
  })
);
/**
 * Decoded item accepted by the layout transform.
 * @category type-level
 * @since 0.0.0
 */
export type AccountsSecretsItem = typeof AccountsSecretsItem.Type;
