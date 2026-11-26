import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import { loadSpecExamples } from "../support/corpus.ts";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";
import type { SpecExample } from "../support/corpus.ts";

const SECTIONS_GREEN: ReadonlyArray<string> = [
  "Tabs",
  "Backslash escapes",
  "Entity and numeric character references",
  "Precedence",
  "Thematic breaks",
  "ATX headings",
  "Setext headings",
  "Indented code blocks",
  "Fenced code blocks",
  "HTML blocks",
  "Link reference definitions",
  "Paragraphs",
  "Blank lines",
  "Block quotes",
  "List items",
  "Lists",
  "Inlines",
  "Code spans",
  "Emphasis and strong emphasis",
  "Links",
  "Images",
  "Autolinks",
  "Raw HTML",
  "Hard line breaks",
  "Soft line breaks",
  "Textual content",
];

const bySection = (examples: ReadonlyArray<SpecExample>): Record<string, ReadonlyArray<SpecExample>> =>
  A.groupBy(examples, (example) => example.section);

const examples = loadSpecExamples();
const sections = bySection(examples);

describe("CommonMark 0.31.2 conformance", () => {
  describe("gate", () => {
    it("allowlists only sections the corpus actually has", () => {
      for (const section of SECTIONS_GREEN) {
        assert.isTrue(R.has(sections, section), `SECTIONS_GREEN names a section the corpus does not: ${section}`);
      }
    });

    it("runs every section the corpus has", () => {
      for (const section of R.keys(sections)) {
        assert.isTrue(
          A.contains(SECTIONS_GREEN, section),
          `the corpus has a section the harness does not run, so a dialect could quietly drop its coverage: ${section}`
        );
      }
    });
  });

  for (const [section, sectionExamples] of R.toEntries(sections)) {
    describe(section, () => {
      for (const example of sectionExamples) {
        it(`example ${example.example}`, () => {
          const actual = normalizeHtml(renderHtml(parseBlocks(example.markdown).root));
          assert.strictEqual(actual, normalizeHtml(example.html));
        });
      }
    });
  }
});
