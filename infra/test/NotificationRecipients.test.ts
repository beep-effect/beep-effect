import { decodeNotificationRecipients } from "@beep/infra";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";

describe("@beep/infra NotificationRecipients", () => {
  it("decodes recipients into deduplicated secrets and redacts invalid values", () => {
    const recipients = decodeNotificationRecipients(["ops@example.com", "ops@example.com", "cost@example.com"]);
    expect(recipients).toHaveLength(2);
    assertTrue(A.every(recipients, pulumi.Output.isInstance));
    expect(() => decodeNotificationRecipients(["private-recipient-value"])).toThrow(
      /^Invalid accountCostControls notification recipients; values are redacted$/u
    );
    expect(() => decodeNotificationRecipients([])).toThrow(/values are redacted$/u);
  });
});
