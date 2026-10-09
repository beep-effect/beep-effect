// @effect-diagnostics strictEffectProvide:skip-file
import * as F from "effect/Function";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Runtime from "effect/Runtime";
import type { FailureDetails } from "../../effected/cli/index.ts";
import { Cancelled, CliLogger, CliRuntime, NotInteractive } from "../../effected/cli/index.ts";

/** What a renderer that gives a defect the issue-report treatment prints, once it has checked the kit's flags. */
const renderer =
	(seen: Array<FailureDetails>) =>
	(error: unknown, details: FailureDetails): ReadonlyArray<string> => {
		seen.push(details);
		if (details.isCancelled || details.isNotInteractive) return details.defaultLines;
		return details.isDefect
			? [`error: ${String(error)}`, "Please report at https://example.test/issues"]
			: [String(error)];
	};

const run = Effect.fn("run")(function*<A, E> (program: Effect.Effect<A, E>) {
		const seen: Array<FailureDetails> = [];
		const err: string[] = [];
		const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
			log: () => undefined,
			error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
		});
		const exit = yield* program.pipe(
			CliRuntime.reportFailures({ render: renderer(seen) }),
			Effect.exit,
			Effect.provide(CliLogger.layer()),
			Effect.provideService(Console.Console, double),
		);
		return { seen, err, exit };
	});

const codeOf = <A>(exit: Exit.Exit<A, unknown>): number | undefined =>
	Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : undefined;

describe("FailureDetails.isCancelled / isNotInteractive", () => {
	it.effect("a cancel that arrives as a defect (a fallback prompt) is flagged, and isDefect keeps its meaning", () =>
		Effect.gen(function* () {
			const { seen, err, exit } = yield* F.pipe(Cancelled.make({ reason: "interrupt" }), Effect.die, run);
			assert.deepStrictEqual(
				seen.map((d) => [d.isDefect, d.isCancelled, d.isNotInteractive]),
				[[true, true, false]],
			);
			assert.isFalse(err.join("\n").includes("Please report"));
			assert.isTrue(err.length > 0, "the fixed Cancelled line was written");
			assert.strictEqual(codeOf(exit), 130, "the exit code is unchanged");
		}),
	);

	it.effect("a cancel that arrives as a typed failure (a screen) is flagged the same way", () =>
		Effect.gen(function* () {
			const { seen, err } = yield* F.pipe(Cancelled.make({ reason: "interrupt" }), Effect.fail, run);
			assert.deepStrictEqual(
				seen.map((d) => [d.isDefect, d.isCancelled, d.isNotInteractive]),
				[[false, true, false]],
			);
			assert.isFalse(err.join("\n").includes("Please report"));
		}),
	);

	it.effect("NotInteractive is flagged on its own, through either channel", () =>
		Effect.gen(function* () {
			const asDefect = yield* F.pipe(NotInteractive.make(), Effect.die, run);
			const asFailure = yield* F.pipe(NotInteractive.make(), Effect.fail, run);
			for (const { seen, err } of [asDefect, asFailure]) {
				assert.deepStrictEqual(
					seen.map((d) => [d.isCancelled, d.isNotInteractive]),
					[[false, true]],
				);
				assert.isFalse(err.join("\n").includes("Please report"));
			}
			assert.isTrue(asDefect.seen[0]?.isDefect);
			assert.isFalse(asFailure.seen[0]?.isDefect);
		}),
	);

	it.effect("control: a genuine defect still reports isDefect and neither flag, and gets the report", () =>
		Effect.gen(function* () {
			const { seen, err } = yield* run(Effect.die(new Error("bug")));
			assert.deepStrictEqual(
				seen.map((d) => [d.isDefect, d.isCancelled, d.isNotInteractive]),
				[[true, false, false]],
			);
			assert.deepStrictEqual(err, ["error: Error: bug", "Please report at https://example.test/issues"]);
		}),
	);

	it.effect("a typed failure beside a cancel defect is judged by the squashed error: the failure wins", () =>
		Effect.gen(function* () {
			const typed = new Error("typed");
			const { seen } = yield* Cause.combine(Cause.die(Cancelled.make({ reason: "interrupt" })), Cause.fail(typed)).pipe(Effect.failCause, run);
			assert.deepStrictEqual(
				seen.map((d) => [d.isDefect, d.isCancelled]),
				[[false, false]],
			);
		}),
	);
});
