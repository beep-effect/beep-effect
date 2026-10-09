import { assert, describe, it, layer } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { Git, LsTreeEntry } from "../../effected/git/Git.ts";

const cwd = "/repo";

// ── Git.makeTest: the shape value directly — no layer needed ────────────────

describe("Git.makeTest", () => {
	it.effect("an overridden method runs the stub", () =>
		Effect.gen(function* () {
			const double = Git.makeTest({
				revParse: () => Effect.succeed("a".repeat(40)),
			});
			assert.strictEqual(yield* double.revParse(cwd, "HEAD"), "a".repeat(40));
		}),
	);

	it.effect("an unstubbed method DIES with a defect naming the method", () =>
		Effect.gen(function* () {
			// No honest default exists for any of the twenty-six methods — a
			// fabricated answer would leak into consumer logic as fact — so the
			// default is a defect, not a typed failure a test could swallow.
			const double = Git.makeTest({ revParse: () => Effect.succeed("sha") });
			const exit = yield* Effect.exit(double.status(cwd));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.isFalse(exit.cause.reasons.some(Cause.isFailReason));
				assert.isTrue(Cause.hasDies(exit.cause));
				const die = exit.cause.reasons.find(Cause.isDieReason);
				assert.isDefined(die);
				const defect = die?.defect;
				assert.instanceOf(defect, Error);
				assert.strictEqual(
					(defect as Error).message,
					"Git.makeTest: status() was called but not stubbed — no honest default exists for a test double; pass a `status` override.",
				);
			}
		}),
	);

	it.effect("every method of an unstubbed double is present and dies — none is undefined", () =>
		Effect.gen(function* () {
			// The motivating boilerplate (issue #170): a hand-rolled double had to
			// stub all twenty-six methods to satisfy tsc. `makeTest()` with no
			// overrides must fill every slot with a callable that dies.
			const double = Git.makeTest();
			for (const method of Object.keys(double) as ReadonlyArray<keyof typeof double>) {
				const fn = double[method];
				assert.isFunction(fn);
				const effect: Effect.Effect<unknown, Effect.Error<ReturnType<typeof fn>>> = Reflect.apply(fn, undefined, []);
				const exit = yield* Effect.exit(effect);
				assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause), `${method} should die unstubbed`);
			}
		}),
	);
});

// ── Git.layerTest: the double behind Layer.succeed ──────────────────────────

// Bound to a const: layerTest is a parameterized layer factory and layers
// memoize by reference.
const TestGit = Git.layerTest({
	show: (_cwd: string, _ref: string, path: string) =>
		Effect.succeed(path === "package.json" ? Option.some("{}") : Option.none()),
	lsTree: () =>
		Effect.succeed([LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path: "package.json" })]),
});

describe("Git.layerTest", () => {
	layer(TestGit)((it) => {
		it.effect("provides the Git service with the stubbed methods answering", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const shown = yield* git.show(cwd, "HEAD", "package.json");
				assert.deepStrictEqual(shown, Option.some("{}"));
				const entries = yield* git.lsTree(cwd, "HEAD");
				assert.deepStrictEqual(
					entries.map((entry) => entry.path),
					["package.json"],
				);
			}),
		);

		it.effect("an unstubbed method still dies through the layer", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const exit = yield* Effect.exit(git.checkout(cwd, "main"));
				assert.isTrue(Exit.isFailure(exit));
				assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
			}),
		);
	});
});
