import { classifyTag, ReleaseTag, TrackingTag } from "@beep/repo-workspaces";
import { UnrecognizedTagClassification } from "@beep/repo-workspaces/ReleaseTag";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Str from "effect/String";

describe("TrackingTag.forVersion", () => {
  it("derives the broadest-first pair for a stable release", () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3"), (tag) => tag.value),
      ["v1", "v1.2"]
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
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("0.5.2"), (tag) => tag.value),
      ["v0", "v0.5"],
      "derivation is mechanical; whether to float v0 across unstable minors is the consumer's call where tags move"
    );
  });

  it('`precision: "major"` derives only the broad alias', () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { precision: "major" }), (tag) => tag.value),
      ["v1"]
    );
  });

  it("prefixes with the package name when one is given", () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { packageName: "@scope/pkg" }), (tag) => tag.value),
      ["@scope/pkg@v1", "@scope/pkg@v1.2"]
    );
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { packageName: "pkg" }), (tag) => tag.value),
      ["pkg@v1", "pkg@v1.2"]
    );
  });
});

describe("TrackingTag.forVersion — the prerelease guard", () => {
  it("a PRERELEASE derives NO tracking tags", () => {
    assert.deepStrictEqual(
      TrackingTag.forVersion("1.0.0-beta.3"),
      [],
      "owner/repo@v1 asks for the newest STABLE 1.x; floating it onto a beta silently ships a prerelease"
    );
    assert.deepStrictEqual(TrackingTag.forVersion("2.0.0-rc.1"), []);
    assert.deepStrictEqual(TrackingTag.forVersion("1.0.0-0"), []);
  });

  it("BUILD METADATA is not a prerelease and still derives", () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3+sha.abc123"), (tag) => tag.value),
      ["v1", "v1.2"],
      "+build has no SemVer precedence, so this is stable 1.2.3; reading any - or + suffix as prerelease is wrong"
    );
  });

  it("a prerelease WITH build metadata still derives nothing", () => {
    assert.deepStrictEqual(TrackingTag.forVersion("1.0.0-beta.1+sha.abc"), []);
  });

  it("`includePrerelease` overrides the guard, for callers who mean it", () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.0.0-beta.3", { includePrerelease: true }), (tag) => tag.value),
      ["v1", "v1.0"],
      "aliases derive from the numeric core"
    );
  });
});

describe("TrackingTag.forVersion — non-derivable input", () => {
  it("an empty supplied package name derives nothing without throwing", () => {
    assert.deepStrictEqual(TrackingTag.forVersion("1.2.3", { packageName: "" }), []);
    assert.deepStrictEqual(TrackingTag.forVersion("1.2.3", { packageName: "", precision: "major" }), []);
    assert.deepStrictEqual(TrackingTag.forVersion("1.2.3-beta.1", { packageName: "", includePrerelease: true }), []);
  });

  it("omitted and valid package names still derive the requested aliases", () => {
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", {}), (tag) => tag.value),
      ["v1", "v1.2"]
    );
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { precision: "major" }), (tag) => tag.value),
      ["v1"]
    );
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { packageName: "pkg", precision: "major" }), (tag) => tag.value),
      ["pkg@v1"]
    );
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3", { packageName: "@scope/pkg" }), (tag) => tag.value),
      ["@scope/pkg@v1", "@scope/pkg@v1.2"]
    );
  });

  it("a version that is not X.Y.Z derives nothing, and does not throw", () => {
    assert.deepStrictEqual(
      TrackingTag.forVersion("1.2"),
      [],
      "derivation is a query, not a validation: junk yields an empty set, not an error channel"
    );
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

describe("TrackingTag.forVersion — numeric and suffix regressions", () => {
  it("oversized major and minor fields derive nothing without throwing", () => {
    for (const oversized of ["9007199254740992", Str.repeat(400)("9")]) {
      for (const version of [`${oversized}.2.3`, `1.${oversized}.3`]) {
        assert.deepStrictEqual(TrackingTag.forVersion(version), []);
        assert.deepStrictEqual(TrackingTag.forVersion(version, { precision: "major" }), []);
        assert.deepStrictEqual(TrackingTag.forVersion(`${version}-beta.1`, { includePrerelease: true }), []);
      }
    }
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("9007199254740991.9007199254740991.0"), (tag) => tag.value),
      ["v9007199254740991", "v9007199254740991.9007199254740991"]
    );
  });

  it("malformed suffixes derive nothing even when prereleases are included", () => {
    for (const version of [
      "1.2.3+",
      "1.2.3+bad/path",
      "1.2.3+build..id",
      "1.2.3+build+id",
      "1.2.3-",
      "1.2.3-01",
      "1.2.3-beta..1",
      "1.2.3-beta/1",
      "1.2.3-beta.01",
      "1.2.3\n",
      "1.2.3+build\n",
    ]) {
      assert.deepStrictEqual(TrackingTag.forVersion(version), [], version);
      assert.deepStrictEqual(TrackingTag.forVersion(version, { includePrerelease: true }), [], version);
    }
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3+build.01-alpha"), (tag) => tag.value),
      ["v1", "v1.2"]
    );
    assert.deepStrictEqual(
      A.map(TrackingTag.forVersion("1.2.3-01alpha.0+build.01", { includePrerelease: true }), (tag) => tag.value),
      ["v1", "v1.2"]
    );
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
    assert.strictEqual(result.tag.packageName, "@scope/pkg", "split at the LAST @, so the leading scope @ survives");
    assert.strictEqual(result.tag.version, "1.0.0");
  });

  it("an unscoped package release tag strips the v prefix from the version", () => {
    const result = classifyTag("pkg@v1.0.0");
    assert.strictEqual(result.kind, "release");
    if (result.kind !== "release") return;
    assert.strictEqual(result.tag.packageName, "pkg");
    assert.strictEqual(result.tag.version, "1.0.0", "version is bare; the v was presentation");
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
    assert.strictEqual(
      classifyTag("1").kind,
      "unrecognized",
      "1 is neither SemVer nor the tracking convention; accepting it would make the classifier guess"
    );
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

describe("classifyTag — numeric and suffix regressions", () => {
  it("oversized tracking fields are unrecognized without throwing", () => {
    for (const oversized of ["9007199254740992", Str.repeat(400)("9")]) {
      for (const tag of [`v${oversized}`, `v${oversized}.2`, `v1.${oversized}`]) {
        assert.deepStrictEqual(classifyTag(tag), UnrecognizedTagClassification.make({ kind: "unrecognized" }));
        assert.deepStrictEqual(
          classifyTag(`@scope/pkg@${tag}`),
          UnrecognizedTagClassification.make({ kind: "unrecognized" })
        );
      }
    }
    const result = classifyTag("v9007199254740991.9007199254740991");
    assert.strictEqual(result.kind, "tracking");
    if (result.kind !== "tracking") return assert.fail("expected a tracking tag at the integer boundary");
    assert.strictEqual(result.tag.major, 9007199254740991);
    assert.strictEqual(result.tag.minor, 9007199254740991);
  });

  it("malformed version suffixes are unrecognized in every release style", () => {
    for (const version of [
      "1.2.3+",
      "1.2.3+bad/path",
      "1.2.3+build..id",
      "1.2.3+build+id",
      "1.2.3-",
      "1.2.3-01",
      "1.2.3-beta..1",
      "1.2.3-beta/1",
      "1.2.3-beta.01",
      "1.2.3\n",
      "1.2.3+build\n",
    ]) {
      for (const tag of [version, `v${version}`, `pkg@${version}`, `@scope/pkg@v${version}`]) {
        assert.deepStrictEqual(classifyTag(tag), UnrecognizedTagClassification.make({ kind: "unrecognized" }), tag);
      }
    }
    for (const version of ["1.2.3+build.01-alpha", "1.2.3-01alpha.0+build.01"]) {
      const result = classifyTag(`@scope/pkg@v${version}`);
      assert.strictEqual(result.kind, "release");
      if (result.kind !== "release") return assert.fail("expected a valid release suffix");
      assert.strictEqual(result.tag.version, version);
      assert.strictEqual(result.tag.packageName, "@scope/pkg");
    }
  });
});

describe("classifyTag — round-trips against the producers", () => {
  it("every ReleaseTag this package formats classifies as a release", () => {
    const tags = [
      ReleaseTag.single("1.2.3"),
      ReleaseTag.single("1.2.3", { versionPrefix: "v" }),
      ReleaseTag.scoped("@scope/pkg", "1.2.3"),
      ReleaseTag.scoped("pkg", "1.2.3"),
      ReleaseTag.scoped("pkg", "1.0.0-beta.3"),
    ];
    for (const tag of tags) {
      const result = classifyTag(tag.value);
      assert.strictEqual(
        result.kind,
        "release",
        `${tag.value} should classify as a release; a formatted shape it cannot read back makes it a parallel guess`
      );
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
    const release = ReleaseTag.single("1.2.3");
    const tracking = TrackingTag.forVersion("1.2.3");
    const values = HashSet.fromIterable([release.value, ...A.map(tracking, (tag) => tag.value)]);
    assert.strictEqual(
      HashSet.size(values),
      3,
      "1.2.3, v1 and v1.2 stay distinct, so re-pointing a tracking tag cannot clobber a release tag"
    );
  });
});
