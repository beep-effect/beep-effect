// Tracking tags: the floating `v1` / `v1.2` alias family that a repo re-points
// at its newest matching release. This is the GitHub Actions distribution
// convention (`uses: owner/repo@v1`).
//
// They are deliberately NOT SemVer — a release tag is strict SemVer 2, a
// tracking tag is an alias with a `v` prefix and a truncated version — which is
// why they are their own concept rather than a third `TagStyle`. Everything
// here is pure derivation, formatting and parsing; actually MOVING a git tag is
// a consumer concern and lives nowhere in this package.

import { assert, describe, it } from "@effect/vitest";
import { ReleaseTag, TrackingTag, classifyTag } from "../../effected/workspaces/index.ts";

describe("TrackingTag.forVersion", () => {
	it("derives the broadest-first pair for a stable release", () => {
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.2.3").map((tag) => tag.value),
			["v1", "v1.2"],
		);
	});

	it("carries the numeric parts it was derived from", () => {
		const [major, minor] = TrackingTag.forVersion("1.2.3");
		assert.isDefined(major);
		assert.isDefined(minor);
		assert.strictEqual(major.major, 1);
		assert.isUndefined(major.minor);
		assert.strictEqual(minor.major, 1);
		assert.strictEqual(minor.minor, 2);
	});

	it("reports its precision", () => {
		const [major, minor] = TrackingTag.forVersion("1.2.3");
		assert.strictEqual(major?.precision, "major");
		assert.strictEqual(minor?.precision, "minor");
	});

	it("derives for a 0.x version too", () => {
		// 0.x is unstable and floating v0 across minors is a real hazard, but that
		// is the CONSUMER's policy call — the derivation is mechanical, and which
		// of these to actually publish is decided where the tags are moved.
		assert.deepStrictEqual(
			TrackingTag.forVersion("0.5.2").map((tag) => tag.value),
			["v0", "v0.5"],
		);
	});

	it('`precision: "major"` derives only the broad alias', () => {
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.2.3", { precision: "major" }).map((tag) => tag.value),
			["v1"],
		);
	});

	it("prefixes with the package name when one is given", () => {
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.2.3", { packageName: "@scope/pkg" }).map((tag) => tag.value),
			["@scope/pkg@v1", "@scope/pkg@v1.2"],
		);
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.2.3", { packageName: "pkg" }).map((tag) => tag.value),
			["pkg@v1", "pkg@v1.2"],
		);
	});
});

describe("TrackingTag.forVersion — the prerelease guard", () => {
	it("a PRERELEASE derives NO tracking tags", () => {
		// The load-bearing rule: you do not float `v1` onto a beta. Anyone
		// installing `owner/repo@v1` is asking for the newest STABLE 1.x, and
		// re-pointing it at 1.0.0-beta.3 ships a prerelease to every such consumer
		// silently.
		assert.deepStrictEqual(TrackingTag.forVersion("1.0.0-beta.3"), []);
		assert.deepStrictEqual(TrackingTag.forVersion("2.0.0-rc.1"), []);
		assert.deepStrictEqual(TrackingTag.forVersion("1.0.0-0"), []);
	});

	it("BUILD METADATA is not a prerelease and still derives", () => {
		// `+build` carries no precedence meaning in SemVer, so `1.2.3+sha.abc` is
		// the stable 1.2.3. Treating any `-`-or-`+` suffix as prerelease is the
		// obvious wrong implementation.
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.2.3+sha.abc123").map((tag) => tag.value),
			["v1", "v1.2"],
		);
	});

	it("a prerelease WITH build metadata still derives nothing", () => {
		assert.deepStrictEqual(TrackingTag.forVersion("1.0.0-beta.1+sha.abc"), []);
	});

	it("`includePrerelease` overrides the guard, for callers who mean it", () => {
		// Aliases derive from the numeric core, so a beta of 1.0.0 floats v1/v1.0.
		assert.deepStrictEqual(
			TrackingTag.forVersion("1.0.0-beta.3", { includePrerelease: true }).map((tag) => tag.value),
			["v1", "v1.0"],
		);
	});
});

describe("TrackingTag.forVersion — non-derivable input", () => {
	it("a version that is not X.Y.Z derives nothing, and does not throw", () => {
		// Total by construction: derivation is a query, not a validation, so junk
		// yields an empty set rather than an error channel nobody wants.
		assert.deepStrictEqual(TrackingTag.forVersion("1.2"), []);
		assert.deepStrictEqual(TrackingTag.forVersion("1"), []);
		assert.deepStrictEqual(TrackingTag.forVersion("not-a-version"), []);
		assert.deepStrictEqual(TrackingTag.forVersion(""), []);
		assert.deepStrictEqual(TrackingTag.forVersion("v1.2.3"), []);
	});

	it("non-numeric segments derive nothing", () => {
		assert.deepStrictEqual(TrackingTag.forVersion("1.x.0"), []);
		assert.deepStrictEqual(TrackingTag.forVersion("1.2.3.4"), []);
	});
});

describe("classifyTag — release vs tracking vs neither", () => {
	it("a bare semver string is a RELEASE tag", () => {
		const result = classifyTag("1.0.0");
		assert.strictEqual(result.kind, "release");
		if (result.kind !== "release") return;
		assert.strictEqual(result.tag.version, "1.0.0");
		assert.isUndefined(result.tag.packageName);
	});

	it("a scoped package release tag keeps its scope", () => {
		const result = classifyTag("@scope/pkg@1.0.0");
		assert.strictEqual(result.kind, "release");
		if (result.kind !== "release") return;
		// Split at the LAST `@`, so the leading scope `@` survives.
		assert.strictEqual(result.tag.packageName, "@scope/pkg");
		assert.strictEqual(result.tag.version, "1.0.0");
	});

	it("an unscoped package release tag strips the v prefix from the version", () => {
		const result = classifyTag("pkg@v1.0.0");
		assert.strictEqual(result.kind, "release");
		if (result.kind !== "release") return;
		assert.strictEqual(result.tag.packageName, "pkg");
		// `version` is the bare version; the `v` was presentation.
		assert.strictEqual(result.tag.version, "1.0.0");
	});

	it("a PRERELEASE is a valid release tag", () => {
		const result = classifyTag("1.0.0-beta.3");
		assert.strictEqual(result.kind, "release");
		if (result.kind !== "release") return;
		assert.strictEqual(result.tag.version, "1.0.0-beta.3");
	});

	it("`v1` is a TRACKING tag", () => {
		const result = classifyTag("v1");
		assert.strictEqual(result.kind, "tracking");
		if (result.kind !== "tracking") return;
		assert.strictEqual(result.tag.major, 1);
		assert.isUndefined(result.tag.minor);
		assert.strictEqual(result.tag.precision, "major");
	});

	it("`v1.2` is a TRACKING tag", () => {
		const result = classifyTag("v1.2");
		assert.strictEqual(result.kind, "tracking");
		if (result.kind !== "tracking") return;
		assert.strictEqual(result.tag.major, 1);
		assert.strictEqual(result.tag.minor, 2);
		assert.strictEqual(result.tag.precision, "minor");
	});

	it("a package-prefixed tracking tag keeps its package", () => {
		const result = classifyTag("@scope/pkg@v1");
		assert.strictEqual(result.kind, "tracking");
		if (result.kind !== "tracking") return;
		assert.strictEqual(result.tag.packageName, "@scope/pkg");
		assert.strictEqual(result.tag.major, 1);
	});

	it("the `v` is REQUIRED for a tracking tag — bare `1` is neither", () => {
		// `1` is not valid SemVer and not the tracking convention. Accepting it
		// would make `classifyTag` guess, and the whole point of the classifier is
		// that it does not.
		assert.strictEqual(classifyTag("1").kind, "unrecognized");
		assert.strictEqual(classifyTag("1.2").kind, "unrecognized");
	});

	it("junk is unrecognized rather than forced into a bucket", () => {
		assert.strictEqual(classifyTag("main").kind, "unrecognized");
		assert.strictEqual(classifyTag("").kind, "unrecognized");
		assert.strictEqual(classifyTag("@scope/pkg").kind, "unrecognized");
		assert.strictEqual(classifyTag("v").kind, "unrecognized");
		assert.strictEqual(classifyTag("vX").kind, "unrecognized");
	});
});

describe("classifyTag — round-trips against the producers", () => {
	it("every ReleaseTag this package formats classifies as a release", () => {
		// The two halves must agree. If `ReleaseTag` ever emits a shape
		// `classifyTag` cannot read back, this fails — which is the property that
		// makes the classifier trustworthy rather than a parallel guess.
		const tags = [
			ReleaseTag.single("1.2.3"),
			ReleaseTag.single("1.2.3", { versionPrefix: "v" }),
			ReleaseTag.scoped("@scope/pkg", "1.2.3"),
			ReleaseTag.scoped("pkg", "1.2.3"),
			ReleaseTag.scoped("pkg", "1.0.0-beta.3"),
		];
		for (const tag of tags) {
			const result = classifyTag(tag.value);
			assert.strictEqual(result.kind, "release", `${tag.value} should classify as a release`);
			if (result.kind !== "release") continue;
			assert.strictEqual(result.tag.version, tag.version, `${tag.value} version round-trip`);
			assert.strictEqual(result.tag.packageName, tag.packageName, `${tag.value} package round-trip`);
		}
	});

	it("every TrackingTag this package derives classifies as tracking", () => {
		const derived = [
			...TrackingTag.forVersion("1.2.3"),
			...TrackingTag.forVersion("1.2.3", { packageName: "@scope/pkg" }),
			...TrackingTag.forVersion("1.2.3", { packageName: "pkg" }),
		];
		assert.isAbove(derived.length, 0);
		for (const tag of derived) {
			const result = classifyTag(tag.value);
			assert.strictEqual(result.kind, "tracking", `${tag.value} should classify as tracking`);
			if (result.kind !== "tracking") continue;
			assert.strictEqual(result.tag.major, tag.major, `${tag.value} major round-trip`);
			assert.strictEqual(result.tag.minor, tag.minor, `${tag.value} minor round-trip`);
			assert.strictEqual(result.tag.packageName, tag.packageName, `${tag.value} package round-trip`);
		}
	});

	it("a release tag and its tracking tags never collide", () => {
		// `1.2.3` and `v1` / `v1.2` must stay distinguishable, or re-pointing a
		// tracking tag could clobber a release tag.
		const release = ReleaseTag.single("1.2.3");
		const tracking = TrackingTag.forVersion("1.2.3");
		const values = new Set([release.value, ...tracking.map((tag) => tag.value)]);
		assert.strictEqual(values.size, 3);
	});
});
