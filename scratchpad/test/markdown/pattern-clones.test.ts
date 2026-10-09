import { assert, describe, it } from "@effect/vitest";
import { globalOf, stickyOf } from "../../effected/markdown/internal/patterns.ts";

describe("pattern clones", () => {
	it("gives each sticky operation its own identity and lastIndex", () => {
		const pattern = /^foo/g;
		pattern.lastIndex = 7;
		const first = stickyOf(pattern);
		first.lastIndex = 2;
		const second = stickyOf(pattern);

		assert.notStrictEqual(first, pattern);
		assert.notStrictEqual(second, pattern);
		assert.notStrictEqual(first, second);
		assert.strictEqual(second.lastIndex, 0);
		assert.strictEqual(first.exec("xxfoo")?.[0], "foo");
		assert.strictEqual(first.lastIndex, 5);
		assert.strictEqual(second.lastIndex, 0);
		second.lastIndex = 1;
		assert.isNull(second.exec("xxfoo"));
		assert.strictEqual(second.lastIndex, 0);
		assert.strictEqual(first.lastIndex, 5);
		assert.strictEqual(pattern.lastIndex, 7);
	});

	it("gives each global operation its own identity and lastIndex", () => {
		const pattern = /foo/y;
		pattern.lastIndex = 7;
		const first = globalOf(pattern);
		first.lastIndex = 1;
		const second = globalOf(pattern);

		assert.notStrictEqual(first, pattern);
		assert.notStrictEqual(second, pattern);
		assert.notStrictEqual(first, second);
		assert.strictEqual(second.lastIndex, 0);
		assert.strictEqual(first.exec("xxfoo")?.index, 2);
		assert.strictEqual(first.lastIndex, 5);
		assert.strictEqual(second.lastIndex, 0);
		second.lastIndex = 5;
		assert.isNull(second.exec("xxfoo"));
		assert.strictEqual(second.lastIndex, 0);
		assert.strictEqual(first.lastIndex, 5);
		assert.strictEqual(pattern.lastIndex, 7);
	});

	it("removes only the leading caret and replaces matching flags for sticky clones", () => {
		const pattern = /^foo^bar/gimsuy;
		const sticky = stickyOf(pattern);

		assert.strictEqual(sticky.source, "foo^bar");
		assert.strictEqual(sticky.flags, "imsuy");
		assert.strictEqual(pattern.source, "^foo^bar");
		assert.strictEqual(pattern.flags, "gimsuy");
		assert.strictEqual(stickyOf(/foo/).source, "foo");
	});

	it("preserves the leading caret and replaces matching flags for global clones", () => {
		const pattern = /^foo/gimsuy;
		const global = globalOf(pattern);

		assert.strictEqual(global.source, "^foo");
		assert.strictEqual(global.flags, "gimsu");
		assert.strictEqual(pattern.source, "^foo");
		assert.strictEqual(pattern.flags, "gimsuy");
		global.lastIndex = 2;
		assert.isNull(global.exec("xxfoo"));
		assert.strictEqual(global.exec("FOO")?.[0], "FOO");
	});

	it("keeps sticky, global and equal-source pattern owners independent", () => {
		const pattern = /foo/;
		const otherPattern = /foo/;
		const sticky = stickyOf(pattern);
		const global = globalOf(pattern);
		const otherSticky = stickyOf(otherPattern);
		const otherGlobal = globalOf(otherPattern);

		assert.notStrictEqual(sticky, global);
		assert.notStrictEqual(sticky, otherSticky);
		assert.notStrictEqual(global, otherGlobal);
		sticky.lastIndex = 2;
		assert.strictEqual(global.lastIndex, 0);
		assert.strictEqual(otherSticky.lastIndex, 0);
		assert.strictEqual(otherGlobal.lastIndex, 0);
		global.lastIndex = 3;
		assert.strictEqual(sticky.lastIndex, 2);
		assert.strictEqual(otherSticky.lastIndex, 0);
		assert.strictEqual(otherGlobal.lastIndex, 0);
		assert.strictEqual(pattern.lastIndex, 0);
		assert.strictEqual(otherPattern.lastIndex, 0);
	});
});
