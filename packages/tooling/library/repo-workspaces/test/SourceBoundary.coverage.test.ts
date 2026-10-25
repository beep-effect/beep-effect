import { MemoryFileSystem } from "@beep/memfs";
import { Offence, SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";

describe("SourceBoundary coverage controls", () => {
  it.effect("the namespace constructor preserves the static scanner surface", () =>
    Effect.sync(() => {
      const namespace: unknown = Reflect.construct(SourceBoundary, []);
      assert.strictEqual(Object.getPrototypeOf(namespace), SourceBoundary.prototype);
      assert.strictEqual(SourceBoundary.referencesProcess("process.cwd()"), true);
    })
  );
  it.effect("console member parsing tolerates whitespace, astral names and a missing member", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(
        A.map(
          SourceBoundary.check("f.ts", "console \n . \t log(x); console.; console.𝒙(x);", ["console-stdout"]),
          (offence) => offence.detail
        ),
        ["console.log", "console", "console.𝒙"]
      );
    })
  );
  it.effect("fixture verification diagnoses missed positives", () =>
    Effect.sync(() => {
      const spy = vi.spyOn(SourceBoundary, "check").mockImplementation(
        dual(
          (args) => P.isString(args[1]),
          (): ReadonlyArray<Offence> => []
        )
      );
      try {
        assert.deepStrictEqual(
          SourceBoundary.verifyFixtures(),
          A.map(
            A.filter(SourceBoundary.fixtures, (fixture) => fixture.flagged),
            (fixture) => `missed: ${fixture.name}`
          )
        );
      } finally {
        spy.mockRestore();
      }
      assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
    })
  );
  it.effect("fixture verification diagnoses false positives", () =>
    Effect.sync(() => {
      const offence = Offence.make({ file: "fixture.ts", line: 1, column: 1, rule: "process", detail: "process" });
      const spy = vi.spyOn(SourceBoundary, "check").mockImplementation(
        dual(
          (args) => P.isString(args[1]),
          (): ReadonlyArray<Offence> => [offence]
        )
      );
      try {
        assert.deepStrictEqual(
          SourceBoundary.verifyFixtures(),
          A.map(
            A.filter(SourceBoundary.fixtures, (fixture) => fixture.flagged === false),
            (fixture) => `false positive: ${fixture.name}`
          )
        );
      } finally {
        spy.mockRestore();
      }
      assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
    })
  );
  it.layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/repo/a.ts": "process.cwd(); console.log(1);" }), Path.layer), {
    timeout: "10 seconds",
  })((it) => {
    // W4-j: EF-40 (#2145) made rule waivers exact keys, so an absent waiver stands in for the old explicit undefined.
    it.effect("absent rule waivers do not waive offences", () =>
      Effect.gen(function* () {
        const report = yield* SourceBoundary.scan({
          root: "/repo",
          rules: ["process", "console"],
          allowRules: { console: ["a.ts"] },
        });
        assert.deepStrictEqual(
          A.map(report.offences, (offence) => offence.rule),
          ["process"]
        );
        assert.deepStrictEqual(
          A.map(report.waived, (offence) => offence.rule),
          ["console"]
        );
      })
    );
  });
});
