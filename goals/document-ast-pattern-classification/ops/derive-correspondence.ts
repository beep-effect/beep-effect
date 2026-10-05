/**
 * Derives the PO correspondence report from the live schemas and codecs.
 *
 * Run from the repository root:
 *
 *   bun run goals/document-ast-pattern-classification/ops/derive-correspondence.ts \
 *     > goals/document-ast-pattern-classification/research/CORRESPONDENCE.md
 *
 * Every row is computed: patterns come from the `po` schema annotations, edges
 * come from executing the Pandoc and Lexical codecs on schema-derived samples,
 * and evidence names the existing diagnostic that accompanied each demotion.
 * Nothing in the output is hand-maintained.
 */

import { blockToLexical, nodeToBlocks } from "@beep/lexical-schema/Lexical.codec";
import { LexicalNode, QuoteNode, SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import * as Md from "@beep/md/Md.model";
import { documentToPandoc, pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import * as Pandoc from "@beep/pandoc-ast/Pandoc.model";
import * as PatternOntology from "@beep/schema/PatternOntology";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { PandocMappingIssue } from "@beep/pandoc-ast/Pandoc.report";
import type * as S from "effect/Schema";

const { collectPoTaggedConstructors, getPoPattern, poConservation, poPatternAxes } = PatternOntology;

const SAMPLES = 40;

const patternOf = (schema: S.Top): string => O.getOrElse(getPoPattern(schema), () => "?");
const sample = <T>(schema: S.Codec<T, unknown>): ReadonlyArray<T> =>
  Effect.runSync(Effect.orDie(Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: SAMPLES, seed: 2026 })));

type Edge = {
  readonly source: string;
  readonly sourcePattern: string;
  readonly target: string;
  readonly targetPattern: string;
  readonly conservation: string;
  evidence: ReadonlyArray<string>;
  count: number;
};

let edges = MutableHashMap.empty<string, Edge>();

const addEdge = (input: Omit<Edge, "count" | "evidence"> & { readonly evidence: ReadonlyArray<string> }): void => {
  const key = `${input.source}|${input.target}`;
  O.match(MutableHashMap.get(edges, key), {
    onNone: () => MutableHashMap.set(edges, key, { ...input, count: 1 }),
    onSome: (edge) => {
      edge.count += 1;
      edge.evidence = A.dedupe([...edge.evidence, ...input.evidence]);
    },
  });
};

// Only the issue recorded at the construct's own path explains its transition;
// nested child issues belong to the child rows. Future-constructor names are
// arbitrary wire strings, so they collapse to one label.
const DROPPED = "∅ (dropped)";
const NO_DIAGNOSTIC = "no diagnostic emitted";

const addDroppedEdge = (source: string, sourcePattern: string, evidence: ReadonlyArray<string>): void =>
  addEdge({ source, sourcePattern, target: DROPPED, targetPattern: "—", conservation: "demoted", evidence });

const issuesUnder = (issues: ReadonlyArray<PandocMappingIssue.Type>, prefix: ReadonlyArray<string | number>) =>
  A.map(
    A.filter(
      issues,
      (issue) =>
        issue.path.length === prefix.length && A.every(prefix, (segment, index) => issue.path[index] === segment)
    ),
    (issue) =>
      `${/^(Image|SoftBreak|Underline|Superscript|Subscript|SmallCaps|Quoted|Cite|Code|Link|Span|Note|Math|RawInline|Header|Para|LineBlock|CodeBlock|RawBlock|OrderedList|DefinitionList|Div|Table|Figure|FootnoteReference|TaskList|YouTube|FootnoteDefinition|Admonition|Embed|Meta)$/.test(issue.construct) ? issue.construct : "future constructor"} (${issue.severity})`
  );

const flushEdges = (title: string, lines: Array<string>): void => {
  lines.push(
    `### ${title}`,
    "",
    "| Source | Pattern | Target | Pattern | Conservation | Evidence | Samples |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  );
  const rows = A.sort(
    A.map(A.fromIterable(edges), ([, edge]) => edge),
    (a: Edge, b: Edge) =>
      a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0
  );
  for (const edge of rows) {
    // Loss diagnostics are shown even when the pattern is preserved: pattern
    // conservation never implies a lossless conversion. This script observes
    // diagnostics only; it never consults the declared tables in the tests, so
    // a demotion without one is reported as exactly that.
    const evidence = A.isReadonlyArrayNonEmpty(edge.evidence)
      ? A.join(edge.evidence, "; ")
      : edge.conservation === "preserved"
        ? "—"
        : NO_DIAGNOSTIC;
    lines.push(
      `| \`${edge.source}\` | ${edge.sourcePattern} | \`${edge.target}\` | ${edge.targetPattern} | ${edge.conservation} | ${evidence} | ${edge.count} |`
    );
  }
  lines.push("");
  edges = MutableHashMap.empty<string, Edge>();
};

const inventory = (title: string, schema: S.Top, tagKey: string, lines: Array<string>): void => {
  lines.push(
    `### ${title}`,
    "",
    "| Tag | Identifier | Pattern | Textual | Structured | Contained in |",
    "| --- | --- | --- | --- | --- | --- |"
  );
  for (const row of collectPoTaggedConstructors(schema, tagKey)) {
    const pattern = O.getOrElse(row.pattern, () => "?");
    const axes = O.map(row.pattern, poPatternAxes);
    lines.push(
      `| \`${row.tag}\` | \`${O.getOrElse(row.identifier, () => "")}\` | ${pattern} | ${O.match(axes, { onNone: () => "", onSome: (a) => String(a.textual) })} | ${O.match(axes, { onNone: () => "", onSome: (a) => String(a.structured) })} | ${O.match(axes, { onNone: () => "", onSome: (a) => a.containedIn })} |`
    );
  }
  lines.push("");
};

const lines: Array<string> = [
  "# Derived PO correspondence report",
  "",
  "Generated by `ops/derive-correspondence.ts` from the live `po` annotations and codecs.",
  `Edges are observed over ${SAMPLES} schema-derived samples per constructor (seed 2026).`,
  "Do not edit by hand; regenerate after any annotation or codec change.",
  "",
  "Evidence is what the codec emitted for that construct: a `PandocMappingIssue` at its own path,",
  "or `no diagnostic emitted`. A demoted row without a diagnostic is legal only when the package",
  "pattern tests declare it (`Pandoc.pattern-ontology.test.ts`, `Lexical.pattern-ontology.test.ts`);",
  "those tests, not this report, fail on an undeclared transition. The Lexical codec has no issue",
  "channel, so every Lexical demotion reads `no diagnostic emitted` and is governed by the README",
  "lossiness profile.",
  "",
  "## Inventory",
  "",
];

inventory("@beep/md (`_tag`)", Md.Document, "_tag", lines);
inventory("@beep/pandoc-ast (`_tag`)", Pandoc.PandocDocument, "_tag", lines);
inventory("@beep/lexical-schema (`type`)", SerializedEditorState, "type", lines);

lines.push("## Correspondence and conservation", "");

for (const [tag, member] of R.toEntries(Pandoc.PandocBlock.cases)) {
  for (const block of sample(member)) {
    const result = Effect.runSync(pandocToDocument(Pandoc.PandocDocument.make({ blocks: [block], meta: {} })));
    const target = O.getOrThrow(A.head(result.document.children));
    const targetPattern = patternOf(Md.Block.cases[target._tag]);
    addEdge({
      source: tag,
      sourcePattern: patternOf(member),
      target: target._tag,
      targetPattern,
      conservation: poConservation(patternOf(member) as never, targetPattern as never),
      evidence: issuesUnder(result.report.issues, ["blocks", 0]),
    });
  }
}
flushEdges("Pandoc → Md blocks", lines);

for (const [tag, member] of R.toEntries(Pandoc.PandocInline.cases)) {
  for (const inline of sample(member)) {
    const result = Effect.runSync(
      pandocToDocument(Pandoc.PandocDocument.make({ blocks: [Pandoc.Para.make({ children: [inline] })], meta: {} }))
    );
    const paragraph = O.getOrThrow(A.head(result.document.children));
    const evidence = issuesUnder(result.report.issues, ["blocks", 0, "children", 0]);
    const targets = paragraph._tag === "p" ? paragraph.children : [];
    if (paragraph._tag === "p" && !A.isReadonlyArrayNonEmpty(targets)) {
      addDroppedEdge(tag, patternOf(member), evidence);
    }
    if (paragraph._tag !== "p") {
      addEdge({
        source: `para[${tag}]`,
        sourcePattern: "block",
        target: paragraph._tag,
        targetPattern: patternOf(Md.Block.cases[paragraph._tag]),
        conservation: poConservation("block", patternOf(Md.Block.cases[paragraph._tag]) as never),
        evidence,
      });
    }
    for (const target of targets) {
      const targetPattern = patternOf(Md.Inline.cases[target._tag]);
      addEdge({
        source: tag,
        sourcePattern: patternOf(member),
        target: target._tag,
        targetPattern,
        conservation: poConservation(patternOf(member) as never, targetPattern as never),
        evidence,
      });
    }
  }
}
flushEdges("Pandoc → Md inlines", lines);

for (const [tag, member] of R.toEntries(Md.Block.cases)) {
  for (const block of sample(member)) {
    const result = Effect.runSync(documentToPandoc(Md.Document.make({ children: [block] })));
    const target = O.getOrThrow(A.head(result.pandoc.blocks));
    const targetPattern = patternOf(Pandoc.PandocBlock.cases[target._tag]);
    addEdge({
      source: tag,
      sourcePattern: patternOf(member),
      target: target._tag,
      targetPattern,
      conservation: poConservation(patternOf(member) as never, targetPattern as never),
      evidence: issuesUnder(result.report.issues, ["children", 0]),
    });
  }
}
flushEdges("Md → Pandoc blocks", lines);

for (const [tag, member] of R.toEntries(Md.Inline.cases)) {
  for (const inline of sample(member)) {
    const result = Effect.runSync(
      documentToPandoc(Md.Document.make({ children: [Md.P.make({ children: [inline] })] }))
    );
    const paragraph = O.getOrThrow(A.head(result.pandoc.blocks));
    const evidence = issuesUnder(result.report.issues, ["children", 0, "children", 0]);
    const targets = paragraph._tag === "para" ? paragraph.children : [];
    if (!A.isReadonlyArrayNonEmpty(targets)) {
      addDroppedEdge(tag, patternOf(member), evidence);
    }
    for (const target of targets) {
      const targetPattern = patternOf(Pandoc.PandocInline.cases[target._tag]);
      addEdge({
        source: tag,
        sourcePattern: patternOf(member),
        target: target._tag,
        targetPattern,
        conservation: poConservation(patternOf(member) as never, targetPattern as never),
        evidence,
      });
    }
  }
}
flushEdges("Md → Pandoc inlines", lines);

for (const [tag, member] of R.toEntries(Md.Block.cases)) {
  for (const block of sample(member)) {
    const target = Effect.runSync(blockToLexical(block));
    const targetPattern = patternOf(LexicalNode.cases[target.type]);
    addEdge({
      source: tag,
      sourcePattern: patternOf(member),
      target: target.type,
      targetPattern,
      conservation: poConservation(patternOf(member) as never, targetPattern as never),
      evidence: [],
    });
  }
}
flushEdges("Md → Lexical blocks (README lossiness profile is the explicit record)", lines);

for (const [tag, member] of R.toEntries(Md.Inline.cases)) {
  for (const inline of sample(member)) {
    const paragraph = Effect.runSync(blockToLexical(Md.P.make({ children: [inline] })));
    const targets = paragraph.type === "paragraph" ? paragraph.children : [];
    if (!A.isReadonlyArrayNonEmpty(targets)) {
      addDroppedEdge(tag, patternOf(member), []);
    }
    for (const target of targets) {
      const targetPattern = patternOf(LexicalNode.cases[target.type]);
      addEdge({
        source: tag,
        sourcePattern: patternOf(member),
        target: target.type,
        targetPattern,
        conservation: poConservation(patternOf(member) as never, targetPattern as never),
        evidence: [],
      });
    }
  }
}
flushEdges("Md → Lexical inlines (README lossiness profile is the explicit record)", lines);

for (const [type, member] of R.toEntries(LexicalNode.cases)) {
  if (type === "root") continue;
  for (const node of sample(member)) {
    // A quote is multi-pattern: report the shadow-root instance separately.
    const shadowQuote = node.type === "quote" && QuoteNode.poPatternOf(node) === "container";
    const source = shadowQuote ? "quote (shadow-root)" : type;
    const sourcePattern = node.type === "quote" ? QuoteNode.poPatternOf(node) : patternOf(member);
    const blocks = nodeToBlocks(node);
    if (!A.isReadonlyArrayNonEmpty(blocks)) {
      addDroppedEdge(source, sourcePattern, []);
    }
    for (const target of blocks) {
      const targetPattern = patternOf(Md.Block.cases[target._tag]);
      addEdge({
        source,
        sourcePattern,
        target: target._tag,
        targetPattern,
        conservation: poConservation(sourcePattern as never, targetPattern as never),
        evidence: [],
      });
    }
  }
}
flushEdges("Lexical → Md nodes (loose leaves wrap into `p` by the codec's documented rule)", lines);

const mdFieldOnly = { li: Md.Li, taskItem: Md.TaskItem, tableRow: Md.TableRow, tableCell: Md.TableCell };
type MdFieldOnlyNode = Md.Li | Md.TaskItem | Md.TableRow | Md.TableCell;
const inPlaceTargets: Readonly<Record<string, ReadonlyArray<string>>> = {
  listitem: ["li", "taskItem"],
  tablerow: ["tableRow"],
  tablecell: ["tableCell"],
};
const mdFieldOnlyChildren = (block: Md.Block): ReadonlyArray<MdFieldOnlyNode> =>
  block._tag === "ul" || block._tag === "ol" || block._tag === "taskList"
    ? block.children
    : block._tag === "table"
      ? A.flatMap(block.children, (row): ReadonlyArray<MdFieldOnlyNode> => [row, ...row.children])
      : [];
const lexicalStructuralChildren = (node: LexicalNode): ReadonlyArray<LexicalNode> =>
  node.type === "list"
    ? node.children
    : node.type === "table"
      ? A.flatMap(node.children, (row): ReadonlyArray<LexicalNode> => [row, ...("children" in row ? row.children : [])])
      : [];

for (const member of [Md.Ul, Md.Ol, Md.TaskList, Md.Table]) {
  for (const block of sample(member)) {
    const node = Effect.runSync(blockToLexical(block));
    const targets = A.filter(lexicalStructuralChildren(node), (target) => target.type in inPlaceTargets);
    for (const source of mdFieldOnlyChildren(block)) {
      for (const target of A.filter(targets, (candidate) =>
        A.contains(inPlaceTargets[candidate.type] ?? [], source._tag)
      )) {
        const sourcePattern = patternOf(mdFieldOnly[source._tag]);
        const targetPattern = patternOf(LexicalNode.cases[target.type]);
        addEdge({
          source: source._tag,
          sourcePattern,
          target: target.type,
          targetPattern,
          conservation: poConservation(sourcePattern as never, targetPattern as never),
          evidence: [],
        });
      }
    }
    const returned = A.flatMap(nodeToBlocks(node), mdFieldOnlyChildren);
    for (const source of targets) {
      for (const target of A.filter(returned, (candidate) =>
        A.contains(inPlaceTargets[source.type] ?? [], candidate._tag)
      )) {
        const sourcePattern = patternOf(LexicalNode.cases[source.type]);
        const targetPattern = patternOf(mdFieldOnly[target._tag]);
        addEdge({
          source: `${source.type} (in place)`,
          sourcePattern,
          target: target._tag,
          targetPattern,
          conservation: poConservation(sourcePattern as never, targetPattern as never),
          evidence: [],
        });
      }
    }
  }
}
flushEdges("Field-only constructors in place (Md ↔ Lexical lists and tables)", lines);

lines.push(
  "### Field-only constructors and Pandoc",
  "",
  "Pandoc list items and table cells are untagged payloads (`[Block]` arrays and the table payload),",
  "so Md `li`, `taskItem`, `tableRow`, and `tableCell` have no Pandoc constructor to correspond to.",
  "They are covered through their parent rows above: lists conserve `table`, and Md tables demote",
  "as a whole with a `Table` issue.",
  ""
);

process.stdout.write(`${A.join(lines, "\n")}\n`);
