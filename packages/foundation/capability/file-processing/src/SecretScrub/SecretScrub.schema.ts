/**
 * Non-secret scrub proof and retention contracts. Prompt admission grants no action or egress permission.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $FileProcessingId } from "@beep/identity";
import { CredentialCategory, credentialPatternBankVersion } from "@beep/schema/CredentialPatternBank";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $FileProcessingId.create("SecretScrub");

/**
 * Coverage of the versioned plain-text bank, not universal credential or PII discovery.
 * **Example** (Check known coverage)
 * ```ts import.meta.vitest name="Check known coverage"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretCoverage.is.known("known"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const SecretCoverage = LiteralKit(["known", "unknown"]).pipe(
  $I.annoteSchema("SecretCoverage", {
    description: "Whether this versioned plain-text grammar was fully applied to the supplied text.",
  })
);
/**
 * Runtime coverage type.
 * **Example** (Type coverage)
 * ```ts import.meta.vitest name="Type coverage"
 * import type { SecretScrub } from "@beep/file-processing"
 * const coverage: SecretScrub.SecretCoverage = "unknown"
 * console.log(coverage)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SecretCoverage = typeof SecretCoverage.Type;
/**
 * Residue or unresolved grammar extent blocks prompt admission even after masking.
 * **Example** (Inspect a residue state)
 * ```ts import.meta.vitest name="Inspect a residue state"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretResidue.is.clear("clear"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const SecretResidue = LiteralKit(["clear", "present", "unresolved"]).pipe(
  $I.annoteSchema("SecretResidue", {
    description: "Supported-form residue or unresolved private-region extent, independent of coverage.",
  })
);
/**
 * Runtime residue type.
 * **Example** (Type residue)
 * ```ts import.meta.vitest name="Type residue"
 * import type { SecretScrub } from "@beep/file-processing"
 * const residue: SecretScrub.SecretResidue = "unresolved"
 * console.log(residue)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SecretResidue = typeof SecretResidue.Type;
/**
 * Ratified retention classes for raw purpose text, scrub proof and operational audit.
 * **Example** (Inspect the proof class)
 * ```ts import.meta.vitest name="Inspect the proof class"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretRetentionClass.Enum["scrub-proof"])
 * ```
 * @category models
 * @since 0.0.0
 */
export const SecretRetentionClass = LiteralKit(["transient-raw", "scrub-proof", "audit"]).pipe(
  $I.annoteSchema("SecretRetentionClass", {
    description: "Seven-day raw, thirty-day proof and twelve-calendar-month audit retention tiers.",
  })
);
/**
 * Runtime retention class type.
 * **Example** (Type retention)
 * ```ts import.meta.vitest name="Type retention"
 * import type { SecretScrub } from "@beep/file-processing"
 * const tier: SecretScrub.SecretRetentionClass = "audit"
 * console.log(tier)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SecretRetentionClass = typeof SecretRetentionClass.Type;
const EpochMillis = S.Natural.check(S.isLessThanOrEqualTo(8_000_000_000_000_000));

/**
 * Pure retention eligibility metadata; this slice creates no raw storage or deletion adapter.
 * **Example** (Construct a retention record)
 * ```ts import.meta.vitest name="Construct a retention record"
 * import { SecretScrub } from "@beep/file-processing"
 * const record = SecretScrub.SecretRetentionRecord.make({ retentionClass: "audit", createdAtEpochMillis: 0, purposeResolved: false, pinned: false })
 * console.log(record.retentionClass)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretRetentionRecord extends S.Class<SecretRetentionRecord>($I`SecretRetentionRecord`)(
  {
    retentionClass: SecretRetentionClass,
    createdAtEpochMillis: EpochMillis,
    purposeResolved: S.Boolean,
    pinned: S.Boolean,
  },
  $I.annote("SecretRetentionRecord", {
    description: "Non-secret clock and purpose/pin metadata for a pure purge decision; no stored content.",
  })
) {}

/**
 * Category count on original input; overlaps are independently counted by category.
 * **Example** (Construct a category count)
 * ```ts import.meta.vitest name="Construct a category count"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretCategoryCount.make({ category: "jwt", count: 1 }).count)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretCategoryCount extends S.Class<SecretCategoryCount>($I`SecretCategoryCount`)(
  {
    category: CredentialCategory,
    count: S.Natural.check(S.isGreaterThan(0)),
  },
  $I.annote("SecretCategoryCount", {
    description: "Independent positive count of supported original-input matches in one category.",
  })
) {}

/**
 * Mask-only finding with non-secret original offsets and rule/bank versions. No TextAnchor quote is emitted.
 * **Example** (Inspect evidence shape)
 * ```ts import.meta.vitest name="Inspect evidence shape"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as S from "effect/Schema"
 * console.log(S.is(SecretScrub.SecretEvidence)({}))
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretEvidence extends S.Class<SecretEvidence>($I`SecretEvidence`)(
  {
    category: CredentialCategory,
    count: S.Literal(1),
    bankVersion: S.Literal(credentialPatternBankVersion),
    ruleVersion: S.Literal("v1"),
    start: S.Natural,
    end: S.Natural,
    mask: S.Literal("[REDACTED]"),
    state: S.Literals(["matched", "residue", "unresolved"]),
    retention: SecretRetentionRecord,
  },
  $I.annote("SecretEvidence", {
    description: "Mask, versions, counts and half-open UTF-16 original offsets; no raw match, quote or digest input.",
  })
) {}

/**
 * Retention-bounded non-secret evidence envelope, independent of action authorization.
 * **Example** (Inspect proof identifier)
 * ```ts import.meta.vitest name="Inspect proof identifier"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as S from "effect/Schema"
 * console.log(S.is(SecretScrub.SecretScrubProof)({}))
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretScrubProof extends S.Class<SecretScrubProof>($I`SecretScrubProof`)(
  {
    bankVersion: S.Literal(credentialPatternBankVersion),
    counts: S.Array(SecretCategoryCount),
    evidence: S.Array(SecretEvidence),
    transientRaw: SecretRetentionRecord,
    audit: SecretRetentionRecord,
  },
  $I.annote("SecretScrubProof", {
    description:
      "Non-secret category/evidence proof with raw-purpose and audit retention metadata; no action or egress verdict.",
  })
) {}

/**
 * Authorized extracted text input with an explicit coverage assertion for this bank only.
 * **Example** (Construct a public input)
 * ```ts import.meta.vitest name="Construct a public input"
 * import { SecretScrub } from "@beep/file-processing"
 * console.log(SecretScrub.SecretScrubInput.make({ text: "public text" }).coverage)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretScrubInput extends S.Class<SecretScrubInput>($I`SecretScrubInput`)(
  {
    text: S.String,
    coverage: SecretCoverage.pipe(S.withConstructorDefault(Effect.succeed("known"))),
  },
  $I.annote("SecretScrubInput", {
    description:
      "Transient authorized plain text; known coverage means this versioned bank, never exhaustive secret/PII coverage.",
  })
) {}

/**
 * Sanitized text and proof. safeForPrompt admits only one prompt leg and grants no action or egress permission.
 * **Example** (Scrub public text)
 * ```ts import.meta.vitest name="Scrub public text"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as Effect from "effect/Effect"
 * const result = await Effect.runPromise(SecretScrub.scrubSecretText(SecretScrub.SecretScrubInput.make({ text: "public text" })))
 * console.log(result.safeForPrompt)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SecretScrubResult extends S.Class<SecretScrubResult>($I`SecretScrubResult`)(
  {
    sanitizedText: S.String,
    coverage: SecretCoverage,
    residue: SecretResidue,
    safeForPrompt: S.Boolean,
    proof: SecretScrubProof,
  },
  $I.annote("SecretScrubResult", {
    description:
      "Sanitized text plus bounded non-secret proof; false, unknown coverage, unresolved extent or residue blocks prompt admission.",
  })
) {}
