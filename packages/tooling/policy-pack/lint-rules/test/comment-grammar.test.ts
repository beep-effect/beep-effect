import {
  attachmentOf,
  BannedCommentKind,
  CommentGrammarInput,
  classifyComments,
  commentLawMessage,
  isBannedCommentKind,
  makeAttachmentIndex,
  normalizeCommentText,
  SourceComment,
} from "@beep/lint-rules/comment-grammar";
import plugin from "@beep/lint-rules/oxlint";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { parseSync } from "oxc-parser";

const parse = (source: string, file = "fixture.ts") => {
  const parsed = parseSync(file, source, { sourceType: "module" });
  const comments = A.map(parsed.comments, (comment) =>
    SourceComment.make({ type: comment.type, value: comment.value, start: comment.start, end: comment.end })
  );
  return { program: parsed.program, comments };
};

const classify = (source: string, file = "fixture.ts") => {
  const { program, comments } = parse(source, file);
  return classifyComments(CommentGrammarInput.make({ source, program, comments }));
};

const kindsOf = (source: string, file = "fixture.ts") => A.map(classify(source, file), (comment) => comment.kind);

const kindOfOnly = (source: string, file = "fixture.ts") => {
  const kinds = kindsOf(source, file);
  expect(kinds).toHaveLength(1);
  return kinds[0];
};

const offsetOf = (source: string, needle: string): number => O.getOrThrow(Str.indexOf(needle)(source));

const afterCode = (comment: string) => `export const first = 0;\n${comment}\nexport const after = 1;\n`;

describe("comment grammar", () => {
  it("returns nothing for a file without comments", () => {
    expect(kindsOf("export const a = 1;\n")).toEqual([]);
  });

  it("classifies a shebang reported by the parser or found at offset zero", () => {
    const source = "#!/usr/bin/env node\nexport const a = 1;\n";
    const program = parse(source).program;
    const shebang = SourceComment.make({ type: "Shebang", value: "/usr/bin/env node", start: 0, end: 19 });
    const atZero = SourceComment.make({ type: "Line", value: "/usr/bin/env node", start: 0, end: 19 });
    const kinds = A.map(
      [shebang, atZero],
      (comment) => classifyComments(CommentGrammarInput.make({ source, program, comments: [comment] }))[0]?.kind
    );
    expect(kinds).toEqual(["shebang", "shebang"]);
  });

  it.each([
    "// @ts-expect-error the fixture is untyped",
    "// @ts-nocheck",
    "// @ts-check",
    "// biome-ignore lint/style: fixture",
    "// biome-ignore-all lint/style: fixture",
    "// fallow-ignore-next-line unused-export",
    "// fallow-ignore-file unused-export",
    "// @vitest-environment jsdom",
    "/* istanbul ignore next */",
    "/* v8 ignore start */",
    "// node:coverage ignore next",
    "/*#__PURE__*/",
    "/* @__NO_SIDE_EFFECTS__ */",
    "/* @vite-ignore */",
    '/* webpackChunkName: "chunk" */',
    "/** @jsxImportSource react */",
    "//# sourceMappingURL=fixture.js.map",
    "/* sql */",
    "// @effect-diagnostics floatingEffect:off",
    "// nosemgrep: rule",
    "// gitleaks:allow",
    '/// <reference types="node" />',
    "// oxlint-disable-next-line no-console -- the fixture prints",
  ])("classifies %s as a directive", (comment) => {
    expect(kindOfOnly(afterCode(comment))).toBe("directive");
  });

  it.each([
    ["/* oxlint-disable */", "law-disable"],
    ["// oxlint-disable-next-line beep/no-comments -- hide", "law-disable"],
    ["// eslint-disable-line beep/no-comments, no-console", "law-disable"],
    ["// oxlint-disable-next-line no-console", "bad-suppression"],
    ["// oxlint-disable-next-line no-console --  ", "bad-suppression"],
    ["// oxlint-disable no-console -- for the file", "bad-suppression"],
    ["// oxlint-enable no-console", "bad-suppression"],
    ["// eslint-disable-next-line no-console -- reason", "bad-suppression"],
    ["// @ts-ignore", "bad-suppression"],
  ] as const)("classifies %s as %s", (comment, kind) => {
    expect(kindOfOnly(afterCode(comment))).toBe(kind);
  });

  it("accepts a trailing gitleaks marker and rejects one on its own line", () => {
    expect(kindOfOnly('export const key = "fixture"; // the fixture key gitleaks:allow\n')).toBe("directive");
    expect(kindOfOnly(afterCode("// the fixture key gitleaks:allow"))).toBe("prose");
  });

  it("classifies a leading licence run and leaves a later run as prose", () => {
    const source = A.join(
      [
        "/* Copyright 2026 Fixture Authors */",
        "// SPDX-License-Identifier: MIT",
        "",
        "// a separate leading note",
        "export const a = 1;",
        "// Copyright 2026 after the code",
        "",
      ],
      "\n"
    );
    expect(kindsOf(source)).toEqual(["license", "license", "prose", "prose"]);
  });

  it("classifies provenance, port markers and decision pointers anywhere", () => {
    expect(kindOfOnly(afterCode("// Ported from upstream/fixture.ts"))).toBe("provenance");
    expect(kindOfOnly(afterCode("// beep: keep-export"))).toBe("port-marker");
    expect(kindOfOnly(afterCode("// decision: comment-law-scope"))).toBe("decision-pointer");
    expect(kindOfOnly(afterCode("/* decision: comment-law-scope */"))).toBe("prose");
    expect(kindOfOnly(afterCode("// decision: Not A Slug"))).toBe("prose");
  });

  it("classifies a generated header only before the first statement", () => {
    expect(kindOfOnly("// @generated by the fixture\nexport const a = 1;\n")).toBe("generated-header");
    expect(kindOfOnly(afterCode("// Code generated by fixture-gen"))).toBe("prose");
  });

  it("classifies line prose, plain blocks and non-JSDoc stars as prose", () => {
    expect(kindsOf(afterCode("// explains the next line\n/* a block note */\n/***/\n/*** banner ***/"))).toEqual([
      "prose",
      "prose",
      "prose",
      "prose",
    ]);
  });

  it("classifies a leading JSDoc block as a module header by tag or by the first statement", () => {
    expect(kindOfOnly("/**\n * Fixture module.\n *\n * @packageDocumentation\n */\nconst a = 1;\n")).toBe(
      "jsdoc-module"
    );
    expect(kindOfOnly('/** Fixture module. */\nimport * as A from "effect/Array";\nA;\n')).toBe("jsdoc-module");
    expect(kindOfOnly('/** Fixture module. */\nexport * from "./other.ts";\n')).toBe("jsdoc-module");
    expect(kindOfOnly('/** Fixture module. */\n"use client";\n')).toBe("jsdoc-module");
  });

  it("classifies JSDoc on exports by keyword, specifier, default, assignment and decorator", () => {
    expect(kindOfOnly(afterCode("/** Documents an export. */"))).toBe("jsdoc-export");
    expect(kindOfOnly("export const first = 0;\n/** Named later. */\nconst named = 1;\nexport { named };\n")).toBe(
      "jsdoc-export"
    );
    expect(kindOfOnly("const first = 0;\nexport { /** On the specifier. */ first };\n")).toBe("jsdoc-export");
    expect(kindOfOnly("export const first = 0;\n/** The default. */\nfunction main() {}\nexport default main;\n")).toBe(
      "jsdoc-export"
    );
    expect(kindOfOnly("export const first = 0;\n/** The default. */\nexport default function () {}\n")).toBe(
      "jsdoc-export"
    );
    expect(kindOfOnly("const first = 0;\n/** Assigned. */\nclass Assigned {}\nexport = Assigned;\n")).toBe(
      "jsdoc-export"
    );
    expect(
      kindOfOnly(
        "export const first = 0;\nconst dec = (x: unknown) => x;\n/** Decorated. */\n@dec\nexport class K {}\n"
      )
    ).toBe("jsdoc-export");
    expect(
      kindsOf("export const first = 0;\n/** Documents an export. */\n// a note between\nexport const a = 1;\n")
    ).toEqual(["jsdoc-export", "prose"]);
  });

  it("does not export a declaration named only by a re-export from another module", () => {
    expect(
      kindOfOnly('export const first = 0;\n/** Shadowed name. */\nconst other = 1;\nexport { other } from "./o.ts";\n')
    ).toBe("jsdoc-local");
    expect(kindOfOnly("export const first = 0;\n/** Not named. */\nconst { a } = { a: 1 };\nexport default 1;\n")).toBe(
      "jsdoc-local"
    );
  });

  it("classifies member JSDoc by its owner's export status", () => {
    expect(kindOfOnly("export class Owner {\n  /** A member. */\n  method() {}\n}\n")).toBe("jsdoc-member");
    expect(kindOfOnly("export interface Shape {\n  /** A field. */\n  readonly a: number;\n}\n")).toBe("jsdoc-member");
    expect(kindOfOnly("export const first = 0;\nclass Local {\n  /** A member. */\n  method() {}\n}\n")).toBe(
      "jsdoc-local"
    );
  });

  it("classifies local JSDoc as tagged when a tool reads its tag and local otherwise", () => {
    expect(kindOfOnly(Str.replace("export const after", "const after")(afterCode("/** @internal */")))).toBe(
      "jsdoc-tagged"
    );
    expect(kindOfOnly("export const first = 0;\n/** A local helper. */\nconst helper = 1;\n")).toBe("jsdoc-local");
  });

  it("uses a supplied attachment index instead of walking the program", () => {
    const source = "export const first = 0;\n/** Looks local. */\nconst helper = 1;\n";
    const { program, comments } = parse(source);
    const helperStart = offsetOf(source, "const helper");
    const index = makeAttachmentIndex(program);
    index.enter({ type: "ExportNamedDeclaration", start: helperStart, end: source.length });
    index.exit({ type: "ExportNamedDeclaration", start: helperStart, end: source.length });
    const attachment = index.result();
    const kinds = A.map(
      classifyComments(CommentGrammarInput.make({ source, program, comments, attachment })),
      (comment) => comment.kind
    );
    expect(kinds).toEqual(["jsdoc-export"]);
  });

  it("indexes export anchors, decorators and members with their owner's export status", () => {
    const source = A.join(
      [
        "const dec = (x: unknown) => x;",
        "@dec",
        "export class Exported {",
        "  method() {}",
        "}",
        "class Local {",
        "  method() {}",
        "}",
        "export { Local };",
        "class Hidden {",
        "  field = 1;",
        "}",
        "",
      ],
      "\n"
    );
    const attachment = attachmentOf(parse(source).program);
    const exportedMethod = offsetOf(source, "method");
    const hiddenField = offsetOf(source, "field");
    expect(HashSet.has(attachment.publicStarts, offsetOf(source, "@dec"))).toBe(true);
    expect(HashSet.has(attachment.publicStarts, offsetOf(source, "class Local"))).toBe(true);
    assertSome(HashMap.get(attachment.memberStarts, exportedMethod), true);
    assertSome(HashMap.get(attachment.memberStarts, hiddenField), false);
  });

  it("keeps the first export status recorded for a member", () => {
    const index = makeAttachmentIndex({ type: "Program", start: 0, end: 10 });
    const member = { type: "PropertyDefinition", start: 4, end: 8 };
    index.enter(member);
    index.enter({ type: "ExportNamedDeclaration", start: 0, end: 10 });
    index.enter(member);
    index.exit(member);
    index.exit({ type: "ExportNamedDeclaration", start: 0, end: 10 });
    index.exit({ type: "Identifier", start: 0, end: 1 });
    assertSome(HashMap.get(index.result().memberStarts, 4), false);
    expect(HashSet.has(index.result().publicStarts, 0)).toBe(true);
  });

  it("walks a plain tree past parent links, location fields and non-node objects", () => {
    const declaration = { type: "ClassDeclaration", start: 0, end: 9, extra: { raw: "class" } };
    const statement = {
      type: "ExportNamedDeclaration",
      start: 0,
      end: 9,
      declaration,
      range: [0, 9],
      loc: { start: 0 },
      parent: null,
    };
    const attachment = attachmentOf({ type: "Program", start: 0, end: 9, body: [statement] } as never);
    expect(HashSet.has(attachment.publicStarts, 0)).toBe(true);
  });

  it("treats every comment of a comment-only file as leading", () => {
    expect(kindsOf("// only a note\n")).toEqual(["prose"]);
    expect(kindsOf("// @generated by the fixture\n")).toEqual(["generated-header"]);
  });

  it("normalizes block decoration and whitespace", () => {
    expect(normalizeCommentText("*\n * Builds the\n *   request.\n ")).toBe("Builds the request.");
    expect(normalizeCommentText("  spaced\tline  ")).toBe("spaced line");
  });

  it("parses JavaScript and TSX dialects", () => {
    expect(kindsOf("// note\nexport const a = 1;\n", "fixture.js")).toEqual(["prose"]);
    expect(kindsOf("export const A = () => <div>{/* a note */}</div>;\n", "fixture.tsx")).toEqual(["prose"]);
  });

  it("names a message for every banned kind and bans only those kinds", () => {
    const messages = A.map(BannedCommentKind.literals, commentLawMessage);
    expect(A.every(messages, Str.startsWith("Rule: "))).toBe(true);
    expect(HashSet.size(HashSet.fromIterable(messages))).toBe(4);
    expect(isBannedCommentKind("prose")).toBe(true);
    expect(isBannedCommentKind("bad-suppression")).toBe(true);
    expect(isBannedCommentKind("directive")).toBe(false);
    expect(isBannedCommentKind("jsdoc-export")).toBe(false);
  });
});

type VisitorTable = Readonly<Record<string, ((node: unknown) => void) | undefined>>;

const SKIPPED_WALK_KEYS = HashSet.make("parent", "loc", "range");

const isTypedNode = (value: unknown): value is { readonly type: string } =>
  P.isObject(value) && P.hasProperty(value, "type") && P.isString(value.type);

const walkChildren = (visitors: VisitorTable, node: object): void => {
  for (const key in node) {
    const child: unknown = Reflect.get(node, key);
    if (!HashSet.has(SKIPPED_WALK_KEYS, key) && P.isObjectOrArray(child)) walkWith(visitors, child);
  }
};

const walkNode = (visitors: VisitorTable, node: { readonly type: string }): void => {
  visitors[node.type]?.(node);
  walkChildren(visitors, node);
  visitors[`${node.type}:exit`]?.(node);
};

const walkWith = (visitors: VisitorTable, value: unknown): void => {
  if (P.isIterable(value) && !P.isString(value)) {
    for (const item of value) walkWith(visitors, item);
    return;
  }
  if (isTypedNode(value)) walkNode(visitors, value);
};

const lintInProcess = (source: string) => {
  const { program, comments } = parse(source);
  const reports: Array<{ readonly message: string; readonly loc: unknown }> = [];
  const rule = plugin.rules["no-comments"];
  if (P.isUndefined(rule) || !("create" in rule)) throw new Error("Expected no-comments to expose create");
  const visitors = rule.create({
    cwd: "/repo",
    filename: "/repo/packages/example/src/fixture.ts",
    report: (finding: { readonly message: string; readonly loc: unknown }) => {
      reports.push(finding);
    },
    sourceCode: {
      text: source,
      getAllComments: () => comments,
      getLocFromIndex: (offset: number) => ({ line: 1, column: offset }),
    },
  } as never) as unknown as VisitorTable;
  walkWith(visitors, program);
  return reports;
};

describe("no-comments rule in process", () => {
  it("reports banned comments with the law message and skips exempt ones", () => {
    const reports = lintInProcess(
      A.join(
        [
          "/** Module docs. @packageDocumentation */",
          'import * as A from "effect/Array";',
          "// explains the next line",
          "export class Owner {",
          "  /** A member. */",
          "  method() {}",
          "}",
          "/** A local helper. */",
          "const helper = A.empty();",
          "/** Named later. */",
          "const named = helper;",
          "export { named };",
          "// @ts-ignore",
          "",
        ],
        "\n"
      )
    );
    expect(A.map(reports, (report) => report.message)).toEqual([
      commentLawMessage("prose"),
      commentLawMessage("jsdoc-local"),
      commentLawMessage("bad-suppression"),
    ]);
    expect(reports[0]?.loc).toEqual({ start: { line: 1, column: 77 }, end: { line: 1, column: 102 } });
  });

  it("reports nothing for a file whose comments are all exempt", () => {
    expect(lintInProcess("/** Documents an export. */\nexport const a = 1;\n")).toEqual([]);
  });
});
