/**
 * Schema-validated codecs for Box provisioning boundary artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import * as S from "effect/Schema";
import { BoxProvisioningSchemaError } from "./BoxProvisioningErrors.ts";
import { BoxDesiredState } from "./BoxProvisioningIntent.ts";
import { BoxProvisioningPlan } from "./BoxProvisioningPlan.ts";
import { BoxApplyJournalEntry, BoxApplyReceipt } from "./BoxProvisioningReceipt.ts";

const decodeUnknownBoxDesiredState = S.decodeUnknownEffect(BoxDesiredState);
const decodeUnknownBoxApplyReceiptJson = S.decodeUnknownEffect(S.fromJsonString(BoxApplyReceipt));
const decodeUnknownBoxProvisioningPlanJson = S.decodeUnknownEffect(S.fromJsonString(BoxProvisioningPlan));
const encodeBoxApplyJournalEntryJson = S.encodeEffect(S.fromJsonString(BoxApplyJournalEntry));
const encodeBoxApplyReceiptJson = S.encodeEffect(S.fromJsonString(BoxApplyReceipt));
const encodeBoxProvisioningPlanJson = S.encodeEffect(S.fromJsonString(BoxProvisioningPlan));

const schemaError = (stage: BoxProvisioningSchemaError["stage"]) => BoxProvisioningSchemaError.make({ stage });

/**
 * Decode and validate a secure desired-state value before any provider access.
 *
 * **Example** (Decode an intent object)
 *
 * ```ts
 * import { decodeBoxDesiredState } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(decodeBoxDesiredState)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxDesiredState = (value: unknown) =>
  decodeUnknownBoxDesiredState(value).pipe(Effect.mapError(() => schemaError("desired-state")));

/**
 * Encode a redacted provisioning plan as schema-validated JSON.
 *
 * **Example** (Inspect the plan encoder)
 *
 * ```ts
 * import { encodeBoxProvisioningPlan } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(encodeBoxProvisioningPlan)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxProvisioningPlan = (plan: BoxProvisioningPlan) =>
  encodeBoxProvisioningPlanJson(plan).pipe(Effect.mapError(() => schemaError("plan")));

/**
 * Decode schema-validated reviewed plan JSON.
 *
 * **Example** (Inspect the plan decoder)
 *
 * ```ts
 * import { decodeBoxProvisioningPlan } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(decodeBoxProvisioningPlan)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxProvisioningPlan = (text: unknown) =>
  decodeUnknownBoxProvisioningPlanJson(text).pipe(Effect.mapError(() => schemaError("plan")));

/**
 * Encode a redacted apply receipt as schema-validated JSON.
 *
 * **Example** (Inspect the receipt encoder)
 *
 * ```ts
 * import { encodeBoxApplyReceipt } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(encodeBoxApplyReceipt)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxApplyReceipt = (receipt: BoxApplyReceipt) =>
  encodeBoxApplyReceiptJson(receipt).pipe(Effect.mapError(() => schemaError("receipt")));

/**
 * Decode schema-validated apply-receipt JSON.
 *
 * **Example** (Inspect the receipt decoder)
 *
 * ```ts
 * import { decodeBoxApplyReceipt } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(decodeBoxApplyReceipt)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxApplyReceipt = (text: unknown) =>
  decodeUnknownBoxApplyReceiptJson(text).pipe(Effect.mapError(() => schemaError("receipt")));

/**
 * Encode one sanitized apply-journal entry as a single JSON value.
 *
 * **Example** (Inspect the journal encoder)
 *
 * ```ts
 * import { encodeBoxApplyJournalEntry } from "@beep/box-provisioning/BoxProvisioningArtifacts"
 *
 * console.log(encodeBoxApplyJournalEntry)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxApplyJournalEntry = (entry: BoxApplyJournalEntry) =>
  encodeBoxApplyJournalEntryJson(entry).pipe(Effect.mapError(() => schemaError("journal")));
