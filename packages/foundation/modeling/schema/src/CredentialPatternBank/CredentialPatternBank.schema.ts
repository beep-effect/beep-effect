/**
 * Versioned credential/private-tag grammar shared by redaction consumers.
 * Private-tag behavior is implemented from the agentmemory contract description
 * recorded in the ingestion-secret-scrub provenance ledger; no donor code is copied.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("CredentialPatternBank");

/**
 * Stable identifier of the shared matching semantics.
 *
 * **Example** (Identify the bank)
 * ```ts import.meta.vitest name="Identify the bank"
 * import { credentialPatternBankVersion } from "@beep/schema/CredentialPatternBank"
 * console.log(credentialPatternBankVersion)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const credentialPatternBankVersion = "credential-pattern-bank/v1";

/**
 * Supported credential categories, including inherited home-path coverage.
 *
 * **Example** (Inspect a category)
 * ```ts import.meta.vitest name="Inspect a category"
 * import { CredentialCategory } from "@beep/schema/CredentialPatternBank"
 * console.log(CredentialCategory.is.jwt("jwt"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const CredentialCategory = LiteralKit([
  "secret-assignment",
  "auth-header",
  "bearer-token",
  "provider-key",
  "jwt",
  "home-path",
  "private-tag",
]).pipe(
  $I.annoteSchema("CredentialCategory", {
    description: "Categories supported by the versioned credential/private-tag bank, not general PII coverage.",
  })
);
/**
 * Runtime category type.
 * **Example** (Type a category)
 * ```ts import.meta.vitest name="Type a category"
 * import type { CredentialCategory } from "@beep/schema/CredentialPatternBank"
 * const category: CredentialCategory = "jwt"
 * console.log(category)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CredentialCategory = typeof CredentialCategory.Type;

/**
 * A rule's grammar and partial-form residue grammar; never a matched value.
 * **Example** (Read a rule field)
 * ```ts import.meta.vitest name="Read a rule field"
 * import { credentialRules } from "@beep/schema/CredentialPatternBank"
 * console.log(credentialRules[0]?.version)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CredentialRule extends S.Class<CredentialRule>($I`CredentialRule`)(
  {
    category: CredentialCategory,
    version: S.Literal("v1"),
    pattern: S.NonEmptyString,
    flags: S.Literals(["gu", "giu"]),
    valueGroups: S.NonEmptyArray(S.Natural),
    residuePatterns: S.Array(S.NonEmptyString),
  },
  $I.annote("CredentialRule", {
    description: "Pure versioned grammar with sensitive capture group and incomplete supported-form grammars.",
  })
) {}

/**
 * A non-secret original UTF-16 span, with an explicit resolution state.
 * **Example** (Find original offsets)
 * ```ts import.meta.vitest name="Find original offsets"
 * import { detectCredentials } from "@beep/schema/CredentialPatternBank"
 * console.log(detectCredentials("public text").length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CredentialMatch extends S.Class<CredentialMatch>($I`CredentialMatch`)(
  {
    category: CredentialCategory,
    ruleVersion: S.Literal("v1"),
    start: S.Natural,
    end: S.Natural,
    state: S.Literals(["matched", "residue", "unresolved"]),
  },
  $I.annote("CredentialMatch", {
    description: "Non-secret half-open original UTF-16 offsets; no matched text or quote is retained.",
  })
) {}
