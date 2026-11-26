import { ReleaseTag } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import * as SchemaIssue from "effect/SchemaIssue";

const formatIssue = SchemaIssue.makeFormatterDefault();
const assertRefusesEmpty = (thunk: () => unknown): void => {
  let thrown: unknown;
  try {
    thunk();
  } catch (error) {
    thrown = error;
  }
  assert.instanceOf(thrown, Error);
  if (!(thrown instanceof Error)) {
    assert.fail("expected an Error");
  }
  if (!SchemaIssue.isIssue(thrown.cause)) {
    assert.fail("expected a schema issue cause");
  }
  assert.match(
    formatIssue(thrown.cause),
    /length of at least 1/,
    "the thrown message is generic, so only the formatted cause tells a refusal from a missing static"
  );
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
    assert.isFalse("packageName" in tag, "optionalKey means genuinely absent, not present-and-undefined");
    assert.isUndefined(tag.packageName);
  });

  it("honours an explicit versionPrefix", () => {
    assert.strictEqual(ReleaseTag.single("1.0.0", { versionPrefix: "v" }).value, "v1.0.0");
  });

  it("keeps `version` bare even when the tag string is prefixed", () => {
    const tag = ReleaseTag.single("1.0.0", { versionPrefix: "v" });
    assert.strictEqual(
      tag.version,
      "1.0.0",
      "the prefix is presentation; a consumer diffing versions must not strip it"
    );
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

  // decision: release-tag-empty-default-prefix
  it("an UNSCOPED package name takes NO v prefix either — the default is uniform", () => {
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
    assert.strictEqual(
      ReleaseTag.scoped("weird@name", "1.0.0").value,
      "weird@name@1.0.0",
      'an inner @ does not scope (includes("@") would); the name/version split runs off the last @'
    );
  });
});

describe("ReleaseTag — formatting is total", () => {
  it("an empty version is refused at CONSTRUCTION as a wiring defect, not through an error channel", () => {
    assertRefusesEmpty(() => ReleaseTag.single(""));
    assertRefusesEmpty(() => ReleaseTag.scoped("pkg", ""));
  });

  it("an empty package name is refused too", () => {
    assertRefusesEmpty(() => ReleaseTag.scoped("", "1.0.0"));
  });
});
