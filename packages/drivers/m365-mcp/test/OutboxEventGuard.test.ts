import { GraphEmailAddress, GraphEvent, GraphEventAttendee } from "@beep/m365";
import {
  checkEventUpdate,
  OutboxEventUpdateCheck,
  OutboxEventUpdateRefusalReason,
  storedAttendeeCount,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EVENT_ID } from "./OutboxWorld.fixture.ts";

const GuardCase = S.Struct({
  // Absent, empty, or up to three attendees; an attendee may carry no address and no type.
  attendees: S.Option(
    S.Array(
      S.Struct({ hasAddress: S.Boolean, type: S.Option(S.Literals(["required", "optional", "resource"])) })
    ).check(S.isMaxLength(3))
  ),
  createdHere: S.Boolean,
});
type GuardCase = typeof GuardCase.Type;

const checkOf = (input: GuardCase): OutboxEventUpdateCheck =>
  OutboxEventUpdateCheck.make({
    createdHere: input.createdHere,
    event: GraphEvent.make({
      attendees: O.map(
        input.attendees,
        A.map((attendee) =>
          GraphEventAttendee.make({
            emailAddress: attendee.hasAddress
              ? O.some(GraphEmailAddress.make({ address: O.some("guest@example.test") }))
              : O.none(),
            type: attendee.type,
          })
        )
      ),
      id: EVENT_ID,
    }),
  });

const reasonOf = (input: GuardCase) => O.map(checkEventUpdate(checkOf(input)), (refusal) => refusal.reason);

describe("@beep/m365-mcp outbox event update guard", () => {
  it("allows an own event without attendees, whether the list is absent or empty", () => {
    assertNone(reasonOf({ attendees: O.none(), createdHere: true }));
    assertNone(reasonOf({ attendees: O.some([]), createdHere: true }));
  });

  it("refuses an event this server did not create, before it looks at attendees", () => {
    assertSome(reasonOf({ attendees: O.none(), createdHere: false }), "not-created-here");
    assertSome(
      reasonOf({ attendees: O.some([{ hasAddress: true, type: O.some("required") }]), createdHere: false }),
      "not-created-here"
    );
  });

  it("refuses an own event with any attendee, even one without an address or a type", () => {
    const refusal = checkEventUpdate(
      checkOf({
        attendees: O.some([
          { hasAddress: false, type: O.none() },
          { hasAddress: true, type: O.some("resource") },
        ]),
        createdHere: true,
      })
    );

    assertSome(
      O.map(refusal, (found) => [found.reason, found.attendeeCount]),
      ["has-attendees", 2]
    );
  });

  it.prop(
    "allows exactly the events created here that have no attendee",
    [Arbitrary.schema(GuardCase)],
    ([input]) => {
      const check = checkOf(input);
      const count = storedAttendeeCount(check.event);
      const refusal = checkEventUpdate(check);

      assert.strictEqual(O.isNone(refusal), input.createdHere && count === 0);
      assert.strictEqual(count, O.match(input.attendees, { onNone: () => 0, onSome: A.length }));
      if (O.isSome(refusal)) {
        assert.isTrue(S.is(OutboxEventUpdateRefusalReason)(refusal.value.reason));
        assert.strictEqual(refusal.value.reason, input.createdHere ? "has-attendees" : "not-created-here");
        assert.strictEqual(refusal.value.attendeeCount, count);
      }
    },
    { arbitrary: fcRuns(100) }
  );
});
