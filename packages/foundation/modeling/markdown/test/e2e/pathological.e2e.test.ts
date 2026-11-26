import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { isGuardExceeded } from "@beep/markdown/internal/carriers";
import { ReferenceScanner } from "@beep/markdown/internal/references";
import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Str from "effect/String";
import { renderHtml } from "../support/htmlWriter.ts";
import { PATHOLOGICAL_CASES } from "../support/pathological/cases.ts";

const GUARD_REFUSED: ReadonlySet<string> = new Set([
  "nested strong emph",
  "nested block quotes",
  "deeply nested lists",
]);

// decision: pathological-budgets-calibrated
const CALIBRATION_INPUT = Str.repeat(1000)("aaa\rbbb\n-\u000b\n");

const UNINSTRUMENTED_CALIBRATION_MS = 93;

const speedFactor = ((): number => {
  parseBlocks(CALIBRATION_INPUT, { dialect: "gfm" });
  const started = performance.now();
  parseBlocks(CALIBRATION_INPUT, { dialect: "gfm" });
  const elapsed = performance.now() - started;
  return Math.min(Math.max(elapsed / UNINSTRUMENTED_CALIBRATION_MS, 1), 40);
})();

class DestinationWork extends Context.Service<
  DestinationWork,
  { readonly workOf: (parse: () => unknown) => Effect.Effect<number> }
>()("@beep/markdown/test/e2e/pathological.e2e.test/DestinationWork") {
  static readonly layer = Layer.effect(
    DestinationWork,
    Effect.acquireRelease(
      Effect.sync(() => {
        const tally = MutableRef.make(0);
        const step = ReferenceScanner.prototype.skipDestinationRun;
        ReferenceScanner.prototype.skipDestinationRun = function () {
          const start = this.pos;
          const char = step.call(this);
          MutableRef.update(tally, (work) => work + this.pos - start + 1);
          return char;
        };
        return {
          step,
          service: DestinationWork.of({
            workOf: Effect.fn("DestinationWork.workOf")((parse: () => unknown) =>
              Effect.sync(() => {
                MutableRef.set(tally, 0);
                parse();
                return MutableRef.get(tally);
              })
            ),
          }),
        };
      }),
      ({ step }) =>
        Effect.sync(() => {
          ReferenceScanner.prototype.skipDestinationRun = step;
        })
    ).pipe(Effect.map(({ service }) => service))
  );
}

const uncappedDestinations = (reps: number): void => {
  const scanner = new ReferenceScanner(Str.repeat(reps)("[a](b"));
  for (let attempt = 0; attempt < reps; attempt += 1) {
    scanner.pos = attempt * 5 + 4;
    while (scanner.skipDestinationRun() !== "") scanner.pos += 1;
  }
};

describe("pathological inputs: the cmark suite's linear-time guarantee against quadratic emphasis and link blowup", () => {
  it("carries the whole vendored suite", () => {
    assert.isAtLeast(
      PATHOLOGICAL_CASES.length,
      20,
      "silently-empty-walk guard: an import that resolved to nothing would make every test below vacuous"
    );
  });

  for (const testCase of PATHOLOGICAL_CASES) {
    it(
      testCase.name,
      () => {
        const started = performance.now();
        let caught: unknown;
        let html = "";
        try {
          html =
            testCase.dialect === "gfm"
              ? renderHtml(parseBlocks(testCase.input, { dialect: "gfm" }).root, { gfm: true })
              : renderHtml(parseBlocks(testCase.input).root);
        } catch (error) {
          caught = error;
        }
        const elapsed = performance.now() - started;

        const budget = testCase.timeoutMs * speedFactor;
        assert.isBelow(
          elapsed,
          budget,
          `${testCase.name} took ${elapsed.toFixed(0)}ms, over its ${testCase.timeoutMs}ms budget ` +
            `scaled by ${speedFactor.toFixed(1)}x to ${budget.toFixed(0)}ms: termination is checked first because a hang fails ` +
            `whichever branch the case takes, and an over-budget case is an engine defect, not a budget to raise`
        );

        if (GUARD_REFUSED.has(testCase.name)) {
          assert.isTrue(
            isGuardExceeded(caught),
            `${testCase.name} is listed as guard-refused but did not trip the guard; it nests past the depth cap, so no output exists and the check is a fast trip`
          );
          return;
        }

        assert.isUndefined(
          caught,
          `${testCase.name} threw: ${String(caught)}; a case newly tripping the depth guard must be named in GUARD_REFUSED`
        );
        assert.match(html, testCase.expectedPattern);
      },
      testCase.timeoutMs * 40 + 5000
    );
  }

  it.layer(DestinationWork.layer, { timeout: "5 seconds" })((it) => {
    it.effect("unclosed links B scales linearly", () =>
      Effect.gen(function* () {
        const { workOf } = yield* DestinationWork;
        const workAt = (reps: number) => workOf(() => parseBlocks(Str.repeat(reps)("[a](b")));
        const small = yield* workAt(7500);
        const medium = yield* workAt(15000);
        const large = yield* workAt(30000);
        assert.isAbove(small, 0, "the real parser must enter the metered seam");
        assert.strictEqual(
          medium - small,
          7500 * 33 * 5,
          "past the final 33 shorter-tailed attempts, each extra repetition costs exactly 33 scans of four ordinary units plus a stop"
        );
        assert.strictEqual(large - medium, 15000 * 33 * 5);
      })
    );

    it.effect("the same counter detects uncapped quadratic destination scans", () =>
      Effect.gen(function* () {
        const { workOf } = yield* DestinationWork;
        const small = yield* workOf(() => uncappedDestinations(40));
        const medium = yield* workOf(() => uncappedDestinations(80));
        const large = yield* workOf(() => uncappedDestinations(160));
        assert.isAbove(small, 0);
        assert.isAbove(
          large - medium,
          2 * (medium - small),
          "the removed uncapped scan, reproduced: each failed destination walks its whole tail"
        );
      })
    );
  });
});
