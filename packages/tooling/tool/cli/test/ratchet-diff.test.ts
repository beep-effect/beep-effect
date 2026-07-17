import { renderTruncatedLines } from "@beep/repo-cli/test/Artifacts";
import { diffMembership, diffTotals, enforceRatchet, RatchetTotalsDiff } from "@beep/repo-cli/test/Ratchet";
import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Exit, Order } from "effect";
import * as O from "effect/Option";

const stringEquivalence = (left: string, right: string): boolean => left === right;

class RatchetTestError extends Data.TaggedError("RatchetTestError")<{ readonly message: string }> {}

describe("internal/ratchet/RatchetDiff diffMembership", () => {
  it("classifies introduced and resolved findings against the baseline", () => {
    const diff = diffMembership({
      current: ["a", "c"],
      baseline: ["a", "b"],
      equivalence: stringEquivalence,
      order: Order.String,
    });

    expect(diff.introduced).toEqual(["c"]);
    expect(diff.resolved).toEqual(["b"]);
    expect(diff.currentCount).toBe(2);
    expect(diff.baselineCount).toBe(2);
  });

  it("re-sorts both directions by the supplied order regardless of input order", () => {
    const diff = diffMembership({
      current: ["z", "m", "a"],
      baseline: [],
      equivalence: stringEquivalence,
      order: Order.String,
    });

    expect(diff.introduced).toEqual(["a", "m", "z"]);
    expect(diff.resolved).toEqual([]);
  });

  it("reports no regression when current is a subset of the baseline", () => {
    const diff = diffMembership({
      current: ["a"],
      baseline: ["a", "b"],
      equivalence: stringEquivalence,
      order: Order.String,
    });

    expect(diff.introduced).toEqual([]);
    expect(diff.resolved).toEqual(["b"]);
  });
});

describe("internal/ratchet/RatchetDiff diffTotals", () => {
  it("classifies increased, decreased, and missing metrics", () => {
    const diff = diffTotals({
      current: { grew: 5, shrank: 1, steady: 3 },
      baseline: { grew: 2, shrank: 4, steady: 3, gone: 7 },
    });

    expect(diff.increased.map((delta) => delta.metric)).toEqual(["grew"]);
    expect(diff.increased[0]?.delta).toBe(3);
    expect(diff.decreased.map((delta) => delta.metric)).toEqual(["shrank"]);
    expect(diff.decreased[0]?.delta).toBe(-3);
    expect(diff.missing).toEqual(["gone"]);
    expect(diff.currentTotalCount).toBe(3);
    expect(diff.baselineTotalCount).toBe(4);
  });

  it("treats an absent baseline metric as zero when the current metric exists", () => {
    const diff = diffTotals({
      current: { fresh: 4 },
      baseline: { fresh: 0 },
    });

    expect(diff.increased.map((delta) => [delta.metric, delta.baseline, delta.current, delta.delta])).toEqual([
      ["fresh", 0, 4, 4],
    ]);
  });

  it("is a decodable schema value", () => {
    const diff = diffTotals({ current: {}, baseline: {} });
    expect(diff).toBeInstanceOf(RatchetTotalsDiff);
    expect(diff.increased).toEqual([]);
    expect(diff.missing).toEqual([]);
  });
});

describe("internal/ratchet/RatchetLifecycle enforceRatchet", () => {
  it.effect(
    "fails with the first present regression's error",
    Effect.fnUntraced(function* () {
      const error = new RatchetTestError({ message: "baseline grew" });
      const exit = yield* Effect.exit(
        enforceRatchet({
          regressions: [
            { present: false, lines: ["skipped"], error: new RatchetTestError({ message: "not this one" }) },
            { present: true, lines: ["[demo] regression: 1 finding(s)"], error },
          ],
          okLine: "[demo] ok",
          tighten: O.none(),
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain("baseline grew");
      }
    })
  );

  it.effect(
    "succeeds and emits the ok line when no regression is present",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        enforceRatchet({
          regressions: [{ present: false, lines: ["skipped"], error: new RatchetTestError({ message: "unused" }) }],
          okLine: "[demo] ok: current=0 baseline=0 introduced=0",
          tighten: O.some(["[demo] tighten-baseline: 1 finding(s) are no longer present"]),
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
    })
  );
});

describe("internal/artifacts/ArtifactIo renderTruncatedLines", () => {
  it("renders every item when within the limit", () => {
    const lines = renderTruncatedLines({
      items: ["a", "b"],
      render: (item: string) => `  - ${item}`,
      limit: 5,
    });

    expect(lines).toEqual(["  - a", "  - b"]);
  });

  it("appends a single '... N more' line when the list overflows", () => {
    const lines = renderTruncatedLines({
      items: ["a", "b", "c", "d"],
      render: (item: string) => `  - ${item}`,
      limit: 2,
    });

    expect(lines).toEqual(["  - a", "  - b", "  - ... 2 more"]);
  });
});
