import {
  documentationShapeViolations,
  isPackageSourceFile,
  isPackageSourceFileIncludingGenerated,
  jsdocZeroLegacyGeneratedResiduals,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const lines = (...values: ReadonlyArray<string>): string => A.join(values, "\n");

const rules = (commentText: string): ReadonlyArray<string> =>
  A.map(documentationShapeViolations(commentText), (finding) => finding.rule);

describe("documentationShapeViolations", () => {
  it("accepts a compliant block with ordered sections and one titled example", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * **Details**",
      " *",
      " * The digest is stable across processes.",
      " *",
      " * **Gotchas**",
      " *",
      " * Inputs must be finite.",
      " *",
      " * **Example** (Digest a value)",
      " *",
      " * ```ts",
      " * digest(1)",
      " * ```",
      " *",
      " * @see {@link digestAll} for batches.",
      " * @since 0.0.0",
      " */"
    );
    expect(rules(block)).toEqual([]);
  });

  it("flags a multi-paragraph lead and a legacy @remarks tag", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * The digest is stable across processes and versions.",
      " *",
      " * @remarks Detail.",
      " * @since 0.0.0",
      " */"
    );
    const found = rules(block);
    expect(found).toContain("multiple-description-paragraphs");
    expect(found).toContain("forbidden-remarks");
  });

  it("flags an undescribed @see and a markdown heading in the lead", () => {
    const block = lines("/**", " * # Digest", " *", " * @see {@link digestAll}", " */");
    const found = rules(block);
    expect(found).toContain("undescribed-see");
    expect(found).toContain("invalid-heading");
  });

  it("flags a leading blank line in the lead", () => {
    expect(rules(lines("/**", " *", " * Computes the digest.", " */"))).toContain("leading-blank");
  });

  it("flags untitled, fenceless, empty-fenced and duplicate examples", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * **Example**",
      " *",
      " * ```ts",
      " * digest(1)",
      " * ```",
      " *",
      " * **Example** (Digest a value)",
      " *",
      " * No fence here.",
      " *",
      " * **Example** (Digest a value)",
      " *",
      " * ```ts",
      " * ```",
      " */"
    );
    const found = rules(block);
    expect(found).toContain("malformed-example");
    expect(found).toContain("duplicate-example");
    expect(found).toContain("empty-section");
  });

  it("flags sections out of order, duplicated, empty, or after the example", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * **Gotchas**",
      " *",
      " * Inputs must be finite.",
      " *",
      " * **Details**",
      " *",
      " * More detail.",
      " *",
      " * **Details**",
      " *",
      " * **Example** (Digest a value)",
      " *",
      " * ```ts",
      " * digest(1)",
      " * ```",
      " *",
      " * **Gotchas**",
      " *",
      " * Late gotcha.",
      " */"
    );
    const found = rules(block);
    expect(found).toContain("section-out-of-order");
    expect(found).toContain("duplicate-section");
    expect(found).toContain("empty-section");
    expect(found).toContain("section-after-example");
  });

  it("flags a When to use section without the required prefix", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * **When to use**",
      " *",
      " * Whenever a digest is needed.",
      " */"
    );
    expect(rules(block)).toContain("invalid-when-to-use-prefix");
  });

  it("flags a ts fence outside any example section", () => {
    const block = lines("/**", " * Computes the digest.", " *", " * ```ts", " * digest(1)", " * ```", " */");
    expect(rules(block)).toContain("loose-ts-fence");
  });
});

describe("JSDoc cleanup-on-touch path predicate", () => {
  it("includes hand-authored package source and excludes generated source", () => {
    const hand = "packages/shared/schema/src/Kits.ts";
    const generated = "packages/drivers/acp/src/_generated/schema.gen.ts";
    expect(isPackageSourceFile(hand)).toBe(true);
    expect(isPackageSourceFile(generated)).toBe(false);
    expect(isPackageSourceFileIncludingGenerated(hand)).toBe(true);
    expect(isPackageSourceFileIncludingGenerated(generated)).toBe(true);
    expect(jsdocZeroLegacyGeneratedResiduals).toHaveLength(0);
  });

  it("includes apps source files in both zero-legacy scopes", () => {
    const appHand = "apps/professional-desktop/src/sync/Sync.atoms.ts";
    const appGenerated = "apps/professional-desktop/src/runtime/Migrations.gen.ts";
    expect(isPackageSourceFile(appHand)).toBe(true);
    expect(isPackageSourceFileIncludingGenerated(appHand)).toBe(true);
    expect(isPackageSourceFileIncludingGenerated(appGenerated)).toBe(true);
  });

  it("rejects test files, non-workspace paths and non-TypeScript sources", () => {
    expect(isPackageSourceFile("packages/shared/schema/test/Kits.test.ts")).toBe(false);
    expect(isPackageSourceFile("scripts/src/tool.ts")).toBe(false);
    expect(isPackageSourceFile("packages/shared/schema/src/README.md")).toBe(false);
    expect(isPackageSourceFile("apps/web/src/App.tsx")).toBe(true);
    expect(isPackageSourceFileIncludingGenerated("packages/shared/schema/src/data.json")).toBe(false);
  });
});
