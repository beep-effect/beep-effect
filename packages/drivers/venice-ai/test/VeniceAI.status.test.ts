import { it } from "@beep/test-runner";
import { VENICE_AI_OPERATION_DESCRIPTORS, VeniceAIError } from "@beep/venice-ai";
import { describe } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";

const statusOf = (status: number) =>
  A.head(VENICE_AI_OPERATION_DESCRIPTORS).pipe(
    O.map(VeniceAIError.fromDescriptor("response status", { status })),
    O.flatMap((error) => error.status)
  );

describe("VeniceAIError status", () => {
  it("keeps catalogued statuses, including the unofficial ones", () => {
    assertSome(statusOf(429), 429);
    assertSome(statusOf(521), 521);
  });

  it("reports a status outside the catalogue as 500", () => {
    assertSome(statusOf(419), 500);
    assertSome(statusOf(299), 500);
  });
});
