import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import type { CoreStatusName } from "../../effected/cli/index.ts";
import { Glyphs, Status, Token } from "../../effected/cli/index.ts";

describe("Status.core", () => {
	it("holds the six core statuses with their ranks", () => {
		const ranks = (["success", "skip", "pending", "info", "warning", "failure"] as const).map(
			(name) => Status.core.def(name).rank,
		);
		assert.deepStrictEqual(ranks, [10, 20, 30, 40, 60, 90]);
		assert.deepStrictEqual(Status.core.def("failure"), { glyph: "✗", ascii: "[FAIL]", token: "failure", rank: 90 });
		assert.strictEqual(Status.core.def("skip").token, "muted");
	});

	it("worst is the highest rank", () => {
		assert.strictEqual(Status.core.worst(["success", "skip", "failure"]), "failure");
		assert.strictEqual(Status.core.worst(["success"]), "success");
	});

	it("worstOption of a runtime array is an Option: Some of the worst, None when empty", () => {
		const results: Array<"success" | "skip" | "failure"> = ["success", "failure", "skip"];
		const worst: Option.Option<CoreStatusName> = Status.core.worstOption(results);
		assert.deepStrictEqual(worst, Option.some("failure"));
		const none: Option.Option<CoreStatusName> = Status.core.worstOption([] as Array<"success">);
		assert.deepStrictEqual(none, Option.none());
	});

	it("worst of a non-empty literal is the name itself, not an Option", () => {
		const worst: CoreStatusName = Status.core.worst(["skip", "failure"]);
		assert.strictEqual(worst, "failure");
	});

	it("worstOption breaks a rank tie in favour of the first name", () => {
		const v = Status.extend({
			a: { glyph: "a", ascii: "a", token: "info", rank: 50 },
			b: { glyph: "b", ascii: "b", token: "info", rank: 50 },
		});
		const names: Array<"a" | "b"> = ["b", "a"];
		assert.deepStrictEqual(v.worstOption(names), Option.some("b"));
	});

	it("worst breaks a rank tie in favour of the first name", () => {
		const v = Status.extend({
			a: { glyph: "a", ascii: "a", token: "info", rank: 50 },
			b: { glyph: "b", ascii: "b", token: "info", rank: 50 },
		});
		assert.strictEqual(v.worst(["a", "b"]), "a");
		assert.strictEqual(v.worst(["b", "a"]), "b");
	});
});

describe("Status.extend", () => {
	const vocab = Status.extend({ timeout: { glyph: "⧖", ascii: "[time]", token: Token.hex("#e09a4e"), rank: 85 } });

	it("ranks an extra status among the core ones", () => {
		assert.strictEqual(vocab.worst(["timeout", "warning"]), "timeout");
		assert.strictEqual(vocab.worst(["timeout", "failure"]), "failure");
	});

	it("keeps the core statuses and is available on an instance", () => {
		assert.strictEqual(vocab.def("failure").rank, 90);
		assert.strictEqual(vocab.def("timeout").ascii, "[time]");
		const more = vocab.extend({ flaky: { glyph: "~", ascii: "~", token: "warning", rank: 55 } });
		assert.strictEqual(more.worst(["flaky", "timeout"]), "timeout");
	});

	it("rejects a name the vocabulary does not have at compile time", () => {
		// @ts-expect-error "timeot" is not a status name
		assert.throws(() => assert.isUndefined(vocab.def("timeot").rank));
	});
});

describe("Status.resolve", () => {
	it("returns the full definition of a core name", () => {
		assert.deepStrictEqual(Status.core.resolve("failure"), { glyph: "✗", ascii: "[FAIL]", token: "failure", rank: 90 });
	});

	it("resolves an extended vocabulary's own names and still the core ones", () => {
		const v = Status.extend({ blocked: { glyph: "⛔", ascii: "[BLOCKED]", token: "error", rank: 80 } });
		assert.deepStrictEqual(v.resolve("blocked"), { glyph: "⛔", ascii: "[BLOCKED]", token: "error", rank: 80 });
		assert.deepStrictEqual(v.resolve("success"), Status.core.resolve("success"));
	});

	it("an entry that replaces a core name resolves to the replacement", () => {
		const v = Status.extend({ warning: { glyph: "!", ascii: "[!]", token: "warning", rank: 5 } });
		assert.strictEqual(v.resolve("warning").rank, 5);
	});

	it("is an immutable snapshot, so a stored definition cannot be edited", () => {
		const resolved = Status.core.resolve("info");
		assert.isTrue(Object.isFrozen(resolved));
		assert.notStrictEqual(resolved, Status.core.def("info"));
	});

	it("dies on a name the vocabulary does not have, naming it and the names that exist", () => {
		const unknown = "timeot" as CoreStatusName;
		assert.throws(() => Status.core.resolve(unknown), Error, /"timeot"/);
		assert.throws(() => Status.core.resolve(unknown), Error, /success, skip, pending, info, warning, failure/);
	});

	it("an inherited property name is not a status", () => {
		for (const name of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
			assert.throws(() => Status.core.resolve(name as CoreStatusName), Error, name);
		}
	});
});

describe("Status.def", () => {
	it("dies on a name the vocabulary does not have, as resolve does", () => {
		const unknown = "timeot" as CoreStatusName;
		assert.throws(() => Status.core.def(unknown), Error, /"timeot"/);
		assert.throws(() => Status.core.def(unknown), Error, /success, skip, pending, info, warning, failure/);
	});

	it("an inherited property name is not a status", () => {
		for (const name of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
			assert.throws(() => Status.core.def(name as CoreStatusName), Error, name);
		}
	});
});

describe("Status.glyph", () => {
	it("is the status's glyph from the given set", () => {
		assert.strictEqual(Status.core.glyph("failure", Glyphs.unicode), "✗");
		assert.strictEqual(Status.core.glyph("failure", Glyphs.ascii), "[FAIL]");
		const extended = Status.extend({ flaky: { glyph: "≈", ascii: "~", token: "warning", rank: 4 } });
		assert.strictEqual(extended.glyph("flaky", Glyphs.ascii), "~");
		assert.strictEqual(extended.glyph("flaky", Glyphs.unicode), "≈");
	});
});
