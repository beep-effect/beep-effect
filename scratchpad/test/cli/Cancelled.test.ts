import { assert, describe, it } from "@effect/vitest";
import { Cause, Console, Effect, Equal, Exit, Layer, Runtime, Schema } from "effect";
import { Cancelled, CliRuntime, NotInteractive } from "../../effected/cli/index.ts";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const run = <E>(failure: E, render?: (error: unknown) => string) =>
	Effect.gen(function* () {
		const { double, out, err } = capturing();
		const exit = yield* CliRuntime.main(Effect.fail(failure), { platform: Layer.empty, render }).pipe(
			Effect.exit,
			Effect.provideService(Console.Console, double),
		);
		const code = Exit.isFailure(exit) ? Runtime.getErrorExitCode(Cause.squash(exit.cause)) : undefined;
		const reported = Exit.isFailure(exit) ? Runtime.getErrorReported(Cause.squash(exit.cause)) : undefined;
		return { code, reported, out, err };
	});

describe("Cancelled", () => {
	for (const reason of ["escape", "interrupt"] as const) {
		it.effect(`${reason}: exits 130 with one plain stderr line`, () =>
			Effect.gen(function* () {
				const { code, reported, out, err } = yield* run(new Cancelled({ reason }));
				assert.strictEqual(code, 130);
				assert.strictEqual(reported, false, "the runtime must not report it a second time");
				assert.deepStrictEqual(err, ["cancelled; nothing written"]);
				assert.deepStrictEqual(out, []);
			}),
		);
	}

	it.effect("a consumer render overrides the default line but keeps the exit code", () =>
		Effect.gen(function* () {
			const { code, err } = yield* run(new Cancelled({ reason: "escape" }), () => "custom");
			assert.strictEqual(code, 130);
			assert.deepStrictEqual(err, ["custom"]);
		}),
	);

	it("the exit-code marker is not an own enumerable property: a JSON dump or logger dump does not carry it", () => {
		const cancelled = new Cancelled({ reason: "escape" });
		assert.notInclude(JSON.stringify(cancelled), "errorExitCode");
		assert.notInclude(Object.keys(cancelled).join(","), "errorExitCode");
		// But core still finds it: `in` sees a prototype getter, and the code is read through it.
		assert.isTrue(Runtime.errorExitCode in cancelled);
		assert.strictEqual(Runtime.getErrorExitCode(cancelled), 130);
	});

	it("a decoded instance keeps its exit code, and two equal ones are equal", () => {
		const decoded = Schema.decodeUnknownSync(Cancelled)({ _tag: "Cancelled", reason: "interrupt" });
		assert.strictEqual(Runtime.getErrorExitCode(decoded), 130);
		assert.isTrue(Equal.equals(new Cancelled({ reason: "escape" }), new Cancelled({ reason: "escape" })));
		assert.isFalse(Equal.equals(new Cancelled({ reason: "escape" }), new Cancelled({ reason: "interrupt" })));
	});

	it("stays a tagged-error schema: the marker does not leak into encode, equality or the tag", () => {
		const a = new Cancelled({ reason: "escape" });
		assert.strictEqual(a._tag, "Cancelled");
		assert.strictEqual(a.reason, "escape");
		assert.deepStrictEqual(Schema.encodeSync(Cancelled)(a), { _tag: "Cancelled", reason: "escape" });
		assert.isTrue(a instanceof Error);
		assert.strictEqual(Runtime.getErrorExitCode(a), 130);
		assert.throws(() => Schema.decodeUnknownSync(Cancelled)({ _tag: "Cancelled", reason: "nope" }));
	});
});

describe("a library that rewrites error.message cannot make these errors throw", () => {
	// ES modules are strict, so assigning to a property that has only a getter throws a TypeError.
	it("assigning to message is a no-op, for both errors, and the line stays", () => {
		for (const error of [new Cancelled({ reason: "escape" }), new NotInteractive()]) {
			const line = error.message;
			assert.doesNotThrow(() => {
				error.message = "rewritten by a library";
			});
			assert.strictEqual(error.message, line);
			assert.strictEqual(String(error).includes("rewritten"), false);
		}
	});

	it("a wrapper that sets message on a copy of the error keeps working", () => {
		const wrapped = Object.assign(Object.create(new Cancelled({ reason: "interrupt" })), { message: "x" }) as Cancelled;
		assert.strictEqual(wrapped.message, "cancelled; nothing written");
	});
});

describe("the fixed lines are the errors' own message", () => {
	const CANCELLED = "cancelled; nothing written";
	const NOT_INTERACTIVE = "not interactive: run in a terminal or pass the flag";

	it("Cancelled.message is its line, for either reason, and String(error) carries it", () => {
		for (const reason of ["escape", "interrupt"] as const) {
			const error = new Cancelled({ reason });
			assert.strictEqual(error.message, CANCELLED);
			assert.include(String(error), CANCELLED);
		}
	});

	it("NotInteractive.message is its line, and String(error) carries it", () => {
		const error = new NotInteractive();
		assert.strictEqual(error.message, NOT_INTERACTIVE);
		assert.include(String(error), NOT_INTERACTIVE);
	});

	it("a decoded instance has the message too, and it is not part of the encoded form or equality", () => {
		const decoded = Schema.decodeUnknownSync(Cancelled)({ _tag: "Cancelled", reason: "escape" });
		assert.strictEqual(decoded.message, CANCELLED);
		assert.deepStrictEqual(Schema.encodeSync(Cancelled)(decoded), { _tag: "Cancelled", reason: "escape" });
		assert.notInclude(JSON.stringify(decoded), CANCELLED);
		assert.isTrue(Equal.equals(decoded, new Cancelled({ reason: "escape" })));
		assert.notInclude(Object.keys(new NotInteractive()).join(","), "message");
	});

	it.effect("a consumer render that prints error.message gets the kit's line, for these errors and its own", () =>
		Effect.gen(function* () {
			const render = (error: unknown): string => (error instanceof Error ? error.message : String(error));
			assert.deepStrictEqual((yield* run(new Cancelled({ reason: "escape" }), render)).err, [CANCELLED]);
			assert.deepStrictEqual((yield* run(new NotInteractive(), render)).err, [NOT_INTERACTIVE]);
			assert.deepStrictEqual((yield* run(new Error("mine"), render)).err, ["mine"]);
		}),
	);
});

describe("NotInteractive", () => {
	it.effect("exits 64 with its one line", () =>
		Effect.gen(function* () {
			const { code, reported, out, err } = yield* run(new NotInteractive());
			assert.strictEqual(code, 64);
			assert.strictEqual(reported, false);
			assert.deepStrictEqual(err, ["not interactive: run in a terminal or pass the flag"]);
			assert.deepStrictEqual(out, []);
		}),
	);

	it("its exit-code marker is not an own enumerable property either", () => {
		const error = new NotInteractive();
		assert.notInclude(JSON.stringify(error), "errorExitCode");
		assert.isTrue(Runtime.errorExitCode in error);
		assert.strictEqual(Runtime.getErrorExitCode(error), 64);
	});

	it("is a tagged error with no fields", () => {
		const e = new NotInteractive();
		assert.strictEqual(e._tag, "NotInteractive");
		assert.deepStrictEqual(Schema.encodeSync(NotInteractive)(e), { _tag: "NotInteractive" });
	});
});

describe("CliRuntime.defaultRender", () => {
	const details = { cause: Cause.empty, isDefect: false };

	it("is the kit's own line for the two prompt failures, and a status line for anything else", () => {
		assert.deepStrictEqual(CliRuntime.defaultRender(new Cancelled({ reason: "escape" }), details), [
			"cancelled; nothing written",
		]);
		assert.deepStrictEqual(CliRuntime.defaultRender(new NotInteractive(), details), [
			"not interactive: run in a terminal or pass the flag",
		]);
		assert.deepStrictEqual(CliRuntime.defaultRender(new Error("boom"), details), ["[FAIL] Error: boom"]);
		assert.deepStrictEqual(CliRuntime.defaultRender("plain", details), ["[FAIL] plain"]);
	});

	it.effect("a consumer render can hand the two prompt failures back and keep its own line for the rest", () =>
		Effect.gen(function* () {
			const render = (error: unknown, d: { readonly cause: Cause.Cause<unknown>; readonly isDefect: boolean }) =>
				error instanceof Cancelled || error instanceof NotInteractive
					? CliRuntime.defaultRender(error, d)
					: `tool: ${String(error)}`;
			const run2 = <E>(failure: E) =>
				Effect.gen(function* () {
					const { double, err } = capturing();
					yield* CliRuntime.main(Effect.fail(failure), { platform: Layer.empty, render }).pipe(
						Effect.exit,
						Effect.provideService(Console.Console, double),
					);
					return err;
				});
			assert.deepStrictEqual(yield* run2(new Cancelled({ reason: "interrupt" })), ["cancelled; nothing written"]);
			assert.deepStrictEqual(yield* run2(new NotInteractive()), [
				"not interactive: run in a terminal or pass the flag",
			]);
			assert.deepStrictEqual(yield* run2("other"), ["tool: other"]);
		}),
	);
});
