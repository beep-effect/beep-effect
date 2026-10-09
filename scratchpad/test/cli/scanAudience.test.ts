import { assert, describe, it } from "@effect/vitest";
import { scanAudience, tallyAudience } from "../../effected/cli/internal/scanAudience.ts";

const scan = (...argv: ReadonlyArray<string>) => scanAudience(argv);

describe("scanAudience mirrors how core parses the four flags", () => {
	const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>, ReadonlyArray<string>, boolean]> = [
		["no flag", ["init"], [], false],
		["--agent", ["--agent", "init"], ["agent"], false],
		["--human", ["--human", "init"], ["human"], false],
		["--ci", ["--ci", "init"], ["ci"], false],
		["a flag after the subcommand", ["init", "--agent"], ["agent"], false],
		["a flag after an operand", ["init", "x", "--ci"], ["ci"], false],
		["--audience v", ["--audience", "ci", "init"], ["ci"], false],
		["--audience=v", ["--audience=agent", "init"], ["agent"], false],
		["=true", ["--agent=true", "init"], ["agent"], false],
		["=yes and the other true spellings", ["--agent=yes", "--agent=on"], ["agent", "agent"], true],
		["=1", ["--ci=1", "init"], ["ci"], false],
		["=false is not given", ["--agent=false", "init"], [], false],
		["=no, =off, =0 and =n are not given", ["--agent=no", "--agent=off", "--ci=0", "--human=n"], [], false],
		["--no-agent is not given", ["--no-agent", "init"], [], false],
		["a following true is the flag's value", ["--agent", "true", "init"], ["agent"], false],
		["a following false is the flag's value and means not given", ["--agent", "false", "init"], [], false],
		["--agent then --no-agent counts one true occurrence", ["--agent", "--no-agent", "init"], ["agent"], false],
		["--agent=false --ci counts one", ["--agent=false", "--ci", "init"], ["ci"], false],
		["repeats conflict, even when they agree", ["--agent", "--agent", "init"], ["agent", "agent"], true],
		["two different flags conflict", ["--agent", "--ci", "init"], ["agent", "ci"], true],
		["--audience and a shorthand conflict", ["--agent", "--audience", "agent"], ["agent", "agent"], true],
		["stops at --", ["init", "--", "--agent"], [], false],
		["stops at -- after a flag", ["--ci", "--", "--agent", "--audience", "agent"], ["ci"], false],
		["a bad --audience value is core's parse error, not counted", ["--audience", "bogus", "init"], [], false],
		["--audience as the last token has no value", ["init", "--audience"], [], false],
		["--audience followed by a flag has no value", ["--audience", "--agent", "init"], ["agent"], false],
		["an invalid boolean spelling is core's parse error, not counted", ["--agent=TRUE", "init"], [], false],
		["flags are case-sensitive", ["--AGENT", "--Ci", "init"], [], false],
		["an unrelated flag is ignored", ["--profile", "x", "--log-level", "debug", "init"], [], false],
	];
	for (const [label, argv, given, conflict] of cases) {
		it(label, () => {
			assert.deepStrictEqual(scan(...argv), { given, conflict });
		});
	}

	it("an empty argv names nothing", () => {
		assert.deepStrictEqual(scan(), { given: [], conflict: false });
	});
});

describe("tallyAudience is the one counting rule", () => {
	it("counts audience entries and true booleans only", () => {
		assert.deepStrictEqual(tallyAudience({ audience: ["ci"], human: [false], agent: [], ci: [false, false] }), {
			given: ["ci"],
			conflict: false,
		});
		assert.deepStrictEqual(tallyAudience({ audience: [], human: [true], agent: [true], ci: [] }), {
			given: ["human", "agent"],
			conflict: true,
		});
	});
});
