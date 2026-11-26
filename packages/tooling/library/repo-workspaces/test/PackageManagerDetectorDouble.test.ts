import { DetectedPackageManager, PackageManagerDetectionError, PackageManagerDetector } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";

const pnpm = DetectedPackageManager.make({
  name: "pnpm",
  version: O.some("10.33.0"),
  runtime: "node",
  evidence: "pnpm-workspace.yaml",
});

describe("PackageManagerDetector.makeTest, the house double whose detect has no honest default (unlike LocalExec's real Option.none()), so it dies unstubbed", () => {
  it.effect("uses a supplied `detect` override", () =>
    Effect.gen(function* () {
      const double = PackageManagerDetector.makeTest({ detect: () => Effect.succeed(pnpm) });
      const detected = yield* double.detect("/repo");
      assert.strictEqual(detected.name, "pnpm");
      assert.deepStrictEqual(detected.version, O.some("10.33.0"));
    })
  );

  it.effect("an override may fail typed, exactly as the live service does", () =>
    Effect.gen(function* () {
      const double = PackageManagerDetector.makeTest({
        detect: (root: string) =>
          Effect.fail(PackageManagerDetectionError.make({ root, checked: ["pnpm-workspace.yaml"] })),
      });
      const error = yield* Effect.flip(double.detect("/repo"));
      assert.instanceOf(error, PackageManagerDetectionError);
      assert.strictEqual(error.root, "/repo");
    })
  );

  it.effect("an UNSTUBBED `detect` dies rather than fabricating a manager", () =>
    Effect.gen(function* () {
      const double = PackageManagerDetector.makeTest();
      const exit = yield* Effect.exit(double.detect("/repo"));

      // Assert helpers are not type predicates, so narrow with a real `if`.
      if (!Exit.isFailure(exit)) {
        assert.fail("expected the unstubbed member to die");
      }
      assert.isTrue(Cause.hasDies(exit.cause));
      assert.isFalse(
        Cause.hasFails(exit.cause),
        "a typed PackageManagerDetectionError would read as a legitimate no-manager answer and teach that the double reports absence"
      );
    })
  );

  it.effect("the defect names the member, so the wiring mistake is obvious", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(PackageManagerDetector.makeTest().detect("/repo"));
      if (!Exit.isFailure(exit)) {
        assert.fail("expected the unstubbed member to die");
      }
      const die = O.getOrUndefined(A.findFirst(exit.cause.reasons, Cause.isDieReason));
      assert.instanceOf(die?.defect, Error);
      const message = die?.defect instanceof Error ? die.defect.message : "";
      assert.include(message, "PackageManagerDetector.makeTest");
      assert.include(message, "detect");
    })
  );
});

describe("PackageManagerDetector.layerTest", () => {
  it.layer(
    PackageManagerDetector.layerTest({
      detect: () =>
        Effect.succeed(
          DetectedPackageManager.make({
            name: "bun",
            version: O.none(),
            runtime: "bun",
            evidence: "bun.lock",
          })
        ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("provides the double as the service", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "bun");
        assert.strictEqual(detected.runtime, "bun");
      })
    );
  });

  it.layer(PackageManagerDetector.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect(
      "with no overrides, a consumer that calls detect still dies loudly: depending on detection through the double is a wiring mistake",
      () =>
        Effect.gen(function* () {
          const detector = yield* PackageManagerDetector;
          const exit = yield* Effect.exit(detector.detect("/repo"));
          if (!Exit.isFailure(exit)) {
            assert.fail("expected the unstubbed member to die");
          }
          assert.isTrue(Cause.hasDies(exit.cause));
        })
    );
  });
});
