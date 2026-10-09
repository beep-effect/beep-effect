// @effect-diagnostics strictEffectProvide:skip-file
// scanAudience reads argv by hand, mirroring core's lexer. This differential test is what pins that mirror: it runs
// core's REAL parser over a set of edge argvs, reads the parsed audience flags back out, and requires the scan to
// agree. A change in core's lexer or boolean spellings fails here instead of silently drifting.
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { CliAudience } from "../../effected/cli/index.ts";
import type { AudienceFlagValues } from "../../effected/cli/internal/scanAudience.ts";
import { scanAudience, tallyAudience } from "../../effected/cli/internal/scanAudience.ts";

/** Parse `argv` with core and return the audience flags it saw, or `undefined` when core rejects the argv. */
const parsedBy = (argv: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		let seen: AudienceFlagValues | undefined;
		const sub = Command.make("init", { rest: Argument.String("rest").pipe(Argument.atLeast(0)) }, () => Effect.void);
		const root = Command.make("tool").pipe(
			Command.withSharedFlags(CliAudience.flags()),
			Command.withSubcommands([sub]),
			Command.provideEffectDiscard((input) =>
				Effect.sync(() => {
					seen = input;
				}),
			),
		);
		yield* Command.runWith(root, { version: "1" })(argv).pipe(
			Effect.catch(() => Effect.void),
			Effect.provideService(Console.Console, { ...console, log: () => undefined, error: () => undefined } as never),
		);
		return seen;
	}).pipe(Effect.provide(NodeServices.layer));

const accepted: ReadonlyArray<ReadonlyArray<string>> = [
	["init"],
	["--agent", "init"],
	["init", "--agent"],
	["init", "x", "--ci"],
	["--human", "init"],
	["--agent=true", "init"],
	["--agent=yes", "init"],
	["--agent=on", "init"],
	["--agent=1", "init"],
	["--agent=y", "init"],
	["--agent=false", "init"],
	["--agent=no", "init"],
	["--agent=off", "init"],
	["--agent=0", "init"],
	["--agent=n", "init"],
	["--no-agent", "init"],
	["--agent", "true", "init"],
	["--agent", "false", "init"],
	["--agent", "yes", "init"],
	["--agent", "--agent", "init"],
	["--agent", "--ci", "init"],
	["--agent", "--no-agent", "init"],
	["--agent=false", "--ci", "init"],
	["--audience", "ci", "init"],
	["--audience=agent", "init"],
	["--audience", "ci", "--audience", "ci", "init"],
	["--agent", "--audience", "agent", "init"],
	["init", "--", "--agent"],
	["--ci", "init", "--", "--agent", "--audience", "agent"],
];

const rejected: ReadonlyArray<readonly [ReadonlyArray<string>, ReadonlyArray<string>]> = [
	[["--audience", "bogus", "init"], []],
	[["--audience", "--agent", "init"], ["agent"]],
	[["init", "--audience"], []],
	[["--agent=TRUE", "init"], []],
	[["--profile", "x", "init"], []],
	[["--AGENT", "init"], []],
];

describe("scanAudience agrees with core's parser", () => {
	for (const argv of accepted) {
		it.effect(argv.join(" ") || "(no arguments)", () =>
			Effect.gen(function* () {
				const parsed = yield* parsedBy(argv);
				// Every argv in this list is one core parses, so a rejection here is itself a finding.
				assert.isDefined(parsed, `core rejected ${JSON.stringify(argv)}`);
				if (parsed === undefined) return;
				assert.deepStrictEqual(scanAudience(argv), tallyAudience(parsed), JSON.stringify(parsed));
			}),
		);
	}

	for (const [argv, counted] of rejected) {
		it.effect(`core rejects ${argv.join(" ")}; the scan counts only ${JSON.stringify(counted)}`, () =>
			Effect.gen(function* () {
				assert.isUndefined(yield* parsedBy(argv), "core should have refused this argv");
				assert.deepStrictEqual(scanAudience(argv).given, counted);
			}),
		);
	}
});
