/**
 * The account notification recipient list the AWS turbo cache's throttle
 * alarm reads from `accountCostControls:notificationEmailAddresses`.
 *
 * **Details**
 *
 * Kept from the retired `AccountCostControls` component, whose controls now
 * belong to the `CostControls` Alchemy stack (`@beep/infra-cost-controls`).
 * The config key keeps its name so the alarm's input is unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraId } from "@beep/identity/packages";
import { EmailString } from "@beep/schema";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $InfraId.create("NotificationRecipients");

const NotificationEmails = S.NonEmptyArray(EmailString).pipe(
  $I.annoteSchema("NotificationEmails", { description: "Existing budget recipients supplied through secret config." })
);
const decodeNotificationEmails = S.decodeUnknownResult(NotificationEmails);

/**
 * Decode the account notification recipients into deduplicated secret outputs.
 *
 * **Details**
 *
 * Read the config value synchronously so callers know the recipient count
 * when they declare one resource per recipient; each address is re-wrapped
 * as a Pulumi secret. Invalid input throws a `RunError` that names no value.
 *
 * **Example** (Decode recipients for per-recipient resources)
 *
 * ```ts
 * import { decodeNotificationRecipients } from "@beep/infra"
 *
 * const recipients = decodeNotificationRecipients(["ops@example.com", "ops@example.com"])
 * console.assert(recipients.length === 1)
 * ```
 *
 * @param input - The `accountCostControls:notificationEmailAddresses` config value.
 * @returns One secret output per distinct recipient address.
 * @category configuration
 * @since 0.0.0
 */
export const decodeNotificationRecipients = (input: unknown): ReadonlyArray<pulumi.Output<string>> =>
  A.map(
    A.dedupe(
      Result.getOrThrowWith(
        decodeNotificationEmails(input),
        () => new pulumi.RunError("Invalid accountCostControls notification recipients; values are redacted")
      )
    ),
    (email) => pulumi.secret(email)
  );
