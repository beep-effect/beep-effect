import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { fit, formatAge, orderLanes, prLink, rowColumns, windowStart } from "@/Board";
import { LaneRepository, LanesSnapshot } from "@/Lanes";
import { NOW, ROWS, snapshotOf } from "./fixtures.ts";

const ago = (seconds: number) => DateTime.subtract(NOW, { seconds });

describe("Board", () => {
  it("formats ages in the largest whole unit", () => {
    const age = formatAge(NOW);
    expect([age(ago(45)), age(ago(720)), age(ago(8 * 3_600)), age(ago(2 * 86_400))]).toStrictEqual([
      "45s",
      "12m",
      "8h",
      "2d",
    ]);
    expect(age(DateTime.add(NOW, { minutes: 5 }))).toBe("0s");
  });

  it("fits text to a width, padding or cutting with an ellipsis", () => {
    expect(fit(6)("ab")).toBe("ab    ");
    expect(fit(6)("final-check running")).toBe("final…");
    expect(fit(9)("two\n  lines")).toBe("two lines");
    expect(fit(0)("anything")).toBe("");
  });

  it("builds PR links from the report repository", () => {
    const link = prLink(LaneRepository.make({ host: "github.com", owner: "o", name: "r" }));
    assertSome(link(O.some(7)), "https://github.com/o/r/pull/7");
    assertNone(link(O.none()));
  });

  it("keeps the selection inside the visible window", () => {
    expect(windowStart({ selected: 0, count: 10, height: 4 })).toBe(0);
    expect(windowStart({ selected: 5, count: 10, height: 4 })).toBe(3);
    expect(windowStart({ selected: 9, count: 10, height: 4 })).toBe(6);
    expect(windowStart({ selected: 2, count: 3, height: 10 })).toBe(0);
  });

  it("splits narrow and wide frames into columns that fill the inner width", () => {
    const narrow = rowColumns(40);
    expect(narrow.lane).toBe(13);
    expect(2 + narrow.lane + 1 + 8 + 1 + 6 + 1 + 4 + 1 + narrow.next).toBe(40);
    expect(rowColumns(300).lane).toBe(34);
  });

  it.effect("orders blocked lanes first and newest first within a state", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const lanes = LanesSnapshot.guards.LanesLoaded(snapshot) ? orderLanes(snapshot.lanes) : [];
      expect(A.map(lanes, (lane) => lane.lane)).toStrictEqual([
        "stood-down",
        "reboot-successor",
        "async-merge",
        "residue-closeout",
        "budget-ledger",
      ]);
    })
  );
});
