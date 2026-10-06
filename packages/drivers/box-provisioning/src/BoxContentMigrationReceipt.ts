/**
 * Redacted apply-receipt and journal schemas for Box content migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { BoxContentMigrationPlan } from "./BoxContentMigrationPlan.ts";
import { BoxProvisioningSchemaError } from "./BoxProvisioningErrors.ts";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";
import { BoxApplyAttemptId } from "./BoxProvisioningReceipt.ts";

const $I = $BoxProvisioningId.create("BoxContentMigrationReceipt");

const optionalProviderId = S.OptionFromOptionalKey(BoxProviderId).pipe(S.withConstructorDefault(Effect.succeedNone));

const HttpStatus = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 }));

/**
 * Kind of Box item a content-migration action targets.
 *
 * **Example** (Check the file action kind)
 *
 * ```ts
 * import { BoxContentActionKind } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentActionKind.is.file("file"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentActionKind = LiteralKit(["folder", "file"]).pipe(
  $I.annoteSchema("BoxContentActionKind", {
    description: "Whether a content-migration action targets a destination folder or a file.",
  })
);

/**
 * Runtime type for {@link BoxContentActionKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentActionKind = typeof BoxContentActionKind.Type;

/**
 * Closed classification of a failed content-migration write.
 *
 * **Details**
 *
 * `name-in-use` is a Box 409 that could not be resolved to an adoptable
 * folder. `content-hash-mismatch` means Box stored a file whose `sha1` differs
 * from the local SHA-1. `unreadable-response` means Box answered without an id
 * or hash to verify. `budget-exhausted` means a folder re-list needed more calls
 * than the budget allowed. Raw provider error text is never retained.
 *
 * **Example** (Check the hash-mismatch failure kind)
 *
 * ```ts
 * import { BoxContentFailureKind } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentFailureKind.is["content-hash-mismatch"]("content-hash-mismatch"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentFailureKind = LiteralKit([
  "provider-error",
  "name-in-use",
  "content-hash-mismatch",
  "unreadable-response",
  "budget-exhausted",
]).pipe(
  $I.annoteSchema("BoxContentFailureKind", {
    description: "Sanitized closed classification of a failed content-migration write.",
  })
);

/**
 * Runtime type for {@link BoxContentFailureKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentFailureKind = typeof BoxContentFailureKind.Type;

/**
 * Reason a planned file was reported as blocked instead of uploaded.
 *
 * **Example** (Check the name-conflict block reason)
 *
 * ```ts
 * import { BoxContentBlockReason } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentBlockReason.is["name-conflict"]("name-conflict"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentBlockReason = LiteralKit(["name-conflict", "source-missing", "source-changed"]).pipe(
  $I.annoteSchema("BoxContentBlockReason", {
    description: "Plan blocker carried onto the receipt for a file that was never mutated.",
  })
);

/**
 * Runtime type for {@link BoxContentBlockReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentBlockReason = typeof BoxContentBlockReason.Type;

/**
 * Reason a planned write was never dispatched.
 *
 * **Example** (Check the budget reason)
 *
 * ```ts
 * import { BoxContentNotAttemptedReason } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentNotAttemptedReason.is["budget-exhausted"]("budget-exhausted"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentNotAttemptedReason = LiteralKit(["budget-exhausted", "dependency-failed"]).pipe(
  $I.annoteSchema("BoxContentNotAttemptedReason", {
    description: "Provider-call budget stop or failed parent folder that prevented a planned write.",
  })
);

/**
 * Runtime type for {@link BoxContentNotAttemptedReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentNotAttemptedReason = typeof BoxContentNotAttemptedReason.Type;

const outcomeFields = {
  actionDigest: Sha256Hex,
  actionKind: BoxContentActionKind,
} satisfies S.Struct.Fields;

/**
 * Receipt outcome for a folder created or adopted, or a file uploaded and verified.
 *
 * **Details**
 *
 * `adopted` is true only for a planned folder create that met a Box 409 and
 * bound the existing provider-equivalent folder instead.
 *
 * **Example** (Record a verified upload)
 *
 * ```ts
 * import { BoxContentActionApplied } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxContentActionApplied.make({
 *   actionDigest: Sha256Hex.make("a".repeat(64)),
 *   actionKind: "file",
 *   adopted: false,
 *   providerId: BoxProviderId.make("300")
 * })
 * console.log(outcome._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentActionApplied extends S.TaggedClass<BoxContentActionApplied>($I`BoxContentActionApplied`)(
  "Applied",
  { ...outcomeFields, providerId: BoxProviderId, adopted: S.Boolean },
  $I.annote("BoxContentActionApplied", {
    description: "Folder created or adopted, or file uploaded with a verified SHA-1.",
  })
) {}

/**
 * Receipt outcome for an action that needed no write.
 *
 * **Example** (Record an existing folder)
 *
 * ```ts
 * import { BoxContentActionSkipped } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxContentActionSkipped.make({
 *   actionDigest: Sha256Hex.make("a".repeat(64)),
 *   actionKind: "folder",
 *   providerId: BoxProviderId.make("200")
 * })
 * console.log(outcome._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentActionSkipped extends S.TaggedClass<BoxContentActionSkipped>($I`BoxContentActionSkipped`)(
  "Skipped",
  { ...outcomeFields, providerId: BoxProviderId },
  $I.annote("BoxContentActionSkipped", {
    description: "Existing folder or identical file that required no provider write.",
  })
) {}

/**
 * Receipt outcome for a blocked file that was reported and never mutated.
 *
 * **Example** (Record a blocked name conflict)
 *
 * ```ts
 * import { BoxContentActionBlocked } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const outcome = BoxContentActionBlocked.make({
 *   actionDigest: Sha256Hex.make("a".repeat(64)),
 *   actionKind: "file",
 *   providerId: O.some(BoxProviderId.make("301")),
 *   reason: "name-conflict"
 * })
 * console.log(outcome.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentActionBlocked extends S.TaggedClass<BoxContentActionBlocked>($I`BoxContentActionBlocked`)(
  "Blocked",
  { ...outcomeFields, reason: BoxContentBlockReason, providerId: optionalProviderId },
  $I.annote("BoxContentActionBlocked", {
    description: "Blocked file action carried from the reviewed plan without any provider write.",
  })
) {}

/**
 * Receipt outcome for a write that was dispatched and did not verify.
 *
 * **Details**
 *
 * `providerId` is present when Box created an item anyway, for example an
 * upload whose stored `sha1` did not match. That item is left in place.
 *
 * **Example** (Record a provider failure)
 *
 * ```ts
 * import { BoxContentActionFailed } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const outcome = BoxContentActionFailed.make({
 *   actionDigest: Sha256Hex.make("a".repeat(64)),
 *   actionKind: "file",
 *   failureKind: "provider-error",
 *   providerId: O.none(),
 *   status: O.some(503)
 * })
 * console.log(outcome.failureKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentActionFailed extends S.TaggedClass<BoxContentActionFailed>($I`BoxContentActionFailed`)(
  "Failed",
  {
    ...outcomeFields,
    failureKind: BoxContentFailureKind,
    status: S.OptionFromOptionalKey(HttpStatus).pipe(S.withConstructorDefault(Effect.succeedNone)),
    providerId: optionalProviderId,
  },
  $I.annote("BoxContentActionFailed", {
    description: "Dispatched write that failed, with a closed failure kind and optional HTTP status.",
  })
) {}

/**
 * Receipt outcome for a planned write that was never dispatched.
 *
 * **Example** (Record a budget stop)
 *
 * ```ts
 * import { BoxContentActionNotAttempted } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxContentActionNotAttempted.make({
 *   actionDigest: Sha256Hex.make("a".repeat(64)),
 *   actionKind: "file",
 *   reason: "budget-exhausted"
 * })
 * console.log(outcome.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentActionNotAttempted extends S.TaggedClass<BoxContentActionNotAttempted>(
  $I`BoxContentActionNotAttempted`
)(
  "NotAttempted",
  { ...outcomeFields, reason: BoxContentNotAttemptedReason },
  $I.annote("BoxContentActionNotAttempted", {
    description: "Planned write skipped by the provider-call budget or by a failed parent folder.",
  })
) {}

/**
 * Tagged union of content-migration receipt outcomes.
 *
 * **Example** (Inspect the outcome schema)
 *
 * ```ts
 * import { BoxContentActionOutcome } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentActionOutcome.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentActionOutcome = S.Union([
  BoxContentActionApplied,
  BoxContentActionSkipped,
  BoxContentActionBlocked,
  BoxContentActionFailed,
  BoxContentActionNotAttempted,
]).pipe(
  $I.annoteSchema("BoxContentActionOutcome", {
    description: "Applied, skipped, blocked, failed, or not-attempted result for one planned action.",
  })
);

/**
 * Runtime type for {@link BoxContentActionOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentActionOutcome = typeof BoxContentActionOutcome.Type;

/**
 * Number of receipt outcomes per outcome tag.
 *
 * **Example** (Count an empty run)
 *
 * ```ts
 * import { BoxContentMigrationCounts } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * const counts = BoxContentMigrationCounts.make({
 *   applied: 0,
 *   blocked: 0,
 *   failed: 0,
 *   notAttempted: 0,
 *   skipped: 0
 * })
 * console.log(counts.applied)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationCounts extends S.Class<BoxContentMigrationCounts>($I`BoxContentMigrationCounts`)(
  {
    applied: S.Natural,
    skipped: S.Natural,
    blocked: S.Natural,
    failed: S.Natural,
    notAttempted: S.Natural,
  },
  $I.annote("BoxContentMigrationCounts", { description: "Receipt outcome totals by outcome tag." })
) {}

/**
 * Redacted proof of one content-migration apply invocation.
 *
 * **Details**
 *
 * Outcomes list every folder action in plan order, then every file action in
 * plan order. `providerCalls` counts the whole run: the fresh pre-apply plan,
 * every write, and the post-apply plan. `appliedAt` encodes as a UTC ISO 8601
 * string, so the JSON receipt decodes back. No name, path, or provider error
 * text is retained.
 *
 * **Example** (Inspect the receipt schema)
 *
 * ```ts
 * import { BoxContentMigrationReceipt } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentMigrationReceipt.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationReceipt extends S.Class<BoxContentMigrationReceipt>($I`BoxContentMigrationReceipt`)(
  {
    version: S.Literal("box-content-migration-receipt/v1").pipe(
      S.withConstructorDefault(Effect.succeed("box-content-migration-receipt/v1"))
    ),
    planDigest: Sha256Hex,
    attemptId: BoxApplyAttemptId,
    appliedAt: S.DateTimeUtcFromString,
    outcomes: S.Array(BoxContentActionOutcome),
    counts: BoxContentMigrationCounts,
    uploadedBytes: S.Natural,
    providerCalls: S.Natural,
    maxProviderCalls: S.OptionFromOptionalKey(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("BoxContentMigrationReceipt", {
    description: "Redacted per-action outcomes, counts, uploaded bytes, and provider-call usage for one apply.",
  })
) {}

/**
 * Whether the post-apply plan proves the migration is finished.
 *
 * **Details**
 *
 * `complete` requires the post-apply plan to contain nothing but
 * `FolderExists` and `SkipIdentical`. Anything else is `incomplete`.
 *
 * **Example** (Check the complete verdict)
 *
 * ```ts
 * import { BoxContentMigrationVerdict } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentMigrationVerdict.is.complete("complete"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentMigrationVerdict = LiteralKit(["complete", "incomplete"]).pipe(
  $I.annoteSchema("BoxContentMigrationVerdict", {
    description: "Complete only when the post-apply plan holds existing folders and identical files alone.",
  })
);

/**
 * Runtime type for {@link BoxContentMigrationVerdict}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentMigrationVerdict = typeof BoxContentMigrationVerdict.Type;

/**
 * Receipt, fresh post-apply plan, and verdict returned by a reviewed migration apply.
 *
 * **Example** (Inspect the apply-result schema)
 *
 * ```ts
 * import { BoxContentMigrationApplyResult } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentMigrationApplyResult.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationApplyResult extends S.Class<BoxContentMigrationApplyResult>(
  $I`BoxContentMigrationApplyResult`
)(
  {
    receipt: BoxContentMigrationReceipt,
    postPlan: BoxContentMigrationPlan,
    verdict: BoxContentMigrationVerdict,
  },
  $I.annote("BoxContentMigrationApplyResult", {
    description: "Apply receipt, immediate post-apply plan, and completion verdict.",
  })
) {}

const journalFields = {
  attemptId: BoxApplyAttemptId,
  planDigest: Sha256Hex,
  sequence: S.Natural,
  actionDigest: Sha256Hex,
  actionKind: BoxContentActionKind,
  providerId: optionalProviderId,
} satisfies S.Struct.Fields;

const journalExampleFields = {
  actionDigest: Sha256Hex.make("a".repeat(64)),
  actionKind: "file" as const,
  attemptId: BoxApplyAttemptId.make("attempt-12345678"),
  planDigest: Sha256Hex.make("c".repeat(64)),
  sequence: 0,
};

/**
 * Journal record written durably before one folder create or upload is dispatched.
 *
 * **Example** (Record a started upload)
 *
 * ```ts
 * import {
 *   BoxContentJournalStarted,
 *   makeExampleContentJournalFields
 * } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * const entry = BoxContentJournalStarted.make(makeExampleContentJournalFields())
 * console.log(entry.phase)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentJournalStarted extends S.Class<BoxContentJournalStarted>($I`BoxContentJournalStarted`)(
  { ...journalFields, phase: S.tag("Started") },
  $I.annote("BoxContentJournalStarted", {
    description: "Sanitized journal entry persisted before one content-migration write is dispatched.",
  })
) {}

/**
 * Journal record written after a folder create or a verified upload succeeds.
 *
 * **Example** (Record an applied upload)
 *
 * ```ts
 * import {
 *   BoxContentJournalApplied,
 *   makeExampleContentJournalFields
 * } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * const entry = BoxContentJournalApplied.make(makeExampleContentJournalFields())
 * console.log(entry.phase)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentJournalApplied extends S.Class<BoxContentJournalApplied>($I`BoxContentJournalApplied`)(
  { ...journalFields, phase: S.tag("Applied") },
  $I.annote("BoxContentJournalApplied", {
    description: "Sanitized journal entry persisted after one content-migration write succeeds.",
  })
) {}

/**
 * Journal record written after a dispatched write fails or does not verify.
 *
 * **Example** (Record a failed upload)
 *
 * ```ts
 * import {
 *   BoxContentJournalFailed,
 *   makeExampleContentJournalFields
 * } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * const entry = BoxContentJournalFailed.make({
 *   ...makeExampleContentJournalFields(),
 *   failureKind: "provider-error"
 * })
 * console.log(entry.failureKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentJournalFailed extends S.Class<BoxContentJournalFailed>($I`BoxContentJournalFailed`)(
  { ...journalFields, phase: S.tag("Failed"), failureKind: BoxContentFailureKind },
  $I.annote("BoxContentJournalFailed", {
    description: "Sanitized journal entry persisted after one content-migration write fails.",
  })
) {}

/**
 * Journal record for a file or folder action that was deliberately not written.
 *
 * **Example** (Record an identical file)
 *
 * ```ts
 * import {
 *   BoxContentJournalSkipped,
 *   makeExampleContentJournalFields
 * } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * const entry = BoxContentJournalSkipped.make({ ...makeExampleContentJournalFields(), reason: "identical" })
 * console.log(entry.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentJournalSkipped extends S.Class<BoxContentJournalSkipped>($I`BoxContentJournalSkipped`)(
  {
    ...journalFields,
    phase: S.tag("Skipped"),
    reason: LiteralKit([
      "identical",
      "name-conflict",
      "source-missing",
      "source-changed",
      "budget-exhausted",
      "dependency-failed",
    ]),
  },
  $I.annote("BoxContentJournalSkipped", {
    description: "Sanitized journal entry for an identical, blocked, or not-attempted content-migration action.",
  })
) {}

/**
 * Journal record for a planned folder create that bound an existing Box folder.
 *
 * **Details**
 *
 * Emitted only when a create met a Box 409 and a re-list of the parent found
 * the folder with the provider-equivalent name. This is the single case in
 * which a folder absent from the reviewed plan is accepted.
 *
 * **Example** (Record an adopted folder)
 *
 * ```ts
 * import {
 *   BoxContentJournalAdoptedExistingFolder,
 *   makeExampleContentJournalFields
 * } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import * as O from "effect/Option"
 *
 * const entry = BoxContentJournalAdoptedExistingFolder.make({
 *   ...makeExampleContentJournalFields(),
 *   actionKind: "folder",
 *   providerId: O.some(BoxProviderId.make("200"))
 * })
 * console.log(entry.phase)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentJournalAdoptedExistingFolder extends S.Class<BoxContentJournalAdoptedExistingFolder>(
  $I`BoxContentJournalAdoptedExistingFolder`
)(
  { ...journalFields, phase: S.tag("AdoptedExistingFolder") },
  $I.annote("BoxContentJournalAdoptedExistingFolder", {
    description: "Sanitized journal entry for a folder create resolved by adopting the existing same-name folder.",
  })
) {}

/**
 * Append-only sanitized evidence emitted around each content-migration action.
 *
 * **Example** (Inspect the journal-entry schema)
 *
 * ```ts
 * import { BoxContentJournalEntry } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(BoxContentJournalEntry.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentJournalEntry = S.Union([
  BoxContentJournalStarted,
  BoxContentJournalApplied,
  BoxContentJournalFailed,
  BoxContentJournalSkipped,
  BoxContentJournalAdoptedExistingFolder,
]).pipe(
  $I.annoteSchema("BoxContentJournalEntry", {
    description: "Started, applied, failed, skipped, or adopted-folder evidence for one content-migration action.",
  })
);

/**
 * Runtime type for {@link BoxContentJournalEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentJournalEntry = typeof BoxContentJournalEntry.Type;

/**
 * Produce non-sensitive fixture fields shared by content-journal examples.
 *
 * **Example** (Read example journal fields)
 *
 * ```ts
 * import { makeExampleContentJournalFields } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(makeExampleContentJournalFields().sequence)
 * ```
 *
 * @returns Fixture fields suitable for constructing any content-journal entry in documentation.
 * @category fixtures
 * @since 0.0.0
 */
export const makeExampleContentJournalFields = (): typeof journalExampleFields => journalExampleFields;

const encodeBoxContentMigrationReceiptJson = S.encodeEffect(S.fromJsonString(BoxContentMigrationReceipt));
const decodeUnknownBoxContentMigrationReceiptJson = S.decodeUnknownEffect(S.fromJsonString(BoxContentMigrationReceipt));
const encodeBoxContentJournalEntryJson = S.encodeEffect(S.fromJsonString(BoxContentJournalEntry));

const schemaError = (stage: BoxProvisioningSchemaError["stage"]) => () => BoxProvisioningSchemaError.make({ stage });

/**
 * Encode a redacted content-migration receipt as schema-validated JSON.
 *
 * **Example** (Inspect the receipt encoder)
 *
 * ```ts
 * import { encodeBoxContentMigrationReceipt } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(encodeBoxContentMigrationReceipt)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxContentMigrationReceipt = (
  receipt: BoxContentMigrationReceipt
): Effect.Effect<string, BoxProvisioningSchemaError> =>
  encodeBoxContentMigrationReceiptJson(receipt).pipe(Effect.mapError(schemaError("migration-receipt")));

/**
 * Decode schema-validated content-migration receipt JSON.
 *
 * **Example** (Inspect the receipt decoder)
 *
 * ```ts
 * import { decodeBoxContentMigrationReceipt } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(decodeBoxContentMigrationReceipt)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxContentMigrationReceipt = (
  text: unknown
): Effect.Effect<BoxContentMigrationReceipt, BoxProvisioningSchemaError> =>
  decodeUnknownBoxContentMigrationReceiptJson(text).pipe(Effect.mapError(schemaError("migration-receipt")));

/**
 * Encode one sanitized content-journal entry as a single JSON value.
 *
 * **Example** (Inspect the journal encoder)
 *
 * ```ts
 * import { encodeBoxContentJournalEntry } from "@beep/box-provisioning/BoxContentMigrationReceipt"
 *
 * console.log(encodeBoxContentJournalEntry)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxContentJournalEntry = (
  entry: BoxContentJournalEntry
): Effect.Effect<string, BoxProvisioningSchemaError> =>
  encodeBoxContentJournalEntryJson(entry).pipe(Effect.mapError(schemaError("migration-journal")));
