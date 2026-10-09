import { assert, describe, it } from "@effect/vitest";
import { compareSemver, parseKonsoleVersion, parseVteVersion } from "../../effected/env/internal/osc8/semver.ts";

describe("compareSemver", () => {
	it("returns 0 when versions are equal", () => {
		assert.strictEqual(compareSemver("1.2.3", "1.2.3"), 0);
	});
	it("treats missing patch as 0", () => {
		assert.strictEqual(compareSemver("1.2", "1.2.0"), 0);
	});
	it("treats missing minor and patch as 0", () => {
		assert.strictEqual(compareSemver("3", "3.0.0"), 0);
	});
	it("returns negative when a < b", () => {
		assert.isBelow(compareSemver("1.2.3", "1.2.4"), 0);
		assert.isBelow(compareSemver("1.2.3", "1.3.0"), 0);
		assert.isBelow(compareSemver("1.2.3", "2.0.0"), 0);
	});
	it("returns positive when a > b", () => {
		assert.isAbove(compareSemver("2.0.0", "1.99.99"), 0);
		assert.isAbove(compareSemver("1.10.0", "1.9.0"), 0);
	});
	it("ignores prerelease tags", () => {
		assert.strictEqual(compareSemver("1.2.3-beta", "1.2.3"), 0);
		assert.strictEqual(compareSemver("1.2.3-rc.1", "1.2.3-rc.2"), 0);
	});
	it("returns 0 when either input is malformed", () => {
		assert.strictEqual(compareSemver("not-a-version", "1.0.0"), 0);
		assert.strictEqual(compareSemver("1.0.0", "garbage"), 0);
	});
});

describe("parseVteVersion", () => {
	it("decodes the packed integer (M*10000 + m*100 + p)", () => {
		assert.strictEqual(parseVteVersion("5202"), "0.52.2");
		assert.strictEqual(parseVteVersion("5000"), "0.50.0");
		assert.strictEqual(parseVteVersion("60100"), "6.1.0");
	});
	it("returns null for malformed input", () => {
		assert.strictEqual(parseVteVersion("not-a-number"), null);
		assert.strictEqual(parseVteVersion(""), null);
		assert.strictEqual(parseVteVersion(undefined), null);
	});
});

describe("parseKonsoleVersion", () => {
	it("decodes Konsole's packed integer (Y*10000 + M*100 + p)", () => {
		assert.strictEqual(parseKonsoleVersion("220400"), "22.4.0");
		assert.strictEqual(parseKonsoleVersion("220801"), "22.8.1");
		assert.strictEqual(parseKonsoleVersion("240200"), "24.2.0");
	});
	it("returns null for malformed input", () => {
		assert.strictEqual(parseKonsoleVersion("xyz"), null);
		assert.strictEqual(parseKonsoleVersion(undefined), null);
	});
});
