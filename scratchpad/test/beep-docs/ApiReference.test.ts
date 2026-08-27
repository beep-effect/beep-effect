import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ReflectionKind } from "typedoc";
import * as ApiReference from "../../beep-docs/api-reference/ApiReference.ts";
import * as CodeSnippet from "../../beep-docs/api-reference/CodeSnippet.ts";
import {
  ModulePathFromExportPath,
  PackageSlugFromPackageName,
  TypeDocProjectReflection,
} from "../../beep-docs/domain/ApiReference.ts";
import {
  BlogStagedSearchMetadata,
  DocumentationSearchMetadata,
  SearchMetadata,
  StagedSearchMetadata,
} from "../../beep-docs/domain/SearchMetadata.ts";

const decodeReflection = S.decodeUnknownSync(TypeDocProjectReflection);

const numberModule = decodeReflection({
  schemaVersion: "2.0",
  id: 1,
  name: "effect/Number",
  variant: "project",
  kind: ReflectionKind.Project,
  flags: {},
  children: [
    {
      id: 2,
      name: "Number",
      variant: "declaration",
      kind: ReflectionKind.Module,
      flags: {},
      children: [
        {
          id: 3,
          name: "parse",
          variant: "declaration",
          kind: ReflectionKind.Function,
          flags: {},
          signatures: [
            {
              id: 6,
              name: "parse",
              variant: "signature",
              kind: ReflectionKind.CallSignature,
              flags: {},
              parameters: [
                {
                  id: 7,
                  name: "input",
                  variant: "param",
                  kind: ReflectionKind.Parameter,
                  flags: {},
                  type: { type: "intrinsic", name: "string" },
                },
              ],
              type: { type: "intrinsic", name: "number" },
            },
          ],
          comment: {
            summary: [
              { kind: "text", text: "Parses a number.\n\n**Example** (Parse ten)\n\n" },
              { kind: "code", text: '```ts\nconsole.log(parse("10"))\n```' },
            ],
            blockTags: [
              { tag: "@category", content: [{ kind: "text", text: "parsing" }] },
              { tag: "@since", content: [{ kind: "text", text: "2.0.0" }] },
            ],
          },
        },
        {
          id: 4,
          name: "sum",
          variant: "declaration",
          kind: ReflectionKind.Function,
          flags: {},
          comment: {
            summary: [{ kind: "text", text: "Adds numbers." }],
            blockTags: [{ tag: "@since", content: [{ kind: "text", text: "1.5.0" }] }],
          },
        },
      ],
      comment: {
        summary: [
          {
            kind: "text",
            text: [
              "| Category | Domain |",
              "| --- | --- |",
              "| | |",
              "| math | module:Number.parse |",
              "| errors | module:Number.Missing |",
              "",
              "## Composition Patterns",
              "",
              "- Chain operations",
              "- Handle failures",
              "",
              "See also ",
            ].join("\n"),
          },
          { kind: "inline-tag", tag: "@link", text: "module:Number.sum" },
          { kind: "text", text: "." },
        ],
        blockTags: [
          {
            tag: "@see",
            content: [
              {
                kind: "text",
                text: [" - module:BigInt for integer operations", " - module:BigDecimal for decimal operations"].join(
                  "\n"
                ),
              },
            ],
          },
        ],
      },
    },
  ],
});

const duplicateModule = decodeReflection({
  schemaVersion: "2.0",
  id: 1,
  name: "effect/Dup",
  variant: "project",
  kind: ReflectionKind.Project,
  flags: {},
  children: [
    {
      id: 2,
      name: "Dup",
      variant: "declaration",
      kind: ReflectionKind.Module,
      flags: {},
      children: [
        { id: 3, name: "make", variant: "declaration", kind: ReflectionKind.Function, flags: {} },
        { id: 4, name: "make", variant: "declaration", kind: ReflectionKind.Namespace, flags: {} },
        { id: 5, name: "Make", variant: "declaration", kind: ReflectionKind.Interface, flags: {} },
      ],
    },
  ],
});

describe("ApiReference.moduleView", () => {
  it("renders GFM module comments without empty table rows", () => {
    const view = ApiReference.moduleView(numberModule, {
      moduleHref: (modulePath) => `/docs/v3/api/effect/${modulePath}`,
      modulePath: "Number",
    });
    const html = O.getOrThrow(view.commentHtml);
    assert.equal(A.length(A.fromIterable(html.matchAll(/<tr>/g))), 3);
    assert.match(html, /<td><a href="\/docs\/v3\/api\/effect\/Number#parse"><code>parse<\/code><\/a><\/td>/);
    assert.match(html, /<td><code>Missing<\/code><\/td>/);
    assert.match(html, /<h2>Composition Patterns<\/h2>/);
    assert.match(html, /See also <a href="\/docs\/v3\/api\/effect\/Number#sum"><code>sum<\/code><\/a>\./);
    assert.match(html, /<ul>\s*<li>Chain operations<\/li>\s*<li>Handle failures<\/li>\s*<\/ul>/);
    assert.match(html, /<a href="\/docs\/v3\/api\/effect\/BigInt"><code>BigInt<\/code><\/a> for integer operations/);
    assert.match(
      html,
      /<a href="\/docs\/v3\/api\/effect\/BigDecimal"><code>BigDecimal<\/code><\/a> for decimal operations/
    );
    assert.isFalse(/<li>\s*<ul>/.test(html));
    assert.isFalse(/module:/.test(html));
  });

  it("supports the pipeable form", () => {
    const view = ApiReference.moduleView({ modulePath: "Number" })(numberModule);
    assert.equal(view.declarationCount, 2);
  });

  it("groups declarations by category, renders signatures, and folds the earliest since", () => {
    const view = ApiReference.moduleView(numberModule, { modulePath: "Number" });
    assert.deepEqual(
      A.map(view.groups, (group) => [group.name, group.slug]),
      [
        ["Other", "category-other"],
        ["Parsing", "category-parsing"],
      ]
    );
    assert.equal(O.getOrThrow(view.since).minor, 5);
    const parse = O.getOrThrow(
      A.findFirst(
        A.flatMap(view.groups, (group) => group.declarations),
        (declaration) => declaration.name === "parse"
      )
    );
    assert.equal(O.getOrThrow(parse.signature), "declare function parse(input: string): number");
    assert.equal(A.length(parse.examples), 1);
    assert.deepEqual(
      A.map(parse.examples, (example) => O.getOrUndefined(example.title)),
      ["Parse ten"]
    );
  });

  it("dedupes anchors by kind and orders value declarations before type declarations", () => {
    const view = ApiReference.moduleView(duplicateModule, { modulePath: "Dup" });
    assert.deepEqual(
      A.map(
        A.flatMap(view.groups, (group) => group.declarations),
        (declaration) => [declaration.anchor, declaration.kind, O.getOrUndefined(declaration.typeKind)]
      ),
      [
        ["make-function", "function", undefined],
        ["make-namespace", "namespace", undefined],
        ["Make", "interface", "interface"],
      ]
    );
  });

  it("collects code examples across the reflection tree", () => {
    const examples = ApiReference.codeExamples(numberModule);
    assert.deepEqual(
      A.map(examples, (example) => [example.ownerName, example.language, O.getOrUndefined(example.title)]),
      [["parse", "typescript", "Parse ten"]]
    );
  });
});

describe("CodeSnippet", () => {
  it("normalizes info strings", () => {
    assert.deepEqual(O.getOrUndefined(CodeSnippet.CodeSnippetLanguageFromInfoString.decodeOption("")), "typescript");
    assert.deepEqual(
      O.getOrUndefined(CodeSnippet.CodeSnippetLanguageFromInfoString.decodeOption(" mjs ")),
      "javascript-esm"
    );
    assert.deepEqual(O.getOrUndefined(CodeSnippet.CodeSnippetLanguageFromInfoString.decodeOption("bash")), "bash");
    assert.isTrue(O.isNone(CodeSnippet.CodeSnippetLanguageFromInfoString.decodeOption("cobol")));
  });

  it("quotes property names only when needed", () => {
    assert.equal(CodeSnippet.typescriptPropertyName("value"), "value");
    assert.equal(CodeSnippet.typescriptPropertyName("[Symbol.iterator]"), "[Symbol.iterator]");
    assert.equal(CodeSnippet.typescriptPropertyName("content-type"), '"content-type"');
  });
});

describe("domain codecs", () => {
  it("derives module paths from export paths and back", () => {
    const decode = S.decodeSync(ModulePathFromExportPath);
    const decodeOption = S.decodeOption(ModulePathFromExportPath);
    const encode = S.encodeSync(ModulePathFromExportPath);
    assert.equal(decode("."), "index");
    assert.equal(decode("./unstable/http/HttpClient"), "unstable/http/HttpClient");
    assert.equal(encode(decode(".")), ".");
    assert.equal(encode(decode("./Option")), "./Option");
    assert.isTrue(O.isNone(decodeOption("./../escape")));
    assert.isTrue(O.isNone(decodeOption("./a//b")));
  });

  it("derives package slugs", () => {
    const decode = S.decodeOption(PackageSlugFromPackageName);
    assert.deepEqual(O.getOrUndefined(decode("@effect/platform-node")), "platform-node");
    assert.deepEqual(O.getOrUndefined(decode("effect")), "effect");
    assert.isTrue(O.isNone(decode("@other/Pkg")));
  });

  it("discriminates search metadata by content source", () => {
    const staged = BlogStagedSearchMetadata.make({
      schema_version: 1,
      content_source: "blog",
      page_href: "/blog/effect-4",
      page_title: "Effect 4",
      description: "What changed.",
      published_at: "2026-01-01",
      authors: [],
      tags: [],
      sections: [],
    });
    assert.isTrue(StagedSearchMetadata.guards.blog(staged));
    const stored = S.decodeSync(DocumentationSearchMetadata)({
      schema_version: 1,
      content_source: "documentation",
      docs_version: "v4",
      breadcrumbs: [],
      page_href: "/docs/v4/option",
      page_label: "Option",
      page_title: "Option",
      sections: ['{"line":1,"level":1,"title":"Option","anchor":"option","parent_anchor":"","excerpt":""}'],
    });
    assert.isTrue(SearchMetadata.guards.documentation(stored));
    assert.deepEqual(
      A.map(stored.sections, (section) => section.anchor),
      ["option"]
    );
  });
});

const configModule = decodeReflection({
  schemaVersion: "2.0",
  id: 1,
  name: "effect/Config",
  variant: "project",
  kind: ReflectionKind.Project,
  flags: {},
  children: [
    {
      id: 2,
      name: "Config",
      variant: "declaration",
      kind: ReflectionKind.Module,
      flags: {},
      comment: {
        summary: [
          {
            kind: "text",
            text: "Pairs with module:Other.thing and module:Missing.thing; see module:Other too.",
          },
        ],
      },
      children: [
        {
          id: 10,
          name: "Config",
          variant: "declaration",
          kind: ReflectionKind.Interface,
          flags: {},
          typeParameters: [
            {
              id: 11,
              name: "A",
              variant: "typeParam",
              kind: ReflectionKind.TypeParameter,
              flags: {},
              type: { type: "intrinsic", name: "string" },
            },
          ],
          extendedTypes: [{ type: "reference", name: "Base", target: -1 }],
          children: [
            {
              id: 12,
              name: "items",
              variant: "declaration",
              kind: ReflectionKind.Property,
              flags: { isReadonly: true },
              type: {
                type: "reference",
                name: "ReadonlyArray",
                target: -1,
                typeArguments: [
                  {
                    type: "reference",
                    name: "Option",
                    target: -1,
                    typeArguments: [{ type: "intrinsic", name: "string" }],
                  },
                ],
              },
            },
            {
              id: 13,
              name: "mode",
              variant: "declaration",
              kind: ReflectionKind.Property,
              flags: { isOptional: true },
              type: {
                type: "union",
                types: [
                  { type: "literal", value: "fast" },
                  { type: "literal", value: "safe" },
                ],
              },
            },
            {
              id: 14,
              name: "content-type",
              variant: "declaration",
              kind: ReflectionKind.Property,
              flags: {},
              type: { type: "intrinsic", name: "string" },
            },
            {
              id: 15,
              name: "run",
              variant: "declaration",
              kind: ReflectionKind.Method,
              flags: {},
              signatures: [
                {
                  id: 16,
                  name: "run",
                  variant: "signature",
                  kind: ReflectionKind.CallSignature,
                  flags: {},
                  parameters: [
                    {
                      id: 17,
                      name: "input",
                      variant: "param",
                      kind: ReflectionKind.Parameter,
                      flags: {},
                      type: {
                        type: "reflection",
                        declaration: {
                          id: 18,
                          name: "__type",
                          variant: "declaration",
                          kind: ReflectionKind.TypeLiteral,
                          flags: {},
                          children: [
                            {
                              id: 19,
                              name: "value",
                              variant: "declaration",
                              kind: ReflectionKind.Property,
                              flags: {},
                              type: { type: "intrinsic", name: "number" },
                            },
                          ],
                        },
                      },
                    },
                  ],
                  type: { type: "intrinsic", name: "void" },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe("ApiReference signatures and cross-module links", () => {
  it("renders interface signatures with generics, unions, quoted keys, and object literals", () => {
    const view = ApiReference.moduleView(configModule, { modulePath: "Config" });
    const config = O.getOrThrow(
      A.findFirst(
        A.flatMap(view.groups, (group) => group.declarations),
        (declaration) => declaration.name === "Config"
      )
    );
    assert.equal(
      O.getOrThrow(config.signature),
      [
        "interface Config<A extends string> extends Base {",
        "  readonly items: ReadonlyArray<Option<string>>;",
        '  mode?: "fast" | "safe";',
        '  "content-type": string;',
        "  run(input: {",
        "    value: number;",
        "  }): void;",
        "}",
      ].join("\n")
    );
    assert.deepEqual(O.getOrUndefined(config.typeKind), "interface");
  });

  it("links cross-module references without anchors and falls back to inline code without an href", () => {
    const html = O.getOrThrow(
      ApiReference.moduleView(configModule, {
        moduleHref: (modulePath) => (modulePath === "Missing" ? undefined : `/api/${modulePath}`),
        modulePath: "Config",
      }).commentHtml
    );
    assert.match(html, /<a href="\/api\/Other"><code>thing<\/code><\/a>/);
    assert.match(html, /<a href="\/api\/Other"><code>Other<\/code><\/a>/);
    assert.match(html, /(?<!<a href="[^"]*">)<code>thing<\/code>;/);
    assert.isFalse(/module:/.test(html));
  });

  it("anchors cross-module declaration links when no current module is given", () => {
    const html = O.getOrThrow(
      ApiReference.moduleView(configModule, { moduleHref: (modulePath) => `/api/${modulePath}` }).commentHtml
    );
    assert.match(html, /<a href="\/api\/Other#thing"><code>thing<\/code><\/a>/);
  });
});
