import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ConfigIssueRenderer } from "../../effected/cli/ConfigIssueRenderer.ts";
import { SchemaIssueRenderer } from "../../effected/cli/SchemaIssueRenderer.ts";

/** Decode strictly and hand back the raw issue tree. */
const issueFrom = <A, I>(schema: S.Codec<A, I>, input: unknown): unknown => {
	const result = Effect.runSync(
		S.decodeUnknownEffect(schema)(input, { onExcessProperty: "error", errors: "all" }).pipe(Effect.result),
	);
	if (Result.isSuccess(result)) throw new Error("expected the decode to fail");
	return result.failure.issue;
};

const Config = S.Struct({
	owner: S.optional(S.String),
	groups: S.Record(S.String, S.Struct({ repos: S.Array(S.String) })),
});

/** The shape a config group has: exactly one of three keys. */
const Group = S.Union([
	S.Struct({ file: S.Record(S.String, S.String) }),
	S.Struct({ value: S.Record(S.String, S.String) }),
	S.Struct({ resolved: S.Record(S.String, S.String) }),
]);

describe("SchemaIssueRenderer", () => {
	it("names an unknown key with its path, in the user's words", () => {
		const lines = SchemaIssueRenderer.render(issueFrom(Config, { owner: "acme", ownr: "typo", groups: {} }));

		// Core's own phrasing is "Expected no excess property", which describes the
		// schema's rule rather than the mistake.
		assert.include(lines, "unknown key at ownr");
		assert.notInclude(lines.join("\n"), "excess property");
	});

	it("reports a nested path, not just the top level", () => {
		const lines = SchemaIssueRenderer.render(issueFrom(Config, { groups: { g: { repos: ["r"], extra: 1 } } }));

		assert.include(lines, "unknown key at groups.g.extra");
	});

	it("keeps core's phrasing for every other leaf", () => {
		const lines = SchemaIssueRenderer.render(issueFrom(Config, { groups: { g: { repos: "not-an-array" } } }));

		assert.strictEqual(
			lines.some((line) => line.includes("groups.g.repos")),
			true,
		);
		assert.strictEqual(
			lines.every((line) => !line.startsWith("unknown key")),
			true,
		);
	});

	it("reports each allowed shape of a union once, and the wrong key once", () => {
		// The mistake a config author actually makes: the names inline, rather than
		// nested under one of the three kinds.
		const lines = SchemaIssueRenderer.render(issueFrom(Group, { KEEP_ME: "yes" }));

		assert.deepStrictEqual(lines, [
			"unknown key at KEEP_ME",
			"Missing key at file",
			"Missing key at value",
			"Missing key at resolved",
		]);
		// Undeduplicated, the union repeats the unknown-key line once per branch,
		// burying the three lines that say what was allowed.
		assert.lengthOf(
			lines.filter((line) => line.startsWith("unknown key")),
			1,
		);
	});

	it("yields no lines for anything that is not an issue tree", () => {
		// A renderer on an error path must never become the reason a program dies.
		for (const value of [undefined, null, "a string", 42, {}, new Error("nope")]) {
			assert.deepStrictEqual(SchemaIssueRenderer.render(value), []);
		}
	});
});

describe("ConfigIssueRenderer", () => {
	it("reads the issue off the error, so a caller does not have to", () => {
		// Shaped like the real error rather than constructed from the optional
		// peer, so this suite does not need it installed to run.
		const error = { _tag: "ConfigValidationError", issue: issueFrom(Config, { ownr: "typo", groups: {} }) };

		assert.include(ConfigIssueRenderer.render(error as never), "unknown key at ownr");
	});

	it("yields no lines for an error with no issue tree, or for nothing at all", () => {
		assert.deepStrictEqual(
			ConfigIssueRenderer.render({ _tag: "ConfigFileNotFoundError", searched: ["/a"] } as never),
			[],
		);
		assert.deepStrictEqual(ConfigIssueRenderer.render(undefined as never), []);
		assert.deepStrictEqual(ConfigIssueRenderer.render(null as never), []);
	});
});
