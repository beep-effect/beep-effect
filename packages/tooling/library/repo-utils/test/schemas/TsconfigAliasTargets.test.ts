import {
  buildCanonicalAliasTargets,
  deriveWildcardAliasTargetFromExport,
  isFileStemWildcardExportTarget,
  RootAliasTarget,
  resolveRootExportTarget,
  resolveSubpathExportTarget,
  resolveWildcardExportTarget,
  WildcardAliasTarget,
} from "@beep/repo-utils/schemas/TsconfigAliasTargets";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as S from "effect/Schema";

const isRootAliasTarget = S.is(RootAliasTarget);
const isWildcardAliasTarget = S.is(WildcardAliasTarget);

describe("RootAliasTarget and WildcardAliasTarget", () => {
  it("accepts only ./-relative targets, split by whether a wildcard is present", () => {
    expect(isRootAliasTarget("./packages/example/src/index.ts")).toBe(true);
    expect(isRootAliasTarget("./packages/example/src/*")).toBe(false);
    expect(isRootAliasTarget("packages/example/src/index.ts")).toBe(false);
    expect(isRootAliasTarget("./")).toBe(false);

    expect(isWildcardAliasTarget("./packages/example/src/*")).toBe(true);
    expect(isWildcardAliasTarget("./packages/example/src/*/index.ts")).toBe(true);
    expect(isWildcardAliasTarget("./packages/example/src/index.ts")).toBe(false);
    expect(isWildcardAliasTarget("packages/example/src/*")).toBe(false);
  });
});

describe("resolveRootExportTarget", () => {
  it("resolves a bare string export and rejects non-relative or non-path values", () => {
    assertSome(resolveRootExportTarget("./src/index.ts"), "./src/index.ts");
    assertNone(resolveRootExportTarget("src/index.ts"));
    assertNone(resolveRootExportTarget(null));
    assertNone(resolveRootExportTarget(42));
    assertNone(resolveRootExportTarget({ ".": null }));
  });

  it("follows the repo condition priority, not object key order", () => {
    const target = resolveRootExportTarget({
      ".": { import: "./src/index.ts", types: "./dist/index.d.ts" },
    });
    assertSome(target, "./dist/index.d.ts");

    const nested = resolveRootExportTarget({
      ".": { node: { import: "./dist/node.mjs" }, default: "./dist/index.js" },
    });
    assertSome(nested, "./dist/index.js");
  });

  it("skips prioritized conditions whose values are not ./-relative", () => {
    const target = resolveRootExportTarget({
      ".": { types: "dist/index.d.ts", import: "./src/index.ts" },
    });
    assertSome(target, "./src/index.ts");
  });

  it("falls back to unknown conditions and to array alternatives", () => {
    assertSome(resolveRootExportTarget({ ".": { "custom-condition": "./src/custom.ts" } }), "./src/custom.ts");
    assertSome(
      resolveRootExportTarget({ ".": ["not-relative", { import: "./src/from-array.ts" }] }),
      "./src/from-array.ts"
    );
    assertSome(resolveRootExportTarget(["./src/top-level-array.ts"]), "./src/top-level-array.ts");
  });

  it("treats a top-level condition map as the root export (exports sugar form)", () => {
    const target = resolveRootExportTarget({ import: "./src/index.ts", types: "./dist/index.d.ts" });
    assertSome(target, "./dist/index.d.ts");
  });

  it("returns none when the export map only declares subpaths", () => {
    assertNone(resolveRootExportTarget({ "./testing": "./src/testing.ts", "./*": "./src/*.ts" }));
  });
});

describe("resolveSubpathExportTarget and resolveWildcardExportTarget", () => {
  const exportsField = {
    ".": "./src/index.ts",
    "./testing": { types: "./dist/testing.d.ts", import: "./src/testing.ts" },
    "./*": "./src/*.ts",
    "./internal/*": null,
  };

  it("resolves a named subpath in both data-first and data-last forms", () => {
    assertSome(resolveSubpathExportTarget(exportsField, "./testing"), "./dist/testing.d.ts");
    assertSome(resolveSubpathExportTarget("./testing")(exportsField), "./dist/testing.d.ts");
  });

  it("returns none for missing subpaths, blocked (null) subpaths and non-map exports", () => {
    assertNone(resolveSubpathExportTarget(exportsField, "./missing"));
    assertNone(resolveSubpathExportTarget(exportsField, "./internal/*"));
    assertNone(resolveSubpathExportTarget("./src/index.ts", "./testing"));
  });

  it("resolves the ./* wildcard entry only when the map declares one", () => {
    assertSome(resolveWildcardExportTarget(exportsField), "./src/*.ts");
    assertNone(resolveWildcardExportTarget({ ".": "./src/index.ts" }));
  });
});

describe("buildCanonicalAliasTargets", () => {
  it("anchors the wildcard at the directory containing the root export", () => {
    const targets = buildCanonicalAliasTargets("packages/example", "./src/index.ts");
    expect(targets.rootAliasTarget).toBe("./packages/example/src/index.ts");
    expect(targets.wildcardAliasTarget).toBe("./packages/example/src/*");
    expect(isRootAliasTarget(targets.rootAliasTarget)).toBe(true);
    expect(isWildcardAliasTarget(targets.wildcardAliasTarget)).toBe(true);
  });

  it("accepts a root export without the ./ prefix and supports data-last calls", () => {
    const targets = buildCanonicalAliasTargets("index.ts")("packages/flat");
    expect(targets.rootAliasTarget).toBe("./packages/flat/index.ts");
    expect(targets.wildcardAliasTarget).toBe("./packages/flat/*");
  });

  it("rejects a wildcard root export, since a root alias target must not contain *", () => {
    expect(() => buildCanonicalAliasTargets("packages/x", "./src/*.ts")).toThrow("Schema validation failed");
    expect(() => buildCanonicalAliasTargets("./src/*")("packages/x")).toThrow("Schema validation failed");
  });
});

describe("deriveWildcardAliasTargetFromExport and isFileStemWildcardExportTarget", () => {
  it("strips the extension only when the wildcard is a .ts or .tsx file stem", () => {
    expect(deriveWildcardAliasTargetFromExport("packages/example", "./src/*.ts")).toBe("./packages/example/src/*");
    expect(deriveWildcardAliasTargetFromExport("packages/example", "./src/components/*.tsx")).toBe(
      "./packages/example/src/components/*"
    );
    expect(deriveWildcardAliasTargetFromExport("./src/*.ts")("packages/curried")).toBe("./packages/curried/src/*");
  });

  it("passes directory-shaped and non-TypeScript wildcards through verbatim", () => {
    expect(deriveWildcardAliasTargetFromExport("packages/example", "./src/*/index.ts")).toBe(
      "./packages/example/src/*/index.ts"
    );
    expect(deriveWildcardAliasTargetFromExport("packages/example", "./src/*.js")).toBe("./packages/example/src/*.js");
  });

  it("classifies file-stem wildcards and rejects partial-segment or directory stars", () => {
    expect(isFileStemWildcardExportTarget("./src/SchemaUtils/*.ts")).toBe(true);
    expect(isFileStemWildcardExportTarget("./src/components/*.tsx")).toBe(true);
    expect(isFileStemWildcardExportTarget("*.ts")).toBe(true);
    expect(isFileStemWildcardExportTarget("./src/aggregates/*/index.ts")).toBe(false);
    expect(isFileStemWildcardExportTarget("./src/*")).toBe(false);
    expect(isFileStemWildcardExportTarget("./src/prefix*.ts")).toBe(false);
    expect(isFileStemWildcardExportTarget("./src/*.js")).toBe(false);
  });
});
