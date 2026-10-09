// The SAX-style visitor: events ride the same semantic walk as buildValue, so
// TableStart/ArrayTableStart/KeyValue land in document order; Comment events
// (standalone trivia + expression trailing comments) interleave by source
// offset. Offset semantics pinned here: a Comment's `offset` is the position
// of its `#` marker in the source text.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { TomlParseError } from "../../effected/toml/Toml.ts";
import { TomlVisitor, TomlVisitorEvent } from "../../effected/toml/TomlVisitor.ts";

const MIXED = [
	"# top-level comment",
	"",
	'title = "example"',
	"[owner]",
	'name = "Tom"   # trailing comment',
	"dob = 1979-05-27T07:32:00-08:00",
	"",
	"[servers.alpha]",
	'ip = "10.0.0.1"',
	"ports = [ 8000, 8001,",
	"          8002 ]",
	"",
	"[[products]]",
	'name = "Hammer"',
	"point = { x = 1, y = 2 }",
	"",
].join("\n");

/** Map each event to a small tuple for a readable `deepStrictEqual` pin. */
function tuple(event: TomlVisitorEvent): unknown {
	switch (event._tag) {
		case "TableStart":
			return ["TableStart", event.path];
		case "ArrayTableStart":
			return ["ArrayTableStart", event.path, event.index];
		case "KeyValue":
			return ["KeyValue", event.path];
		case "Comment":
			return ["Comment", event.text];
	}
}

describe("TomlVisitor", () => {
	describe("visit", () => {
		it.effect("emits the exact event sequence for a mixed document", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit(MIXED));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["Comment", "top-level comment"],
					["KeyValue", ["title"]],
					["TableStart", ["owner"]],
					["KeyValue", ["owner", "name"]],
					["Comment", "trailing comment"],
					["KeyValue", ["owner", "dob"]],
					["TableStart", ["servers", "alpha"]],
					["KeyValue", ["servers", "alpha", "ip"]],
					["KeyValue", ["servers", "alpha", "ports"]],
					["ArrayTableStart", ["products"], 0],
					["KeyValue", ["products", "name"]],
					["KeyValue", ["products", "point"]],
				]);
			}),
		);

		it.effect("fails the stream typed on a semantically invalid document", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Stream.runCollect(TomlVisitor.visit("a=1\na=2\n")));
				assert.instanceOf(error, TomlParseError);
				assert.strictEqual(error.diagnostics[0]?.code, "DuplicateKey");
			}),
		);

		it.effect("fails the stream typed on a syntactically invalid document", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Stream.runCollect(TomlVisitor.visit("a = [1\n")));
				assert.instanceOf(error, TomlParseError);
			}),
		);

		it.effect("an empty document yields just the root TableStart", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit(""));
				assert.deepStrictEqual(events.map(tuple), [["TableStart", []]]);
			}),
		);

		it.effect("standalone and trailing comments appear in document order", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit("# lead\na = 1 # trail\n"));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["Comment", "lead"],
					["KeyValue", ["a"]],
					["Comment", "trail"],
				]);
				const comments = events.filter(TomlVisitorEvent.$is("Comment"));
				assert.strictEqual(comments[0]?.offset, 0);
				assert.strictEqual(comments[1]?.offset, 13);
			}),
		);

		it.effect("pins ArrayTableStart indexes across repeated [[t]] headers", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit("[[t]]\na=1\n[[t]]\na=2\n"));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["ArrayTableStart", ["t"], 0],
					["KeyValue", ["t", "a"]],
					["ArrayTableStart", ["t"], 1],
					["KeyValue", ["t", "a"]],
				]);
			}),
		);

		it.effect("a standalone comment between two tables sorts between both TableStarts", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit("[a]\n# between\n[b]\n"));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["TableStart", ["a"]],
					["Comment", "between"],
					["TableStart", ["b"]],
				]);
				const comment = events.find(TomlVisitorEvent.$is("Comment"));
				assert.strictEqual(comment?.offset, 4);
			}),
		);

		it.effect("two standalone comment lines coalesced in one trivia run both emit, offsets pinned", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit("# c1\n# c2\n[a]\n"));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["Comment", "c1"],
					["Comment", "c2"],
					["TableStart", ["a"]],
				]);
				const comments = events.filter(TomlVisitorEvent.$is("Comment"));
				assert.strictEqual(comments[0]?.offset, 0);
				assert.strictEqual(comments[1]?.offset, 5);
			}),
		);

		it.effect("a trailing comment on a table header line orders after that TableStart", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(TomlVisitor.visit("[a] # side\nx = 1\n"));
				assert.deepStrictEqual(events.map(tuple), [
					["TableStart", []],
					["TableStart", ["a"]],
					["Comment", "side"],
					["KeyValue", ["a", "x"]],
				]);
				const comment = events.find(TomlVisitorEvent.$is("Comment"));
				assert.strictEqual(comment?.offset, 4);
			}),
		);

		it.effect("an adversarial nesting-depth bomb fails the stream typed, not as a defect", () =>
			Effect.gen(function* () {
				const bomb = `a = ${"[".repeat(10_000)}`;
				const error = yield* Effect.flip(Stream.runCollect(TomlVisitor.visit(bomb)));
				assert.instanceOf(error, TomlParseError);
				assert.strictEqual(error.diagnostics[0]?.code, "NestingDepthExceeded");
			}),
		);
	});
});
