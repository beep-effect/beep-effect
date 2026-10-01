import { M365Error } from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";

const statusOf = (status: number) => M365Error.fromReason("response status", { status }).status;

describe("M365Error status", () => {
  it("keeps catalogued statuses, including the unofficial ones", () => {
    assertSome(statusOf(404), 404);
    assertSome(statusOf(499), 499);
  });

  it("reports a status outside the catalogue as 500", () => {
    assertSome(statusOf(419), 500);
    assertSome(statusOf(299), 500);
  });
});
