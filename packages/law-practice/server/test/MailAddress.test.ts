import { mailAddressOf } from "@beep/law-practice-server/internal/MailAddress";
import { EmailString } from "@beep/schema/Email";
import { it } from "@beep/test-runner";
import { assertNone, assertSome } from "@effect/vitest/utils";

it("reads no address from angle brackets inside a quoted local part that do not close the header value", () => {
  assertNone(mailAddressOf('"Pat <pat@example.test>"@other.test'));
  assertSome(mailAddressOf("Pat <Pat@Example.test>"), EmailString.make("pat@example.test"));
});
