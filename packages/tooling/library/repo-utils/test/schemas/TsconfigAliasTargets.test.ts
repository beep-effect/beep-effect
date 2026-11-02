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
import * as O from "effect/Option";
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
    expect(O.getOrUndefined(resolveRootExportTarget("./src/index.ts"))).toBe("./src/index.ts");
    expect(O.isNone(resolveRootExportTarget("src/index.ts"))).toBe(true);
    expect(O.isNone(resolveRootExportTarget(null))).toBe(true);
    expect(O.isNone(resolveRootExportTarget(42))).toBe(true);
    expect(O.isNone(resolveRootExportTarget({ ".": null }))).toBe(true);
  });

  it("follows the repo condition priority, not object key order", () => {
    const target = resolveRootExportTarget({
      ".": { import: "./src/index.ts", types: "./dist/index.d.ts" },
    });
    expect(O.getOrUndefined(target)).toBe("./dist/index.d.ts");

    const nested = resolveRootExportTarget({
      ".": { node: { import: "./dist/node.mjs" }, default: "./dist/index.js" },
    });
    expect(O.getOrUndefined(nested)).toBe("./dist/index.js");
  });

  it("skips prioritized conditions whose values are not ./-relative", () => {
    const target = resolveRootExportTarget({
      ".": { types: "dist/index.d.ts", import: "./src/index.ts" },
    });
    expect(O.getOrUndefined(target)).toBe("./src/index.ts");
  });

  it("falls back to unknown conditions and to array alternatives", () => {
    expect(O.getOrUndefined(resolveRootExportTarget({ ".": { "custom-condition": "./src/custom.ts" } }))).toBe(
      "./src/custom.ts"
    );
    expect(
      O.getOrUndefined(resolveRootExportTarget({ ".": ["not-relative", { import: "./src/from-array.ts" }] }))
    ).toBe("./src/from-array.ts");
    expect(O.getOrUndefined(resolveRootExportTarget(["./src/top-level-array.ts"]))).toBe("./src/top-level-array.ts");
  });

  it("treats a top-level condition map as the root export (exports sugar form)", () => {
    const target = resolveRootExportTarget({ import: "./src/index.ts", types: "./dist/index.d.ts" });
    expect(O.getOrUndefined(target)).toBe("./dist/index.d.ts");
  });

  it("returns none when the export map only declares subpaths", () => {
    expect(O.isNone(resolveRootExportTarget({ "./testing": "./src/testing.ts", "./*": "./src/*.ts" }))).toBe(true);
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
    expect(O.getOrUndefined(resolveSubpathExportTarget(exportsField, "./testing"))).toBe("./dist/testing.d.ts");
    expect(O.getOrUndefined(resolveSubpathExportTarget("./testing")(exportsField))).toBe("./dist/testing.d.ts");
  });

  it("returns none for missing subpaths, blocked (null) subpaths and non-map exports", () => {
    expect(O.isNone(resolveSubpathExportTarget(exportsField, "./missing"))).toBe(true);
    expect(O.isNone(resolveSubpathExportTarget(exportsField, "./internal/*"))).toBe(true);
    expect(O.isNone(resolveSubpathExportTarget("./src/index.ts", "./testing"))).toBe(true);
  });

  it("resolves the ./* wildcard entry only when the map declares one", () => {
    expect(O.getOrUndefined(resolveWildcardExportTarget(exportsField))).toBe("./src/*.ts");
    expect(O.isNone(resolveWildcardExportTarget({ ".": "./src/index.ts" }))).toBe(true);
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
