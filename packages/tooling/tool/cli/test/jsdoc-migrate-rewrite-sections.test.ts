import {
  JSDocMigrateBlockInput,
  JSDocMigrateBlockStats,
  jsdocMigrateBlockStats,
  jsdocMigrateConservationFindings,
  jsdocMigrateShapeRegressions,
  rewriteJSDocMigrateBlock,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const lines = (...values: ReadonlyArray<string>): string => A.join(values, "\n");

const indexIn = (text: string, needle: string): number => O.getOrElse(Str.indexOf(needle)(text), constant(-1));

const isJSDocMigrateBlockStats = S.is(JSDocMigrateBlockStats);

const rewrite = (blockText: string, data: JSDocMigrateBlockInput["data"], indent = "") =>
  rewriteJSDocMigrateBlock(JSDocMigrateBlockInput.make({ blockText, indent, data }));

const rewrittenText = (result: ReturnType<typeof rewrite>): string => {
  expect(result._tag).toBe("Rewritten");
  return result._tag === "Rewritten" ? result.text : "";
};

describe("jsdocMigrateBlockStats", () => {
  it("measures lead paragraphs, carriers, unfenced examples, and undescribed see tags", () => {
    const stats = jsdocMigrateBlockStats(
      lines(
        "/**",
        " * Lead one.",
        " *",
        " * Lead two.",
        " *",
        " * @remarks Careful.",
        " * @see {@link other}",
        " * @see {@link described} for context.",
        " * @example",
        " * missing fence",
        " */"
      )
    );
    expect(isJSDocMigrateBlockStats(stats)).toBe(true);
    expect(stats).toEqual({
      leadParagraphCount: 2,
      exampleTagCount: 1,
      unfencedExampleCount: 1,
      remarksTagCount: 1,
      undescribedSeeCount: 1,
    });
  });

  it("measures a block without tags or lead", () => {
    expect(jsdocMigrateBlockStats(lines("/**", " *", " */"))).toEqual({
      leadParagraphCount: 0,
      exampleTagCount: 0,
      unfencedExampleCount: 0,
      remarksTagCount: 0,
      undescribedSeeCount: 0,
    });
  });
});

describe("rewriteJSDocMigrateBlock section routing", () => {
  it("appends @remarks content into an existing Details section", () => {
    const text = rewrittenText(
      rewrite(
        lines(
          "/**",
          " * Lead.",
          " *",
          " * **Details**",
          " *",
          " * Existing detail.",
          " *",
          " * @remarks Added remark.",
          " * @category models",
          " * @since 0.0.0",
          " */"
        ),
        { titles: [] }
      )
    );
    expect(text).toContain("Existing detail.");
    expect(text).toContain("Added remark.");
    expect(Str.split("**Details**")(text).length).toBe(2);
    expect(text).not.toContain("@remarks");
  });

  it("inserts Details before an existing Gotchas section and Gotchas after When to use", () => {
    const text = rewrittenText(
      rewrite(
        lines(
          "/**",
          " * First lead paragraph.",
          " *",
          " * Second lead paragraph.",
          " *",
          " * Third paragraph moves to Details.",
          " *",
          " * **When to use**",
          " *",
          " * When needed.",
          " *",
          " * **Gotchas**",
          " *",
          " * Watch out.",
          " *",
          " * @remarks",
          " * Routed remark.",
          " * @category models",
          " */"
        ),
        { titles: [], leadEnd: 2, remarks: "gotchas" }
      )
    );
    const index = (needle: string) => indexIn(text, needle);
    expect(index("Second lead paragraph.")).toBeLessThan(index("**When to use**"));
    expect(index("**When to use**")).toBeLessThan(index("**Details**"));
    expect(index("**Details**")).toBeLessThan(index("**Gotchas**"));
    expect(index("Third paragraph moves to Details.")).toBeGreaterThan(index("**Details**"));
    expect(index("Routed remark.")).toBeGreaterThan(index("Watch out."));
  });

  it("routes a remark into a new Gotchas section and appends two remarks together", () => {
    const text = rewrittenText(
      rewrite(
        lines(
          "/**",
          " * Lead.",
          " *",
          " * @remarks First remark.",
          " * @remarks Second remark.",
          " * @since 0.0.0",
          " */"
        ),
        { titles: [], remarks: "gotchas" }
      )
    );
    expect(text).toContain("**Gotchas**");
    expect(indexIn(text, "First remark.")).toBeLessThan(indexIn(text, "Second remark."));
  });

  it("emits an Example section for a block with no lead and no other tags", () => {
    const text = rewrittenText(
      rewrite(lines("/**", " * @example", " * ```ts", " * use()", " * ```", " */"), {
        titles: ["Use it"],
      })
    );
    expect(Str.startsWith("/**\n * **Example** (Use it)")(text)).toBe(true);
    expect(text).toContain("use()");
  });

  it("renders a tag-only block, with indentation, and orders unknown tags before @category", () => {
    const text = rewrittenText(
      rewrite(
        lines("/**", "   * @since 0.0.0", "   * @category models", "   * @custom value", "   */"),
        { titles: [] },
        "  "
      )
    );
    expect(text).toBe(lines("/**", "   * @custom value", "   * @category models", "   * @since 0.0.0", "   */"));
  });

  it("keeps an undescribed see line when no purpose is supplied", () => {
    const result = rewrite(lines("/**", " * Lead.", " *", " * @see {@link other}", " */"), {
      titles: [],
      seePurposes: ["   "],
    });
    expect(result).toEqual({
      _tag: "Rewritten",
      text: lines("/**", " * Lead.", " *", " * @see {@link other}", " */"),
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
  });

  it("normalizes param type blobs and return hyphens", () => {
    const text = rewrittenText(
      rewrite(
        lines(
          "/**",
          " * Lead.",
          " *",
          " * @param {string} value - The value.",
          " * @returns - The result.",
          " * @template A",
          " */"
        ),
        { titles: [] }
      )
    );
    expect(text).toContain("@typeParam A");
    expect(text).not.toContain("{string}");
    expect(text).toContain("@returns The result.");
  });
});

describe("rewriteJSDocMigrateBlock quarantines", () => {
  it("quarantines an example carrying two fences", () => {
    const result = rewrite(
      lines(
        "/**",
        " * Lead.",
        " *",
        " * @example",
        " * ```ts",
        " * a()",
        " * ```",
        " * ```ts",
        " * b()",
        " * ```",
        " */"
      ),
      { titles: ["Two fences"] }
    );
    expect(result).toEqual({ _tag: "Quarantined", reasons: ["multi-fence-example"] });
  });

  it("quarantines an unfenced example", () => {
    const result = rewrite(lines("/**", " * Lead.", " *", " * @example a()", " */"), { titles: ["Unfenced"] });
    expect(result).toEqual({ _tag: "Quarantined", reasons: ["unfenced-example"] });
  });

  it("quarantines a titled Example section mixed with a legacy example tag", () => {
    const result = rewrite(
      lines(
        "/**",
        " * Lead.",
        " *",
        " * **Example** (Existing)",
        " *",
        " * ```ts",
        " * a()",
        " * ```",
        " *",
        " * @example",
        " * ```ts",
        " * b()",
        " * ```",
        " */"
      ),
      { titles: ["Legacy"] }
    );
    expect(result).toEqual({ _tag: "Quarantined", reasons: ["mixed-example-carriers"] });
  });

  it("reports a data mismatch when the title count disagrees", () => {
    const result = rewrite(lines("/**", " * Lead.", " */"), { titles: ["Extra"] });
    expect(result._tag).toBe("DataMismatch");
  });

  it("keeps an inline example caption as prose above the fence", () => {
    const text = rewrittenText(
      rewrite(lines("/**", " * Lead.", " *", " * @example Caption text", " * ```ts", " * a()", " * ```", " */"), {
        titles: ["Caption"],
      })
    );
    expect(text).toBe(
      lines(
        "/**",
        " * Lead.",
        " *",
        " * **Example** (Caption)",
        " *",
        " * Caption text",
        " * ```ts",
        " * a()",
        " * ```",
        " */"
      )
    );
  });

  it("quarantines an empty title as a malformed-example shape regression", () => {
    const result = rewrite(lines("/**", " * Lead.", " *", " * @example", " * ```ts", " * a()", " * ```", " */"), {
      titles: [""],
    });
    expect(result).toEqual({ _tag: "Quarantined", reasons: ["shape-regression: malformed-example 0 -> 1"] });
  });
});

describe("jsdocMigrateConservationFindings and shape regressions", () => {
  it("treats an unclosed fence as a fence body and reports its loss", () => {
    const findings = jsdocMigrateConservationFindings({
      original: lines("/**", " * Lead.", " *", " * ```ts", " * const a = 1", " */"),
      candidate: lines("/**", " * Lead.", " */"),
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(A.some(findings, Str.startsWith("fence-bytes-changed: lost fence"))).toBe(true);
  });

  it("reports added and removed tokens beyond the allowances", () => {
    const findings = jsdocMigrateConservationFindings({
      original: lines("/**", " * Alpha beta.", " */"),
      candidate: lines("/**", " * Alpha gamma.", " */"),
      allowedAddedTokens: [],
      allowedRemovedTokens: [],
    });
    expect(findings).toEqual(["token-removed: beta.", "token-added: gamma."]);
  });

  it("reports a rule whose count grew in the candidate", () => {
    const original = lines("/**", " * Lead.", " *", " * @since 0.0.0", " */");
    const candidate = lines(
      "/**",
      " * Lead.",
      " *",
      " * @remarks Legacy.",
      " * @example",
      " * ```ts",
      " * a()",
      " * ```",
      " * @since 0.0.0",
      " */"
    );
    expect(jsdocMigrateShapeRegressions(original, candidate).length).toBeGreaterThan(0);
    expect(jsdocMigrateShapeRegressions(candidate)(original)).toEqual(
      jsdocMigrateShapeRegressions(original, candidate)
    );
    expect(jsdocMigrateShapeRegressions(candidate, original)).toEqual([]);
  });
});
