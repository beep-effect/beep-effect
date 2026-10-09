// `ReleaseTag` is a pure value class, so these are plain `it()` tests — there is
// no Effect to run. The formats asserted here are NOT a fresh design: they
// reproduce, byte for byte, what silk-release-action actually cuts today. Git
// tag history is not an API, and pre-1.0 breaking-change freedom covers code,
// not a consumer's existing tag continuity. Changing any literal string in this
// file breaks tag naming for every consumer repo — do that deliberately or not
// at all.

import { assert, describe, it } from "@effect/vitest";
import * as SchemaIssue from "effect/SchemaIssue";
import { ReleaseTag } from "../../effected/workspaces/index.ts";

// beta.105 gives construction throws the generic message "Schema validation
// failed" and carries the structured issue in `cause`; formatting the cause is
// what keeps these assertions discriminating (a bare `assert.throws` also
// passes when the static does not exist at all).
const formatIssue = SchemaIssue.makeFormatterDefault();
const assertRefusesEmpty = (thunk: () => unknown): void => {
	let thrown: unknown;
	try {
		thunk();
	} catch (error) {
		thrown = error;
	}
	assert.instanceOf(thrown, Error);
	assert.match(formatIssue((thrown as Error).cause as SchemaIssue.Issue), /length of at least 1/);
};

describe("ReleaseTag.single", () => {
	it("is the bare version — no prefix", () => {
		const tag = ReleaseTag.single("1.0.0");
		assert.strictEqual(tag.value, "1.0.0");
		assert.strictEqual(tag.style, "single");
		assert.strictEqual(tag.version, "1.0.0");
	});

	it("carries no packageName — a single tag names the release, not a package", () => {
		const tag = ReleaseTag.single("1.0.0");
		// `optionalKey` means genuinely absent, not present-and-undefined.
		assert.isFalse("packageName" in tag);
		assert.isUndefined(tag.packageName);
	});

	it("honours an explicit versionPrefix", () => {
		assert.strictEqual(ReleaseTag.single("1.0.0", { versionPrefix: "v" }).value, "v1.0.0");
	});

	it("keeps `version` bare even when the tag string is prefixed", () => {
		// The prefix is presentation. A consumer diffing versions must not have to
		// strip it back off.
		const tag = ReleaseTag.single("1.0.0", { versionPrefix: "v" });
		assert.strictEqual(tag.version, "1.0.0");
		assert.strictEqual(tag.value, "v1.0.0");
	});
});

describe("ReleaseTag.scoped", () => {
	it("a scoped package name takes NO v prefix", () => {
		const tag = ReleaseTag.scoped("@scope/pkg", "1.0.0");
		assert.strictEqual(tag.value, "@scope/pkg@1.0.0");
		assert.strictEqual(tag.style, "scoped");
		assert.strictEqual(tag.packageName, "@scope/pkg");
		assert.strictEqual(tag.version, "1.0.0");
	});

	it("an UNSCOPED package name takes NO v prefix either — the default is uniform", () => {
		// Strict SemVer, deliberately (2026-07-25, Spencer's call): the default
		// is `""` for both scoped and unscoped names. This diverges from
		// silk-release-action's live `pkg@v1.0.0` on purpose — pre-1.0
		// breaking-change freedom covers our own tags, not a consumer's
		// existing history. A tool that needs the `v<semver>` convention
		// passes `versionPrefix: "v"` explicitly.
		const tag = ReleaseTag.scoped("pkg", "1.0.0");
		assert.strictEqual(tag.value, "pkg@1.0.0");
		assert.strictEqual(tag.version, "1.0.0");
	});

	it('explicit versionPrefix "v" adds the prefix for BOTH scoped and unscoped names', () => {
		assert.strictEqual(ReleaseTag.scoped("pkg", "1.0.0", { versionPrefix: "v" }).value, "pkg@v1.0.0");
		assert.strictEqual(ReleaseTag.scoped("@scope/pkg", "1.0.0", { versionPrefix: "v" }).value, "@scope/pkg@v1.0.0");
	});

	it('explicit versionPrefix "" is just the default, spelled out', () => {
		assert.strictEqual(ReleaseTag.scoped("pkg", "1.0.0", { versionPrefix: "" }).value, "pkg@1.0.0");
		assert.strictEqual(ReleaseTag.scoped("@scope/pkg", "1.0.0", { versionPrefix: "" }).value, "@scope/pkg@1.0.0");
	});

	it("only a LEADING @ makes a name scoped", () => {
		// A name containing `@` elsewhere is not scoped. `includes("@")` would be the
		// wrong test, and this pins it. Scoping no longer affects the default
		// prefix, but the packageName/version split still runs off the last `@`.
		assert.strictEqual(ReleaseTag.scoped("weird@name", "1.0.0").value, "weird@name@1.0.0");
	});
});

describe("ReleaseTag — formatting is total", () => {
	it("an empty version is refused at CONSTRUCTION, not through an error channel", () => {
		// v3 carried a `TagFormatError` whose only cause was an empty version.
		// `Schema.NonEmptyString` catches it in `make`, so formatting has no error
		// channel at all and every call site sheds an arm. A bad version here is
		// developer wiring, not untrusted input — a thrown defect is the right shape.
		// Matched on the message so the assertion discriminates: a bare
		// `assert.throws` also passes when the static does not exist at all, which
		// is exactly the vacuous green this file must not ship.
		assertRefusesEmpty(() => ReleaseTag.single(""));
		assertRefusesEmpty(() => ReleaseTag.scoped("pkg", ""));
	});

	it("an empty package name is refused too", () => {
		assertRefusesEmpty(() => ReleaseTag.scoped("", "1.0.0"));
	});
});
