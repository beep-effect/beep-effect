import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import { CliFailure } from "../../effected/cli/index.ts";
import { splitFrame } from "../../effected/cli/internal/splitFrame.ts";

/** The regular expression `splitFrame` replaced, kept here as the oracle for its exact behaviour. */
const legacy = (raw: string): ReturnType<typeof splitFrame> => {
	const text = raw.trim().replace(/^at\s+/, "");
	const wrapped = /^(.*?)\s+\((.*)\)$/.exec(text);
	const fn = wrapped?.[1];
	return {
		text,
		...(fn === undefined || fn === "" ? {} : { fn }),
		location: wrapped === null ? text : (wrapped[2] ?? ""),
	};
};

const upTo = (alphabet: ReadonlyArray<string>, length: number): ReadonlyArray<string> => {
	const out: Array<string> = [""];
	let frontier = [""];
	for (let n = 1; n <= length; n++) {
		frontier = frontier.flatMap((prefix) => alphabet.map((ch) => prefix + ch));
		for (const item of frontier) out.push(item);
	}
	return out;
};

describe("splitFrame", () => {
	it("splits V8's shapes at the first whitespace run before a parenthesis", () => {
		assert.deepStrictEqual(splitFrame("    at fn (/a/b.ts:1:2)"), {
			text: "fn (/a/b.ts:1:2)",
			fn: "fn",
			location: "/a/b.ts:1:2",
		});
		assert.deepStrictEqual(splitFrame("at /a/b.ts:1:2"), { text: "/a/b.ts:1:2", location: "/a/b.ts:1:2" });
		assert.deepStrictEqual(splitFrame("at eval (eval at <anonymous> (/a.js:1:2), <anonymous>:1:1)"), {
			text: "eval (eval at <anonymous> (/a.js:1:2), <anonymous>:1:1)",
			fn: "eval",
			location: "eval at <anonymous> (/a.js:1:2), <anonymous>:1:1",
		});
	});

	it("matches the regular expression it replaced on every string up to length 6 over the characters that matter", () => {
		const alphabet = ["a", " ", "\t", "(", ")", " ", "\n"];
		const differences: Array<string> = [];
		for (const raw of upTo(alphabet, 6)) {
			const got = splitFrame(raw);
			const want = legacy(raw);
			if (JSON.stringify(got) !== JSON.stringify(want) && differences.length < 5) {
				differences.push(`${JSON.stringify(raw)}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
			}
		}
		assert.deepStrictEqual(differences, []);
	});

	it("is linear: 100,000 tabs before an unclosed parenthesis returns at once, with the unsplit shape", () => {
		const raw = `at x${"\t".repeat(100_000)}(a`;
		const started = performance.now();
		const split = splitFrame(raw);
		const elapsed = performance.now() - started;
		assert.deepStrictEqual(split, { text: raw.slice(3), location: raw.slice(3) });
		assert.isBelow(elapsed, 500, `took ${elapsed} ms`);
	});

	it("is linear through CliFailure.toDoc too", () => {
		const error = new Error("m");
		error.stack = `Error: m\n    at x${"\t".repeat(100_000)}(a`;
		const started = performance.now();
		const doc = CliFailure.toDoc(Cause.die(error), { stackFrames: "all" });
		const elapsed = performance.now() - started;
		assert.isAbove(doc.length, 0);
		assert.isBelow(elapsed, 500, `took ${elapsed} ms`);
	});
});
