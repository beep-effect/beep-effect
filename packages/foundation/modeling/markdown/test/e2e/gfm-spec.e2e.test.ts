import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";
import { loadGfmExtensionsExamples, loadGfmSpecExtensionExamples } from "../support/corpus.ts";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";
import type { SpecExample } from "../support/corpus.ts";

const SPEC_SECTIONS_GREEN: ReadonlyArray<string> = [
  "Tables (extension)",
  "Strikethrough (extension)",
  "Autolinks (extension)",
  "Disallowed Raw HTML (extension)",
];

const EXTENSIONS_SECTIONS_GREEN: ReadonlyArray<string> = [
  "Tables",
  "Table cell count mismatches",
  "Embedded pipes",
  "Oddly-formatted markers",
  "Escaping",
  "Embedded HTML",
  "Reference-style links",
  "Sequential cells",
  "Interaction with emphasis",
  "a table can be recognised when separated from a paragraph of text without an empty line",
  "Strikethroughs",
  "Autolinks",
  "Interop",
  "Task lists",
  "Footnotes",
  "When a footnote is used multiple times, we insert multiple backrefs.",
  "Footnote reference labels are href escaped",
  "HTML tag filter",
];

const TERMINATION_ONLY: HashSet.HashSet<number> = HashSet.make(20);

const bySection = (examples: ReadonlyArray<SpecExample>): Record<string, ReadonlyArray<SpecExample>> =>
  A.groupBy(examples, (example) => example.section);

const runCorpus = (
  title: string,
  examples: ReadonlyArray<SpecExample>,
  green: ReadonlyArray<string>,
  expectedCount: number
): void => {
  const sections = bySection(examples);

  describe(title, () => {
    describe("gate", () => {
      it("allowlists only sections the corpus actually has", () => {
        for (const section of green) {
          assert.isTrue(R.has(sections, section), `the allowlist names a section the corpus does not: ${section}`);
        }
      });

      it("runs every example of the allowlisted sections", () => {
        const running = A.reduce(green, 0, (total, section) => total + (sections[section]?.length ?? 0));
        assert.strictEqual(
          running,
          expectedCount,
          "silently-shrinking-corpus guard: a section dropping examples or leaving the allowlist would still look green"
        );
      });
    });

    for (const section of green) {
      describe(section, () => {
        for (const example of sections[section] ?? []) {
          it(`example ${example.example}`, () => {
            if (HashSet.has(TERMINATION_ONLY, example.example)) {
              assert.isString(
                renderHtml(parseBlocks(example.markdown, { dialect: "gfm" }).root, { gfm: true }),
                "upstream's crash regression expects the literal <IGNORE>: cmark-gfm asserts only that it terminates"
              );
              return;
            }
            const actual = normalizeHtml(
              renderHtml(parseBlocks(example.markdown, { dialect: "gfm" }).root, { gfm: true })
            );
            assert.strictEqual(actual, normalizeHtml(example.html));
          });
        }
      });
    }
  });
};

describe("GFM conformance: gfm parse, rendered in the writer's gfm mode so the tagfilter applies, against normalized HTML", () => {
  runCorpus("spec.txt extension sections", loadGfmSpecExtensionExamples(), SPEC_SECTIONS_GREEN, 22);
  runCorpus("extensions.txt", loadGfmExtensionsExamples(), EXTENSIONS_SECTIONS_GREEN, 30);
});
