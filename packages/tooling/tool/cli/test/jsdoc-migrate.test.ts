import {
  documentationShapeViolations,
  isPackageSourceFile,
  isPackageSourceFileIncludingGenerated,
  JSDocMigrateBlockInput,
  jsdocMigrateConservationFindings,
  jsdocMigrateShapeRegressions,
  jsdocZeroLegacyGeneratedResiduals,
  rewriteJSDocMigrateBlock,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const lines = (...values: ReadonlyArray<string>): string => A.join(values, "\n");

const simpleBlock = lines(
  "/**",
  " * Decodes a user name.",
  " *",
  " * @example",
  " * ```ts",
  ' * const result = decodeUserName("Ada")',
  " * ```",
  " *",
  " * @category decoding",
  " * @since 0.0.0",
  " */"
);

describe("JSDocMigrateRewrite rewriteJSDocMigrateBlock", () => {
  it("converts a fenced @example into a titled Example section", () => {
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: simpleBlock,
        indent: "",
        data: { titles: ["Decode a user name"] },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Example** (Decode a user name)");
    expect(result.text).not.toContain("@example");
    expect(result.text).toContain('const result = decodeUserName("Ada")');
    expect(O.getOrElse(Str.indexOf("@category decoding")(result.text), constant(-1))).toBeLessThan(
      O.getOrElse(Str.indexOf("@since 0.0.0")(result.text), constant(-1))
    );
  });

  it("quarantines an @example inside an {@inheritDoc} block instead of emitting summary content", () => {
    const block = lines(
      "/**",
      " * {@inheritDoc Ok}",
      " *",
      " * @example",
      " * ```ts",
      " * const status: Ok = 200",
      " * ```",
      " *",
      " * @category validation",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["Assign Ok status type"] },
      })
    );
    expect(result._tag).toBe("Quarantined");
    if (result._tag === "Quarantined") {
      expect(result.reasons).toContain("inheritdoc-summary-content");
    }
  });

  it("quarantines an @remarks inside an {@inheritDoc} block instead of emitting summary content", () => {
    const block = lines(
      "/**",
      " * {@inheritDoc Created}",
      " *",
      " * @remarks",
      " * Routed detail.",
      " *",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({ blockText: block, indent: "", data: { titles: [] } })
    );
    expect(result._tag).toBe("Quarantined");
    if (result._tag === "Quarantined") {
      expect(result.reasons).toContain("inheritdoc-summary-content");
    }
  });

  it("quarantines an unfenced @example instead of inventing a fence", () => {
    const block = lines("/**", " * Adds numbers.", " *", " * @example", " * add(1, 2)", " *", " * @since 0.0.0", " */");
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({ blockText: block, indent: "", data: { titles: ["Add numbers"] } })
    );
    expect(result._tag).toBe("Quarantined");
    if (result._tag === "Quarantined") {
      expect(result.reasons).toContain("unfenced-example");
    }
  });

  it("converts a multi-example block into distinct titled sections in order", () => {
    const block = lines(
      "/**",
      " * Parses input.",
      " *",
      " * @example",
      " * ```ts",
      " * parse(1)",
      " * ```",
      " *",
      " * @example",
      " * ```ts",
      " * parse(2)",
      " * ```",
      " *",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["First case", "Second case"] },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    const first = O.getOrElse(Str.indexOf("**Example** (First case)")(result.text), constant(-1));
    const second = O.getOrElse(Str.indexOf("**Example** (Second case)")(result.text), constant(-1));
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(O.getOrElse(Str.indexOf("parse(1)")(result.text), constant(-1))).toBeLessThan(
      O.getOrElse(Str.indexOf("parse(2)")(result.text), constant(-1))
    );
  });

  it("fails with DataMismatch when the title count disagrees with the block", () => {
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({ blockText: simpleBlock, indent: "", data: { titles: [] } })
    );
    expect(result._tag).toBe("DataMismatch");
  });

  it("routes @remarks alongside @example into Details before the Example", () => {
    const block = lines(
      "/**",
      " * Decodes a user name.",
      " *",
      " * @remarks Returns None rather than throwing for invalid input.",
      " *",
      " * @example",
      " * ```ts",
      ' * decodeUserName("Ada")',
      " * ```",
      " *",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["Decode a name"], remarks: "details" },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Details**");
    expect(result.text).toContain("Returns None rather than throwing for invalid input.");
    expect(result.text).not.toContain("@remarks");
    expect(O.getOrElse(Str.indexOf("**Details**")(result.text), constant(-1))).toBeLessThan(
      O.getOrElse(Str.indexOf("**Example** (Decode a name)")(result.text), constant(-1))
    );
    expect(jsdocMigrateShapeRegressions(block, result.text)).toEqual([]);
  });

  it("routes @remarks to Gotchas when the record says so", () => {
    const block = lines(
      "/**",
      " * Deletes the record.",
      " *",
      " * @remarks This cannot be undone.",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: [], remarks: "gotchas" },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Gotchas**");
    expect(result.text).toContain("This cannot be undone.");
  });

  it("splits a multi-paragraph lead at leadEnd and clears the shape finding", () => {
    const block = lines(
      "/**",
      " * Computes the digest.",
      " *",
      " * The digest is stable across processes and versions.",
      " *",
      " * @example",
      " * ```ts",
      " * digest(1)",
      " * ```",
      " *",
      " * @since 0.0.0",
      " */"
    );
    const before = documentationShapeViolations(block);
    expect(A.some(before, (finding) => finding.rule === "multiple-description-paragraphs")).toBe(true);
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["Digest a value"], leadEnd: 1 },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    const after = documentationShapeViolations(result.text);
    expect(A.some(after, (finding) => finding.rule === "multiple-description-paragraphs")).toBe(false);
    expect(result.text).toContain("The digest is stable across processes and versions.");
  });

  it("applies the grammar normal forms and canonical tag order", () => {
    const block = lines(
      "/**",
      " * Does things.",
      " *",
      " * @since 0.0.0",
      " * @category utilities",
      " * @template T - the element type",
      " * @param {string} name - the name",
      " * @returns - the result",
      " * @default 1",
      " * @see {@link decodeUserName}",
      " * @remarks Watch out for empty input.",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: [], remarks: "gotchas", seePurposes: ["for the related decoder."] },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("@typeParam T - the element type");
    expect(result.text).toContain("@param name - the name");
    expect(result.text).toContain("@returns the result");
    expect(result.text).toContain("@defaultValue 1");
    expect(result.text).toContain("@see {@link decodeUserName} for the related decoder.");
    expect(result.text).not.toContain("@template");
    expect(result.text).not.toContain("{string}");
    const order = ["@typeParam", "@param", "@returns", "@defaultValue", "@see", "@category", "@since"];
    const positions = A.map(order, (tag) => O.getOrElse(Str.indexOf(tag)(result.text), constant(-1)));
    for (const [index, position] of positions.entries()) {
      expect(position).toBeGreaterThan(index === 0 ? -1 : (positions[index - 1] ?? -1));
    }
    expect(jsdocMigrateShapeRegressions(block, result.text)).toEqual([]);
  });

  it("consumes a stray empty **Example** marker above a legacy tag", () => {
    const block = lines(
      "/**",
      " * Parses a citation.",
      " *",
      " * **Example**",
      " *",
      " * @example",
      " * ```ts",
      " * parseCitation()",
      " * ```",
      " *",
      " * @since 0.0.0",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["Parse a citation"] },
      })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Example** (Parse a citation)");
    expect(result.text).not.toContain("@example");
    expect(O.getOrNull(Str.match(/\*\*Example\*\*/g)(result.text))?.length).toBe(1);
    expect(jsdocMigrateShapeRegressions(block, result.text)).toEqual([]);
  });

  it("quarantines a genuine mix of a titled Example section and a legacy tag", () => {
    const block = lines(
      "/**",
      " * Parses a citation.",
      " *",
      " * **Example** (Existing)",
      " *",
      " * ```ts",
      " * existing()",
      " * ```",
      " *",
      " * @example",
      " * ```ts",
      " * parseCitation()",
      " * ```",
      " */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({
        blockText: block,
        indent: "",
        data: { titles: ["Parse a citation"] },
      })
    );
    expect(result._tag).toBe("Quarantined");
    if (result._tag === "Quarantined") {
      expect(result.reasons).toContain("mixed-example-carriers");
    }
  });

  it("keeps indented member blocks aligned with their original indentation", () => {
    const block = lines(
      "/**",
      "   * Member doc.",
      "   *",
      "   * @example",
      "   * ```ts",
      "   * value.member",
      "   * ```",
      "   *",
      "   * @since 0.0.0",
      "   */"
    );
    const result = rewriteJSDocMigrateBlock(
      JSDocMigrateBlockInput.make({ blockText: block, indent: "  ", data: { titles: ["Read the member"] } })
    );
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("\n   * **Example** (Read the member)");
    expect(Str.endsWith("  */")(result.text)).toBe(true);
  });
});

describe("JSDocMigrateRewrite conservation law", () => {
  it("flags a mutated fence as a conservation violation", () => {
    const mutated = Str.replace('decodeUserName("Ada")', 'decodeUserName("Eve")')(simpleBlock);
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(A.some(findings, (finding) => Str.startsWith("fence-bytes-changed")(finding))).toBe(true);
  });

  it("flags dropped prose as a removed token", () => {
    const mutated = Str.replace(" * Decodes a user name.", " * Decodes.")(simpleBlock);
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(A.some(findings, (finding) => Str.startsWith("token-removed")(finding))).toBe(true);
  });

  it("flags invented prose as an added token", () => {
    const mutated = Str.replace(" * Decodes a user name.", " * Decodes a wonderful user name.")(simpleBlock);
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(A.some(findings, (finding) => Str.startsWith("token-added")(finding))).toBe(true);
  });

  it("accepts an identical candidate", () => {
    expect(
      jsdocMigrateConservationFindings({
        original: simpleBlock,
        candidate: simpleBlock,
        allowedAddedTokens: [],
        allowedRemovedTokens: [],
      })
    ).toEqual([]);
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
});
