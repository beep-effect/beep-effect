/**
 * Pure retention decisions and private-constructor prompt capability.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $FileProcessingId } from "@beep/identity";
import * as Bank from "@beep/schema/CredentialPatternBank";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SecretCoverage, SecretResidue, SecretRetentionClass } from "./SecretScrub.schema.ts";
import type { SecretRetentionRecord, SecretScrubResult } from "./SecretScrub.schema.ts";

const $I = $FileProcessingId.create("SecretScrub.policy");
const PromptText: S.brand<S.String, "FileProcessingPromptAdmissibleText"> = S.String.pipe(
  S.brand("FileProcessingPromptAdmissibleText"),
  $I.annoteSchema("PromptAdmissibleText", { description: "Private-constructor prompt admission capability." })
);

/**
 * Branded prompt text minted only by promptTextFromScrub; it is not an authorization verdict.
 * **Details**
 * The schema constructor is private to preserve the mint boundary.
 * **Example** (Use the capability type)
 * ```ts import.meta.vitest name="Use the capability type"
 * import type { SecretScrub } from "@beep/file-processing"
 * const acceptExcerpt = (text: SecretScrub.PromptAdmissibleText) => text.length
 * console.log(acceptExcerpt)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PromptAdmissibleText = typeof PromptText.Type;

/**
 * Mint prompt text only from a true result with known/clear status and independently rechecked sanitized bytes.
 * **Example** (Mint from a scrub result)
 * ```ts import.meta.vitest name="Mint from a scrub result"
 * import { SecretScrub } from "@beep/file-processing"
 * import * as Effect from "effect/Effect"
 * const result = await Effect.runPromise(SecretScrub.scrubSecretText(SecretScrub.SecretScrubInput.make({ text: "public text" })))
 * console.log(SecretScrub.promptTextFromScrub(result))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const promptTextFromScrub = (result: SecretScrubResult): O.Option<PromptAdmissibleText> =>
  result.safeForPrompt &&
  SecretCoverage.is.known(result.coverage) &&
  SecretResidue.is.clear(result.residue) &&
  A.isReadonlyArrayEmpty(Bank.detectCredentials(result.sanitizedText))
    ? S.decodeOption(PromptText)(result.sanitizedText)
    : O.none();

/**
 * Compute the ratified deadline; audit uses twelve calendar months rather than a fixed day approximation.
 * **Example** (Compute a raw deadline)
 * ```ts import.meta.vitest name="Compute a raw deadline"
 * import { SecretScrub } from "@beep/file-processing"
 * const record = SecretScrub.SecretRetentionRecord.make({ retentionClass: "transient-raw", createdAtEpochMillis: 0, purposeResolved: false, pinned: false })
 * console.log(SecretScrub.secretRetentionDeadline(record))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const secretRetentionDeadline = (record: SecretRetentionRecord): number =>
  SecretRetentionClass.$match(record.retentionClass, {
    "transient-raw": () => record.createdAtEpochMillis + Duration.toMillis(Duration.days(7)),
    "scrub-proof": () => record.createdAtEpochMillis + Duration.toMillis(Duration.days(30)),
    audit: () => DateTime.toEpochMillis(DateTime.add(DateTime.makeUnsafe(record.createdAtEpochMillis), { months: 12 })),
  });

/**
 * Decide purge eligibility without I/O: raw resolves immediately; only unresolved-review proof may be pinned.
 * **Example** (Purge resolved raw metadata)
 * ```ts import.meta.vitest name="Purge resolved raw metadata"
 * import { SecretScrub } from "@beep/file-processing"
 * const record = SecretScrub.SecretRetentionRecord.make({ retentionClass: "transient-raw", createdAtEpochMillis: 0, purposeResolved: true, pinned: false })
 * console.log(SecretScrub.isSecretPurgeEligible(record, 0))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const isSecretPurgeEligible: {
  (record: SecretRetentionRecord, nowEpochMillis: number): boolean;
  (nowEpochMillis: number): (record: SecretRetentionRecord) => boolean;
} = dual(
  2,
  (record: SecretRetentionRecord, nowEpochMillis: number) =>
    (SecretRetentionClass.is["transient-raw"](record.retentionClass) && record.purposeResolved) ||
    (!(SecretRetentionClass.is["scrub-proof"](record.retentionClass) && record.pinned) &&
      nowEpochMillis >= secretRetentionDeadline(record))
);
