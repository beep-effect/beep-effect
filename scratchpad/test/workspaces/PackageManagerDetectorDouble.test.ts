// @effect-diagnostics strictEffectProvide:skip-file
// `PackageManagerDetector.makeTest` / `layerTest` — the sanctioned double.
//
// The house pattern, matching `WorkspaceRoot` and `WorkspaceDiscovery` in this
// package: `Partial<Shape>` overrides, and any member with no honest default
// DIES rather than fabricating one.
//
// `detect` has no honest default. A stand-in that answered "pnpm" would hand a
// consumer a fact nothing established, and the whole point of the live
// detector is that it REFUSES to guess — a double that guesses would contradict
// the service it stands in for. Contrast `@effected/commands`' `LocalExec`
// double, which legitimately defaults because `Option.none()` is a real answer:
// the test is "would a real implementation legitimately answer this?", not "is
// it convenient".

import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { DetectedPackageManager, PackageManagerDetectionError, PackageManagerDetector } from "../../effected/workspaces/index.ts";

const pnpm = DetectedPackageManager.make({
	name: "pnpm",
	version: Option.some("10.33.0"),
	runtime: "node",
	evidence: "pnpm-workspace.yaml",
});

describe("PackageManagerDetector.makeTest", () => {
	it.effect("uses a supplied `detect` override", () =>
		Effect.gen(function* () {
			const double = PackageManagerDetector.makeTest({ detect: () => Effect.succeed(pnpm) });
			const detected = yield* double.detect("/repo");
			assert.strictEqual(detected.name, "pnpm");
			assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
		}),
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
		}),
	);

	it.effect("an UNSTUBBED `detect` dies rather than fabricating a manager", () =>
		Effect.gen(function* () {
			const double = PackageManagerDetector.makeTest();
			const exit = yield* Effect.exit(double.detect("/repo"));

			// Assert helpers are not type predicates, so narrow with a real `if`.
			if (!Exit.isFailure(exit)) {
				assert.fail("expected the unstubbed member to die");
			}
			// A DEFECT, not a typed failure — the discriminating half. An
			// implementation that returned `PackageManagerDetectionError` instead
			// would look like a legitimate "no manager here" answer and pass a
			// weaker assertion, while quietly teaching consumers that the double
			// reports absence.
			assert.isTrue(Cause.hasDies(exit.cause));
			assert.isFalse(Cause.hasFails(exit.cause));
		}),
	);

	it.effect("the defect names the member, so the wiring mistake is obvious", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(PackageManagerDetector.makeTest().detect("/repo"));
			if (!Exit.isFailure(exit)) {
				assert.fail("expected the unstubbed member to die");
			}
			const die = exit.cause.reasons.find(Cause.isDieReason);
			assert.instanceOf(die?.defect, Error);
			const message = die?.defect instanceof Error ? die.defect.message : "";
			assert.include(message, "PackageManagerDetector.makeTest");
			assert.include(message, "detect");
		}),
	);
});

describe("PackageManagerDetector.layerTest", () => {
	it.effect("provides the double as the service", () =>
		Effect.gen(function* () {
			const detector = yield* PackageManagerDetector;
			const detected = yield* detector.detect("/repo");
			assert.strictEqual(detected.name, "bun");
			assert.strictEqual(detected.runtime, "bun");
		}).pipe(
			Effect.provide(
				PackageManagerDetector.layerTest({
					detect: () =>
						Effect.succeed(
							DetectedPackageManager.make({
								name: "bun",
								version: Option.none(),
								runtime: "bun",
								evidence: "bun.lock",
							}),
						),
				}),
			),
		),
	);

	it.effect("with no overrides, a consumer that calls detect still dies loudly", () =>
		// The point of the die: a test that wires the double and then depends on
		// detection is a wiring mistake, and it must fail rather than proceed on a
		// fabricated manager.
		Effect.gen(function* () {
			const detector = yield* PackageManagerDetector;
			const exit = yield* Effect.exit(detector.detect("/repo"));
			if (!Exit.isFailure(exit)) {
				assert.fail("expected the unstubbed member to die");
			}
			assert.isTrue(Cause.hasDies(exit.cause));
		}).pipe(Effect.provide(PackageManagerDetector.layerTest())),
	);
});
