import {
  fencedLineState,
  JSDocSection,
  jsDocSectionBodyText,
  jsDocSectionOrder,
  jsdocCommentsFromSource,
  jsdocOwnersByStart,
  ownJSDocNodeName,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
  rawJSDocSpans,
} from "@beep/repo-cli/test/Docgen";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { Project } from "ts-morph";

const lines = (...values: ReadonlyArray<string>): string => A.join(values, "\n");

const sourceFile = (text: string) =>
  new Project({ useInMemoryFileSystem: true }).createSourceFile("fixture.ts", text, { overwrite: true });

describe("fencedLineState", () => {
  it("opens, keeps, and closes a backtick fence in both call forms", () => {
    const [open, openFenced] = fencedLineState("```ts", undefined);
    expect([open, openFenced]).toEqual(["```", true]);
    expect(fencedLineState("plain prose", undefined)).toEqual([undefined, false]);
    expect(fencedLineState("inside code", "```")).toEqual(["```", true]);
    expect(fencedLineState("````", "```")).toEqual([undefined, true]);
    expect(fencedLineState("```")("```")).toEqual([undefined, true]);
  });

  it("does not close on a shorter, different, or info-string fence", () => {
    expect(fencedLineState("```", "````")).toEqual(["````", true]);
    expect(fencedLineState("```", "~~~")).toEqual(["~~~", true]);
    expect(fencedLineState("```ts", "```")).toEqual(["```", true]);
    expect(fencedLineState("~~~", "~~~")).toEqual([undefined, true]);
  });
});

describe("jsdocCommentsFromSource and rawJSDocSpans", () => {
  it("extracts line-leading blocks and ignores closers inside fenced examples", () => {
    const source = lines(
      "/**",
      " * Doc with a fence.",
      " *",
      " * ```ts",
      ' * const closer = "*/"',
      " * ```",
      " */",
      "export const a = 1",
      "\t/** Tabbed. */",
      "/***/",
      ""
    );
    const comments = jsdocCommentsFromSource(source);
    expect(comments.length).toBe(3);
    expect(comments[0]).toContain('const closer = "*/"');
    expect(comments[1]).toBe("/** Tabbed. */");
    expect(comments[2]).toBe("/***/");
  });

  it("skips trailing and implausible openers", () => {
    const source = lines(
      "const a = 1; /** trailing */",
      "/**not-jsdoc */",
      "/**\r",
      " * CRLF doc.\r",
      " */",
      "/**\t*/"
    );
    const comments = jsdocCommentsFromSource(source);
    expect(comments).toEqual(["/**\r\n * CRLF doc.\r\n */", "/**\t*/"]);
  });

  it("runs an unterminated block and a bare opener to the end of the source", () => {
    expect(jsdocCommentsFromSource("/**")).toEqual(["/**"]);
    expect(jsdocCommentsFromSource(lines("/**", " * never closed"))).toEqual([lines("/**", " * never closed")]);
    expect(jsdocCommentsFromSource("const a = 1")).toEqual([]);
  });

  it("locates exact offsets for repeated identical blocks", () => {
    const source = lines("/** Same. */", "const a = 1", "/** Same. */", "const b = 2");
    const spans = rawJSDocSpans(source);
    expect(A.map(spans, (span) => [span.start, span.end])).toEqual([
      [0, 12],
      [25, 37],
    ]);
    expect(A.map(spans, (span) => Str.slice(span.start, span.end)(source))).toEqual(["/** Same. */", "/** Same. */"]);
  });
});

describe("ownJSDocNodeName and jsdocOwnersByStart", () => {
  it("names the owner of every documented declaration kind", () => {
    const source = sourceFile(
      lines(
        "/** Var. */",
        "export const value = 1",
        "/** Fn. */",
        "export function fn(): void {}",
        "/** Klass. */",
        "export class Klass {",
        "  /** Ctor. */",
        "  constructor() {}",
        "  /** Prop. */",
        "  prop = 1",
        "  /** Method. */",
        "  method(): void {}",
        "  /** Getter. */",
        "  get got(): number { return 1 }",
        "  /** Setter. */",
        "  set got(_: number) {}",
        "}",
        "/** Iface. */",
        "export interface Iface {",
        "  /** Sig prop. */",
        "  readonly sigProp: number",
        "  /** Sig method. */",
        "  sigMethod(): void",
        "}",
        "/** Alias. */",
        "export type Alias = string",
        "/** Enum. */",
        "export enum Color {",
        "  /** Red. */",
        "  Red,",
        "}",
        "/** Space. */",
        "export namespace Space {}",
        "const {",
        "  /** Bound. */",
        "  bound,",
        "} = { bound: 1 }",
        "/** Default. */",
        "export default value",
        ""
      )
    );
    const owners = jsdocOwnersByStart(source);
    const names = pipe(
      MutableHashMap.values(owners),
      A.fromIterable,
      A.map(ownJSDocNodeName),
      A.getSomes,
      A.sort(Order.String)
    );
    expect(names).toEqual(
      A.sort(
        [
          "<default>",
          "Alias",
          "Color",
          "Iface",
          "Klass",
          "Red",
          "Space",
          "bound",
          "constructor",
          "fn",
          "got",
          "got",
          "method",
          "prop",
          "sigMethod",
          "sigProp",
          "value",
        ],
        Order.String
      )
    );
  });

  it("falls back to <default> for anonymous default declarations and none for other nodes", () => {
    const fnSource = sourceFile(lines("/** Anon fn. */", "export default function () {}"));
    expect(O.getOrUndefined(O.flatMap(O.fromUndefinedOr(fnSource.getFunctions()[0]), ownJSDocNodeName))).toBe(
      "<default>"
    );
    const classSource = sourceFile(lines("/** Anon class. */", "export default class {}"));
    expect(O.getOrUndefined(O.flatMap(O.fromUndefinedOr(classSource.getClasses()[0]), ownJSDocNodeName))).toBe(
      "<default>"
    );
    const declaration = sourceFile("const loose = 1").getVariableDeclarationOrThrow("loose");
    expect(O.getOrUndefined(ownJSDocNodeName(declaration))).toBe("loose");
    assertNone(ownJSDocNodeName(fnSource));
  });

  it("keeps the first owner for a doc shared by a statement and its declaration", () => {
    const source = sourceFile(lines("/** Shared. */", "export const shared = 1"));
    const owners = jsdocOwnersByStart(source);
    expect(MutableHashMap.size(owners)).toBe(1);
    expect(O.getOrUndefined(O.flatMap(MutableHashMap.get(owners, 0), ownJSDocNodeName))).toBe("shared");
  });
});

describe("parseJSDocSections", () => {
  it("parses titled sections, stops at the first tag, and masks fenced headings", () => {
    const parsed = parseJSDocSections(
      ParseJSDocSectionsOptions.make({
        commentText: lines(
          "/**",
          " * Lead.",
          " *",
          " * **When to use**",
          " *",
          " * Sometimes.",
          " *",
          " * **Example** ( Run it )",
          " *",
          " * ```ts",
          " * **Details**",
          " * ```",
          " *",
          " * ~~~ts",
          " * ~~~",
          " *",
          " * @since 0.0.0",
          " */"
        ),
      })
    );
    expect(A.map(parsed.sections, (section) => section.name)).toEqual(["When to use", "Example"]);
    expect(parsed.sections[0]?.title).toBeUndefined();
    expect(parsed.sections[1]?.title).toBe("Run it");
    expect(parsed.sections[0]?.lineOffset).toBe(3);
    expect(O.getOrUndefined(O.map(O.fromUndefinedOr(parsed.sections[0]), jsDocSectionBodyText))).toBe(
      lines("", "Sometimes.", "")
    );
    expect(parsed.bodyLines).not.toContain("@since 0.0.0");
  });

  it("parses a comment without sections or tags", () => {
    const parsed = parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText: "/** Only lead. */" }));
    expect(parsed.sections).toEqual([]);
    expect(parsed.bodyLines).toEqual([" Only lead."]);
  });

  it("orders prose sections and renders a constructed section body", () => {
    expect(jsDocSectionOrder["When to use"]).toBeLessThan(jsDocSectionOrder.Details);
    expect(jsDocSectionOrder.Details).toBeLessThan(jsDocSectionOrder.Gotchas);
    const section = JSDocSection.make({ name: "Gotchas", lineOffset: 0, body: ["One.", "Two."] });
    expect(jsDocSectionBodyText(section)).toBe("One.\nTwo.");
  });
});
