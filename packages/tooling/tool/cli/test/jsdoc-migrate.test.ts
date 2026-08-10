import {
  computeJSDocMigrateBinding,
  documentationShapeViolations,
  isPackageSourceFile,
  isPackageSourceFileIncludingGenerated,
  jsdocMigrateBlockStats,
  jsdocMigrateConservationFindings,
  jsdocMigrateExtractRecordsForFile,
  jsdocMigrateShapeRegressions,
  jsdocMigrateSourceHash,
  jsdocMigrateTitleRecordsFromResponse,
  jsdocMigrateTitlesPrompt,
  jsdocZeroLegacyGeneratedResiduals,
  partitionMigratedOrphans,
  rewriteJSDocMigrateBlock,
  scanJSDocMigrateBlocks,
  syntheticJSDocMigrateTitleRecord,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, MutableHashMap } from "effect";

const lines = (...values: ReadonlyArray<string>): string => values.join("\n");

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
    const result = rewriteJSDocMigrateBlock({
      blockText: simpleBlock,
      indent: "",
      data: { titles: ["Decode a user name"] },
    });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Example** (Decode a user name)");
    expect(result.text).not.toContain("@example");
    expect(result.text).toContain('const result = decodeUserName("Ada")');
    expect(result.text.indexOf("@category decoding")).toBeLessThan(result.text.indexOf("@since 0.0.0"));
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["Assign Ok status type"] },
    });
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
    const result = rewriteJSDocMigrateBlock({ blockText: block, indent: "", data: { titles: [] } });
    expect(result._tag).toBe("Quarantined");
    if (result._tag === "Quarantined") {
      expect(result.reasons).toContain("inheritdoc-summary-content");
    }
  });

  it("quarantines an unfenced @example instead of inventing a fence", () => {
    const block = lines("/**", " * Adds numbers.", " *", " * @example", " * add(1, 2)", " *", " * @since 0.0.0", " */");
    const result = rewriteJSDocMigrateBlock({ blockText: block, indent: "", data: { titles: ["Add numbers"] } });
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["First case", "Second case"] },
    });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    const first = result.text.indexOf("**Example** (First case)");
    const second = result.text.indexOf("**Example** (Second case)");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(result.text.indexOf("parse(1)")).toBeLessThan(result.text.indexOf("parse(2)"));
  });

  it("fails with DataMismatch when the title count disagrees with the block", () => {
    const result = rewriteJSDocMigrateBlock({ blockText: simpleBlock, indent: "", data: { titles: [] } });
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["Decode a name"], remarks: "details" },
    });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Details**");
    expect(result.text).toContain("Returns None rather than throwing for invalid input.");
    expect(result.text).not.toContain("@remarks");
    expect(result.text.indexOf("**Details**")).toBeLessThan(result.text.indexOf("**Example** (Decode a name)"));
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: [], remarks: "gotchas" },
    });
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
    expect(before.some((finding) => finding.rule === "multiple-description-paragraphs")).toBe(true);
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["Digest a value"], leadEnd: 1 },
    });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    const after = documentationShapeViolations(result.text);
    expect(after.some((finding) => finding.rule === "multiple-description-paragraphs")).toBe(false);
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: [], remarks: "gotchas", seePurposes: ["for the related decoder."] },
    });
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
    const positions = order.map((tag) => result.text.indexOf(tag));
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["Parse a citation"] },
    });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("**Example** (Parse a citation)");
    expect(result.text).not.toContain("@example");
    expect(result.text.match(/\*\*Example\*\*/g)?.length).toBe(1);
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
    const result = rewriteJSDocMigrateBlock({
      blockText: block,
      indent: "",
      data: { titles: ["Parse a citation"] },
    });
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
    const result = rewriteJSDocMigrateBlock({ blockText: block, indent: "  ", data: { titles: ["Read the member"] } });
    expect(result._tag).toBe("Rewritten");
    if (result._tag !== "Rewritten") {
      return;
    }
    expect(result.text).toContain("\n   * **Example** (Read the member)");
    expect(result.text.endsWith("  */")).toBe(true);
  });
});

describe("JSDocMigrateRewrite conservation law", () => {
  it("flags a mutated fence as a conservation violation", () => {
    const mutated = simpleBlock.replace('decodeUserName("Ada")', 'decodeUserName("Eve")');
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(findings.some((finding) => finding.startsWith("fence-bytes-changed"))).toBe(true);
  });

  it("flags dropped prose as a removed token", () => {
    const mutated = simpleBlock.replace(" * Decodes a user name.", " * Decodes.");
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(findings.some((finding) => finding.startsWith("token-removed"))).toBe(true);
  });

  it("flags invented prose as an added token", () => {
    const mutated = simpleBlock.replace(" * Decodes a user name.", " * Decodes a wonderful user name.");
    const findings = jsdocMigrateConservationFindings({
      original: simpleBlock,
      candidate: mutated,
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(findings.some((finding) => finding.startsWith("token-added"))).toBe(true);
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

describe("JSDocMigrateExtract anchors", () => {
  it("gives a runtime schema and its same-name type companion distinct ordinals", () => {
    const source = lines(
      "/**",
      " * Runtime schema.",
      " *",
      " * @example",
      " * ```ts",
      " * Foo",
      " * ```",
      " */",
      "export const Foo = 1",
      "/**",
      " * Companion type.",
      " *",
      " * @example",
      " * ```ts",
      " * const x: Foo = 1",
      " * ```",
      " */",
      "export type Foo = typeof Foo",
      ""
    );
    const blocks = scanJSDocMigrateBlocks("packages/x/src/Foo.ts", source);
    expect(blocks.map((block) => block.anchor)).toEqual(["packages/x/src/Foo.ts#Foo#0", "packages/x/src/Foo.ts#Foo#1"]);
    expect(blocks.map((block) => block.kind)).toEqual(["value", "type-level"]);
  });

  it("gives each documented overload signature its own ordinal", () => {
    const source = lines(
      "/** First overload. */",
      "export function f(a: string): string;",
      "/** Second overload. */",
      "export function f(a: number): number;",
      "/** Implementation. */",
      "export function f(a: unknown): unknown {",
      "  return a",
      "}",
      ""
    );
    const anchors = scanJSDocMigrateBlocks("packages/x/src/f.ts", source).map((block) => block.anchor);
    expect(anchors).toEqual(["packages/x/src/f.ts#f#0", "packages/x/src/f.ts#f#1", "packages/x/src/f.ts#f#2"]);
  });

  it("gives merged declarations distinct ordinals", () => {
    const source = lines(
      "/** Interface doc. */",
      "export interface X {",
      "  readonly a: number",
      "}",
      "/** Namespace doc. */",
      "export namespace X {",
      "  export const b = 1",
      "}",
      ""
    );
    const anchors = scanJSDocMigrateBlocks("packages/x/src/X.ts", source).map((block) => block.anchor);
    expect(anchors).toEqual(["packages/x/src/X.ts#X#0", "packages/x/src/X.ts#X#1"]);
  });

  it("binds a fileoverview block above a symbol doc to <fileoverview>", () => {
    const source = lines(
      "/**",
      " * Module overview.",
      " *",
      " * @since 0.0.0",
      " */",
      "",
      "/** Const doc. */",
      "export const a = 1",
      ""
    );
    const blocks = scanJSDocMigrateBlocks("packages/x/src/a.ts", source);
    expect(blocks.map((block) => block.symbol)).toEqual(["<fileoverview>", "a"]);
  });

  it("emits records only for blocks carrying a legacy carrier", () => {
    const source = lines(
      "/**",
      " * Already migrated.",
      " *",
      " * **Example** (Use it)",
      " *",
      " * ```ts",
      " * use()",
      " * ```",
      " */",
      "export const migrated = 1",
      "/**",
      " * Legacy block.",
      " *",
      " * @example",
      " * ```ts",
      " * legacy()",
      " * ```",
      " */",
      "export const legacy = 1",
      ""
    );
    const records = jsdocMigrateExtractRecordsForFile("packages/x/src/mixed.ts", source);
    expect(records.map((record) => record.symbol)).toEqual(["legacy"]);
    expect(records[0]?.sourceHash).toBe(jsdocMigrateSourceHash(records[0]?.blockText ?? ""));
  });

  it("measures block statistics for the title pass", () => {
    const stats = jsdocMigrateBlockStats(
      lines(
        "/**",
        " * Lead one.",
        " *",
        " * Lead two.",
        " *",
        " * @remarks Careful.",
        " * @see {@link other}",
        " * @example",
        " * missing fence",
        " */"
      )
    );
    expect(stats.leadParagraphCount).toBe(2);
    expect(stats.remarksTagCount).toBe(1);
    expect(stats.undescribedSeeCount).toBe(1);
    expect(stats.exampleTagCount).toBe(1);
    expect(stats.unfencedExampleCount).toBe(1);
  });
});

const legacyPair = (first: string, second: string): string =>
  lines(
    "/**",
    ` * ${first}`,
    " *",
    " * @example",
    " * ```ts",
    ` * use("${first}")`,
    " * ```",
    " */",
    "export function g(a: string): string;",
    "/**",
    ` * ${second}`,
    " *",
    " * @example",
    " * ```ts",
    ` * use("${second}")`,
    " * ```",
    " */",
    "export function g(a: number): number;",
    ""
  );

describe("JSDocMigrateApply binding verification", () => {
  it("passes when frozen records biject with the extract and hashes match", () => {
    const extract = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const titles = extract.map(syntheticJSDocMigrateTitleRecord);
    const report = computeJSDocMigrateBinding({ extract, titles, overrides: [] });
    expect(report.orphanRecordAnchors).toEqual([]);
    expect(report.unmatchedExtractAnchors).toEqual([]);
    expect(report.sourceHashMismatchAnchors).toEqual([]);
    expect(report.kindMismatchAnchors).toEqual([]);
  });

  it("detects reordered same-name declarations via sourceHash while counts still match", () => {
    const frozen = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const reordered = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc B.", "Doc A."));
    const titles = frozen.map(syntheticJSDocMigrateTitleRecord);
    const report = computeJSDocMigrateBinding({ extract: reordered, titles, overrides: [] });
    expect(report.extractCount).toBe(report.recordCount);
    expect(report.orphanRecordAnchors).toEqual([]);
    expect(report.unmatchedExtractAnchors).toEqual([]);
    expect(report.sourceHashMismatchAnchors.length).toBeGreaterThan(0);
  });

  it("detects a declaration added ahead as a bijection failure", () => {
    const frozen = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const grown = jsdocMigrateExtractRecordsForFile(
      "packages/x/src/g.ts",
      lines(
        "/**",
        " * Doc Z.",
        " *",
        " * @example",
        " * ```ts",
        ' * use("Doc Z.")',
        " * ```",
        " */",
        "export function g(a: boolean): boolean;",
        legacyPair("Doc A.", "Doc B.")
      )
    );
    const titles = frozen.map(syntheticJSDocMigrateTitleRecord);
    const report = computeJSDocMigrateBinding({ extract: grown, titles, overrides: [] });
    expect(report.unmatchedExtractAnchors.length).toBeGreaterThan(0);
  });

  it("detects a removed declaration as an orphan record failure", () => {
    const frozen = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const shrunk = frozen.slice(0, 1);
    const titles = frozen.map(syntheticJSDocMigrateTitleRecord);
    const report = computeJSDocMigrateBinding({ extract: shrunk, titles, overrides: [] });
    expect(report.orphanRecordAnchors.length).toBeGreaterThan(0);
  });

  it("detects an in-place edit as a sourceHash mismatch that demands a re-title", () => {
    const frozen = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const edited = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A, edited.", "Doc B."));
    const titles = frozen.map(syntheticJSDocMigrateTitleRecord);
    const report = computeJSDocMigrateBinding({ extract: edited, titles, overrides: [] });
    expect(report.sourceHashMismatchAnchors).toEqual(["packages/x/src/g.ts#g#0"]);
  });

  it("synthesizes one unique placeholder title per example tag", () => {
    const extract = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));
    const first = extract[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      return;
    }
    expect(syntheticJSDocMigrateTitleRecord(first).titles).toEqual(["Placeholder title"]);
  });
});

describe("JSDocMigrateTitles response validation", () => {
  const pending = jsdocMigrateExtractRecordsForFile("packages/x/src/g.ts", legacyPair("Doc A.", "Doc B."));

  it("renders a prompt naming every pending anchor", () => {
    const prompt = jsdocMigrateTitlesPrompt(pending);
    for (const record of pending) {
      expect(prompt).toContain(record.anchor);
    }
  });

  it("accepts a valid response and stamps verification fields", () => {
    const content = JSON.stringify(pending.map((record) => ({ anchor: record.anchor, titles: ["Use the helper"] })));
    const records = Effect.runSync(jsdocMigrateTitleRecordsFromResponse(content, pending));
    expect(records.length).toBe(pending.length);
    expect(records[0]?.sourceHash).toBe(pending[0]?.sourceHash);
    expect(records[0]?.kind).toBe(pending[0]?.kind);
  });

  it("rejects a response with a wrong title count", () => {
    const content = JSON.stringify(pending.map((record) => ({ anchor: record.anchor, titles: ["One", "Two"] })));
    const exit = Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse(content, pending));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects a response that misses an anchor", () => {
    const content = JSON.stringify([{ anchor: pending[0]?.anchor, titles: ["Only one"] }]);
    const exit = Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse(content, pending));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects non-JSON content", () => {
    const exit = Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse("not json", pending));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects empty and duplicate titles", () => {
    const twoExample = jsdocMigrateExtractRecordsForFile(
      "packages/x/src/two.ts",
      lines(
        "/**",
        " * Two examples.",
        " *",
        " * @example",
        " * ```ts",
        " * one()",
        " * ```",
        " *",
        " * @example",
        " * ```ts",
        " * two()",
        " * ```",
        " */",
        "export const two = 1",
        ""
      )
    );
    const duplicate = JSON.stringify(twoExample.map((record) => ({ anchor: record.anchor, titles: ["Same", "Same"] })));
    expect(Exit.isFailure(Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse(duplicate, twoExample)))).toBe(true);
    const empty = JSON.stringify(twoExample.map((record) => ({ anchor: record.anchor, titles: ["Fine", "  "] })));
    expect(Exit.isFailure(Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse(empty, twoExample)))).toBe(true);
  });

  it("rejects a see-purpose count that disagrees with the block", () => {
    const withSee = jsdocMigrateExtractRecordsForFile(
      "packages/x/src/see.ts",
      lines(
        "/**",
        " * Uses a helper.",
        " *",
        " * @see {@link other}",
        " * @example",
        " * ```ts",
        " * use()",
        " * ```",
        " */",
        "export const use = 1",
        ""
      )
    );
    const missingPurpose = JSON.stringify(withSee.map((record) => ({ anchor: record.anchor, titles: ["Use it"] })));
    expect(Exit.isFailure(Effect.runSyncExit(jsdocMigrateTitleRecordsFromResponse(missingPurpose, withSee)))).toBe(
      true
    );
    const withPurpose = JSON.stringify(
      withSee.map((record) => ({ anchor: record.anchor, titles: ["Use it"], seePurposes: ["for the helper."] }))
    );
    const records = Effect.runSync(jsdocMigrateTitleRecordsFromResponse(withPurpose, withSee));
    expect(records.length).toBe(withSee.length);
  });
});

describe("JSDocMigrateApply orphan tolerance", () => {
  it("tolerates records whose blocks were already migrated and keeps true orphans", () => {
    const migratedSource = lines(
      "/**",
      " * Already migrated.",
      " *",
      " * **Example** (Use it)",
      " *",
      " * ```ts",
      " * use()",
      " * ```",
      " */",
      "export const done = 1",
      ""
    );
    const blocks = MutableHashMap.empty<string, { readonly affected: boolean }>();
    for (const block of scanJSDocMigrateBlocks("packages/x/src/done.ts", migratedSource)) {
      MutableHashMap.set(blocks, block.anchor, { affected: block.affected });
    }
    const result = partitionMigratedOrphans(["packages/x/src/done.ts#done#0", "packages/x/src/gone.ts#gone#0"], blocks);
    expect(result.migrated).toEqual(["packages/x/src/done.ts#done#0"]);
    expect(result.missing).toEqual(["packages/x/src/gone.ts#gone#0"]);
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
